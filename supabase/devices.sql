-- ============================================================================
--  ASC · ตาราง devices (คลังสเปกอุปกรณ์)
--
--  ไฟล์นี้คือหัวข้อ 8 ของ supabase/schema.sql แยกออกมาให้รันเดี่ยว ๆ ได้
--  สำหรับโปรเจกต์ที่ตั้งค่าตารางอื่นไปแล้วและต้องการเพิ่มเฉพาะคลังอุปกรณ์
--
--  วิธีใช้  เปิด Supabase Dashboard > SQL Editor > New query
--          วางทั้งไฟล์นี้ แล้วกด Run
--
--  รันซ้ำได้ปลอดภัย ทุกคำสั่งเป็น if not exists / or replace
--  ไม่แตะตาราง profiles · projects · project_members · allowed_emails
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
--  8. คลังสเปกอุปกรณ์ (devices)
--
--     เดิมวิศวกรต้องหาไฟล์ดาต้าชีต .txt ในเครื่องมาอัปโหลดใหม่ทุกโครงการ
--     ทีละชิ้น (PV / INV1 / INV2 / BAT / OPT / EV) ตารางนี้ย้ายคลังขึ้นมาไว้
--     ที่เดียว ให้หน้าออกแบบเลือกเป็น ยี่ห้อ > รุ่น แทนการเปิดหาไฟล์
--
--     spec เก็บเป็น jsonb ของค่าที่แยกจากไฟล์ดาต้าชีตแล้ว โดยใช้ตัวแยกไฟล์
--     ตัวเดียวกับที่หน้าออกแบบใช้ (parseEquipmentText) จึงได้ชื่อคีย์ชุดเดียวกัน
--     กับที่ไหลลง DB2 อยู่แล้ว ไม่ต้องแปลงอะไรอีก
--
--     ทุกคนที่ล็อกอินอ่านได้ แต่เพิ่ม/แก้/ลบได้เฉพาะผู้ดูแลระบบ
--     เพราะสเปกที่ผิดจะไหลไปโผล่ในเอกสารที่ส่งลูกค้าซึ่งมีผลผูกพัน
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.devices (
    id          uuid        primary key default gen_random_uuid(),
    -- PV | INV | ESS | OPT | EV  (ตรงกับโฟลเดอร์ในคลังดาต้าชีต)
    category    text        not null check (category in ('PV','INV','ESS','OPT','EV')),
    brand       text        not null,
    model       text        not null,
    -- อินเวอร์เตอร์แยก HYB (ไฮบริด) กับ STR (สตริง) ประเภทอื่นเว้นว่าง
    subtype     text        not null default '',
    spec        jsonb       not null,
    source_file text        not null default '',
    updated_at  timestamptz not null default now(),
    updated_by  uuid        references auth.users(id) on delete set null
);

-- นำเข้าไฟล์เดิมซ้ำให้ทับของเก่า ไม่ใช่เพิ่มรุ่นซ้ำ
create unique index if not exists devices_key
    on public.devices (category, brand, model, subtype);

-- ตัวเลือกยี่ห้อ > รุ่น เรียงตามนี้เสมอ
create index if not exists devices_browse
    on public.devices (category, brand, model);

alter table public.devices enable row level security;

drop policy if exists devices_select on public.devices;
create policy devices_select on public.devices
    for select to authenticated using (true);

drop policy if exists devices_write on public.devices;
create policy devices_write on public.devices
    for all to authenticated
    using (public.is_admin()) with check (public.is_admin());

-- ตราประทับของคลัง ใช้เช็คว่าแคชในเครื่องเก่าไปหรือยัง
-- คืนแค่จำนวนรายการกับเวลาที่แก้ล่าสุด ไม่ต้องดึงทั้งคลังมานับเอง
create or replace function public.devices_stamp()
returns jsonb language sql stable security invoker set search_path = public as $$
    select jsonb_build_object(
        'n',          (select count(*) from public.devices),
        'updated_at', (select coalesce(max(updated_at), 'epoch'::timestamptz) from public.devices)
    );
$$;

-- ฟังก์ชันใน PostgreSQL ให้สิทธิ์ PUBLIC มาแต่แรก ต้องถอนก่อนแล้วค่อยให้เฉพาะผู้ที่ล็อกอิน
-- ถ้าไม่ถอน ผู้ที่ยังไม่ล็อกอินจะเรียกได้และได้ผลว่า "0 รายการ" ซึ่งแยกไม่ออกจากคลังว่างจริง
-- หน้าจอจะรายงานผิดว่าคลังไม่มีของ ทั้งที่จริงคือไม่มีสิทธิ์เห็น
revoke execute on function public.devices_stamp() from public;
revoke execute on function public.devices_stamp() from anon;
grant  execute on function public.devices_stamp() to authenticated;
