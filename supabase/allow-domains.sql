-- ============================================================================
--  อนุญาตทั้งโดเมนอีเมล (ลุงพีสั่ง 30 ต.ค. 2569: @proinventive.co.th = ทีมพัฒนา)
--  ----------------------------------------------------------------------------
--  วิธีใช้ : Supabase Dashboard > SQL Editor > New query > วางทั้งไฟล์ > Run  (รันซ้ำได้ ไม่พัง)
--
--  เดิมสมัครได้เฉพาะอีเมลที่อยู่ในตาราง allowed_emails ทีละรายชื่อ
--  ไฟล์นี้เพิ่มตาราง allowed_domains → อีเมลที่ลงท้ายด้วยโดเมนในตารางสมัครได้เลย ไม่ต้องเพิ่มทีละคน
--  ด่านเดิมยังอยู่ครบ: ทริกเกอร์ enforce_invite_only + ฟังก์ชัน is_email_allowed (หน้าสมัครถามก่อน)
--
--  ⚠ ต้องเปิด "Confirm email" ไว้ (Authentication > Sign In / Providers > Email)
--    ไม่งั้นใครก็พิมพ์อีเมล @proinventive.co.th ปลอมแล้วสมัครได้โดยไม่ต้องเป็นเจ้าของกล่องอีเมล
--
--  เพิ่ม/ลบโดเมนภายหลัง:
--      insert into public.allowed_domains (domain, note) values ('example.co.th', 'ทีม …') on conflict do nothing;
--      delete from public.allowed_domains where domain = 'example.co.th';
-- ============================================================================

create table if not exists public.allowed_domains (
    domain     text primary key,                -- ตัวพิมพ์เล็ก ไม่มี @ เช่น proinventive.co.th
    note       text        not null default '',
    created_at timestamptz not null default now()
);
alter table public.allowed_domains enable row level security;

drop policy if exists allowed_domains_select on public.allowed_domains;
create policy allowed_domains_select on public.allowed_domains
    for select to authenticated using (public.is_admin());

drop policy if exists allowed_domains_write on public.allowed_domains;
create policy allowed_domains_write on public.allowed_domains
    for all to authenticated
    using (public.is_admin()) with check (public.is_admin());

revoke all on public.allowed_domains from anon;

insert into public.allowed_domains (domain, note)
values ('proinventive.co.th', 'ทีมพัฒนา')
on conflict (domain) do nothing;

-- อีเมลนี้สมัครได้ไหม: อยู่ในรายชื่อ หรือ โดเมนอยู่ในตารางโดเมน
create or replace function public.is_email_allowed(p_email text)
returns boolean language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.allowed_emails  where email  = lower(trim(p_email)))
        or exists (select 1 from public.allowed_domains where domain = split_part(lower(trim(p_email)), '@', 2));
$$;

grant execute on function public.is_email_allowed(text) to anon, authenticated;

-- ด่านบังคับตอนสร้างบัญชีใหม่ (ใช้กติกาเดียวกับ is_email_allowed)
create or replace function public.enforce_invite_only()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    if new.email is null or not public.is_email_allowed(new.email) then
        raise exception 'อีเมลนี้ไม่อยู่ในรายชื่อที่ได้รับเชิญ ติดต่อผู้ดูแลระบบ (%)', new.email
            using errcode = 'check_violation';
    end if;
    return new;
end;
$$;

-- ตรวจผล: ต้องได้ true · false
-- select public.is_email_allowed('someone@proinventive.co.th') as team, public.is_email_allowed('someone@example.com') as other;
