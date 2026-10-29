-- ============================================================================
--  ล้างรายชื่อที่อนุญาตให้สมัคร (allowed_emails) ที่ค้างอยู่แต่ยังไม่ได้สมัคร
--  ----------------------------------------------------------------------------
--  ลุงพีสั่ง 29 ต.ค. 2569: เหลือเฉพาะคนที่สมัครแล้ว
--  ⚠ ลบแล้วกู้คืนไม่ได้ (ต้องเพิ่มอีเมลใหม่ที่หน้า Settings) — รันข้อ 1 ดูรายชื่อก่อนเสมอ
--  วิธีใช้ : Supabase Dashboard > SQL Editor > วางทีละข้อ > Run
--
--  ไฟล์นี้ไม่ลบบัญชีที่สมัครแล้ว (auth.users) — การลบบัญชีผู้ใช้ทำที่
--  Supabase Dashboard > Authentication > Users ทีละบัญชี (ลบแล้วโครงการของคนนั้นถูกลบตาม)
-- ============================================================================

-- 1) ดูก่อน: อีเมลที่อนุญาตไว้แต่ยังไม่มีบัญชี
select a.email, a.note, a.created_at
from public.allowed_emails a
where not exists (select 1 from auth.users u where lower(u.email) = a.email)
order by a.created_at;

-- 2) ลบ (เอาเครื่องหมาย -- หน้าบรรทัด delete ออกเมื่อตรวจรายชื่อข้อ 1 แล้ว)
-- delete from public.allowed_emails a
-- where not exists (select 1 from auth.users u where lower(u.email) = a.email);

-- 3) ตรวจผล: รายชื่อที่อนุญาตต้องเท่ากับจำนวนบัญชีที่สมัครแล้ว
select (select count(*) from public.allowed_emails) as allowed,
       (select count(*) from auth.users)            as registered;
