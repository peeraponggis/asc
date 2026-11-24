-- ============================================================================
--  ProInventive ASC Enterprise — ข้อมูลบริษัท · วิศวกร ของเครื่องที่ผูกบัญชีแล้ว (24 พ.ย. 2569 · ASC Studio 0.211.0)
--  ----------------------------------------------------------------------------
--  ลุงพีแจ้ง: กรอกข้อมูลบริษัทบนเว็บแล้ว แต่รุ่นเดสก์ท็อปว่าง — ต้องตรงกันทุกครั้ง
--  ข้อมูลบริษัทเป็นของ "บัญชี" (แถวของเราในตาราง profiles) ที่เดียว ทั้งเว็บและเดสก์ท็อปอ่าน/เขียนแถวเดียวกัน
--  ไฟล์งานที่คนอื่นส่งมาไม่มีข้อมูลบริษัทอยู่ข้างใน จึงทับข้อมูลของเราไม่ได้
--
--  ต้องรันก่อน : presence-device.sql (ใช้ฟังก์ชัน device_user)
--  วิธีใช้   : Supabase Dashboard (โปรเจกต์ rcaslesvgilknupqmwrp) > SQL Editor > New query > วางทั้งไฟล์ > Run · รันซ้ำได้ ไม่พัง
--  ยังไม่รัน : รุ่นเดสก์ท็อปใช้ข้อมูลบริษัทที่เก็บในเครื่องตามเดิม และขึ้นป้ายเตือนว่ายังไม่ตรงกับบัญชี (ไม่ล้ม)
--  คืนค่า   : device_my_company      → {"email", "company_name", ...} ของบัญชีที่ผูกเครื่องนี้ · ไม่ได้ผูก/รหัสลับผิด = null
--             device_save_company    → true = บันทึกแล้ว · ไม่ได้ผูก/รหัสลับผิด = false
--  ความปลอดภัย: แก้ได้เฉพาะคอลัมน์ข้อมูลบริษัท ของบัญชีที่ผูกเครื่องนี้เท่านั้น (ไม่แตะสิทธิ์ ไม่แตะบัญชีอื่น)
-- ============================================================================

create or replace function public.device_my_company(p_machine_hash text, p_secret text)
returns jsonb language sql stable security definer set search_path = public as $$
    select case when x.uid is null then null else (
        select jsonb_build_object(
            'email',            p.email,
            'company_name',     p.company_name,
            'company_address',  p.company_address,
            'company_tax_id',   p.company_tax_id,
            'company_phone',    p.company_phone,
            'company_email',    p.company_email,
            'company_website',  p.company_website,
            'company_logo_url', p.company_logo_url,
            'signer_name',      p.signer_name,
            'signer_title',     p.signer_title,
            'company_profile',  coalesce(p.company_profile, '{}'::jsonb))
        from public.profiles p where p.id = x.uid
    ) end
    from (select public.device_user(p_machine_hash, p_secret) as uid) x;
$$;

create or replace function public.device_save_company(p_machine_hash text, p_secret text, p_patch jsonb)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare
    v_uid uuid := public.device_user(p_machine_hash, p_secret);
begin
    if v_uid is null or p_patch is null then
        return false;
    end if;
    -- ช่องที่ไม่ได้ส่งมา = คงค่าเดิม · ส่งมาเป็นข้อความว่าง = ล้างช่องนั้น (คอลัมน์เป็น text not null default '' เหมือนบันทึกจากเว็บ)
    update public.profiles set
        company_name     = case when p_patch ? 'company_name'     then trim(coalesce(p_patch->>'company_name', ''))     else company_name end,
        company_address  = case when p_patch ? 'company_address'  then trim(coalesce(p_patch->>'company_address', ''))  else company_address end,
        company_tax_id   = case when p_patch ? 'company_tax_id'   then trim(coalesce(p_patch->>'company_tax_id', ''))   else company_tax_id end,
        company_phone    = case when p_patch ? 'company_phone'    then trim(coalesce(p_patch->>'company_phone', ''))    else company_phone end,
        company_email    = case when p_patch ? 'company_email'    then trim(coalesce(p_patch->>'company_email', ''))    else company_email end,
        company_website  = case when p_patch ? 'company_website'  then trim(coalesce(p_patch->>'company_website', ''))  else company_website end,
        signer_name      = case when p_patch ? 'signer_name'      then trim(coalesce(p_patch->>'signer_name', ''))      else signer_name end,
        signer_title     = case when p_patch ? 'signer_title'     then trim(coalesce(p_patch->>'signer_title', ''))     else signer_title end,
        company_profile  = case when p_patch ? 'company_profile'  then coalesce(p_patch->'company_profile', '{}'::jsonb) else company_profile end
    where id = v_uid;
    return found;
end;
$$;

revoke all on function public.device_my_company(text, text) from public, authenticated;
revoke all on function public.device_save_company(text, text, jsonb) from public, authenticated;
grant execute on function public.device_my_company(text, text) to anon;
grant execute on function public.device_save_company(text, text, jsonb) to anon;
