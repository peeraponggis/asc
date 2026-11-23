-- ============================================================================
--  ASC · คลังอุปกรณ์สำหรับรุ่นติดตั้งในเครื่อง (ASC Studio Desktop)
--
--  ที่มา  ลุงพีสั่ง 23 พ.ย. 2569 — "ทำแบบดึงสดจากคลาวด์"
--         เดิมรุ่นเว็บ (studio/) ดึงคลัง devices เองได้ตั้งแต่ 0.196.0 ผ่าน window.AscCloud
--         แต่รุ่นติดตั้งในเครื่องไม่มีชั้นคลาวด์นั้น และไม่มีการล็อกอิน จึงยังดึงไม่ได้
--         ไฟล์นี้เปิดทางให้เครื่องที่ "ผูกบัญชีแล้ว" อ่านคลังได้ ด้วยกลไกเดียวกับ
--         device-self-service.sql คือยืนยันตัวด้วย machine_hash + secret ไม่ใช่เซสชันผู้ใช้
--
--  วิธีใช้  เปิด Supabase Dashboard > SQL Editor > New query  วางทั้งไฟล์แล้วกด Run
--          https://supabase.com/dashboard/project/rcaslesvgilknupqmwrp/sql/new
--
--  ต้องรัน devices.sql · devices-hidden-in-ascs.sql · device-self-service.sql มาก่อน
--  (ไฟล์นี้ใช้ตาราง public.devices และฟังก์ชัน public.device_user ของสองไฟล์นั้น)
--
--  รันซ้ำได้ปลอดภัย ทุกคำสั่งเป็น or replace · ไม่แตะตารางหรือ RLS ของใคร
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
--  ทำไมต้องเป็น security definer แทนการเปิด RLS ให้ anon
--
--  RLS ของ devices เปิดให้เฉพาะ authenticated ซึ่งถูกต้องแล้วสำหรับหน้าเว็บ
--  แต่รุ่นติดตั้งไม่มีผู้ใช้ล็อกอิน มีแค่ "เครื่องที่ผูกบัญชีไว้"
--  ถ้าเปิด RLS ให้ anon อ่านได้ คลังสเปกทั้งก้อนจะเปิดให้ใครก็ได้ที่มี publishable key
--  (คีย์นั้นฝังอยู่ในหน้าเว็บสาธารณะ) จึงใช้ฟังก์ชันที่ตรวจเครื่องก่อนเสมอแทน
-- ────────────────────────────────────────────────────────────────────────────

-- ตราประทับของคลัง — ถามก่อนทุกครั้งว่าแคชในเครื่องเก่าหรือยัง
-- คืนแค่จำนวนกับเวลาที่แก้ล่าสุด เครื่องที่แคชไว้แล้วจึงไม่ต้องโหลดคลังทั้งก้อนซ้ำ
create or replace function public.device_bank_stamp(p_machine_hash text, p_secret text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
    uid uuid := public.device_user(p_machine_hash, p_secret);
begin
    if uid is null then return jsonb_build_object('ok', false, 'reason', 'unlinked'); end if;
    return jsonb_build_object(
        'ok', true,
        'n',          (select count(*) from public.devices where coalesce(hidden_in_ascs, false) = false),
        'updated_at', (select coalesce(max(updated_at), 'epoch'::timestamptz) from public.devices));
end;
$$;

-- คลังทั้งก้อนสำหรับเครื่องที่ผูกบัญชีแล้ว
--
-- hidden_in_ascs  รายการที่ผู้ดูแลระบบติ๊ก "ซ่อนใน ASCS" ส่งไปด้วย แต่ติดธงไว้
--                 เพราะเครื่องปลายทางต้อง "ถอดออกจากคลังในเครื่อง" ไม่ใช่แค่ไม่เพิ่ม
--                 ถ้าไม่ส่งไปเลย ของที่เคยซิงก์ไว้ก่อนถูกซ่อนจะค้างให้เลือกตลอดไป
--
-- ตราประทับส่งกลับมาในก้อนเดียวกัน เครื่องปลายทางจะได้บันทึกคู่กับข้อมูลที่เพิ่งรับ
-- ไม่ต้องเรียกถามใหม่แล้วเสี่ยงได้ค่าที่เปลี่ยนไประหว่างสองคำขอ
create or replace function public.device_bank(p_machine_hash text, p_secret text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
    uid uuid := public.device_user(p_machine_hash, p_secret);
begin
    if uid is null then return jsonb_build_object('ok', false, 'reason', 'unlinked'); end if;
    return jsonb_build_object(
        'ok', true,
        'n',          (select count(*) from public.devices where coalesce(hidden_in_ascs, false) = false),
        'updated_at', (select coalesce(max(updated_at), 'epoch'::timestamptz) from public.devices),
        'devices', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'category',       d.category,
                       'brand',          d.brand,
                       'model',          d.model,
                       'subtype',        d.subtype,
                       'spec',           d.spec,
                       'hidden_in_ascs', coalesce(d.hidden_in_ascs, false),
                       'updated_at',     d.updated_at)
                   order by d.category, d.brand, d.model)
              from public.devices d), '[]'::jsonb));
end;
$$;

-- เครื่องที่ผูกแล้วเรียกผ่าน publishable key (บทบาท anon) จึงต้องให้สิทธิ์ anon
-- และถอนจาก public/authenticated เพื่อไม่ให้มีทางเข้าสองทางที่ตรวจคนละแบบ
revoke all on function public.device_bank_stamp(text, text) from public, authenticated;
revoke all on function public.device_bank(text, text)       from public, authenticated;
grant execute on function public.device_bank_stamp(text, text) to anon;
grant execute on function public.device_bank(text, text)       to anon;
