-- ============================================================================
--  presence-users.sql — Pi monitor: ผู้ใช้ภายนอก (ไม่ใช่ทีมงาน)
--  ลุงพีสั่ง 15 พ.ย. 2569
--
--  เดิม presence_ping() บันทึกเฉพาะอีเมลในโดเมนของทีม (monitor_settings.email_domain)
--  คนนอกทีมถูกข้ามทั้งหมด จึงไม่รู้เลยว่ามีใครเข้ามาใช้บ้าง
--
--  ไฟล์นี้เพิ่ม
--    1. guest_presence       — แถวต่อแท็บของคนนอกทีม (ใช้นับว่า "เข้า-ออก" ครั้งเดียวกันหรือครั้งใหม่)
--    2. presence_user_stats  — ยอดสะสมต่ออีเมล: เข้ามากี่ครั้ง · ครั้งแรกเมื่อไร · ครั้งล่าสุดเมื่อไร นานกี่นาที
--    3. presence_ping()      — ฉบับใหม่: คนในทีมทำงานเหมือนเดิมทุกอย่าง · คนนอกทีมบันทึกลง 2 ตารางข้างบน
--    4. presence_guests      — มุมมองสำหรับหน้า Pi monitor (ผู้ดูแลระบบเท่านั้น)
--    5. presence_cleanup()   — ล้างแถวแท็บเก่าของคนนอกด้วย แต่ "ยอดสะสมไม่ลบ" (ถึงปัจจุบันจริง ๆ)
--
--  ความปลอดภัย/ความเป็นส่วนตัว: เก็บอีเมล · โปรแกรม · ช่องทาง · เวลา เท่านั้น
--  ไม่เก็บ IP ไม่เก็บที่ตั้ง ไม่เก็บชื่อหน้า/เมนูของคนนอกทีม
--
--  วิธีรัน: เปิด SQL Editor ของโครงการ ASC Cloud แล้ววางทั้งไฟล์ กด Run ครั้งเดียว
--           https://supabase.com/dashboard/project/rcaslesvgilknupqmwrp/sql/new
--  รันซ้ำได้ ไม่ทำข้อมูลเดิมหาย
-- ============================================================================

-- ── 1. แท็บของคนนอกทีม (อายุสั้น ล้างตาม retention_days เหมือน app_presence) ──
create table if not exists public.guest_presence (
    session_id text primary key check (length(session_id) between 8 and 64),
    email      text        not null,
    app        text        not null default '',
    platform   text        not null default 'web',
    version    text        not null default '',
    started_at timestamptz not null default now(),
    last_seen  timestamptz not null default now()
);
create index if not exists guest_presence_last_seen on public.guest_presence (last_seen desc);
create index if not exists guest_presence_email     on public.guest_presence (email);

alter table public.guest_presence enable row level security;
drop policy if exists guest_presence_select on public.guest_presence;
create policy guest_presence_select on public.guest_presence
    for select to authenticated using (public.is_admin());
revoke all on public.guest_presence from anon, authenticated;
grant select on public.guest_presence to authenticated;

-- ── 2. ยอดสะสมต่ออีเมล (ไม่ถูกล้าง) ──────────────────────────────────────
create table if not exists public.presence_user_stats (
    email          text        primary key,
    is_team        boolean     not null default false,         -- true = อีเมลในโดเมนของทีม
    visits         int         not null default 0,             -- เข้า-ออก นับ 1 ครั้ง (นับตามรหัสแท็บ)
    first_seen     timestamptz not null default now(),
    last_seen      timestamptz not null default now(),
    last_started_at timestamptz,                               -- เริ่มครั้งล่าสุด
    last_minutes   int         not null default 0,             -- ครั้งล่าสุดใช้งานกี่นาที
    last_app       text        not null default '',
    last_platform  text        not null default ''
);
create index if not exists presence_user_stats_last on public.presence_user_stats (last_seen desc);

alter table public.presence_user_stats enable row level security;
drop policy if exists presence_user_stats_select on public.presence_user_stats;
create policy presence_user_stats_select on public.presence_user_stats
    for select to authenticated using (public.is_admin());
revoke all on public.presence_user_stats from anon, authenticated;
grant select on public.presence_user_stats to authenticated;

-- ── 3. presence_ping ฉบับใหม่ ────────────────────────────────────────────
--  คนในทีม  : พฤติกรรมเดิมทุกอย่าง (app_presence + ตารางสด + Telegram) และบันทึกยอดสะสมเพิ่ม
--  คนนอกทีม : ไม่แตะ app_presence (ตารางสด/Telegram เหมือนเดิม) · บันทึก guest_presence + ยอดสะสม · คืนค่า 'guest'
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
    v_sid  text := left(p_session, 64);
    v_plat text := coalesce(nullif(p_platform, ''), 'web');
    v_app  text := upper(coalesce(p_app, ''));
    v_team boolean;
    v_new  boolean;
    v_from timestamptz;
begin
    if uid is null then raise exception 'ต้องเข้าสู่ระบบก่อน'; end if;
    select lower(u.email) into mail from auth.users u where u.id = uid;
    if mail is null then return 'skip'; end if;
    select s.email_domain into domain from public.monitor_settings s where s.id = 1;
    v_team := mail like '%@' || coalesce(domain, 'proinventive.co.th');

    if v_team then
        insert into public.app_presence as p
            (session_id, user_id, email, app, platform, version, page, last_seen, last_active, closed_at)
        values
            (v_sid, uid, mail, v_app, v_plat,
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
        where p.user_id = uid                          -- รหัสแท็บของคนอื่น = ไม่แตะ
        returning (xmax = 0), p.started_at into v_new, v_from;
    else
        insert into public.guest_presence as g
            (session_id, email, app, platform, version, last_seen)
        values
            (v_sid, mail, v_app, v_plat, left(coalesce(p_version, ''), 24), now())
        on conflict (session_id) do update set
            app = excluded.app, platform = excluded.platform, version = excluded.version, last_seen = now()
        where g.email = mail
        returning (xmax = 0), g.started_at into v_new, v_from;
    end if;

    -- แท็บของคนอื่น (where ไม่ผ่าน) = ไม่มีแถวคืนมา ไม่ต้องนับ
    if v_new is null then return 'skip'; end if;

    insert into public.presence_user_stats as u
        (email, is_team, visits, first_seen, last_seen, last_started_at, last_minutes, last_app, last_platform)
    values
        (mail, v_team, 1, coalesce(v_from, now()), now(), coalesce(v_from, now()), 0, v_app, v_plat)
    on conflict (email) do update set
        is_team         = v_team,
        visits          = u.visits + case when v_new then 1 else 0 end,
        last_seen       = now(),
        last_started_at = coalesce(v_from, u.last_started_at, now()),
        last_minutes    = greatest(0, floor(extract(epoch from now() - coalesce(v_from, u.last_started_at, now())) / 60))::int,
        last_app        = v_app,
        last_platform   = v_plat;

    return case when v_team then 'ok' else 'guest' end;
end;
$$;
revoke all on function public.presence_ping(text, text, text, text, text, boolean, boolean) from public, anon;
grant execute on function public.presence_ping(text, text, text, text, text, boolean, boolean) to authenticated;

-- ── 4. มุมมองสำหรับหน้า Pi monitor ───────────────────────────────────────
create or replace view public.presence_guests with (security_invoker = true) as
select u.email, u.visits, u.first_seen, u.last_seen, u.last_minutes, u.last_app, u.last_platform,
       floor(extract(epoch from now() - u.last_seen) / 60)::int as since_minutes
from public.presence_user_stats u
where u.is_team = false
order by u.last_seen desc;
grant select on public.presence_guests to authenticated;

-- ── 5. ล้างแท็บเก่าของคนนอก (ยอดสะสมไม่ลบ) ───────────────────────────────
create or replace function public.presence_cleanup()
returns int language plpgsql volatile security definer set search_path = public as $$
declare n int; m int;
begin
    delete from public.app_presence p
     using public.monitor_settings s
     where s.id = 1 and p.last_seen < now() - make_interval(days => s.retention_days);
    get diagnostics n = row_count;
    delete from public.guest_presence g
     using public.monitor_settings s
     where s.id = 1 and g.last_seen < now() - make_interval(days => s.retention_days);
    get diagnostics m = row_count;
    return n + m;
end;
$$;
revoke all on function public.presence_cleanup() from public, anon, authenticated;

-- ตรวจผล: ต้องได้ 2 ตาราง + 1 มุมมอง
-- select table_name from information_schema.tables where table_name in ('guest_presence','presence_user_stats');
-- select * from public.presence_guests limit 20;
