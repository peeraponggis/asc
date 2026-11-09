-- devices-hidden-in-ascs.sql — ช่องติ๊ก "ซ่อนใน ASCS" ในคลังสเปกอุปกรณ์ของ ASC Cloud (ลุงพีสั่ง 8–9 พ.ย. 2569)
--   รายการที่ติ๊กยังอยู่ในคลัง (ไม่ลบ) แต่หน้าออกแบบ/ASC Studio ไม่แสดงให้เลือก
--   รันซ้ำได้ · รันหลัง devices.sql
--   SQL Editor: https://supabase.com/dashboard/project/rcaslesvgilknupqmwrp/sql/new

alter table public.devices add column if not exists hidden_in_ascs boolean not null default false;
create index if not exists devices_hidden on public.devices (hidden_in_ascs);
-- devices_stamp เดิมใช้ max(updated_at) → ตอนติ๊กเราอัปเดต updated_at ด้วย แคชในเครื่องจึงรู้ว่าเปลี่ยน (ไม่ต้องแก้ฟังก์ชัน)
