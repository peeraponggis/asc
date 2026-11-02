-- ============================================================================
--  Pi monitor — ทะเบียนโปรแกรมที่รายงานสถานะได้ (ลุงพีสั่ง 2 พ.ย. 2569: เพิ่ม Project Plan)
--  ----------------------------------------------------------------------------
--  วิธีใช้ : Supabase Dashboard (โปรเจกต์ ASC Cloud rcaslesvgilknupqmwrp) > SQL Editor > New query
--            https://supabase.com/dashboard/project/rcaslesvgilknupqmwrp/sql/new
--            วางทั้งไฟล์ > Run  (รันซ้ำได้ ไม่พัง) · ต้องรัน presence.sql มาก่อน
--
--  เดิมตาราง app_presence รับได้แค่ ASCS / ASCA / PI (ตายตัวในเงื่อนไขของคอลัมน์)
--  ไฟล์นี้เปลี่ยนเป็น "ทะเบียน" presence_apps — โปรแกรมใหม่ = เพิ่มหนึ่งบรรทัดในวงเล็บข้างล่างแล้วรันไฟล์นี้อีกครั้ง
--  (หน้าเว็บของโปรแกรมนั้นต้องโหลด asc-cloud.js และอยู่โดเมน peeraponggis.github.io เพื่อใช้การล็อกอินของ ASC Enterprise)
--  หน้า Pi monitor อ่านชื่อโปรแกรมจากตารางนี้ไปใส่ตัวกรอง "ทุกโปรแกรม" เอง
-- ============================================================================

create table if not exists public.presence_apps (
    code     text        primary key check (code = upper(code) and length(code) between 2 and 12),
    label    text        not null,
    added_at timestamptz not null default now()
);
alter table public.presence_apps enable row level security;
drop policy if exists presence_apps_select on public.presence_apps;
create policy presence_apps_select on public.presence_apps for select to authenticated using (true);
revoke all on public.presence_apps from anon, authenticated;
grant select on public.presence_apps to authenticated;

-- ทะเบียน (รหัส = ค่าที่หน้าเว็บส่งมา · ชื่อ = ที่แสดงใน Pi monitor)
insert into public.presence_apps (code, label) values
    ('ASCS', 'ASC Studio'),
    ('ASCA', 'ASC Architect'),
    ('PI',   'Pi-System'),
    ('PLAN', 'Project Plan')
on conflict (code) do update set label = excluded.label;

-- เงื่อนไขเดิม (app in ('ASCS','ASCA','PI')) → อ้างอิงทะเบียนแทน
do $$
declare c record;
begin
    for c in select conname from pg_constraint
              where conrelid = 'public.app_presence'::regclass and contype = 'c'
                and pg_get_constraintdef(oid) like '%ASCS%'
    loop
        execute format('alter table public.app_presence drop constraint %I', c.conname);
    end loop;
    if not exists (select 1 from pg_constraint where conrelid = 'public.app_presence'::regclass and conname = 'app_presence_app_fkey') then
        alter table public.app_presence add constraint app_presence_app_fkey foreign key (app) references public.presence_apps (code);
    end if;
end $$;

-- ผลหลังรัน: ทะเบียน + จำนวนแท็บที่เคยรายงานของแต่ละโปรแกรม
select a.code as รหัส, a.label as โปรแกรม, count(p.session_id) as จำนวนแท็บที่รายงาน
  from public.presence_apps a
  left join public.app_presence p on p.app = a.code
 group by a.code, a.label
 order by a.code;
