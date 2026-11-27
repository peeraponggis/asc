-- ============================================================================
--  ProInventive ASC Enterprise — ขอทดลองใช้ 7 วัน · แอดมินกดอนุมัติ (27 พ.ย. 2569)
--  ----------------------------------------------------------------------------
--  ตามหน้าตัวอย่างที่ลุงพีอนุมัติ (design-auto/docs/mockup-trial-request.html):
--   1) ลูกค้ากรอกขอที่ https://aisolar.dev/trial/  (อีเมล ชื่อ บริษัท เบอร์ ใช้งานแบบไหน + ยินยอม)
--   2) แอดมินเห็นที่ ตั้งค่า › ผู้ใช้และสิทธิ์ › การ์ด "คำขอทดลองใช้" → ✅ อนุมัติ 7 วัน / ✕ ปฏิเสธ
--      อนุมัติ = เพิ่มเข้า allowed_emails + หน้าเว็บส่งลิงก์เข้าใช้ทางอีเมล (Supabase Auth)
--   3) นับ 7 วันจาก "เข้าใช้ครั้งแรก" (ยืนยันอีเมล) — แก้ใน access-control.sql (_access_core)
--   4) กันบอท Cloudflare Turnstile (ตั้งคีย์แล้วจึงบังคับ · ยังไม่ตั้ง = จำกัดจำนวนครั้งอย่างเดียว)
--   5) แจ้ง Telegram "มีคำขอใหม่" (ไม่ส่งชื่อ/อีเมล/เบอร์ลูกค้า) — ใช้บอท + กลุ่ม Pi monitor เดิมถ้าตั้งไว้แล้ว
--      หรือตั้งบอท/แชทแยกด้วย tg_bot_token · tg_chat_id ข้างล่าง
--  ----------------------------------------------------------------------------
--  วิธีใช้ : Supabase Dashboard (โปรเจกต์ rcaslesvgilknupqmwrp) > SQL Editor > New query > วางทั้งไฟล์ > Run
--            https://supabase.com/dashboard/project/rcaslesvgilknupqmwrp/sql/new
--            รันซ้ำได้ ไม่พัง · ต้องรัน invite-only.sql · allow-domains.sql · access-control.sql มาก่อน (รันแล้วตั้งแต่ 8 พ.ย.)
--            ไม่ต้องรัน access-control.sql ซ้ำ — ส่วนที่แก้ (_access_core) อยู่ในไฟล์นี้แล้ว
--  ตั้งคีย์ภายหลัง (ทีละบรรทัด แทน ... ด้วยค่าจริง · รันซ้ำได้ = เขียนทับค่าเดิม):
--      select public.trial_set_key('turnstile_sitekey', '...');   -- Site Key (เปิดเผยได้)
--      select public.trial_set_key('turnstile_secret',  '...');   -- Secret Key (เก็บใน Vault)
--      select public.trial_set_key('tg_bot_token',      '...');   -- token บอท Telegram (เก็บใน Vault)
--      select public.trial_set_key('tg_chat_id',        '...');   -- chat id ของลุงพี
--   ลบคีย์ (ปิดความสามารถนั้น): select public.trial_set_key('turnstile_secret', '');
-- ============================================================================

create extension if not exists http   with schema extensions;   -- ตรวจ Turnstile (เรียกแบบรอผล)
create extension if not exists pg_net;                          -- แจ้ง Telegram (ส่งเบื้องหลัง)


-- ── 0. นับวันทดลองจาก "เข้าใช้ครั้งแรก" — สำเนาเดียวกับ access-control.sql (แก้ 27 พ.ย. 2569)
--     ใส่ไว้ที่นี่ด้วย เพื่อไม่ต้องรัน access-control.sql ทั้งไฟล์ซ้ำ (ไฟล์นั้นมี my_access/device_access รุ่นเก่ากว่า access-offline.sql)
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
                                  'features', '{"ascs":true,"asca":true,"project_plan":true,"check":true,"report":true,"proposal":true,"engineering":true,"submission":true,"sld_dxf":true,"logo":true,"team_share":true}'::jsonb,
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
        -- ทดลอง: นับจากเข้าใช้ครั้งแรก = วันยืนยันอีเมล (27 พ.ย. 2569 · เดิมนับจากวันสร้างบัญชี)
        --        ยังไม่ยืนยัน/ยังไม่เข้าใช้ = นับจากวันนี้ (ได้ครบวันเมื่อเข้าใช้จริง)
        select coalesce(u.email_confirmed_at, u.last_sign_in_at) into reg from auth.users u where lower(u.email) = mail limit 1;
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
        'source', coalesce(a.source, ''), 'lastActive', a.last_active_at,
        'trialStarted', case when st = 'trial' then reg is not null else null end);   -- ทดลอง: false = ยังไม่เข้าใช้ (ยังไม่เริ่มนับ)
end;
$$;
revoke all on function public._access_core(text, boolean) from public, anon, authenticated;


-- ── 1. ตารางคำขอ ───────────────────────────────────────────────────
create table if not exists public.trial_requests (
    id          bigserial   primary key,
    email       text        not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 200),
    name        text        not null check (length(name) between 1 and 120),
    company     text        not null default '' check (length(company) <= 160),
    phone       text        not null check (length(phone) between 9 and 20),
    use_type    text        not null default '' check (length(use_type) <= 80),
    instance    text        not null default '' check (length(instance) <= 80),   -- รหัสเบราว์เซอร์ (asc_instance) ใช้ตรวจซ้ำ
    consent_at  timestamptz not null,
    status      text        not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    created_at  timestamptz not null default now(),
    decided_at  timestamptz,
    decided_by  uuid,
    mail_sent_at timestamptz                                                     -- หน้าเว็บส่งลิงก์เข้าใช้สำเร็จ
);
create index if not exists trial_requests_status on public.trial_requests (status, created_at desc);
create index if not exists trial_requests_email  on public.trial_requests (lower(email));
alter table public.trial_requests enable row level security;     -- ไม่มี policy = เข้าถึงผ่านฟังก์ชันเท่านั้น


-- ── 2. ค่าตั้ง (คีย์ลับอยู่ใน Vault · Site Key เปิดเผยได้อยู่ตารางนี้) ─────────────
create table if not exists public.trial_settings (
    key        text primary key check (key in ('turnstile_sitekey')),
    value      text not null default '',
    updated_at timestamptz not null default now()
);
alter table public.trial_settings enable row level security;

create or replace function public._trial_secret(p_name text)
returns text language sql stable security definer set search_path = public as $$
    select nullif(trim(decrypted_secret), '') from vault.decrypted_secrets where name = 'asc_' || p_name limit 1;
$$;
revoke all on function public._trial_secret(text) from public, anon, authenticated;

-- Telegram: ตั้งของคำขอทดลองเองได้ (asc_tg_*) · ไม่ตั้ง = ใช้บอท + กลุ่มเดียวกับ Pi monitor (pi-monitor-telegram.sql) ถ้ามี
create or replace function public._trial_tg()
returns text[] language sql stable security definer set search_path = public as $$
    select array[
        coalesce(public._trial_secret('tg_bot_token'),
                 (select nullif(regexp_replace(decrypted_secret, '\s', '', 'g'), '') from vault.decrypted_secrets
                   where name = 'pi_monitor_bot_token' order by created_at desc limit 1)),
        coalesce(public._trial_secret('tg_chat_id'),
                 (select nullif(to_jsonb(m)->>'telegram_chat_id', '') from public.monitor_settings m where m.id = 1))];
$$;
revoke all on function public._trial_tg() from public, anon, authenticated;

create or replace function public.trial_set_key(p_key text, p_value text)
returns text language plpgsql volatile security definer set search_path = public as $$
declare sid uuid; v text := trim(coalesce(p_value, ''));
begin
    -- SQL Editor รันในฐานะ postgres (ไม่มี auth.uid) · ผ่านหน้าเว็บต้องเป็นผู้ดูแล
    if auth.uid() is not null and not public.is_admin() then raise exception 'เฉพาะผู้ดูแลระบบ'; end if;
    -- ตรวจรูปแบบ กันวางค่าตัวอย่าง (...) หรือวางผิดช่อง · '' = ลบ (ปิดความสามารถนั้น)
    if v <> '' and not (
         (p_key in ('turnstile_sitekey', 'turnstile_secret') and v ~ '^0x[A-Za-z0-9_-]{10,}$')
      or (p_key = 'tg_bot_token' and v ~ '^[0-9]+:[A-Za-z0-9_-]{30,}$')
      or (p_key = 'tg_chat_id'   and v ~ '^-?[0-9]{5,}$')) then
        raise exception 'ค่าของ % ผิดรูปแบบ (Turnstile ขึ้นต้น 0x… · token บอท = ตัวเลข:ตัวอักษร · chat id = ตัวเลข) — ยังไม่ได้บันทึก', p_key;
    end if;
    if p_key = 'turnstile_sitekey' then
        insert into public.trial_settings (key, value) values (p_key, v)
        on conflict (key) do update set value = excluded.value, updated_at = now();
        return case when v = '' then 'ลบ Site Key แล้ว' else 'ตั้ง Site Key แล้ว' end;
    elsif p_key in ('turnstile_secret', 'tg_bot_token', 'tg_chat_id') then
        select id into sid from vault.secrets where name = 'asc_' || p_key;
        if sid is null then perform vault.create_secret(v, 'asc_' || p_key);
        else perform vault.update_secret(sid, v); end if;
        return case when v = '' then 'ลบ ' || p_key || ' แล้ว' else 'ตั้ง ' || p_key || ' แล้ว (เก็บใน Vault)' end;
    end if;
    raise exception 'ไม่รู้จักคีย์ % (ใช้ได้: turnstile_sitekey · turnstile_secret · tg_bot_token · tg_chat_id)', p_key;
end;
$$;
revoke all on function public.trial_set_key(text, text) from public, anon;
grant execute on function public.trial_set_key(text, text) to authenticated;

-- หน้าขอทดลองถามก่อนแสดงฟอร์ม: ต้องใช้ Turnstile ไหม
create or replace function public.trial_config()
returns jsonb language sql stable security definer set search_path = public as $$
    select jsonb_build_object(
        'turnstileSiteKey', coalesce((select nullif(value, '') from public.trial_settings where key = 'turnstile_sitekey'), null),
        'days', coalesce((select duration_days from public.access_packages where code = 'trial'), 7));
$$;
grant execute on function public.trial_config() to anon, authenticated;


-- ── 3. ลูกค้าส่งคำขอ (ไม่ต้องล็อกอิน) ─────────────────────────────────────
create or replace function public.trial_request(
    p_email text, p_name text, p_company text, p_phone text, p_use text,
    p_instance text, p_consent boolean, p_captcha text default '')
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
    mail  text := lower(trim(coalesce(p_email, '')));
    nm    text := trim(coalesce(p_name, ''));
    tel   text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
    sec   text := public._trial_secret('turnstile_secret');
    res   jsonb;
begin
    if mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(mail) > 200 then return jsonb_build_object('ok', false, 'code', 'bad_email'); end if;
    if nm = '' or length(nm) > 120 then return jsonb_build_object('ok', false, 'code', 'bad_name'); end if;
    if length(tel) not between 9 and 10 then return jsonb_build_object('ok', false, 'code', 'bad_phone'); end if;
    if not coalesce(p_consent, false) then return jsonb_build_object('ok', false, 'code', 'no_consent'); end if;

    -- กันบอท: ตั้ง Secret แล้ว = ต้องผ่าน Turnstile ทุกคำขอ
    if sec is not null then
        if coalesce(p_captcha, '') = '' then return jsonb_build_object('ok', false, 'code', 'captcha'); end if;
        begin
            select content::jsonb into res from extensions.http_post(
                'https://challenges.cloudflare.com/turnstile/v0/siteverify',
                'secret=' || extensions.urlencode(sec) || '&response=' || extensions.urlencode(p_captcha),
                'application/x-www-form-urlencoded');
        exception when others then
            return jsonb_build_object('ok', false, 'code', 'captcha_down');
        end;
        if not coalesce((res->>'success')::boolean, false) then return jsonb_build_object('ok', false, 'code', 'captcha'); end if;
    end if;

    -- มีบัญชีแล้ว → ให้ไปเข้าสู่ระบบ
    if exists (select 1 from auth.users where lower(email) = mail) then
        return jsonb_build_object('ok', false, 'code', 'has_account');
    end if;
    -- รออนุมัติอยู่แล้ว → ไม่สร้างแถวใหม่
    if exists (select 1 from public.trial_requests where lower(email) = mail and status = 'pending') then
        return jsonb_build_object('ok', true, 'code', 'already_pending');
    end if;
    -- จำกัดจำนวน: อีเมลเดียว ≤ 3 ครั้ง/ชม. · ทั้งระบบ ≤ 30 ครั้ง/ชม. · รอรวม ≤ 200
    if (select count(*) from public.trial_requests where lower(email) = mail and created_at > now() - interval '1 hour') >= 3
       or (select count(*) from public.trial_requests where created_at > now() - interval '1 hour') >= 30
       or (select count(*) from public.trial_requests where status = 'pending') >= 200 then
        return jsonb_build_object('ok', false, 'code', 'busy');
    end if;

    insert into public.trial_requests (email, name, company, phone, use_type, instance, consent_at)
    values (mail, nm, left(trim(coalesce(p_company, '')), 160), left(trim(coalesce(p_phone, '')), 20),
            left(trim(coalesce(p_use, '')), 80), left(trim(coalesce(p_instance, '')), 80), now());
    return jsonb_build_object('ok', true, 'code', 'sent');
end;
$$;
grant execute on function public.trial_request(text, text, text, text, text, text, boolean, text) to anon, authenticated;


-- ── 4. แจ้ง Telegram เมื่อมีคำขอใหม่ (ไม่มีชื่อ/อีเมล/เบอร์ลูกค้าในข้อความ) ─────────
create or replace function public._trial_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare tg text[] := public._trial_tg(); tok text := tg[1]; chat text := tg[2]; n int;
begin
    if tok is null or chat is null then return new; end if;
    select count(*) into n from public.trial_requests where status = 'pending';
    begin
        perform net.http_post(
            url     := 'https://api.telegram.org/bot' || tok || '/sendMessage',
            body    := jsonb_build_object('chat_id', chat, 'disable_web_page_preview', true,
                         'text', '🎁 มีคำขอทดลองใช้ ASC Enterprise ใหม่ · รออนุมัติ ' || n || ' รายการ' || chr(10) ||
                                 'เปิด https://aisolar.dev/#settings/access'),
            headers := '{"Content-Type":"application/json"}'::jsonb,
            timeout_milliseconds := 20000);
    exception when others then
        raise warning 'trial notify: %', sqlerrm;    -- ส่งไม่ได้ไม่ขวางคำขอ (แอดมินยังเห็นป้ายแดงในเว็บ)
    end;
    return new;
end;
$$;
drop trigger if exists trial_requests_notify on public.trial_requests;
create trigger trial_requests_notify after insert on public.trial_requests
    for each row execute function public._trial_notify();


-- ── 5. หน้าผู้ดูแล: รายการคำขอ + ตรวจซ้ำ ────────────────────────────────────
create or replace function public.trial_admin_list()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
    perform public._access_admin_only();
    return jsonb_build_object(
        'turnstile', public._trial_secret('turnstile_secret') is not null,
        'telegram',  (select t[1] is not null and t[2] is not null from (select public._trial_tg() as t) z),
        'pending', coalesce((
            select jsonb_agg(x order by (x->>'createdAt') desc) from (
                select jsonb_build_object(
                    'id', r.id, 'email', r.email, 'name', r.name, 'company', r.company, 'phone', r.phone,
                    'use', r.use_type, 'createdAt', r.created_at,
                    'dup', jsonb_strip_nulls(jsonb_build_object(
                        -- อีเมลเคยอยู่ในรายชื่อ / เคยขอแล้ว
                        'email', case
                            when exists (select 1 from public.allowed_emails e where lower(e.email) = lower(r.email)) then 'listed'
                            when exists (select 1 from public.trial_requests o where lower(o.email) = lower(r.email) and o.id <> r.id and o.status = 'approved') then 'approved'
                            when exists (select 1 from public.trial_requests o where lower(o.email) = lower(r.email) and o.id <> r.id and o.status = 'rejected') then 'rejected' end,
                        -- เบอร์เดียวกับคำขออื่น (คนละอีเมล)
                        'phone', (select o.email from public.trial_requests o
                                   where o.id <> r.id and lower(o.email) <> lower(r.email)
                                     and regexp_replace(o.phone, '\D', '', 'g') = regexp_replace(r.phone, '\D', '', 'g')
                                   order by o.created_at desc limit 1),
                        -- เบราว์เซอร์/เครื่องเดียวกับคำขออื่นหรือบัญชีอื่น
                        'device', case when r.instance = '' then null else coalesce(
                            (select o.email from public.trial_requests o where o.id <> r.id and o.instance = r.instance and lower(o.email) <> lower(r.email) order by o.created_at desc limit 1),
                            (select s.email from public.access_sessions s where s.instance = r.instance and s.email <> lower(r.email) limit 1)) end
                    ))) as x
                  from public.trial_requests r where r.status = 'pending') q), '[]'::jsonb),
        'history', coalesce((
            select jsonb_agg(jsonb_build_object('id', h.id, 'email', h.email, 'status', h.status, 'decidedAt', h.decided_at,
                                                'by', (select coalesce(nullif(p.display_name, ''), p.email) from public.profiles p where p.id = h.decided_by),
                                                'mailSent', h.mail_sent_at is not null) order by h.decided_at desc)
              from (select * from public.trial_requests where status <> 'pending' order by decided_at desc limit 30) h), '[]'::jsonb));
end;
$$;
revoke all on function public.trial_admin_list() from public, anon;
grant execute on function public.trial_admin_list() to authenticated;

-- อนุมัติ / ปฏิเสธ (อนุมัติ = เพิ่มเข้ารายชื่อ · ส่งอีเมลเป็นหน้าที่ของหน้าเว็บต่อจากนี้)
create or replace function public.trial_decide(p_id bigint, p_approve boolean)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare r public.trial_requests;
begin
    perform public._access_admin_only();
    select * into r from public.trial_requests where id = p_id for update;
    if r.id is null then raise exception 'ไม่พบคำขอนี้'; end if;
    if r.status <> 'pending' then return jsonb_build_object('ok', false, 'code', 'done', 'status', r.status, 'email', r.email); end if;

    update public.trial_requests set status = case when p_approve then 'approved' else 'rejected' end,
           decided_at = now(), decided_by = auth.uid() where id = p_id;
    if p_approve then
        insert into public.allowed_emails (email, note)
        values (lower(r.email), left('ขอทดลองจากเว็บ ' || to_char(now() at time zone 'Asia/Bangkok', 'DD/MM/YYYY') || ' · ' || r.name ||
                                     case when r.company <> '' then ' · ' || r.company else '' end || ' · ' || r.phone, 300))
        on conflict (email) do nothing;
        insert into public.account_access (email, source) values (lower(r.email), 'ขอทดลองจากเว็บ')
        on conflict (email) do update set source = case when public.account_access.source = '' then 'ขอทดลองจากเว็บ' else public.account_access.source end;
    end if;
    insert into public.access_log (actor, email, action, detail)
    values (auth.uid(), lower(r.email), case when p_approve then 'trial_approve' else 'trial_reject' end, jsonb_build_object('request', p_id));
    return jsonb_build_object('ok', true, 'email', lower(r.email), 'status', case when p_approve then 'approved' else 'rejected' end);
end;
$$;
revoke all on function public.trial_decide(bigint, boolean) from public, anon;
grant execute on function public.trial_decide(bigint, boolean) to authenticated;

-- หน้าเว็บส่งลิงก์เข้าใช้สำเร็จ → บันทึกไว้ (ประวัติขึ้น "ส่งอีเมลแล้ว")
create or replace function public.trial_mail_sent(p_id bigint)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
    perform public._access_admin_only();
    update public.trial_requests set mail_sent_at = now() where id = p_id and status = 'approved';
end;
$$;
revoke all on function public.trial_mail_sent(bigint) from public, anon;
grant execute on function public.trial_mail_sent(bigint) to authenticated;


-- ตรวจผล:
--   select public.trial_config();
--   select public.trial_admin_list();        -- (รันใน SQL Editor ไม่ผ่าน _access_admin_only ใช้ทดสอบผ่านหน้าเว็บแทน)
--   select id, email, status, created_at from public.trial_requests order by id desc limit 20;
