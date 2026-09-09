/* ============================================================================
 *  ชุดทดสอบระยะการแยก S และเขตป้องกัน (asc-lps.js)
 *
 *  รัน   node tests/lps-zone.mjs
 *
 *  ทำไมต้องมีไฟล์นี้
 *  ----------------------------------------------------------------------
 *  ตัวเลขทั้งหมดใน asc-lps.js ยกมาจากเอกสารที่ **อ้างถึง** มาตรฐานของ วสท.
 *  อีกทอดหนึ่ง ไม่ได้ยกจากตัวเล่ม การพิมพ์ผิดช่องเดียวจึงจับได้ยากมาก
 *  เพราะไม่มีเล่มให้เปิดเทียบ
 *
 *  ชุดนี้จึงยึดสองอย่างที่ **ตรวจสอบตัวเองได้** โดยไม่ต้องมีเล่ม
 *
 *    1. ตัวอย่างคำนวณในเอกสาร  LPS 3 · l = 17 ม. -> s = 0.6 ม.
 *       ถ้าสูตรหรือค่าสัมประสิทธิ์ผิด ตัวอย่างจะไม่ออก
 *
 *    2. ตารางมุมป้องกันต้องสอดคล้องกับเรขาคณิต  รัศมี = h x tan(α)
 *       ทั้ง 68 ช่อง ถ้าพิมพ์ α ผิดช่องเดียว รัศมีจะไม่ตรงกับที่เอกสารพิมพ์ไว้
 *       เป็นการตรวจทานข้ามที่ไม่ต้องพึ่งเล่มต้นฉบับ
 *
 *    3. รัศมีทรงกลมกลิ้งต้องตรงกับ r = 10 x I^0.65 ที่เอกสารให้มาด้วย
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
const near = (name, got, want, tol) => {
    if (typeof got === 'number' && Math.abs(got - want) <= tol) { pass++; return; }
    fail++; bad.push(`${name}\n    ได้   ${JSON.stringify(got)}\n    ควรได้ ${want} ± ${tol}`);
};

function boot() {
    const g = {};
    g.window = g; g.globalThis = g; g.console = console;
    const run = code => new Function('global', 'window', 'globalThis', 'console', 'document', code)
        (g, g, g, console, undefined);
    run(src('asc-eit.js'));
    run(src('asc-kb.js'));
    run(src('asc-lps.js'));
    run(src('asc-advisor.js'));
    return g;
}
const G = boot();
const LP = G.AscLps;

/* ── 1. ตัวอย่างคำนวณในเอกสาร (สไลด์ 102) ───────────────────────────── */

const ex = LP.separation({ lpl: 'III', material: 'solid', downConductors: 3, length: 17 });
eq('ตัวอย่างในเอกสารคำนวณได้',        ex.ok, true);
near('  s ต้องได้ 0.6 ม.',            ex.s, 0.6, 0.005);
eq('  ki ของ LPS 3',                  ex.ki, 0.04);
eq('  km ของคอนกรีต',                 ex.km, 0.5);
eq('  kc ของตัวนำลงดิน 3 เส้น',        ex.kc, 0.44);
eq('  บรรทัดวิธีคิดยกไปลงเอกสารได้',   ex.working, 's = (0.04 / 0.5) x 0.44 x 17 = 0.598 ม.');

/* ── 2. ค่าสัมประสิทธิ์ทีละตัว ───────────────────────────────────────── */

eq('ki ระดับ I',   LP.KI.I, 0.08);
eq('ki ระดับ II',  LP.KI.II, 0.06);
eq('ki ระดับ III', LP.KI.III, 0.04);
eq('ki ระดับ IV เท่ากับ III', LP.KI.IV, 0.04);
eq('km อากาศ',     LP.KM.air, 1);
eq('km ของแข็ง',   LP.KM.solid, 0.5);
eq('kc ตัวนำลงดิน 1 เส้น',  LP.kcFor(1), 1);
eq('kc ตัวนำลงดิน 2 เส้น',  LP.kcFor(2), 0.66);
eq('kc ตัวนำลงดิน 3 เส้น',  LP.kcFor(3), 0.44);
eq('kc ตัวนำลงดิน 8 เส้น ยังเป็น 0.44', LP.kcFor(8), 0.44);
eq('kc ที่ไม่ถูกต้อง ต้องคืน null', LP.kcFor(0), null);

/* ข้อมูลไม่ครบต้องบอกว่าขาดอะไร ไม่ใช่คืนตัวเลขมั่ว */
const miss = LP.separation({ lpl: 'II', material: 'air' });
eq('ข้อมูลไม่ครบ ต้องไม่คำนวณ', miss.ok, false);
eq('  และบอกว่าขาดสองอย่าง',    miss.missing.length, 2);

/* ── 3. ตารางมุมป้องกัน · ตรวจทานข้ามกับเรขาคณิต ────────────────────── */

/* รัศมีที่เอกสารพิมพ์ไว้ในตารางที่ 4.1 (สไลด์ 55) h = 1..17
   ถ้า α ที่เก็บไว้ผิดช่องใดช่องหนึ่ง h x tan(α) จะไม่ตรงกับแถวนี้ */
const R_DOC = {
    I:  [null, 2.90, 5.81, 6.74, 7.52, 8.32, 8.90, 9.29, 9.53, 10.00, 10.00, 10.26, 10.07, 10.16, 10.17, 10.12, 10.00, 9.42],
    II: [null, 3.49, 6.97, 8.71, 9.90, 10.72, 11.28, 12.12, 12.80, 13.34, 13.76, 14.08, 14.30, 14.95, 15.01, 15.00, 15.45, 15.31],
    III:[null, 4.33, 8.66, 10.46, 12.31, 13.74, 14.85, 15.72, 16.40, 16.93, 18.04, 18.31, 19.20, 20.02, 19.99, 20.65, 21.23, 20.99],
    IV: [null, 5.14, 10.29, 12.03, 13.95, 15.39, 17.43, 18.24, 19.80, 20.21, 21.45, 22.55, 22.57, 23.45, 24.25, 24.96, 25.61, 26.18]
};
let mismatch = 0, checked = 0;
['I', 'II', 'III', 'IV'].forEach(k => {
    for (let h = 1; h <= 17; h++) {
        const z = LP.protectionAngle(k, h);
        checked++;
        if (!z || Math.abs(z.radius - R_DOC[k][h]) > 0.02) mismatch++;
    }
});
eq('ตรวจตารางมุมป้องกันครบ 68 ช่อง', checked, 68);
eq('  รัศมี = h x tan(α) ตรงกับที่เอกสารพิมพ์ทุกช่อง', mismatch, 0);

/* จุดที่จำง่ายและผิดง่าย ระดับ I ที่ 10 ม. มุม 45 องศา รัศมีจึงเท่ากับความสูงพอดี */
const z10 = LP.protectionAngle('I', 10);
eq('LPL I ที่ 10 ม. มุม 45 องศา', z10.alpha, 45);
near('  รัศมีจึงเท่ากับความสูง',   z10.radius, 10.00, 0.01);

/* ความสูงไม่ลงตัว ต้องปัดขึ้นแถวถัดไป ซึ่งได้มุมแคบกว่า เป็นด้านปลอดภัย */
const z25 = LP.protectionAngle('II', 2.5);
eq('h 2.5 ม. ใช้แถว 3 ม.', z25.hRow, 3);
eq('  จึงได้มุมของแถว 3 ม.', z25.alpha, 71);
eq('  และติดธงว่าปัดแถว',    z25.rounded, true);

/* เกินช่วงตารางต้องบอกว่าคำนวณไม่ได้ ห้ามประมาณต่อ */
const zBig = LP.protectionAngle('III', 25);
eq('h เกิน 17 ม. ต้องบอกว่าเกินช่วง', zBig.outOfRange, true);
eq('  และไม่คืนมุมมั่ว',              zBig.alpha, null);

/* ── 4. ทรงกลมกลิ้ง ───────────────────────────────────────────────────── */

eq('รัศมีทรงกลมกลิ้ง I',   LP.SPHERE_RADIUS_M.I, 20);
eq('รัศมีทรงกลมกลิ้ง II',  LP.SPHERE_RADIUS_M.II, 30);
eq('รัศมีทรงกลมกลิ้ง III', LP.SPHERE_RADIUS_M.III, 45);
eq('รัศมีทรงกลมกลิ้ง IV',  LP.SPHERE_RADIUS_M.IV, 60);

/* สูตร r = 10 x I^0.65 ต้องให้ค่าที่เอกสารพิมพ์ไว้ในแถว "คำนวณได้" */
near('r จากกระแส 3 kA',  LP.strikeDistance(3),  20.42, 0.01);
near('r จากกระแส 5 kA',  LP.strikeDistance(5),  28.46, 0.02);
near('r จากกระแส 10 kA', LP.strikeDistance(10), 44.67, 0.01);
near('r จากกระแส 16 kA', LP.strikeDistance(16), 60.63, 0.01);

eq('ความกว้างตาข่าย I',  LP.MESH_M.I, 5);
eq('ระยะห่างตัวนำลงดิน IV', LP.DOWN_CONDUCTOR_SPACING_M.IV, 20);

/* ── 5. ระยะทางบนผัง ─────────────────────────────────────────────────── */

/* สี่เหลี่ยมราว 100 x 100 ม. ที่เส้นศูนย์สูตรจำลอง */
const ring = [
    { lat: 13.7000, lng: 100.5000 }, { lat: 13.7000, lng: 100.5010 },
    { lat: 13.7009, lng: 100.5010 }, { lat: 13.7009, lng: 100.5000 }
];
eq('เสาอยู่ในพื้นที่แผง ระยะเป็นศูนย์',
   LP.nearestArrayDistanceM({ lat: 13.7004, lng: 100.5005 }, [ring]), 0);

const outside = LP.nearestArrayDistanceM({ lat: 13.7000, lng: 100.4990 }, [ring]);
near('เสาอยู่นอกพื้นที่ ห่างราว 108 ม.', outside, 108, 6);

eq('ไม่มีผืนหลังคา ต้องคืน null', LP.nearestArrayDistanceM({ lat: 13.7, lng: 100.5 }, []), null);

/* ── 6. การตัดสินรวม ─────────────────────────────────────────────────── */

const okCase = LP.assess({ lpl: 'III', material: 'solid', downConductors: 3, length: 17, actualClearance: 2 });
eq('ระยะจริง 2 ม. มากกว่า s 0.6 ม. ต้องผ่าน', okCase.verdict, 'ok');

const noCase = LP.assess({ lpl: 'I', material: 'air', downConductors: 1, length: 20, actualClearance: 0.5 });
eq('ระยะจริง 0.5 ม. น้อยกว่า s ต้องไม่ผ่าน', noCase.verdict, 'not_ok');
near('  s ของเคสนี้',                        noCase.need.s, 1.6, 0.001);

eq('ไม่รู้ระยะจริง ต้องคืน null ไม่ใช่เดา',
   LP.assess({ lpl: 'III', material: 'solid', downConductors: 3, length: 17 }).verdict, null);

/* ── 7. กฎในตัวตรวจแบบ ───────────────────────────────────────────────── */

const db2 = lps => ({
    base_layout_db1: {
        step1_initialization: { projectName: 'ทดสอบ' },
        step2_equipment: { pv: {}, inv1: { Model_Name: 'SH10RT', qty: 1 }, inv2: {}, opt: {}, bat: {}, industrial_settings: {} },
        step3_design_and_layout: { roofPolygons: [], lightning_protection: lps },
        step4_validation_results: { engineering_and_bom: { protection: { dc_spd_class: 'I', ac_spd_class: 'I', bonding_sqmm: 16, signage_sets: 5 } } }
    },
    simulation_params_db2: {}
});
const find = (lps, id) => {
    const r = G.AscAdvisor.analyze(db2(lps));
    return r.findings.find(f => f.id === id) || null;
};
const BASE = { external: 'yes', lpl: 'III', separation_material: 'solid',
               down_conductor_count: 3, conductor_length_m: 17 };
const rod = gap => [{ lat: 13.7, lng: 100.5, data: { height_m: 2 },
                      result: { gap: gap, zone: { alpha: 74, radius: 6.97, h: 2, outOfRange: false } } }];

eq('ไม่มีล่อฟ้า ไม่ต้องตรวจระยะแยก',
   find({ external: 'none' }, 'lps-separation'), null);

eq('ข้อมูลคำนวณไม่ครบ ต้องเป็นข้อสังเกต',
   (find({ external: 'yes' }, 'lps-separation') || {}).level, 'info');

eq('คำนวณได้แต่ยังไม่ปักเสา ต้องเป็นข้อสังเกต',
   (find(BASE, 'lps-separation') || {}).level, 'info');

eq('ระยะจริง 2 ม. เกิน s ต้องผ่าน',
   (find(Object.assign({}, BASE, { separation: 'ok', air_terminals: rod(2) }), 'lps-separation') || {}).level, 'ok');

eq('ระยะจริง 0.3 ม. น้อยกว่า s ต้องเตือน',
   (find(Object.assign({}, BASE, { separation: 'not_ok', air_terminals: rod(0.3) }), 'lps-separation') || {}).level, 'warn');

/* ข้อที่สำคัญที่สุดของกฎนี้ ตอบขัดกับผลคำนวณ */
const clash = find(Object.assign({}, BASE, { separation: 'ok', air_terminals: rod(0.3) }), 'lps-separation');
eq('ตอบว่ารักษาได้ทั้งที่ผังบอกว่าไม่ได้ ต้องเป็น error', (clash || {}).level, 'error');
eq('  และบอกว่ากระทบการเลือก SPD',
   /ตารางที่ 3.2/.test((clash || {}).detail || ''), true);

/* ที่มาต้องติดไปกับผลตรวจทุกครั้ง ห้ามอ้างสั้น ๆ ว่า ตาม วสท. */
eq('ผลตรวจต้องระบุที่มาของสูตร',
   /ลือชัย ทองนิล/.test((find(Object.assign({}, BASE, { separation: 'ok', air_terminals: rod(2) }), 'lps-separation') || {}).evidence || ''), true);

/* กฎเขตป้องกัน */
const tall = [{ lat: 13.7, lng: 100.5, data: { height_m: 25 },
                result: { gap: 5, zone: { outOfRange: true, h: 25, alpha: null, radius: null } } }];
eq('เสาสูงเกินช่วงตาราง ต้องเตือน',
   (find(Object.assign({}, BASE, { air_terminals: tall }), 'lps-zone') || {}).level, 'warn');
eq('เสาปกติ รายงานเขตป้องกันเป็นข้อสังเกต',
   (find(Object.assign({}, BASE, { air_terminals: rod(2) }), 'lps-zone') || {}).level, 'info');
eq('ไม่มีเสา ต้องเงียบ',
   find(BASE, 'lps-zone'), null);

/* ── 8. ของเดิมต้องไม่พัง ────────────────────────────────────────────── */

let crashed = false;
try { G.AscAdvisor.analyze(db2(undefined)); } catch (e) { crashed = true; }
eq('ไฟล์เก่าที่ไม่มีก้อนระบบล่อฟ้า ต้องไม่พัง', crashed, false);

eq('บทความ eit-lps ยังมีอยู่', !!G.AscKB.get('eit-lps'), true);

/* ── สรุป ──────────────────────────────────────────────────────────── */

console.log('\nผ่าน ' + pass + ' ข้อ · ตก ' + fail + ' ข้อ');
if (fail) {
    console.log('\nข้อที่ตก');
    bad.forEach(b => console.log('  ' + b));
    process.exit(1);
}
console.log('ผ่านทั้งหมด');
