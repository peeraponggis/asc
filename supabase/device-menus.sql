-- ============================================================================
--  ProInventive ASC Enterprise — สิทธิ์เมนูของเครื่องที่ผูกบัญชีแล้ว (2 พ.ย. 2569 · ASC Studio 0.136.0)
--  ----------------------------------------------------------------------------
--  ASC Studio รุ่นในเครื่องใช้ฟังก์ชันนี้ถามว่า "บัญชีที่ผูกเครื่องนี้ไว้ ได้สิทธิ์เมนูอะไร"
--  เพื่อแสดงเมนู CRM-Pi เฉพาะคนที่ผู้ดูแลระบบติ๊ก "Pi-System" ให้ (ตาราง user_menus · menu-access.sql) หรือเป็นผู้ดูแลระบบ
--  รุ่นเว็บอ่านสิทธิ์จากบัญชีที่ล็อกอินอยู่แล้ว ไม่ใช้ไฟล์นี้
--
--  ต้องรันก่อน : menu-access.sql และ presence-device.sql (ใช้ตาราง user_menus และฟังก์ชัน device_user)
--  วิธีใช้   : Supabase Dashboard (โปรเจกต์ rcaslesvgilknupqmwrp) > SQL Editor > New query > วางทั้งไฟล์ > Run · รันซ้ำได้ ไม่พัง
--  ยังไม่รัน : เครื่องในทุกเครื่องไม่เห็นเมนู CRM-Pi (ปลอดภัย ไม่ล้ม)
--  คืนค่า   : {"isAdmin": true/false, "menus": ["pi_system", ...]} · เครื่องไม่ได้ผูก/รหัสลับผิด = null
--  หมายเหตุ : เป็นด่านฝั่งหน้าจอ · CRM-Pi ยังต้องล็อกอินบัญชี CRM ของตัวเอง
-- ============================================================================

create or replace function public.device_my_menus(p_machine_hash text, p_secret text)
returns jsonb language sql stable security definer set search_path = public as $$
    select case when x.uid is null then null else jsonb_build_object(
        'isAdmin', coalesce((select p.is_admin from public.profiles p where p.id = x.uid), false),
        'menus',   coalesce((select to_jsonb(m.menus) from public.user_menus m where m.user_id = x.uid), '[]'::jsonb)
    ) end
    from (select public.device_user(p_machine_hash, p_secret) as uid) x;
$$;

revoke all on function public.device_my_menus(text, text) from public, authenticated;
grant execute on function public.device_my_menus(text, text) to anon;
