# Changelog — Auto Solar Co-pilot Studio (ASC Studio)
โดย ลุงพี (Peerapong) · ProInventive

---

## [4.9.0] — 2569-11-10
### ธีมเดียวกับ ASC Studio (Classic · Carbon · Drafting)
โดย ลุงพี

- `docs/asc-theme.js` ใหม่: ธีม E+ 3 แบบของ ASC Studio (ค่าสีคัดลอกจาก design-auto `src/ui/style.css`) · ผูกทุกสีของ Tailwind ในหน้าเข้ากับตัวแปรของธีม — ทั้งหน้าเปลี่ยนตามโดยไม่ต้องไล่แก้คลาส
- ธีมเก็บใน `design-auto.prefs` (คีย์เดียวกับ ASC Studio บนโดเมนเดียวกัน) → เลือกที่ Dashboard แล้ว studio ใช้ตาม และกลับกัน · ธีมเดิมของ ASCS (night/forest/…) ใช้ธีม E+ ที่ใกล้ที่สุด
- ปุ่มเลือกธีมบนหัวหน้า · ฟอนต์ Sarabun + Noto Sans Lao แทน Kanit · มุมเหลี่ยมและเงาบางแบบ ASCS · แถบเมนูซ้ายเป็นแผงสว่างแบบหน้าแรก ASCS (รายการที่เลือกมีแถบสีด้านซ้าย)
- กราฟ Analytics ใช้สีของธีมและวาดใหม่เมื่อเปลี่ยนธีม · หน้าเข้าสู่ระบบพื้นเข้มแบบ Carbon + สีเน้นของธีม · แท็บคำศัพท์ใช้สีของธีม
- ขอบเขต: หน้า `index.html` (เข้าสู่ระบบ · Dashboard · Analytics · Team · Settings) — หน้าเก่าอื่นยังเป็นหน้าตาเดิม

## [4.8.1] — 2569-11-10
### แก้ลิงก์ตรงเข้าแท็บ Settings
โดย ลุงพี

- เปิด `index.html#settings/terms` ตอนยังไม่ล็อกอิน: เดิม hash ถูกล้างตอนหน้าเริ่ม (switchView('projects')) จึงไม่พาเข้าแท็บหลังล็อกอิน · ตอนนี้ล้างเฉพาะตอนออกจากหน้า Settings จริง

## [4.8.0] — 2569-11-10
### Settings แบบแท็บ + แท็บคำศัพท์ ASCS (ASC Studio 0.170.0)
โดย ลุงพี

- หน้า Settings เป็นแท็บ: บัญชี · บริษัท · ผู้ใช้และสิทธิ์ · คลังอุปกรณ์ · คำศัพท์ ASCS — การ์ดเดิมย้ายเข้าแท็บครบทุกช่อง พฤติกรรมเดิม · ผู้ใช้ทั่วไปเห็นแค่ บัญชี + บริษัท · จำแท็บล่าสุด · ลิงก์ตรง `#settings/terms` · เอาป้าย SOON ของเมนู Settings ออก
- แท็บ **คำศัพท์ ASCS** (ผู้ดูแลระบบ · `docs/asc-terms.js`): ข้อความ 3 ภาษาของ ASC Studio ทุกคีย์ (4,418 คีย์ 178 หมวด จาก `studio/terms-default.json`) · ค้นหาไทย/ลาว/อังกฤษ · กรองหมวด · เฉพาะที่แก้แล้ว · หน้าละ 50 · แก้ในช่อง + ป้าย แก้แล้ว + ค่าเดิมใต้ช่อง · คืนค่าเดิม · ส่งออก/นำเข้า CSV (ตรวจก่อนนำเข้า) · คีย์ที่โปรแกรมเลิกใช้มีปุ่มลบ
- ASC Studio รุ่นเว็บและรุ่นในเครื่องที่ผูกบัญชีดึงคำที่แก้ไปทับข้อความตอนเปิดโปรแกรม (แคชในเครื่อง)
- SQL ใหม่ `supabase/ascs-terms.sql` — ตาราง `ascs_terms` เก็บเฉพาะคำที่แก้ · `ascs_terms_stamp()` · `device_terms()` · รันที่ https://supabase.com/dashboard/project/rcaslesvgilknupqmwrp/sql/new (รันแล้ว 10 พ.ย. 2569 · รันซ้ำได้) หรือเมนู 06 ของ `setup_prg\ASC`
- `docs/asc-cloud.js`: `termsStamp` · `listTerms` · `upsertTerms` · `deleteTerms` · เทสต์ `node tests/terms.mjs` (13 ข้อ)

## [4.7.1] — 2569-11-09
### คลังสเปกอุปกรณ์: ตัวกรองใต้หัวคอลัมน์
โดย ลุงพี

- ช่องเลือกใต้หัวคอลัมน์ หมวด · ยี่ห้อ · ชนิด (STR/HYB) · ซ่อนใน ASCS — ขึ้นเฉพาะคอลัมน์ที่ข้อมูลต่างกันตั้งแต่ 2 แบบ · แต่ละตัวเลือกมีจำนวนแถวกำกับ (นับหลังกรองคอลัมน์อื่นแล้ว) · ปุ่ม ล้างตัวกรอง ขึ้นเมื่อมีตัวกรองใช้อยู่
- ตัดช่องเลือกหมวด/ซ่อนบนแถบค้นหาออก (ย้ายไปใต้หัวคอลัมน์) · รุ่นและสรุปใช้ช่องค้นหาตามเดิม

## [4.7.0] — 2569-11-09
### คลังสเปกอุปกรณ์: ช่องติ๊ก "ซ่อนใน ASCS"
โดย ลุงพี

- คอลัมน์ `hidden_in_ascs` ในตาราง `public.devices` (`supabase/devices-hidden-in-ascs.sql`) · ติ๊กได้เฉพาะผู้ดูแลระบบ บันทึกทันที ไม่ลบ · ตัวกรอง แสดง: ทั้งหมด / เฉพาะที่ ASCS เห็น / เฉพาะที่ซ่อน · นับจำนวนที่ซ่อนในบรรทัดสรุป
- หน้าออกแบบ/ASC Studio รุ่นเว็บ (`asc-devices.js`) ไม่เอารายการที่ซ่อนเข้าแคช จึงไม่ขึ้นให้เลือก · การติ๊กอัปเดต `updated_at` ทำให้ตราประทับเปลี่ยน แคชของทุกเครื่องดึงใหม่เอง
- ไฟล์สำรองคลัง: .txt ของรายการที่ซ่อนอยู่ในโฟลเดอร์ `_ซ่อนใน_ASCS/` แยกต่างหาก + บอกใน อ่านก่อน.txt · `devices.json` มีค่า `hidden_in_ascs` ด้วย

## [4.6.0] — 2569-11-02
### Pi monitor · ทะเบียนโปรแกรม + เพิ่ม Project Plan
โดย ลุงพี

#### เพิ่มใหม่
- `supabase/presence-apps.sql` — ทะเบียน `presence_apps` (ASCS · ASCA · PI · PLAN) แทนเงื่อนไขตายตัวในคอลัมน์ `app_presence.app` (เปลี่ยนเป็น foreign key)
  · รันที่ https://supabase.com/dashboard/project/rcaslesvgilknupqmwrp/sql/new (รันซ้ำได้) · โปรแกรมใหม่ = เพิ่มหนึ่งบรรทัดแล้วรันอีกครั้ง
- `docs/asc-cloud.js` — `PRESENCE_APPS` ทะเบียนหน้าเว็บของโปรแกรมอื่นบนโดเมนเดียวกัน (Project Plan `/aisolar2/project_plan` = `PLAN`)
  · `AscCloud.presence({ detail })` ให้หน้าที่ไม่ได้ใช้แท็บแบบ ASC ส่งชื่อเมนู/แท็บเองได้
- `docs/pi-monitor.html` — ตัวกรอง "ทุกโปรแกรม" อ่านชื่อจากทะเบียน (มี Project Plan) · `asc-pimonitor.js` เพิ่ม `setAppLabels()`
- เทสต์ `tests/presence.mjs` 16 ข้อ (เพิ่ม 3)
- คู่กับ Project Plan 1.5.0 (repo aisolar2) ที่โหลด asc-cloud.js ใช้การล็อกอินของ ASC Enterprise

## [4.5.0] — 2569-11-01
### Pi monitor ขั้น 5 · หน้า Dashboard ผู้ดูแล
โดย ลุงพี

#### เพิ่มใหม่
- `docs/pi-monitor.html` (https://peeraponggis.github.io/asc/pi-monitor.html): สถานะการใช้งาน ASCS · ASCA · Pi-System (เว็บ + เครื่อง) ของผู้ใช้ @proinventive.co.th แบบสด
  · การ์ด 🟢 ใช้งาน · 🟡 เปิดทิ้งไว้ · ⚫ ออฟไลน์ใน 24 ชม. · ผู้ใช้ทั้งหมด (นับคนละครั้ง)
  · ตาราง สถานะ · ผู้ใช้ · โปรแกรม · ช่องทาง · หน้า/เมนู · ไม่ขยับกี่นาที · สัญญาณล่าสุด · เริ่มใช้ · เวอร์ชัน
  · กรองตามโปรแกรม/สถานะ/ช่องทาง + ค้นหาอีเมลหรือหน้า/เมนู · รีเฟรชเองทุก 30 วินาที–10 นาที (เลือกได้ จำในเครื่อง)
  · ⚙️ ตั้งค่ารายงาน Telegram ในหน้า (รอบสรุป · เกณฑ์เปิดทิ้งไว้/ออฟไลน์ · แจ้งเข้า/ออก · หยุดส่งชั่วคราว) ตรวจช่วงค่าก่อนบันทึก
  · เฉพาะผู้ดูแลระบบ (ด่านจริงคือ RLS ของ presence_status / monitor_settings)
- เมนูแอปเสริม **Pi monitor** ใน ASC Enterprise (sidebar) — `adminOnly` เห็นเฉพาะผู้ดูแลระบบ ไม่มีช่องติ๊กให้ผู้ใช้ทั่วไป
- `docs/asc-pimonitor.js` ตรรกะล้วน (สรุป · กรอง · เรียง · เวลาไทย · ตรวจค่าตั้ง) · `tests/presence.mjs` เพิ่มเป็น 13 ข้อ

---

## [4.4.5] — 2569-11-01
### Pi monitor ขั้น 4 · รุ่น desktop (ผูกเครื่องด้วยรหัส)
โดย ลุงพี

- `supabase/presence-device.sql`: `presence_device_ping(แฮชเครื่อง, รหัสลับ, …)` + `presence_device_whoami()` — รุ่นในเครื่องไม่มีล็อกอิน จึงรู้ตัวผู้ใช้จากเครื่องที่ผูกในตาราง `ai_installs`
  · ผูกด้วยรหัสเดียวกับติดตั้งผู้ช่วย AI (นับรวม 2 เครื่องต่อบัญชี) · เครื่องที่ติดตั้ง AI แล้วผูกอยู่แล้ว
  · แถว desktop: `d:` + session · platform `desktop` · source `desktop` · กันโดเมนเหมือนเดิม · ผิด/ถูกยกเลิก = 'unlinked'
- ฝั่งโปรแกรม: ASC Studio (design-auto) 0.129.0 · ASC Architect 0.19.0 (`server/asc_link.py` ไฟล์เดียวกัน)
- `tests/presence.mjs` เพิ่มเป็น 10 ข้อ

---

## [4.4.4] — 2569-11-01
### สิทธิ์เมนู/รายชื่อ: ไม่ขึ้น "ไม่มีสิทธิ์" เมื่อเปิดหน้าค้างจนการเข้าระบบหมดอายุ
โดย ลุงพี

- `docs/asc-cloud.js`: `withSession()` ต่ออายุการเข้าระบบก่อนบันทึก · ถูกปฏิเสธ (RLS / 42501 / ลบได้ 0 แถว) → ต่ออายุแล้วลองซ้ำ 1 ครั้ง · ต่อไม่ได้ = "หมดเวลาเข้าสู่ระบบ กรุณาออกจากระบบแล้วเข้าใหม่"
  · ใช้กับ ติ๊กสิทธิ์เมนู · ตั้ง/ถอด Admin · เพิ่ม/ถอดรายชื่อ
  · ข้อความ "ไม่มีสิทธิ์ทำรายการนี้" แนะนำให้เข้าระบบใหม่ถ้าเปิดหน้าค้างไว้นาน
- สาเหตุที่พบ: แท็บเปิดค้าง เบราว์เซอร์พักตัวต่ออายุอัตโนมัติ หน้าจอยังโชว์ Administrator แต่คำขอถูกส่งแบบไม่มีบัญชี
- `tests/session-retry.mjs` 6 ข้อ

---

## [4.4.3] — 2569-11-01
### Pi monitor ขั้น 3 · รับสถานะ Pi-System มารวมรายงานเดียว
โดย ลุงพี

- `supabase/presence-ingest.sql`: `presence_ingest(รหัสลับ, แถว)` รับสถานะ CRM-Pi/Pi_BoQ จากโปรเจกต์ Pi (ล็อกอินคนละโปรเจกต์) ทุก 1 นาที
  · รหัสลับร่วมใน Vault `pi_ingest_secret` (สร้างเอง) · แถว Pi: `pi:` + session · app `PI` · `user_id` ว่าง · `source = 'pi'` · แตะแถว ASC ไม่ได้ · กันโดเมนเหมือนเดิม
  · ข้อความสรุปในกลุ่ม Telegram รวม ASCS/ASCA/Pi ในข้อความเดียว (ไม่ต้องแก้ `pi-monitor-telegram.sql`)
- `tests/presence.mjs` เพิ่มเป็น 9 ข้อ · ฝั่ง Pi อยู่ใน repo picode (CRM-Pi 1.1.0)

---

## [4.4.2] — 2569-11-01
### Pi monitor · คำขอ Telegram ไม่หมดเวลาง่าย
โดย ลุงพี

- `supabase/pi-monitor-telegram.sql`: รอคำตอบ Telegram 20 วินาที (เดิม 5 วินาทีของ pg_net หมดเวลาตอนหารหัสกลุ่มจริง) · ตัดช่องว่าง/ขึ้นบรรทัดที่ติดมากับ token · หารหัสกลุ่มบอกว่าหมดเวลา/ได้กี่อัปเดต

---

## [4.4.1] — 2569-11-01
### Pi monitor ขั้น 2 · สรุปเข้ากลุ่ม Telegram "Pi monitor"
โดย ลุงพี

#### เพิ่มใหม่
- `supabase/pi-monitor-telegram.sql`: pg_cron เรียก `pi_monitor_tick()` ทุก 1 นาที (ทำงานใน Supabase เอง ไม่พึ่งเครื่อง home)
  - ครบ `report_minutes` (10 นาที · ตั้งค่าได้) → แก้ **ข้อความสรุปที่ปักหมุด** ข้อความเดียว (ครั้งแรกส่งแล้วปักหมุด · ถูกลบ = ส่งใหม่เอง)
  - มีคนเข้าใช้/ออก → ส่งข้อความสั้นแบบไม่มีเสียง (ปิดได้ `alert_changes`)
  - token บอทเก็บใน Supabase Vault (`pi_monitor_bot_token`) · หารหัสกลุ่มด้วย `pi_monitor_find_chat_start/result()` · ทดสอบ `pi_monitor_test()`
  - ล้างประวัติเก่าทุกวัน 03:15 น. (`presence_cleanup`)
- `supabase/README.md`: หัวข้อ Pi monitor ทีละขั้น (ที่อยู่ไฟล์เต็ม + ลิงก์ SQL Editor)
- `tests/presence.mjs` เพิ่มเป็น 8 ข้อ

---

## [4.4.0] — 2569-11-01
### Pi monitor ขั้น 1 · สถานะการใช้งาน ASCS / ASCA
โดย ลุงพี

#### เพิ่มใหม่
- `docs/asc-cloud.js`: ส่งสถานะการใช้งาน (`presence_ping`) ทุก 60 วินาที + ทันทีที่เปลี่ยนหน้า/เมนู — ทุกหน้าที่โหลดไฟล์นี้ (Dashboard · ASCS เว็บ · ASCA ออนไลน์) ไม่ต้องแก้หน้าเอง
  - หน้า/เมนู = ชื่อหน้า + หัวข้อหน้าต่างที่เปิด หรือแท็บที่เลือก (เช่น `ASCA · ผลผลิตไฟฟ้า`) · ช่องทาง web/mobile · ขยับเมาส์/พิมพ์ในรอบนี้ไหม
  - ส่งเมื่อล็อกอินแล้วเท่านั้น · ออกจากระบบ/ปิดแท็บแจ้งปิด · ยังไม่ได้รัน SQL = หยุดส่งเงียบ ๆ
  - ไม่เก็บที่ตั้ง/IP/ชื่อลูกค้า · API ใหม่ `AscCloud.presence()` · `presencePage()` · `presenceList()`
- `supabase/presence.sql`: ตาราง `app_presence` (เขียนผ่านฟังก์ชันเท่านั้น · ฐานข้อมูลเติมอีเมลเอง · เก็บเฉพาะ @proinventive.co.th) · `monitor_settings` (ทุก 10 นาที · ไม่ขยับ 10 นาที = เปิดทิ้งไว้ · 3 นาที = ออฟไลน์ · เก็บ 90 วัน — แก้ได้) · มุมมอง `presence_status` (แอดมินเห็นทุกคน) · `presence_cleanup()`
- `tests/presence.mjs` (7 ข้อ)

#### ยังไม่ทำ (ขั้นถัดไป)
- ส่งสรุปเข้ากลุ่ม Telegram "Pi monitor" (pg_cron + pg_net) · Pi-System · รุ่น desktop · หน้า Dashboard ผู้ดูแล

---

## [4.3.1] — 2569-10-31
### ปุ่มรูปตาช่องรหัสผ่านหน้าสมัครใช้งาน
โดย ลุงพี

- ช่อง "ตั้งรหัสผ่าน" และ "พิมพ์รหัสผ่านอีกครั้ง" มีปุ่มรูปตาแสดง/ซ่อนรหัสที่พิมพ์ (แยกกันทีละช่อง)
- ปุ่มรูปตาหน้าเข้าสู่ระบบใช้ตัวจัดการเดียวกัน (`.pw-eye` + `data-for`) และบอกสถานะให้โปรแกรมอ่านหน้าจอ (aria-label/aria-pressed)

---

## [4.3.0] — 2569-10-31
### ASC Enterprise · เมนูแอปเสริม + สิทธิ์เมนูรายคน
โดย ลุงพี

#### เปลี่ยน
- หน้า Dashboard เปลี่ยนชื่อ **ASC Cloud → ASC Enterprise** (โลโก้ sidebar + ชื่อแท็บ)

#### เพิ่มใหม่
- **เมนูต่อจาก Settings:** Project Plan · ASC Architect · Pi-System (เปิดแท็บใหม่) — ทะเบียน `APP_MENUS` ใน `docs/index.html` เพิ่มเมนูในอนาคตได้ด้วยแถวเดียว
- **Settings › รายชื่อผู้มีสิทธิ์ใช้งาน:** คอลัมน์ "สิทธิ์เมนู" ติ๊กเปิด/ปิดเมนูรายคน + ตั้ง/ถอด **Admin**
- ผู้ดูแลระบบเห็นทุกเมนู · ผู้ใช้ทั่วไปเห็นเฉพาะเมนูที่ได้รับสิทธิ์ · ถอด Admin ของตัวเองไม่ได้
- `supabase/menu-access.sql`: ตาราง `user_menus` (RLS อ่านของตัวเอง/แอดมิน · เขียนเฉพาะแอดมิน) + ฟังก์ชัน `admin_set_admin`

---

## [4.2.0] — 2569-10-30
### ✨ Security & IP Protection Release
โดย ลุงพี

#### เพิ่มใหม่
- **PDPA Modal (3 ภาษา)** — `asc-pdpa.js`: แสดง modal ขอความยินยอม PDPA ทุก session ก่อนเข้าสู่ระบบ รองรับ ไทย / English / ລາວ
- **Copyright Headers** — เพิ่ม copyright notice ในไฟล์ JS ทุกไฟล์ (27 ไฟล์) ระบุเป็น proprietary/confidential
- **Security Headers** — `_headers`: Cloudflare Pages CSP + X-Frame-Options + HSTS + Permissions-Policy
- **PDPA Section ในคู่มือ** — `manual.html`: เพิ่มหัวข้อ "นโยบาย PDPA & ลิขสิทธิ์" พร้อม TOC entry
- **Obfuscation Build Script** — `build-protect.ps1`: สร้าง dist/ ที่ obfuscate JS ก่อน deploy
- **Copyright Batch Script** — `add-copyright-headers.ps1`: เพิ่ม header ในไฟล์ JS อัตโนมัติ

#### ความปลอดภัย
- เพิ่ม Content-Security-Policy ป้องกัน XSS
- เพิ่ม X-Frame-Options: DENY ป้องกัน clickjacking
- เพิ่ม Strict-Transport-Security (HSTS)
- PDPA consent บันทึกใน sessionStorage (ต้อง accept ทุกครั้งที่เปิด browser ใหม่)

---

## [4.1.0] และก่อนหน้า
รายละเอียดอยู่ใน git log: `git log --oneline`
