-- ============================================================================
--  ProInventive ASC Enterprise — คำศัพท์ ASC Studio ที่ผู้ดูแลระบบแก้ (10 พ.ย. 2569 · ASC Enterprise 4.8.0 / ASCS 0.170.0)
--  ----------------------------------------------------------------------------
--  หน้า Settings › แท็บ "คำศัพท์ ASCS" ให้ผู้ดูแลระบบแก้ข้อความ 3 ภาษา (ไทย · ลาว · อังกฤษ) ของ ASC Studio
--  ASC Studio รุ่นเว็บ (studio/) และรุ่นในเครื่องที่ผูกบัญชีไว้ ดึงคำที่แก้ไปทับข้อความในตัวโปรแกรมตอนเปิด
--
--  ตารางเก็บ "เฉพาะคำที่แก้" (ลุงพีเลือก 10 พ.ย. 2569) · ค่าเริ่มอยู่ในตัวโปรแกรม (studio/terms-default.json)
--    มีแถว = คีย์นั้นถูกแก้ · คืนค่าเดิม = ลบแถว · ช่องที่ว่าง = ใช้ข้อความเดิมของช่องนั้น
--
--  ต้องรันก่อน : schema.sql (ฟังก์ชัน is_admin) และ presence-device.sql (ฟังก์ชัน device_user)
--  วิธีใช้   : https://supabase.com/dashboard/project/rcaslesvgilknupqmwrp/sql/new > วางทั้งไฟล์ > Run
--             หรือเมนู 06 ของชุด bat F:\LocalAI\setup_prg\ASC
--  รันซ้ำได้ปลอดภัย ไม่ลบคำที่แก้ไว้
--  ยังไม่รัน : แท็บคำศัพท์บอกว่ายังไม่ได้รันไฟล์นี้ · ASC Studio ใช้ข้อความเดิม (ไม่ล้ม)
-- ============================================================================

create table if not exists public.ascs_terms (
    key        text        primary key,                 -- คีย์ข้อความของ ASC Studio เช่น mn.about
    th         text        not null default '',         -- ว่าง = ไม่ทับช่องนั้น
    lo         text        not null default '',
    en         text        not null default '',
    updated_at timestamptz not null default now(),
    updated_by uuid        references auth.users(id) on delete set null
);

alter table public.ascs_terms enable row level security;

-- ทุกคนที่ล็อกอินอ่านได้ (ASC Studio รุ่นเว็บต้องอ่าน) · เพิ่ม/แก้/ลบได้เฉพาะผู้ดูแลระบบ
drop policy if exists ascs_terms_select on public.ascs_terms;
create policy ascs_terms_select on public.ascs_terms
    for select to authenticated using (true);

drop policy if exists ascs_terms_write on public.ascs_terms;
create policy ascs_terms_write on public.ascs_terms
    for all to authenticated
    using (public.is_admin()) with check (public.is_admin());

revoke all on public.ascs_terms from anon;
grant select, insert, update, delete on public.ascs_terms to authenticated;

-- ตราประทับ: จำนวนคำที่แก้ + เวลาแก้ล่าสุด · ASC Studio ถามสั้น ๆ ก่อน ไม่ต้องโหลดทั้งตาราง
-- (ลบแถว = จำนวนลด ตราประทับจึงเปลี่ยนด้วย)
create or replace function public.ascs_terms_stamp()
returns jsonb language sql stable security invoker set search_path = public as $$
    select jsonb_build_object(
        'n',          (select count(*) from public.ascs_terms),
        'updated_at', (select coalesce(max(updated_at), 'epoch'::timestamptz) from public.ascs_terms)
    );
$$;
revoke execute on function public.ascs_terms_stamp() from public;
revoke execute on function public.ascs_terms_stamp() from anon;
grant  execute on function public.ascs_terms_stamp() to authenticated;

-- รุ่นในเครื่อง (ไม่ล็อกอิน · ผูกเครื่องแล้ว) ถามผ่าน server ในเครื่อง ครั้งเดียวได้ทั้งตราประทับและคำที่แก้
-- เครื่องไม่ได้ผูก/รหัสลับผิด = null
create or replace function public.device_terms(p_machine_hash text, p_secret text)
returns jsonb language sql stable security definer set search_path = public as $$
    select case when public.device_user(p_machine_hash, p_secret) is null then null else jsonb_build_object(
        'stamp', jsonb_build_object(
            'n',          (select count(*) from public.ascs_terms),
            'updated_at', (select coalesce(max(updated_at), 'epoch'::timestamptz) from public.ascs_terms)),
        'rows',  coalesce((select jsonb_agg(jsonb_build_object('key', t.key, 'th', t.th, 'lo', t.lo, 'en', t.en) order by t.key)
                           from public.ascs_terms t), '[]'::jsonb)
    ) end;
$$;
revoke all on function public.device_terms(text, text) from public, authenticated;
grant execute on function public.device_terms(text, text) to anon;
