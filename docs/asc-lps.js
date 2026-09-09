/* ============================================================================
 *  ASC · ระบบป้องกันฟ้าผ่า — ระยะการแยก S และเขตป้องกัน
 *
 *  ทำไมต้องมีไฟล์นี้
 *  ------------------------------------------------------------
 *  รอบก่อนโปรแกรมถามผู้ใช้ตรง ๆ ว่า "รักษาระยะการแยก S ได้หรือไม่"
 *  แล้วเอาคำตอบไปเลือกชนิด SPD ตามตารางที่ 3.2 ของ วสท. 022013-25
 *  แต่คำถามนั้นตอบยาก เพราะต้องคำนวณ s เองแล้วเอาไปเทียบกับระยะจริงบนหลังคา
 *  ไฟล์นี้ทำสองอย่างนั้นให้ คือคำนวณ s ที่ต้องการ และวัดระยะจริงจากผัง
 *
 *  ที่มาของตัวเลข — เรื่องนี้ต้องพูดให้ตรง
 *  ------------------------------------------------------------
 *  ตัวเลขทั้งหมดในไฟล์นี้ยกมาจากเอกสารที่ "อ้างถึง" มาตรฐานการป้องกันฟ้าผ่า
 *  ของ วสท. อีกทอดหนึ่ง ไม่ได้ยกจากตัวเล่ม เพราะยังไม่มีเล่มในมือ
 *
 *      เอกสารบรรยาย "การป้องกันอันตรายจากฟ้าผ่า" ลือชัย ทองนิล 10 ต.ค. 2566
 *          สไลด์ 100  สูตร s = (ki/km) x kc x l
 *          สไลด์ 101  ตารางที่ 5.4 (ki) · 5.5 (km) · 5.6 (kc)
 *          สไลด์ 102  ตัวอย่างคำนวณที่ตรวจย้อนได้
 *          สไลด์ 55   ตารางที่ 4.1 มุมป้องกัน (ตัดมาเฉพาะ h = 1-17 ม.)
 *          สไลด์ 35   รัศมีทรงกลมกลิ้ง และ r = 10 x I^0.65
 *          สไลด์ 78   ตารางที่ 4.8 ระยะห่างตัวนำลงดิน
 *      บทความ ABB in brief "ระบบป้องกันฟ้าผ่า ตอนที่ 1" ตารางที่ 1.5
 *          ใช้สอบทานรัศมีทรงกลมกลิ้ง ตรงกันทุกช่อง และให้ความกว้างตาข่ายเพิ่ม
 *          เอกสารอ้างอิง [1] ระบุชื่อเล่มจริงว่า วสท. พ.ศ. 2553
 *          มาตรฐานการป้องกันฟ้าผ่า ภาคที่ 1 ข้อกำหนดทั่วไป
 *
 *  จึงต้องเขียนที่มาแบบนี้ในผลตรวจและเอกสารทุกครั้ง ห้ามเขียนสั้น ๆ ว่า
 *  "ตาม วสท. ตารางที่ 5.4" ทั้งที่ยังไม่เคยเปิดเล่ม เพราะเป็นความผิดพลาด
 *  แบบเดียวกับตอนที่เชื่อค่าที่ดึงจาก PDF โดยไม่เปิดดูของจริง
 *
 *  สิ่งที่ไฟล์นี้ตั้งใจไม่ทำ
 *  ------------------------------------------------------------
 *  ไม่ประเมินความเสี่ยงเพื่อเลือกชั้นการป้องกัน (LPL) ให้เอง
 *  วิธีประเมินอยู่ในภาคที่ 2 ของมาตรฐาน (EIT2008-53) ซึ่งไม่มีในมือ
 *  และต่อให้มี ก็ไม่ควรให้โปรแกรมตัดสิน เพราะต้องใช้ค่าความเสียหาย
 *  กับค่าความเสี่ยงที่ยอมรับได้ ซึ่งเป็นดุลพินิจของวิศวกรและเจ้าของอาคาร
 *  LPL จึงเป็นช่องกรอกเสมอ
 * ==========================================================================*/

(function (global) {
    'use strict';

    const num = v => { const n = parseFloat(v); return isFinite(n) ? n : null; };
    const lvl = v => {
        const s = String(v || '').toUpperCase().replace(/[^IV]/g, '');
        return (s === 'I' || s === 'II' || s === 'III' || s === 'IV') ? s : null;
    };

    /* ── ตารางจากเอกสาร ────────────────────────────────────────────────── */

    /* รัศมีทรงกลมกลิ้งที่ใช้จริง · สไลด์ 35 และตารางที่ 1.5 ของ ABB ตรงกัน
       ค่าที่คำนวณได้คือ 20.42 / 28.46 / 44.67 / 60.63 แต่มาตรฐานปัดใช้เลขกลม */
    const SPHERE_RADIUS_M = { I: 20, II: 30, III: 45, IV: 60 };

    /* กระแสฟ้าผ่าต่ำสุดที่แต่ละชั้นรับได้ · ใช้กับ strikeDistance() */
    const MIN_CURRENT_KA = { I: 3, II: 5, III: 10, IV: 16 };

    /* ความกว้างตาข่าย · ตารางที่ 1.5 ของ ABB */
    const MESH_M = { I: 5, II: 10, III: 15, IV: 20 };

    /* ระยะห่างระหว่างตัวนำลงดิน · ตารางที่ 4.8 สไลด์ 78 */
    const DOWN_CONDUCTOR_SPACING_M = { I: 10, II: 10, III: 15, IV: 20 };

    /* ตารางที่ 5.4 · ค่าสัมประสิทธิ์ ki ตามชั้นของระบบป้องกันฟ้าผ่า
       เอกสารรวม III กับ IV ไว้แถวเดียวกันที่ 0.04 */
    const KI = { I: 0.08, II: 0.06, III: 0.04, IV: 0.04 };

    /* ตารางที่ 5.5 · ค่าสัมประสิทธิ์ km ตามวัสดุที่คั่นอยู่
       ยิ่ง km น้อย ยิ่งต้องเว้นระยะมาก อากาศเป็นฉนวนที่แย่กว่าของแข็ง */
    const KM = { air: 1, solid: 0.5 };

    /* ตารางที่ 5.6 · ค่าโดยประมาณของสัมประสิทธิ์ kc ตามจำนวนตัวนำลงดิน
       เอกสารเขียนกำกับไว้เองว่าเป็น "ค่าโดยประมาณ" */
    function kcFor(n) {
        const k = num(n);
        if (k === null || k < 1) return null;
        if (k === 1) return 1;        // เฉพาะกรณีระบบป้องกันภายนอกแบบแยกอิสระ
        if (k === 2) return 0.66;
        return 0.44;                  // 3 เส้นขึ้นไป
    }

    /* ตารางที่ 4.1 · มุมป้องกัน α (องศา) ตามความสูงแท่งตัวนำล่อฟ้า h
       สไลด์ 55 เขียนกำกับไว้เองว่าเป็น "ส่วนหนึ่งของตาราง" จึงมีแค่ h = 1-17 ม.

       ตรวจแล้วว่าตารางสอดคล้องกับเรขาคณิต รัศมีเขตป้องกัน = h x tan(α)
       ทุกแถวทุกคอลัมน์ จึงเก็บเฉพาะ α แล้วคำนวณรัศมีเอา
       (เทสต์ tests/lps-zone.mjs ยึดข้อนี้ไว้)

       h = ความสูงของแท่งเหนือ "ระนาบอ้างอิง" ซึ่งสำหรับงานบนหลังคา
       คือผิวหลังคาที่จะป้องกัน ไม่ใช่ระดับพื้นดิน (นิยามตามสไลด์ 56)
       งานโซลาร์บนหลังคาแท่งล่อฟ้าสูงจากหลังคาราว 1-6 ม. ตารางนี้จึงพอ */
    const ANGLE_DEG = {
        //   h:  1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16  17
        I:  [null,71, 71, 66, 62, 59, 56, 53, 50, 48, 45, 43, 40, 38, 36, 34, 32, 29],
        II: [null,74, 74, 71, 68, 65, 62, 60, 58, 56, 54, 52, 50, 49, 47, 45, 44, 42],
        III:[null,77, 77, 74, 72, 70, 68, 66, 64, 62, 61, 59, 58, 57, 55, 54, 53, 51],
        IV: [null,79, 79, 76, 74, 72, 71, 69, 68, 66, 65, 64, 62, 61, 60, 59, 58, 57]
    };
    const ANGLE_H_MAX = 17;

    /* ── ระยะฟ้าผ่า · สไลด์ 35 ─────────────────────────────────────────── */
    function strikeDistance(kA) {
        const i = num(kA);
        return (i === null || i <= 0) ? null : 10 * Math.pow(i, 0.65);
    }

    /* ── มุมป้องกันและรัศมีเขตป้องกัน ──────────────────────────────────

       คืน null เมื่อ h อยู่นอกช่วงของตารางที่มี **ห้ามประมาณต่อ**
       เพราะเส้นโค้งมุมป้องกันไม่ใช่เส้นตรง และวิธีมุมป้องกันเองก็ใช้ไม่ได้
       เมื่อ h เกินรัศมีทรงกลมกลิ้งของชั้นนั้น */
    function protectionAngle(lpl, h) {
        const L = lvl(lpl), height = num(h);
        if (!L || height === null || height <= 0) return null;

        if (height > ANGLE_H_MAX) return {
            alpha: null, radius: null, outOfRange: true, h: height, lpl: L,
            why: 'ความสูงแท่งล่อฟ้า ' + height + ' ม. เกินช่วงของตารางที่ 4.1 เท่าที่มี (ถึง ' +
                 ANGLE_H_MAX + ' ม.) จึงคำนวณมุมป้องกันให้ไม่ได้ ต้องเปิดตารางฉบับเต็มหรือใช้วิธีทรงกลมกลิ้งแทน'
        };

        /* ปัดขึ้นเป็นแถวถัดไปเมื่อความสูงไม่ลงตัว เพราะมุมป้องกันลดลงตามความสูง
           การใช้แถวที่สูงกว่าจึงได้มุมที่แคบกว่า ซึ่งเป็นด้านปลอดภัย */
        const row = Math.ceil(height);
        const alpha = ANGLE_DEG[L][row];
        if (alpha === undefined || alpha === null) return null;

        const radius = height * Math.tan(alpha * Math.PI / 180);
        return {
            alpha: alpha, radius: Math.round(radius * 100) / 100,
            h: height, hRow: row, lpl: L, outOfRange: false,
            rounded: row !== height
        };
    }

    /* ── ระยะการแยก s ที่ต้องการ · สไลด์ 100 ───────────────────────────

           s = (ki / km) x kc x l     เมตร

       l คือความยาวตัวนำวัดจากจุดที่จะพิจารณาระยะแยก ไปจนถึงจุดประสานศักย์
       ที่ใกล้ที่สุด หรือจุดต่อลงดินที่ใกล้ที่สุด (สไลด์ 83 · l = l1 + l2 + l3)

       ตัวอย่างในเอกสาร LPS 3 · ki 0.04 · km 0.5 · kc 0.44 · l 17 ม. -> 0.6 ม.
       เทสต์ยึดตัวอย่างนี้ไว้ ถ้าแก้สูตรผิดจะจับได้ทันที */
    function separation(opts) {
        const o = opts || {};
        const L = lvl(o.lpl);
        const ki = L ? KI[L] : null;
        const km = (o.material === 'solid') ? KM.solid
                 : (o.material === 'air')   ? KM.air : null;
        const kc = kcFor(o.downConductors);
        const l  = num(o.length);

        const missing = [];
        if (!ki) missing.push('ชั้นของระบบป้องกันฟ้าผ่า');
        if (km === null) missing.push('วัสดุที่คั่นระหว่างตัวนำกับส่วนโลหะ');
        if (kc === null) missing.push('จำนวนตัวนำลงดิน');
        if (l === null || l <= 0) missing.push('ความยาวตัวนำ l');
        if (missing.length) return { ok: false, missing: missing };

        const s = (ki / km) * kc * l;
        return {
            ok: true, s: Math.round(s * 1000) / 1000,
            ki: ki, km: km, kc: kc, l: l, lpl: L,
            material: o.material,
            downConductors: num(o.downConductors),
            /* บรรทัดแสดงวิธีคิด ให้ยกไปลงเอกสารได้ตรง ๆ ตรวจย้อนได้ */
            working: 's = (' + ki + ' / ' + km + ') x ' + kc + ' x ' + l + ' = ' +
                     (Math.round(s * 1000) / 1000) + ' ม.'
        };
    }

    /* ── ระยะทางบนพื้นโลก · สูตรฮาเวอร์ไซน์ ─────────────────────────────
       ไม่พึ่ง Leaflet เพื่อให้เทสต์ใน Node เรียกได้ */
    const R_EARTH = 6371008.8;
    function distanceM(a, b) {
        if (!a || !b) return null;
        const toRad = d => d * Math.PI / 180;
        const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
        const la1 = toRad(a.lat), la2 = toRad(b.lat);
        const x = Math.sin(dLat / 2) ** 2 +
                  Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
        return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(x)));
    }

    /* ระยะจากจุดถึงส่วนของเส้น บนระนาบเมตรท้องถิ่น */
    function distToSegmentM(p, a, b) {
        const mPerDegLat = 111132.0;
        const mPerDegLng = 111320.0 * Math.cos(p.lat * Math.PI / 180);
        const X = q => (q.lng - p.lng) * mPerDegLng;
        const Y = q => (q.lat - p.lat) * mPerDegLat;
        const ax = X(a), ay = Y(a), bx = X(b), by = Y(b);
        const dx = bx - ax, dy = by - ay;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) return Math.sqrt(ax * ax + ay * ay);
        let t = -(ax * dx + ay * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        const cx = ax + t * dx, cy = ay + t * dy;
        return Math.sqrt(cx * cx + cy * cy);
    }

    function pointInRing(p, ring) {
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const xi = ring[i].lng, yi = ring[i].lat, xj = ring[j].lng, yj = ring[j].lat;
            if (((yi > p.lat) !== (yj > p.lat)) &&
                (p.lng < (xj - xi) * (p.lat - yi) / (yj - yi) + xi)) inside = !inside;
        }
        return inside;
    }

    /* ระยะจากเสาล่อฟ้าถึงขอบพื้นที่วางแผงที่ใกล้ที่สุด

       ใช้ขอบของผืนหลังคาเป็นตัวแทนตำแหน่งแผงแถวนอกสุด ซึ่งเป็นค่าประมาณ
       ที่ดีพอสำหรับการเตือน แต่ไม่ใช่ระยะถึงแผงแผ่นที่ใกล้ที่สุดจริง ๆ
       ถ้าเสาอยู่ในผืนหลังคา ถือว่าระยะเป็นศูนย์ เพราะอยู่กลางแผงแล้ว */
    function nearestArrayDistanceM(rod, rings) {
        if (!rod || !Array.isArray(rings) || !rings.length) return null;
        let best = null;
        rings.forEach(ring => {
            if (!Array.isArray(ring) || ring.length < 3) return;
            if (pointInRing(rod, ring)) { best = 0; return; }
            for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                const d = distToSegmentM(rod, ring[j], ring[i]);
                if (best === null || d < best) best = d;
            }
        });
        return best === null ? null : Math.round(best * 100) / 100;
    }

    /* ── ตัดสินว่ารักษาระยะแยกได้หรือไม่ ───────────────────────────────

       คืน 'ok' / 'not_ok' / null พร้อมเหตุผล ให้เอาไปเติมช่องที่หน้าออกแบบ
       ถามไว้ แทนที่จะให้ผู้ใช้เดาเอง
       ข้อมูลไม่พอต้องคืน null ไม่ใช่เดาว่าผ่าน */
    function assess(opts) {
        const o = opts || {};
        const need = separation(o);
        if (!need.ok) return { verdict: null, need: need, why: 'ยังคำนวณระยะแยกที่ต้องการไม่ได้' };

        const actual = num(o.actualClearance);
        if (actual === null) return {
            verdict: null, need: need,
            why: 'คำนวณได้ว่าต้องเว้นระยะ ' + need.s + ' ม. แต่ยังไม่รู้ระยะจริงบนหลังคา'
        };

        const ok = actual >= need.s;
        return {
            verdict: ok ? 'ok' : 'not_ok', need: need, actual: actual,
            margin: Math.round((actual - need.s) * 1000) / 1000,
            why: ok
                ? 'ระยะจริง ' + actual + ' ม. ไม่น้อยกว่าระยะแยกที่ต้องการ ' + need.s + ' ม.'
                : 'ระยะจริง ' + actual + ' ม. น้อยกว่าระยะแยกที่ต้องการ ' + need.s + ' ม. ' +
                  'จึงรักษาระยะแยกไม่ได้ ต้องต่อประสานเข้าระบบล่อฟ้าโดยตรง'
        };
    }

    /* ══ ชั้นวาดเสาล่อฟ้าบนแผนที่ ═══════════════════════════════════════

       ส่วนนี้ต้องมี Leaflet กับตัวแปร map ของหน้าออกแบบ จึงทำงานเฉพาะในเบราว์เซอร์
       ส่วนคำนวณด้านบนไม่พึ่งอะไรเลย เทสต์ใน Node จึงเรียกได้ตรง ๆ

       เสาล่อฟ้าเก็บเป็น layer ใน editableItems เหมือนต้นไม้ โดยใช้
       drawMode เป็นของตัวเอง ตัวจัดแผงมีเงื่อนไขแค่ keepout/walkway/pvzone/roof
       โหมดอื่นถูกข้ามเงียบ ๆ อยู่แล้ว เสาล่อฟ้าจึงไม่ไปแตะตัวเลขผลผลิตหรือผังแผง */

    const MODE = 'lps_rod';
    let armed = false;

    function uiNum(id, dflt) {
        const el = document.getElementById(id);
        const v = el ? parseFloat(el.value) : NaN;
        return isFinite(v) ? v : dflt;
    }
    function uiVal(id, dflt) {
        const el = document.getElementById(id);
        return (el && el.value) ? el.value : dflt;
    }

    /* ขอบเขตของผืนหลังคาและกรอบพื้นที่วางแผง ใช้เป็นตัวแทนตำแหน่งแผง */
    function arrayRings() {
        const rings = [];
        if (typeof editableItems === 'undefined' || !editableItems.eachLayer) return rings;
        editableItems.eachLayer(lyr => {
            const m = lyr.drawMode || 'roof';
            if (m !== 'roof' && m !== 'pvzone') return;
            if (!lyr.getLatLngs) return;
            const ll = lyr.getLatLngs();
            const ring = Array.isArray(ll[0]) ? ll[0] : ll;
            if (Array.isArray(ring) && ring.length >= 3) rings.push(ring);
        });
        return rings;
    }

    /* คำนวณทุกอย่างของเสาต้นหนึ่ง แล้วเก็บผลไว้กับ layer */
    function evaluate(lyr) {
        const d = lyr.lpsData || {};
        const lpl = uiVal('lpsLevel', d.lpl || '');
        const zone = protectionAngle(lpl, d.height_m);
        const rings = arrayRings();
        const gap = nearestArrayDistanceM(lyr.getLatLng(), rings);

        const need = separation({
            lpl: lpl,
            material: uiVal('lpsMaterial', 'air'),
            downConductors: uiNum('lpsDownConductors', NaN),
            length: d.conductorLength_m
        });

        lyr.lpsResult = { zone: zone, gap: gap, need: need,
                          verdict: (need.ok && gap !== null) ? (gap >= need.s ? 'ok' : 'not_ok') : null };
        return lyr.lpsResult;
    }

    /* วงเขตป้องกันวาดเป็นวงกลมประ ให้เห็นว่าครอบคลุมถึงไหน */
    function redrawZone(lyr) {
        const r = evaluate(lyr);
        if (lyr._zoneCircle && typeof map !== 'undefined') { map.removeLayer(lyr._zoneCircle); lyr._zoneCircle = null; }
        if (r.zone && r.zone.radius > 0 && typeof map !== 'undefined') {
            lyr._zoneCircle = L.circle(lyr.getLatLng(), {
                radius: r.zone.radius, color: '#a16207', weight: 1.5,
                fillColor: '#fde047', fillOpacity: 0.10, dashArray: '6, 4', interactive: false
            }).addTo(map);
        }
        lyr.setTooltipContent ? lyr.setTooltipContent(tipText(lyr)) : null;
        return r;
    }

    function tipText(lyr) {
        const d = lyr.lpsData || {}, r = lyr.lpsResult || {};
        const bits = ['เสาล่อฟ้า สูง ' + d.height_m + ' ม. เหนือหลังคา'];
        if (r.zone && r.zone.outOfRange) bits.push('เกินช่วงตารางมุมป้องกัน');
        else if (r.zone) bits.push('มุมป้องกัน ' + r.zone.alpha + ' องศา · เขตป้องกันรัศมี ' + r.zone.radius + ' ม.');
        if (r.gap !== null && r.gap !== undefined) bits.push('ห่างขอบพื้นที่แผง ' + r.gap + ' ม.');
        if (r.need && r.need.ok) bits.push('ต้องเว้นระยะแยก ' + r.need.s + ' ม.');
        if (r.verdict === 'not_ok') bits.push('รักษาระยะแยกไม่ได้');
        if (r.verdict === 'ok') bits.push('รักษาระยะแยกได้');
        return bits.join(' · ');
    }

    function makeLayer(latlng, data) {
        const d = data || {};
        const lyr = L.circleMarker(latlng, {
            radius: 6, color: '#a16207', weight: 3, fillColor: '#fbbf24', fillOpacity: 0.95
        });
        lyr.drawMode = MODE;
        lyr.lpsData = {
            height_m: Math.max(0.1, parseFloat(d.height_m) || 2),
            conductorLength_m: Math.max(0, parseFloat(d.conductorLength_m) || 0),
            lpl: d.lpl || ''
        };
        lyr.bindTooltip(() => tipText(lyr), { direction: 'top' });
        lyr.on('click', function (ev) {
            if (L && L.DomEvent) L.DomEvent.stop(ev);
            const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
            set('lpsRodHeight', lyr.lpsData.height_m);
            set('lpsConductorLen', lyr.lpsData.conductorLength_m);
            if (typeof ascSyncLpsUI === 'function') ascSyncLpsUI();
        });
        return lyr;
    }

    function place(latlng) {
        const lyr = makeLayer(latlng, {
            height_m: uiNum('lpsRodHeight', 2),
            conductorLength_m: uiNum('lpsConductorLen', 0),
            lpl: uiVal('lpsLevel', '')
        });
        if (typeof editableItems !== 'undefined') editableItems.addLayer(lyr);
        redrawZone(lyr);
        return lyr;
    }

    function list() {
        const out = [];
        if (typeof editableItems === 'undefined' || !editableItems.eachLayer) return out;
        editableItems.eachLayer(lyr => { if (lyr.drawMode === MODE) out.push(lyr); });
        return out;
    }

    /* คิดใหม่ทุกต้น ใช้ตอนเปลี่ยนชั้นการป้องกันหรือขยับผังแผง */
    function recompute() {
        const rods = list();
        rods.forEach(redrawZone);
        /* สรุปทั้งไซต์ เอาเคสที่แย่ที่สุดเป็นตัวแทน เพราะระยะแยกต้องผ่านทุกจุด */
        let worst = null;
        rods.forEach(lyr => {
            const r = lyr.lpsResult || {};
            if (r.verdict === 'not_ok') worst = 'not_ok';
            else if (r.verdict === 'ok' && worst === null) worst = 'ok';
        });
        return { count: rods.length, verdict: worst,
                 rods: rods.map(l => ({ lat: l.getLatLng().lat, lng: l.getLatLng().lng,
                                        data: l.lpsData, result: l.lpsResult })) };
    }

    function arm() {
        if (typeof map === 'undefined') return;
        armed = true;
        map.getContainer().style.cursor = 'crosshair';
        map.once('click', onMapClick);
    }
    function disarm() {
        if (typeof map === 'undefined') return;
        armed = false;
        map.getContainer().style.cursor = '';
        map.off('click', onMapClick);
    }
    function onMapClick(ev) {
        if (!armed) return;
        place(ev.latlng);
        disarm();
        if (typeof ascSyncLpsUI === 'function') ascSyncLpsUI();
    }

    function clear() {
        list().forEach(lyr => {
            if (lyr._zoneCircle && typeof map !== 'undefined') map.removeLayer(lyr._zoneCircle);
            if (typeof editableItems !== 'undefined') editableItems.removeLayer(lyr);
        });
    }

    if (typeof document !== 'undefined') {
        document.addEventListener('keydown', e => { if (e.key === 'Escape') disarm(); });
    }

    global.AscLps = {
        SPHERE_RADIUS_M, MIN_CURRENT_KA, MESH_M, DOWN_CONDUCTOR_SPACING_M,
        KI, KM, ANGLE_DEG, ANGLE_H_MAX,
        kcFor, strikeDistance, protectionAngle, separation, assess,
        nearestArrayDistanceM,
        place, arm, disarm, makeLayer, list, recompute, clear, evaluate,
        _distanceM: distanceM, _distToSegmentM: distToSegmentM, _pointInRing: pointInRing
    };

})(window);
