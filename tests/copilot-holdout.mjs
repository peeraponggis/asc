/* ============================================================================
 *  ชุดกันไว้วัด (holdout) · ตัวเลขความแม่นที่เชื่อได้จริง
 *
 *  รัน   node tests/copilot-holdout.mjs
 *
 *  ทำไมต้องมีชุดที่สาม
 *  ----------------------------------------------------------------------
 *  สองชุดแรกใช้ตัวเลขอ้างความแม่นไม่ได้ เพราะคำพ้องในตาราง TOPICS
 *  ถูกเขียนและปรับ **โดยดูชุดนั้นเป็นตัวตั้ง** ตัวเลขจึงสูงเกินจริงเสมอ
 *
 *    · copilot-match.mjs   15/15  ← เขียนคำพ้องโดยดูชุดนี้
 *    · copilot-survey.mjs  27/28  ← วัดครั้งแรกได้ 15/28 แล้วเติมคำพ้องตาม
 *
 *  ไฟล์นี้เขียนขึ้น **หลังจากปรับคำพ้องเสร็จหมดแล้ว** และมีกติกาว่า
 *  **ห้ามเติมคำพ้องเพื่อให้ข้อในไฟล์นี้ผ่าน** ตัวเลขที่ได้จึงเป็นค่าประมาณ
 *  ที่ใกล้ของจริงที่สุดเท่าที่วัดได้ก่อนเอาไปใช้งานจริง
 *
 *  ถ้าวันหนึ่งจำเป็นต้องแก้ชุดนี้ ให้เขียนชุดใหม่เพิ่ม อย่าแก้ของเดิม
 *  ไม่งั้นจะเสียคุณสมบัติเดียวที่ทำให้ไฟล์นี้มีค่า
 *
 *  เกณฑ์เดียวที่บังคับ คือ **ห้ามตอบผิด** ส่วนสัดส่วนที่ตอบได้เป็นตัวเลข
 *  ไว้ตัดสินใจทีหลังว่าคุ้มที่จะเสียบ LLM ไหม
 * ==========================================================================*/

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DOCS = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs');
const g = globalThis; g.window = g;
new Function(readFileSync(join(DOCS, 'asc-kb.js'), 'utf8'))();
new Function(readFileSync(join(DOCS, 'asc-copilot.js'), 'utf8'))();
const CP = g.AscCopilot;

const CASES = [
    ['clipping เกิดตอนไหน',                              'dcac-ratio'],
    ['อัตราส่วนดีซีเอซีควรอยู่เท่าไร',                    'dcac-ratio'],
    ['แผงเรียงกี่ใบต่อชุดถึงจะปลอดภัย',                   'voc-cold'],
    ['ค่า Voc รวมเกินพิกัดอินเวอร์เตอร์หรือยัง',           'voc-cold'],
    ['สตริงสั้นไปจะเป็นอะไรไหม',                          'mppt-window'],
    ['แผงหันทางไหนได้ไฟเยอะสุด',                          'azimuth-thailand'],
    ['ควรวางแผงเอียงกี่องศา',                            'tilt-thailand'],
    ['เงาจากอาคารข้างเคียงคิดยังไง',                      'shading-loss'],
    ['ต้องเว้นระยะขอบหลังคาเท่าไร',                       'edge-setback'],
    ['ค่า Performance Ratio ของงานนี้เท่าไร',              'pr-benchmark'],
    ['ฝุ่นทำให้เสียกี่เปอร์เซ็นต์',                        'soiling-thailand'],
    ['หลังคาเหล็กเก่าจะรับน้ำหนักแผงไหวไหม',              'roof-load'],
    ['หม้อแปลง 250 kVA ใส่ได้กี่กิโลวัตต์',                'transformer'],
    ['เบรกเกอร์ฝั่งเอซีต้องกี่แอมป์',                     'breaker-sizing'],
    ['อินเวอร์เตอร์ต้องผ่านมาตรฐานอะไรถึงขนานไฟได้',       'grid-code'],
    ['ต่อกี่สตริงเข้าช่อง MPPT เดียวได้',                  'mppt-current'],
    ['ประสิทธิภาพอินเวอร์เตอร์ที่ใช้จำลองเท่าไร',          'inverter-efficiency'],
    ['ต้องมีฟิวส์ไหมถ้ามีแค่สองสตริง',                     'eit-string-ocpr'],
    ['SPD ต้องเป็น Type ไหน',                             'eit-spd'],
    ['ป้ายเตือนแบตเตอรี่ต้องติดด้วยไหม',                   'eit-labels'],
    ['ตอนนี้มีอะไรที่ต้องแก้บ้าง',                         'findings'],
    ['สรุปโครงการนี้ให้หน่อย',                             'overview'],
    ['ต่อจากนี้ต้องทำอะไร',                                'next'],
    /* นอกขอบเขต ต้องไม่เดา */
    ['บริษัทเราตั้งอยู่ที่ไหน',                            'none'],
    ['ช่วยคำนวณภาษีมูลค่าเพิ่มให้หน่อย',                    'none']
];

const hit = m => m.kind === 'topic' ? m.kb : m.kind === 'intent' ? m.id : m.kind;

let right = 0, wrong = 0, dunno = 0;
const misses = [], errors = [];

console.log('ชุดกันไว้วัด · ไม่ได้ปรับคำพ้องตามชุดนี้');
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
console.log('นี่คือตัวเลขที่ใช้อ้างความแม่นได้ ไม่ใช่ตัวเลขจากสองชุดแรก');

if (misses.length) {
    console.log('');
    console.log('ตอบไม่ได้ · ห้ามแก้ด้วยการเติมคำพ้องให้ตรงข้อพวกนี้');
    console.log('ให้เอาไปเทียบกับคำถามจริงจาก log ของผู้ใช้แทน');
    misses.forEach(x => console.log('  · ' + x));
}
if (errors.length) {
    console.log('');
    console.log('ตอบผิด · ยอมไม่ได้');
    errors.forEach(x => console.log('  ! ' + x));
}
process.exit(wrong === 0 ? 0 : 1);
