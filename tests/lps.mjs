/* ============================================================================
 *  ชุดทดสอบระบบป้องกันฟ้าผ่า (วสท. 022013-25 ข้อ 3.6 และภาคผนวก จ)
 *
 *  รัน   node tests/lps.mjs
 *
 *  ทำไมต้องมีไฟล์นี้
 *  ----------------------------------------------------------------------
 *  ก่อนงานนี้ โปรแกรมใส่ SPD Type 2 ตายตัวทุกงาน ซึ่ง **ผิดในสองในสามเคส**
 *  ของตารางที่ 3.2 หน้า 33 และไม่มีใครจับได้ เพราะไม่มีข้อมูลระบบล่อฟ้าให้ตรวจ
 *
 *  ตารางที่ 3.2 เป็นตารางเปิดล้วน ๆ ถ้าลอกผิดช่องเดียวจะสั่งของผิดทั้งงาน
 *  โดยที่ทุกอย่างยังดูปกติ จึงต้องมีเทสต์ยึดค่าทั้งหกช่องไว้
 *
 *  เกณฑ์ผ่าน
 *  ----------------------------------------------------------------------
 *  · ทั้งหกช่องของตารางที่ 3.2 ต้องตรงกับเล่มทุกช่อง
 *  · ข้อมูลไม่พอต้องเตือน **ห้ามเดาเป็น class II** เพราะเป็นคำตอบที่ผิดบ่อยกว่าถูก
 *  · ไฟล์ DB2 รุ่นเก่าที่ไม่มีก้อน lightning_protection ต้องไม่พัง
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

function boot() {
    const g = {};
    g.window = g; g.globalThis = g; g.console = console;
    const run = code => new Function('global', 'window', 'globalThis', 'console', code)(g, g, g, console);
    run(src('asc-eit.js'));
    run(src('asc-kb.js'));
    run(src('asc-advisor.js'));
    return g;
}
const G = boot();
const E = G.AscEIT;

/* ── 1. ตารางที่ 3.2 หน้า 33 · ทั้งหกช่อง ────────────────────────────── */

const row = (ext, sep) => E.spdClassFor({ external: ext, separation: sep });

eq('ไม่มีล่อฟ้า · ฝั่งไฟสลับ',        row('none', 'unknown').ac, 'II');
eq('ไม่มีล่อฟ้า · ฝั่งไฟตรง',         row('none', 'unknown').dc, 'II');
eq('มีล่อฟ้า รักษา S ได้ · ฝั่งไฟสลับ',  row('yes', 'ok').ac, 'I');
eq('มีล่อฟ้า รักษา S ได้ · ฝั่งไฟตรง',   row('yes', 'ok').dc, 'II');
eq('มีล่อฟ้า รักษา S ไม่ได้ · ฝั่งไฟสลับ', row('yes', 'not_ok').ac, 'I');
eq('มีล่อฟ้า รักษา S ไม่ได้ · ฝั่งไฟตรง',  row('yes', 'not_ok').dc, 'I');

/* ข้อมูลไม่พอต้องคืน null ไม่ใช่เดาเป็น class II
   นี่คือข้อบกพร่องเดิมที่งานรอบนี้มาปิด ถ้าเทสต์ข้อนี้ตกแปลว่าถอยกลับไปที่เดิม */
eq('ยังไม่ระบุว่ามีล่อฟ้าไหม ต้องคืน null',   row('unknown', 'unknown'), null);
eq('มีล่อฟ้าแต่ยังไม่ประเมิน S ต้องคืน null', row('yes', 'unknown'), null);
eq('ก้อนข้อมูลว่างเปล่า ต้องคืน null',       E.spdClassFor({}), null);
eq('ไม่ส่งอะไรมาเลย ต้องคืน null',          E.spdClassFor(), null);

/* ── 2. ขนาดสายต่อประสานศักย์ · รูปที่ จ.3 และ จ.4 ──────────────────── */

eq('หลังคาไม่มีล่อฟ้า สายต่อประสาน 4 ตร.มม.',  E.bondingSqmmFor({ external: 'none' }), 4);
eq('หลังคามีล่อฟ้า สายต่อประสาน 16 ตร.มม.',    E.bondingSqmmFor({ external: 'yes' }), 16);
eq('ยังไม่ระบุ ต้องคืน null',                 E.bondingSqmmFor({ external: 'unknown' }), null);

/* ── 3. ค่าจากภาคผนวก จ.2 หน้า 120 ──────────────────────────────────── */

eq('ตัวนำลงดินขั้นต่ำ 50 ตร.มม.',   E.LPS_DOWN_CONDUCTOR_MIN_SQMM, 50);
eq('ความต้านทานดินสูงสุด 10 โอห์ม', E.LPS_EARTH_RESISTANCE_MAX_OHM, 10);

/* ── 4. กฎในตัวตรวจแบบ ───────────────────────────────────────────────── */

const INV = { Manufacturer: 'Sungrow', Model_Name: 'SH10RT', Inverter_Type: 'Hybrid',
              Rated_AC_Output_Power_kW: 10, qty: 1 };

/* DB2 ต้องห่อด้วย base_layout_db1 ตามรูปไฟล์จริง ไม่งั้น normalize() คืนก้อนว่าง
   แล้วทุกกฎจะเงียบหมดโดยไม่ฟ้องอะไร (บทเรียนจากชุดทดสอบแบตเตอรี่) */
const db2 = (lps, protection) => ({
    base_layout_db1: {
        step1_initialization: { projectName: 'ทดสอบ', coordinates: '13.7,100.5' },
        step2_equipment: { pv: {}, inv1: INV, inv2: {}, opt: {}, bat: {}, industrial_settings: {} },
        step3_design_and_layout: { roofPolygons: [], lightning_protection: lps },
        step4_validation_results: {
            engineering_and_bom: { protection: Object.assign({ signage_sets: 5 }, protection) }
        }
    },
    simulation_params_db2: {}
});

const find = (lps, protection, id) => {
    const r = G.AscAdvisor.analyze(db2(lps, protection));
    return r.findings.find(f => f.id === id) || null;
};

/* 4.1 กฎ spd — ตัดสินจากตารางได้จริงแล้ว ไม่ใช่ "ต้องยืนยันเอง" เหมือนเดิม */

const okCase = { external: 'yes', separation: 'not_ok' };
eq('SPD ตรงตามตาราง ต้องผ่าน',
   (find(okCase, { dc_spd_class: 'I', ac_spd_class: 'I', bonding_sqmm: 16 }, 'spd') || {}).level, 'ok');

eq('SPD ฝั่งไฟตรงผิด class ต้องเป็น error',
   (find(okCase, { dc_spd_class: 'II', ac_spd_class: 'I', bonding_sqmm: 16 }, 'spd') || {}).level, 'error');

eq('  และต้องบอกด้วยว่าควรเป็น class อะไร',
   /ฝั่งไฟตรงควรเป็น class I/.test(
       ((find(okCase, { dc_spd_class: 'II', ac_spd_class: 'I', bonding_sqmm: 16 }, 'spd') || {}).fix || []).join(' ')), true);

eq('ยังไม่ระบุระบบล่อฟ้า ต้องเตือน ไม่ใช่ผ่าน',
   (find({ external: 'unknown', separation: 'unknown' },
         { dc_spd_class: 'II', ac_spd_class: 'II' }, 'spd') || {}).level, 'warn');

/* เคสที่เคยเป็นค่าเริ่มต้นของโปรแกรมเดิม คือไม่มีล่อฟ้า + Type 2 ทั้งคู่ ต้องผ่าน */
eq('ไม่มีล่อฟ้า + class II ทั้งสองฝั่ง ต้องผ่าน',
   (find({ external: 'none', separation: 'unknown' },
         { dc_spd_class: 'II', ac_spd_class: 'II', bonding_sqmm: 4 }, 'spd') || {}).level, 'ok');

/* 4.2 กฎ lps-bonding */

eq('ยังไม่ระบุระบบล่อฟ้า ต้องเตือน',
   (find({ external: 'unknown' }, {}, 'lps-bonding') || {}).level, 'warn');

eq('ไม่มีล่อฟ้า ต้องผ่าน',
   (find({ external: 'none' }, { bonding_sqmm: 4 }, 'lps-bonding') || {}).level, 'ok');

eq('มีล่อฟ้าแต่ยังไม่ประเมิน S ต้องเตือน',
   (find({ external: 'yes', separation: 'unknown' }, { bonding_sqmm: 16 }, 'lps-bonding') || {}).level, 'warn');

eq('รักษา S ได้ ต้องผ่าน',
   (find({ external: 'yes', separation: 'ok' }, { bonding_sqmm: 16 }, 'lps-bonding') || {}).level, 'ok');

const notOk = find({ external: 'yes', separation: 'not_ok' }, { bonding_sqmm: 16 }, 'lps-bonding');
eq('รักษา S ไม่ได้ ต้องเตือนให้ต่อตัวนำโดยตรง', (notOk || {}).level, 'warn');
eq('  และต้องย้ำว่าไม่ใช่แทนกัน',
   /ไม่ใช่แทนกัน/.test(((notOk || {}).fix || []).join(' ')), true);

eq('สายต่อประสานเล็กกว่าเกณฑ์ ต้องเตือน',
   (find({ external: 'yes', separation: 'not_ok' }, { bonding_sqmm: 4 }, 'lps-bonding') || {}).level, 'warn');

/* 4.3 กฎ lps-earth */

eq('ไม่มีล่อฟ้า ไม่ต้องตรวจรากสายดินเลย',
   find({ external: 'none' }, {}, 'lps-earth'), null);

eq('มีล่อฟ้าแต่ยังไม่กรอกผลวัด ต้องเป็นข้อสังเกต',
   (find({ external: 'yes', separation: 'ok' }, {}, 'lps-earth') || {}).level, 'info');

eq('ตัวนำลงดิน 35 ตร.มม. ต่ำกว่าเกณฑ์ ต้องเตือน',
   (find({ external: 'yes', separation: 'ok', down_conductor_sqmm: 35 }, {}, 'lps-earth') || {}).level, 'warn');

eq('ความต้านทานดิน 25 โอห์ม เกินเกณฑ์ ต้องเตือน',
   (find({ external: 'yes', separation: 'ok', earth_resistance_ohm: 25 }, {}, 'lps-earth') || {}).level, 'warn');

eq('ตัวนำ 50 และดิน 8 โอห์ม ต้องผ่าน',
   (find({ external: 'yes', separation: 'ok', down_conductor_sqmm: 50, earth_resistance_ohm: 8 }, {}, 'lps-earth') || {}).level, 'ok');

/* ── 5. ไฟล์ DB2 รุ่นเก่าต้องไม่พัง ──────────────────────────────────── */

let crashed = false, old = null;
try { old = G.AscAdvisor.analyze(db2(undefined, { dc_spd_class: 'II', ac_spd_class: 'II' })); }
catch (e) { crashed = true; }
eq('ไฟล์เก่าที่ไม่มีก้อนระบบล่อฟ้า ต้องไม่พัง', crashed, false);
eq('  และต้องเตือน ไม่ใช่ประทับตราว่าผ่าน',
   (old.findings.find(f => f.id === 'lps-bonding') || {}).level, 'warn');
eq('  กฎ lps-earth ต้องเงียบ เพราะไม่รู้ว่ามีล่อฟ้าไหม',
   old.findings.find(f => f.id === 'lps-earth'), undefined);

/* ── 6. บทความฐานความรู้ ─────────────────────────────────────────────── */

eq('บทความ eit-lps มีอยู่จริง', !!G.AscKB.get('eit-lps'), true);
eq('บทความเดิม eit-spd ยังอยู่', !!G.AscKB.get('eit-spd'), true);
eq('บทความ eit-lps บอกว่าสูตร S ไม่ได้อยู่ในเล่ม 022013-25',
   /ไม่ได้อยู่ในเล่ม 022013-25/.test(G.AscKB.get('eit-lps').body), true);
eq('  และบอกว่าตอนนี้โปรแกรมคำนวณให้ได้แล้ว',
   /โปรแกรมคำนวณ S ให้แล้ว/.test(G.AscKB.get('eit-lps').body), true);
eq('  และย้ำว่า LPL ต้องให้วิศวกรเลือกเอง',
   /โปรแกรมเลือกให้ไม่ได้/.test(G.AscKB.get('eit-lps').body), true);
/* ที่มาต้องระบุว่ายังไม่ได้ตรวจกับตัวเล่ม ไม่ใช่อ้างสั้น ๆ ว่า ตาม วสท. */
eq('  ที่มาระบุว่ายังไม่ได้ตรวจกับตัวเล่ม',
   G.AscKB.get('eit-lps').refs.some(r => /ยังไม่ได้ตรวจกับตัวเล่ม/.test(r)), true);

/* ทุกกฎที่อ้างบทความ ต้องอ้างบทความที่มีอยู่จริง */
const missingKb = G.AscAdvisor._rules
    .map(r => r.id)
    .filter(id => ['spd', 'lps-bonding', 'lps-earth'].includes(id))
    .map(id => {
        const f = find({ external: 'yes', separation: 'not_ok', down_conductor_sqmm: 35 },
                       { dc_spd_class: 'I', ac_spd_class: 'I', bonding_sqmm: 16 }, id);
        return (f && f.kb && !G.AscKB.get(f.kb)) ? id + ' -> ' + f.kb : null;
    }).filter(Boolean);
eq('ไม่มีกฎไหนอ้างบทความที่ไม่มีอยู่', missingKb.join(','), '');

/* ── สรุป ──────────────────────────────────────────────────────────── */

console.log('\nผ่าน ' + pass + ' ข้อ · ตก ' + fail + ' ข้อ');
if (fail) {
    console.log('\nข้อที่ตก');
    bad.forEach(b => console.log('  ' + b));
    process.exit(1);
}
console.log('ผ่านทั้งหมด');
