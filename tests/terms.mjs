// tests/terms.mjs — แท็บ คำศัพท์ ASCS (4.8.0): ฟังก์ชันล้วนใน docs/asc-terms.js + เมธอดคำศัพท์ใน docs/asc-cloud.js
//   node tests/terms.mjs
//   asc-terms.js: CSV ไป-กลับ · ค่าที่แสดงจริง · แถวที่ต้องเก็บ · แผนนำเข้า · กรอง
//   asc-cloud.js: แบ่งชุด 500 ตอนบันทึก/ลบ · แบ่งหน้า 1,000 ตอนอ่าน · บันทึกไม่ได้ = แจ้งไม่มีสิทธิ์
//   + ตรวจข้อความใน supabase/ascs-terms.sql ที่ความปลอดภัยพึ่งพา
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log('✓', name); };

/* ── asc-terms.js ── */
const tw = { console };
tw.window = tw;
vm.runInNewContext(readFileSync(new URL('../docs/asc-terms.js', import.meta.url), 'utf8'), tw);
const T = tw.AscTerms;
const DEF = {
  'mn.about': ['เกี่ยวกับ', 'ກ່ຽວກັບ', 'About'],
  'mn.file': ['ไฟล์', 'ໄຟລ໌', 'File'],
  'rp.title': ['รายงาน', 'ລາຍງານ', 'Report'],
};

await t('CSV ไป-กลับ: คอมมา · เครื่องหมายคำพูด · ขึ้นบรรทัด · BOM · ภาษาลาว', () => {
  const rows = [['key', 'th', 'lo'], ['a.b', 'มี "คำพูด", คอมมา\nขึ้นบรรทัด', 'ລາວ'], ['c', '', 'x']];
  const csv = T.csvStringify(rows);
  assert.ok(csv.startsWith('﻿'));
  assert.deepEqual(JSON.parse(JSON.stringify(T.csvParse(csv))), rows);
  assert.deepEqual(JSON.parse(JSON.stringify(T.csvParse('a,b\r\n1,2'))), [['a', 'b'], ['1', '2']]);
});

await t('ค่าที่แสดงจริง: ช่องว่าง/ช่องว่างล้วน = ค่าเริ่ม', () => {
  assert.deepEqual([...T.effective(DEF['mn.about'], { th: '', lo: '  ', en: 'About ASC' })], ['เกี่ยวกับ', 'ກ່ຽວກັບ', 'About ASC']);
  assert.deepEqual([...T.effective(DEF['mn.about'], null)], DEF['mn.about']);
});

await t('แถวที่ต้องเก็บ: เฉพาะช่องที่ต่าง · เท่าค่าเริ่ม = null (ลบแถว)', () => {
  assert.deepEqual({ ...T.overrideFor(DEF['mn.file'], ['ไฟล์', 'ໄຟລ໌', 'Files']) }, { th: '', lo: '', en: 'Files' });
  assert.equal(T.overrideFor(DEF['mn.file'], [...DEF['mn.file']]), null);
  assert.equal(T.overrideFor(undefined, ['x', 'y', 'z']), null);
  assert.equal(T.isEdited(DEF['mn.file'], { th: '', lo: '', en: 'Files' }), true);
  assert.equal(T.isEdited(DEF['mn.file'], { th: 'ไฟล์', lo: '', en: '' }), false);
});

await t('หมวด = ส่วนแรกของคีย์ · นับเรียงมากไปน้อย', () => {
  assert.equal(T.prefixOf('sto.applied'), 'sto');
  assert.deepEqual({ ...T.groupCounts(Object.keys(DEF)) }, { mn: 2, rp: 1 });
});

await t('แผนนำเข้า: บันทึก · คืนค่าเดิม · คีย์ไม่รู้จัก · ไม่เปลี่ยน · คีย์ซ้ำนับครั้งเดียว', () => {
  const ovrs = { 'mn.about': { th: '', lo: '', en: 'About ASC' } };
  const rows = [['key', 'th', 'lo', 'en'],
    ['mn.file', 'แฟ้ม', '', ''],                 // ใหม่
    ['mn.about', '', '', ''],                    // กลับเป็นค่าเริ่ม → ลบ
    ['zz.none', 'x', '', ''],                    // ไม่รู้จัก
    ['rp.title', 'รายงาน', '', 'Report'],         // ไม่เปลี่ยน
    ['mn.file', 'ซ้ำ', '', '']];                  // คีย์ซ้ำ → ข้าม
  const p = T.planImport(rows, DEF, ovrs);
  assert.equal(p.error, '');
  assert.deepEqual(JSON.parse(JSON.stringify(p.upsert)), [{ key: 'mn.file', th: 'แฟ้ม', lo: '', en: '' }]);
  assert.deepEqual([...p.del], ['mn.about']);
  assert.deepEqual([...p.unknown], ['zz.none']);
  assert.equal(p.same, 1);
  assert.match(T.planImport([['th', 'lo']], DEF, {}).error, /key/);
});

await t('ส่งออก: หัวคอลัมน์ + ค่าที่แสดงจริง + ค่าเริ่ม + ป้ายแก้แล้ว', () => {
  const r = T.exportRows(['mn.about'], DEF, { 'mn.about': { th: '', lo: '', en: 'About ASC' } });
  assert.deepEqual([...r[0]], ['key', 'th', 'lo', 'en', 'default_th', 'default_lo', 'default_en', 'edited']);
  assert.deepEqual([...r[1]], ['mn.about', 'เกี่ยวกับ', 'ກ່ຽວກັບ', 'About ASC', 'เกี่ยวกับ', 'ກ່ຽວກັບ', 'About', 'yes']);
});

await t('แถวตาราง + กรอง: ค้นหาไทย/ลาว/คีย์ · หมวด · เฉพาะที่แก้ · คีย์ที่โปรแกรมไม่มีแล้ว', () => {
  const ovrs = { 'mn.file': { th: '', lo: '', en: 'Files' }, 'old.key': { th: 'เก่า', lo: '', en: '' } };
  const all = T.allRows(DEF, ovrs);
  assert.equal(all.length, 4);
  assert.equal(all[3].key, 'old.key'); assert.equal(all[3].stale, true);
  const keys = f => [...T.filterRows(all, DEF, ovrs, f).map(r => r.key)];
  assert.deepEqual(keys({ q: 'ລາຍງານ' }), ['rp.title']);
  assert.deepEqual(keys({ q: 'files' }), ['mn.file']);
  assert.deepEqual(keys({ q: 'MN.AB' }), ['mn.about']);
  assert.deepEqual(keys({ prefix: 'mn' }), ['mn.about', 'mn.file']);
  assert.deepEqual(keys({ editedOnly: true }), ['mn.file', 'old.key']);
  assert.deepEqual(keys({ prefix: '__stale' }), ['old.key']);
});

/* ── asc-cloud.js (supabase ปลอม) ── */
function loadCloud({ upsertRows = null, pageSizes = [] } = {}) {
  const calls = { upsert: [], del: [], range: [] };
  const exp = () => Math.floor(Date.now() / 1000) + 3600;
  const ok = (data) => Promise.resolve({ data, error: null });
  let page = 0;
  const from = () => ({
    upsert: (payload, opts) => { calls.upsert.push({ n: payload.length, opts, first: payload[0] }); return { select: () => ok(upsertRows ?? payload.map(p => ({ key: p.key }))) }; },
    delete: () => ({ in: (col, list) => { calls.del.push(list.length); return { select: () => ok(list.map(k => ({ key: k }))) }; } }),
    select: () => ({ order: () => ({ range: (a, b) => { calls.range.push([a, b]); const n = pageSizes[page++] ?? 0; return ok(Array.from({ length: n }, (_, i) => ({ key: 'k' + (a + i) }))); } }) }),
  });
  const client = {
    auth: {
      getSession: async () => ({ data: { session: { expires_at: exp() } } }),
      refreshSession: async () => ({ data: { session: { expires_at: exp() } }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from, rpc: (fn) => ok(fn === 'ascs_terms_stamp' ? { n: 3, updated_at: '2026-11-10T00:00:00Z' } : null),
  };
  const store = { getItem: () => null, setItem() {}, removeItem() {} };
  const win = {
    console: { info() {}, warn() {}, log() {} }, location: { pathname: '/asc/index.html' },
    SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'k',
    supabase: { createClient: () => client }, localStorage: store, sessionStorage: store,
    addEventListener() {}, document: { addEventListener() {}, visibilityState: 'visible' },
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {},
  };
  win.window = win;
  vm.runInNewContext(readFileSync(new URL('../docs/asc-cloud.js', import.meta.url), 'utf8'), win);
  return { C: win.AscCloud, calls };
}

await t('termsStamp อ่านจำนวน + เวลาแก้ล่าสุด', async () => {
  const { C } = loadCloud();
  assert.deepEqual({ ...(await C.termsStamp()) }, { n: 3, updatedAt: '2026-11-10T00:00:00Z' });
});

await t('upsertTerms แบ่งชุดละ 500 · onConflict key · ช่องว่างเป็น ""', async () => {
  const { C, calls } = loadCloud();
  const rows = Array.from({ length: 1201 }, (_, i) => ({ key: 'k' + i, en: 'E' + i }));
  assert.equal(await C.upsertTerms(rows), 1201);
  assert.deepEqual(calls.upsert.map(c => c.n), [500, 500, 201]);
  assert.equal(calls.upsert[0].opts.onConflict, 'key');
  assert.equal(calls.upsert[0].first.th, '');
  assert.equal(calls.upsert[0].first.en, 'E0');
});

await t('upsertTerms ไม่มีแถวกลับมา = ไม่มีสิทธิ์ (ไม่เงียบ)', async () => {
  const { C } = loadCloud({ upsertRows: [] });
  await assert.rejects(C.upsertTerms([{ key: 'a', th: 'x' }]), /เฉพาะผู้ดูแลระบบ/);
});

await t('deleteTerms แบ่งชุดละ 500', async () => {
  const { C, calls } = loadCloud();
  assert.equal(await C.deleteTerms(Array.from({ length: 501 }, (_, i) => 'k' + i)), 501);
  assert.deepEqual(calls.del, [500, 1]);
});

await t('listTerms แบ่งหน้า 1,000 จนหมด', async () => {
  const { C, calls } = loadCloud({ pageSizes: [1000, 3] });
  assert.equal((await C.listTerms()).length, 1003);
  assert.deepEqual(calls.range, [[0, 999], [1000, 1999]]);
});

/* ── SQL ── */
const sql = readFileSync(new URL('../supabase/ascs-terms.sql', import.meta.url), 'utf8');
await t('ascs-terms.sql: RLS เขียนเฉพาะแอดมิน · ตราประทับเฉพาะคนล็อกอิน · device_terms เฉพาะ anon ผ่าน device_user', () => {
  assert.match(sql, /enable row level security/);
  assert.match(sql, /for all to authenticated\s+using \(public\.is_admin\(\)\) with check \(public\.is_admin\(\)\)/);
  assert.match(sql, /revoke execute on function public\.ascs_terms_stamp\(\) from anon/);
  assert.match(sql, /public\.device_user\(p_machine_hash, p_secret\) is null then null/);
  assert.match(sql, /revoke all on function public\.device_terms\(text, text\) from public, authenticated/);
  assert.match(sql, /grant execute on function public\.device_terms\(text, text\) to anon/);
});

console.log(`\nผ่าน ${n} ข้อ`);
