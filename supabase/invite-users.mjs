/* ============================================================================
 *  นำเข้าผู้ใช้ 41 คนจาก user.js เข้า Supabase แล้วส่งอีเมลให้ตั้งรหัสผ่านเอง
 *  ----------------------------------------------------------------------------
 *  สคริปต์นี้รันบนเครื่องคุณเท่านั้น ห้ามเอาขึ้นเว็บ เพราะต้องใช้คีย์ service_role
 *  ซึ่งข้ามระบบสิทธิ์ได้ทั้งหมด
 *
 *  วิธีใช้ — ตั้งคีย์ครั้งเดียวจบ
 *      1. npm install @supabase/supabase-js   (รันในโฟลเดอร์ supabase ครั้งเดียว)
 *      2. เปิดไฟล์  supabase/.env  วางคีย์ service_role ต่อท้าย SUPABASE_SERVICE_KEY=
 *         ไฟล์นั้นถูก .gitignore ไว้แล้ว และไม่ต้องใส่ SUPABASE_URL เพราะอ่านเองจาก supabase-config.js
 *      3. รันคำสั่งข้างล่างจากรากของโปรเจกต์ได้เลย ไม่ต้องตั้งตัวแปรใหม่ทุกครั้ง
 *      node supabase/invite-users.mjs --dry-run     # ดูรายชื่อก่อน ยังไม่ส่งจริง
 *      node supabase/invite-users.mjs               # ส่งจริง
 *      node supabase/invite-users.mjs --check       # ถามเซิร์ฟเวอร์ว่าใครถูกเชิญไปแล้วบ้าง ไม่ส่งอีเมล
 *      node supabase/invite-users.mjs --only a@b.com    # ทดสอบทีละคน
 *
 *  ⚠ ก่อนส่งจริง ต้องตั้งค่า SMTP ของตัวเองก่อน
 *    Supabase Dashboard > Project Settings > Authentication > SMTP Settings
 *    บริการอีเมลที่แถมมาจำกัดไว้ไม่กี่ฉบับต่อชั่วโมง ส่ง 41 ฉบับรวดเดียวไม่ผ่านแน่นอน
 *    ใช้ Resend, SendGrid, Brevo หรือ SMTP ของ Gmail ก็ได้
 * ========================================================================== */

// โหลด @supabase/supabase-js ตอนจะส่งจริงเท่านั้น โหมด --dry-run จะได้ใช้ได้เลยโดยไม่ต้อง npm install
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE   = dirname(fileURLToPath(import.meta.url));
const DRYRUN = process.argv.includes('--dry-run');
/* --only <อีเมล> : ทำกับอีเมลเดียว ใช้ทดสอบก่อนส่งจริงทั้งชุด
   อีเมลที่ไม่มีใน user.js ก็ใส่ได้ เช่นบัญชีทดสอบของตัวเอง */
const ONLY_AT = process.argv.indexOf('--only');
const ONLY    = ONLY_AT === -1 ? null : (process.argv[ONLY_AT + 1] || '').trim().toLowerCase() || null;
/* --check : ถามเซิร์ฟเวอร์ว่าใครถูกเชิญไปแล้วบ้าง ไม่ส่งอีเมลออกไปสักฉบับ */
const CHECK  = process.argv.includes('--check');
/* --send : ยืนยันว่าจะส่งอีเมลจริง ไม่ใส่ = ไม่ส่ง (ดูเหตุผลที่ด่านกันส่งข้างล่าง) */
const SEND   = process.argv.includes('--send');
const DELAY  = 2500;   // เว้นระยะระหว่างฉบับ กัน rate limit ของผู้ให้บริการอีเมล

/* ── หาค่าเชื่อมต่อ ───────────────────────────────────────────────────────
   ลำดับการหา  1. ตัวแปรสภาพแวดล้อมที่ตั้งไว้ในหน้าต่างคำสั่ง
               2. ไฟล์ supabase/.env  (ถูก .gitignore ไว้แล้ว ไม่ขึ้น GitHub)
               3. เฉพาะ URL ถ้ายังไม่มี จะอ่านจาก supabase-config.js ให้เอง
   ตั้งครั้งเดียวในไฟล์ .env แล้วไม่ต้องตั้งใหม่ทุกครั้งที่เปิดหน้าต่างคำสั่ง */
const CR = String.fromCharCode(13), LF = String.fromCharCode(10);

function readEnvFile() {
    const out = {};
    for (const p of [join(HERE, '.env'), join(HERE, '..', '.env')]) {
        if (!existsSync(p)) continue;
        for (const raw of readFileSync(p, 'utf8').split(LF)) {
            const line = raw.split(CR).join('').trim();
            if (!line || line.startsWith('#')) continue;
            const at = line.indexOf('=');
            if (at < 1) continue;
            let v = line.slice(at + 1).trim();
            if (v.length > 1 && (v[0] === v[v.length - 1]) && (v[0] === '"' || v[0] === "'")) v = v.slice(1, -1);
            out[line.slice(0, at).trim()] = v;
        }
    }
    return out;
}
const FILE_ENV = readEnvFile();

/* ดึง URL จาก supabase-config.js โดยไม่ต้องพึ่ง regex */
function urlFromConfig() {
    try {
        /* ไฟล์เว็บย้ายไปอยู่ใน docs/ ทั้งหมดแล้ว มองที่นั่นก่อน
           แล้วค่อยถอยไปหาที่รากเผื่อโครงสร้างเก่า */
        const cfgPath = [join(HERE, '..', 'docs', 'supabase-config.js'),
                         join(HERE, '..', 'supabase-config.js')].find(p => existsSync(p));
        if (!cfgPath) return null;
        const cfg  = readFileSync(cfgPath, 'utf8');
        const at   = cfg.lastIndexOf('SUPABASE_URL');
        if (at === -1) return null;
        const tail = cfg.slice(at);
        const a    = tail.indexOf("'");
        const b    = a === -1 ? -1 : tail.indexOf("'", a + 1);
        const val  = a === -1 || b === -1 ? '' : tail.slice(a + 1, b);
        return val.startsWith('http') ? val : null;
    } catch { return null; }
}

const URL_ = process.env.SUPABASE_URL || FILE_ENV.SUPABASE_URL || urlFromConfig();
const KEY  = process.env.SUPABASE_SERVICE_KEY || FILE_ENV.SUPABASE_SERVICE_KEY;

if (!URL_ || !KEY) {
    console.error('✗ ยังไม่มีคีย์ service_role');
    console.error('');
    console.error('  ตั้งครั้งเดียวจบ — สร้างไฟล์  supabase/.env  แล้วใส่บรรทัดนี้');
    console.error('');
    console.error('      SUPABASE_SERVICE_KEY=คีย์ service_role ของคุณ');
    console.error('');
    console.error('  หาคีย์ได้ที่ Supabase Dashboard > Project Settings > API > service_role');
    console.error('  ไฟล์ .env ถูก .gitignore ไว้แล้ว จะไม่ถูก commit ขึ้น GitHub');
    if (URL_) { console.error(''); console.error('  (SUPABASE_URL อ่านได้เองแล้ว : ' + URL_ + ')'); }
    process.exit(1);
}
if (KEY.length < 40) {
    console.error('✗ คีย์ที่ใส่มาสั้นผิดปกติ ตรวจว่าคัดลอกครบหรือยัง');
    process.exit(1);
}

/* ── อ่านรายชื่อจาก user.js ─────────────────────────────────────────────── */
/* user.js ย้ายไปอยู่ใน docs/ แล้วเช่นกัน */
const userJsPath = [join(HERE, '..', 'docs', 'user.js'),
                    join(HERE, '..', 'user.js')].find(p => existsSync(p));
if (!userJsPath) {
    console.error('✗ หาไฟล์ user.js ไม่เจอ ทั้งใน docs/ และที่ราก');
    process.exit(1);
}
const src = readFileSync(userJsPath, 'utf8');

const usersBlock = src.match(/const\s+users\s*=\s*\{([\s\S]*?)\n\};/);
if (!usersBlock) { console.error('✗ อ่านรายชื่อจาก user.js ไม่สำเร็จ'); process.exit(1); }

const accounts = [...usersBlock[1].matchAll(/^\s*["']?([A-Za-z0-9_.@+-]+)["']?\s*:/gm)].map(m => m[1]);

const adminBlock = src.match(/ADMIN_USERS\s*=\s*\[([^\]]*)\]/);
const admins = adminBlock ? adminBlock[1].split(',').map(s => s.replace(/["'\s]/g, '')).filter(Boolean) : [];

/* ── ชื่อที่แสดง ดึงจาก displayNameOf ถ้ามี ไม่มีก็ใช้ส่วนหน้าอีเมล ─────── */
function displayOf(acc) {
    const re = new RegExp('["\']' + acc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '["\']\\s*:\\s*["\']([^"\']+)["\']', 'g');
    let best = null, m;
    // ข้ามค่าที่เป็นแฮชรหัสผ่าน เอาเฉพาะที่ดูเป็นชื่อคน
    while ((m = re.exec(src)) !== null) if (!m[1].startsWith('sha256$')) best = m[1];
    return best || acc.split('@')[0];
}

const emailish = accounts.filter(a => a.includes('@'));
const nonEmail = accounts.filter(a => !a.includes('@'));

console.log('── รายชื่อที่พบใน user.js ──');
console.log('   ทั้งหมด            : ' + accounts.length);
console.log('   เป็นอีเมลอยู่แล้ว   : ' + emailish.length);
console.log('   ยังไม่ใช่อีเมล      : ' + nonEmail.length + (nonEmail.length ? '  → ' + nonEmail.join(', ') : ''));
console.log('   ผู้ดูแลระบบ         : ' + (admins.join(', ') || '-'));
console.log('');

if (nonEmail.length) {
    console.log('⚠ บัญชีที่ยังไม่ใช่อีเมลจะถูกข้าม เพราะ Supabase ต้องใช้อีเมลในการเข้าสู่ระบบ');
    console.log('  ให้เพิ่มอีเมลจริงของคนเหล่านี้ในตัวแปร MANUAL ด้านล่างของไฟล์นี้ แล้วรันใหม่');
    console.log('');
}

/* เติมอีเมลของบัญชีที่ยังไม่มี เช่น  { supet: 'supet@example.com' } */
const MANUAL = {
    // supet : '',
    // lpee  : '',   ← ใช้บัญชี lungpee0945@gmail.com ที่สร้างไว้แล้วแทน ไม่ต้องเชิญซ้ำ
    // pat   : '',
};

const targets = [];
for (const acc of accounts) {
    const email = acc.includes('@') ? acc : (MANUAL[acc] || null);
    if (!email) continue;
    targets.push({ account: acc, email: email.toLowerCase(), display: displayOf(acc), isAdmin: admins.includes(acc) });
}

if (ONLY) {
    const found = targets.find(t => t.email === ONLY);
    targets.length = 0;
    targets.push(found || { account: ONLY, email: ONLY, display: ONLY.split('@')[0], isAdmin: false });
    console.log('โหมด --only : ทำกับ ' + ONLY + (found ? '' : '  (ไม่มีในรายชื่อ user.js ถือเป็นบัญชีทดสอบ)'));
    console.log('');
}

console.log('── จะดำเนินการกับ ' + targets.length + ' บัญชี ──');
targets.forEach((t, i) =>
    console.log('   ' + String(i + 1).padStart(2) + '. ' + t.email.padEnd(38) + t.display + (t.isAdmin ? '   [ผู้ดูแลระบบ]' : '')));
console.log('');

/* ══════════════════════════════════════════════════════════════════════════
   ด่านกันส่งอีเมลโดยไม่ตั้งใจ

   ทีมตัดสินใจเมื่อ 20 ส.ค. 2569 ว่า **ยกเลิกการส่งคำเชิญเป็นชุด** แล้วเปลี่ยน
   เป็นให้ผู้ใช้ร้องขอและสมัครเอง (ดู STATUS.md หัวข้อ การตัดสินใจสำคัญ)
   ตอนนี้มีผู้สมัครเองแล้วหลายสิบบัญชี

   สคริปต์นี้เทียบรายชื่อกับ user.js เท่านั้น จึงมองไม่เห็นคนที่สมัครเอง
   แล้วรายงานว่า "ยังไม่ถูกเชิญ" ทั้งที่หลายคนใช้งานอยู่แล้ว
   ถ้าใครรันตามคำแนะนำนั้น จะยิงอีเมลหาคนที่ไม่ได้ขอเป็นสิบ ๆ ฉบับ

   เดิมสคริปต์พังเพราะหาไฟล์ไม่เจอ ซึ่งกันเรื่องนี้ไว้โดยบังเอิญ
   พอแก้ให้หาไฟล์เจอแล้ว ต้องมีด่านจริงมาแทน
   ══════════════════════════════════════════════════════════════════════════ */
if (!DRYRUN && !CHECK && !SEND) {
    console.log('');
    console.log('  ⚠  สคริปต์นี้ส่งอีเมลจริงหาคนภายนอก จึงไม่ยอมส่งถ้าไม่สั่งชัดเจน');
    console.log('');
    console.log('  ทีมยกเลิกการส่งคำเชิญเป็นชุดไปแล้วตั้งแต่ 20 ส.ค. 2569');
    console.log('  เปลี่ยนเป็นให้ผู้ใช้ร้องขอแล้วสมัครเอง และตอนนี้มีคนสมัครเองแล้วหลายสิบบัญชี');
    console.log('  รายชื่อใน user.js เป็นของเก่า ไม่ได้สะท้อนว่าใครใช้งานอยู่จริง');
    console.log('');
    console.log('  ก่อนตัดสินใจส่ง ให้ดูสภาพจริงก่อนเสมอ');
    console.log('      node supabase/invite-users.mjs --check');
    console.log('');
    console.log('  ถ้ายืนยันว่าจะส่งจริง ต้องใส่ --send');
    console.log('      node supabase/invite-users.mjs --send');
    console.log('');
    process.exit(1);
}

if (DRYRUN) {
    console.log('โหมดทดลอง อ่านรายชื่อจาก user.js เท่านั้น ยังไม่ได้ถามเซิร์ฟเวอร์และไม่ได้ส่งอะไรออกไป');
    console.log('อยากรู้ว่าใครถูกเชิญไปแล้วบ้าง ให้ใช้  --check  แทน');
    process.exit(0);
}

/* ── ส่งจริง ────────────────────────────────────────────────────────────── */
let createClient;
try {
    ({ createClient } = await import('@supabase/supabase-js'));
} catch (e) {
    console.error('✗ ยังไม่ได้ติดตั้งไลบรารี ให้รันคำสั่งนี้ในโฟลเดอร์ supabase ก่อน');
    console.error('    npm install @supabase/supabase-js');
    process.exit(1);
}

const sb = createClient(URL_, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

/* ── โหมด --check : รายงานสถานะจริงจากเซิร์ฟเวอร์ ไม่ส่งอีเมลสักฉบับ ────── */
if (CHECK) {
    const existing = new Map();
    for (let page = 1; ; page++) {
        const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
        if (error) { console.error('✗ อ่านรายชื่อผู้ใช้ไม่สำเร็จ : ' + error.message); process.exit(1); }
        for (const u of data.users) existing.set((u.email || '').toLowerCase(), u);
        if (data.users.length < 200) break;
    }

    console.log('── สถานะจริงบนเซิร์ฟเวอร์ (มีบัญชีทั้งหมด ' + existing.size + ') ──');
    let none = 0, invited = 0, active = 0;
    for (const t of targets) {
        const u = existing.get(t.email);
        let mark;
        if (!u)                     { mark = '✗ ยังไม่มีบัญชี ยังไม่ถูกเชิญ';  none++; }
        else if (u.last_sign_in_at) { mark = '✓ ใช้งานแล้ว  เข้าล่าสุด ' + String(u.last_sign_in_at).slice(0, 16).replace('T', ' '); active++; }
        else                        { mark = '• เชิญแล้ว ยังไม่ได้ตั้งรหัสผ่าน'; invited++; }
        console.log('   ' + t.email.padEnd(38) + mark);
    }

    const extra = [...existing.keys()].filter(e => e && !targets.some(t => t.email === e));
    if (extra.length) {
        console.log('');
        console.log('   บัญชีที่ไม่อยู่ในรายชื่อ ' + extra.length + ' : ' + extra.join(', '));
    }

    console.log('');
    console.log('── สรุป ──');
    console.log('   ยังไม่ถูกเชิญ           : ' + none);
    console.log('   เชิญแล้ว รอตั้งรหัสผ่าน : ' + invited);
    console.log('   ใช้งานแล้ว              : ' + active);
    console.log('');
    /* ข้อความเดิมชวนให้รันส่งทันที ซึ่งขัดกับการตัดสินใจของทีม
       ตัวเลข 'ยังไม่ถูกเชิญ' นับจาก user.js เท่านั้น จึงไม่รวมคนที่สมัครเอง
       ต้องบอกให้ชัดว่าเลขนี้หมายถึงอะไร ไม่ใช่ชวนให้กดส่ง */
    if (none === targets.length) {
        console.log('   → ไม่มีใครใน user.js ถูกเชิญผ่านสคริปต์นี้เลย');
        console.log('     แต่ไม่ได้แปลว่าไม่มีใครใช้งาน ดูรายชื่อ "บัญชีที่ไม่อยู่ในรายชื่อ" ข้างบน');
        console.log('     ซึ่งคือคนที่สมัครเอง ตามวิธีที่ทีมใช้จริงตั้งแต่ 20 ส.ค. 2569');
    }
    else if (none === 0)          console.log('   → ส่งครบทุกคนแล้ว ไม่ต้องรันซ้ำ');
    else                          console.log('   → ส่งไปแล้วบางส่วน รันซ้ำได้ คนที่มีบัญชีแล้วจะถูกข้ามเอง');
    process.exit(0);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
let ok = 0, existed = 0, failed = 0;

for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const tag = '[' + String(i + 1).padStart(2) + '/' + targets.length + '] ' + t.email.padEnd(38);
    try {
        const { data, error } = await sb.auth.admin.inviteUserByEmail(t.email, {
            data: { display_name: t.display }
        });

        if (error) {
            if (/already been registered|already exists/i.test(error.message)) {
                console.log(tag + '• มีบัญชีอยู่แล้ว ข้าม');
                existed++;
            } else {
                console.log(tag + '✗ ' + error.message);
                failed++;
            }
        } else {
            console.log(tag + '✓ ส่งคำเชิญแล้ว');
            ok++;
            if (t.isAdmin && data && data.user) {
                const { error: e2 } = await sb.from('profiles').update({ is_admin: true }).eq('id', data.user.id);
                console.log('      ' + (e2 ? '✗ ตั้งเป็นผู้ดูแลระบบไม่สำเร็จ : ' + e2.message : '✓ ตั้งเป็นผู้ดูแลระบบแล้ว'));
            }
        }
    } catch (e) {
        console.log(tag + '✗ ' + e.message);
        failed++;
    }
    if (i < targets.length - 1) await sleep(DELAY);
}

console.log('');
console.log('── สรุป ──');
console.log('   ส่งคำเชิญสำเร็จ : ' + ok);
console.log('   มีบัญชีอยู่แล้ว  : ' + existed);
console.log('   ล้มเหลว         : ' + failed);
if (failed) console.log('\n   ถ้าล้มเหลวเพราะ rate limit ให้เพิ่มค่า DELAY ในไฟล์นี้แล้วรันซ้ำ คนที่ส่งไปแล้วจะถูกข้ามเอง');
