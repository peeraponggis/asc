/* ============================================================================
 *  ASC · จับคู่แบตเตอรี่กับอินเวอร์เตอร์
 *
 *  ปัญหาเดิม
 *  ----------------------------------------------------------------------
 *  คลังมีแบตเตอรี่ 59 รุ่น อินเวอร์เตอร์ไฮบริด 70 กว่ารุ่น ตัวเลือกในหน้า
 *  ออกแบบเรียงตามยี่ห้อล้วน ไม่มีอะไรบอกว่ารุ่นไหนต่อกับรุ่นไหนได้
 *  วิศวกรจึงต้องจำเอง หรือเปิดเอกสาร compatibility list ควบคู่ไปด้วย
 *
 *  ที่แย่กว่านั้นคือความผิดพลาดชนิดนี้เงียบมาก เลือกแบตแรงดันต่ำ 48 V
 *  ไปคู่กับอินเวอร์เตอร์แรงดันสูง 100-700 V แล้วโปรแกรมก็ยังคำนวณจนจบ
 *  ออกใบเสนอราคาได้ตามปกติ กว่าจะรู้ก็ตอนของถึงหน้างาน
 *
 *  หลักที่ยึด
 *  ----------------------------------------------------------------------
 *  · **ไม่ซ่อนตัวเลือก** ทุกรุ่นยังเลือกได้ เพียงแต่จัดกลุ่มและติดป้ายให้
 *    เพราะเอกสารของผู้ผลิตไม่เคยครบ ถ้าซ่อนไปจะบล็อกคู่ที่ใช้ได้จริง
 *  · **แยกให้ชัดว่ารู้จากอะไร** ตรงตามเอกสาร กับ แค่แรงดันเข้ากันได้
 *    เป็นคนละความมั่นใจกัน ห้ามแสดงเป็นอย่างเดียวกัน
 *  · **ข้อมูลไม่พอ ต้องบอกว่าไม่พอ** ไม่ใช่เดาว่าเข้ากันได้
 *
 *  ไม่คำนวณตัวเลขอะไรใหม่ อ่านจากฟิลด์ในดาต้าชีตล้วน
 * ==========================================================================*/

(function (global) {
    'use strict';

    /* ── ตัวช่วยเล็ก ๆ ─────────────────────────────────────────────────── */

    const num = v => { const n = parseFloat(v); return isFinite(n) ? n : null; };
    const str = v => (v === null || v === undefined) ? '' : String(v).trim();

    /* คีย์สำหรับเทียบชื่อรุ่น ตัดทุกอย่างที่ไม่ใช่ตัวอักษร ตัวเลข หรือจุด
       เพราะเอกสารเขียนขีดกับช่องว่างไม่ตรงกัน เช่น
       "SUN2000-10K-MAP0" · "SUN2000 10K MAP0" · "sun2000_10k_map0" */
    const key = s => str(s).toUpperCase().replace(/[^0-9A-Z.]/g, '');

    /* ── แยกรายการรุ่นที่เอกสารระบุ ────────────────────────────────────────

       รูปแบบที่เจอจริงในคลัง และต้องรองรับให้ครบ

         "Sungrow SH5T, SH6T, SH8T, ..."          ยี่ห้อนำหน้าแล้วไล่รุ่น
         "S6-EH3P(5-10)K2-H, S6-EH3P(12-20)K-H"   วงเล็บเป็นช่วงกำลัง
         "SigenStor EC series"                     ลงท้าย series = ทั้งตระกูล
         "LUNA2000-5/10/15-S0"                     ทับเป็นการไล่ตัวเลข
         "... (Solis battery option PYLON_LV)"     วงเล็บท้ายเป็นหมายเหตุ ไม่ใช่รุ่น

       ตัวแยกความต่างระหว่างวงเล็บสองแบบคือ **ช่องว่างข้างใน**
       ช่วงกำลังไม่มีช่องว่าง "(5-10)" ส่วนหมายเหตุมีเสมอ "(Solis battery option ...)" */

    function stripTrailingNote(text) {
        /* ตัดเฉพาะวงเล็บก้อนสุดท้ายที่มีช่องว่างข้างใน ซึ่งคือหมายเหตุ */
        return str(text).replace(/\(([^()]*\s[^()]*)\)\s*$/, '').trim();
    }

    /* ขยาย "A/B/C" ที่เป็นตัวเลขล้วนออกเป็นหลายโทเคน
       "LUNA2000-5/10/15-S0" -> LUNA2000-5-S0 · LUNA2000-10-S0 · LUNA2000-15-S0 */
    function expandSlashes(tok) {
        const m = /(\d+(?:\.\d+)?)((?:\/\d+(?:\.\d+)?)+)/.exec(tok);
        if (!m) return [tok];
        const parts = (m[1] + m[2]).split('/');
        const head = tok.slice(0, m.index);
        const tail = tok.slice(m.index + m[0].length);
        const out = [];
        parts.forEach(p => expandSlashes(head + p + tail).forEach(x => out.push(x)));
        return out;
    }

    function parseList(text, brandHint) {
        let t = stripTrailingNote(text);
        if (!t) return [];

        /* ตัดชื่อยี่ห้อที่นำหน้าทั้งก้อนออก เช่น "Sungrow SH5T, SH6T" -> "SH5T, SH6T"
           ทำเฉพาะเมื่อรู้ยี่ห้อจริง ๆ จะได้ไม่เผลอตัดคำที่เป็นส่วนหนึ่งของชื่อรุ่น */
        const b = str(brandHint);
        if (b && t.toUpperCase().indexOf(b.toUpperCase()) === 0) t = t.slice(b.length).trim();

        const out = [];
        t.split(',').forEach(raw => {
            let tok = raw.trim();
            if (!tok) return;
            /* ยี่ห้ออาจซ้ำมาทุกโทเคน ตัดออกอีกชั้น */
            if (b && tok.toUpperCase().indexOf(b.toUpperCase()) === 0) tok = tok.slice(b.length).trim();
            if (!tok) return;
            expandSlashes(tok).forEach(x => out.push(x));
        });
        return out;
    }

    /* โทเคนหนึ่งตัวตรงกับชื่อรุ่นนี้ไหม */
    function tokenMatches(tok, model) {
        const M = key(model);
        if (!M) return false;

        const raw = str(tok);

        /* รูปแบบช่วง "S6-EH3P(5-10)K2-H"
           แยกเป็น หัว · ช่วงตัวเลข · ท้าย แล้วดูว่าเลขในชื่อรุ่นอยู่ในช่วงไหม */
        const rng = /^(.*)\((\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\)(.*)$/.exec(raw);
        if (rng) {
            const head = key(rng[1]), lo = parseFloat(rng[2]), hi = parseFloat(rng[3]), tail = key(rng[4]);
            if (!M.startsWith(head)) return false;
            if (tail && !M.endsWith(tail)) return false;
            const mid = M.slice(head.length, tail ? M.length - tail.length : M.length);
            const v = parseFloat(mid);
            /* ต้องเป็นตัวเลขล้วน ไม่งั้น "S6-EH3P10K02-NV-YD-L" จะไปเข้าช่วงของ "(5-10)K2-H" */
            if (!/^\d+(\.\d+)?$/.test(mid) || !isFinite(v)) return false;
            return v >= lo && v <= hi;
        }

        const K = key(raw);
        if (!K) return false;

        /* "SigenStor EC series" = ทั้งตระกูลที่ขึ้นต้นแบบนี้ */
        if (K.endsWith('SERIES')) {
            const head = K.slice(0, -'SERIES'.length);
            return head.length >= 3 && M.startsWith(head);
        }

        return M === K;
    }

    function listMatches(text, model, brandHint) {
        const toks = parseList(text, brandHint);
        for (let i = 0; i < toks.length; i++) if (tokenMatches(toks[i], model)) return toks[i].trim();
        return null;
    }

    /* ── ช่วงแรงดันแบตเตอรี่ ──────────────────────────────────────────────

       ฝั่งอินเวอร์เตอร์ใช้ Battery_Voltage_Range_Min_V / Max_V
       ฝั่งแบตเตอรี่ใช้ Operating_Voltage_Min_V / Max_V และถ้าไม่มีก็ใช้แรงดันระบุ
       (แบตแร็ก 48 V หลายรุ่นให้แค่แรงดันระบุ ไม่ได้ให้ช่วงทำงาน) */

    function batWindow(bat) {
        const lo = num(bat.Operating_Voltage_Min_V);
        const hi = num(bat.Operating_Voltage_Max_V);
        if (lo && hi && hi > lo) return { lo: lo, hi: hi, from: 'range' };
        const nomv = num(bat.Nominal_Voltage_V);
        if (nomv) return { lo: nomv, hi: nomv, from: 'nominal' };
        return null;
    }

    function invWindow(inv) {
        const lo = num(inv.Battery_Voltage_Range_Min_V);
        const hi = num(inv.Battery_Voltage_Range_Max_V);
        if (lo && hi && hi > lo) return { lo: lo, hi: hi };
        return null;
    }

    const cls = o => str(o.Battery_Coupling_Class || o.Battery_Voltage_Class).toUpperCase();

    /* ── ผลการจับคู่ ──────────────────────────────────────────────────────

       level  doc     เอกสารของฝั่งใดฝั่งหนึ่งระบุรุ่นนี้ไว้ตรง ๆ
              volt    เอกสารไม่ได้ระบุ แต่ช่วงแรงดันเข้ากันได้ทั้งช่วง
              partial ช่วงแรงดันซ้อนกันบางส่วน ใช้ได้แต่จะจำกัดจำนวนโมดูล
              no      คนละชนิดแรงดัน หรือช่วงไม่ซ้อนกันเลย
              unknown ข้อมูลไม่พอจะตัดสิน */

    function match(inv, bat) {
        const I = inv || {}, B = bat || {};
        const iModel = str(I.Model_Name || I.model);
        const bModel = str(B.Model_Name || B.model);
        const iBrand = str(I.Manufacturer);
        const bBrand = str(B.Manufacturer);

        if (!iModel || !bModel) {
            return { level: 'unknown', why: 'ยังไม่ได้เลือกอุปกรณ์ครบทั้งสองฝั่ง' };
        }

        const iCls = cls(I), bCls = cls(B);

        /* อินเวอร์เตอร์ที่ไม่รองรับแบตเตอรี่เลย ตอบให้ชัดว่าไม่ใช่เรื่องจับคู่ */
        if (iCls === 'NONE' || str(I.Inverter_Type).toUpperCase() === 'STRING') {
            return { level: 'no', why: 'อินเวอร์เตอร์รุ่นนี้เป็นแบบสตริง ต่อแบตเตอรี่โดยตรงไม่ได้' };
        }

        /* เอกสารฝั่งไหนก็ได้ที่ระบุอีกฝั่งไว้ ถือว่ายืนยันแล้ว */
        const byBat = listMatches(B.Compatible_Inverter_Models, iModel, iBrand);
        const byInv = listMatches(I.Compatible_Battery_Models, bModel, bBrand);

        const iw = invWindow(I), bw = batWindow(B);
        let volt = 'unknown', voltWhy = '';

        if (iCls && bCls && iCls !== bCls) {
            volt = 'no';
            voltWhy = 'อินเวอร์เตอร์เป็นแบตแรงดัน ' + iCls + ' แต่แบตเตอรี่รุ่นนี้เป็น ' + bCls;
        } else if (iw && bw) {
            if (bw.lo >= iw.lo && bw.hi <= iw.hi) {
                volt = 'fit';
                voltWhy = 'ช่วงแรงดันแบตเตอรี่ ' + bw.lo + '-' + bw.hi + ' V อยู่ในช่วงที่อินเวอร์เตอร์รับได้ ' +
                          iw.lo + '-' + iw.hi + ' V';
            } else if (bw.hi < iw.lo || bw.lo > iw.hi) {
                volt = 'no';
                voltWhy = 'ช่วงแรงดันแบตเตอรี่ ' + bw.lo + '-' + bw.hi + ' V ไม่ซ้อนกับช่วงที่อินเวอร์เตอร์รับได้ ' +
                          iw.lo + '-' + iw.hi + ' V เลย';
            } else {
                volt = 'partial';
                voltWhy = 'ช่วงแรงดันแบตเตอรี่ ' + bw.lo + '-' + bw.hi + ' V ล้นออกนอกช่วงที่อินเวอร์เตอร์รับได้ ' +
                          iw.lo + '-' + iw.hi + ' V บางส่วน';
            }
            if (bw.from === 'nominal') {
                voltWhy += ' (ดาต้าชีตแบตเตอรี่ให้แต่แรงดันระบุ ไม่ได้ให้ช่วงทำงาน)';
            }
        } else {
            voltWhy = !iw ? 'ดาต้าชีตอินเวอร์เตอร์ไม่ได้ระบุช่วงแรงดันแบตเตอรี่'
                          : 'ดาต้าชีตแบตเตอรี่ไม่ได้ระบุแรงดัน';
        }

        /* เอกสารระบุไว้ แต่แรงดันขัดกัน ต้องเชื่อแรงดันและบอกว่าขัดกัน
           กรณีนี้แปลว่ามีอะไรผิดในคลัง ควรให้คนไปตรวจ ไม่ใช่กลบไว้ */
        if ((byBat || byInv) && volt === 'no') {
            return {
                level: 'no',
                why: 'เอกสารระบุว่าเข้ากันได้ แต่ช่วงแรงดันในคลังขัดกัน ' + voltWhy +
                     ' — ให้ตรวจดาต้าชีตทั้งสองฝั่งก่อนใช้',
                doc: byBat || byInv, volt: volt
            };
        }

        if (byBat || byInv) {
            return {
                level: 'doc',
                why: byBat
                    ? 'ดาต้าชีตแบตเตอรี่ระบุรุ่นอินเวอร์เตอร์นี้ไว้ (' + byBat + ')'
                    : 'ดาต้าชีตอินเวอร์เตอร์ระบุรุ่นแบตเตอรี่นี้ไว้ (' + byInv + ')',
                doc: byBat || byInv, volt: volt, voltWhy: voltWhy,
                option: batteryOption(B)
            };
        }

        if (volt === 'fit')    return { level: 'volt',    why: voltWhy, volt: volt, option: batteryOption(B) };
        if (volt === 'partial') return { level: 'partial', why: voltWhy, volt: volt, option: batteryOption(B) };
        if (volt === 'no')      return { level: 'no',      why: voltWhy, volt: volt };
        return { level: 'unknown', why: voltWhy };
    }

    /* ชื่อ Battery Option ที่ช่างต้องตั้งในเครื่อง เก็บไว้ในวงเล็บท้ายฟิลด์ตอนทำคลัง
       เป็นค่าที่ต้องใช้จริงหน้างาน จึงดึงออกมาแสดงแยก */
    function batteryOption(bat) {
        const m = /\(([^()]*battery option[^()]*)\)\s*$/i.exec(str((bat || {}).Compatible_Inverter_Models));
        return m ? m[1].replace(/^.*battery option\s*/i, '').trim() : '';
    }

    const LABEL = {
        doc    : 'ตรงตามเอกสาร',
        volt   : 'แรงดันเข้ากันได้',
        partial: 'แรงดันล้นช่วงบางส่วน',
        no     : 'ไม่เข้ากัน',
        unknown: 'ข้อมูลไม่พอ'
    };
    const RANK = { doc: 0, volt: 1, partial: 2, unknown: 3, no: 4 };

    global.AscBatMatch = {
        match       : match,
        LABEL       : LABEL,
        RANK        : RANK,
        batteryOption: batteryOption,
        /* เปิดไว้ให้ชุดทดสอบเรียกตรง ๆ */
        _parseList  : parseList,
        _tokenMatches: tokenMatches,
        _listMatches: listMatches
    };

})(typeof window !== 'undefined' ? window : globalThis);
