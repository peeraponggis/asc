/* ============================================================================
 *  ASC · เครื่องมือวาดสันหลังคา (Ridge Tool)
 *
 *  ปัญหาที่แก้
 *  ------------------------------------------------------------
 *  แบบจำลอง 3 มิติ สร้างหลังคาหนึ่งผืนเป็น "ระนาบแบนหนึ่งแผ่น" ตามสมการ
 *      z = ชายคา + ระยะไหล·tan(slope) + ระยะขวาง·ความเอียงตามขวาง
 *  ซึ่งเป็นระนาบเดียว จึงแสดงหลังคาที่มีสันจริงไม่ได้เลยในทางเรขาคณิต
 *  ช่อง "ความสูงสันหลังคา" ถูกใช้แค่ย้อนหาค่า slope เท่านั้น
 *  ผู้ใช้ที่กรอกโดยหวังจะได้หลังคาจั่ว จึงได้หลังคาเพิงแหงนแทน
 *
 *  วิธีแก้
 *  ------------------------------------------------------------
 *  ให้ผู้ใช้วาดหลังคาผืนเดียวตามปกติ แล้วลากเส้นสันทับลงไปหนึ่งเส้น
 *  ระบบตัดรูปหลังคาออกเป็นสองผืนตามเส้นนั้น พร้อมตั้งทิศให้ลาดออกจากสัน
 *  คนละทาง ผลลัพธ์คือระนาบสองแผ่นชนกันที่สัน = หลังคาจั่วจริงในแบบจำลอง
 *
 *  ไม่ต้องแก้โครงสร้างข้อมูลเลย เพราะระบบเก็บ ทิศ ความชัน ชายคา และสัน
 *  แยกต่อหลังคาหนึ่งผืนอยู่แล้ว asc_3d และ asc_report จึงใช้ได้ทันที
 *
 *  ครอบคลุมทรงหลังคา
 *  ------------------------------------------------------------
 *  จั่ว · เพิงแหงนซ้อน · ปีกผีเสื้อ (ตั้งสันให้ต่ำกว่าชายคา)
 *  ส่วนปั้นหยาใช้วิธีลากสันแล้วตัดปลายเพิ่มอีกสองผืน
 * ==========================================================================*/

(function (global) {
    'use strict';

    let ridgeLine = null;      // เส้นสันที่แสดงบนแผนที่
    let ridgeHandles = [];     // หมุดสำหรับลาก
    let ridgeTarget = null;    // หลังคาที่กำลังจะถูกตัด

    /* ── แปลงพิกัดไปกลับระหว่างองศากับเมตร ───────────────────────────────
       ใช้ระนาบท้องถิ่นรอบจุดศูนย์กลางหลังคา ขนาดงานไม่เกินหลักร้อยเมตร
       ความคลาดเคลื่อนจากการถือว่าโลกแบนจึงต่ำกว่าความละเอียดของการวาดมาก */
    function frameOf(latlngs) {
        const lat0 = latlngs.reduce((s, p) => s + p.lat, 0) / latlngs.length;
        const lng0 = latlngs.reduce((s, p) => s + p.lng, 0) / latlngs.length;
        const mPerLat = 111320;
        const mPerLng = 111320 * Math.cos(lat0 * Math.PI / 180);
        return {
            toXY: (p) => ({ x: (p.lng - lng0) * mPerLng, y: (p.lat - lat0) * mPerLat }),
            toLL: (q) => L.latLng(lat0 + q.y / mPerLat, lng0 + q.x / mPerLng)
        };
    }

    /* ── เดาแนวสัน ────────────────────────────────────────────────────────
       หากรอบสี่เหลี่ยมที่พอดีที่สุดกับรูปหลังคา (min-area rectangle)
       แล้ววางสันตามแกนยาวผ่านจุดกึ่งกลาง ซึ่งตรงกับธรรมเนียมการสร้างจริง
       คือสันหลังคาวางตามด้านยาวของอาคาร */
    function guessRidge(xy) {
        let best = null;
        for (let i = 0; i < xy.length; i++) {
            const a = xy[i], b = xy[(i + 1) % xy.length];
            const ang = Math.atan2(b.y - a.y, b.x - a.x);
            const c = Math.cos(-ang), s = Math.sin(-ang);
            let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
            xy.forEach(p => {
                const u = p.x * c - p.y * s, v = p.x * s + p.y * c;
                if (u < minU) minU = u; if (u > maxU) maxU = u;
                if (v < minV) minV = v; if (v > maxV) maxV = v;
            });
            const w = maxU - minU, h = maxV - minV, area = w * h;
            if (!best || area < best.area) best = { area, ang, w, h, minU, maxU, minV, maxV };
        }
        if (!best) return null;

        // แกนยาวของกรอบคือแนวสัน
        const alongU = best.w >= best.h;
        const midV = (best.minV + best.maxV) / 2;
        const midU = (best.minU + best.maxU) / 2;
        const c = Math.cos(best.ang), s = Math.sin(best.ang);
        const back = (u, v) => ({ x: u * c - v * s, y: u * s + v * c });

        // ยืดออกให้ยาวเกินรูปเล็กน้อย เพื่อให้ตัดขาดแน่นอน
        const pad = Math.max(best.w, best.h) * 0.15 + 2;
        return alongU
            ? [back(best.minU - pad, midV), back(best.maxU + pad, midV)]
            : [back(midU, best.minV - pad), back(midU, best.maxV + pad)];
    }

    /* ── ตัดรูปหลายเหลี่ยมด้วยเส้นตรง ─────────────────────────────────────
       ใช้วิธี Sutherland–Hodgman ตัดทีละครึ่งระนาบ
       ให้ผลถูกต้องกับรูปนูน ซึ่งครอบคลุมรูปหลังคาเกือบทั้งหมด */
    function clipHalf(poly, a, b, keepPositive) {
        const side = (p) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
        const inside = (p) => keepPositive ? side(p) >= 0 : side(p) <= 0;
        const out = [];
        for (let i = 0; i < poly.length; i++) {
            const cur = poly[i], nxt = poly[(i + 1) % poly.length];
            const sc = side(cur), sn = side(nxt);
            if (inside(cur)) out.push(cur);
            if ((sc > 0) !== (sn > 0) && sc !== sn) {
                const t = sc / (sc - sn);
                out.push({ x: cur.x + t * (nxt.x - cur.x), y: cur.y + t * (nxt.y - cur.y) });
            }
        }
        return out;
    }

    const areaOf = (p) => {
        let a = 0;
        for (let i = 0; i < p.length; i++) {
            const q = p[(i + 1) % p.length];
            a += p[i].x * q.y - q.x * p[i].y;
        }
        return Math.abs(a) / 2;
    };
    const centroidOf = (p) => ({
        x: p.reduce((s, q) => s + q.x, 0) / p.length,
        y: p.reduce((s, q) => s + q.y, 0) / p.length
    });

    /* ── เริ่มวาดสัน ─────────────────────────────────────────────────────── */
    function start(layer) {
        if (!layer || layer.drawMode !== 'roof') {
            alert('กรุณาคลิกเลือกหลังคาที่ต้องการก่อน แล้วจึงกดวาดสันหลังคา');
            return;
        }
        cancel();
        ridgeTarget = layer;

        const ll = layer.getLatLngs()[0];
        const F = frameOf(ll);
        const xy = ll.map(F.toXY);
        const g = guessRidge(xy);
        if (!g) { alert('รูปหลังคานี้เดาแนวสันไม่ได้'); return; }

        const pts = g.map(F.toLL);
        ridgeLine = L.polyline(pts, {
            color: '#dc2626', weight: 4, dashArray: '10,6', opacity: 0.95, interactive: false
        }).addTo(map);

        pts.forEach((p, i) => {
            const h = L.marker(p, {
                draggable: true,
                icon: L.divIcon({
                    className: '',
                    html: '<div style="width:16px;height:16px;border-radius:50%;background:#dc2626;' +
                          'border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>',
                    iconSize: [16, 16], iconAnchor: [8, 8]
                })
            }).addTo(map);
            h.on('drag', () => {
                const cur = ridgeHandles.map(m => m.getLatLng());
                ridgeLine.setLatLngs(cur);
            });
            ridgeHandles.push(h);
        });

        const box = document.getElementById('ridgeToolBox');
        if (box) box.style.display = 'block';
    }

    function cancel() {
        if (ridgeLine) { map.removeLayer(ridgeLine); ridgeLine = null; }
        ridgeHandles.forEach(h => map.removeLayer(h));
        ridgeHandles = [];
        ridgeTarget = null;
        const box = document.getElementById('ridgeToolBox');
        if (box) box.style.display = 'none';
    }

    /* ── ยืนยัน แล้วตัดหลังคาออกเป็นสองผืน ───────────────────────────────── */
    function apply() {
        if (!ridgeTarget || ridgeHandles.length !== 2) { cancel(); return; }

        const ll = ridgeTarget.getLatLngs()[0];
        const F = frameOf(ll);
        const poly = ll.map(F.toXY);
        const a = F.toXY(ridgeHandles[0].getLatLng());
        const b = F.toXY(ridgeHandles[1].getLatLng());

        const left = clipHalf(poly, a, b, true);
        const right = clipHalf(poly, a, b, false);
        const total = areaOf(poly);

        if (left.length < 3 || right.length < 3 ||
            areaOf(left) < total * 0.02 || areaOf(right) < total * 0.02) {
            alert('เส้นสันไม่ได้ตัดผ่านหลังคา หรือตัดได้ชิ้นเล็กเกินไป\n\n' +
                  'ลากปลายเส้นให้พาดข้ามหลังคาจากขอบหนึ่งไปอีกขอบหนึ่ง');
            return;
        }

        // ทิศที่หลังคาแต่ละฝั่งหันไป คือทิศที่น้ำไหลลง นับจากสันออกไปหาชายคา
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const aziOf = (piece) => {
            const c = centroidOf(piece);
            let deg = Math.atan2(c.x - mid.x, c.y - mid.y) * 180 / Math.PI;   // 0 = ทิศเหนือ
            return Math.round((deg + 360) % 360);
        };

        const src = ridgeTarget;
        const baseCfg = JSON.parse(JSON.stringify(src.panelConfig || {}));
        const eaveA = num(document.getElementById('roofHeightM'));
        const ridgeH = num(document.getElementById('ridgeHeightM'));

        /* ระยะไหลของครึ่งหนึ่ง คือระยะตั้งฉากจากสันไปถึงจุดที่ไกลที่สุดของครึ่งนั้น
           ต้องคำนวณใหม่ เพราะการตัดทำให้ระยะไหลเหลือครึ่งเดียวของเดิม */
        const runOf = (piece) => {
            const L2 = Math.hypot(b.x - a.x, b.y - a.y) || 1;
            return piece.reduce((mx, p) => Math.max(mx,
                Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / L2), 0);
        };

        [left, right].forEach(piece => {
            const latlngs = piece.map(F.toLL);
            const lyr = L.polygon(latlngs, {
                color: '#ea580c', weight: 2, fillColor: '#f97316', fillOpacity: 0.3
            });
            lyr.drawMode = 'roof';

            /* ต้องตั้ง slope ให้ตรงกับความสูงที่ต้องการ ไม่ใช่คัดลอกค่าเดิมมา
               เพราะระบบคำนวณความสูงสันย้อนจาก slope กับระยะไหลเสมอ
               ถ้าปล่อยค่าเดิมไว้ ความสูงสันที่ตั้งไว้จะถูกเขียนทับตอนประมวลผล
               และหลังคาสองครึ่งจะสูงไม่เท่ากันทั้งที่ควรชนกันพอดีที่สัน */
            const run = runOf(piece);
            const rise = (isFinite(ridgeH) && isFinite(eaveA)) ? (ridgeH - eaveA) : NaN;
            const slope = (isFinite(rise) && run > 0.1)
                ? Math.atan(rise / run) * 180 / Math.PI
                : baseCfg.slope;

            lyr.panelConfig = Object.assign({}, baseCfg, {
                customAzimuth: aziOf(piece),
                slope: Number(slope.toFixed(2)),
                // ชายคาสองปลายเท่ากัน สันอยู่ตรงกลาง จึงเป็นจั่วสมมาตร
                eaveHeight_m: isFinite(eaveA) ? eaveA : baseCfg.eaveHeight_m,
                eaveHeightB_m: isFinite(eaveA) ? eaveA : baseCfg.eaveHeightB_m,
                ridgeHeight_m: isFinite(ridgeH) ? ridgeH : baseCfg.ridgeHeight_m,
                customLayout: null      // บังคับให้วางแผงใหม่ตามรูปที่เปลี่ยนไป
            });
            lyr.on('click', function (ev) { L.DomEvent.stop(ev); setActiveRoofLayer(this); });
            editableItems.addLayer(lyr);
        });

        // ให้ช่อง Slope บนหน้าจอตรงกับค่าที่เพิ่งคำนวณ ผู้ใช้จะได้ไม่งงว่าทำไมเลขเปลี่ยน
        const runL = runOf(left);
        if (isFinite(ridgeH) && isFinite(eaveA) && runL > 0.1) {
            const el = document.getElementById('sysSlope');
            if (el) el.value = (Math.atan((ridgeH - eaveA) / runL) * 180 / Math.PI).toFixed(2);
        }

        editableItems.removeLayer(src);
        cancel();

        if (typeof recalculateLabels === 'function') recalculateLabels();
        if (typeof processPolygonsAndPanels === 'function') processPolygonsAndPanels();
        if (typeof saveMapState === 'function') saveMapState();
    }

    function num(el) { return el ? parseFloat(el.value) : NaN; }

    global.AscRidge = { start, apply, cancel, _guessRidge: guessRidge, _clipHalf: clipHalf, _areaOf: areaOf };

})(window);
