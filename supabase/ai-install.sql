-- ============================================================================
--  ชุดติดตั้งผู้ช่วย AI ของ ASC Studio — รหัสติดตั้ง + จำกัด 2 เครื่องต่อบัญชี
--  (ลุงพีตัดสินใจ 30 ต.ค. 2569 · แผน design-auto\docs\ai-knowledge-plan.md หัวข้อ K2a)
--  ----------------------------------------------------------------------------
--  วิธีใช้ : Supabase Dashboard (โปรเจกต์ ASC Cloud) > SQL Editor > New query > วางทั้งไฟล์ > Run  (รันซ้ำได้ ไม่พัง)
--
--  ลำดับงาน
--    1. ผู้ใช้ที่ล็อกอินกด "ติดตั้งในเครื่องนี้" ใน ascs → create_ai_install_code() ได้รหัส ASC-XXXX-XXXX
--       (ผูกกับบัญชี · ใช้ครั้งเดียว · หมดอายุ 30 นาที)
--    2. ตัวติดตั้งในเครื่องเรียก redeem_ai_install_code(รหัส, แฮชเครื่อง, ชื่อเครื่อง) ด้วย anon key
--       → ตรวจรหัส + จำกัด 2 เครื่องต่อบัญชี (ติดตั้งซ้ำเครื่องเดิมได้ไม่นับเพิ่ม) → คืน install secret
--    3. ถอนการติดตั้ง → release_ai_install(แฮชเครื่อง, secret) คืนสิทธิ์เครื่อง
--       หรือผู้ใช้กด "ยกเลิกเครื่องนี้" ใน ascs → revoke_ai_install(id)
--  ตัวติดตั้งไม่เคยเห็นอีเมล/รหัสผ่าน · เครื่องส่งเฉพาะแฮช SHA-256 ของ MachineGuid
-- ============================================================================

create table if not exists public.ai_install_codes (
    code        text        primary key,                     -- ASC-XXXX-XXXX
    user_id     uuid        not null references auth.users(id) on delete cascade,
    created_at  timestamptz not null default now(),
    expires_at  timestamptz not null default now() + interval '30 minutes',
    used_at     timestamptz,
    machine_hash text
);

create table if not exists public.ai_installs (
    id           uuid        primary key default gen_random_uuid(),
    user_id      uuid        not null references auth.users(id) on delete cascade,
    machine_hash text        not null,                       -- SHA-256 ของ MachineGuid (ตัวพิมพ์เล็ก 64 ตัว)
    machine_name text        not null default '',
    secret_hash  text        not null,                       -- md5 ของ install secret (สุ่ม 128 บิต) — ใช้ตอนถอนคืนสิทธิ์
    installed_at timestamptz not null default now(),
    revoked_at   timestamptz,
    unique (user_id, machine_hash)
);

alter table public.ai_install_codes enable row level security;
alter table public.ai_installs      enable row level security;

-- อ่านได้เฉพาะของตัวเอง (แอดมินอ่านได้ทั้งหมด) · เขียนผ่านฟังก์ชันข้างล่างเท่านั้น
drop policy if exists ai_install_codes_select on public.ai_install_codes;
create policy ai_install_codes_select on public.ai_install_codes
    for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists ai_installs_select on public.ai_installs;
create policy ai_installs_select on public.ai_installs
    for select to authenticated using (user_id = auth.uid() or public.is_admin());

revoke all on public.ai_install_codes from anon, authenticated;
revoke all on public.ai_installs      from anon, authenticated;
grant select on public.ai_install_codes to authenticated;
grant select on public.ai_installs      to authenticated;

-- อักษรไม่กำกวม (ไม่มี 0 O 1 I) · สุ่มจากไบต์ของ gen_random_uuid() (ไม่ต้องพึ่ง pgcrypto)
create or replace function public.ai_random_code()
returns text language plpgsql volatile set search_path = public as $$
declare
    alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    b bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    s text := '';
begin
    for i in 0..7 loop
        s := s || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
    end loop;
    return 'ASC-' || substr(s, 1, 4) || '-' || substr(s, 5, 4);
end;
$$;
revoke all on function public.ai_random_code() from public, anon, authenticated;

-- 1) สร้างรหัส (ผู้ที่ล็อกอินเท่านั้น) — ไม่ตรวจจำนวนเครื่องตรงนี้ เพราะยังไม่รู้ว่าจะติดตั้งเครื่องเดิมหรือเครื่องใหม่
create or replace function public.create_ai_install_code()
returns json language plpgsql volatile security definer set search_path = public as $$
declare
    uid uuid := auth.uid();
    c text;
    exp timestamptz;
    n int;
begin
    if uid is null then raise exception 'ต้องเข้าสู่ระบบก่อน'; end if;
    -- ล้างรหัสที่หมดอายุ/ยังไม่ใช้ของบัญชีนี้ · เก็บรหัสที่ยังใช้ได้ไม่เกิน 3 รหัส
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
    return json_build_object('code', c, 'expires_at', exp, 'machines', n, 'max_machines', 2);
end;
$$;
revoke all on function public.create_ai_install_code() from public, anon;
grant execute on function public.create_ai_install_code() to authenticated;

-- 2) แลกรหัส (ตัวติดตั้งเรียกด้วย anon key) — คืน json { ok, error | secret, machines }
create or replace function public.redeem_ai_install_code(p_code text, p_machine_hash text, p_machine_name text)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
    k text := upper(trim(coalesce(p_code, '')));
    h text := lower(trim(coalesce(p_machine_hash, '')));
    r public.ai_install_codes%rowtype;
    existing public.ai_installs%rowtype;
    n int;
    secret text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
    if h !~ '^[0-9a-f]{64}$' then return json_build_object('ok', false, 'error', 'ข้อมูลเครื่องไม่ถูกต้อง'); end if;
    select * into r from public.ai_install_codes where code = k for update;
    if not found then return json_build_object('ok', false, 'error', 'รหัสติดตั้งไม่ถูกต้อง'); end if;
    if r.used_at is not null then return json_build_object('ok', false, 'error', 'รหัสนี้ถูกใช้ไปแล้ว — สร้างรหัสใหม่ในหน้า ascs'); end if;
    if r.expires_at < now() then return json_build_object('ok', false, 'error', 'รหัสหมดอายุแล้ว (30 นาที) — สร้างรหัสใหม่ในหน้า ascs'); end if;

    select * into existing from public.ai_installs where user_id = r.user_id and machine_hash = h;
    if not found or existing.revoked_at is not null then
        select count(*) into n from public.ai_installs where user_id = r.user_id and revoked_at is null;
        if n >= 2 then
            return json_build_object('ok', false, 'error', 'บัญชีนี้ติดตั้งครบ 2 เครื่องแล้ว — ยกเลิกเครื่องเก่าในหน้า ascs (ผู้ช่วย AI › ติดตั้งในเครื่องนี้) ก่อน');
        end if;
    end if;

    insert into public.ai_installs (user_id, machine_hash, machine_name, secret_hash)
    values (r.user_id, h, left(coalesce(p_machine_name, ''), 64), md5(secret))
    on conflict (user_id, machine_hash) do update
        set machine_name = excluded.machine_name, secret_hash = excluded.secret_hash,
            installed_at = now(), revoked_at = null;
    update public.ai_install_codes set used_at = now(), machine_hash = h where code = k;
    select count(*) into n from public.ai_installs where user_id = r.user_id and revoked_at is null;
    return json_build_object('ok', true, 'secret', secret, 'machines', n, 'max_machines', 2);
end;
$$;
revoke all on function public.redeem_ai_install_code(text, text, text) from public;
grant execute on function public.redeem_ai_install_code(text, text, text) to anon, authenticated;

-- 3) ตัวถอนการติดตั้งคืนสิทธิ์เครื่อง (anon · ต้องมี secret ที่ได้ตอนติดตั้ง)
create or replace function public.release_ai_install(p_machine_hash text, p_secret text)
returns boolean language plpgsql volatile security definer set search_path = public as $$
begin
    update public.ai_installs set revoked_at = now()
     where machine_hash = lower(trim(coalesce(p_machine_hash, '')))
       and secret_hash = md5(coalesce(p_secret, '')) and revoked_at is null;
    return found;
end;
$$;
revoke all on function public.release_ai_install(text, text) from public;
grant execute on function public.release_ai_install(text, text) to anon, authenticated;

-- 4) ผู้ใช้ยกเลิกเครื่องของตัวเองในหน้า ascs (แอดมินยกเลิกของทุกคนได้)
create or replace function public.revoke_ai_install(p_id uuid)
returns boolean language plpgsql volatile security definer set search_path = public as $$
begin
    update public.ai_installs set revoked_at = now()
     where id = p_id and revoked_at is null and (user_id = auth.uid() or public.is_admin());
    return found;
end;
$$;
revoke all on function public.revoke_ai_install(uuid) from public, anon;
grant execute on function public.revoke_ai_install(uuid) to authenticated;

-- ตรวจหลังรัน (ต้องเห็นตาราง 2 ตาราง ฟังก์ชัน 5 ตัว)
-- select tablename from pg_tables where schemaname = 'public' and tablename like 'ai_install%';
-- select proname from pg_proc where proname in ('ai_random_code','create_ai_install_code','redeem_ai_install_code','release_ai_install','revoke_ai_install');
-- ดูการติดตั้งทั้งหมด (แอดมิน):
-- select u.email, i.machine_name, i.installed_at, i.revoked_at from public.ai_installs i join auth.users u on u.id = i.user_id order by i.installed_at desc;
