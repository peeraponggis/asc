-- ============================================================================
--  ProInventive ASC Enterprise — ใช้งานออฟไลน์ได้กี่วัน ต่อแพ็กเกจ (22 พ.ย. 2569 · ลุงพีสั่ง)
--  ----------------------------------------------------------------------------
--  โปรแกรมในเครื่อง (ASC Studio · ASC Architect) เก็บผลสิทธิ์ครั้งล่าสุดที่ถามสำเร็จไว้ในเครื่อง
--  เน็ตหลุด = ใช้ผลนั้นต่อได้ · เกินกำหนด = หน้าจอ "ต่ออินเทอร์เน็ตเพื่อยืนยันสิทธิ์"
--  ลุงพีกำหนด 22 พ.ย. 2569: ทดลอง 1 วัน · Training · Starter · Pro · Company = ใช้ได้ถึงวันหมดอายุแพ็กเกจ (แต่เครื่องต้องผูกบัญชี)
--                            ไม่รู้แพ็กเกจ = 1 วัน · ผู้ดูแลระบบ/โดเมนบริษัท = ไม่จำกัด
--  offline_days: 0 = ไม่มีเพดานวัน ใช้ได้ถึงวันหมดอายุของสิทธิ์ (validTo) · >0 = เพดานวัน และยังไม่เกิน validTo อยู่ดี
--
--  ไฟล์นี้เพิ่มคอลัมน์ offline_days ที่ access_packages แล้วส่งค่าไปกับ my_access()/device_access()
--  ยังไม่รันไฟล์นี้ = โปรแกรมใช้ตารางตั้งต้นในโค้ดแทน (trial 1 · training/starter 3 · pro 7 · company 14 · ไม่รู้ 7)
--  รันแล้ว = แก้ตัวเลขได้ที่ตาราง access_packages โดยไม่ต้องแก้โปรแกรม
--  ----------------------------------------------------------------------------
--  วิธีใช้ : Supabase Dashboard (โปรเจกต์ ASC Cloud rcaslesvgilknupqmwrp) > SQL Editor > New query > วางทั้งไฟล์ > Run
--            https://supabase.com/dashboard/project/rcaslesvgilknupqmwrp/sql/new
--            รันซ้ำได้ ไม่พัง · ต้องรัน access-control.sql มาก่อน
-- ============================================================================

-- ── 1. คอลัมน์ใหม่ + ค่าตั้งต้นของแต่ละแพ็กเกจ ───────────────────────────
alter table public.access_packages
    add column if not exists offline_days int not null default 1
        check (offline_days between 0 and 365);

comment on column public.access_packages.offline_days is
    'เพดานวันที่ใช้งานแบบออฟไลน์ต่อได้หลังถามสิทธิ์สำเร็จครั้งล่าสุด · 0 = ไม่มีเพดานวัน ใช้ได้ถึงวันหมดอายุของสิทธิ์';

update public.access_packages set offline_days = 1 where code = 'trial';
update public.access_packages set offline_days = 0 where code in ('training', 'starter', 'pro', 'company');

-- ── 2. ส่ง offlineDays ไปกับผลสิทธิ์ (เพิ่มคีย์เดียว ของเดิมไม่เปลี่ยน) ──────────
--  ผู้ดูแลระบบ/โดเมนบริษัท (exempt) ไม่ส่งค่า = โปรแกรมถือว่าไม่จำกัด
create or replace function public._access_offline_days(p_core jsonb)
returns jsonb language sql stable security definer set search_path = public as $$
    select case
        when coalesce((p_core->>'exempt')::boolean, false) then p_core
        else p_core || jsonb_build_object('offlineDays', coalesce(
            (select pk.offline_days from public.access_packages pk where pk.code = p_core#>>'{package,code}'), 1))
    end;
$$;
revoke all on function public._access_offline_days(jsonb) from public, anon, authenticated;

create or replace function public.my_access(p_instance text default null, p_label text default null, p_app text default 'WEB')
returns jsonb language sql volatile security definer set search_path = public as $$
    select case when auth.uid() is null then jsonb_build_object('ok', false, 'reason', 'anon')
                else public._access_offline_days(public._access_eval(auth.uid(), p_instance, p_label, p_app)) end;
$$;
grant execute on function public.my_access(text, text, text) to authenticated;
revoke execute on function public.my_access(text, text, text) from anon;

create or replace function public.device_access(p_machine_hash text, p_secret text, p_app text default 'ASCS')
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := public.device_user(p_machine_hash, p_secret);
begin
    if uid is null then return jsonb_build_object('ok', false, 'reason', 'unlinked'); end if;
    return public._access_offline_days(
        public._access_eval(uid, 'd:' || left(lower(coalesce(p_machine_hash, '')), 24), 'desktop', p_app));
end;
$$;
revoke all on function public.device_access(text, text, text) from public, authenticated;
grant execute on function public.device_access(text, text, text) to anon;

-- ตรวจผล (ผู้ดูแลระบบรันได้):
--   select code, name, offline_days from public.access_packages order by sort;
--   select public.my_access();            -- ต้องมีคีย์ offlineDays (ยกเว้นผู้ดูแล/โดเมนบริษัท)
