-- ============================================================================
--  ProInventive ASC Enterprise — สิทธิ์เข้าเมนูแอปเสริม (31 ต.ค. 2569)
--  ----------------------------------------------------------------------------
--  เมนูต่อจาก Settings (Project Plan · ASC Architect · Pi-System และที่จะเพิ่มในอนาคต)
--  ผู้ดูแลระบบเห็นทุกเมนู · ผู้ใช้ทั่วไปเห็นเฉพาะเมนูที่ผู้ดูแลระบบติ๊กให้
--  ผู้ดูแลระบบตั้งผู้ใช้คนอื่นเป็นผู้ดูแลระบบได้ (ถอดสิทธิ์ตัวเองไม่ได้ กันระบบไม่มีแอดมิน)
--
--  วิธีใช้ : Supabase Dashboard (โปรเจกต์ rcaslesvgilknupqmwrp) > SQL Editor
--            > New query > วางทั้งไฟล์ > Run · รันซ้ำได้ ไม่พัง
--
--  หมายเหตุ : การซ่อนเมนูเป็นด่านฝั่งหน้าจอ ปลายทางแต่ละแอปมีด่านของตัวเอง
--             (Pi-System ต้องล็อกอินบัญชี CRM แยก)
-- ============================================================================


-- 1. ตารางสิทธิ์เมนู — แยกจาก profiles เพราะ profiles_update_self ให้ผู้ใช้แก้แถวตัวเองได้
--    ถ้าเก็บใน profiles ผู้ใช้จะติ๊กสิทธิ์ให้ตัวเองได้
create table if not exists public.user_menus (
    user_id    uuid        primary key references public.profiles(id) on delete cascade,
    menus      text[]      not null default '{}',
    updated_at timestamptz not null default now(),
    updated_by uuid        references auth.users(id) on delete set null
);

comment on table public.user_menus is
    'เมนูแอปเสริมที่ผู้ใช้แต่ละคนเห็น (คีย์ เช่น project_plan, asc_architect, pi_system) · แก้ได้เฉพาะผู้ดูแลระบบ';

alter table public.user_menus enable row level security;

drop policy if exists user_menus_select on public.user_menus;
create policy user_menus_select on public.user_menus
    for select to authenticated
    using (user_id = auth.uid() or public.is_admin());

drop policy if exists user_menus_write on public.user_menus;
create policy user_menus_write on public.user_menus
    for all to authenticated
    using (public.is_admin()) with check (public.is_admin());


-- 2. ตั้ง/ถอดผู้ดูแลระบบ — profiles ไม่มี policy ให้แอดมินแก้แถวคนอื่น จึงผ่านฟังก์ชันนี้ทางเดียว
create or replace function public.admin_set_admin(p_user uuid, p_on boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
    if not public.is_admin() then
        raise exception 'เฉพาะผู้ดูแลระบบเท่านั้นที่กำหนดสิทธิ์ได้' using errcode = '42501';
    end if;
    if p_user = auth.uid() and not p_on then
        raise exception 'ถอดสิทธิ์ผู้ดูแลระบบของตัวเองไม่ได้ ให้ผู้ดูแลระบบคนอื่นทำแทน';
    end if;
    update public.profiles set is_admin = p_on where id = p_user;
    if not found then
        raise exception 'ไม่พบผู้ใช้นี้ (ยังไม่ได้สมัคร)';
    end if;
end;
$$;

revoke all on function public.admin_set_admin(uuid, boolean) from public, anon;
grant execute on function public.admin_set_admin(uuid, boolean) to authenticated;


-- ── ตรวจหลังรัน (ต้องได้ true ทั้ง 3 แถว)
select 'ตาราง user_menus' as รายการ, to_regclass('public.user_menus') is not null as ผ่าน
union all
select 'RLS เปิดแล้ว', relrowsecurity from pg_class where oid = 'public.user_menus'::regclass
union all
select 'ฟังก์ชัน admin_set_admin', exists (select 1 from pg_proc where proname = 'admin_set_admin');
