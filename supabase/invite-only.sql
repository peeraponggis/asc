-- ============================================================================
--  ProInventive ASC — ปิดระบบไม่ให้ใครสมัครบัญชีเอง (invite-only)
--  ----------------------------------------------------------------------------
--  ทำไมต้องมีไฟล์นี้
--    คีย์ publishable ของ Supabase เปิดเผยอยู่ในโค้ดหน้าเว็บตามการออกแบบ
--    ใครก็ยิง /auth/v1/signup สมัครบัญชีเข้ามาเองได้ ถึงจะไม่เห็นข้อมูลใคร
--    เพราะ RLS กันไว้ แต่ก็ทำให้มีบัญชีแปลกปลอมงอกในระบบ
--
--    สวิตช์ "Allow new users to sign up" ใน Dashboard ทำหน้าที่นี้อยู่แล้ว
--    ไฟล์นี้บังคับซ้ำอีกชั้นที่ระดับฐานข้อมูล ซึ่งข้ามไม่ได้ไม่ว่ายิงมาทางไหน
--
--  วิธีใช้ : Supabase Dashboard > SQL Editor > New query > วางทั้งไฟล์ > Run
--            รันซ้ำได้ ไม่พัง
--
--  ⚠ ระบบนี้ปิดตาย (fail-closed) อีเมลที่ไม่อยู่ในตาราง allowed_emails
--    จะสร้างบัญชีไม่ได้เลย รวมถึงคำเชิญจากแอดมินด้วย
--    จะเพิ่มคนใหม่ ต้องเติมอีเมลลงตารางนั้นก่อนเสมอ (ดูท้ายไฟล์)
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
--  1. ตารางรายชื่ออีเมลที่อนุญาตให้มีบัญชีได้
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.allowed_emails (
    email      text        primary key,
    note       text        not null default '',
    created_at timestamptz not null default now()
);

comment on table public.allowed_emails is
    'รายชื่ออีเมลที่สร้างบัญชีได้ อีเมลนอกรายการนี้ถูกปฏิเสธตั้งแต่ชั้นฐานข้อมูล';

alter table public.allowed_emails enable row level security;

-- อ่านได้เฉพาะผู้ดูแลระบบ ผู้ใช้ทั่วไปและคนที่ยังไม่ล็อกอินมองไม่เห็นเลย
-- (ตัวฟังก์ชันตรวจสอบเป็น security definer จึงอ่านได้โดยไม่ติด RLS)
drop policy if exists "แอดมินอ่านรายชื่อที่อนุญาต" on public.allowed_emails;
create policy "แอดมินอ่านรายชื่อที่อนุญาต"
    on public.allowed_emails for select
    using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "แอดมินแก้รายชื่อที่อนุญาต" on public.allowed_emails;
create policy "แอดมินแก้รายชื่อที่อนุญาต"
    on public.allowed_emails for all
    using      (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
    with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));


-- ────────────────────────────────────────────────────────────────────────────
--  2. ด่านตรวจก่อนสร้างบัญชี
--     security definer เพื่อให้อ่านตาราง allowed_emails ได้
--     โดยไม่ต้องให้สิทธิ์ตารางนี้แก่ผู้ใช้ภายในของ Supabase
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.enforce_invite_only()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    if new.email is null
       or not exists (select 1 from public.allowed_emails a
                      where a.email = lower(trim(new.email))) then
        raise exception 'อีเมลนี้ไม่อยู่ในรายชื่อที่ได้รับเชิญ ติดต่อผู้ดูแลระบบ (%)', new.email
            using errcode = 'check_violation';
    end if;
    return new;
end;
$$;

drop trigger if exists enforce_invite_only on auth.users;
create trigger enforce_invite_only
    before insert on auth.users
    for each row execute function public.enforce_invite_only();


-- ────────────────────────────────────────────────────────────────────────────
--  3. รายชื่อตั้งต้น — ดึงจาก user.js ทั้ง 39 บัญชี
--     38 บัญชีที่เป็นอีเมลอยู่แล้ว + lpee (ผู้ดูแลระบบ)
--     supet และ pat ยังไม่มีอีเมลจริง จึงยังไม่อยู่ในรายการ
-- ────────────────────────────────────────────────────────────────────────────
insert into public.allowed_emails (email, note) values
    ('maxsupajit@gmail.com', 'จาก user.js'),
    ('stg.energy2015@gmail.com', 'จาก user.js'),
    ('sm0610603003@gmail.com', 'จาก user.js'),
    ('chairuj.ka@gmail.com', 'จาก user.js'),
    ('parinya.is@gmail.com', 'จาก user.js'),
    ('waraxxx98@gmail.com', 'จาก user.js'),
    ('pranpipat55@gmail.com', 'จาก user.js'),
    ('aec.rooftop@gmail.com', 'จาก user.js'),
    ('onnetjoy@gmail.com', 'จาก user.js'),
    ('beliefgroups@gmail.com', 'จาก user.js'),
    ('surakarn232@gmail.com', 'จาก user.js'),
    ('songsri.en@gmail.com', 'จาก user.js'),
    ('supachaimulachiwa@gmail.com', 'จาก user.js'),
    ('pongsakorn.kongng@gmail.com', 'จาก user.js'),
    ('supaporn.ruekudom@gmail.com', 'จาก user.js'),
    ('thunderinno.office@gmail.com', 'จาก user.js'),
    ('anuchit221237@gmail.com', 'จาก user.js'),
    ('naphat.niti168@gmail.com', 'จาก user.js'),
    ('kanittha.fastpro@gmail.com', 'จาก user.js'),
    ('panadda101261@gmail.com', 'จาก user.js'),
    ('s_ativat@hotmail.com', 'จาก user.js'),
    ('pariphatkaewinta@gmail.com', 'จาก user.js'),
    ('petpong250@gmail.com', 'จาก user.js'),
    ('sishejj6@gmail.com', 'จาก user.js'),
    ('soukhameesai@gmail.com', 'จาก user.js'),
    ('skay70852@gmail.com', 'จาก user.js'),
    ('i.am.ngamsomchai@gmail.com', 'จาก user.js'),
    ('somyos1259wang@gmail.com', 'จาก user.js'),
    ('bkhardware888@gmail.com', 'จาก user.js'),
    ('patarapol777@gmail.com', 'จาก user.js'),
    ('ducksmall2010@gmail.com', 'จาก user.js'),
    ('suphachok2707@gmail.com', 'จาก user.js'),
    ('chaleepdy@gmail.com', 'จาก user.js'),
    ('canny070459@gmail.com', 'จาก user.js'),
    ('kheiywbideddeiyw@gmail.com', 'จาก user.js'),
    ('montri123a@gmail.com', 'จาก user.js'),
    ('passonjumleanphaiboonphon@gmail.com', 'จาก user.js'),
    ('sanitphanthawas@gmail.com', 'จาก user.js'),
    ('giskku@gmail.com', 'อีเมลสำรองของผู้ดูแลระบบ ยังไม่มีบัญชี'),
    ('lungpee0945@gmail.com', 'ผู้ดูแลระบบ บัญชีที่ใช้งานจริงอยู่แล้ว')
on conflict (email) do nothing;


-- ────────────────────────────────────────────────────────────────────────────
--  วิธีเพิ่มคนใหม่ในอนาคต — รันบรรทัดนี้ก่อนส่งคำเชิญเสมอ
--
--      insert into public.allowed_emails (email, note)
--      values ('someone@example.com', 'ชื่อ/บริษัท')
--      on conflict (email) do nothing;
--
--  วิธีถอนสิทธิ์ (ไม่ลบบัญชีที่มีอยู่แล้ว แค่กันไม่ให้สร้างใหม่)
--
--      delete from public.allowed_emails where email = 'someone@example.com';
--
--  วิธีปิดด่านนี้ชั่วคราว
--
--      drop trigger if exists enforce_invite_only on auth.users;
-- ────────────────────────────────────────────────────────────────────────────
