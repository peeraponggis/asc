-- ============================================================================
--  ฐานความรู้ผู้ช่วย AI ของ ASC Studio (ascs) — แผน design-auto\docs\ai-knowledge-plan.md (K4)
--  ----------------------------------------------------------------------------
--  วิธีใช้ : Supabase Dashboard (โปรเจกต์ ASC Cloud) > SQL Editor > New query > วางทั้งไฟล์ > Run  (ครั้งแรกครั้งเดียว · รันซ้ำได้)
--  จากนั้นทุกครั้งที่ผู้พัฒนาอัปเดตความรู้: ใน design-auto รัน  npm run kb:sql
--    แล้วรันไฟล์ที่ได้  <ไดรฟ์>\LocalAI\aiSolar\design-auto\out\cloud\kb-data.sql  ใน SQL Editor
--
--  ascs รุ่นเว็บอ่านเลขรุ่นก่อน (เล็ก) · เปลี่ยน = โหลดฐานใหม่ · ไม่เปลี่ยน = ใช้ที่เก็บในเบราว์เซอร์
--  อ่านได้เฉพาะผู้ที่ล็อกอิน (ไม่วางฐานความรู้ในไฟล์เว็บสาธารณะ) · เขียนได้เฉพาะแอดมิน
-- ============================================================================

create table if not exists public.kb_store (
    id         text        primary key,              -- 'main'
    version    text        not null,                 -- <รุ่น ascs>+<แฮชเนื้อหา>
    json       text        not null,                 -- { version, built, chunks[] } จาก npm run kb:build
    updated_at timestamptz not null default now()
);

alter table public.kb_store enable row level security;

drop policy if exists kb_store_select on public.kb_store;
create policy kb_store_select on public.kb_store
    for select to authenticated using (true);

drop policy if exists kb_store_write on public.kb_store;
create policy kb_store_write on public.kb_store
    for all to authenticated
    using (public.is_admin()) with check (public.is_admin());

revoke all on public.kb_store from anon;
grant select on public.kb_store to authenticated;

-- ตรวจหลังรันไฟล์ข้อมูล: select id, version, length(json), updated_at from public.kb_store;
