/* ============================================================================
 *  ชุดสำรวจ · คำถามที่พูดคนละแบบกับคำในตาราง TOPICS
 *
 *  รัน   node tests/copilot-survey.mjs
 *
 *  ทำไมต้องมีไฟล์นี้แยกจาก copilot-match.mjs
 *  ----------------------------------------------------------------------
 *  ชุด 15 ข้อในไฟล์นั้นเป็นชุดที่ใช้วัดค่าฐาน และคำพ้องในตารางก็เขียนขึ้น
 *  โดยดูชุดนั้นประกอบ ตัวเลขที่ได้จึงสูงเกินจริงถ้าเอาไปอ้างว่าเป็นความแม่น
 *  ที่ผู้ใช้จะเจอ
 *
 *  ไฟล์นี้เป็นคำถามที่ถามเรื่องเดียวกันแต่ **พูดคนละแบบ** เพื่อวัดว่า
 *  ตัวจับคู่ทนต่อการเปลี่ยนสำนวนแค่ไหน เป็นตัวเลขที่ใกล้ของจริงกว่า
 *
 *  ไฟล์นี้ **ไม่ตัดสินผ่าน/ไม่ผ่าน** เพราะจุดประสงค์คือรายงานตัวเลขที่ซื่อตรง
 *  ข้อที่ตอบไม่ได้คือรายการงานสำหรับเติมคำพ้องรอบถัดไป
 *  สิ่งเดียวที่ยอมไม่ได้คือ **ตอบผิด** ซึ่งจะทำให้ exit code เป็น 1
 * ==========================================================================*/

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DOCS = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs');
const g = globalThis; g.window = g;
new Function(readFileSync(join(DOCS, 'asc-kb.js'), 'utf8'))();
new Function(readFileSync(join(DOCS, 'asc-copilot.js'), 'utf8'))();
const CP = g.AscCopilot;

/* คำถามที่วิศวกรน่าจะพิมพ์จริง เขียนโดยไม่ดูตาราง TOPICS */
const CASES = [
    ['ค่าพีอาร์ 72 เปอร์เซ็นต์ ถือว่าใช้ได้ไหม',        'pr-benchmark'],
    ['ระบบนี้ผลิตไฟได้แย่กว่าที่คิด เพราะอะไร',          'pr-benchmark'],
    ['อินเวอร์เตอร์เล็กกว่าแผงมาก จะเป็นอะไรไหม',       'dcac-ratio'],
    ['ใส่แผงเยอะกว่าอินเวอร์เตอร์ได้แค่ไหน',            'dcac-ratio'],
    ['หน้าหนาวแรงดันจะขึ้นจนอินเวอร์เตอร์พังไหม',       'voc-cold'],
    ['สตริงหนึ่งต่อได้กี่แผง',                          'voc-cold'],
    ['แรงดันต่ำสุดที่อินเวอร์เตอร์ยังทำงานได้เท่าไร',    'mppt-window'],
    ['แผงสกปรกทำให้ผลิตไฟลดเท่าไร',                    'soiling-thailand'],
    ['ต้องล้างแผงบ่อยแค่ไหน',                          'soiling-thailand'],
    ['ทำไมต้องเว้นทางเดินบนหลังคา',                     'edge-setback'],
    ['ต้นไม้ข้างบ้านจะบังแผงไหม',                       'tree-growth'],
    ['เอาแผงขึ้นหลังคาแล้วโครงสร้างจะรับไหวหรือเปล่า',   'roof-load'],
    ['ต้องขออนุญาตการไฟฟ้าอย่างไร',                     'grid-code'],
    ['หม้อแปลงเดิมพอไหม',                              'transformer'],
    ['ต้องใส่กันฟ้าผ่าฝั่งไฟตรงด้วยไหม',                'eit-spd'],
    ['สายไฟฝั่งแผงต้องใช้ขนาดเท่าไร',                   'eit-dc-cable'],
    ['ต้องติดป้ายอะไรบ้างตามมาตรฐาน',                   'eit-labels'],
    ['ระบบต้องมีฟิวส์ทุกสตริงหรือเปล่า',                 'eit-string-ocpr'],
    ['แผงสองหน้าคุ้มไหม',                              'bifacial'],
    ['P90 คืออะไร',                                    'uncertainty'],
    ['สายยาวมากจะเสียแรงดันเท่าไร',                    'wiring-loss'],
    ['หลังคาสองด้านคนละทิศ ต้องแยกสตริงไหม',            'gable-vs-valley'],
    ['ตอนนี้แบบผ่านหรือยัง',                           'findings'],
    ['ระบบนี้กี่กิโลวัตต์',                            'overview'],
    ['ทำเสร็จแล้วต้องส่งออกไฟล์อะไร',                   'file-flow'],
    /* นอกขอบเขต ต้องตอบว่าไม่รู้ ห้ามเดา */
    ['ราคาค่าติดตั้งต่อวัตต์เท่าไร',                    'none'],
    ['อากาศวันนี้เป็นอย่างไร',                          'none'],
    ['ช่วยเขียนอีเมลหาลูกค้าให้หน่อย',                   'none']
];

const hit = m => m.kind === 'topic' ? m.kb : m.kind === 'intent' ? m.id : m.kind;

let right = 0, wrong = 0, dunno = 0;
const misses = [], errors = [];

console.log('ชุดสำรวจ · คำถามที่พูดคนละแบบกับคำในตาราง');
console.log('─'.repeat(78));
CASES.forEach(([q, want]) => {
    const m = CP.matchTopic(q);
    const got = hit(m);
    let mark;
    if (got === want)                            { mark = 'ถูก';   right++; }
    else if (got === 'none' || got === 'unsure') { mark = 'ไม่รู้'; dunno++; misses.push(q + '  → ควรได้ ' + want); }
    else                                         { mark = 'ผิด';   wrong++; errors.push(q + '  → ได้ ' + got + ' ควรได้ ' + want); }
    console.log(mark.padEnd(7) + ' ' + q.padEnd(46) + ' → ' + got + (got === want ? '' : '   (ควรได้ ' + want + ')'));
});

const n = CASES.length;
console.log('');
console.log('═'.repeat(78));
console.log('ถูก ' + right + '/' + n + ' = ' + (right * 100 / n).toFixed(0) + ' %'
          + ' · ไม่รู้ ' + dunno + ' · ผิด ' + wrong);

if (misses.length) {
    console.log('');
    console.log('ตอบไม่ได้ · รายการงานสำหรับเติมคำพ้องรอบถัดไป');
    misses.forEach(x => console.log('  · ' + x));
}
if (errors.length) {
    console.log('');
    console.log('ตอบผิด · ยอมไม่ได้ ต้องแก้ก่อนส่ง');
    errors.forEach(x => console.log('  ! ' + x));
}
process.exit(wrong === 0 ? 0 : 1);
