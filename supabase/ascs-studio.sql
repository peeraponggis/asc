-- ============================================================================
--  ASC Studio (ascs) ใต้ ASC Cloud — ตารางมาตรฐาน วสท. สำหรับรุ่นคลาวด์
--  ----------------------------------------------------------------------------
--  วิธีใช้ : Supabase Dashboard > SQL Editor > New query > วางทั้งไฟล์ > Run  (รันซ้ำได้ ไม่พัง)
--  แล้วรันไฟล์ข้อมูลตาราง  out/cloud/standards-data.sql  ที่สร้างในเครื่องด้วย
--      npm run standards:sql      (ใน repo design-auto)
--  ไฟล์ข้อมูลไม่อยู่ใน git เพราะตาราง วสท. มีลิขสิทธิ์
--
--  ทำไมต้องเก็บบนคลาวด์
--    เว็บ GitHub Pages เปิดให้ทุกคนโหลดไฟล์ได้ แม้ repo เป็น private
--    ascs รุ่นคลาวด์จึงไม่ฝังตาราง วสท. ไว้ในโปรแกรม (ตรวจด้วย npm run check:public)
--    แต่อ่านจากตารางนี้หลังล็อกอิน — คนที่ไม่ได้ล็อกอินอ่านไม่ได้
--
--  ไม่ต้องแก้ตาราง projects หรือมุมมอง project_list
--    งาน ascs เก็บใน projects.data = { format:'ascs', ascs:{...}, db1:{ step4_validation_results:{ totalDcCapacity_kWp } } }
--    Dashboard จึงนับ kWp งานเก่า + งาน ascs ได้ด้วยมุมมองเดิม
-- ============================================================================

create table if not exists public.standards_tables (
    key         text        primary key,          -- ชื่อช่องใน StandardTableCsvSet ของ engine (+ 'gec' ตาราง 4-1)
    csv         text        not null,             -- เนื้อไฟล์ CSV จาก digitize-kit
    sha256      text        not null default '',
    source_file text        not null default '',
    version     text        not null default '',  -- รุ่น ascs ที่สร้างไฟล์ข้อมูล
    updated_at  timestamptz not null default now()
);

alter table public.standards_tables enable row level security;

-- อ่านได้เฉพาะผู้ที่ล็อกอิน (ไม่ให้ anon) · เพิ่ม/แก้/ลบได้เฉพาะผู้ดูแลระบบ
drop policy if exists standards_select on public.standards_tables;
create policy standards_select on public.standards_tables
    for select to authenticated using (true);

drop policy if exists standards_write on public.standards_tables;
create policy standards_write on public.standards_tables
    for all to authenticated
    using (public.is_admin()) with check (public.is_admin());

revoke all on public.standards_tables from anon;
grant select on public.standards_tables to authenticated;

-- ตรวจผลหลังรันไฟล์ข้อมูล: ต้องได้ 21 แถว
-- select key, length(csv) as bytes, version, updated_at from public.standards_tables order by key;
