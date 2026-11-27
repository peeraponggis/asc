-- ============================================================================
--  ASC · อัตราค่าไฟฟ้า กฟภ./กฟน. ที่ผู้ดูแลระบบดูแล (ชุดปัจจุบัน + ย้อนหลัง) + งวด Ft
--
--  ที่มา  ลุงพีอนุมัติหน้าตัวอย่าง 27 พ.ย. 2569 (design-auto/docs/mockup-tariff-admin.html)
--         กฟภ./กฟน./กกพ. ไม่มี API อัตราค่าไฟ — ประกาศเป็น PDF → แอดมินนำเข้า/ตรวจ/เผยแพร่ที่นี่
--         ASC Studio (เว็บ + เดสก์ท็อป) ดึงชุดที่เผยแพร่ไปคิดค่าไฟ · ไม่มีชุดบนคลาวด์ = ใช้ชุดที่มากับโปรแกรม
--
--  วิธีใช้  Supabase Dashboard > SQL Editor > New query > วางทั้งไฟล์ > Run (รันซ้ำได้)
--          https://supabase.com/dashboard/project/rcaslesvgilknupqmwrp/sql/new
--          ต้องมีฟังก์ชัน public.is_admin() (schema.sql) อยู่ก่อน
--
--  สิทธิ์   อ่าน: ทุกคน (anon + authenticated) เห็นเฉพาะชุดที่เผยแพร่ — อัตราค่าไฟเป็นข้อมูลสาธารณะของรัฐ
--               เดสก์ท็อปที่ยังไม่ผูกบัญชีก็ดึงได้ · ร่างเห็นเฉพาะแอดมิน
--          เขียน: แอดมินเท่านั้น · ชุดที่เผยแพร่แล้วแก้ตัวเลขไม่ได้ (งานเก่าที่อ้างชุดนั้นคิดซ้ำได้ค่าเดิมเสมอ)
--                 ต้องออกชุดใหม่แทน · ยกเลิกการเผยแพร่ได้ (status = retired) แต่ไม่ลบ
--          ทุกการแก้ลงบันทึก tariff_audit (ใคร · เมื่อไร · ค่าเดิม → ค่าใหม่)
-- ============================================================================

create table if not exists public.tariff_sets (
    id             uuid        primary key default gen_random_uuid(),
    utility        text        not null default 'ALL' check (utility in ('ALL', 'PEA', 'MEA')),
    effective_from date        not null,                          -- มีผลตั้งแต่ (ถึง = วันก่อนชุดถัดไปของการไฟฟ้าเดียวกัน)
    label          text        not null default '',
    source         text        not null default '',               -- ชื่อ/เลขประกาศ · ไฟล์ PDF
    note           text        not null default '',
    rates          jsonb       not null,                          -- โครงเดียวกับ PEA_RATES ใน design-auto/src/energy/thTariff.ts
    status         text        not null default 'draft' check (status in ('draft', 'published', 'retired')),
    created_by     uuid        default auth.uid(),
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),
    published_at   timestamptz
);
create index if not exists tariff_sets_pub on public.tariff_sets (status, utility, effective_from);

create table if not exists public.ft_periods (
    id              uuid        primary key default gen_random_uuid(),
    period_from     date        not null,
    period_to       date        not null check (period_to >= period_from),
    ft_satang       numeric     not null,                         -- Ft ที่เรียกเก็บ (สตางค์/หน่วย) · ติดลบได้
    resolution_date date,                                         -- วันที่มติ กกพ.
    source          text        not null default '',
    updated_at      timestamptz not null default now(),
    unique (period_from)
);

create table if not exists public.tariff_audit (
    id        bigserial   primary key,
    tbl       text        not null,
    row_id    uuid,
    action    text        not null,
    actor     uuid        default auth.uid(),
    at        timestamptz not null default now(),
    old_row   jsonb,
    new_row   jsonb
);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.tariff_sets  enable row level security;
alter table public.ft_periods   enable row level security;
alter table public.tariff_audit enable row level security;

-- anon แยก policy: ไม่เรียก is_admin() (anon อาจไม่มีสิทธิ์เรียกฟังก์ชันนั้น = อ่านพังทั้งตาราง)
drop policy if exists tariff_sets_read on public.tariff_sets;
drop policy if exists tariff_sets_read_anon on public.tariff_sets;
create policy tariff_sets_read_anon on public.tariff_sets for select to anon using (status = 'published');
create policy tariff_sets_read on public.tariff_sets for select to authenticated
    using (status = 'published' or public.is_admin());
drop policy if exists tariff_sets_ins on public.tariff_sets;
create policy tariff_sets_ins on public.tariff_sets for insert to authenticated with check (public.is_admin());
drop policy if exists tariff_sets_upd on public.tariff_sets;
create policy tariff_sets_upd on public.tariff_sets for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists tariff_sets_del on public.tariff_sets;
create policy tariff_sets_del on public.tariff_sets for delete to authenticated using (public.is_admin() and status = 'draft');

drop policy if exists ft_periods_read on public.ft_periods;
create policy ft_periods_read on public.ft_periods for select to anon, authenticated using (true);
drop policy if exists ft_periods_write on public.ft_periods;
create policy ft_periods_write on public.ft_periods for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists tariff_audit_read on public.tariff_audit;
create policy tariff_audit_read on public.tariff_audit for select to authenticated using (public.is_admin());

grant select on public.tariff_sets, public.ft_periods to anon, authenticated;
grant insert, update, delete on public.tariff_sets, public.ft_periods to authenticated;
grant select on public.tariff_audit to authenticated;

-- ── ชุดที่เผยแพร่แล้ว: แก้ตัวเลข/วันที่/การไฟฟ้าไม่ได้ (เปลี่ยนสถานะเป็น retired ได้) ──────────────
create or replace function public.tariff_sets_guard() returns trigger language plpgsql as $$
begin
    if tg_op = 'UPDATE' and old.status <> 'draft' then
        if new.rates is distinct from old.rates or new.effective_from is distinct from old.effective_from
           or new.utility is distinct from old.utility then
            raise exception 'ชุดอัตราที่เผยแพร่แล้วแก้ตัวเลขไม่ได้ — ออกชุดใหม่แทน';
        end if;
        if old.status = 'retired' and new.status = 'draft' then
            raise exception 'ชุดที่ยกเลิกแล้วกลับเป็นร่างไม่ได้';
        end if;
    end if;
    if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then new.published_at := now(); end if;
    new.updated_at := now();
    return new;
end; $$;
drop trigger if exists tariff_sets_guard on public.tariff_sets;
create trigger tariff_sets_guard before insert or update on public.tariff_sets for each row execute function public.tariff_sets_guard();

-- ── บันทึกการแก้ ─────────────────────────────────────────────────────────────
create or replace function public.tariff_audit_log() returns trigger language plpgsql security definer set search_path = public as $$
begin
    insert into public.tariff_audit (tbl, row_id, action, old_row, new_row)
    values (tg_table_name, coalesce(new.id, old.id), lower(tg_op),
            case when tg_op <> 'INSERT' then to_jsonb(old) end, case when tg_op <> 'DELETE' then to_jsonb(new) end);
    return coalesce(new, old);
end; $$;
drop trigger if exists tariff_sets_audit on public.tariff_sets;
create trigger tariff_sets_audit after insert or update or delete on public.tariff_sets for each row execute function public.tariff_audit_log();
drop trigger if exists ft_periods_audit on public.ft_periods;
create trigger ft_periods_audit after insert or update or delete on public.ft_periods for each row execute function public.tariff_audit_log();

-- ── งวด Ft เริ่มต้น (ของจริงที่ ASC Studio ใช้อยู่ · digitize-kit/FT_history.csv) ─────────────
insert into public.ft_periods (period_from, period_to, ft_satang, resolution_date, source)
values ('2026-09-01', '2026-12-31', 16.23, '2026-07-22', 'กกพ. สูตรการปรับอัตราค่าไฟฟ้าโดยอัตโนมัติ (Ft) ก.ย.–ธ.ค. 2569')
on conflict (period_from) do nothing;

-- ตรวจ: select status, utility, effective_from, label from public.tariff_sets order by effective_from;
--       select period_from, period_to, ft_satang from public.ft_periods order by period_from;
