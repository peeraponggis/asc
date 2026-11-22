-- ============================================================================
--  ProInventive ASC Enterprise — โปรแกรมในเครื่องดูและจัดการเครื่องของบัญชีตัวเองได้ (22 พ.ย. 2569 · ลุงพีสั่ง)
--  ----------------------------------------------------------------------------
--  เดิม: โปรแกรมในเครื่อง (ASC Architect · ASC Studio) รู้แค่ว่าผูกกับอีเมลอะไร
--        ถ้าผูกครบจำนวนเครื่องของแพ็กเกจแล้ว ต้องไปปลดเครื่องเก่าที่หน้าเว็บ ASC Studio เท่านั้น
--  ใหม่: หน้าต่าง "บัญชีและเครื่อง" ในโปรแกรม แสดงเครื่องทั้งหมดของบัญชีเดียวกัน + ปลดเครื่องที่ไม่ใช้แล้วได้เลย
--        ยืนยันตัวด้วยแฮชเครื่อง + รหัสลับของเครื่องนี้ (ที่ได้ตอนผูก) ไม่ต้องล็อกอิน
--  ----------------------------------------------------------------------------
--  วิธีใช้ : Supabase Dashboard (โปรเจกต์ ASC Cloud rcaslesvgilknupqmwrp) > SQL Editor > New query > วางทั้งไฟล์ > Run
--            https://supabase.com/dashboard/project/rcaslesvgilknupqmwrp/sql/new
--            รันซ้ำได้ ไม่พัง · ต้องรัน ai-install.sql · presence-device.sql มาก่อน
--  ความเป็นส่วนตัว : คืนเฉพาะ ชื่อเครื่อง · 8 ตัวแรกของแฮช · เวลาติดตั้ง/ถอด — ไม่มีรหัสลับของเครื่องอื่น
-- ============================================================================

-- ── เครื่องทั้งหมดของบัญชีที่เครื่องนี้ผูกอยู่ ────────────────────────────────
create or replace function public.device_my_installs(p_machine_hash text, p_secret text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
    uid uuid := public.device_user(p_machine_hash, p_secret);
    me  text := lower(trim(coalesce(p_machine_hash, '')));
begin
    if uid is null then return jsonb_build_object('ok', false, 'reason', 'unlinked'); end if;
    return jsonb_build_object(
        'ok', true,
        'email', (select lower(u.email) from auth.users u where u.id = uid),
        'devices', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'id', i.id, 'name', nullif(i.machine_name, ''), 'hash8', left(i.machine_hash, 8),
                       'installedAt', i.installed_at, 'revokedAt', i.revoked_at,
                       'thisOne', i.machine_hash = me)
                   order by i.revoked_at nulls first, i.installed_at desc)
              from public.ai_installs i where i.user_id = uid), '[]'::jsonb));
end;
$$;
revoke all on function public.device_my_installs(text, text) from public, authenticated;
grant execute on function public.device_my_installs(text, text) to anon;


-- ── ปลดเครื่องเครื่องหนึ่งของบัญชีเดียวกัน (เครื่องนี้ยืนยันตัวด้วยรหัสลับของตัวเอง) ──
create or replace function public.device_revoke_install(p_machine_hash text, p_secret text, p_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
    uid  uuid := public.device_user(p_machine_hash, p_secret);
    mail text;
    tgt  public.ai_installs;
begin
    if uid is null then return jsonb_build_object('ok', false, 'error', 'เครื่องนี้ยังไม่ได้ผูกกับบัญชี'); end if;
    select * into tgt from public.ai_installs where id = p_id and user_id = uid;    -- เฉพาะเครื่องในบัญชีเดียวกัน
    if not found then return jsonb_build_object('ok', false, 'error', 'ไม่พบเครื่องนี้ในบัญชี'); end if;
    if tgt.revoked_at is not null then return jsonb_build_object('ok', false, 'error', 'เครื่องนี้ถูกปลดไปแล้ว'); end if;

    update public.ai_installs set revoked_at = now() where id = p_id;
    select lower(u.email) into mail from auth.users u where u.id = uid;
    delete from public.access_sessions s
     where s.email = mail and s.instance = 'd:' || left(lower(tgt.machine_hash), 24);
    begin
        insert into public.access_log (actor, email, action, detail)
        values (null, coalesce(mail, ''), 'revoke_device',
                jsonb_build_object('install', p_id, 'machine', tgt.machine_name, 'by', 'device'));
    exception when undefined_table then
        null;                                                    -- ยังไม่ได้รัน access-control.sql = ไม่ต้องบันทึก
    end;
    return jsonb_build_object('ok', true, 'self', tgt.machine_hash = lower(trim(coalesce(p_machine_hash, ''))));
end;
$$;
revoke all on function public.device_revoke_install(text, text, uuid) from public, authenticated;
grant execute on function public.device_revoke_install(text, text, uuid) to anon;

-- ตรวจผล: select public.device_my_installs('<แฮชเครื่อง>', '<รหัสลับ>');
