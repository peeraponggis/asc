// tests/session-retry.mjs — เซสชันหมดอายุระหว่างเปิดหน้าค้าง (asc-cloud.js withSession · 4.4.4)
//   node tests/session-retry.mjs
//   โหลด asc-cloud.js ใน vm พร้อม supabase ปลอม: ครั้งแรกถูก RLS ปฏิเสธ → ต่ออายุ → ลองซ้ำสำเร็จ
//   ต่ออายุไม่ได้ = ข้อความ "หมดเวลาเข้าสู่ระบบ" ไม่ใช่ "ไม่มีสิทธิ์"
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = readFileSync(new URL('../docs/asc-cloud.js', import.meta.url), 'utf8');
const RLS = { message: 'new row violates row-level security policy for table "user_menus"', code: '42501' };

function load({ session = true, refreshOk = true, results = [] } = {}) {
  const calls = { refresh: 0, run: 0 };
  const exp = () => Math.floor(Date.now() / 1000) + 3600;
  const q = () => {
    const r = results[Math.min(calls.run, results.length - 1)] ?? { data: null, error: null };
    calls.run++;
    return Promise.resolve(r);
  };
  const chain = { upsert: q, delete: () => ({ eq: () => ({ select: q }) }), select: q };
  const client = {
    auth: {
      getSession: async () => ({ data: { session: session ? { expires_at: exp() } : null } }),
      refreshSession: async () => { calls.refresh++; return refreshOk ? { data: { session: { expires_at: exp() } }, error: null } : { data: { session: null }, error: { message: 'Invalid Refresh Token' } }; },
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from: () => chain,
    rpc: q,
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
  vm.runInNewContext(src, win);
  return { C: win.AscCloud, calls };
}

let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log('✓', name); };

await t('ถูก RLS ปฏิเสธครั้งแรก → ต่ออายุ → ลองซ้ำสำเร็จ', async () => {
  const { C, calls } = load({ results: [{ data: null, error: RLS }, { data: null, error: null }] });
  assert.equal(await C.setUserMenus('u1', ['pi_system']), true);
  assert.equal(calls.refresh, 1);
  assert.equal(calls.run, 2);
});

await t('ต่ออายุไม่ได้ → บอกให้เข้าระบบใหม่ (ไม่ใช่ "ไม่มีสิทธิ์")', async () => {
  const { C } = load({ refreshOk: false, results: [{ data: null, error: RLS }] });
  await assert.rejects(C.setUserMenus('u1', []), /หมดเวลาเข้าสู่ระบบ/);
});

await t('ไม่มีเซสชันเลย → บอกให้เข้าระบบใหม่ ไม่ยิงคำขอ', async () => {
  const { C, calls } = load({ session: false });
  await assert.rejects(C.setUserAdmin('u1', true), /หมดเวลาเข้าสู่ระบบ/);
  assert.equal(calls.run, 0);
});

await t('ต่ออายุแล้วยังถูกปฏิเสธ = ไม่มีสิทธิ์จริง (ข้อความแนะนำเข้าใหม่)', async () => {
  const { C } = load({ results: [{ data: null, error: RLS }, { data: null, error: RLS }] });
  await assert.rejects(C.setUserMenus('u1', []), /ไม่มีสิทธิ์ทำรายการนี้/);
});

await t('ถอดรายชื่อ: ลบได้ 0 แถว → ต่ออายุแล้วลองซ้ำ', async () => {
  const { C, calls } = load({ results: [{ data: [], error: null }, { data: [{ email: 'a@b.co' }], error: null }] });
  assert.equal(await C.removeAllowedEmail('a@b.co'), true);
  assert.equal(calls.refresh, 1);
});

await t('สำเร็จตั้งแต่ครั้งแรก = ไม่ต่ออายุซ้ำ', async () => {
  const { C, calls } = load({ results: [{ data: null, error: null }] });
  assert.equal(await C.addAllowedEmail('New@Example.com', ''), 'new@example.com');
  assert.equal(calls.refresh, 0);
});

console.log(`\nผ่าน ${n} ข้อ`);
