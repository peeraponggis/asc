-- ============================================================================
--  Pi monitor ขั้น 3 (ฝั่ง ASC) — รับสถานะการใช้งานของ Pi-System มารวมในรายงานเดียว
--  (ลุงพีสั่ง 1 พ.ย. 2569 · ต้องรัน presence.sql และ pi-monitor-telegram.sql ก่อน)
--  ----------------------------------------------------------------------------
--  วิธีใช้ : Supabase Dashboard (โปรเจกต์ ASC Cloud) > SQL Editor > New query > วางทั้งไฟล์ > Run  (รันซ้ำได้ ไม่พัง)
--
--  ทำไมต้องรับข้ามโปรเจกต์: Pi-System ล็อกอินกับ Supabase อีกโปรเจกต์ (zloxphgxhttrtgqlafsz)
--    ผู้ใช้ Pi จึงไม่มีบัญชีในโปรเจกต์นี้ → ฝั่ง Pi เก็บสถานะเอง แล้ว pg_cron ส่งต่อมาที่ presence_ingest() ทุก 1 นาที
--    ยืนยันด้วยรหัสลับร่วม (Vault ชื่อ pi_ingest_secret ที่นี่ = asc_ingest_secret ที่ฝั่ง Pi)
--  แถวของ Pi: session_id ขึ้นต้น 'pi:' · user_id ว่าง (บัญชีอยู่อีกโปรเจกต์) · app = 'PI' · source = 'pi'
--  รายงาน Telegram/มุมมอง presence_status ใช้แถวเหล่านี้เหมือนของ ASC ทุกอย่าง (แอดมินเห็น · ผู้ใช้ทั่วไปไม่เห็น)
-- ============================================================================

alter table public.app_presence alter column user_id drop not null;
alter table public.app_presence add column if not exists source text not null default 'asc';

-- รหัสลับร่วม: สร้างครั้งแรกครั้งเดียว (รันซ้ำไม่สร้างใหม่) · ดูค่าเพื่อคัดลอกไปฝั่ง Pi ด้วยคำสั่งท้ายไฟล์
do $$
begin
    if not exists (select 1 from vault.secrets where name = 'pi_ingest_secret') then
        perform vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
                                    'pi_ingest_secret', 'Pi-System → ASC presence (Pi monitor)');
    end if;
end $$;

create or replace function public.presence_ingest(p_secret text, p_rows jsonb)
returns int language plpgsql volatile security definer set search_path = public as $$
declare
    want text;
    r jsonb;
    n int := 0;
    domain text := (select email_domain from public.monitor_settings where id = 1);
begin
    select decrypted_secret into want from vault.decrypted_secrets where name = 'pi_ingest_secret' limit 1;
    if want is null or p_secret is distinct from want then raise exception 'รหัสลับไม่ถูกต้อง'; end if;
    if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 500 then raise exception 'ข้อมูลไม่ถูกรูปแบบ'; end if;

    for r in select * from jsonb_array_elements(p_rows) loop
        continue when coalesce(r->>'session_id', '') = '' or lower(coalesce(r->>'email', '')) not like '%@' || coalesce(domain, 'proinventive.co.th');
        insert into public.app_presence as p
            (session_id, user_id, email, app, platform, version, page, started_at, last_seen, last_active, closed_at, source)
        values
            (left('pi:' || (r->>'session_id'), 64), null, lower(r->>'email'), 'PI',
             case when r->>'platform' in ('web', 'desktop', 'mobile') then r->>'platform' else 'web' end,
             left(coalesce(r->>'version', ''), 24), left(coalesce(r->>'page', ''), 80),
             coalesce((r->>'started_at')::timestamptz, now()),
             least(coalesce((r->>'last_seen')::timestamptz, now()), now()),
             least(coalesce((r->>'last_active')::timestamptz, now()), now()),
             (r->>'closed_at')::timestamptz, 'pi')
        on conflict (session_id) do update set
            email = excluded.email, platform = excluded.platform, version = excluded.version, page = excluded.page,
            last_seen = greatest(p.last_seen, excluded.last_seen),
            last_active = greatest(p.last_active, excluded.last_active),
            closed_at = excluded.closed_at
        where p.source = 'pi';                                   -- แถวของ ASC แตะไม่ได้
        n := n + 1;
    end loop;
    return n;
end;
$$;
revoke all on function public.presence_ingest(text, jsonb) from public, authenticated;
grant execute on function public.presence_ingest(text, jsonb) to anon;   -- ฝั่ง Pi เรียกด้วย publishable key · ด่านจริงคือรหัสลับ

-- ── ดูรหัสลับเพื่อคัดลอกไปฝั่ง Pi (รันบรรทัดนี้แยก · ห้ามส่งในแชต) ──
--  select decrypted_secret from vault.decrypted_secrets where name = 'pi_ingest_secret';
