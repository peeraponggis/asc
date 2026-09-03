/* ============================================================================
 *  ASC · ตัวแยกไฟล์ดาต้าชีต
 *
 *  ทำไมต้องแยกออกมาเป็นไฟล์ของตัวเอง
 *  ----------------------------------------------------------------------
 *  ข้อความดาต้าชีตชุดเดียวกันถูกอ่านจากสามที่
 *    1. หน้าออกแบบ  ตอนผู้ใช้อัปโหลดไฟล์เอง
 *    2. หน้า Settings  ตอนผู้ดูแลระบบนำเข้าเข้าคลัง
 *    3. supabase/import-devices.mjs  ตอนนำเข้าคลังครั้งแรกด้วย Node
 *
 *  ถ้าปล่อยให้แต่ละที่เขียนตัวแยกไฟล์ของตัวเอง วันหนึ่งจะให้ผลไม่ตรงกัน
 *  แล้วไล่หาสาเหตุไม่เจอ เพราะไฟล์ต้นทางหน้าตาเหมือนกันทุกอย่าง
 *  ค่าที่เพี้ยนจะไปโผล่ที่พลังงานรายปีและ NPV โดยไม่มีคำเตือนอะไรเลย
 *
 *  ไฟล์นี้จึงเป็นแหล่งความจริงเดียวของกติกาการอ่าน ใช้ได้ทั้งบนเบราว์เซอร์
 *  (ผูกชื่อไว้บน window) และบน Node (module.exports)
 * ==========================================================================*/

(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;   // Node
    if (root) root.AscDatasheet = api;                                        // เบราว์เซอร์
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    /* ตัดคอมเมนต์ที่ต่อท้ายบรรทัดค่าออก

       ดาต้าชีตโครงสร้าง 3.0 เขียนแท็กต่อท้ายบรรทัดค่า เช่น
           Length_mm = 2382 ; [NOT FOUND IN DATASHEET]
       ถ้าไม่ตัดออก val จะเป็น "2382 ; [NOT FOUND...]" ซึ่ง isNaN เป็นจริง
       ค่าจึงถูกเก็บเป็นข้อความ แล้ว state.pvLen / 1000 กลายเป็น NaN
       ผังแผงทั้งใบเพี้ยนโดยไม่มีคำเตือนอะไรเลย
       (รูปแบบ 3.1 ย้ายแท็กขึ้นไปเป็นบรรทัดของตัวเองแล้ว แต่ไฟล์เก่ายังมีอยู่)

       เทมเพลตรุ่นเก่า (Inverter_Structure.txt) ใช้ # แทน ; จึงต้องรับทั้งสองแบบ
           Rated_AC_Output_Power_kW = 50.0        # กำลังไฟฟ้าขาออกพิกัด

       ค่าที่อยู่ในเครื่องหมายคำพูดต้องไม่ถูกตัด เพราะข้อความจริงอาจมี ; อยู่ */
    function stripComment(raw) {
        const s = String(raw).trim();
        if (s.charAt(0) === '"') {
            const end = s.indexOf('"', 1);
            return end === -1 ? s : s.slice(0, end + 1);
        }
        const cut = [s.indexOf(';'), s.indexOf('#')].filter(i => i >= 0);
        if (!cut.length) return s;
        return s.slice(0, Math.min.apply(null, cut)).trim();
    }

    /* ข้อความดาต้าชีต → อ็อบเจกต์ ตัวเลขแปลงเป็น number ที่เหลือเป็นข้อความ
       ฟิลด์ที่ว่างเก็บเป็น "-" ตามที่โค้ดเดิมทั้งระบบคาดหวังไว้ */
    function parse(text) {
        const lines = String(text || '').split(/\r?\n/);
        const out = {};
        lines.forEach(line => {
            const t = line.trim();
            // บรรทัดคอมเมนต์เต็มบรรทัด ข้ามทิ้ง แม้จะมีเครื่องหมายเท่ากับปนอยู่ก็ตาม
            if (t === '' || t.startsWith('#') || t.startsWith(';') || !t.includes('=')) return;
            const parts = t.split('=');
            const key = parts[0].trim();
            let val = stripComment(parts.slice(1).join('=')).replace(/^"|"$/g, '').trim();
            if (val === '') val = '-';
            if (val !== '-' && !isNaN(val)) out[key] = parseFloat(val);
            else out[key] = val;
        });
        return out;
    }

    /* หมวดของไฟล์ เดาจากหัวข้อโครงสร้างในบรรทัดแรก แล้วค่อยดูจากชื่อไฟล์
       หัวข้อในไฟล์เชื่อถือได้มากกว่า เพราะชื่อไฟล์ถูกเปลี่ยนได้ง่าย */
    const HEAD = {
        PV_MODULE_STRUCTURE  : 'PV',
        INVERTER_STRUCTURE   : 'INV',
        BATTERY_ESS_STRUCTURE: 'ESS',
        OPTIMIZER_STRUCTURE  : 'OPT',
        EV_CHARGE_STRUCTURE  : 'EV'
    };
    const PREFIX = { PV: 'PV', INV: 'INV', BAT: 'ESS', ESS: 'ESS', OPT: 'OPT', EV: 'EV' };

    function detectCategory(text, filename) {
        const m = /^\s*\[([A-Z_]+)\]/m.exec(String(text || ''));
        if (m && HEAD[m[1]]) return HEAD[m[1]];
        const base = String(filename || '').split(/[\\/]/).pop() || '';
        const p = base.split('_')[0].toUpperCase();
        return PREFIX[p] || '';
    }

    /* ชนิดย่อยของอินเวอร์เตอร์ HYB (ไฮบริด) หรือ STR (สตริง)
       คลังตั้งชื่อไฟล์เป็น INV_HYB_ยี่ห้อ_รุ่น.txt ส่วนหมวดอื่นไม่มีชั้นนี้ */
    function detectSubtype(category, text, filename) {
        if (category !== 'INV') return '';
        const base = String(filename || '').split(/[\\/]/).pop() || '';
        const seg = base.split('_')[1];
        if (seg && /^(HYB|STR)$/i.test(seg)) return seg.toUpperCase();
        const t = String((parse(text).Inverter_Type) || '');
        if (/hybrid/i.test(t)) return 'HYB';
        if (/string/i.test(t)) return 'STR';
        return '';
    }

    /* ไฟล์หนึ่งไฟล์ → แถวหนึ่งแถวของตาราง devices
       ยี่ห้อและรุ่นเอาจากในไฟล์เป็นหลัก ชื่อไฟล์ใช้เป็นตัวสำรองเท่านั้น */
    function toDeviceRow(text, filename) {
        const spec = parse(text);
        const category = detectCategory(text, filename);
        const base = String(filename || '').split(/[\\/]/).pop().replace(/\.txt$/i, '');
        const seg = base.split('_');
        const fromName = category === 'INV' && /^(HYB|STR)$/i.test(seg[1] || '')
            ? { brand: seg[2] || '', model: seg.slice(3).join('_') }
            : { brand: seg[1] || '', model: seg.slice(2).join('_') };

        const clean = v => (v && v !== '-' ? String(v).trim() : '');

        return {
            category  : category,
            brand     : clean(spec.Manufacturer) || fromName.brand,
            model     : clean(spec.Model_Name)   || fromName.model,
            subtype   : detectSubtype(category, text, filename),
            spec      : spec,
            sourceFile: base + '.txt'
        };
    }

    /* ฟิลด์ที่ขาดไม่ได้ ชุดเดียวกับที่หน้าออกแบบเตือนตอนอัปโหลด
       ใช้กันไม่ให้ดาต้าชีตที่ยังกรอกไม่ครบหลุดเข้าคลัง */
    const REQUIRED = {
        PV : ['Pmax_Wp', 'Voc_V', 'Vmp_V', 'Isc_A', 'Imp_A', 'Length_mm', 'Width_mm'],
        INV: ['Max_DC_Input_Voltage_V', 'MPPT_Voltage_Min_V', 'Number_of_MPPTs',
              'Inputs_per_MPPT', 'Rated_AC_Output_Power_kW'],
        ESS: [], OPT: [], EV: []
    };

    /* คืนรายชื่อฟิลด์บังคับที่หายหรือเป็นศูนย์ ว่างเปล่า = ผ่าน */
    function missingRequired(category, spec) {
        return (REQUIRED[category] || []).filter(k => {
            const n = parseFloat((spec || {})[k]);
            return !isFinite(n) || n === 0;
        });
    }

    return {
        parse           : parse,
        stripComment    : stripComment,
        detectCategory  : detectCategory,
        detectSubtype   : detectSubtype,
        toDeviceRow     : toDeviceRow,
        missingRequired : missingRequired,
        REQUIRED        : REQUIRED
    };
});
