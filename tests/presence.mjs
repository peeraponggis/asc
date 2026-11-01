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

t('asc-cloud.js: ไม่มีพิกัด/IP · ออกจากระบบแจ้งก่อน', () => {
  assert.doesNotMatch(src, /geolocation/);
  assert.match(src, /await presenceSend\(true\);\s+\/\/ แจ้งออกจากระบบ/);
});

console.log(`\nผ่าน ${n} ข้อ`);
