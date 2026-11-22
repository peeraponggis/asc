-- ============================================================================
--  ProInventive ASC Enterprise — ผู้ดูแลระบบดู/ถอดเครื่องที่ผูกกับบัญชีได้ (22 พ.ย. 2569 · ลุงพีสั่ง)
--  ----------------------------------------------------------------------------
--  เดิม: ถอดเครื่องที่ผูกไว้ได้เฉพาะจากหน้า ASC Studio ของเจ้าของบัญชีเอง (ผู้ช่วย AI › ติดตั้งในเครื่องนี้)
--        ผู้ดูแลระบบมองไม่เห็นว่าใครผูกเครื่องอะไรไว้บ้าง และช่วยถอดให้ไม่ได้ (เช่น เครื่องเสีย · พนักงานลาออก)
--  ใหม่: Settings › ผู้ใช้และสิทธิ์ › ปุ่ม "เครื่อง" ของแต่ละบัญชี → รายการเครื่อง + ปุ่มถอด
--  ----------------------------------------------------------------------------
--  วิธีใช้ : Supabase Dashboard (โปรเจกต์ ASC Cloud rcaslesvgilknupqmwrp) > SQL Editor > New query > วางทั้งไฟล์ > Run
--            https://supabase.com/dashboard/project/rcaslesvgilknupqmwrp/sql/new
--            รันซ้ำได้ ไม่พัง · ต้องรัน ai-install.sql · access-control.sql · presence.sql มาก่อน
--  ความเป็นส่วนตัว : คืนเฉพาะ ชื่อเครื่อง · 8 ตัวแรกของแฮชเครื่อง · เวลาติดตั้ง/ถอด/ใช้ล่าสุด — ไม่มีรหัสลับเครื่อง
-- ============================================================================

-- ── รายการเครื่องที่ผูกกับบัญชีหนึ่ง (ผู้ดูแลระบบเท่านั้น) ────────────────────
create or replace function public.admin_device_list(p_email text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
    mail text := lower(trim(coalesce(p_email, '')));
    uid  uuid;
begin
    perform public._access_admin_only();
    select id into uid from public.profiles where lower(email) = mail limit 1;
    if uid is null then return '[]'::jsonb; end if;
    return coalesce((
        select jsonb_agg(jsonb_build_object(
                   'id', i.id,
                   'name', nullif(i.machine_name, ''),
                   'hash8', left(i.machine_hash, 8),
                   'installedAt', i.installed_at,
                   'revokedAt', i.revoked_at,
                   'lastSeen', (select max(s.last_seen) from public.app_presence s
                                 where s.user_id = i.user_id and s.instance = 'd:' || left(i.machine_hash, 24))
               ) order by i.revoked_at nulls first, i.installed_at desc)
          from public.ai_installs i where i.user_id = uid), '[]'::jsonb);
exception when undefined_table or undefined_column then                -- ยังไม่มีตาราง presence = ไม่ต้องมีใช้ล่าสุด
    return coalesce((
        select jsonb_agg(jsonb_build_object('id', i.id, 'name', nullif(i.machine_name, ''), 'hash8', left(i.machine_hash, 8),
                                            'installedAt', i.installed_at, 'revokedAt', i.revoked_at)
               order by i.revoked_at nulls first, i.installed_at desc)
          from public.ai_installs i where i.user_id = uid), '[]'::jsonb);
end;
$$;
revoke all on function public.admin_device_list(text) from public, anon;
grant execute on function public.admin_device_list(text) to authenticated;


-- ── ถอดเครื่องหนึ่งออกจากบัญชี (ผู้ดูแลระบบเท่านั้น · ไม่ลบประวัติ) ──────────────
--  เครื่องที่ถูกถอดจะใช้ไม่ได้ทันทีที่ตรวจสิทธิ์รอบถัดไป · ผูกใหม่ได้ด้วยรหัสติดตั้งใหม่
create or replace function public.admin_revoke_device(p_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
    mail text;
    nm   text;
begin
    perform public._access_admin_only();
    update public.ai_installs set revoked_at = now() where id = p_id and revoked_at is null
        returning machine_name into nm;
    if not found then return jsonb_build_object('ok', false, 'error', 'ไม่พบเครื่องนี้ หรือถอดไปแล้ว'); end if;
    select lower(u.email) into mail from auth.users u
      join public.ai_installs i on i.user_id = u.id where i.id = p_id;
    delete from public.access_sessions s
     where s.email = mail
       and s.instance = 'd:' || left(lower((select machine_hash from public.ai_installs where id = p_id)), 24);
    insert into public.access_log (actor, email, action, detail)
    values (auth.uid(), coalesce(mail, ''), 'revoke_device', jsonb_build_object('install', p_id, 'machine', nm));
    return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.admin_revoke_device(uuid) from public, anon;
grant execute on function public.admin_revoke_device(uuid) to authenticated;

-- ตรวจผล (ผู้ดูแลระบบรันได้):
--   select public.admin_device_list('someone@example.com');
