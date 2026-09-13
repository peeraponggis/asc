/* ============================================================================
 *  ชุดทดสอบกฎ bat-inverter และ bat-power ในตัวตรวจแบบ
 *
 *  รัน   node tests/advisor-batrule.mjs
 *
 *  ตรวจสามเรื่อง
 *  ----------------------------------------------------------------------
 *  1. กฎใหม่ให้ระดับถูกต้องกับคู่ที่รู้คำตอบแน่นอน
 *  2. ถ้าไม่ได้โหลด asc-batmatch.js กฎต้องคืน null เงียบ ๆ
 *     ไม่ใช่ทำให้ตัวตรวจทั้งชุดพัง (หน้ารายงานรุ่นเก่าอาจยังไม่มีไฟล์นี้)
 *  3. จำนวนข้อที่ตรวจได้ของโครงการเดิมต้องไม่ลดลงเพราะกฎใหม่
 * ==========================================================================*/

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DOCS = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs');
const src = f => readFileSync(join(DOCS, f), 'utf8');

let pass = 0, fail = 0;
const bad = [];
const eq = (name, got, want) => {
    if (got === want) { pass++; return; }
    fail++; bad.push(`${name}\n    ได้   ${JSON.stringify(got)}\n    ควรได้ ${JSON.stringify(want)}`);
};

/* โหลดชุดโมดูลเข้ามาในบริบทที่กำหนดเอง จะได้ทดสอบกรณี "ไม่มี asc-batmatch.js" ได้ */
function boot(withBatMatch) {
    const g = {};
    g.window = g; g.globalThis = g; g.console = console;
    const run = code => new Function('global', 'window', 'globalThis', 'console', code)
        (g, g, g, console);
    run(src('asc-eit.js'));
    run(src('asc-kb.js'));
    if (withBatMatch) run(src('asc-batmatch.js'));
    run(src('asc-advisor.js'));
    return g;
}

/* ── DB2 สังเคราะห์ เอาเฉพาะก้อนที่กฎนี้ใช้ ─────────────────────────── */

const SH10T = {
    Manufacturer: 'Sungrow', Model_Name: 'SH10T', Inverter_Type: 'Hybrid',
    Battery_Coupling_Class: 'HV',
    Battery_Voltage_Range_Min_V: 100, Battery_Voltage_Range_Max_V: 700,
    Rated_AC_Output_Power_kW: 10, qty: 1
};
const SBR128 = {
    Manufacturer: 'Sungrow', Model_Name: 'SBR128', Battery_Voltage_Class: 'HV',
    Nominal_Voltage_V: 256, Operating_Voltage_Min_V: 216, Operating_Voltage_Max_V: 292,
    Compatible_Inverter_Models: 'Sungrow SH5T, SH6T, SH8T, SH10T, SH12T, SH15T, SH20T, SH25T'
};
const US5000 = {
    Manufacturer: 'Pylontech', Model_Name: 'US5000', Battery_Voltage_Class: 'LV',
    Nominal_Voltage_V: 48,
    Compatible_Inverter_Models: 'Solis S6-EH1P(3-10)K-L-PLUS (Solis battery option PYLON_LV)'
};
const HVM138 = {
    Manufacturer: 'BYD', Model_Name: 'Battery-Box Premium HVM 13.8', Battery_Voltage_Class: 'HV',
    Operating_Voltage_Min_V: 200, Operating_Voltage_Max_V: 295,
    Compatible_Inverter_Models: 'Solis S6-EH3P(12-20)K-H (Solis battery option B_BOX_HV BYD)'
};
const SBR256 = {
    Manufacturer: 'Sungrow', Model_Name: 'SBR256', Battery_Voltage_Class: 'HV',
    Operating_Voltage_Min_V: 432, Operating_Voltage_Max_V: 584,
    Number_of_Modules_Recorded: 8, Min_Modules_Per_Stack: 2, Max_Modules_Per_Stack: 8,
    Compatible_Inverter_Models: ''
};
const SH5RS20 = {
    Manufacturer: 'Sungrow', Model_Name: 'SH5.0RS-20', Inverter_Type: 'Hybrid',
    Battery_Coupling_Class: 'HV',
    Battery_Voltage_Range_Min_V: 80, Battery_Voltage_Range_Max_V: 460,
    Rated_AC_Output_Power_kW: 5, qty: 1
};

/* ตัวตรวจแบบรับ DB2 ที่ห่อด้วย base_layout_db1 ตามรูปไฟล์จริง
   ถ้าห่อไม่ถูก normalize() จะคืนก้อนว่างแล้วทุกกฎเงียบหมดโดยไม่ฟ้องอะไร */
const db2 = (inv1, bat) => ({
    base_layout_db1: {
        step1_initialization: { projectName: 'ทดสอบ', coordinates: '13.7,100.5' },
        step2_equipment: { pv: {}, inv1: inv1, inv2: {}, opt: {}, bat: bat, industrial_settings: {} },
        step3_design_and_layout: { roofPolygons: [] },
        step4_validation_results: {}
    },
    simulation_params_db2: {}
});

function findingOf(g, inv1, bat, id) {
    const r = g.AscAdvisor.analyze(db2(inv1, bat));
    return r.findings.find(f => f.id === (id || 'bat-inverter')) || null;
}

/* ── 1. ระดับของกฎ ───────────────────────────────────────────────────── */

const G = boot(true);

eq('SBR128 + SH10T ผ่านและอ้างเอกสาร', (findingOf(G, SH10T, SBR128) || {}).level, 'ok');
eq('BYD HVM13.8 + SH10T แรงดันได้แต่เอกสารไม่ยืนยัน',
   (findingOf(G, SH10T, HVM138) || {}).level, 'info');
eq('Pylontech US5000 + SH10T คนละชนิดแรงดัน ต้องเป็น error',
   (findingOf(G, SH10T, US5000) || {}).level, 'error');
eq('SBR256 + SH5.0RS-20 ล้นช่วง ต้องเป็น warn',
   (findingOf(G, SH5RS20, SBR256) || {}).level, 'warn');
eq('ยังไม่ได้เลือกแบตเตอรี่ ต้องไม่มีข้อนี้เลย',
   findingOf(G, SH10T, {}), null);

/* กรณีล้นช่วง ต้องบอกจำนวนโมดูลที่ใช้ได้เป็นตัวเลข ไม่ใช่บอกลอย ๆ ว่าให้ลดโมดูล
   เพราะคนอ่านต้องเอาไปเขียนในแบบและคิดความจุใหม่ก่อนเสนอราคา */
const fPartial = findingOf(G, SH5RS20, SBR256);
eq('บอกช่วงจำนวนโมดูลในหลักฐาน',
   /ใช้ได้ 2-6 โมดูล จากที่ตู้มี 8/.test((fPartial || {}).evidence || ''), true);
eq('วิธีแก้บอกจำนวนโมดูลสูงสุดที่เหลือได้',
   /ไม่เกิน 6 โมดูล/.test(((fPartial || {}).fix || []).join(' ')), true);
eq('เตือนว่าความจุที่ได้จริงลดลง',
   /ความจุที่ได้จริงจะลดลง/.test(((fPartial || {}).fix || []).join(' ')), true);

/* ข้อความต้องอ้าง Battery Option ที่ช่างต้องตั้ง เมื่อเอกสารให้มา */
const fSolis = (() => {
    const inv = { Manufacturer: 'Solis', Model_Name: 'S6-EH3P20K-H', Inverter_Type: 'Hybrid',
        Battery_Coupling_Class: 'HV', Battery_Voltage_Range_Min_V: 120,
        Battery_Voltage_Range_Max_V: 800, Rated_AC_Output_Power_kW: 20, qty: 1 };
    return findingOf(G, inv, HVM138);
})();
eq('บอกชื่อ Battery Option ในผลตรวจ',
   /B_BOX_HV BYD/.test((fSolis || {}).detail || ''), true);

/* ทุก finding ต้องชี้ไปที่บทความที่มีอยู่จริง */
eq('บทความ battery-match มีอยู่จริงในฐานความรู้',
   !!G.AscKB.get('battery-match'), true);

/* ── 1b. กฎ bat-power ─────────────────────────────────────────────────

   พิกัดไฟสำรองบนดาต้าชีตเป็นของอินเวอร์เตอร์ ไม่ใช่ของทั้งระบบ
   ถ้าแบตจ่ายไม่ถึง เลขที่ไปอยู่ในข้อเสนอที่ลูกค้าเซ็นจะเกินจริง
   ข้อนี้จึงเป็นคำเตือน ไม่ใช่แค่ข้อสังเกต */

const SH10RL = {
    Manufacturer: 'Sungrow', Model_Name: 'SH10RL', Inverter_Type: 'Hybrid',
    Battery_Coupling_Class: 'LV',
    Battery_Voltage_Range_Min_V: 40, Battery_Voltage_Range_Max_V: 60,
    Rated_AC_Output_Power_kW: 10,
    Max_Charge_Power_kW: 10, Max_Discharge_Power_kW: 10, Backup_Rated_Power_kW: 10,
    qty: 1
};
const MGL060 = {
    Manufacturer: 'Sungrow', Model_Name: 'MGL060', Battery_Voltage_Class: 'LV',
    Nominal_Voltage_V: 51.2, Operating_Voltage_Min_V: 44.8, Operating_Voltage_Max_V: 57.6,
    Max_Continuous_Charge_Current_A: 60, Max_Continuous_Discharge_Current_A: 60,
    qty: 1
};

const fPw1 = findingOf(G, SH10RL, MGL060, 'bat-power');
eq('แบตก้อนเดียวจ่ายไม่ถึงพิกัดไฟสำรอง ต้องเป็น warn', (fPw1 || {}).level, 'warn');
eq('ต้องบอกตัวเลขไฟสำรองที่ใช้ได้จริง',
   /3.07 kW/.test((fPw1 || {}).detail || ''), true);
eq('ต้องบอกว่ากำลังของแบตเป็นค่าที่คำนวณมา',
   /คำนวณจากกระแส/.test((fPw1 || {}).evidence || ''), true);
eq('วิธีแก้ต้องเสนอให้เพิ่มจำนวนชุดแบต',
   /เพิ่มจำนวนชุดแบตเตอรี่/.test(((fPw1 || {}).fix || []).join(' ')), true);

const fPw4 = findingOf(G, SH10RL, Object.assign({}, MGL060, { qty: 4 }), 'bat-power');
eq('สี่ก้อนจ่ายครบพิกัดแล้ว ต้องผ่าน', (fPw4 || {}).level, 'ok');
eq('และต้องบอกกำลังที่ทำได้จริง 10 kW',
   /คายประจุได้จริง 10 kW/.test((fPw4 || {}).detail || ''), true);

/* แบตจำกัดต่ำกว่าพิกัดสูงสุดของอินเวอร์เตอร์เฉย ๆ เป็นเรื่องปกติและตั้งใจ
   จึงต้องเป็นข้อสังเกต ไม่ใช่คำเตือน ไม่งั้นจะเตือนเกือบทุกโครงการ */
const SH10NB = Object.assign({}, SH10RL, { Backup_Rated_Power_kW: 0 });
const fPwInfo = findingOf(G, SH10NB, MGL060, 'bat-power');
eq('ไม่มีพิกัดไฟสำรอง แบตแค่จำกัดกำลัง ต้องเป็น info', (fPwInfo || {}).level, 'info');

/* ข้อมูลไม่พอ ต้องเงียบ ไม่ใช่เดา */
eq('ไม่มีข้อมูลกำลังทั้งสองฝั่ง ต้องไม่มีข้อนี้',
   findingOf(G, SH10T, SBR128, 'bat-power'), null);
eq('ยังไม่ได้เลือกแบตเตอรี่ ต้องไม่มีข้อ bat-power',
   findingOf(G, SH10RL, {}, 'bat-power'), null);

/* ── 2. ไม่มี asc-batmatch.js ต้องเงียบ ไม่พัง ──────────────────────── */

const G2 = boot(false);
let crashed = false, res2 = null;
try { res2 = G2.AscAdvisor.analyze(db2(SH10T, US5000)); } catch (e) { crashed = true; }
eq('ไม่มีโมดูลจับคู่ ตัวตรวจต้องไม่พัง', crashed, false);
eq('ไม่มีโมดูลจับคู่ ต้องไม่มีข้อ bat-inverter',
   !!(res2 && res2.findings.find(f => f.id === 'bat-inverter')), false);
eq('ไม่มีโมดูลจับคู่ ต้องไม่มีข้อ bat-power',
   !!(res2 && res2.findings.find(f => f.id === 'bat-power')), false);

/* ── 3. ของเดิมต้องไม่หายไป ──────────────────────────────────────────── */

const base = G2.AscAdvisor.analyze(db2(SH10T, SBR128));
const now  = G.AscAdvisor.analyze(db2(SH10T, SBR128));
const skip = id => id === 'bat-inverter' || id === 'bat-power';
const idsBase = base.findings.map(f => f.id).filter(id => !skip(id)).sort().join(',');
const idsNow  = now.findings.map(f => f.id).filter(id => !skip(id)).sort().join(',');
eq('ข้อตรวจเดิมยังครบเหมือนเดิม', idsNow, idsBase);
/* คู่นี้ไม่มีข้อมูลกำลัง กฎ bat-power จึงต้องเงียบ เพิ่มมาแค่ข้อเดียว */
eq('กฎใหม่เพิ่มมาหนึ่งข้อพอดี', now.findings.length - base.findings.length, 1);

/* คู่ที่มีข้อมูลกำลังครบ ต้องเพิ่มมาสองข้อ */
const nowPw = G.AscAdvisor.analyze(db2(SH10RL, MGL060));
const basePw = G2.AscAdvisor.analyze(db2(SH10RL, MGL060));
eq('คู่ที่มีข้อมูลกำลังครบ เพิ่มมาสองข้อ', nowPw.findings.length - basePw.findings.length, 2);

/* ไม่มีกฎไหน throw จนกลายเป็น finding ระดับ info ที่ขึ้นต้นว่า "กฎ" */
const thrown = now.findings.filter(f => /^กฎ .* ทำงานไม่สำเร็จ/.test(f.title || ''));
eq('ไม่มีกฎไหนพังระหว่างทาง', thrown.length, 0);
if (thrown.length) thrown.forEach(t => console.log('   ! ' + t.title + ' — ' + t.detail));

/* ── จำนวนแบตเตอรี่เป็น 0 ต้องไม่ขัดกับตารางวัสดุอุปกรณ์ ────────────────
   ตารางวัสดุขึ้นแถวแบตเตอรี่เมื่อ batQty > 0 เท่านั้น ถ้าตัวตรวจยังฟ้อง
   เรื่องความเข้ากันได้ทั้งที่จำนวนเป็น 0 ผู้ใช้จะเจอสองแผงพูดคนละอย่าง */

const batZero  = Object.assign({}, US5000, { qty: 0 });   // คู่ที่ปกติต้องเป็น error
const fZero    = findingOf(G, SH10T, batZero);
eq('จำนวนแบตเป็น 0 ไม่ฟ้องว่าต่อกันไม่ได้', fZero && fZero.level, 'warn');
eq('จำนวนแบตเป็น 0 บอกสาเหตุตรง ๆ',
   !!(fZero && /จำนวนเป็น 0/.test(fZero.title || '')), true);
eq('จำนวนแบตเป็น 0 กฎกำลังต้องเงียบ',
   findingOf(G, SH10T, batZero, 'bat-power'), null);

const batOne   = Object.assign({}, US5000, { qty: 1 });
eq('ระบุจำนวน 1 กลับมาตรวจความเข้ากันได้ตามปกติ',
   (findingOf(G, SH10T, batOne) || {}).level, 'error');

/* ไม่ระบุจำนวนมาเลย (ไฟล์รุ่นเก่า) ต้องยังตรวจเหมือนเดิม ไม่ข้ามเงียบ ๆ */
eq('ไม่ระบุจำนวน ยังตรวจความเข้ากันได้เหมือนเดิม',
   (findingOf(G, SH10T, US5000) || {}).level, 'error');

/* ── สรุป ──────────────────────────────────────────────────────────── */

console.log('\nผ่าน ' + pass + ' ข้อ · ตก ' + fail + ' ข้อ');
console.log('ข้อที่ตัวตรวจตรวจได้ทั้งหมด ' + now.findings.length + ' ข้อ');
if (fail) {
    console.log('\nข้อที่ตก');
    bad.forEach(b => console.log('  ' + b));
    process.exit(1);
}
console.log('ผ่านทั้งหมด');
