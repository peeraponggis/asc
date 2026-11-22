-- ============================================================================
--  ProInventive ASC Enterprise — จำนวนเครื่องที่ผูกบัญชีได้ ให้ใช้ตัวเลขเดียวกับแพ็กเกจ (22 พ.ย. 2569 · ลุงพีสั่ง)
--  ----------------------------------------------------------------------------
--  ปัญหาเดิม: มีจำนวนเครื่อง 2 ชุดที่ไม่ผูกกัน
--    · ai_installs — ผูกเครื่องกับบัญชี (ผู้ช่วย AI · ASC Studio · ASC Architect) ตรึงไว้ที่ 2 เครื่องในโค้ด
--    · access_packages.max_devices — จำนวนเครื่องที่ใช้พร้อมกันได้ตามแพ็กเกจ (trial/training/starter 1 · pro 2 · company 5)
--  ผล: บัญชี Company ซื้อสิทธิ์ 5 เครื่อง แต่ผูกเครื่องได้แค่ 2 · บัญชี Starter สิทธิ์ 1 เครื่อง กลับผูกได้ 2
--  แก้: จำนวนเครื่องที่ผูกได้ = max_devices ของแพ็กเกจ (ผู้ดูแลระบบ/โดเมนบริษัท = 99 เท่ากับไม่จำกัด)
--  ----------------------------------------------------------------------------
--  วิธีใช้ : Supabase Dashboard (โปรเจกต์ ASC Cloud rcaslesvgilknupqmwrp) > SQL Editor > New query > วางทั้งไฟล์ > Run
--            https://supabase.com/dashboard/project/rcaslesvgilknupqmwrp/sql/new
--            รันซ้ำได้ ไม่พัง · ต้องรัน ai-install.sql และ access-control.sql มาก่อน
--  หมายเหตุ : ยังไม่รัน access-control.sql = ฟังก์ชันคืนค่าเดิม 2 เครื่อง (ไม่พัง)
--             เครื่องที่ผูกไว้แล้วเกินจำนวนใหม่ ไม่ถูกถอดออกเอง — ผูกเครื่องใหม่เพิ่มไม่ได้จนกว่าจะยกเลิกเครื่องเก่า
-- ============================================================================

-- ── จำนวนเครื่องที่บัญชีนี้ผูกได้ (ผู้ดูแล/โดเมนบริษัท = 99 เท่ากับไม่จำกัด) ──────────
create or replace function public.ai_max_machines(p_user uuid)
returns int language plpgsql stable security definer set search_path = public as $$
declare
    mail text;
    adm  boolean;
    core jsonb;
begin
    select lower(email), coalesce(is_admin, false) into mail, adm from public.profiles where id = p_user;
    if mail is null then return 2; end if;                       -- ไม่รู้จักบัญชี = ค่าเดิม
    begin
        core := public._access_core(mail, adm);
    exception when others then
        return 2;                                                -- ยังไม่ได้รัน access-control.sql = ค่าเดิม
    end;
    -- ผู้ดูแลระบบ/โดเมนบริษัท = เท่ากับไม่จำกัด (ใช้เลขสูง ๆ แทน null เพื่อให้หน้าเว็บเดิมที่แสดง "x / max" ไม่เพี้ยน)
    if coalesce((core->>'exempt')::boolean, false) then return 99; end if;
    return greatest(coalesce((core->>'maxDevices')::int, 1), 1);
end;
$$;
revoke all on function public.ai_max_machines(uuid) from public, anon, authenticated;


-- ── 1) สร้างรหัสติดตั้ง — บอกจำนวนเครื่องตามแพ็กเกจ ────────────────────────
create or replace function public.create_ai_install_code()
returns json language plpgsql volatile security definer set search_path = public as $$
declare
    uid uuid := auth.uid();
    c text;
    exp timestamptz;
    n int;
    mx int;
begin
    if uid is null then raise exception 'ต้องเข้าสู่ระบบก่อน'; end if;
    delete from public.ai_install_codes where user_id = uid and used_at is null and expires_at < now();
    delete from public.ai_install_codes where code in (
        select code from public.ai_install_codes where user_id = uid and used_at is null
        order by created_at desc offset 2);
    loop
        c := public.ai_random_code();
        exit when not exists (select 1 from public.ai_install_codes where code = c);
    end loop;
    insert into public.ai_install_codes (code, user_id) values (c, uid) returning expires_at into exp;
    select count(*) into n from public.ai_installs where user_id = uid and revoked_at is null;
    mx := public.ai_max_machines(uid);
    return json_build_object('code', c, 'expires_at', exp, 'machines', n, 'max_machines', mx);
end;
$$;
revoke all on function public.create_ai_install_code() from public, anon;
grant execute on function public.create_ai_install_code() to authenticated;


-- ── 2) แลกรหัส — ตรวจจำนวนเครื่องตามแพ็กเกจ ──────────────────────────────
create or replace function public.redeem_ai_install_code(p_code text, p_machine_hash text, p_machine_name text)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
    k text := upper(trim(coalesce(p_code, '')));
    h text := lower(trim(coalesce(p_machine_hash, '')));
    r public.ai_install_codes%rowtype;
    existing public.ai_installs%rowtype;
    n int;
    mx int;
    secret text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
    if h !~ '^[0-9a-f]{64}$' then return json_build_object('ok', false, 'error', 'ข้อมูลเครื่องไม่ถูกต้อง'); end if;
    select * into r from public.ai_install_codes where code = k for update;
    if not found then return json_build_object('ok', false, 'error', 'รหัสติดตั้งไม่ถูกต้อง'); end if;
    if r.used_at is not null then return json_build_object('ok', false, 'error', 'รหัสนี้ถูกใช้ไปแล้ว — สร้างรหัสใหม่ในหน้า ascs'); end if;
    if r.expires_at < now() then return json_build_object('ok', false, 'error', 'รหัสหมดอายุแล้ว (30 นาที) — สร้างรหัสใหม่ในหน้า ascs'); end if;

    mx := public.ai_max_machines(r.user_id);
    select * into existing from public.ai_installs where user_id = r.user_id and machine_hash = h;
    if not found or existing.revoked_at is not null then
        select count(*) into n from public.ai_installs where user_id = r.user_id and revoked_at is null;
        if n >= mx then
            return json_build_object('ok', false, 'error',
                'แพ็กเกจของบัญชีนี้ผูกได้ ' || mx || ' เครื่อง และผูกครบแล้ว — ยกเลิกเครื่องเก่าในหน้า ascs '
                || '(ผู้ช่วย AI › ติดตั้งในเครื่องนี้) ก่อน หรือเปลี่ยนแพ็กเกจ');
        end if;
    end if;

    insert into public.ai_installs (user_id, machine_hash, machine_name, secret_hash)
    values (r.user_id, h, left(coalesce(p_machine_name, ''), 64), md5(secret))
    on conflict (user_id, machine_hash) do update
        set machine_name = excluded.machine_name, secret_hash = excluded.secret_hash,
            installed_at = now(), revoked_at = null;
    update public.ai_install_codes set used_at = now(), machine_hash = h where code = k;
    select count(*) into n from public.ai_installs where user_id = r.user_id and revoked_at is null;
    return json_build_object('ok', true, 'secret', secret, 'machines', n, 'max_machines', mx);
end;
$$;
revoke all on function public.redeem_ai_install_code(text, text, text) from public;
grant execute on function public.redeem_ai_install_code(text, text, text) to anon, authenticated;

-- ตรวจผล (ผู้ดูแลระบบรันได้):
--   select code, name, max_devices, offline_days from public.access_packages order by sort;
--   select p.email, public.ai_max_machines(p.id) as ผูกได้,
--          (select count(*) from public.ai_installs i where i.user_id = p.id and i.revoked_at is null) as ผูกแล้ว
--     from public.profiles p order by p.email;
