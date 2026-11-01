// tests/presence.mjs — Pi monitor ขั้น 1: ตัวช่วยของสถานะการใช้งานใน docs/asc-cloud.js
//   node tests/presence.mjs
//   โหลด asc-cloud.js ใน vm แบบไม่มี supabase-js (โหมดปิดคลาวด์) แล้วทดสอบฟังก์ชันล้วนที่เปิดไว้ใน AscCloud._presenceUtil
//   + ตรวจข้อความใน supabase/presence.sql ที่ความปลอดภัยพึ่งพา (เติมอีเมลเอง · กันโดเมน · ห้ามเขียนตรง)
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = readFileSync(new URL('../docs/asc-cloud.js', import.meta.url), 'utf8');
const win = { console: { info() {}, warn() {} }, location: { pathname: '/asc/index.html' } };
win.window = win;
vm.runInNewContext(src, win);
const U = win.AscCloud._presenceUtil;
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('✓', name); };

t('ไม่มี supabase-js = ปิดคลาวด์ ไม่เริ่มส่งสถานะ', () => {
  assert.equal(win.AscCloud.enabled, false);
});

t('โปรแกรม + ชื่อหน้าจากที่อยู่', () => {
  assert.deepEqual({ ...U.defaults('/asc/architec/index.html') }, { app: 'ASCA', base: 'ASCA' });
  assert.deepEqual({ ...U.defaults('/asc/studio/') }, { app: 'ASCS', base: 'ASCS · ออกแบบ' });
  assert.deepEqual({ ...U.defaults('/asc/studio/report.html') }, { app: 'ASCS', base: 'ASCS · รายงาน' });
  assert.deepEqual({ ...U.defaults('/asc/') }, { app: 'ASCS', base: 'ASC Enterprise · Dashboard' });
  assert.deepEqual({ ...U.defaults('/asc/index.html') }, { app: 'ASCS', base: 'ASC Enterprise · Dashboard' });
  assert.equal(U.defaults('/asc/asc_design.html').base, 'ASC · ออกแบบ (ASC เดิม)');
  assert.equal(U.defaults('/asc/asc_report.html').base, 'ASC · asc_report');
});

t('ช่องทาง: Capacitor/มือถือ = mobile · อื่น = web', () => {
  assert.equal(U.platform({ Capacitor: {} }), 'mobile');
  assert.equal(U.platform({ navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 14)' } }), 'mobile');
  assert.equal(U.platform({ navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0) Edg/130' } }), 'web');
});

t('ป้าย: ยุบช่องว่าง · ไม่เกิน 40 ตัวอักษร', () => {
  assert.equal(U.label('  🔌  ค่าไฟฟ้า \n  '), '🔌 ค่าไฟฟ้า');
  const long = U.label('ก'.repeat(60));
  assert.equal(long.length, 40);
  assert.ok(long.endsWith('…'));
});

// เอกสารจำลอง: querySelector คืนตัวแรกที่ตรงตามรายการ selector ที่ให้ไว้
const doc = (map) => ({ querySelector: (sel) => {
  for (const [k, v] of Object.entries(map)) if (sel.includes(k)) return { textContent: v };
  return null;
} });

t('เมนู: หัวข้อหน้าต่างที่เปิด มาก่อนแท็บ', () => {
  assert.equal(U.detail(doc({ 'dialog[open] h2': '  🌊 ตัวช่วยโซลาร์ลอยน้ำ ', '#tabs button.on': 'โครงการ' })), '🌊 ตัวช่วยโซลาร์ลอยน้ำ');
  assert.equal(U.detail(doc({ '#tabs button.on': 'ผลผลิตไฟฟ้า' })), 'ผลผลิตไฟฟ้า');
  assert.equal(U.detail(doc({})), '');
  assert.equal(U.detail(null), '');
});

const sql = readFileSync(new URL('../supabase/presence.sql', import.meta.url), 'utf8');
t('presence.sql: เติมอีเมลจากบัญชีเอง + กันโดเมน + เขียนผ่านฟังก์ชันเท่านั้น', () => {
  assert.match(sql, /select lower\(u\.email\) into mail from auth\.users u where u\.id = uid/);
  assert.match(sql, /mail not like '%@' \|\| coalesce\(domain, 'proinventive\.co\.th'\)/);
  assert.match(sql, /revoke all on public\.app_presence from anon, authenticated;/);
  assert.match(sql, /where p\.user_id = uid;/);                       // แตะรหัสแท็บของคนอื่นไม่ได้
  assert.match(sql, /with \(security_invoker = true\)/);               // มุมมองใช้สิทธิ์ของคนอ่าน
  assert.match(sql, /report_minutes  int         not null default 10/); // ทุก 10 นาที ตั้งค่าได้
});

const tg = readFileSync(new URL('../supabase/pi-monitor-telegram.sql', import.meta.url), 'utf8');
t('pi-monitor-telegram.sql: token จาก Vault เท่านั้น · ฟังก์ชันปิดจากหน้าเว็บ · ตั้งเวลาทุก 1 นาที', () => {
  assert.doesNotMatch(tg, /\d{8,}:[\w-]{30,}/);                         // ไม่มี token จริงในไฟล์
  assert.match(tg, /where name = 'pi_monitor_bot_token'/);
  for (const fn of ['pi_monitor_token()', 'pi_monitor_tg(text, jsonb)', 'pi_monitor_tick()', 'pi_monitor_text()', 'pi_monitor_alerts(text)',
                    'pi_monitor_find_chat_start()', 'pi_monitor_find_chat_result()', 'pi_monitor_test()', 'pi_monitor_resp(bigint)'])
    assert.ok(tg.includes(`revoke all on function public.${fn} from public, anon, authenticated;`), fn);
  assert.match(tg, /cron\.schedule\('pi-monitor-tick', +'\* \* \* \* \*'/);
  assert.match(tg, /'editMessageText'/);                                // แก้ข้อความปักหมุด ไม่ส่งใหม่ทุกรอบ
  assert.match(tg, /split_part\(r\.email, '@', 1\)/);                   // แสดงแค่ชื่อหน้าอีเมล
});

const ing = readFileSync(new URL('../supabase/presence-ingest.sql', import.meta.url), 'utf8');
t('presence-ingest.sql: รับจาก Pi ด้วยรหัสลับ · แตะแถว ASC ไม่ได้ · กันโดเมน', () => {
  assert.match(ing, /if want is null or p_secret is distinct from want then raise exception/);
  assert.match(ing, /where p\.source = 'pi';/);
  assert.match(ing, /left\('pi:' \|\| \(r->>'session_id'\), 64\)/);
  assert.match(ing, /not like '%@' \|\| coalesce\(domain, 'proinventive\.co\.th'\)/);
  assert.match(ing, /grant execute on function public\.presence_ingest\(text, jsonb\) to anon;/);
  assert.match(ing, /revoke all on function public\.presence_ingest\(text, jsonb\) from public, authenticated;/);
});

const dev = readFileSync(new URL('../supabase/presence-device.sql', import.meta.url), 'utf8');
t('presence-device.sql: desktop ผูกเครื่องผ่าน ai_installs · ตรวจรหัสลับ · กันโดเมน · แตะแถวอื่นไม่ได้', () => {
  assert.match(dev, /and i\.secret_hash  = md5\(coalesce\(p_secret, ''\)\)/);
  assert.match(dev, /and i\.revoked_at is null/);
  assert.match(dev, /if uid is null then return 'unlinked'; end if;/);
  assert.match(dev, /not like '%@' \|\| coalesce\(domain, 'proinventive\.co\.th'\)/);
  assert.match(dev, /where p\.user_id = uid and p\.source = 'desktop';/);
  assert.match(dev, /revoke all on function public\.device_user\(text, text\) from public, anon, authenticated;/);
});

// ── Pi monitor ขั้น 5: หน้า Dashboard ผู้ดูแล (docs/asc-pimonitor.js) ──
const pm = {};
vm.runInNewContext(readFileSync(new URL('../docs/asc-pimonitor.js', import.meta.url), 'utf8'), { window: pm, globalThis: pm });
const PM = pm.AscPiMonitor;
const R = (email, app, status, platform, last_seen, page = '') => ({ email, app, status, platform, last_seen, page });
const rowsPM = [
  R('a@proinventive.co.th', 'ASCS', 'idle', 'web', '2026-11-01T03:00:00Z', 'ASCS · ออกแบบ'),
  R('a@proinventive.co.th', 'PI', 'active', 'web', '2026-11-01T03:01:00Z', 'Pi · CRM · 📈 Pipeline'),
  R('b@proinventive.co.th', 'ASCA', 'offline', 'desktop', '2026-11-01T01:00:00Z', 'ASCA · หน้าแรก'),
  R('c@proinventive.co.th', 'ASCA', 'idle', 'desktop', '2026-11-01T02:59:00Z', 'ASCA · ผลผลิตไฟฟ้า'),
];
t('Dashboard: นับคนละครั้ง (สถานะดีที่สุดของคนนั้น) · กรอง · เรียง', () => {
  assert.deepEqual({ ...PM.summarize(rowsPM) }, { active: 1, idle: 1, offline: 1, people: 3, sessions: 4 });
  assert.equal(PM.filterRows(rowsPM, { app: 'ASCA' }).length, 2);
  assert.equal(PM.filterRows(rowsPM, { platform: 'desktop', status: 'idle' }).length, 1);
  assert.equal(PM.filterRows(rowsPM, { q: 'pipeline' }).length, 1);                 // ค้นในหน้า/เมนูด้วย
  assert.deepEqual([...PM.sortRows(rowsPM).map(r => r.status)], ['active', 'idle', 'idle', 'offline']);  // [...] = อาร์เรย์ของ realm นี้ (vm คนละ realm)
  assert.equal(PM.sortRows(rowsPM)[1].email, 'a@proinventive.co.th');               // idle ล่าสุดมาก่อน
});
t('Dashboard: เวลา "ที่แล้ว" · เวลาไทย · ตรวจค่าตั้ง', () => {
  const now = Date.parse('2026-11-01T03:10:00Z');
  assert.equal(PM.ago('2026-11-01T03:09:40Z', now), 'เมื่อสักครู่');
  assert.equal(PM.ago('2026-11-01T03:00:00Z', now), '10 นาทีที่แล้ว');
  assert.equal(PM.ago('2026-11-01T01:05:00Z', now), '2 ชม. 5 นาทีที่แล้ว');
  assert.match(PM.timeTh('2026-11-01T03:10:00Z'), /10:10/);                          // UTC+7
  assert.equal(PM.checkSettings({ report_minutes: 10, idle_minutes: 10, offline_minutes: 3 }), '');
  assert.match(PM.checkSettings({ report_minutes: 0, idle_minutes: 10, offline_minutes: 3 }), /1–1440/);
  assert.match(PM.checkSettings({ report_minutes: 10, idle_minutes: 10, offline_minutes: 1 }), /2–60/);
});
t('Dashboard: เมนูเฉพาะผู้ดูแล · หน้าไม่ใช้ innerHTML กับข้อมูลดิบ', () => {
  const idx = readFileSync(new URL('../docs/index.html', import.meta.url), 'utf8');
  assert.match(idx, /key: 'pi_monitor',.*adminOnly: true/);
  assert.match(idx, /if \(m && m\.adminOnly\) return !!SESSION && !!SESSION\.isAdmin;/);
  const page = readFileSync(new URL('../docs/pi-monitor.html', import.meta.url), 'utf8');
  assert.match(page, /if \(!user\.isAdmin\) \{ gate\('หน้านี้สำหรับผู้ดูแลระบบเท่านั้น'\)/);
  assert.match(page, /<td>\$\{esc\(r\.email\)\}<\/td>/);                              // ข้อมูลจากฐานข้อมูลผ่าน esc เสมอ
  assert.match(page, /<td class="page">\$\{esc\(r\.page\)\}<\/td>/);
});

t('asc-cloud.js: ไม่มีพิกัด/IP · ออกจากระบบแจ้งก่อน', () => {
  assert.doesNotMatch(src, /geolocation/);
  assert.match(src, /await presenceSend\(true\);\s+\/\/ แจ้งออกจากระบบ/);
});

console.log(`\nผ่าน ${n} ข้อ`);
