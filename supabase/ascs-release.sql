-- ascs-release.sql — กุญแจถอดรหัสชุดติดตั้ง ASC Studio บนเว็บ (ASC Studio 0.162.0 · โดย ลุงพี)
-- ชุดติดตั้ง/ชุดอัปเดตบน /asc/ascs-release/ เข้ารหัส AES-256-GCM · หน้า ASC Studio รุ่นเว็บอ่านกุญแจจากตารางนี้หลังล็อกอิน แล้วถอดรหัสในเบราว์เซอร์
-- อ่านได้เฉพาะผู้ที่ล็อกอิน · เพิ่ม/แก้ได้เฉพาะผู้ดูแลระบบ · ห้ามใส่ค่ากุญแจในไฟล์นี้ (ไฟล์อยู่ใน git สาธารณะ)
-- ค่ากุญแจ: รันไฟล์ out\cloud\ascs-release-key.sql ที่ build-setup.ps1 สร้างบนเครื่องผู้พัฒนา (นอก git) ต่อจากไฟล์นี้

create table if not exists public.app_release_keys (
    app        text        primary key,              -- 'ascs' = ASC Studio
    key        text        not null,
    updated_at timestamptz not null default now()
);

alter table public.app_release_keys enable row level security;

drop policy if exists release_keys_select on public.app_release_keys;
create policy release_keys_select on public.app_release_keys
    for select to authenticated using (true);

drop policy if exists release_keys_write on public.app_release_keys;
create policy release_keys_write on public.app_release_keys
    for all to authenticated
    using (public.is_admin()) with check (public.is_admin());

revoke all on public.app_release_keys from anon;
grant select on public.app_release_keys to authenticated;

-- ตรวจ: ต้องได้ 1 แถว (app = ascs) หลังรันไฟล์กุญแจ
-- select app, length(key) as len, updated_at from public.app_release_keys;
