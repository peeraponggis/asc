# Changelog — Auto Solar Co-pilot Studio (ASC Studio)
โดย ลุงพี (Peerapong) · ProInventive

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
