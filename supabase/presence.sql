-- ============================================================================
--  Pi monitor ขั้น 1 — สถานะการใช้งาน ASCS / ASCA (ผู้ใช้ @proinventive.co.th)
--  (ลุงพีสั่ง 1 พ.ย. 2569 · "ตำแหน่งที่ใช้งาน" = หน้า/เมนูในโปรแกรม ไม่เก็บที่ตั้งจริง)
--  ----------------------------------------------------------------------------
--  วิธีใช้ : Supabase Dashboard (โปรเจกต์ ASC Cloud) > SQL Editor > New query > วางทั้งไฟล์ > Run  (รันซ้ำได้ ไม่พัง)
--            ต้องรัน schema.sql มาก่อน (ใช้ public.is_admin())
--
--  ลำดับงาน
--    1. หน้าเว็บที่ล็อกอินแล้ว (asc-cloud.js) เรียก presence_ping() ทุก 60 วินาที + ทันทีที่เปลี่ยนหน้า/เมนู
--       ส่ง: รหัสแท็บ (สุ่มต่อแท็บ) · โปรแกรม · ช่องทาง · เวอร์ชัน · หน้า/เมนู · ขยับเมาส์/พิมพ์ในรอบนี้ไหม
--    2. ฟังก์ชันเติมอีเมลจากบัญชีเอง (ผู้ใช้ปลอมอีเมลไม่ได้) และเก็บเฉพาะอีเมล @proinventive.co.th
--    3. มุมมอง presence_status คิดสถานะ 🟢 ใช้งานอยู่ / 🟡 เปิดทิ้งไว้ / ⚫ ออฟไลน์ จากเวลาล่าสุด
--       ตามเกณฑ์ในตาราง monitor_settings (แก้ตัวเลขได้เอง ไม่ต้องแก้โค้ด)
--    4. ขั้น 2 (ทีหลัง): pg_cron + pg_net สรุปส่งกลุ่ม Telegram "Pi monitor" ทุก report_minutes นาที
--  ไม่เก็บ: ที่ตั้ง · IP · ชื่อลูกค้า/โครงการ (หน้าเว็บส่งแค่ชื่อหน้า/เมนู ตัดเหลือ 80 ตัวอักษร)
-- ============================================================================

-- ── ค่าตั้ง (แถวเดียว id = 1) ─────────────────────────────────────────────
create table if not exists public.monitor_settings (
    id              int         primary key default 1 check (id = 1),
    report_minutes  int         not null default 10 check (report_minutes  between 1 and 1440),  -- ส่งสรุปเข้า Telegram ทุกกี่นาที (ขั้น 2)
    idle_minutes    int         not null default 10 check (idle_minutes    between 1 and 240),   -- ไม่ขยับเกินนี้ = 🟡 เปิดทิ้งไว้
    offline_minutes int         not null default 3  check (offline_minutes between 2 and 60),    -- ไม่มีสัญญาณเกินนี้ = ⚫ ออฟไลน์
    retention_days  int         not null default 90 check (retention_days  between 7 and 3650),  -- ลบประวัติเก่ากว่านี้ (PDPA)
    email_domain    text        not null default 'proinventive.co.th',
    updated_at      timestamptz not null default now()
);
insert into public.monitor_settings (id) values (1) on conflict (id) do nothing;

alter table public.monitor_settings enable row level security;
drop policy if exists monitor_settings_select on public.monitor_settings;
create policy monitor_settings_select on public.monitor_settings
    for select to authenticated using (public.is_admin());
drop policy if exists monitor_settings_update on public.monitor_settings;
create policy monitor_settings_update on public.monitor_settings
    for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.monitor_settings from anon, authenticated;
grant select, update on public.monitor_settings to authenticated;

-- ── สถานะต่อแท็บ/หน้าต่าง ─────────────────────────────────────────────────
create table if not exists public.app_presence (
    session_id  text        primary key check (length(session_id) between 8 and 64),  -- สุ่มต่อแท็บ (sessionStorage)
    user_id     uuid        not null references auth.users(id) on delete cascade,
    email       text        not null,
    app         text        not null check (app in ('ASCS', 'ASCA', 'PI')),
    platform    text        not null default 'web' check (platform in ('web', 'desktop', 'mobile')),
    version     text        not null default '',
    page        text        not null default '',
    started_at  timestamptz not null default now(),
    last_seen   timestamptz not null default now(),   -- สัญญาณล่าสุด (แท็บยังเปิด)
    last_active timestamptz not null default now(),   -- ขยับเมาส์/พิมพ์ล่าสุด
    closed_at   timestamptz                           -- ปิดแท็บ/ออกจากระบบ (ถ้าส่งทัน)
);
create index if not exists app_presence_last_seen on public.app_presence (last_seen desc);
create index if not exists app_presence_user      on public.app_presence (user_id);

alter table public.app_presence enable row level security;
-- อ่านได้: ของตัวเอง หรือแอดมิน · เขียนผ่าน presence_ping() เท่านั้น
drop policy if exists app_presence_select on public.app_presence;
create policy app_presence_select on public.app_presence
    for select to authenticated using (user_id = auth.uid() or public.is_admin());
revoke all on public.app_presence from anon, authenticated;
grant select on public.app_presence to authenticated;

-- ── ส่งสถานะ ───────────────────────────────────────────────────────────────
--  คืน 'ok' · 'skip' (อีเมลนอกโดเมนที่ติดตาม) · error ถ้าไม่ได้ล็อกอิน
create or replace function public.presence_ping(
    p_session  text,
    p_app      text,
    p_platform text    default 'web',
    p_version  text    default '',
    p_page     text    default '',
    p_active   boolean default true,
    p_closed   boolean default false
) returns text language plpgsql volatile security definer set search_path = public as $$
declare
    uid    uuid := auth.uid();
    mail   text;
    domain text;
begin
    if uid is null then raise exception 'ต้องเข้าสู่ระบบก่อน'; end if;
    select lower(u.email) into mail from auth.users u where u.id = uid;
    select s.email_domain into domain from public.monitor_settings s where s.id = 1;
    if mail is null or mail not like '%@' || coalesce(domain, 'proinventive.co.th') then return 'skip'; end if;

    insert into public.app_presence as p
        (session_id, user_id, email, app, platform, version, page, last_seen, last_active, closed_at)
    values
        (left(p_session, 64), uid, mail, upper(p_app), coalesce(nullif(p_platform, ''), 'web'),
         left(coalesce(p_version, ''), 24), left(coalesce(p_page, ''), 80),
         now(), now(), case when p_closed then now() end)
    on conflict (session_id) do update set
        app         = excluded.app,
        platform    = excluded.platform,
        version     = excluded.version,
        page        = excluded.page,
        last_seen   = now(),
        last_active = case when p_active then now() else p.last_active end,
        closed_at   = case when p_closed then now() else null end
    where p.user_id = uid;                            -- รหัสแท็บของคนอื่น = ไม่แตะ
    return 'ok';
end;
$$;
revoke all on function public.presence_ping(text, text, text, text, text, boolean, boolean) from public, anon;
grant execute on function public.presence_ping(text, text, text, text, text, boolean, boolean) to authenticated;

-- ── มุมมองสถานะ (คนละแถวต่อแท็บ) ──────────────────────────────────────────
--  security_invoker = ใช้สิทธิ์ของคนที่อ่าน → ผู้ใช้ทั่วไปเห็นเฉพาะของตัวเอง แอดมินเห็นทั้งหมด
create or replace view public.presence_status with (security_invoker = true) as
select p.session_id, p.email, p.app, p.platform, p.version, p.page,
       p.started_at, p.last_seen, p.last_active, p.closed_at,
       case
           when p.closed_at is not null
             or p.last_seen < now() - make_interval(mins => s.offline_minutes) then 'offline'
           when p.last_active < now() - make_interval(mins => s.idle_minutes)  then 'idle'
           else 'active'
       end as status,
       floor(extract(epoch from now() - p.last_active) / 60)::int as idle_for_minutes
from public.app_presence p
cross join public.monitor_settings s
where s.id = 1;
grant select on public.presence_status to authenticated;

-- ── ล้างประวัติเก่า (ขั้น 2 ตั้ง pg_cron เรียกวันละครั้ง · รันมือได้) ──────────
create or replace function public.presence_cleanup()
returns int language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
    delete from public.app_presence p
     using public.monitor_settings s
     where s.id = 1 and p.last_seen < now() - make_interval(days => s.retention_days);
    get diagnostics n = row_count;
    return n;
end;
$$;
revoke all on function public.presence_cleanup() from public, anon, authenticated;
