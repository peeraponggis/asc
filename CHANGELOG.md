# Changelog — Auto Solar Co-pilot Studio (ASC Studio)
โดย ลุงพี (Peerapong) · ProInventive

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
