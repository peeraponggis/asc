/* ============================================================================
 *  ASC · ลูกศรบอกทิศลาดหลังคา และการตรวจจั่ว/รางน้ำ
 *
 *  ปัญหาที่แก้
 *  ------------------------------------------------------------
 *  ช่อง Azimuth เก็บ "ทิศที่หลังคาลาดลง" ซึ่งเป็นตัวกำหนดว่าขอบด้านไหนเป็นสัน
 *  และขอบด้านไหนเป็นชายคา แต่บนหน้าจอเห็นเป็นแค่ตัวเลของศาเดียว ไม่มีอะไรบอก
 *  ว่าเลขนั้นทำให้หลังคาลาดไปทางไหนจริง
 *
 *  หลังคาสองผืนที่วางติดกันและมีทิศต่างกัน 180 องศา เป็นได้ทั้งสองแบบ
 *      ลาดออกจากกัน  = สันชนกันตรงกลาง = จั่ว
 *      ลาดเข้าหากัน  = ชายคาชนกันตรงกลาง = รางน้ำ (ปีกผีเสื้อ)
 *  ตัวเลขทิศของทั้งสองแบบหน้าตาเหมือนกันทุกประการ ต่างกันแค่ว่าเลขไหนไปอยู่กับ
 *  หลังคาผืนไหน สลับกันเมื่อไรก็ได้อีกแบบทันทีโดยไม่มีอะไรเตือน
 *
 *  วิธีแก้
 *  ------------------------------------------------------------
 *  วาดลูกศรทิศลาดลงบนหลังคาทุกผืน พร้อมเลขกำกับผืน มองแวบเดียวก็รู้ว่าน้ำไหล
 *  ไปทางไหน และเพิ่มการตรวจคู่หลังคาที่อยู่ติดกันว่าตอนนี้เป็นจั่วหรือรางน้ำ
 *  ถ้าเป็นรางน้ำโดยไม่ได้ตั้งใจ มีปุ่มสลับทิศให้กดแก้ได้ทันที
 * ==========================================================================*/

(function (global) {
    'use strict';

    let dirLayer = null;

    const roofLayers = () => editableItems.getLayers().filter(l => l.drawMode === 'roof');
    const zoneLayers = () => editableItems.getLayers().filter(l => l.drawMode === 'pvzone');

    /* ทิศที่ใช้จริงของหลังคาผืนหนึ่ง — ค่าที่ผู้ใช้กำหนดเองมาก่อนค่าที่ระบบเดาให้ */
    function aziOf(layer) {
        const pc = layer.panelConfig || {};
        let a = pc.customAzimuth;
        if (a === null || a === undefined || !isFinite(a)) a = pc.autoAzimuth;
        return isFinite(a) ? ((a % 360) + 360) % 360 : null;
    }

    /* วัตถุที่ควรมีลูกศรกำกับ

       เดิมวาดที่จุดกึ่งกลางหลังคาเสมอ ซึ่งอ่านผิดได้ง่ายเมื่อหลังคาผืนใหญ่มีกรอบ
       พื้นที่วางแผงเล็ก ๆ อยู่มุมเดียว ลูกศรจะไปโผล่กลางที่ว่างที่ไม่มีแผงสักแผ่น
       ตอนนี้กรอบพื้นที่วางแผงตั้งทิศของตัวเองได้ด้วย ลูกศรจึงต้องอยู่ที่กรอบ
       เพราะกรอบคือสิ่งที่บอกว่าแผงหันทางไหนจริง

       หลังคาที่ยังไม่มีกรอบทับ ยังวาดลูกศรที่หลังคาเหมือนเดิม เพื่อให้เห็นทิศ
       ตั้งแต่ก่อนวาดกรอบ และไฟล์งานเก่าที่ไม่มีกรอบเลยจึงได้ผลเท่าเดิมทุกประการ */
    function arrowTargets() {
        const zones = zoneLayers();
        const roofs = roofLayers();
        if (!zones.length) {
            return roofs.map((l, i) => ({ layer: l, azi: aziOf(l), label: String(i + 1) }));
        }
        const out = zones.map((z, i) => ({
            layer: z,
            azi: (typeof ascZoneAzimuth === 'function') ? ascZoneAzimuth(z) : aziOf(z),
            label: 'โซน ' + (i + 1)
        }));
        roofs.forEach((r, i) => {
            let covered = false;
            try {
                const rg = r.toGeoJSON();
                covered = zones.some(z => turf.booleanIntersects(z.toGeoJSON(), rg));
            } catch (e) { covered = false; }
            if (!covered) out.push({ layer: r, azi: aziOf(r), label: String(i + 1) });
        });
        return out;
    }

    function centroidLL(layer) {
        try {
            const c = turf.centerOfMass(layer.toGeoJSON()).geometry.coordinates;
            return L.latLng(c[1], c[0]);
        } catch (e) { return layer.getBounds().getCenter(); }
    }

    /* ── วาดลูกศรทิศลาดของหลังคาทุกผืน ─────────────────────────────────── */
    function redraw() {
        if (typeof map === 'undefined' || !map) return;
        if (!dirLayer) dirLayer = L.layerGroup().addTo(map);
        dirLayer.clearLayers();
        if (!document.getElementById('chkRoofDir') || !document.getElementById('chkRoofDir').checked) return;

        arrowTargets().forEach(t => {
            const layer = t.layer;
            const azi = t.azi;
            if (azi === null || !isFinite(azi)) return;
            const c = centroidLL(layer);

            /* ความยาวลูกศรคิดจากขนาดหลังคา จะได้พอดีตัวทั้งอาคารเล็กและใหญ่ */
            const b = layer.getBounds();
            const diag = turf.distance([b.getWest(), b.getSouth()], [b.getEast(), b.getNorth()], { units: 'meters' });
            const len = Math.max(4, Math.min(diag * 0.28, 22));

            const tip = turf.destination([c.lng, c.lat], len / 2, azi, { units: 'meters' }).geometry.coordinates;
            const tail = turf.destination([c.lng, c.lat], len / 2, (azi + 180) % 360, { units: 'meters' }).geometry.coordinates;
            const head1 = turf.destination(tip, len * 0.28, (azi + 145) % 360, { units: 'meters' }).geometry.coordinates;
            const head2 = turf.destination(tip, len * 0.28, (azi + 215) % 360, { units: 'meters' }).geometry.coordinates;

            const style = { color: '#1d4ed8', weight: 3, opacity: 0.95 };
            L.polyline([[tail[1], tail[0]], [tip[1], tip[0]]], style).addTo(dirLayer);
            L.polyline([[head1[1], head1[0]], [tip[1], tip[0]], [head2[1], head2[0]]], style).addTo(dirLayer);

            // เลขกำกับหลังคา วางที่หางลูกศร ซึ่งเป็นด้านสัน
            L.marker([tail[1], tail[0]], {
                interactive: false,
                icon: L.divIcon({
                    className: '',
                    html: '<div style="background:#1d4ed8;color:#fff;font-size:11px;font-weight:700;' +
                          'padding:1px 6px;border-radius:9px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.4)">' +
                          t.label + ' · ' + Math.round(azi) + '°</div>',
                    iconSize: null, iconAnchor: [14, 8]
                })
            }).addTo(dirLayer);
        });
    }

    /* ── ตรวจคู่หลังคาที่อยู่ติดกันว่าเป็นจั่วหรือรางน้ำ ────────────────────
       ดูจากทิศลาดของแต่ละผืนเทียบกับแนวที่เชื่อมจุดกึ่งกลางสองผืน
       ลาดออกจากกัน = สันชนกัน  ·  ลาดเข้าหากัน = ชายคาชนกัน */
    function pairs() {
        const rs = roofLayers();
        const out = [];
        for (let i = 0; i < rs.length; i++) {
            for (let j = i + 1; j < rs.length; j++) {
                const a = rs[i], b = rs[j];
                let touching = false;
                try {
                    const ga = a.toGeoJSON(), gb = b.toGeoJSON();
                    // ขยายออกเล็กน้อยแล้วดูว่าทับกันไหม รองรับขอบที่ห่างกันไม่กี่เซนติเมตร
                    touching = turf.booleanIntersects(turf.buffer(ga, 0.6, { units: 'meters' }), gb);
                } catch (e) { touching = false; }
                if (!touching) continue;

                const aA = aziOf(a), aB = aziOf(b);
                if (aA === null || aB === null) continue;
                const ca = centroidLL(a), cb = centroidLL(b);
                // ทิศจาก a ไป b (แบบเข็มทิศ)
                const aToB = (turf.bearing([ca.lng, ca.lat], [cb.lng, cb.lat]) + 360) % 360;
                const dev = (x, y) => { const d = Math.abs(((x - y + 540) % 360) - 180); return d; };
                const aTowardB = dev(aA, aToB) < 90;             // a ลาดไปทาง b
                const bTowardA = dev(aB, (aToB + 180) % 360) < 90; // b ลาดไปทาง a

                let kind, note;
                if (aTowardB && bTowardA) { kind = 'valley'; note = 'ชายคาชนกัน (รางน้ำ/ปีกผีเสื้อ)'; }
                else if (!aTowardB && !bTowardA) { kind = 'gable'; note = 'สันชนกัน (จั่ว)'; }
                else { kind = 'shed'; note = 'ลาดไปทางเดียวกัน (เพิงแหงนต่อเนื่อง)'; }
                out.push({ i: i + 1, j: j + 1, a, b, kind, note, aziA: Math.round(aA), aziB: Math.round(aB) });
            }
        }
        return out;
    }

    /* สลับทิศหลังคา 180 องศา ทีละหลายผืนพร้อมกัน แล้วคำนวณใหม่ทั้งชุด */
    function flip(/* ...idx */) {
        const rs = roofLayers();
        const list = Array.prototype.slice.call(arguments);
        let changed = 0;
        list.forEach(idx => {
            const r = rs[idx];
            if (!r) return;
            const a = aziOf(r);
            if (a === null) return;
            r.panelConfig.customAzimuth = (a + 180) % 360;
            delete r.panelConfig.customLayout;
            changed++;
        });
        if (!changed) return;
        if (typeof processPolygonsAndPanels === 'function') processPolygonsAndPanels();
        if (global.AscTree) AscTree.recompute();
        if (typeof saveMapState === 'function') saveMapState();
        redraw();
        render();
    }

    /* แก้รางน้ำให้เป็นจั่ว ต้องสลับทิศ "ทั้งสองผืน" ไม่ใช่ผืนเดียว
       สลับผืนเดียวจะได้หลังคาที่ลาดไปทางเดียวกันทั้งคู่ ซึ่งเป็นเพิงแหงนต่อเนื่อง
       ไม่ใช่จั่วที่ต้องการ */
    function makeGable(i, j) { flip(i, j); }

    /* ── กล่องสรุปใต้รายการหลังคา ───────────────────────────────────────── */
    function render() {
        const box = document.getElementById('roofDirBox');
        if (!box) return;
        const ps = pairs();
        if (!ps.length) { box.innerHTML = ''; box.style.display = 'none'; return; }
        box.style.display = 'block';
        box.innerHTML = ps.map(p => {
            const bad = p.kind === 'valley';
            const col = bad ? '#b45309' : (p.kind === 'gable' ? '#15803d' : '#475569');
            const bg = bad ? '#fffbeb' : (p.kind === 'gable' ? '#f0fdf4' : '#f8fafc');
            const bd = bad ? '#fcd34d' : (p.kind === 'gable' ? '#86efac' : '#e2e8f0');
            return '<div style="background:' + bg + ';border:1px solid ' + bd + ';border-radius:5px;padding:6px 8px;margin-top:6px;">' +
                '<b style="color:' + col + '">หลังคา ' + p.i + ' ↔ ' + p.j + ': ' + p.note + '</b>' +
                '<div style="color:#64748b;font-size:0.92em;margin-top:2px;">ทิศ ' + p.aziA + '° กับ ' + p.aziB + '°' +
                (bad ? ' — ถ้าตั้งใจทำจั่ว ต้องสลับทิศทั้งสองผืน (สลับผืนเดียวจะได้เพิงแหงนต่อเนื่อง)' : '') + '</div>' +
                (bad ? '<div style="margin-top:5px;">' +
                    '<button type="button" onclick="AscRoofDir.makeGable(' + (p.i - 1) + ',' + (p.j - 1) + ')" ' +
                    'title="สลับทิศทั้งสองผืนพร้อมกัน สลับผืนเดียวจะได้เพิงแหงนต่อเนื่อง ไม่ใช่จั่ว" ' +
                    'style="font-size:0.85em;padding:3px 10px;border:1px solid #b45309;background:#fff;color:#b45309;border-radius:4px;cursor:pointer;font-weight:700;">' +
                    '⤢ แก้ให้เป็นจั่ว (สลับทิศทั้งคู่)</button>' +
                    '</div>' : '') +
                '</div>';
        }).join('');
    }

    function refresh() { redraw(); render(); }

    function init() {
        if (typeof map === 'undefined' || !map) return;
        const chk = document.getElementById('chkRoofDir');
        if (chk) chk.addEventListener('change', refresh);
        refresh();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    global.AscRoofDir = { refresh, redraw, render, flip, makeGable, _pairs: pairs, _aziOf: aziOf };

})(window);
