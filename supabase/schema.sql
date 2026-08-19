-- ============================================================================
--  ProInventive ASC — โครงสร้างฐานข้อมูลบน Supabase
--  ----------------------------------------------------------------------------
--  วิธีใช้ : เปิด Supabase Dashboard > SQL Editor > New query
--            วางไฟล์นี้ทั้งหมดแล้วกด Run  (รันซ้ำได้ ไม่พัง)
--
--  รูปแบบการแชร์ที่เลือกไว้ : เจ้าของ + คนที่ถูกเชิญ
--    - ทุกโครงการมีเจ้าของหนึ่งคน
--    - เจ้าของเชิญคนอื่นเข้ามาเป็น viewer (ดูอย่างเดียว) หรือ editor (แก้ได้)
--    - ผู้ดูแลระบบเห็นทุกโครงการ
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
--  1. ตารางโปรไฟล์ผู้ใช้
--     Supabase เก็บบัญชีไว้ใน auth.users ซึ่งแตะโดยตรงไม่ได้
--     จึงทำตารางเงาไว้เก็บชื่อที่แสดงและสิทธิ์ผู้ดูแลระบบ
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
    id           uuid primary key references auth.users(id) on delete cascade,
    email        text        not null,
    display_name text        not null default '',
    is_admin     boolean     not null default false,
    created_at   timestamptz not null default now()
);

comment on table public.profiles is 'ข้อมูลผู้ใช้ที่แสดงผลได้ คู่กับ auth.users';

-- สร้างโปรไฟล์อัตโนมัติทุกครั้งที่มีบัญชีใหม่
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.profiles (id, email, display_name)
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();


-- ────────────────────────────────────────────────────────────────────────────
--  2. ตารางโครงการ
--     data เก็บ db0-db3 รวมกันเป็น jsonb ก้อนเดียว โครงสร้างเดิมจึงใช้ได้ทันที
--     รูป base64 ไม่อยู่ในนี้ ถูกแยกไปไว้ที่ Storage (ดูข้อ 5)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.projects (
    id         uuid primary key default gen_random_uuid(),
    name       text        not null default 'New Solar Project',
    location   text        not null default '',
    note       text        not null default '',
    owner      uuid        not null references auth.users(id) on delete cascade,
    data       jsonb       not null default '{"db0":null,"db1":null,"db2":null,"db3":null}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- เผื่อกรณีรันสคริปต์นี้ทับตารางที่สร้างไว้ก่อนจะมีสองคอลัมน์นี้
alter table public.projects add column if not exists location text not null default '';
alter table public.projects add column if not exists note     text not null default '';

create index if not exists projects_owner_idx      on public.projects(owner);
create index if not exists projects_updated_at_idx on public.projects(updated_at desc);

-- อัปเดตเวลาแก้ไขล่าสุดให้เอง ฝั่งเบราว์เซอร์จะได้ไม่ต้องส่งมา (และปลอมไม่ได้)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists projects_touch_updated_at on public.projects;
create trigger projects_touch_updated_at
    before update on public.projects
    for each row execute function public.touch_updated_at();


-- ────────────────────────────────────────────────────────────────────────────
--  3. ตารางสมาชิกของโครงการ (การเชิญ)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.project_members (
    project_id uuid        not null references public.projects(id) on delete cascade,
    user_id    uuid        not null references auth.users(id)      on delete cascade,
    role       text        not null default 'viewer' check (role in ('viewer','editor')),
    invited_by uuid                 references auth.users(id)      on delete set null,
    created_at timestamptz not null default now(),
    primary key (project_id, user_id)
);

create index if not exists project_members_user_idx on public.project_members(user_id);


-- ────────────────────────────────────────────────────────────────────────────
--  4. สิทธิ์การเข้าถึง (Row Level Security)
--
--     ข้อควรระวัง : ถ้าเขียน policy ของ projects ให้ไปอ่าน project_members
--     และ policy ของ project_members ให้ไปอ่าน projects จะเกิดการเรียกวนไม่รู้จบ
--     จึงต้องผ่านฟังก์ชัน security definer ที่ข้าม RLS ไปเลย
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
    select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.can_read_project(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.projects        where id = p and owner = auth.uid())
        or exists (select 1 from public.project_members where project_id = p and user_id = auth.uid())
        or public.is_admin();
$$;

create or replace function public.can_edit_project(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.projects        where id = p and owner = auth.uid())
        or exists (select 1 from public.project_members where project_id = p and user_id = auth.uid() and role = 'editor')
        or public.is_admin();
$$;

create or replace function public.owns_project(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.projects where id = p and owner = auth.uid())
        or public.is_admin();
$$;


alter table public.profiles        enable row level security;
alter table public.projects        enable row level security;
alter table public.project_members enable row level security;

-- ── โปรไฟล์ : ทุกคนที่ล็อกอินแล้วเห็นรายชื่อกันได้ (จำเป็นสำหรับหน้าจอเชิญเพื่อนร่วมงาน)
--    แต่แก้ไขได้เฉพาะของตัวเอง และห้ามตั้ง is_admin ให้ตัวเอง
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
    for select to authenticated using (true);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
    for update to authenticated
    using (id = auth.uid())
    with check (id = auth.uid() and is_admin = (select is_admin from public.profiles where id = auth.uid()));

-- ── โครงการ
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
    for select to authenticated using (public.can_read_project(id));

drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects
    for insert to authenticated with check (owner = auth.uid());

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
    for update to authenticated
    using (public.can_edit_project(id))
    with check (public.can_edit_project(id));

-- ลบได้เฉพาะเจ้าของกับผู้ดูแลระบบ คนที่ถูกเชิญมาแก้ไขลบไม่ได้
drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects
    for delete to authenticated using (public.owns_project(id));

-- ── สมาชิกโครงการ : เห็นได้ถ้าเข้าถึงโครงการนั้นได้ แต่เชิญ/ถอดได้เฉพาะเจ้าของ
drop policy if exists members_select on public.project_members;
create policy members_select on public.project_members
    for select to authenticated using (public.can_read_project(project_id));

drop policy if exists members_insert on public.project_members;
create policy members_insert on public.project_members
    for insert to authenticated with check (public.owns_project(project_id));

drop policy if exists members_update on public.project_members;
create policy members_update on public.project_members
    for update to authenticated
    using (public.owns_project(project_id))
    with check (public.owns_project(project_id));

drop policy if exists members_delete on public.project_members;
create policy members_delete on public.project_members
    for delete to authenticated
    using (public.owns_project(project_id) or user_id = auth.uid());  -- ออกจากโครงการเองได้


-- ────────────────────────────────────────────────────────────────────────────
--  5. ที่เก็บรูปภาพ
--     เส้นทางไฟล์ต้องเป็น  <project_id>/<ชื่อไฟล์>  เพราะ policy อ่าน
--     โฟลเดอร์ชั้นแรกเป็น project_id เพื่อตัดสินสิทธิ์
-- ────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('project-images', 'project-images', false)
on conflict (id) do nothing;

drop policy if exists images_select on storage.objects;
create policy images_select on storage.objects
    for select to authenticated
    using (bucket_id = 'project-images'
           and public.can_read_project(((storage.foldername(name))[1])::uuid));

drop policy if exists images_insert on storage.objects;
create policy images_insert on storage.objects
    for insert to authenticated
    with check (bucket_id = 'project-images'
                and public.can_edit_project(((storage.foldername(name))[1])::uuid));

drop policy if exists images_update on storage.objects;
create policy images_update on storage.objects
    for update to authenticated
    using (bucket_id = 'project-images'
           and public.can_edit_project(((storage.foldername(name))[1])::uuid));

drop policy if exists images_delete on storage.objects;
create policy images_delete on storage.objects
    for delete to authenticated
    using (bucket_id = 'project-images'
           and public.can_edit_project(((storage.foldername(name))[1])::uuid));


-- ────────────────────────────────────────────────────────────────────────────
--  6. มุมมองรวม ใช้แสดงรายการโครงการในหน้าแรกโดยไม่ต้องดึง data ทั้งก้อน
--     data ของโครงการหนึ่งอาจเป็นหลักร้อย KB ถ้าดึงมาทั้งหมดแค่เพื่อโชว์ชื่อจะเปลืองมาก
--     security_invoker ทำให้ยังบังคับ RLS ตามผู้เรียกตามปกติ
-- ────────────────────────────────────────────────────────────────────────────
create or replace view public.project_list
with (security_invoker = true) as
select p.id,
       p.name,
       p.location,
       p.note,
       p.owner,
       pr.display_name                as owner_name,
       pr.email                       as owner_email,
       p.created_at,
       p.updated_at,
       (p.owner = auth.uid())         as is_mine,
       pg_column_size(p.data)         as data_bytes,
       -- ค่าที่หน้าแรกต้องใช้ คำนวณจาก jsonb ให้เลย จะได้ไม่ต้องดึง data ทั้งก้อนมาทั้งที่ใช้แค่สองค่า
       nullif(p.data #>> '{db1,step4_validation_results,totalDcCapacity_kWp}', '')::numeric as kwp,
       (p.data ? 'db3' and jsonb_typeof(p.data -> 'db3') = 'object')  as has_report,
       (p.data ? 'db1' and jsonb_typeof(p.data -> 'db1') = 'object')  as has_design,
       (p.data ? 'db2' and jsonb_typeof(p.data -> 'db2') = 'object')  as has_params,
       (p.data ? 'db0' and jsonb_typeof(p.data -> 'db0') = 'object')  as has_load,
       (select count(*) from public.project_members m where m.project_id = p.id) as member_count,
       (select m.role  from public.project_members m
         where m.project_id = p.id and m.user_id = auth.uid())        as my_role
from public.projects p
left join public.profiles pr on pr.id = p.owner;

grant select on public.project_list to authenticated;


-- ────────────────────────────────────────────────────────────────────────────
--  7. ตั้งผู้ดูแลระบบ
--     แก้อีเมลข้างล่างเป็นอีเมลของคุณ แล้วรันบรรทัดนี้ "หลังจาก" สร้างบัญชีนั้นแล้ว
-- ────────────────────────────────────────────────────────────────────────────
-- update public.profiles set is_admin = true where email = 'ใส่อีเมลผู้ดูแลระบบที่นี่';
