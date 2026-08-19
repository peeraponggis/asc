/* ============================================================================
 *  นำเข้าผู้ใช้ 41 คนจาก user.js เข้า Supabase แล้วส่งอีเมลให้ตั้งรหัสผ่านเอง
 *  ----------------------------------------------------------------------------
 *  สคริปต์นี้รันบนเครื่องคุณเท่านั้น ห้ามเอาขึ้นเว็บ เพราะต้องใช้คีย์ service_role
 *  ซึ่งข้ามระบบสิทธิ์ได้ทั้งหมด
 *
 *  วิธีใช้ (PowerShell)
 *      cd supabase
 *      npm install @supabase/supabase-js
 *      $env:SUPABASE_URL = "https://xxxx.supabase.co"
 *      $env:SUPABASE_SERVICE_KEY = "คีย์ service_role"
 *      node invite-users.mjs --dry-run     # ดูรายชื่อก่อน ยังไม่ส่งจริง
 *      node invite-users.mjs               # ส่งจริง
 *
 *  ⚠ ก่อนส่งจริง ต้องตั้งค่า SMTP ของตัวเองก่อน
 *    Supabase Dashboard > Project Settings > Authentication > SMTP Settings
 *    บริการอีเมลที่แถมมาจำกัดไว้ไม่กี่ฉบับต่อชั่วโมง ส่ง 41 ฉบับรวดเดียวไม่ผ่านแน่นอน
 *    ใช้ Resend, SendGrid, Brevo หรือ SMTP ของ Gmail ก็ได้
 * ========================================================================== */

// โหลด @supabase/supabase-js ตอนจะส่งจริงเท่านั้น โหมด --dry-run จะได้ใช้ได้เลยโดยไม่ต้อง npm install
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE   = dirname(fileURLToPath(import.meta.url));
const DRYRUN = process.argv.includes('--dry-run');
const DELAY  = 2500;   // เว้นระยะระหว่างฉบับ กัน rate limit ของผู้ให้บริการอีเมล

const URL_ = process.env.SUPABASE_URL;
const KEY  = process.env.SUPABASE_SERVICE_KEY;

if (!URL_ || !KEY) {
    console.error('✗ ยังไม่ได้ตั้ง SUPABASE_URL หรือ SUPABASE_SERVICE_KEY');
    console.error('  ดูวิธีตั้งค่าในหัวไฟล์นี้');
    process.exit(1);
}
if (KEY.length < 40) {
    console.error('✗ คีย์ที่ใส่มาสั้นผิดปกติ ตรวจว่าคัดลอกครบหรือยัง');
    process.exit(1);
}

/* ── อ่านรายชื่อจาก user.js ─────────────────────────────────────────────── */
const src = readFileSync(join(HERE, '..', 'user.js'), 'utf8');

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
    // lpee  : '',
    // pat   : '',
};

const targets = [];
for (const acc of accounts) {
    const email = acc.includes('@') ? acc : (MANUAL[acc] || null);
    if (!email) continue;
    targets.push({ account: acc, email: email.toLowerCase(), display: displayOf(acc), isAdmin: admins.includes(acc) });
}

console.log('── จะดำเนินการกับ ' + targets.length + ' บัญชี ──');
targets.forEach((t, i) =>
    console.log('   ' + String(i + 1).padStart(2) + '. ' + t.email.padEnd(38) + t.display + (t.isAdmin ? '   [ผู้ดูแลระบบ]' : '')));
console.log('');

if (DRYRUN) { console.log('โหมดทดลอง ยังไม่ได้ส่งอะไรออกไป  ถอด --dry-run ออกเมื่อพร้อมส่งจริง'); process.exit(0); }

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
