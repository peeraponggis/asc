-- ============================================================================
--  ProInventive ASC Enterprise — สิทธิ์การใช้งาน · แพ็กเกจ · พักสิทธิ์อัตโนมัติ · นับเครื่องพร้อมกัน (8 พ.ย. 2569)
--  ----------------------------------------------------------------------------
--  ตามที่ลุงพีสรุป (docs/mockup-access-control.html ของ design-auto):
--   1) แพ็กเกจ 5 ชนิด ปรับตัวเลข/ราคา/ความสามารถได้ที่ตาราง access_packages (ไม่ต้องแก้โค้ด)
--        trial (ทดลอง 7 วัน ≤ 50 kWp) · training (ค่าอบรม 2,980 ≤ 1 MW) · starter (1,980 ≤ 500 kWp)
--        pro (2,980 ≤ 1 MW) · company (2,980 ไม่ระบุเพดาน แชร์งานในทีม)
--   2) ต่ออีเมลในรายชื่อ: ติ๊ก "ใช้สิทธิ์ตามแพ็กเกจที่ซื้อ" + แพ็กเกจ + วันเริ่ม/หมด (ตาราง account_access)
--   3) บัญชีเดิม: ใช้ได้อีก 1 เดือน นับจากวันที่ผู้ดูแลกด "อนุมัติบัญชีเดิม" (access_approve_legacy)
--   4) ไม่ได้ใช้งานเกิน 30 วัน = พักสิทธิ์ (ไม่ลบ · ติ๊กเปิดคืนได้) — access_auto_suspend() ทุกวันผ่าน pg_cron
--   5) บัญชีหนึ่งใช้ได้พร้อมกันกี่เครื่อง ตาม max_devices ของแพ็กเกจ (ไม่มีแพ็กเกจ/ทดลอง = 1 เครื่อง)
--   ยกเว้นทุกข้อ: ผู้ดูแลระบบ (is_admin) และอีเมลโดเมนบริษัท (monitor_settings.email_domain = proinventive.co.th)
--  ----------------------------------------------------------------------------
--  วิธีใช้ : Supabase Dashboard (โปรเจกต์ rcaslesvgilknupqmwrp) > SQL Editor > New query > วางทั้งไฟล์ > Run
--            https://supabase.com/dashboard/project/rcaslesvgilknupqmwrp/sql/new
--            รันซ้ำได้ ไม่พัง · ต้องรัน schema.sql · invite-only.sql · allow-domains.sql · presence.sql มาก่อน
--  หมายเหตุ : หน้าเว็บ/โปรแกรมเรียก my_access() / device_access() — ยังไม่รันไฟล์นี้ = ไม่บังคับอะไร (เปิดใช้ได้ตามเดิม)
--             ตัวเลขที่ลุงพีไม่ได้ระบุ ตั้งค่าตั้งต้นไว้แล้วแก้ได้ที่ access_packages:
--               duration_days = 30 (ทดลอง 7) · max_devices: trial/training/starter = 1 · pro = 2 · company = 5
-- ============================================================================


-- ── 1. แพ็กเกจ ────────────────────────────────────────────────
create table if not exists public.access_packages (
    code          text        primary key check (code ~ '^[a-z0-9_]{2,20}$'),
    name          text        not null,
    sort          int         not null default 0,
    price_baht    numeric,                                   -- รวม VAT 7 % แล้ว · null = ไม่แสดง
    duration_days int         not null default 30 check (duration_days between 1 and 3650),
    max_kwp       numeric     check (max_kwp is null or max_kwp > 0),   -- รวมทุกโครงการ · null = ไม่ระบุเพดาน
    max_devices   int         not null default 1 check (max_devices between 1 and 100),
    features      jsonb       not null default '{}'::jsonb,  -- ascs check report proposal engineering submission asca sld_dxf logo team_share watermark
    note          text        not null default '',
    updated_at    timestamptz not null default now()
);

insert into public.access_packages (code, name, sort, price_baht, duration_days, max_kwp, max_devices, features, note) values
 ('trial',    'ทดลอง 7 วัน', 10, 0,    7,  50,   1, '{"ascs":true,"check":true,"report":true,"watermark":true}', 'ใช้งาน ASCS ออกแบบ · ตรวจ วสท. · รายงาน · PDF มีลายน้ำ'),
 ('training', 'Training',    20, 2980, 30, 1000, 1, '{"ascs":true,"check":true,"report":true,"proposal":true,"engineering":true,"submission":true,"logo":true}', 'ค่าอบรม 2,980 บาท รวม VAT 7 % · หมดแล้วเลือกแพ็กเกจต่อได้ทันที'),
 ('starter',  'Starter',     30, 1980, 30, 500,  1, '{"ascs":true,"check":true,"report":true,"proposal":true,"engineering":true,"submission":true,"logo":true}', 'ASCS + โลโก้บริษัท + รายงานข้อเสนอลูกค้า/วิศวกรรม/ชุดยื่นการไฟฟ้า'),
 ('pro',      'Pro',         40, 2980, 30, 1000, 2, '{"ascs":true,"asca":true,"check":true,"report":true,"proposal":true,"engineering":true,"submission":true,"sld_dxf":true,"logo":true}', 'ASCS + ASCA + SLD/DXF + โลโก้บริษัท + รายงานครบ'),
 ('company',  'Company',     50, 2980, 30, null, 5, '{"ascs":true,"asca":true,"check":true,"report":true,"proposal":true,"engineering":true,"submission":true,"sld_dxf":true,"logo":true,"team_share":true}', 'Pro + แชร์งานในทีม (เดิมชื่อ Team)')
on conflict (code) do nothing;

alter table public.access_packages enable row level security;
drop policy if exists access_packages_read  on public.access_packages;
create policy access_packages_read on public.access_packages for select to authenticated using (true);
drop policy if exists access_packages_write on public.access_packages;
create policy access_packages_write on public.access_packages for all to authenticated
    using (public.is_admin()) with check (public.is_admin());


-- ── 2. สิทธิ์รายบัญชี (ผูกด้วยอีเมล เพื่อกำหนดได้ก่อนสมัคร) ─────────────────
create table if not exists public.account_access (
    email          text        primary key,
    use_package    boolean     not null default false,        -- ☑ ใช้สิทธิ์ตามแพ็กเกจที่ซื้อ
    package_code   text        references public.access_packages(code) on update cascade,
    source         text        not null default '',           -- ซื้อเอง · คอร์สอบรม · ตัวแทนแจก · ทีมงาน
    valid_from     date,
    valid_to       date,
    status         text        not null default 'active' check (status in ('active', 'suspended')),
    suspend_reason text        not null default '',           -- idle30 · manual · expired
    suspended_at   timestamptz,
    grace_until    date,                                      -- บัญชีเดิม: ใช้ได้ถึงวันนี้ (วันอนุมัติ + 1 เดือน)
    approved_at    timestamptz,
    exempt         boolean     not null default false,        -- ยกเว้นพักอัตโนมัติ (ผู้ดูแล/โดเมนบริษัทยกเว้นให้เองไม่ต้องติ๊ก)
    max_devices_override int   check (max_devices_override is null or max_devices_override between 1 and 100),
    max_kwp_override numeric   check (max_kwp_override is null or max_kwp_override > 0),
    last_active_at timestamptz,
    updated_at     timestamptz not null default now()
);
alter table public.account_access enable row level security;
drop policy if exists account_access_admin on public.account_access;
create policy account_access_admin on public.account_access for all to authenticated
    using (public.is_admin()) with check (public.is_admin());


-- ── 3. เครื่องที่กำลังใช้งาน (นับพร้อมกัน) + ประวัติ ────────────────────────
create table if not exists public.access_sessions (
    email      text        not null,
    instance   text        not null check (length(instance) between 6 and 80),   -- เบราว์เซอร์ (จำในเครื่อง) หรือ d:<แฮชเครื่อง>
    label      text        not null default '',
    app        text        not null default 'WEB',
    first_seen timestamptz not null default now(),
    last_seen  timestamptz not null default now(),
    primary key (email, instance)
);
alter table public.access_sessions enable row level security;      -- ไม่มี policy = เข้าถึงผ่านฟังก์ชัน security definer เท่านั้น

create table if not exists public.access_log (
    id     bigserial   primary key,
    at     timestamptz not null default now(),
    actor  uuid,
    email  text        not null,
    action text        not null,        -- set · suspend · resume · approve_legacy · auto_suspend · request
    detail jsonb       not null default '{}'::jsonb
);
create index if not exists access_log_email on public.access_log (email, at desc);
alter table public.access_log enable row level security;
drop policy if exists access_log_admin on public.access_log;
create policy access_log_admin on public.access_log for select to authenticated using (public.is_admin());


-- ── 4. แกนคิดสถานะ (ไม่แตะข้อมูล) ──────────────────────────────────
--  state: exempt · active (แพ็กเกจยังไม่หมด) · grace (บัญชีเดิมในช่วง 1 เดือน) · trial · expired · suspended
create or replace function public._access_core(p_email text, p_admin boolean)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
    mail   text := lower(trim(coalesce(p_email, '')));
    dom    text := coalesce((select email_domain from public.monitor_settings where id = 1), 'proinventive.co.th');
    a      public.account_access;
    pk     public.access_packages;
    tr     public.access_packages;
    st     text;
    reg    timestamptz;
    ends   date;
    kwp    numeric;
    dev    int;
begin
    select * into a from public.account_access where email = mail;
    select * into tr from public.access_packages where code = 'trial';

    if coalesce(p_admin, false) or mail like '%@' || dom then
        return jsonb_build_object('ok', true, 'state', 'exempt', 'exempt', true, 'email', mail,
                                  'features', '{"ascs":true,"asca":true,"check":true,"report":true,"proposal":true,"engineering":true,"submission":true,"sld_dxf":true,"logo":true,"team_share":true}'::jsonb,
                                  'maxKwp', null, 'maxDevices', null, 'package', null);
    end if;

    if a.status = 'suspended' then
        st := 'suspended';
    elsif a.use_package and a.package_code is not null
          and (a.valid_from is null or a.valid_from <= current_date)
          and (a.valid_to   is null or a.valid_to   >= current_date) then
        st := 'active';
        select * into pk from public.access_packages where code = a.package_code;
        ends := a.valid_to;
    elsif a.grace_until is not null and a.grace_until >= current_date then
        st := 'grace';
        select * into pk from public.access_packages where code = 'pro';
        ends := a.grace_until;
    else
        -- ทดลอง: นับจากวันสมัคร (ยังไม่สมัคร = นับจากวันนี้)
        select created_at into reg from public.profiles where lower(email) = mail limit 1;
        ends := (coalesce(reg, now())::date + coalesce(tr.duration_days, 7));
        if current_date <= ends then
            st := 'trial'; pk := tr;
        else
            st := 'expired';
        end if;
    end if;

    kwp := coalesce(a.max_kwp_override, pk.max_kwp);
    dev := coalesce(a.max_devices_override, pk.max_devices, 1);
    if st = 'grace' then kwp := coalesce(a.max_kwp_override, null); end if;     -- บัญชีเดิมช่วง 1 เดือน: ไม่ตั้งเพดาน kWp

    return jsonb_build_object(
        'ok', true, 'state', st, 'exempt', false, 'email', mail,
        'package', case when pk.code is null then null else jsonb_build_object('code', pk.code, 'name', pk.name, 'priceBaht', pk.price_baht, 'durationDays', pk.duration_days) end,
        'features', coalesce(pk.features, '{}'::jsonb),
        'maxKwp', kwp, 'maxDevices', dev,
        'validFrom', a.valid_from, 'validTo', case when st = 'active' then a.valid_to else ends end,
        'graceUntil', a.grace_until, 'status', coalesce(a.status, 'active'), 'suspendReason', coalesce(a.suspend_reason, ''),
        'source', coalesce(a.source, ''), 'lastActive', a.last_active_at);
end;
$$;
revoke all on function public._access_core(text, boolean) from public, anon, authenticated;


-- ── 5. ประเมินสิทธิ์ + จองที่นั่งเครื่อง + บันทึกใช้งานล่าสุด ───────────────────
create or replace function public._access_eval(p_uid uuid, p_instance text, p_label text, p_app text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
    mail  text;
    adm   boolean;
    core  jsonb;
    maxd  int;
    inst  text := nullif(trim(coalesce(p_instance, '')), '');
    n     int;
begin
    select lower(email), is_admin into mail, adm from public.profiles where id = p_uid;
    if mail is null then return jsonb_build_object('ok', false, 'reason', 'noprofile'); end if;
    core := public._access_core(mail, adm);
    if core->>'state' in ('suspended', 'expired') then return core; end if;

    -- ใช้งานล่าสุด (ผู้ถูกพัก/หมดอายุไม่ถูกนับ)
    insert into public.account_access (email, last_active_at) values (mail, now())
    on conflict (email) do update set last_active_at = now();

    if inst is not null and not (core->>'exempt')::boolean then
        maxd := coalesce((core->>'maxDevices')::int, 1);
        delete from public.access_sessions where email = mail and last_seen < now() - interval '3 minutes';
        if exists (select 1 from public.access_sessions where email = mail and instance = inst) then
            update public.access_sessions set last_seen = now(), label = left(coalesce(p_label, ''), 80), app = left(coalesce(p_app, 'WEB'), 12)
             where email = mail and instance = inst;
        else
            select count(*) into n from public.access_sessions where email = mail;
            if n >= maxd then
                return core || jsonb_build_object('state', 'busy', 'busy', true, 'devicesInUse', n);
            end if;
            insert into public.access_sessions (email, instance, label, app) values (mail, inst, left(coalesce(p_label, ''), 80), left(coalesce(p_app, 'WEB'), 12));
        end if;
    end if;
    return core;
end;
$$;
revoke all on function public._access_eval(uuid, text, text, text) from public, anon, authenticated;

-- หน้าเว็บ (ล็อกอินแล้ว) เรียกตอนเข้าระบบและทุก 60 วินาทีพร้อมสัญญาณใช้งาน
create or replace function public.my_access(p_instance text default null, p_label text default null, p_app text default 'WEB')
returns jsonb language sql volatile security definer set search_path = public as $$
    select case when auth.uid() is null then jsonb_build_object('ok', false, 'reason', 'anon')
                else public._access_eval(auth.uid(), p_instance, p_label, p_app) end;
$$;
grant execute on function public.my_access(text, text, text) to authenticated;
revoke execute on function public.my_access(text, text, text) from anon;

-- โปรแกรมในเครื่อง (ผูกเครื่องด้วยรหัสแล้ว) — ใช้ระบบผูกเครื่องเดิม presence-device.sql
create or replace function public.device_access(p_machine_hash text, p_secret text, p_app text default 'ASCS')
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := public.device_user(p_machine_hash, p_secret);
begin
    if uid is null then return jsonb_build_object('ok', false, 'reason', 'unlinked'); end if;
    return public._access_eval(uid, 'd:' || left(lower(coalesce(p_machine_hash, '')), 24), 'desktop', p_app);
end;
$$;
revoke all on function public.device_access(text, text, text) from public, authenticated;
grant execute on function public.device_access(text, text, text) to anon;


-- ── 6. งานของผู้ดูแลระบบ ──────────────────────────────────────
create or replace function public._access_admin_only() returns void language plpgsql stable security definer set search_path = public as $$
begin
    if not public.is_admin() then raise exception 'เฉพาะผู้ดูแลระบบ' using errcode = 'insufficient_privilege'; end if;
end;
$$;
revoke all on function public._access_admin_only() from public, anon, authenticated;

-- ตั้ง/แก้สิทธิ์รายบัญชี (null = ไม่แก้ช่องนั้น · ใช้ p_clear_dates = true เพื่อล้างวันที่)
create or replace function public.access_set(
    p_email text, p_use_package boolean default null, p_package text default null,
    p_valid_from date default null, p_valid_to date default null, p_source text default null,
    p_exempt boolean default null, p_dev_override int default null, p_kwp_override numeric default null,
    p_clear_dates boolean default false
) returns void language plpgsql volatile security definer set search_path = public as $$
declare mail text := lower(trim(p_email));
begin
    perform public._access_admin_only();
    if mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'อีเมลไม่ถูกต้อง'; end if;
    insert into public.account_access (email) values (mail) on conflict (email) do nothing;
    update public.account_access set
        use_package  = coalesce(p_use_package, use_package),
        package_code = case when p_package is not null then nullif(p_package, '') else package_code end,
        valid_from   = case when p_clear_dates then null else coalesce(p_valid_from, valid_from) end,
        valid_to     = case when p_clear_dates then null else coalesce(p_valid_to, valid_to) end,
        source       = coalesce(p_source, source),
        exempt       = coalesce(p_exempt, exempt),
        max_devices_override = case when p_dev_override is not null then nullif(p_dev_override, 0) else max_devices_override end,
        max_kwp_override     = case when p_kwp_override is not null then nullif(p_kwp_override, 0) else max_kwp_override end,
        updated_at   = now()
     where email = mail;
    insert into public.access_log (actor, email, action, detail)
    values (auth.uid(), mail, 'set', jsonb_build_object('use_package', p_use_package, 'package', p_package, 'from', p_valid_from, 'to', p_valid_to, 'source', p_source));
end;
$$;
revoke all on function public.access_set(text, boolean, text, date, date, text, boolean, int, numeric, boolean) from public, anon;
grant execute on function public.access_set(text, boolean, text, date, date, text, boolean, int, numeric, boolean) to authenticated;

-- พัก/เปิดสิทธิ์ (ติ๊กคืนได้ · ไม่ลบข้อมูล)
create or replace function public.access_suspend(p_email text, p_on boolean, p_reason text default 'manual')
returns void language plpgsql volatile security definer set search_path = public as $$
declare mail text := lower(trim(p_email));
begin
    perform public._access_admin_only();
    insert into public.account_access (email) values (mail) on conflict (email) do nothing;
    update public.account_access set
        status = case when p_on then 'suspended' else 'active' end,
        suspend_reason = case when p_on then coalesce(p_reason, 'manual') else '' end,
        suspended_at = case when p_on then now() else null end,
        last_active_at = case when p_on then last_active_at else now() end,     -- เปิดคืน = นับ 30 วันใหม่
        updated_at = now()
     where email = mail;
    insert into public.access_log (actor, email, action, detail)
    values (auth.uid(), mail, case when p_on then 'suspend' else 'resume' end, jsonb_build_object('reason', p_reason));
end;
$$;
revoke all on function public.access_suspend(text, boolean, text) from public, anon;
grant execute on function public.access_suspend(text, boolean, text) to authenticated;

-- อนุมัติบัญชีเดิมทั้งหมด: ใช้ได้ถึงวันนี้ + p_months เดือน (ยกเว้นผู้ดูแล/โดเมนบริษัท/ที่มีแพ็กเกจแล้ว) คืนจำนวนบัญชี
create or replace function public.access_approve_legacy(p_months int default 1)
returns int language plpgsql volatile security definer set search_path = public as $$
declare n int := 0; r record; until_ date := (current_date + make_interval(months => greatest(coalesce(p_months, 1), 1)))::date;
        dom text := coalesce((select email_domain from public.monitor_settings where id = 1), 'proinventive.co.th');
begin
    perform public._access_admin_only();
    for r in
        select lower(e.email) as email
          from public.allowed_emails e
          left join public.account_access a on a.email = lower(e.email)
          left join public.profiles p on lower(p.email) = lower(e.email)
         where lower(e.email) not like '%@' || dom
           and coalesce(p.is_admin, false) = false
           and (a.email is null or (a.grace_until is null and not coalesce(a.use_package, false)))
    loop
        insert into public.account_access (email, grace_until, approved_at, last_active_at)
        values (r.email, until_, now(), now())
        on conflict (email) do update set grace_until = until_, approved_at = now(), last_active_at = now(), updated_at = now();
        insert into public.access_log (actor, email, action, detail) values (auth.uid(), r.email, 'approve_legacy', jsonb_build_object('until', until_));
        n := n + 1;
    end loop;
    return n;
end;
$$;
revoke all on function public.access_approve_legacy(int) from public, anon;
grant execute on function public.access_approve_legacy(int) to authenticated;

-- พักบัญชีที่ไม่ได้ใช้งานเกิน p_days วัน (ยกเว้นผู้ดูแล/โดเมนบริษัท/ติ๊กยกเว้น) · เรียกโดย pg_cron วันละครั้ง หรือผู้ดูแลกดเอง
create or replace function public.access_auto_suspend(p_days int default 30)
returns int language plpgsql volatile security definer set search_path = public as $$
declare n int := 0; r record;
        dom text := coalesce((select email_domain from public.monitor_settings where id = 1), 'proinventive.co.th');
begin
    if auth.uid() is not null then perform public._access_admin_only(); end if;      -- cron (ไม่มีผู้ใช้) ผ่านได้
    for r in
        select lower(p.email) as email,
               greatest(a.last_active_at, (select max(s.last_seen) from public.app_presence s where s.user_id = p.id), p.created_at) as last_use
          from public.profiles p
          left join public.account_access a on a.email = lower(p.email)
         where coalesce(p.is_admin, false) = false
           and lower(p.email) not like '%@' || dom
           and coalesce(a.exempt, false) = false
           and coalesce(a.status, 'active') = 'active'
    loop
        if r.last_use < now() - make_interval(days => greatest(coalesce(p_days, 30), 1)) then
            insert into public.account_access (email, status, suspend_reason, suspended_at)
            values (r.email, 'suspended', 'idle' || p_days, now())
            on conflict (email) do update set status = 'suspended', suspend_reason = 'idle' || p_days, suspended_at = now(), updated_at = now();
            insert into public.access_log (actor, email, action, detail) values (auth.uid(), r.email, 'auto_suspend', jsonb_build_object('lastUse', r.last_use, 'days', p_days));
            n := n + 1;
        end if;
    end loop;
    return n;
end;
$$;
revoke all on function public.access_auto_suspend(int) from public, anon;
grant execute on function public.access_auto_suspend(int) to authenticated;

-- ผู้ใช้ที่ถูกพัก/หมดอายุ กด "ขอเปิดสิทธิ์" → บันทึกคำขอให้ผู้ดูแลเห็น
create or replace function public.access_request(p_note text default '')
returns void language plpgsql volatile security definer set search_path = public as $$
declare mail text;
begin
    select lower(email) into mail from public.profiles where id = auth.uid();
    if mail is null then raise exception 'ต้องล็อกอินก่อน'; end if;
    insert into public.access_log (actor, email, action, detail)
    values (auth.uid(), mail, 'request', jsonb_build_object('note', left(coalesce(p_note, ''), 300)));
end;
$$;
grant execute on function public.access_request(text) to authenticated;


-- รายการสำหรับหน้าผู้ดูแล: ทุกอีเมลในรายชื่อ + สถานะที่คิดแล้ว (แหล่งความจริงเดียวกับ my_access)
create or replace function public.access_admin_list()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
    perform public._access_admin_only();
    return coalesce((
        select jsonb_agg(q.x order by q.x->>'email') from (
            select jsonb_build_object(
                'email', lower(e.email),
                'access', public._access_core(e.email, coalesce(p.is_admin, false)),
                'row', to_jsonb(a),
                'lastUse', greatest(a.last_active_at, (select max(s.last_seen) from public.app_presence s where s.user_id = p.id)),
                'registered', p.id is not null,
                'devicesNow', (select count(*) from public.access_sessions z where z.email = lower(e.email) and z.last_seen > now() - interval '3 minutes'),
                'request', coalesce(
                    (select max(l.at) from public.access_log l where l.email = lower(e.email) and l.action = 'request')
                    > coalesce((select max(l2.at) from public.access_log l2 where l2.email = lower(e.email) and l2.action in ('set', 'resume', 'approve_legacy')), '-infinity'::timestamptz),
                    false)
            ) as x
              from public.allowed_emails e
              left join public.profiles p on lower(p.email) = lower(e.email)
              left join public.account_access a on a.email = lower(e.email)
        ) q), '[]'::jsonb);
end;
$$;
revoke all on function public.access_admin_list() from public, anon;
grant execute on function public.access_admin_list() to authenticated;

-- ── 7. ตั้งเวลา: พักบัญชีที่ไม่ใช้เกิน 30 วัน ทุกวัน 03:00 (เวลาไทย 10:00 น. = 03:00 UTC) ─────────
do $$
begin
    if exists (select 1 from pg_extension where extname = 'pg_cron') then
        perform cron.unschedule(jobid) from cron.job where jobname = 'access-auto-suspend';
        perform cron.schedule('access-auto-suspend', '0 3 * * *', 'select public.access_auto_suspend(30)');
    end if;
end $$;

-- ตรวจผล (ผู้ดูแลระบบรันได้):
--   select public.my_access();                        -- สถานะของบัญชีที่ล็อกอินอยู่
--   select * from public.access_packages order by sort;
--   select public.access_approve_legacy(1);           -- อนุมัติบัญชีเดิมใช้ได้ 1 เดือน (ทำเมื่อเปิดระบบกลับ)
