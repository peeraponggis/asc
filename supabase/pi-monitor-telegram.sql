-- ============================================================================
--  Pi monitor ขั้น 2 — ส่งสรุปสถานะการใช้งานเข้ากลุ่ม Telegram "Pi monitor"
--  (ลุงพีสั่ง 1 พ.ย. 2569 · ต่อจาก presence.sql ซึ่งต้องรันก่อน)
--  ----------------------------------------------------------------------------
--  วิธีใช้ : Supabase Dashboard (โปรเจกต์ ASC Cloud) > SQL Editor > New query > วางทั้งไฟล์ > Run  (รันซ้ำได้ ไม่พัง)
--            ขั้นตอนเต็มทีละข้อ (ใส่ token · หารหัสกลุ่ม · ทดสอบ) อยู่ใน supabase/README.md หัวข้อ Pi monitor
--
--  ทำงานอย่างไร
--    pg_cron เรียก pi_monitor_tick() ทุก 1 นาที (ใน Supabase เอง ไม่พึ่งเครื่อง home)
--      · ครบ report_minutes (ค่าเริ่มต้น 10 · แก้ในตาราง monitor_settings) → แก้ "ข้อความสรุปที่ปักหมุด" ข้อความเดียว
--        (ครั้งแรกส่งใหม่แล้วปักหมุด · ข้อความถูกลบ = ส่งใหม่เอง) → กลุ่มไม่รก
--      · มีคนเข้าใช้/ออก (เปลี่ยน ออนไลน์ ↔ ออฟไลน์) → ส่งข้อความสั้นแจ้งแบบไม่มีเสียง (ปิดได้: alert_changes = false)
--    pg_net ยิงคำขอไป Telegram แบบไม่รอผล → รอบถัดไปค่อยอ่านผล (เช่นเลขข้อความที่จะปักหมุด)
--  token บอทเก็บใน Supabase Vault ชื่อ pi_monitor_bot_token — ไม่อยู่ในไฟล์นี้หรือในโค้ดหน้าเว็บ
--  ข้อความแสดงชื่อหน้าอีเมล (ก่อน @) + หน้า/เมนู · ไม่มีชื่อลูกค้า/โครงการ (หน้าเว็บไม่ส่งมาตั้งแต่ต้น)
-- ============================================================================

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ── ค่าตั้งเพิ่ม (ตารางเดิมจาก presence.sql) ───────────────────────────────
alter table public.monitor_settings
    add column if not exists telegram_enabled  boolean     not null default true,
    add column if not exists telegram_chat_id  text,                 -- ได้จาก pi_monitor_find_chat_result()
    add column if not exists alert_changes     boolean     not null default true,
    add column if not exists pinned_message_id bigint,               -- ข้อความสรุปที่ปักหมุด
    add column if not exists pending_send_id   bigint,               -- คำขอ sendMessage ที่รอผล (เอาเลขข้อความไปปักหมุด)
    add column if not exists pending_edit_id   bigint,               -- คำขอ editMessageText ที่รอผล (ข้อความหาย = ส่งใหม่)
    add column if not exists pending_find_id   bigint,               -- คำขอ getUpdates ตอนหารหัสกลุ่ม
    add column if not exists last_report_at    timestamptz;

-- ── สถานะล่าสุดที่แจ้งไปแล้ว (ไว้เทียบว่ามีคนเข้า/ออก) ─────────────────────
create table if not exists public.monitor_state (
    email      text        not null,
    app        text        not null,
    online     boolean     not null,
    updated_at timestamptz not null default now(),
    primary key (email, app)
);
alter table public.monitor_state enable row level security;
drop policy if exists monitor_state_select on public.monitor_state;
create policy monitor_state_select on public.monitor_state
    for select to authenticated using (public.is_admin());
revoke all on public.monitor_state from anon, authenticated;
grant select on public.monitor_state to authenticated;

-- ── token จาก Vault ─────────────────────────────────────────────────────────
create or replace function public.pi_monitor_token()
returns text language sql stable security definer set search_path = public, vault as $$
    select decrypted_secret from vault.decrypted_secrets
     where name = 'pi_monitor_bot_token' order by created_at desc limit 1;
$$;
revoke all on function public.pi_monitor_token() from public, anon, authenticated;

-- ── เรียก Telegram Bot API (ไม่รอผล · คืนเลขคำขอของ pg_net) ──────────────────
create or replace function public.pi_monitor_tg(p_method text, p_payload jsonb)
returns bigint language plpgsql volatile security definer set search_path = public as $$
declare tok text := public.pi_monitor_token();
begin
    if tok is null then return null; end if;
    return net.http_post(
        url     := 'https://api.telegram.org/bot' || tok || '/' || p_method,
        body    := p_payload,
        headers := '{"Content-Type": "application/json"}'::jsonb
    );
end;
$$;
revoke all on function public.pi_monitor_tg(text, jsonb) from public, anon, authenticated;

-- ผลของคำขอ (null = ยังไม่ได้คำตอบ)
create or replace function public.pi_monitor_resp(p_id bigint)
returns jsonb language sql stable security definer set search_path = public as $$
    select case when r.content is null or r.content = '' then null else r.content::jsonb end
      from net._http_response r where r.id = p_id;
$$;
revoke all on function public.pi_monitor_resp(bigint) from public, anon, authenticated;

-- ── หารหัสกลุ่ม "Pi monitor" (รันทีละบรรทัด: start → รอ 5 วินาที → result) ──
create or replace function public.pi_monitor_find_chat_start()
returns text language plpgsql volatile security definer set search_path = public as $$
declare tok text := public.pi_monitor_token(); req bigint;
begin
    if tok is null then return 'ยังไม่มี token ใน Vault ชื่อ pi_monitor_bot_token (ดู README ข้อใส่ token)'; end if;
    req := net.http_get(url := 'https://api.telegram.org/bot' || tok || '/getUpdates');
    update public.monitor_settings set pending_find_id = req where id = 1;
    return 'ส่งคำขอแล้ว รอ 5 วินาที แล้วรัน: select public.pi_monitor_find_chat_result();';
end;
$$;
revoke all on function public.pi_monitor_find_chat_start() from public, anon, authenticated;

create or replace function public.pi_monitor_find_chat_result()
returns text language plpgsql volatile security definer set search_path = public as $$
declare j jsonb; cid text; ctitle text;
begin
    j := public.pi_monitor_resp((select pending_find_id from public.monitor_settings where id = 1));
    if j is null then return 'ยังไม่ได้คำตอบจาก Telegram — รอ 5 วินาทีแล้วรันบรรทัดนี้ใหม่'; end if;
    if not coalesce((j->>'ok')::boolean, false) then return 'Telegram ตอบว่า: ' || coalesce(j->>'description', j::text); end if;
    -- ข้อความหรือการเพิ่มบอทเข้ากลุ่มล่าสุด · กลุ่มถูกยกเป็น supergroup = ใช้รหัสใหม่
    select coalesce(u->'message'->>'migrate_to_chat_id', c->>'id'), c->>'title'
      into cid, ctitle
      from jsonb_array_elements(j->'result') u
     cross join lateral (select coalesce(u->'message'->'chat', u->'my_chat_member'->'chat') as c) x
     where c->>'type' in ('group', 'supergroup') and c->>'title' ilike 'pi monitor%'
     order by (u->>'update_id')::bigint desc
     limit 1;
    if cid is null then
        return 'ไม่พบกลุ่ม Pi monitor — พิมพ์ข้อความใดก็ได้ในกลุ่ม 1 ข้อความ แล้วรัน start ใหม่';
    end if;
    update public.monitor_settings
       set telegram_chat_id = cid, pinned_message_id = null, pending_send_id = null, pending_edit_id = null,
           last_report_at = null, pending_find_id = null
     where id = 1;
    return 'พบกลุ่ม "' || ctitle || '" รหัส ' || cid || ' — บันทึกแล้ว ภายใน 1 นาทีจะมีข้อความสรุปในกลุ่ม';
end;
$$;
revoke all on function public.pi_monitor_find_chat_result() from public, anon, authenticated;

-- ── ข้อความสรุป ─────────────────────────────────────────────────────────────
--  คนละบรรทัดต่อ อีเมล+โปรแกรม (หลายแท็บเอาสถานะดีที่สุด) · เฉพาะที่มีสัญญาณใน 24 ชม.
create or replace function public.pi_monitor_text()
returns text language plpgsql stable security definer set search_path = public as $$
declare
    s public.monitor_settings;
    r record;
    body text := '';
    n_act int := 0; n_idle int := 0; n_off int := 0;
    t text;
begin
    select * into s from public.monitor_settings where id = 1;
    for r in
        with x as (
            select email, app, platform, page, status, idle_for_minutes, last_seen,
                   row_number() over (partition by email, app
                       order by case status when 'active' then 0 when 'idle' then 1 else 2 end, last_seen desc) as rn
              from public.presence_status
             where last_seen > now() - interval '24 hours'
        )
        select * from x where rn = 1
         order by case status when 'active' then 0 when 'idle' then 1 else 2 end, email, app
    loop
        if r.status = 'offline' then n_off := n_off + 1; continue; end if;
        if r.status = 'active' then n_act := n_act + 1; else n_idle := n_idle + 1; end if;
        body := body || case r.status when 'active' then '🟢 ' else '🟡 ' end
             || split_part(r.email, '@', 1) || ' · ' || r.page
             || case when r.platform = 'mobile' then ' 📱' else '' end
             || case when r.status = 'idle' then ' · ไม่ขยับ ' || r.idle_for_minutes || ' นาที' else '' end
             || E'\n';
    end loop;
    t := '📊 Pi monitor · ' || to_char(now() at time zone 'Asia/Bangkok', 'DD/MM HH24:MI') || ' น.'
      || E'\n(อัปเดตทุก ' || s.report_minutes || ' นาที)' || E'\n\n'
      || case when body = '' then 'ตอนนี้ไม่มีใครเปิดใช้งาน' || E'\n' else body end
      || E'\n🟢 ใช้งาน ' || n_act || ' · 🟡 เปิดทิ้งไว้ ' || n_idle || ' · ⚫ ออฟไลน์ (ใช้ใน 24 ชม.) ' || n_off;
    return left(t, 4000);                                         -- Telegram รับได้ 4,096 ตัวอักษร
end;
$$;
revoke all on function public.pi_monitor_text() from public, anon, authenticated;

-- ── แจ้งคนเข้าใช้/ออก (ออนไลน์ ↔ ออฟไลน์ · ไม่แจ้ง ใช้งาน ↔ เปิดทิ้งไว้) ──────
create or replace function public.pi_monitor_alerts(p_chat text)
returns int language plpgsql volatile security definer set search_path = public as $$
declare r record; lines text := ''; n int := 0;
begin
    for r in
        with cur as (
            select email, app,
                   bool_or(status <> 'offline') as online,
                   (array_agg(page order by last_seen desc))[1] as page
              from public.presence_status
             where last_seen > now() - interval '24 hours'
             group by email, app
        )
        select c.email, c.app, c.online, c.page, m.online as was
          from cur c left join public.monitor_state m using (email, app)
         where m.online is distinct from c.online
    loop
        if r.online then
            lines := lines || '➡️ เข้าใช้: ' || split_part(r.email, '@', 1) || ' · ' || r.page || E'\n';
        elsif r.was is not null then
            lines := lines || '⬅️ ออกแล้ว: ' || split_part(r.email, '@', 1) || ' · ' || r.app || E'\n';
        end if;
        insert into public.monitor_state (email, app, online, updated_at) values (r.email, r.app, r.online, now())
            on conflict (email, app) do update set online = excluded.online, updated_at = now();
        n := n + 1;
    end loop;
    if lines <> '' then
        perform public.pi_monitor_tg('sendMessage', jsonb_build_object(
            'chat_id', p_chat, 'text', left(rtrim(lines, E'\n'), 4000), 'disable_notification', true));
    end if;
    return n;
end;
$$;
revoke all on function public.pi_monitor_alerts(text) from public, anon, authenticated;

-- ── ทำงานทุก 1 นาที ─────────────────────────────────────────────────────────
create or replace function public.pi_monitor_tick()
returns text language plpgsql volatile security definer set search_path = public as $$
declare s public.monitor_settings; j jsonb; req bigint;
begin
    select * into s from public.monitor_settings where id = 1 for update;
    if not s.telegram_enabled or s.telegram_chat_id is null or public.pi_monitor_token() is null then return 'off'; end if;

    -- 1) ผลของการส่งข้อความสรุปครั้งแรก → ปักหมุด
    if s.pending_send_id is not null then
        j := public.pi_monitor_resp(s.pending_send_id);
        if j is not null then
            if coalesce((j->>'ok')::boolean, false) then
                s.pinned_message_id := (j->'result'->>'message_id')::bigint;
                perform public.pi_monitor_tg('pinChatMessage', jsonb_build_object(
                    'chat_id', s.telegram_chat_id, 'message_id', s.pinned_message_id, 'disable_notification', true));
            elsif j->'parameters'->>'migrate_to_chat_id' is not null then
                s.telegram_chat_id := j->'parameters'->>'migrate_to_chat_id';   -- กลุ่มถูกยกเป็น supergroup
                s.last_report_at := null;
            end if;
            s.pending_send_id := null;
        elsif now() - coalesce(s.last_report_at, now()) > interval '10 minutes' then
            s.pending_send_id := null;                                          -- คำขอหาย = ลองใหม่
        end if;
    end if;

    -- 2) ผลของการแก้ข้อความสรุป → ข้อความถูกลบ/แก้ไม่ได้ = ส่งใหม่รอบหน้า
    if s.pending_edit_id is not null then
        j := public.pi_monitor_resp(s.pending_edit_id);
        if j is not null then
            if not coalesce((j->>'ok')::boolean, false) and coalesce(j->>'description', '') not ilike '%not modified%' then
                s.pinned_message_id := null;
                s.last_report_at := null;
            end if;
            s.pending_edit_id := null;
        end if;
    end if;

    -- 3) คนเข้าใช้/ออก
    if s.alert_changes then perform public.pi_monitor_alerts(s.telegram_chat_id); end if;

    -- 4) สรุปทุก report_minutes นาที
    if s.last_report_at is null or now() - s.last_report_at >= make_interval(mins => s.report_minutes) - interval '20 seconds' then
        if s.pinned_message_id is null then
            if s.pending_send_id is null then
                s.pending_send_id := public.pi_monitor_tg('sendMessage', jsonb_build_object(
                    'chat_id', s.telegram_chat_id, 'text', public.pi_monitor_text(), 'disable_notification', true));
                s.last_report_at := now();
            end if;
        else
            s.pending_edit_id := public.pi_monitor_tg('editMessageText', jsonb_build_object(
                'chat_id', s.telegram_chat_id, 'message_id', s.pinned_message_id, 'text', public.pi_monitor_text()));
            s.last_report_at := now();
        end if;
    end if;

    update public.monitor_settings
       set telegram_chat_id = s.telegram_chat_id, pinned_message_id = s.pinned_message_id,
           pending_send_id = s.pending_send_id, pending_edit_id = s.pending_edit_id, last_report_at = s.last_report_at
     where id = 1;
    return 'ok';
end;
$$;
revoke all on function public.pi_monitor_tick() from public, anon, authenticated;

-- ── ส่งข้อความทดสอบ (รันมือ) ────────────────────────────────────────────────
create or replace function public.pi_monitor_test()
returns text language plpgsql volatile security definer set search_path = public as $$
declare c text := (select telegram_chat_id from public.monitor_settings where id = 1);
begin
    if public.pi_monitor_token() is null then return 'ยังไม่มี token ใน Vault ชื่อ pi_monitor_bot_token'; end if;
    if c is null then return 'ยังไม่มีรหัสกลุ่ม — รัน pi_monitor_find_chat_start() ก่อน'; end if;
    perform public.pi_monitor_tg('sendMessage', jsonb_build_object('chat_id', c,
        'text', '✅ Pi monitor เชื่อมต่อแล้ว · สรุปสถานะการใช้งาน ASCS/ASCA จะอัปเดตในข้อความที่ปักหมุดทุก '
                || (select report_minutes from public.monitor_settings where id = 1) || ' นาที'));
    return 'ส่งข้อความทดสอบแล้ว — ดูในกลุ่ม Pi monitor';
end;
$$;
revoke all on function public.pi_monitor_test() from public, anon, authenticated;

-- ── ตั้งเวลา (ชื่องานเดิม = แทนที่ · รันซ้ำได้) ──────────────────────────────
select cron.schedule('pi-monitor-tick',    '* * * * *',  'select public.pi_monitor_tick()');
select cron.schedule('pi-monitor-cleanup', '15 20 * * *', 'select public.presence_cleanup()');  -- 03:15 น. เวลาไทย (20:15 UTC)
