-- ============================================================================
--  Pi monitor ขั้น 4 (ฝั่ง ASC) — สถานะการใช้งานของรุ่น desktop (ASCS · ASCA ที่รันในเครื่อง)
--  (ลุงพีเลือก 1 พ.ย. 2569: "ผูกเครื่องด้วยรหัส" ใช้ระบบเดียวกับรหัสติดตั้งผู้ช่วย AI)
--  ----------------------------------------------------------------------------
--  วิธีใช้ : Supabase Dashboard (โปรเจกต์ ASC Cloud) > SQL Editor > New query > วางทั้งไฟล์ > Run  (รันซ้ำได้ ไม่พัง)
--            ต้องรัน presence.sql · presence-ingest.sql · ai-install.sql มาก่อน
--
--  รุ่น desktop ไม่มีการล็อกอิน → รู้ตัวผู้ใช้จาก "เครื่องที่ผูกกับบัญชี" ในตาราง ai_installs (ตารางเดียวกับผู้ช่วย AI)
--    · ผูกครั้งเดียวต่อเครื่อง: ผู้ใช้สร้างรหัสในเว็บ (ascs › ผู้ช่วย AI › ติดตั้งในเครื่องนี้ › สร้างรหัส)
--      แล้วใส่ในโปรแกรม desktop → redeem_ai_install_code() เดิม (นับรวม 2 เครื่องต่อบัญชี)
--    · เครื่องที่ติดตั้งผู้ช่วย AI แล้ว = ผูกอยู่แล้ว (เซิร์ฟเวอร์ในเครื่องอ่าน state.json ของชุด AI)
--  เซิร์ฟเวอร์ในเครื่อง (asc_link.py) เรียก presence_device_ping() ด้วยแฮชเครื่อง + รหัสลับเครื่อง — หน้าเว็บไม่เห็นรหัสลับ
--  แถว desktop: session_id ขึ้นต้น 'd:' · platform = 'desktop' · source = 'desktop' · ใช้ในรายงาน Telegram เหมือนแถวอื่น
-- ============================================================================

-- ผู้ใช้ของเครื่องที่ผูกไว้ (ตรวจรหัสลับ) · ใช้ภายในเท่านั้น
create or replace function public.device_user(p_machine_hash text, p_secret text)
returns uuid language sql stable security definer set search_path = public as $$
    select i.user_id from public.ai_installs i
     where i.machine_hash = lower(trim(coalesce(p_machine_hash, '')))
       and i.secret_hash  = md5(coalesce(p_secret, ''))
       and i.revoked_at is null
     order by i.installed_at desc
     limit 1;
$$;
revoke all on function public.device_user(text, text) from public, anon, authenticated;

-- โปรแกรม desktop ถามว่าเครื่องนี้ผูกกับใคร (แสดงในโปรแกรม) · ผิด/ถูกยกเลิก = null
create or replace function public.presence_device_whoami(p_machine_hash text, p_secret text)
returns text language sql stable security definer set search_path = public as $$
    select lower(u.email) from auth.users u where u.id = public.device_user(p_machine_hash, p_secret);
$$;
revoke all on function public.presence_device_whoami(text, text) from public, authenticated;
grant execute on function public.presence_device_whoami(text, text) to anon;

create or replace function public.presence_device_ping(
    p_machine_hash text,
    p_secret       text,
    p_session      text,
    p_app          text,
    p_version      text    default '',
    p_page         text    default '',
    p_active       boolean default true,
    p_closed       boolean default false
) returns text language plpgsql volatile security definer set search_path = public as $$
declare
    uid    uuid := public.device_user(p_machine_hash, p_secret);
    mail   text;
    domain text := (select email_domain from public.monitor_settings where id = 1);
    sid    text := left('d:' || coalesce(p_session, ''), 64);
begin
    if uid is null then return 'unlinked'; end if;                -- ไม่ได้ผูก/รหัสลับผิด/ถูกยกเลิก
    if length(sid) < 10 then raise exception 'รหัสหน้าต่างไม่ถูกต้อง'; end if;
    select lower(u.email) into mail from auth.users u where u.id = uid;
    if mail is null or mail not like '%@' || coalesce(domain, 'proinventive.co.th') then return 'skip'; end if;

    insert into public.app_presence as p
        (session_id, user_id, email, app, platform, version, page, last_seen, last_active, closed_at, source)
    values
        (sid, uid, mail, upper(p_app), 'desktop', left(coalesce(p_version, ''), 24), left(coalesce(p_page, ''), 80),
         now(), now(), case when p_closed then now() end, 'desktop')
    on conflict (session_id) do update set
        app = excluded.app, version = excluded.version, page = excluded.page, last_seen = now(),
        last_active = case when p_active then now() else p.last_active end,
        closed_at   = case when p_closed then now() else null end
    where p.user_id = uid and p.source = 'desktop';
    return 'ok';
end;
$$;
revoke all on function public.presence_device_ping(text, text, text, text, text, text, boolean, boolean) from public, authenticated;
grant execute on function public.presence_device_ping(text, text, text, text, text, text, boolean, boolean) to anon;  -- ด่านจริงคือแฮชเครื่อง + รหัสลับ
