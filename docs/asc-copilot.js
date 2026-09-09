/* ============================================================================
 *  ASC Copilot v1 · ผู้ช่วยตอบคำถามในหน้าออกแบบ
 *
 *  ทำไมต้องมีไฟล์นี้
 *  ----------------------------------------------------------------------
 *  คำตอบของคำถามที่วิศวกรถามบ่อย — "ทำไม PR ต่ำ" · "DC/AC เท่านี้สูงไปไหม" ·
 *  "ต้องใส่ฟิวส์กี่ตัว" — กระจายอยู่สามที่ คือคู่มือ · ฐานความรู้ 28 บท ·
 *  ผลตรวจแบบ 36 ข้อ ผู้ใช้ต้องเปิดหาเองทีละที่
 *  ไฟล์นี้คือชั้นที่รวมสามอย่างนั้นแล้วตอบให้ในที่เดียว
 *
 *  v1 ไม่ใช้โมเดลภาษาเลย
 *  ----------------------------------------------------------------------
 *  ทุกอย่างทำงานในเครื่อง ไม่มีคำขอออกนอกเครื่องสักรายการ เหตุผลคือ
 *  ต้องการวัดก่อนว่าการจับคู่คำถามกับบทความตอบได้กี่เปอร์เซ็นต์จริง ๆ
 *  ถ้าพอก็จบ ไม่ต้องเสียค่าโทเคน ถ้าไม่พอค่อยเสียบ LLM เข้าที่ answer()
 *
 *  ⚠ ทำไมไม่ใช้ AscKB.search() ที่มีอยู่แล้ว
 *  ----------------------------------------------------------------------
 *  ตัวนั้นตัดคำด้วย split(/[\s,]+/) ซึ่งใช้กับภาษาไทยไม่ได้ เพราะภาษาไทย
 *  ไม่มีช่องว่างระหว่างคำ ทดสอบกับคำถามจริง 15 ข้อได้ผลว่าเจอบทความ 3 ข้อ
 *  และในสามข้อนั้นตอบถูกข้อเดียว คือความแม่นราว 7 %
 *  ตัวอย่างที่ผิด "ทำไม PR ต่ำ" ได้บทความแรงดันวงจรเปิดที่อุณหภูมิต่ำสุด
 *  เพราะแมตช์คำว่า "ต่ำ" · "เบรกเกอร์ AC ขนาดเท่าไหร่" ได้อัตราส่วน DC/AC
 *  เพราะแมตช์ "ac"
 *
 *  จึงเขียนตัวจับคู่ใหม่ในไฟล์นี้ และ **ไม่แตะ AscKB.search()**
 *  เพราะที่อื่นเรียกใช้อยู่
 *
 *  ⚠ กติกาที่ห้ามละเมิด (ยกมาจาก asc-advisor.js:6)
 *  ----------------------------------------------------------------------
 *  · เป็นแผงคนละแผงกับแผงตรวจแบบ คำตอบห้ามไปปนในรายการผลตรวจ
 *  · อ่านอย่างเดียว ห้ามเขียนค่าอะไรกลับเข้า state หรือ DB2
 *  · ห้ามอยู่ในเส้นทางที่ผลิตตัวเลขในรายงาน ลบไฟล์นี้ทิ้งแล้วทุกตัวเลข
 *    ต้องเท่าเดิม
 *  · **ห้ามคำนวณเลขใหม่ในชั้นนี้** ทุกตัวเลขยกมาจาก finding.evidence ตรง ๆ
 *    อยากได้ตัวเลขใหม่ให้ไปเพิ่มกฎใน asc-advisor.js ซึ่งตรวจย้อนกลับได้
 *  · **ตอบว่าไม่รู้ ดีกว่าเดา** ตอบผิดแย่กว่าไม่ตอบ เพราะผู้ใช้จะเชื่อ
 * ==========================================================================*/

(function (global) {
    'use strict';

    const LOG_KEY = 'asc_copilot_log';
    const LOG_MAX = 500;

    /* ── ปรับข้อความให้เทียบกันได้ ─────────────────────────────────────────
       ตัดช่องว่างและเครื่องหมายทิ้งทั้งหมด เพื่อให้ "ทำไม PR ต่ำ" กับ
       "ทำไมค่าPRต่ำ" กลายเป็นข้อความที่ค้นเจอด้วยคำเดียวกัน
       ภาษาไทยไม่มีช่องว่างระหว่างคำอยู่แล้ว การตัดช่องว่างจึงไม่ทำให้เสียอะไร
       และ "DC/AC" กับ "dcac" ก็กลายเป็นรูปเดียวกันไปด้วย */
    function norm(s) {
        return String(s || '')
            .toLowerCase()
            .replace(/[ๆฯ]/g, '')          /* ๆ ฯ */
            .replace(/[^0-9a-z฀-๿]/g, ''); /* เหลือเลข อังกฤษ ไทย */
    }

    /* ── ตารางหัวข้อ · หัวใจของ v1 ─────────────────────────────────────────
       เขียนด้วยมือ แม่นที่สุดและตรวจสอบย้อนกลับได้ ต่างจากการเดาด้วยสถิติ

       กติกาการเลือกคำ
       · ห้ามใส่คำกว้างที่โผล่ได้ทุกบทความ เช่น "ค่า" "ต่ำ" "ระบบ" "ไฟ"
         นี่คือสาเหตุที่ตัวค้นเดิมพัง
       · คำที่สั้นและกำกวมอย่าง "pr" ใส่ได้ แต่ตัวตัดสินด้านล่างจะไม่ยอมรับ
         ถ้ามีหัวข้ออื่นได้คะแนนใกล้กัน จะถามกลับแทน
       · rule คือ id ของกฎใน asc-advisor.js ที่คู่กับบทความนี้
         null แปลว่าไม่มีกฎตรวจคู่กัน ตอบได้แต่เนื้อหาบทความ */
    const TOPICS = [
        { kb: 'dcac-ratio', rule: 'dcac', words: [
            'dcac', 'ดีซีเอซี', 'อัตราส่วนดีซี', 'clipping', 'คลิปปิ้ง',
            'ตัดยอดกำลัง', 'ตัดยอด', 'อินเวอร์เตอร์เล็กไป', 'แผงเยอะเกิน',
            'อินเวอร์เตอร์เล็กกว่า', 'แผงเยอะกว่าอินเวอร์เตอร์',
            'แผงมากกว่าอินเวอร์เตอร์', 'ใส่แผงได้เท่าไร' ] },

        { kb: 'voc-cold', rule: 'voc-cold', words: [
            'voc', 'วีโอซี', 'แรงดันวงจรเปิด', 'อากาศเย็น', 'อุณหภูมิต่ำสุด',
            'แรงดันเกินพิกัด', 'สตริงยาวเกิน', 'ต่อกี่แผงต่อสตริง',
            'กี่แผงต่อสตริง', 'แผงต่อสตริง', 'ต่อได้กี่แผง', 'สตริงหนึ่งต่อ',
            'หน้าหนาว', 'อากาศหนาว', 'แรงดันจะขึ้น', 'แรงดันเกิน' ] },

        /* 'mppt' เดี่ยว ๆ อยู่ในทั้งสองหัวข้อโดยตั้งใจ เพราะคำนี้บอกไม่ได้ว่า
           ถามเรื่องช่วงแรงดันหรือกระแสต่อช่อง สองหัวข้อจึงได้คะแนนเท่ากัน
           แล้วตัวตัดสินจะถามกลับ ซึ่งถูกต้องกว่าการเลือกข้างเอง
           ก่อนแก้ตรงนี้ "ต่อกี่สตริงเข้าช่อง MPPT เดียวได้" ได้บทความช่วงแรงดัน */
        { kb: 'mppt-window', rule: 'mppt-window', words: [
            'mppt', 'เอ็มพีพีที', 'ช่วงแรงดันทำงาน', 'หน้าต่างแรงดัน',
            'vmp', 'แรงดันขาเข้าต่ำสุด', 'สตริงสั้นเกิน', 'แรงดันต่ำสุด',
            'ช่วงทำงานของอินเวอร์เตอร์' ] },

        { kb: 'azimuth-thailand', rule: 'azimuth', words: [
            'azimuth', 'อะซิมุท', 'ทิศของแผง', 'ทิศแผง', 'หันทิศ', 'หันไปทาง',
            'ทิศใต้', 'ทิศเหนือ', 'ทิศไหนดี', 'หันทางไหน' ] },

        { kb: 'tilt-thailand', rule: 'tilt', words: [
            'มุมเอียง', 'ความเอียงแผง', 'องศาเอียง', 'tilt', 'เอียงกี่องศา',
            'แผงเอียง' ] },

        { kb: 'gable-vs-valley', rule: 'gable-valley', words: [
            'หลังคาจั่ว', 'จั่ว', 'รางน้ำ', 'หลังคาสองผืน', 'สันหลังคาแบ่ง',
            'gable', 'valley', 'หลังคาสองด้าน', 'คนละทิศ',
            'แยกสตริงตามทิศ', 'สองผืนคนละทิศ' ] },

        { kb: 'shading-loss', rule: 'shading', words: [
            'เงาบัง', 'เงา', 'shading', 'บังแดด', 'สูญเสียจากเงา',
            'ถูกบัง', 'โดนบัง' ] },

        { kb: 'tree-growth', rule: 'tree-growth', words: [
            'ต้นไม้', 'ตัดต้นไม้', 'ต้นไม้โต', 'การเติบโตของต้นไม้', 'ทรงพุ่ม' ] },

        { kb: 'edge-setback', rule: 'edge-setback', words: [
            'ระยะเว้นขอบ', 'เว้นขอบ', 'setback', 'ทางเดิน', 'walkway',
            'ระยะขอบหลังคา', 'ทางเดินดับเพลิง' ] },

        { kb: 'pvzone', rule: 'roof-usage', words: [
            'พื้นที่วางแผง', 'pvzone', 'สิ่งกีดขวาง', 'keepout', 'พื้นที่ห้ามวาง',
            'ใช้พื้นที่หลังคาได้เท่าไร', 'สัดส่วนพื้นที่' ] },

        { kb: 'pr-benchmark', rule: 'pr', words: [
            'pr', 'พีอาร์', 'performanceratio', 'ประสิทธิภาพระบบ',
            'ผลตอบแทนเชิงประสิทธิภาพ', 'ผลิตไฟได้น้อย', 'ผลิตไฟได้แย่',
            'ได้ไฟน้อยกว่าที่คิด', 'ต่ำกว่าที่คำนวณ' ] },

        { kb: 'soiling-thailand', rule: 'soiling', words: [
            'soiling', 'คราบสกปรก', 'ฝุ่น', 'ล้างแผง', 'ความสกปรก',
            'ขี้นก', 'ทำความสะอาดแผง', 'แผงสกปรก', 'สกปรก' ] },

        { kb: 'bifacial', rule: 'bifacial', words: [
            'bifacial', 'สองหน้า', 'แผงสองหน้า', 'albedo', 'อัลบีโด',
            'สะท้อนจากพื้น' ] },

        { kb: 'roof-load', rule: 'roof-load', words: [
            'น้ำหนักบนหลังคา', 'น้ำหนักแผง', 'รับน้ำหนัก', 'โครงสร้างหลังคา',
            'หลังคารับได้', 'กิโลกรัมต่อตารางเมตร', 'ksm', 'โหลดหลังคา',
            'โครงสร้างจะรับ', 'รับไหว', 'หลังคารับ' ] },

        { kb: 'transformer', rule: 'transformer', words: [
            'หม้อแปลง', 'transformer', 'พิกัดหม้อแปลง', 'kva' ] },

        { kb: 'breaker-sizing', rule: 'ac-breaker', words: [
            'เบรกเกอร์', 'breaker', 'cb', 'พิกัดเบรกเกอร์', 'ขนาดเบรกเกอร์',
            'at', 'ขนาดสาย', 'สายเมน' ] },

        { kb: 'grid-code', rule: 'grid-code', words: [
            'gridcode', 'ขนานไฟ', 'ขออนุญาต', 'การไฟฟ้า', 'antiislanding',
            'lvrt', 'กฟภ', 'กฟน', 'ขายไฟ', 'ใบอนุญาต' ] },

        { kb: 'mppt-current', rule: 'mppt-current', words: [
            'mppt', 'เอ็มพีพีที', 'กระแสขาเข้า', 'กระแสต่อช่อง', 'isc', 'imp', 'กระแสสูงสุด',
            'ต่อกี่สตริงต่อช่อง', 'สตริงต่อmppt', 'inputspermppt' ] },

        { kb: 'uncertainty', rule: 'uncertainty', words: [
            'p50', 'p75', 'p90', 'ความไม่แน่นอน', 'uncertainty',
            'ความเสี่ยงของตัวเลข' ] },

        { kb: 'inverter-efficiency', rule: 'inverter-eff', words: [
            'ประสิทธิภาพอินเวอร์เตอร์', 'euroeta', 'ประสิทธิภาพยุโรป',
            'efficiency', 'ประสิทธิภาพแปลงไฟ' ] },

        { kb: 'wiring-loss', rule: 'wiring-loss', words: [
            'สูญเสียในสาย', 'แรงดันตก', 'voltagedrop', 'สายไฟยาว',
            'ระยะเดินสาย', 'สูญเสียสายไฟ', 'สายยาว', 'เสียแรงดัน' ] },

        { kb: 'per-roof-values', rule: null, words: [
            'ค่ารายหลังคา', 'ค่ากลาง', 'ตั้งค่าทีละหลังคา', 'ค่าไหนใช้ร่วมกัน',
            'แยกรายหลังคา' ] },

        { kb: 'ridge-tool', rule: 'ridge-eave', words: [
            'สันหลังคา', 'ชายคา', 'วาดสัน', 'เครื่องมือสัน', 'ridge',
            'ความสูงสัน' ] },

        { kb: 'eit-string-ocpr', rule: 'string-ocpr', words: [
            'ฟิวส์', 'fuse', 'ocpr', 'ป้องกันกระแสเกิน', 'ฟิวส์สตริง',
            'เบรกเกอร์ดีซี', 'dcbreaker' ] },

        { kb: 'eit-spd', rule: 'spd', words: [
            'spd', 'กันฟ้าผ่า', 'ฟ้าผ่า', 'ไฟกระชาก', 'surge', 'เสิร์จ' ] },

        { kb: 'eit-lps', rule: 'lps-bonding', words: [
            'ล่อฟ้า', 'ระบบล่อฟ้า', 'ระบบป้องกันฟ้าผ่า', 'lps',
            'ระยะแยก', 'ระยะการแยก', 'separation',
            'ประสานศักย์', 'ต่อประสาน', 'bonding',
            'ตัวนำลงดิน', 'ความต้านทานดิน', 'รากสายดิน' ] },

        { kb: 'eit-dc-cable', rule: 'dc-cable-ampacity', words: [
            'พิกัดนำกระแส', 'ampacity', 'สายดีซี', 'สายฝั่งไฟตรง',
            'ท่อร้อยสาย', 'ขนาดสายดีซี', 'สายชิดหลังคา', 'สายฝั่งแผง',
            'สายไฟฝั่งแผง' ] },

        { kb: 'eit-labels', rule: 'labels', words: [
            'ป้าย', 'signage', 'ป้ายเตือน', 'ติดป้าย', 'เอกสารประจำระบบ',
            'label' ] },

        { kb: 'file-flow', rule: null, words: [
            'db0', 'db1', 'db2', 'db3', 'ลำดับไฟล์', 'ส่งต่อไฟล์',
            'ไฟล์ไหนใช้กับเมนูไหน', 'ส่งออกไฟล์อะไร' ] },

        /* คำที่คนถามจริงเวลาเลือกแบตไม่ถูก มักถามเป็นคู่ว่า 'ต่อกันได้ไหม'
           จึงเก็บทั้งคำว่าแบตเตอรี่ ชื่อยี่ห้อที่ขายในไทย และคำถามเรื่องแรงดัน */
        { kb: 'battery-match', rule: 'bat-inverter', words: [
            'แบตเตอรี่ใช้กับ', 'แบตใช้กับ', 'แบตเตอรี่รุ่นไหน', 'แบตรุ่นไหน',
            'แบตเตอรี่เข้ากัน', 'แบตเข้ากัน', 'ต่อแบตเตอรี่', 'เลือกแบตเตอรี่',
            'compatible battery', 'battery option', 'bms',
            'แรงดันแบตเตอรี่', 'แรงดันแบต', 'pylontech', 'dyness', 'lvtopsun' ] }
    ];

    /* ── คำถามที่ไม่ได้ถามถึงหัวข้อ แต่ถามถึงตัวโครงการที่เปิดอยู่ ────────
       สามข้อนี้ตอบจากสถานะจริงล้วน ไม่มีบทความคู่กัน */
    const INTENTS = [
        { id: 'findings', words: [
            'ผลตรวจ', 'ตรวจแบบ', 'ขึ้นเหลือง', 'ขึ้นแดง', 'สีเหลือง', 'สีแดง',
            'กี่ข้อ', 'มีปัญหาอะไร', 'แก้อะไรบ้าง', 'เตือนอะไร',
            'ตรวจเจออะไร', 'ผ่านไหม', 'ผ่านหรือยัง', 'มีอะไรต้องแก้',
            'เรียบร้อยหรือยัง' ] },
        { id: 'overview', words: [
            'ภาพรวมโครงการ', 'สรุปโครงการ', 'สรุประบบ', 'ขนาดระบบ',
            /* เคยใส่ 'กี่แผง' ไว้ แล้วไปแย่งคำถาม "สตริงหนึ่งต่อได้กี่แผง"
               ซึ่งเป็นเรื่องแรงดันสตริง ไม่ใช่ภาพรวมโครงการ จึงต้องเจาะจงกว่านี้ */
            'กี่กิโลวัตต์', 'กี่kwp', 'ระบบใหญ่แค่ไหน', 'ทั้งหมดกี่แผง',
            'มีกี่แผง', 'ใช้แผงกี่' ] },
        { id: 'next', words: [
            'ขั้นตอนต่อไป', 'ต่อไปทำอะไร', 'ทำอะไรต่อ', 'ขั้นถัดไป',
            'ต้องทำอะไรอีก', 'เหลืออะไรอีก' ] }
    ];

    /* เตรียมรูปที่ค้นแล้วครั้งเดียว ไม่ต้องแปลงซ้ำทุกคำถาม */
    const T_NORM = TOPICS.map(t => ({
        kb: t.kb, rule: t.rule, words: t.words.map(norm).filter(Boolean)
    }));
    const I_NORM = INTENTS.map(t => ({
        id: t.id, words: t.words.map(norm).filter(Boolean)
    }));

    /* ── ชั้นที่ 1 · ตารางคำพ้อง ───────────────────────────────────────────
       คะแนนคือความยาวของคำที่ยาวที่สุดซึ่งพบในคำถาม บวกครึ่งหนึ่งของคำอื่น
       ที่พบด้วย เพราะคำยาวเป็นสัญญาณที่เชื่อได้มากกว่าคำสั้นหลายคำรวมกัน */
    function scoreOne(nq, words) {
        const hits = words.filter(w => w.length >= 2 && nq.indexOf(w) >= 0);
        if (!hits.length) return { score: 0, hits: hits };
        const lens = hits.map(w => w.length).sort((a, b) => b - a);
        const score = lens[0] + lens.slice(1).reduce((s, n) => s + n / 2, 0);
        return { score: score, hits: hits };
    }

    function matchTable(nq) {
        const out = [];
        I_NORM.forEach(t => {
            const r = scoreOne(nq, t.words);
            if (r.score) out.push({ kind: 'intent', id: t.id, score: r.score, hits: r.hits });
        });
        T_NORM.forEach(t => {
            const r = scoreOne(nq, t.words);
            if (r.score) out.push({ kind: 'topic', kb: t.kb, rule: t.rule, score: r.score, hits: r.hits });
        });
        out.sort((a, b) => b.score - a.score);
        return out;
    }

    /* ── ชั้นที่ 2 · n-gram สำรอง ──────────────────────────────────────────
       ตัดคำถามเป็นชิ้นละ 4 อักขระ แล้วนับว่าตรงกับชื่อบทความหรือแท็กกี่ชิ้น

       ⚠ ชั้นนี้ **ห้ามตอบเอง** ทำได้แค่เสนอหัวข้อให้ผู้ใช้กดเลือก
       เพราะการวัดจริงพบว่ามันเดาเป็นหัวข้อที่ไม่เกี่ยวเลยได้ เช่น
       "อากาศวันนี้เป็นอย่างไร" ไปโผล่เป็นบทความพื้นที่วางแผง
       ซึ่งผิดกติกาข้อที่ว่าตอบว่าไม่รู้ดีกว่าเดา การจำกัดให้เสนอตัวเลือก
       อย่างเดียวทำให้ชั้นนี้ไม่มีทางสร้างคำตอบผิดได้เลย */
    function matchNgram(nq) {
        const KB = global.AscKB && global.AscKB.articles;
        if (!KB || nq.length < 4) return [];
        const grams = [];
        for (let i = 0; i + 4 <= nq.length; i++) grams.push(nq.slice(i, i + 4));
        const uniq = grams.filter((g, i) => grams.indexOf(g) === i);
        const out = [];
        T_NORM.forEach(t => {
            const a = KB[t.kb];
            if (!a) return;
            const hay = norm(a.title + (a.tags || []).join(''));
            const n = uniq.filter(g => hay.indexOf(g) >= 0).length;
            if (n >= 3) out.push({ kind: 'topic', kb: t.kb, rule: t.rule, score: n, hits: [], via: 'ngram' });
        });
        out.sort((a, b) => b.score - a.score);
        return out;
    }

    /* ── ตัวตัดสิน ─────────────────────────────────────────────────────────
       รับคำตอบเดียวก็ต่อเมื่อมั่นใจจริง ไม่งั้นถามกลับ
       เกณฑ์คือคะแนนที่หนึ่งต้องนำที่สองอย่างน้อย 2 คะแนน
       ถ้าคะแนนใกล้กันแปลว่าคำถามกำกวม การเดาในกรณีนี้คือการตอบผิด */
    function matchTopic(q) {
        const nq = norm(q);
        if (nq.length < 2) return { kind: 'none', nq: nq, cands: [] };

        const all = matchTable(nq);
        if (all.length) {
            /* คำถามภาพรวมใช้สำนวนยาวอย่าง "กี่กิโลวัตต์" ซึ่งได้คะแนนสูง
               ตามความยาว แล้วไปชนะศัพท์เฉพาะที่สั้นกว่าอย่าง "หม้อแปลง"
               "หม้อแปลง 250 kVA ใส่ได้กี่กิโลวัตต์" จึงเคยได้คำตอบเป็นภาพรวม
               โครงการ ทั้งที่ถามเรื่องหม้อแปลงชัดเจน

               กติกาคือ **ถ้าในคำถามมีศัพท์เฉพาะของหัวข้อใดอยู่ ให้ถือว่า
               ถามเรื่องนั้นเสมอ** คำถามภาพรวมจะถูกใช้ต่อเมื่อไม่มีศัพท์เฉพาะ
               อยู่เลย

               เคยลองใช้เกณฑ์แบบเทียบคะแนนกันก่อน แต่ไม่ได้ผล เพราะคะแนน
               คิดจากความยาวคำ และสำนวนถามภาพรวมในภาษาไทยยาวกว่าศัพท์เฉพาะ
               อยู่แล้วโดยธรรมชาติ การเทียบคะแนนจึงเข้าข้างคำถามภาพรวมเสมอ
               คำถามภาพรวมที่ถูกกันออกไปยังโผล่เป็นตัวเลือกให้กดได้อยู่ */
            const topics  = all.filter(x => x.kind === 'topic');
            const pool    = topics.length ? topics : all;

            const best = pool[0], second = pool[1];
            if (!second || best.score - second.score >= 2)
                return Object.assign({ layer: 1, nq: nq, cands: all.slice(0, 5) }, best);
            /* คะแนนใกล้กัน ให้ผู้ใช้เลือกเอง */
            return { kind: 'unsure', layer: 1, nq: nq, cands: pool.slice(0, 4) };
        }

        /* ชั้น 2 เสนอตัวเลือกได้อย่างเดียว ไม่ตอบเอง เหตุผลอยู่ที่ matchNgram */
        const t2 = matchNgram(nq);
        if (t2.length)
            return { kind: 'unsure', layer: 2, nq: nq, cands: t2.slice(0, 4) };

        return { kind: 'none', layer: 3, nq: nq, cands: [] };
    }

    /* ── บริบทของโครงการที่เปิดอยู่ ────────────────────────────────────────
       ใช้ทางเดียวกับแผงตรวจแบบเป๊ะ คือ generateDB2() แล้วส่งเข้า
       AscAdvisor.analyze() จึงไม่มีตัวเก็บข้อมูลชุดที่สอง
       และไม่มีทางที่ Copilot กับแผงตรวจแบบจะเห็นตัวเลขไม่ตรงกัน */
    function buildContext() {
        const ctx = { ok: false, why: '', findings: [], summary: null, project: null };
        if (typeof global.generateDB2 !== 'function' || !global.AscAdvisor) {
            ctx.why = 'ยังโหลดตัวตรวจแบบไม่ครบ จึงอ่านสถานะโครงการไม่ได้';
            return ctx;
        }
        try {
            /* หน้าออกแบบประกาศ editableItems ด้วย let ในสคริปต์ธรรมดา ตัวแปรจึงอยู่
               ในขอบเขตศัพท์ของ global ไม่ได้ไปเกาะบน window เหมือน generateDB2
               ที่เป็น function declaration อ่านผ่าน global.editableItems จะได้ undefined
               เสมอ ต้องอ้างชื่อตรง ๆ โดยมี typeof กันไว้ เผื่อหน้าอื่นที่ไม่มีตัวแปรนี้ */
            const items = (typeof editableItems !== 'undefined') ? editableItems
                        : (global.editableItems || null);
            const roofs = items && items.getLayers
                ? items.getLayers().filter(l => l.drawMode === 'roof').length : 0;
            if (!roofs) {
                ctx.why = 'ยังไม่ได้วาดหลังคา จึงยังไม่มีข้อมูลให้วิเคราะห์';
                return ctx;
            }
            const db2 = global.generateDB2();
            const r   = global.AscAdvisor.analyze(db2);
            ctx.ok       = true;
            ctx.findings = r.findings;
            ctx.summary  = r.summary;
            ctx.project  = r.project;
            /* ตัวเลขภาพรวมอ่านผ่าน _normalize ตัวเดียวกับที่กฎทุกข้อใช้
               ไม่ไปงมเองใน DB2 เพราะ generateDB2 ห่อทุกอย่างไว้ใต้ base_layout_db1
               และถ้าวันหนึ่งโครงสร้างขยับ จะได้ขยับพร้อมกันทั้งระบบ
               ที่สำคัญกว่านั้นคือ Copilot กับแผงตรวจแบบจะไม่มีทางเห็นตัวเลขคนละชุด */
            const d = global.AscAdvisor._normalize(db2);
            ctx.kwp    = d.kwp;
            ctx.dcac   = d.dcac;
            ctx.counts = d.counts || {};
        } catch (e) {
            ctx.why = 'เตรียมข้อมูลเพื่อวิเคราะห์ไม่สำเร็จ · ' + (e && e.message ? e.message : e);
        }
        return ctx;
    }

    /* ── ประกอบคำตอบ ───────────────────────────────────────────────────────
       ทุกตัวเลขยกมาจาก finding.evidence ตรง ๆ ไม่มีการคำนวณใหม่ที่นี่ */
    const esc = s => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const LEVEL = {
        error: { ico: '⛔', name: 'ต้องแก้', col: '#991b1b', bg: '#fef2f2' },
        warn:  { ico: '⚠',  name: 'ควรทบทวน', col: '#92400e', bg: '#fffbeb' },
        info:  { ico: 'ℹ',  name: 'ข้อสังเกต', col: '#1e40af', bg: '#eff6ff' },
        ok:    { ico: '✓',  name: 'ผ่าน', col: '#166534', bg: '#f0fdf4' }
    };

    function findingHTML(f) {
        const L = LEVEL[f.level] || LEVEL.info;
        let h = '<div style="border-left:3px solid ' + L.col + '; background:' + L.bg
              + '; padding:8px 10px; border-radius:0 6px 6px 0; margin:6px 0;">'
              + '<div style="font-weight:700; color:' + L.col + ';">' + L.ico + ' ' + esc(f.title)
              + ' <span style="font-weight:500; opacity:.7;">· ' + L.name + '</span></div>';
        if (f.detail)   h += '<div style="margin-top:3px;">' + esc(f.detail) + '</div>';
        if (f.evidence) h += '<div style="margin-top:3px; font-family:ui-monospace,monospace; font-size:.92em; color:#334155;">'
                           + esc(f.evidence) + '</div>';
        if (f.fix && f.fix.length)
            h += '<div style="margin-top:5px;"><b>วิธีแก้</b><ul style="margin:3px 0 0 16px; padding:0;">'
               + f.fix.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>';
        if (f.eit)
            h += '<div style="margin-top:5px; font-size:.86em; color:#64748b;">อ้างอิง '
               + esc((global.AscAdvisor && global.AscAdvisor._eitStd) || 'วสท.') + ' ข้อ ' + esc(f.eit) + '</div>';
        return h + '</div>';
    }

    function articleHTML(kb, full) {
        const a = global.AscKB && global.AscKB.get ? global.AscKB.get(kb) : null;
        if (!a) return '';
        const paras = String(a.body || '').split(/\n{2,}/);
        const show  = full ? paras : paras.slice(0, 1);
        let h = '<div style="margin-top:8px; padding-top:8px; border-top:1px dashed #cbd5e1;">'
              + '<div style="font-weight:700; color:#334155;">📖 ' + esc(a.title) + '</div>'
              + show.map(p => '<div style="margin-top:4px;">' + esc(p).replace(/\n/g, '<br>') + '</div>').join('');
        if (!full && paras.length > 1)
            h += '<button type="button" data-cp-more="' + esc(kb) + '" style="margin-top:6px; background:#e2e8f0;'
               + ' border:0; border-radius:5px; padding:4px 10px; cursor:pointer; font-size:.86em; font-weight:600;'
               + ' color:#334155;">อ่านบทความเต็ม (' + paras.length + ' ย่อหน้า)</button>';
        if (full && a.refs && a.refs.length)
            h += '<div style="margin-top:6px; font-size:.86em; color:#64748b;"><b>ที่มา</b><br>'
               + a.refs.map(r => '• ' + esc(r)).join('<br>') + '</div>';
        return h + '</div>';
    }

    function composeTopic(m, ctx, full) {
        let h = '';
        const f = ctx.ok ? ctx.findings.filter(x => x.id === m.rule)[0] : null;

        if (f) {
            h += findingHTML(f);
        } else if (m.rule && ctx.ok) {
            h += '<div style="color:#64748b;">ข้อนี้ยังตรวจไม่ได้กับโครงการที่เปิดอยู่ '
               + 'เพราะข้อมูลที่กฎต้องใช้ยังไม่ครบ คำตอบด้านล่างจึงเป็นหลักการทั่วไป</div>';
        } else if (m.rule && !ctx.ok) {
            h += '<div style="color:#64748b;">' + esc(ctx.why)
               + ' คำตอบด้านล่างจึงเป็นหลักการทั่วไป ยังไม่ได้เจาะจงโครงการนี้</div>';
        }
        h += articleHTML(m.kb, full);
        return h;
    }

    function composeIntent(m, ctx) {
        if (!ctx.ok)
            return '<div style="color:#64748b;">' + esc(ctx.why) + '</div>';

        if (m.id === 'overview') {
            const c = ctx.counts || {};
            const row = (k, v) => v == null || v === '' ? ''
                : '<tr><td style="padding:2px 10px 2px 0; color:#64748b;">' + k
                + '</td><td style="font-weight:700;">' + esc(v) + '</td></tr>';
            return '<table style="border-collapse:collapse;">'
                 + row('โครงการ', ctx.project)
                 + row('กำลังติดตั้ง', ctx.kwp != null ? ctx.kwp + ' kWp' : '')
                 + row('DC/AC', ctx.dcac)
                 + row('แผง', c.totalPanels != null ? c.totalPanels + ' แผง' : '')
                 + row('อินเวอร์เตอร์', c.inv1Qty != null ? c.inv1Qty + ' ตัว' : '')
                 + row('ออปติไมเซอร์', c.optQty ? c.optQty + ' ตัว' : '')
                 + row('แบตเตอรี่', c.batQty ? c.batQty + ' ชุด' : '')
                 + '</table>'
                 + '<div style="margin-top:8px; color:#64748b;">ตัวเลขชุดนี้ยกมาจาก DB2 ที่กำลังวาดอยู่ ไม่ใช่ไฟล์ที่ส่งออกไว้</div>';
        }

        const s = ctx.summary;
        const bad = ctx.findings.filter(f => f.level === 'error' || f.level === 'warn');

        if (m.id === 'findings') {
            let h = '<div>ตรวจ ' + s.checked + ' ข้อ · ต้องแก้ <b style="color:#991b1b;">' + s.error
                  + '</b> · ควรทบทวน <b style="color:#92400e;">' + s.warn
                  + '</b> · ข้อสังเกต ' + s.info + ' · ผ่าน ' + s.ok + '</div>';
            if (!bad.length)
                return h + '<div style="margin-top:6px; color:#166534;">ไม่มีข้อที่ต้องแก้หรือควรทบทวน</div>';
            return h + bad.map(findingHTML).join('');
        }

        /* next */
        if (bad.length) {
            const first = bad[0];
            return '<div>สิ่งที่ควรทำก่อนคือเก็บข้อที่ตรวจแล้วยังไม่ผ่าน ตอนนี้เหลือ '
                 + bad.length + ' ข้อ เริ่มจากข้อนี้</div>' + findingHTML(first)
                 + '<div style="margin-top:6px; color:#64748b;">เก็บครบแล้วจึงกด Generate BOM และส่งออก DB2 '
                 + 'เพื่อเอาไปทำรายงานที่เมนู 2</div>';
        }
        return '<div>ผลตรวจไม่มีข้อที่ต้องแก้แล้ว ขั้นต่อไปคือกด <b>Generate BOM</b> '
             + 'แล้วส่งออก <b>DB2</b> เพื่อเอาไปทำรายงานที่เมนู 2</div>';
    }

    function chips(cands) {
        const KB = global.AscKB && global.AscKB.articles;
        const label = c => c.kind === 'intent'
            ? ({ findings: 'สรุปผลตรวจของโครงการนี้', overview: 'ภาพรวมโครงการ', next: 'ขั้นตอนต่อไป' }[c.id] || c.id)
            : ((KB && KB[c.kb] && KB[c.kb].title) || c.kb);
        return cands.map(c => '<button type="button" class="cp-chip" data-cp-kind="' + c.kind
            + '" data-cp-id="' + esc(c.kind === 'intent' ? c.id : c.kb) + '">' + esc(label(c)) + '</button>').join('');
    }

    /* ── ทางเข้าเดียวของการตอบ ─────────────────────────────────────────────
       v2 ถ้าจำเป็นต้องใช้ LLM ให้เสียบตรงนี้ โดยส่งผลของ v1 เป็นบริบท
       โครงสร้างข้างนอกไม่ต้องแก้เลย */
    function answer(question, forced) {
        const ctx = buildContext();
        const m   = forced || matchTopic(question);
        const res = { match: m, ctx: ctx, html: '', found: false };

        if (m.kind === 'topic') {
            res.found = true;
            res.html  = composeTopic(m, ctx, false);
        } else if (m.kind === 'intent') {
            res.found = true;
            res.html  = composeIntent(m, ctx);
        } else if (m.kind === 'unsure') {
            res.html = '<div>คำถามนี้เข้าได้หลายหัวข้อ ผมยังไม่มั่นใจว่าหมายถึงข้อไหน '
                     + 'เลือกให้หน่อยครับ</div><div class="cp-chips">' + chips(m.cands) + '</div>';
        } else {
            res.html = '<div><b>ยังตอบข้อนี้ไม่ได้</b> คำถามนี้ไม่ตรงกับหัวข้อไหนในฐานความรู้ '
                     + '28 บทและผลตรวจ 36 ข้อที่ผมอ่านได้</div>'
                     + '<div style="margin-top:6px; color:#64748b;">คำถามนี้ถูกบันทึกไว้แล้ว '
                     + 'ดูรวมได้ที่ปุ่มสถิติ เพื่อเอาไปปรับปรุงต่อ</div>'
                     + '<div class="cp-chips">' + chips(SUGGEST()) + '</div>';
        }
        return res;
    }

    /* หัวข้อที่เสนอเมื่อตอบไม่ได้ · เลือกจากที่ถามบ่อยที่สุดในงานจริง */
    const SUGGEST = () => ([
        { kind: 'intent', id: 'findings' },
        { kind: 'topic', kb: 'pr-benchmark' },
        { kind: 'topic', kb: 'dcac-ratio' },
        { kind: 'topic', kb: 'voc-cold' },
        { kind: 'topic', kb: 'eit-string-ocpr' }
    ]);

    /* ── บันทึกเพื่อวัดผล · อยู่ในเครื่องล้วน ไม่ส่งออกไปไหนเอง ────────────
       นี่คือเหตุผลที่เลือกทำ v1 แบบไม่ใช้ LLM จึงต้องวัดให้ได้จริงว่า
       ตอบได้กี่เปอร์เซ็นต์ ก่อนจะตัดสินใจว่าคุ้มที่จะเสียค่าโทเคนไหม */
    function logRead() {
        try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]') || []; }
        catch (e) { return []; }
    }
    function logWrite(rows) {
        try { localStorage.setItem(LOG_KEY, JSON.stringify(rows.slice(-LOG_MAX))); }
        catch (e) { /* เต็มก็ไม่เป็นไร ไม่ให้พังเพราะเรื่องบันทึก */ }
    }
    function logAdd(q, res) {
        const rows = logRead();
        rows.push({
            t: new Date().toISOString(),
            q: String(q).slice(0, 200),
            kind: res.match.kind,
            layer: res.match.layer || 0,
            hit: res.match.kind === 'topic' ? res.match.kb
               : res.match.kind === 'intent' ? res.match.id : '',
            vote: 0
        });
        logWrite(rows);
        return rows.length - 1;
    }
    function logVote(i, v) {
        const rows = logRead();
        if (rows[i]) { rows[i].vote = v; logWrite(rows); }
    }
    function stats() {
        const rows = logRead();
        const n = rows.length;
        const found = rows.filter(r => r.kind === 'topic' || r.kind === 'intent').length;
        return {
            total: n, found: found,
            pct: n ? Math.round(found * 1000 / n) / 10 : 0,
            up: rows.filter(r => r.vote > 0).length,
            down: rows.filter(r => r.vote < 0).length,
            misses: rows.filter(r => r.kind === 'none' || r.kind === 'unsure').map(r => r.q),
            rows: rows
        };
    }

    /* ── แผงหน้าจอ ─────────────────────────────────────────────────────────
       เป็นแผงคนละแผงกับแผงตรวจแบบโดยตั้งใจ ตามกติกาใน asc-advisor.js
       คำตอบของ Copilot ห้ามไปโผล่ในรายการผลตรวจ และในทางกลับกัน
       แผงนี้ทั้งแผงมีคลาส no-print จึงไม่ติดไปกับเอกสารที่สั่งพิมพ์ */
    const CSS = [
        '#cp-fab{position:fixed;right:18px;bottom:18px;z-index:3900;width:52px;height:52px;',
        'border-radius:50%;border:0;cursor:pointer;background:#0f766e;color:#fff;font-size:22px;',
        'box-shadow:0 6px 20px rgba(15,118,110,.42);}',
        '#cp-fab:hover{background:#115e59;}',
        '#cp-panel{position:fixed;top:0;right:0;bottom:0;width:min(420px,96vw);z-index:3950;',
        'background:#f8fafc;border-left:1px solid #cbd5e1;display:none;flex-direction:column;',
        'font-size:13.5px;line-height:1.62;color:#1e293b;box-shadow:-8px 0 28px rgba(15,23,42,.16);}',
        '#cp-panel.on{display:flex;}',
        '#cp-head{padding:10px 14px;border-bottom:1px solid #e2e8f0;background:#fff;}',
        '#cp-body{flex:1;overflow:auto;padding:12px 14px;}',
        '#cp-foot{padding:10px 14px;border-top:1px solid #e2e8f0;background:#fff;}',
        '#cp-in{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #cbd5e1;',
        'border-radius:8px;font:inherit;resize:none;}',
        '.cp-q{background:#0f766e;color:#fff;padding:7px 11px;border-radius:12px 12px 2px 12px;',
        'margin:10px 0 0 auto;max-width:88%;width:fit-content;}',
        '.cp-a{background:#fff;border:1px solid #e2e8f0;padding:9px 11px;border-radius:12px 12px 12px 2px;',
        'margin:6px 0 0 0;}',
        '.cp-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}',
        '.cp-chip{background:#e2e8f0;border:0;border-radius:14px;padding:5px 11px;cursor:pointer;',
        'font:inherit;font-size:.9em;color:#0f172a;}',
        '.cp-chip:hover{background:#cbd5e1;}',
        '.cp-vote{background:none;border:0;cursor:pointer;font-size:1.05em;opacity:.45;padding:0 3px;}',
        '.cp-vote.on{opacity:1;}',
        '@media print{#cp-fab,#cp-panel{display:none !important;}}'
    ].join('');

    let mounted = false;

    function el(html) {
        const d = document.createElement('div');
        d.innerHTML = html;
        return d.firstElementChild;
    }

    /* คำถามตั้งต้นประกอบจากสถานะจริง ไม่ใช่รายการตายตัว
       โครงการที่มีข้อต้องแก้อยู่ ควรเห็นปุ่มสรุปผลตรวจเป็นอันแรก */
    function starters() {
        const ctx = buildContext();
        const out = [{ kind: 'intent', id: 'next' }];
        if (ctx.ok && ctx.summary && (ctx.summary.error || ctx.summary.warn))
            out.unshift({ kind: 'intent', id: 'findings' });
        else
            out.push({ kind: 'intent', id: 'overview' });
        out.push({ kind: 'topic', kb: 'pr-benchmark' });
        out.push({ kind: 'topic', kb: 'dcac-ratio' });
        out.push({ kind: 'topic', kb: 'eit-string-ocpr' });
        return out;
    }

    function say(html, cls) {
        const b = document.getElementById('cp-body');
        const n = el('<div class="' + cls + '">' + html + '</div>');
        b.appendChild(n);
        b.scrollTop = b.scrollHeight;
        return n;
    }

    function ask(q, forced) {
        const res = answer(q, forced);
        const i   = logAdd(q, res);
        let foot = '';
        if (res.found)
            foot = '<div style="margin-top:7px;padding-top:6px;border-top:1px solid #f1f5f9;'
                 + 'font-size:.88em;color:#64748b;">คำตอบนี้ช่วยได้ไหม '
                 + '<button type="button" class="cp-vote" data-cp-vote="1" data-cp-i="' + i + '">&#128077;</button>'
                 + '<button type="button" class="cp-vote" data-cp-vote="-1" data-cp-i="' + i + '">&#128078;</button>'
                 + '</div>';
        say(res.html + foot, 'cp-a');
    }

    function statsHTML() {
        const s = stats();
        let h = '<b>สถิติการถาม</b> · เก็บในเครื่องนี้เท่านั้น<br>'
              + 'ถามไปแล้ว ' + s.total + ' คำถาม · ตอบได้ ' + s.found + ' = <b>' + s.pct + ' %</b><br>'
              + 'กดว่าช่วยได้ ' + s.up + ' · ช่วยไม่ได้ ' + s.down;
        if (s.misses.length) {
            const last = s.misses.slice(-8).reverse();
            h += '<div style="margin-top:6px;"><b>คำถามที่ตอบไม่ได้</b> ' + s.misses.length + ' ข้อ '
               + '<span style="color:#64748b;">(แสดง ' + last.length + ' ข้อล่าสุด)</span>'
               + '<ul style="margin:3px 0 0 16px;padding:0;">'
               + last.map(q => '<li>' + esc(q) + '</li>').join('') + '</ul></div>';
        }
        h += '<div class="cp-chips">'
           + '<button type="button" class="cp-chip" data-cp-act="export">ส่งออกบันทึกเป็น .json</button>'
           + '<button type="button" class="cp-chip" data-cp-act="clear">ล้างบันทึก</button></div>'
           + '<div style="margin-top:6px;color:#64748b;font-size:.88em;">'
           + 'ตัวเลขนี้คือสิ่งที่ใช้ตัดสินทีหลังว่าคุ้มจะต่อโมเดลภาษาเข้ามาไหม '
           + 'ถ้าตอบได้เกิน 80 % ก็ไม่ต้องเสียค่าโทเคนเลย</div>';
        return h;
    }

    function exportLog() {
        const s = stats();
        const blob = new Blob([JSON.stringify({
            exported: new Date().toISOString(),
            total: s.total, found: s.found, pct: s.pct, rows: s.rows
        }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'asc_copilot_log_' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 20000);
    }

    function mount() {
        if (mounted || typeof document === 'undefined' || !document.body) return;
        mounted = true;

        const st = document.createElement('style');
        st.textContent = CSS;
        document.head.appendChild(st);

        document.body.appendChild(el(
            '<button id="cp-fab" class="no-print" type="button" title="ถาม ASC Copilot">&#128172;</button>'));

        document.body.appendChild(el(
            '<div id="cp-panel" class="no-print">'
          + '<div id="cp-head">'
          +   '<div style="display:flex;align-items:center;gap:8px;">'
          +     '<b style="font-size:1.05em;">&#128172; ASC Copilot</b>'
          +     '<button type="button" id="cp-stats" class="cp-chip" style="margin-left:auto;">สถิติ</button>'
          +     '<button type="button" id="cp-close" class="cp-chip">ปิด</button>'
          +   '</div>'
          /* ข้อความนี้ต้องตรงกับความจริง แผงตรวจแบบเขียนไว้ว่า "ไม่ได้ใช้ AI"
             แผงนี้ก็ไม่ได้ใช้เหมือนกัน จะเขียนว่าเป็นคำตอบจาก AI ไม่ได้ */
          +   '<div style="font-size:.84em;color:#64748b;margin-top:3px;">'
          +     'ประกอบคำตอบจากผลตรวจแบบของโครงการนี้กับฐานความรู้ในเครื่อง '
          +     '<b>ไม่ได้ใช้โมเดลภาษา</b> และไม่มีข้อมูลออกนอกเครื่อง'
          +   '</div>'
          + '</div>'
          + '<div id="cp-body"></div>'
          + '<div id="cp-foot">'
          +   '<textarea id="cp-in" rows="2" placeholder="พิมพ์คำถาม แล้วกด Enter"></textarea>'
          + '</div>'
          + '</div>'));

        const panel = document.getElementById('cp-panel');
        const body  = document.getElementById('cp-body');

        function greet() {
            body.innerHTML = '';
            const ctx = buildContext();
            let h = 'ถามได้เลยครับ ผมอ่านผลตรวจแบบ 36 ข้อของโครงการที่เปิดอยู่ '
                  + 'กับฐานความรู้ 28 บทได้';
            if (!ctx.ok)
                h += '<div style="margin-top:5px;color:#92400e;">' + esc(ctx.why)
                   + ' ตอนนี้จึงตอบได้แต่หลักการทั่วไป</div>';
            else if (ctx.summary)
                h += '<div style="margin-top:5px;color:#64748b;">โครงการนี้ตรวจแล้ว ต้องแก้ '
                   + ctx.summary.error + ' · ควรทบทวน ' + ctx.summary.warn + '</div>';
            say(h + '<div class="cp-chips">' + chips(starters()) + '</div>', 'cp-a');
        }

        document.getElementById('cp-fab').onclick = () => {
            panel.classList.add('on');
            if (!body.children.length) greet();
            const i = document.getElementById('cp-in');
            if (i) i.focus();
        };
        document.getElementById('cp-close').onclick = () => panel.classList.remove('on');
        document.getElementById('cp-stats').onclick = () => say(statsHTML(), 'cp-a');

        document.getElementById('cp-in').addEventListener('keydown', e => {
            if (e.key !== 'Enter' || e.shiftKey) return;
            e.preventDefault();
            const v = e.target.value.trim();
            if (!v) return;
            e.target.value = '';
            say(esc(v), 'cp-q');
            ask(v);
        });

        /* ผูกปุ่มไว้ที่ตัวแผงทีเดียว เพราะคำตอบสร้างใหม่เรื่อย ๆ
           ถ้าไปผูกทีละปุ่มจะหลุดทุกครั้งที่วาดคำตอบใหม่ */
        panel.addEventListener('click', e => {
            const t = e.target && e.target.closest ? e.target.closest('button') : null;
            if (!t) return;

            if (t.dataset.cpKind) {
                const kind = t.dataset.cpKind, id = t.dataset.cpId;
                say(esc(t.textContent), 'cp-q');
                if (kind === 'intent') {
                    ask(t.textContent, { kind: 'intent', id: id, layer: 0 });
                } else {
                    const topic = TOPICS.filter(x => x.kb === id)[0];
                    ask(t.textContent, { kind: 'topic', kb: id, rule: topic ? topic.rule : null, layer: 0 });
                }
                return;
            }
            if (t.dataset.cpMore) {
                t.parentElement.outerHTML = articleHTML(t.dataset.cpMore, true);
                return;
            }
            if (t.dataset.cpVote) {
                logVote(parseInt(t.dataset.cpI, 10), parseInt(t.dataset.cpVote, 10));
                const row = t.parentElement;
                row.querySelectorAll('.cp-vote').forEach(b => b.classList.remove('on'));
                t.classList.add('on');
                return;
            }
            if (t.dataset.cpAct === 'export') { exportLog(); return; }
            if (t.dataset.cpAct === 'clear')  { logWrite([]); say('ล้างบันทึกแล้ว', 'cp-a'); return; }
        });

        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && panel.classList.contains('on')) panel.classList.remove('on');
        });
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading')
            document.addEventListener('DOMContentLoaded', mount);
        else mount();
    }

    global.AscCopilot = {
        answer: answer,
        matchTopic: matchTopic,
        buildContext: buildContext,
        TOPICS: TOPICS,
        INTENTS: INTENTS,
        _norm: norm,
        _log: { read: logRead, add: logAdd, vote: logVote, clear: () => logWrite([]) },
        stats: stats,
        mount: mount
    };

})(typeof window !== 'undefined' ? window : globalThis);

/* ให้ Node เรียกชุดทดสอบได้โดยไม่ต้องเปิดเบราว์เซอร์ */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = (typeof window !== 'undefined' ? window : globalThis).AscCopilot;
}
