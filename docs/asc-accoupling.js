/* ============================================================================
 *  ASC · ระบบออนกริดเดิม (AC Coupling) บนผังไฟฟ้า
 *
 *  ทำไมต้องมีไฟล์นี้
 *  ----------------------------------------------------------------------
 *  ผังสองแบบ คือผังตู้รวม AC/DC และผังเส้นเดียว (SLD) ถูกเขียนไว้ **สี่ชุด**
 *  คือหน้าออกแบบสองชุด และหน้ารายงานอีกสองชุด ทั้งสี่วาดของเดียวกัน
 *
 *  ถ้าไปเติมเรื่องระบบเดิมทีละชุด สี่ชุดนั้นจะค่อย ๆ เพี้ยนออกจากกัน
 *  แล้ววันหนึ่งผังในรายงานที่ส่งลูกค้าจะไม่ตรงกับผังที่วิศวกรเห็นตอนออกแบบ
 *  ซึ่งเป็นเอกสารที่มีผลผูกพัน
 *
 *  ไฟล์นี้จึงเก็บ "ส่วนที่เพิ่มเข้ามาเพราะมีระบบเดิม" ไว้ที่เดียว
 *  ทั้งสี่ชุดเรียกฟังก์ชันเดียวกันแล้วเอาผลไปแปะ จะแก้ถ้อยคำหรือรูปวาด
 *  ก็แก้ที่นี่ที่เดียว
 *
 *  ตั้งใจไม่รื้อผังเดิมทั้งสี่ชุดมารวมกันในรอบนี้ เพราะเป็นภาพที่ใช้งานได้ดี
 *  อยู่แล้วและไปอยู่ในเอกสารที่ส่งออกไปแล้ว การรื้อทั้งก้อนมีความเสี่ยงสูง
 *  โดยไม่จำเป็นต่อสิ่งที่ผู้ใช้ขอ
 *
 *  ทำไมระบบเดิมต้องโผล่ในผัง
 *  ----------------------------------------------------------------------
 *  ไซต์ที่มีออนกริดอยู่แล้วแล้วเติมไฮบริดเข้าไปทางฝั่ง AC จะมีอินเวอร์เตอร์
 *  สองชุดลงที่ตู้ MDB เดียวกัน ผังที่ไม่แสดงระบบเดิมทำให้อ่านผิดสองเรื่อง
 *    · กำลัง AC รวมที่ MDB มากกว่าที่ผังบอก ซึ่งมีผลกับพิกัดสายเมนและเบรกเกอร์
 *    · ช่างที่ถือผังไปหน้างานจะไม่รู้ว่ามีแหล่งจ่ายอีกตัวที่ต้องปลดก่อนทำงาน
 *      ซึ่งเป็นเรื่องความปลอดภัย ไม่ใช่แค่ความสวยงามของรูป
 * ==========================================================================*/

(function (global) {
    'use strict';

    /* ── อ่านก้อน existing ให้เป็นรูปเดียว ────────────────────────────────
       ก้อนนี้มาจาก step2_equipment.existing ใน DB2 ไฟล์รุ่นเก่าไม่มีเลย
       จึงต้องทนกับ null และกับค่าที่เป็นข้อความได้ทุกกรณี */
    function read(ex) {
        if (!ex) return null;
        const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
        const acKw = num(ex.acKw);
        if (!ex.enabled || acKw <= 0) return null;      /* ปิดอยู่ = ไม่ต้องวาดอะไรเลย */
        return {
            acKw   : acKw,
            dcKwp  : num(ex.dcKwp),
            panelQty: num(ex.panelQty),
            /* แอปเก็บแต่ชื่อรุ่น ไม่มีช่องยี่ห้อของระบบเดิม
               เคยอ่าน invManufacturer เผื่อไว้ แล้วเจอว่าหน้าออกแบบไม่ส่งค่านี้
               ส่วนหน้ารายงานส่งผ่านทั้งก้อน ผังสองหน้าจึงขึ้นข้อความไม่ตรงกัน
               ถอดออกดีกว่า อ่านเฉพาะสิ่งที่แอปมีจริง */
            model  : String(ex.invModel || '-').trim() || '-',
            exportControl: !!ex.exportControl,
            year   : ex.commissionedYear || null
        };
    }

    const esc = s => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const fmt = n => (Math.round(n * 100) / 100).toLocaleString('en-US');

    /* ชื่อที่เอาไปเขียนบนผัง ยาวเกินก็ตัด ไม่งั้นล้นกรอบ */
    function label(e, max) {
        const s = e.model;
        return s.length > (max || 34) ? s.slice(0, (max || 34) - 1) + '…' : s;
    }

    /* ── ผังตู้รวม AC/DC ──────────────────────────────────────────────────
       ผังเดิมสูง 650 หน่วย กรอบตู้จบที่ y = 600
       ระบบเดิม **ไม่ได้อยู่ในตู้ใบนี้** จึงต้องวาดนอกกรอบ แล้วลากไปบรรจบ
       ที่เส้น "To Main MDB / Grid" ซึ่งเป็นความจริงทางไฟฟ้าของ AC coupling
       คือทั้งสองระบบไปเจอกันที่ตู้เมน ไม่ได้ต่อเข้าตู้รวมใบนี้

       ผู้เรียกต้องขยาย viewBox เป็น 0 0 1000 830 เมื่อมีระบบเดิม
       ใช้ AscACC.wiringViewBox() เพื่อไม่ต้องจำตัวเลข */
    function wiringViewBox(ex) {
        return read(ex) ? '0 0 1000 830' : '0 0 1000 650';
    }

    function wiringFragment(ex, opts) {
        const e = read(ex);
        if (!e) return '';
        const o = opts || {};
        const T = o.t || (th => th);          /* ตัวแปลภาษา ถ้าผู้เรียกมี */

        const total = e.acKw + (o.newAcKw || 0);

        return `
    <!-- ══ ระบบออนกริดเดิม (AC Coupling) — สร้างจาก asc-accoupling.js ══ -->
    <g id="acc-wiring">
      <path d="M 665 600 L 665 660" stroke="#b45309" stroke-width="3" stroke-dasharray="6,4" fill="none"/>
      <circle cx="665" cy="600" r="5" fill="#b45309"/>
      <text x="678" y="630" font-size="11" font-weight="bold" fill="#b45309">${esc(T('ไปรวมที่ตู้ MDB เดียวกัน', 'Shares the same MDB'))}</text>

      <rect x="520" y="660" width="430" height="150" fill="#fffbeb" stroke="#b45309" stroke-width="3" stroke-dasharray="7,4" rx="6"/>
      <text x="735" y="686" font-size="15" font-weight="bold" text-anchor="middle" fill="#b45309">${esc(T('ระบบออนกริดเดิม (AC COUPLING)', 'EXISTING ON-GRID SYSTEM (AC COUPLING)'))}</text>

      <rect x="545" y="700" width="110" height="70" fill="#ffffff" stroke="#475569" stroke-width="2" rx="4"/>
      <path d="M 555 745 L 575 715 L 575 745 L 595 715" stroke="#475569" stroke-width="2.5" fill="none"/>
      <text x="600" y="765" font-size="9" text-anchor="middle" fill="#64748b">INVERTER</text>
      <text x="670" y="722" font-size="13" font-weight="bold" fill="#0f172a">${esc(fmt(e.acKw))} kW</text>
      <text x="670" y="742" font-size="10" fill="#334155">${esc(label(e, 30))}</text>
      <text x="670" y="760" font-size="10" fill="#64748b">${e.dcKwp > 0 ? esc(T('แผงเดิม ', 'Existing PV ') + fmt(e.dcKwp) + ' kWp') : esc(T('ไม่ทราบขนาดแผงเดิม', 'Existing PV size unknown'))}</text>

      <rect x="865" y="705" width="60" height="34" fill="#ffffff" stroke="#dc2626" stroke-width="2" rx="3"/>
      <text x="895" y="727" font-size="11" font-weight="bold" text-anchor="middle" fill="#dc2626">CB</text>
      <path d="M 655 722 L 865 722" stroke="#b45309" stroke-width="3" fill="none"/>
      <path d="M 925 722 L 950 722 L 950 640 L 665 640" stroke="#b45309" stroke-width="3" fill="none"/>
      <text x="895" y="757" font-size="9" text-anchor="middle" fill="#64748b">${esc(T('ของเดิมหน้างาน', 'Existing on site'))}</text>

      <text x="70" y="686" font-size="13" font-weight="bold" fill="#b45309">${esc(T('กำลัง AC รวมที่ตู้ MDB', 'Total AC at the MDB'))}</text>
      <text x="70" y="712" font-size="12" fill="#334155">${esc(T('ระบบใหม่ ', 'New '))}${esc(fmt(o.newAcKw || 0))} kW + ${esc(T('ระบบเดิม ', 'existing '))}${esc(fmt(e.acKw))} kW</text>
      <text x="70" y="736" font-size="16" font-weight="bold" fill="#b45309">${esc(fmt(total))} kW</text>
      <text x="70" y="762" font-size="10" fill="#64748b">${esc(T('ใช้ค่านี้คิดพิกัดสายเมนและเบรกเกอร์เมน ไม่ใช่ของระบบใหม่อย่างเดียว',
                                                              'Size the main cable and main breaker from this figure, not the new system alone'))}</text>
      <text x="70" y="784" font-size="10" fill="${e.exportControl ? '#166534' : '#b91c1c'}">${
        esc(e.exportControl ? T('มีอุปกรณ์กันไฟไหลย้อน', 'Reverse-power protection fitted')
                            : T('ยังไม่มีอุปกรณ์กันไฟไหลย้อน — ต้องยืนยันกับการไฟฟ้า',
                                'No reverse-power protection — confirm with the utility'))}</text>
    </g>`;
    }

    /* ── ผังเส้นเดียว (SLD) ───────────────────────────────────────────────
       หน้าออกแบบกับหน้ารายงานใช้ SLD คนละแบบ กรอบคนละขนาด
       (1122x793 กับ 1600x1200) บล็อกนี้จึงรับตำแหน่งและความกว้างเข้ามา
       แทนที่จะฝังพิกัดตายตัว ผู้เรียกเป็นคนบอกว่าจะวางตรงไหน

       opts.x opts.y opts.w  มุมซ้ายบนและความกว้างของกรอบบล็อก
       opts.tap             เส้นป้อนจากตู้ MDB มาที่บล็อก เป็นลิสต์ของจุด
       opts.t               ตัวแปลภาษา */
    function sldBlock(ex, opts) {
        const e = read(ex);
        if (!e) return '';
        const o = opts || {};
        const T = o.t || (th => th);
        const x = o.x != null ? o.x : 330;
        const y = o.y != null ? o.y : 960;
        const w = Math.max(o.w != null ? o.w : 470, 380);

        /* วางสามก้อนเรียงจากขวาไปซ้าย แผง -> อินเวอร์เตอร์ -> เบรกเกอร์
           ตามทิศทางการไหลของพลังงานเข้าหาตู้ MDB ที่อยู่ทางซ้าย */
        const pvX  = x + w - 110;
        const invX = x + w - 290;
        const cbX  = x + w - 400;
        const midY = y + 77;

        const tap = (o.tap && o.tap.length >= 2)
            ? '<polyline points="' + o.tap.map(p => p[0] + ',' + p[1]).join(' ') +
              '" fill="none" stroke="#b45309" stroke-width="2.5" stroke-dasharray="9,5"/>' +
              '<circle cx="' + o.tap[0][0] + '" cy="' + o.tap[0][1] + '" r="5" fill="#b45309"/>' +
              '<text x="' + (o.tap[0][0] + 12) + '" y="' + (o.tap[0][1] - 8) + '" font-size="11" font-weight="bold" fill="#b45309">' +
              esc(T('ระบบเดิมลงตู้ MDB เดียวกัน', 'Existing system on the same MDB')) + '</text>'
            : '';

        return `
    <!-- ══ ระบบออนกริดเดิม (AC Coupling) — สร้างจาก asc-accoupling.js ══ -->
    <g id="acc-sld">
      ${tap}
      <rect x="${x}" y="${y}" width="${w}" height="150" fill="none" stroke="#b45309" stroke-width="2" stroke-dasharray="10,5"/>
      <text x="${x + 15}" y="${y + 22}" font-size="13" font-weight="bold" fill="#b45309">${esc(T('ระบบออนกริดเดิม (AC COUPLING)', 'EXISTING ON-GRID SYSTEM (AC COUPLING)'))}</text>
      <text x="${x + 15}" y="${y + 42}" font-size="9" fill="${e.exportControl ? '#166534' : '#b91c1c'}">${
        esc(e.exportControl ? T('มีอุปกรณ์กันไฟไหลย้อน', 'Reverse-power protection fitted')
                            : T('ยังไม่มีอุปกรณ์กันไฟไหลย้อน', 'No reverse-power protection'))}</text>

      <rect x="${pvX}" y="${midY - 27}" width="80" height="55" fill="none" stroke="#000" stroke-width="1.5"/>
      <line x1="${pvX}" y1="${midY + 28}" x2="${pvX + 80}" y2="${midY - 27}" stroke="#000" stroke-width="1.5"/>
      <text x="${pvX + 40}" y="${midY - 7}" font-size="10" text-anchor="middle">PV</text>
      <text x="${pvX + 40}" y="${midY + 21}" font-size="10" text-anchor="middle">${e.dcKwp > 0 ? esc(fmt(e.dcKwp) + ' kWp') : '—'}</text>
      <text x="${pvX + 40}" y="${midY + 45}" font-size="9" text-anchor="middle" fill="#64748b">${e.panelQty > 0 ? esc(fmt(e.panelQty) + ' ' + T('แผง', 'modules')) : esc(T('ไม่ทราบจำนวนแผง', 'module count unknown'))}</text>

      <line x1="${pvX}" y1="${midY}" x2="${invX + 100}" y2="${midY}" stroke="#000" stroke-width="2"/>
      <rect x="${invX}" y="${midY - 27}" width="100" height="55" fill="none" stroke="#000" stroke-width="1.5"/>
      <path d="M ${invX + 12} ${midY + 15} L ${invX + 32} ${midY - 15} L ${invX + 32} ${midY + 15} L ${invX + 52} ${midY - 15}" stroke="#000" stroke-width="2" fill="none"/>
      <text x="${invX + 76}" y="${midY - 5}" font-size="10" text-anchor="middle" font-weight="bold">INV</text>
      <text x="${invX + 50}" y="${midY + 45}" font-size="10" text-anchor="middle">${esc(fmt(e.acKw))} kW</text>

      <line x1="${invX}" y1="${midY}" x2="${cbX + 60}" y2="${midY}" stroke="#000" stroke-width="2"/>
      <rect x="${cbX}" y="${midY - 15}" width="60" height="30" fill="#fff" stroke="#00b050" stroke-width="1.5"/>
      <text x="${cbX + 30}" y="${midY + 5}" font-size="10" font-weight="bold" fill="#00b050" text-anchor="middle">MCCB</text>
      <line x1="${cbX}" y1="${midY}" x2="${x + 15}" y2="${midY}" stroke="#000" stroke-width="2"/>

      <text x="${x + 15}" y="${y + 140}" font-size="10" fill="#334155">${esc(label(e, 46))}${e.year ? esc('  ·  ' + T('ติดตั้งปี ', 'commissioned ') + e.year) : ''}</text>
    </g>`;
    }

    /* คงชื่อเดิมไว้ให้ผู้เรียกที่ใช้ค่าปริยายของหน้ารายงาน

       พิกัดเดิม x=330 ทำให้บล็อกกินเข้าไปในกรอบ PV ARRAY ของหน้ารายงาน
       (กรอบนั้นเริ่มที่ x=520) แล้ววาดทับแผงของสตริงแรกจนอ่านไม่ออก
       ย้ายมามุมซ้ายล่างซึ่งว่างจริงทั้งแถบ (x 20..520, y 935..1145)
       ขอบขวาของบล็อกจึงจบที่ 510 เหลือช่องว่างก่อนถึงกรอบ PV ARRAY */
    function sldFragment(ex, opts) {
        const o = Object.assign({ x: 40, y: 950, w: 470, tap: [[400, 670], [400, 950]] }, opts || {});
        return sldBlock(ex, o);
    }

    global.AscACC = {
        read           : read,
        wiringViewBox  : wiringViewBox,
        wiringFragment : wiringFragment,
        sldFragment    : sldFragment,
        sldBlock       : sldBlock
    };

})(typeof window !== 'undefined' ? window : globalThis);

if (typeof module !== 'undefined' && module.exports) {
    module.exports = (typeof window !== 'undefined' ? window : globalThis).AscACC;
}
