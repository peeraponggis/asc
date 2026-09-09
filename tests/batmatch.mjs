/* ============================================================================
 *  ชุดทดสอบตัวจับคู่แบตเตอรี่กับอินเวอร์เตอร์ (asc-batmatch.js)
 *
 *  รัน   node tests/batmatch.mjs
 *        node tests/batmatch.mjs --bank "F:/.../Datasheet_Extract_2026-08-31"
 *
 *  ทำไมต้องมีไฟล์นี้
 *  ----------------------------------------------------------------------
 *  ตัวจับคู่นี้อ่านชื่อรุ่นจากข้อความอิสระในดาต้าชีต ซึ่งแต่ละยี่ห้อเขียน
 *  คนละแบบ ทั้งช่วงกำลังในวงเล็บ "S6-EH3P(5-10)K2-H" ทั้งทับแบบ
 *  "LUNA2000-5/10/15-S0" และหมายเหตุท้ายวงเล็บที่ไม่ใช่ชื่อรุ่น
 *  แก้ regex ผิดนิดเดียวจะจับคู่ผิดเงียบ ๆ แล้วไปแนะนำแบตที่ต่อไม่ได้
 *
 *  เกณฑ์ผ่าน
 *  ----------------------------------------------------------------------
 *  · เคสที่รู้คำตอบแน่นอนต้องถูกทุกข้อ (ไม่ยอมให้พลาดแม้ข้อเดียว)
 *  · ถ้าชี้ที่คลังจริงด้วย --bank จะกวาดทุกคู่เพื่อดูว่าไม่มีคู่ไหน
 *    ถูกตัดสินว่า "ตรงตามเอกสาร" ทั้งที่ชนิดแรงดันคนละอย่าง
 * ==========================================================================*/

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = globalThis;
g.window = g;
new Function(readFileSync(join(ROOT, 'docs', 'asc-batmatch.js'), 'utf8'))();
const BM = g.AscBatMatch;

let pass = 0, fail = 0;
const bad = [];

function eq(name, got, want) {
    if (got === want) { pass++; return; }
    fail++; bad.push(`${name}\n    ได้   ${JSON.stringify(got)}\n    ควรได้ ${JSON.stringify(want)}`);
}

/* ── 1. การแยกรายการรุ่นออกจากข้อความอิสระ ──────────────────────────── */

eq('ตัดยี่ห้อนำหน้าแล้วแยกด้วยจุลภาค',
   BM._parseList('Sungrow SH5T, SH6T, SH8T', 'Sungrow').join('|'),
   'SH5T|SH6T|SH8T');

eq('ตัดหมายเหตุท้ายวงเล็บที่มีช่องว่างข้างใน',
   BM._parseList('S6-EH3P(5-10)K2-H (Solis battery option B_BOX_HV BYD)', 'Solis').join('|'),
   'S6-EH3P(5-10)K2-H');

eq('วงเล็บช่วงกำลังต้องไม่ถูกตัดทิ้ง',
   BM._parseList('S6-EH3P(12-20)K-H').join('|'),
   'S6-EH3P(12-20)K-H');

eq('ขยายทับที่เป็นตัวเลข',
   BM._parseList('LUNA2000-5/10/15-S0').join('|'),
   'LUNA2000-5-S0|LUNA2000-10-S0|LUNA2000-15-S0');

/* ── 2. การเทียบโทเคนกับชื่อรุ่น ─────────────────────────────────────── */

eq('ช่วงกำลัง ขอบบน',      BM._tokenMatches('S6-EH3P(5-10)K2-H', 'S6-EH3P10K2-H'), true);
eq('ช่วงกำลัง ขอบล่าง',    BM._tokenMatches('S6-EH3P(5-10)K2-H', 'S6-EH3P5K2-H'),  true);
eq('ช่วงกำลัง นอกช่วง',    BM._tokenMatches('S6-EH3P(5-10)K2-H', 'S6-EH3P20K2-H'), false);
eq('ช่วงกำลัง ท้ายไม่ตรง', BM._tokenMatches('S6-EH3P(5-10)K2-H', 'S6-EH3P10K-H'),  false);

/* เคสที่พลาดง่ายที่สุด รุ่น 10K02-NV-YD-L ต้องไม่เข้าช่วงของ (5-10)K2-H
   เพราะส่วนกลางคือ "10K02NVYD" ไม่ใช่ตัวเลขล้วน */
eq('ช่วงกำลัง ส่วนกลางไม่ใช่ตัวเลขล้วน',
   BM._tokenMatches('S6-EH3P(5-10)K2-H', 'S6-EH3P10K02-NV-YD-L'), false);

eq('ตระกูลลงท้าย series',  BM._tokenMatches('SigenStor EC series', 'SigenStor EC 10.0 TP'), true);
eq('ตระกูล series คนละตระกูล',
   BM._tokenMatches('SigenStor EC series', 'Sigen Hybrid 10.0 TP'), false);

eq('ชื่อตรงกันแม้ขีดกับช่องว่างต่างกัน',
   BM._tokenMatches('SUN2000-10K-MAP0', 'SUN2000 10K MAP0'), true);
eq('ชื่อใกล้กันแต่ไม่ใช่รุ่นเดียวกัน',
   BM._tokenMatches('SUN2000-10K-MAP0', 'SUN2000-12K-MAP0'), false);

/* ── 3. ผลการจับคู่ทั้งชุด ───────────────────────────────────────────── */

const SH10T = {
    Manufacturer: 'Sungrow', Model_Name: 'SH10T', Inverter_Type: 'Hybrid',
    Battery_Coupling_Class: 'HV',
    Battery_Voltage_Range_Min_V: 100, Battery_Voltage_Range_Max_V: 700,
    Compatible_Battery_Models: ''
};
const SBR128 = {
    Manufacturer: 'Sungrow', Model_Name: 'SBR128', Battery_Voltage_Class: 'HV',
    Nominal_Voltage_V: 256, Operating_Voltage_Min_V: 216, Operating_Voltage_Max_V: 292,
    Compatible_Inverter_Models: 'Sungrow SH5T, SH6T, SH8T, SH10T, SH12T, SH15T, SH20T, SH25T'
};
const HVM138 = {
    Manufacturer: 'BYD', Model_Name: 'Battery-Box Premium HVM 13.8', Battery_Voltage_Class: 'HV',
    Nominal_Voltage_V: 256, Operating_Voltage_Min_V: 200, Operating_Voltage_Max_V: 295,
    Compatible_Inverter_Models: 'Solis S6-EH3P(5-10)K2-H, S6-EH3P(12-20)K-H, S6-EH3P(29.9-50)K-H ' +
                                '(Solis battery option B_BOX_HV BYD / BYD-HVS/HVM)'
};
const US5000 = {
    Manufacturer: 'Pylontech', Model_Name: 'US5000', Battery_Voltage_Class: 'LV',
    Nominal_Voltage_V: 48, Operating_Voltage_Min_V: 0, Operating_Voltage_Max_V: 0,
    Compatible_Inverter_Models: 'Solis S6-EH1P(3-10)K-L-PLUS, S6-EH3P(8-15)K02-NV-YD-L ' +
                                '(Solis battery option PYLON_LV)'
};
const EH1P6K = {
    Manufacturer: 'Solis', Model_Name: 'S6-EH1P6K-L-PLUS', Inverter_Type: 'Hybrid',
    Battery_Coupling_Class: 'LV',
    Battery_Voltage_Range_Min_V: 40, Battery_Voltage_Range_Max_V: 60,
    Compatible_Battery_Models: ''
};
const EH3P20K = {
    Manufacturer: 'Solis', Model_Name: 'S6-EH3P20K-H', Inverter_Type: 'Hybrid',
    Battery_Coupling_Class: 'HV',
    Battery_Voltage_Range_Min_V: 120, Battery_Voltage_Range_Max_V: 800,
    Compatible_Battery_Models: ''
};
const SG10RT = {
    Manufacturer: 'Sungrow', Model_Name: 'SG10RT-P2', Inverter_Type: 'String',
    Battery_Coupling_Class: 'None'
};

eq('SBR128 + SH10T ตรงตามเอกสาร',        BM.match(SH10T, SBR128).level,  'doc');
eq('HVM13.8 + S6-EH3P20K-H ตรงตามเอกสาร', BM.match(EH3P20K, HVM138).level, 'doc');
eq('US5000 + S6-EH1P6K-L-PLUS ตรงตามเอกสาร', BM.match(EH1P6K, US5000).level, 'doc');

/* BYD HVM ไม่มีชื่อ Sungrow ในเอกสาร แต่แรงดันอยู่ในช่วง จึงเป็น volt ไม่ใช่ doc */
eq('HVM13.8 + SH10T แรงดันเข้ากันได้แต่เอกสารไม่ยืนยัน', BM.match(SH10T, HVM138).level, 'volt');

/* คนละชนิดแรงดัน ต้องไม่เข้ากันเด็ดขาด */
eq('US5000 + SH10T คนละชนิดแรงดัน',      BM.match(SH10T, US5000).level,   'no');
eq('SBR128 + S6-EH1P6K-L-PLUS คนละชนิด', BM.match(EH1P6K, SBR128).level,  'no');

/* อินเวอร์เตอร์สตริงต่อแบตไม่ได้ */
eq('SBR128 + SG10RT-P2 เป็นสตริง',       BM.match(SG10RT, SBR128).level,  'no');

/* ข้อมูลไม่พอต้องบอกว่าไม่พอ ไม่ใช่เดา */
eq('ไม่มีข้อมูลแรงดันทั้งสองฝั่ง',
   BM.match({ Manufacturer: 'X', Model_Name: 'X1', Inverter_Type: 'Hybrid', Battery_Coupling_Class: 'HV' },
            { Manufacturer: 'Y', Model_Name: 'Y1', Battery_Voltage_Class: 'HV' }).level, 'unknown');

/* ชื่อ Battery Option ที่ช่างต้องตั้งหน้างาน ต้องดึงออกมาได้ */
eq('ดึงชื่อ Battery Option', BM.batteryOption(US5000), 'PYLON_LV');
eq('ไม่มี Battery Option ก็ต้องคืนค่าว่าง', BM.batteryOption(SBR128), '');

/* ── 4. กวาดคลังจริง (ถ้าชี้ที่อยู่มาให้) ────────────────────────────── */

const bankArg = process.argv.indexOf('--bank');
const BANK = bankArg > -1 ? process.argv[bankArg + 1] : null;

if (BANK && existsSync(BANK)) {
    const parseMod = await import('../docs/asc-datasheet-parse.js').catch(() => null);
    const P = parseMod ? (parseMod.default || parseMod) : g.AscDatasheet;

    const load = sub => {
        const dir = join(BANK, sub);
        if (!existsSync(dir)) return [];
        return readdirSync(dir).filter(f => f.endsWith('.txt'))
            .map(f => P.parse(readFileSync(join(dir, f), 'utf8')));
    };

    const invs = load('INV').filter(o => String(o.Inverter_Type).toUpperCase() === 'HYBRID');
    const bats = load('ESS');
    const tally = { doc: 0, volt: 0, partial: 0, no: 0, unknown: 0 };
    const contradictions = [];

    invs.forEach(i => bats.forEach(b => {
        const r = BM.match(i, b);
        tally[r.level] = (tally[r.level] || 0) + 1;
        /* ตรวจข้อที่ยอมไม่ได้ ตรงตามเอกสารแต่ชนิดแรงดันคนละอย่าง */
        const ic = String(i.Battery_Coupling_Class || '').toUpperCase();
        const bc = String(b.Battery_Voltage_Class || '').toUpperCase();
        if (r.level === 'doc' && ic && bc && ic !== bc) {
            contradictions.push(i.Model_Name + ' + ' + b.Model_Name);
        }
    }));

    console.log('\nกวาดคลังจริง  อินเวอร์เตอร์ไฮบริด ' + invs.length + ' รุ่น × แบตเตอรี่ ' + bats.length + ' รุ่น');
    Object.keys(tally).forEach(k => console.log('  ' + (BM.LABEL[k] || k).padEnd(24) + tally[k]));

    eq('ไม่มีคู่ไหนตรงตามเอกสารทั้งที่ชนิดแรงดันคนละอย่าง', contradictions.length, 0);
    if (contradictions.length) contradictions.slice(0, 10).forEach(c => console.log('    ! ' + c));
    if (!tally.doc) { fail++; bad.push('กวาดคลังแล้วไม่เจอคู่ที่ตรงตามเอกสารเลยสักคู่ ตัวจับคู่น่าจะพัง'); }
} else if (BANK) {
    console.log('\nไม่พบโฟลเดอร์คลังที่ระบุ ข้ามการกวาดคลังจริง : ' + BANK);
}

/* ── สรุป ──────────────────────────────────────────────────────────── */

console.log('\nผ่าน ' + pass + ' ข้อ · ตก ' + fail + ' ข้อ');
if (fail) {
    console.log('\nข้อที่ตก');
    bad.forEach(b => console.log('  ' + b));
    process.exit(1);
}
console.log('ผ่านทั้งหมด');
