/* ============================================================================
 *  ชุดทดสอบตัวจับคู่คำถามของ ASC Copilot
 *
 *  รัน   node tests/copilot-match.mjs
 *
 *  ทำไมต้องมีไฟล์นี้
 *  ----------------------------------------------------------------------
 *  หัวใจของ Copilot v1 คือการจับคู่คำถามภาษาไทยกับหัวข้อ ซึ่งเป็นงานที่
 *  พังเงียบได้ง่ายมาก เติมคำพ้องเข้าไปคำเดียวอาจไปแย่งคำถามของหัวข้ออื่น
 *  โดยไม่มีใครรู้ ทุกครั้งที่แก้ตาราง TOPICS ให้รันไฟล์นี้ก่อนเสมอ
 *
 *  เกณฑ์ผ่าน
 *  ----------------------------------------------------------------------
 *  · ตอบถูกอย่างน้อย 13 จาก 15 ข้อ
 *  · **ห้ามมีข้อไหนตอบผิด** ตอบว่าไม่รู้ดีกว่าตอบผิด
 *    เพราะผู้ใช้จะเชื่อคำตอบที่ผิด
 *
 *  ค่าฐานก่อนทำงานนี้ (AscKB.search ตัวเดิม) คือเจอ 3/15 ถูก 1/15
 * ==========================================================================*/

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DOCS = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs');

/* โหลดโมดูลแบบเบราว์เซอร์เข้ามาในบริบทเดียวกัน ทั้งสองไฟล์เป็น IIFE
   ที่ผูกชื่อไว้บน global จึงเรียกใช้ต่อกันได้โดยไม่ต้องมี bundler */
const g = globalThis;
g.window = g;
new Function(readFileSync(join(DOCS, 'asc-kb.js'), 'utf8'))();
new Function(readFileSync(join(DOCS, 'asc-copilot.js'), 'utf8'))();
const CP = g.AscCopilot;

/* ── ชุดคำถามมาตรฐาน 15 ข้อ ───────────────────────────────────────────────
   ชุดเดียวกับที่ใช้วัดค่าฐาน expect คือ id ของบทความหรือของ intent
   'none' แปลว่าต้องตอบว่าไม่รู้ ห้ามเดาเป็นหัวข้อใดหัวข้อหนึ่ง */
const CASES = [
    ['ทำไม PR ต่ำ',                          'pr-benchmark'],
    ['ทำไมค่าPRต่ำ',                          'pr-benchmark'],
    ['เบรกเกอร์ AC ขนาดเท่าไหร่',              'breaker-sizing'],
    ['DC/AC 1.45 สูงไปไหม',                   'dcac-ratio'],
    ['ต้องใส่ฟิวส์กี่ตัว',                      'eit-string-ocpr'],
    ['ต่อกี่แผงต่อสตริงถึงจะไม่เกินแรงดัน',        'voc-cold'],
    ['เงาบังเยอะไปไหม',                       'shading-loss'],
    ['แผงควรหันทิศไหน',                       'azimuth-thailand'],
    ['มุมเอียงเท่าไหร่ดี',                      'tilt-thailand'],
    ['หลังคารับน้ำหนักไหวไหม',                 'roof-load'],
    ['ต้องติดตั้ง SPD ไหม',                    'eit-spd'],
    ['ป้ายต้องติดกี่จุด',                       'eit-labels'],
    ['ผลตรวจขึ้นเหลืองกี่ข้อ',                  'findings'],
    ['ขั้นตอนต่อไปทำอะไร',                     'next'],
    ['พรุ่งนี้ฝนตกไหม',                        'none']
];

/* ── กับดักที่ตัวค้นเดิมเคยตกทั้งสองข้อ ──────────────────────────────────
   ต้องไม่กลับมาอีก จึงแยกออกมาเป็นชุดของตัวเอง */
const TRAPS = [
    ['ทำไม PR ต่ำ',              'voc-cold',   'เคยได้บทความแรงดันวงจรเปิด เพราะแมตช์คำว่า ต่ำ'],
    ['เบรกเกอร์ AC ขนาดเท่าไหร่', 'dcac-ratio', 'เคยได้บทความ DC/AC เพราะแมตช์คำว่า ac']
];

/* ── คู่ที่ต้องให้ผลเหมือนกันทั้งแบบเว้นวรรคและไม่เว้น ───────────────── */
const SPACING = [
    ['ทำไม PR ต่ำ', 'ทำไมค่าPRต่ำ'],
    ['DC/AC สูงไปไหม', 'dcacสูงไปไหม'],
    ['ต้องใส่ ฟิวส์ กี่ตัว', 'ต้องใส่ฟิวส์กี่ตัว']
];

const hit = m => m.kind === 'topic' ? m.kb : m.kind === 'intent' ? m.id : m.kind;

let right = 0, wrong = 0, unsure = 0;
const lines = [];

console.log('ชุดคำถามมาตรฐาน 15 ข้อ');
console.log('─'.repeat(72));
CASES.forEach(([q, want]) => {
    const m = CP.matchTopic(q);
    const got = hit(m);
    let mark, verdict;
    if (got === want)                             { mark = 'ถูก';    right++; }
    else if (got === 'none' || got === 'unsure')  { mark = 'ไม่รู้';  unsure++; }
    else                                          { mark = 'ผิด';    wrong++; }
    console.log(
        mark.padEnd(7) + ' ' + q.padEnd(38) + ' → ' + got +
        (got === want ? '' : '   (ต้องได้ ' + want + ')') +
        (m.layer ? '  [ชั้น ' + m.layer + ']' : '')
    );
});

console.log('');
console.log('กับดักเดิมที่ต้องไม่กลับมา');
console.log('─'.repeat(72));
let trapFail = 0;
TRAPS.forEach(([q, forbidden, why]) => {
    const got = hit(CP.matchTopic(q));
    const ok = got !== forbidden;
    if (!ok) trapFail++;
    console.log((ok ? 'ผ่าน   ' : 'ตก     ') + q.padEnd(30) + ' ไม่ได้ ' + forbidden + '   · ' + why);
});

console.log('');
console.log('เว้นวรรคหรือไม่เว้น ต้องได้ผลเดียวกัน');
console.log('─'.repeat(72));
let spaceFail = 0;
SPACING.forEach(([a, b]) => {
    const ga = hit(CP.matchTopic(a)), gb = hit(CP.matchTopic(b));
    const ok = ga === gb;
    if (!ok) spaceFail++;
    console.log((ok ? 'ผ่าน   ' : 'ตก     ') + a.padEnd(24) + ' / ' + b.padEnd(24) + ' → ' + ga + ' / ' + gb);
});

/* ── ทุกหัวข้อในตารางต้องชี้ไปที่บทความที่มีอยู่จริง ───────────────────── */
console.log('');
console.log('ความสอดคล้องของตาราง');
console.log('─'.repeat(72));
const KBIDS = g.AscKB.ids();
const dangling = CP.TOPICS.filter(t => KBIDS.indexOf(t.kb) < 0).map(t => t.kb);
const uncovered = KBIDS.filter(id => !CP.TOPICS.some(t => t.kb === id));
console.log((dangling.length  ? 'ตก     ' : 'ผ่าน   ') + 'หัวข้อชี้ไปบทความที่ไม่มีจริง : ' + (dangling.join(', ') || 'ไม่มี'));
console.log((uncovered.length ? 'ตก     ' : 'ผ่าน   ') + 'บทความที่ยังไม่มีหัวข้อคุม   : ' + (uncovered.join(', ') || 'ไม่มี'));

console.log('');
console.log('═'.repeat(72));
console.log('ถูก ' + right + '/' + CASES.length + ' · ไม่รู้ ' + unsure + ' · ผิด ' + wrong
          + '   (ค่าฐานเดิม ถูก 1/15)');

const pass = right >= 13 && wrong === 0 && !trapFail && !spaceFail
          && !dangling.length && !uncovered.length;
console.log(pass ? 'ผลรวม ผ่านเกณฑ์' : 'ผลรวม ไม่ผ่านเกณฑ์');
process.exit(pass ? 0 : 1);
