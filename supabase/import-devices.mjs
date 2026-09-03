/* ============================================================================
 *  นำเข้าคลังสเปกอุปกรณ์จากไฟล์ดาต้าชีต .txt เข้าตาราง devices บน Supabase
 *  ----------------------------------------------------------------------------
 *  ใช้ตอนตั้งคลังครั้งแรก หรือตอนนำเข้าดาต้าชีตชุดใหญ่ทีเดียวหลายสิบไฟล์
 *  งานเพิ่มทีละไฟล์ในชีวิตประจำวัน ให้ผู้ดูแลระบบทำที่หน้า Settings ของ ASC แทน
 *
 *  สคริปต์นี้รันบนเครื่องคุณเท่านั้น ห้ามเอาขึ้นเว็บ เพราะต้องใช้คีย์ service_role
 *  ซึ่งข้ามระบบสิทธิ์ได้ทั้งหมด
 *
 *  การอ่านไฟล์ใช้ docs/asc-datasheet-parse.js ตัวเดียวกับที่เบราว์เซอร์ใช้
 *  จึงได้ผลเหมือนกันทุกฟิลด์ ไม่มีตัวแยกไฟล์สองชุดให้เพี้ยนออกจากกัน
 *
 *  วิธีใช้
 *      1. npm install @supabase/supabase-js      (รันในโฟลเดอร์ supabase ครั้งเดียว)
 *      2. ใส่คีย์ service_role ในไฟล์ supabase/.env  บรรทัด SUPABASE_SERVICE_KEY=
 *         (.env ถูก .gitignore ไว้แล้ว ไม่ขึ้น GitHub)
 *      3. รันจากรากของโปรเจกต์
 *
 *      node supabase/import-devices.mjs --dir "F:/.../Datasheet_Extract_2026-08-31" --dry-run
 *      node supabase/import-devices.mjs --dir "F:/.../Datasheet_Extract_2026-08-31"
 *      node supabase/import-devices.mjs --dir ... --only PV      # เฉพาะหมวดเดียว
 *      node supabase/import-devices.mjs --check                  # ดูว่าในคลังมีอะไรอยู่แล้ว
 *
 *  --dry-run อ่านและตรวจไฟล์ให้ครบ แสดงผลสรุป แต่ไม่เขียนอะไรขึ้นเซิร์ฟเวอร์
 *  และไม่ต้องมีคีย์ด้วย จึงใช้ตรวจคลังก่อนได้เสมอ
 * ========================================================================== */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';
import { createRequire } from 'node:module';

const HERE    = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const argAt = name => process.argv.indexOf(name);
const argOf = (name, dflt) => { const i = argAt(name); return i === -1 ? dflt : (process.argv[i + 1] || dflt); };

const DRYRUN = process.argv.includes('--dry-run');
const CHECK  = process.argv.includes('--check');
const ONLY   = (argOf('--only', '') || '').toUpperCase();   // PV | INV | ESS | OPT | EV
const DIR    = argOf('--dir', '');
const BATCH  = 40;   // ส่งทีละก้อน ไม่ใช่ 155 แถวรวดเดียว จะได้เห็นว่าพังตรงไหนถ้าพัง

/* ── ตัวแยกไฟล์ตัวเดียวกับที่เบราว์เซอร์ใช้ ────────────────────────────── */
const PARSER = join(HERE, '..', 'docs', 'asc-datasheet-parse.js');
if (!existsSync(PARSER)) {
    console.error('✗ ไม่พบ docs/asc-datasheet-parse.js ซึ่งเป็นตัวแยกไฟล์ที่ต้องใช้ร่วมกัน');
    process.exit(1);
}
const A = require(PARSER);

/* ── ค่าเชื่อมต่อ ──────────────────────────────────────────────────────────
   ลำดับการหา  1. ตัวแปรสภาพแวดล้อม  2. supabase/.env  3. URL จาก supabase-config.js */
const CR = String.fromCharCode(13), LF = String.fromCharCode(10);

function readEnvFile() {
    const out = {};
    for (const p of [join(HERE, '.env'), join(HERE, '..', '.env')]) {
        if (!existsSync(p)) continue;
        for (const raw of readFileSync(p, 'utf8').split(LF)) {
            const line = raw.split(CR).join('').trim();
            if (!line || line.startsWith('#')) continue;
            const at = line.indexOf('=');
            if (at < 1) continue;
            let v = line.slice(at + 1).trim();
            if (v.length > 1 && v[0] === v[v.length - 1] && (v[0] === '"' || v[0] === "'")) v = v.slice(1, -1);
            out[line.slice(0, at).trim()] = v;
        }
    }
    return out;
}
const FILE_ENV = readEnvFile();

/* supabase-config.js ย้ายไปอยู่ใน docs/ แล้ว แต่เผื่อไฟล์เก่าที่ราก จึงมองทั้งสองที่ */
function urlFromConfig() {
    for (const p of [join(HERE, '..', 'docs', 'supabase-config.js'), join(HERE, '..', 'supabase-config.js')]) {
        try {
            if (!existsSync(p)) continue;
            const cfg = readFileSync(p, 'utf8');
            const at  = cfg.lastIndexOf('SUPABASE_URL');
            if (at === -1) continue;
            const tail = cfg.slice(at);
            const a = tail.indexOf("'");
            const b = a === -1 ? -1 : tail.indexOf("'", a + 1);
            const val = a === -1 || b === -1 ? '' : tail.slice(a + 1, b);
            if (val.startsWith('http')) return val;
        } catch { /* ลองที่ถัดไป */ }
    }
    return null;
}

const URL_ = process.env.SUPABASE_URL || FILE_ENV.SUPABASE_URL || urlFromConfig();
const KEY  = process.env.SUPABASE_SERVICE_KEY || FILE_ENV.SUPABASE_SERVICE_KEY;

/* ── รวบรวมไฟล์ ───────────────────────────────────────────────────────── */
function collect(dir) {
    const out = [];
    const walk = (d) => {
        for (const name of readdirSync(d)) {
            const p = join(d, name);
            if (statSync(p).isDirectory()) walk(p);
            else if (/\.txt$/i.test(name)) out.push(p);
        }
    };
    walk(dir);
    return out.sort();
}

/* ── เริ่มทำงาน ───────────────────────────────────────────────────────── */

if (CHECK) {
    if (!URL_ || !KEY) { console.error('✗ --check ต้องใช้คีย์ ใส่ SUPABASE_SERVICE_KEY ใน supabase/.env ก่อน'); process.exit(1); }
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(URL_, KEY, { auth: { persistSession: false } });
    const { data, error } = await sb.from('devices').select('category, brand, model, subtype, updated_at');
    if (error) { console.error('✗ อ่านคลังไม่สำเร็จ :', error.message); process.exit(1); }
    const byCat = {};
    (data || []).forEach(r => { byCat[r.category] = (byCat[r.category] || 0) + 1; });
    console.log('ในคลังตอนนี้มี ' + (data || []).length + ' รายการ');
    Object.keys(byCat).sort().forEach(c => console.log('   ' + c.padEnd(4) + ' ' + byCat[c]));
    process.exit(0);
}

if (!DIR) {
    console.error('✗ ต้องระบุโฟลเดอร์ดาต้าชีตด้วย --dir');
    console.error('  ตัวอย่าง  node supabase/import-devices.mjs --dir "F:/.../Datasheet_Extract_2026-08-31" --dry-run');
    process.exit(1);
}
if (!existsSync(DIR)) { console.error('✗ ไม่พบโฟลเดอร์ : ' + DIR); process.exit(1); }

const files = collect(DIR);
if (!files.length) { console.error('✗ ไม่พบไฟล์ .txt ในโฟลเดอร์นี้'); process.exit(1); }

console.log('อ่านไฟล์จาก ' + DIR);
console.log('พบไฟล์ .txt ' + files.length + ' ไฟล์' + (ONLY ? ' (กรองเฉพาะหมวด ' + ONLY + ')' : ''));
console.log('');

const rows = [], skipped = [], flagged = [];
const seen = new Map();

for (const f of files) {
    let row;
    try { row = A.toDeviceRow(readFileSync(f, 'utf8'), f); }
    catch (e) { skipped.push({ f: basename(f), why: 'อ่านไฟล์ไม่สำเร็จ : ' + e.message }); continue; }

    if (!row.category)          { skipped.push({ f: basename(f), why: 'ไม่รู้ว่าเป็นอุปกรณ์หมวดไหน' }); continue; }
    if (ONLY && row.category !== ONLY) continue;
    if (!row.brand || !row.model) { skipped.push({ f: basename(f), why: 'ไม่มียี่ห้อหรือรุ่นในไฟล์และเดาจากชื่อไฟล์ไม่ได้' }); continue; }

    /* คีย์ซ้ำ = สองไฟล์อ้างรุ่นเดียวกัน ถ้าปล่อยไป upsert จะทับกันเองเงียบ ๆ
       แล้วคลังจะได้ไฟล์ไหนก็ไม่รู้ ต้องให้คนตัดสินใจ ไม่ใช่ให้ลำดับตัวอักษรตัดสิน */
    const key = [row.category, row.brand, row.model, row.subtype].join('|');
    if (seen.has(key)) { skipped.push({ f: basename(f), why: 'คีย์ซ้ำกับ ' + seen.get(key) }); continue; }
    seen.set(key, basename(f));

    /* ฟิลด์บังคับที่ยังไม่มีค่า ไม่บล็อกการนำเข้า เพราะบางดาต้าชีตระบุไม่ได้จริง
       เช่นตระกูล Sigenergy TP ที่ตารางจำนวน MPPT เป็นเซลล์ควบรวม
       แต่ต้องรายงานให้เห็น และหน้าออกแบบจะเตือนซ้ำอีกครั้งตอนเลือกรุ่นนั้น */
    const miss = A.missingRequired(row.category, row.spec);
    if (miss.length) flagged.push({ f: basename(f), miss });

    rows.push(row);
}

/* ── สรุปก่อนเขียน ────────────────────────────────────────────────────── */
const byCat = {};
rows.forEach(r => { byCat[r.category] = (byCat[r.category] || 0) + 1; });
console.log('พร้อมนำเข้า ' + rows.length + ' รายการ');
Object.keys(byCat).sort().forEach(c => console.log('   ' + c.padEnd(4) + ' ' + byCat[c]));

if (flagged.length) {
    console.log('');
    console.log('⚠ ฟิลด์บังคับยังไม่มีค่า ' + flagged.length + ' รายการ (นำเข้าได้ แต่หน้าออกแบบจะเตือนตอนเลือก)');
    flagged.slice(0, 10).forEach(x => console.log('   ' + x.f + '  ขาด: ' + x.miss.join(', ')));
    if (flagged.length > 10) console.log('   ... และอีก ' + (flagged.length - 10) + ' รายการ');
}
if (skipped.length) {
    console.log('');
    console.log('✗ ข้ามไป ' + skipped.length + ' ไฟล์');
    skipped.forEach(x => console.log('   ' + x.f + '  — ' + x.why));
}

const bytes = rows.reduce((s, r) => s + JSON.stringify(r.spec).length, 0);
console.log('');
console.log('ขนาดข้อมูลรวม ' + (bytes / 1048576).toFixed(2) + ' MB');

if (DRYRUN) {
    console.log('');
    console.log('— โหมด --dry-run ไม่ได้เขียนอะไรขึ้นเซิร์ฟเวอร์ —');
    process.exit(0);
}

if (!URL_ || !KEY) {
    console.error('');
    console.error('✗ ยังไม่มีคีย์ service_role');
    console.error('  สร้างไฟล์ supabase/.env แล้วใส่บรรทัด  SUPABASE_SERVICE_KEY=คีย์ของคุณ');
    console.error('  หาคีย์ได้ที่ Supabase Dashboard > Project Settings > API > service_role');
    if (URL_) console.error('  (SUPABASE_URL อ่านได้เองแล้ว : ' + URL_ + ')');
    process.exit(1);
}
if (KEY.length < 40) { console.error('✗ คีย์ที่ใส่มาสั้นผิดปกติ ตรวจว่าคัดลอกครบหรือยัง'); process.exit(1); }

const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(URL_, KEY, { auth: { persistSession: false } });

console.log('');
console.log('กำลังเขียนขึ้น ' + URL_);

let done = 0;
for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH).map(r => ({
        category   : r.category,
        brand      : r.brand,
        model      : r.model,
        subtype    : r.subtype,
        spec       : r.spec,
        source_file: r.sourceFile,
        updated_at : new Date().toISOString()
    }));
    const { error } = await sb.from('devices')
        .upsert(chunk, { onConflict: 'category,brand,model,subtype' });
    if (error) {
        console.error('✗ ก้อนที่เริ่มรายการ ' + (i + 1) + ' ล้มเหลว : ' + error.message);
        console.error('  รายการก่อนหน้าที่เขียนไปแล้ว ' + done + ' รายการยังอยู่ รันซ้ำได้ เพราะเป็น upsert');
        process.exit(1);
    }
    done += chunk.length;
    console.log('   เขียนแล้ว ' + done + ' / ' + rows.length);
}

console.log('');
console.log('✓ นำเข้าเสร็จ ' + done + ' รายการ');
console.log('  ผู้ใช้ที่เปิดหน้าออกแบบอยู่ ให้กดรีเฟรชคลังในหน้า Settings หรือเปิดหน้าใหม่');
