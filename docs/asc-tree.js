/* ============================================================================
 *  ASC · เครื่องมือวางต้นไม้ (Tree / Near-Field Shading Tool)
 *
 *  ปัญหาที่แก้
 *  ------------------------------------------------------------
 *  ต้นไม้ข้างอาคารเป็นสิ่งบังแดดที่พบบ่อยที่สุดในงานจริง แต่เดิมใส่ได้
 *  ทางเดียวคือเครื่องมือสิ่งกีดขวาง ซึ่งไปลบพื้นที่วางแผงทิ้ง ทั้งที่
 *  ต้นไม้อยู่ข้างหลังคา ไม่ได้กินพื้นที่บนหลังคา และเงาของมันก็เป็นแค่
 *  ภาพใน asc_3d ไม่เคยเข้าไปในตัวเลขผลผลิตเลย
 *
 *  ส่วนช่อง Far Horizon Profile ที่มีอยู่ ใช้แทนต้นไม้ใกล้อาคารไม่ได้
 *  เพราะเป็นค่าเดียวสำหรับทั้งไซต์ แต่มุมเงยจากแผงแต่ละแผ่นไปยังยอดไม้
 *  ต่างกันมาก ต้นสูง 12 ม. ห่างหลังคา 8 ม. แผงหัวแถวเห็นเป็น 56 องศา
 *  แผงท้ายแถวเห็นเป็น 1 องศา ใส่ค่าเดียวจะผิดทั้งสองทาง
 *
 *  วิธีแก้
 *  ------------------------------------------------------------
 *  เก็บต้นไม้เป็นจุด พร้อมรัศมีทรงพุ่มและความสูง แล้วคำนวณมุมบังที่
 *  หลังคาแต่ละผืน "มองเห็น" จริง ออกมาเป็นเส้นขอบฟ้ารายหลังคา
 *  ซึ่ง ShadingEngine ใน asc_report รองรับอยู่แล้วผ่าน poly.horizonProfile
 *  จึงไม่ต้องแตะเครื่องคำนวณพลังงานเลยแม้แต่บรรทัดเดียว
 *
 *  แบบจำลองทรงพุ่ม
 *  ------------------------------------------------------------
 *  ทรงกระบอกตั้ง รัศมี R ยอดสูง H วัดจากระดับพื้นเดียวกับชายคา
 *  ยิงรังสีจากจุดบนหลังคาไปทุกมุมทิศ หาระยะที่ชนขอบทรงพุ่มแบบตรงสูตร
 *  แล้วได้มุมเงย = atan((H - ความสูงจุดบนหลังคา) / ระยะที่ชน)
 *
 *  มุมทิศทั้งไฟล์นี้เป็นแบบเข็มทิศ (0 เหนือ · 90 ออก · -90 ตก · ±180 ใต้)
 *  ตรงตามป้ายกำกับช่อง Horizon Data และตรงกับทิศหลังคาที่ asc_design ใช้
 *  ส่วนการแปลงเข้าระบบของดวงอาทิตย์ ทำอยู่ในตัว ShadingEngine แล้ว
 * ==========================================================================*/

(function (global) {
    'use strict';

    const AZI_STEP = 5;          // ความละเอียดเส้นขอบฟ้า (องศา)
    const MAX_SAMPLES = 30;      // จำนวนจุดสุ่มบนหลังคาหนึ่งผืน
    const MIN_ELEV = 0.05;       // ต่ำกว่านี้ถือว่าไม่บัง

    let armed = false;           // กำลังรอคลิกวางต้นไม้อยู่หรือไม่

    /* ── ระนาบท้องถิ่นเป็นเมตร ─────────────────────────────────────────── */
    function frameAt(lat0, lng0) {
        const mPerLat = 111320;
        const mPerLng = 111320 * Math.cos(lat0 * Math.PI / 180);
        return {
            toXY: (lat, lng) => ({ e: (lng - lng0) * mPerLng, n: (lat - lat0) * mPerLat }),
            toLL: (e, n) => L.latLng(lat0 + n / mPerLat, lng0 + e / mPerLng)
        };
    }

    const treeLayers = () => editableItems.getLayers().filter(l => l.drawMode === 'tree');
    const roofLayers = () => editableItems.getLayers().filter(l => l.drawMode === 'roof');

    /* ── มุมเงยของทรงพุ่มเมื่อมองจากจุดหนึ่ง ไปตามมุมทิศหนึ่ง ────────────
       รังสีจากจุด P ทิศ bearing ตัดวงกลมรัศมี R ที่มีศูนย์กลางห่างออกไป
       คิดตรงตามสูตรวงกลม ไม่ประมาณ เพราะขอบทรงพุ่มด้านข้างบังต่ำกว่าตรงกลาง */
    function elevationAt(dE, dN, R, riseH, bearingDeg) {
        const b = bearingDeg * Math.PI / 180;
        const uE = Math.sin(b), uN = Math.cos(b);      // เวกเตอร์หนึ่งหน่วยตามรังสี
        const tc = dE * uE + dN * uN;                  // ระยะฉายของศูนย์กลางลงบนรังสี
        const perpSq = (dE * dE + dN * dN) - tc * tc;  // ระยะตั้งฉากยกกำลังสอง
        if (perpSq >= R * R) return 0;                 // รังสีไม่โดนทรงพุ่ม
        const half = Math.sqrt(R * R - perpSq);
        let t = tc - half;                             // ระยะถึงขอบทรงพุ่มด้านใกล้
        if (tc + half <= 0) return 0;                  // ทรงพุ่มอยู่ข้างหลัง
        if (t < 0.2) t = 0.2;                          // จุดอยู่ใต้ทรงพุ่มพอดี กันหารด้วยศูนย์
        if (riseH <= 0) return 0;                      // ยอดไม้ต่ำกว่าหลังคาแล้ว ไม่บัง
        return Math.atan(riseH / t) * 180 / Math.PI;
    }

    /* ── สุ่มจุดบนหลังคา ───────────────────────────────────────────────────
       ใช้หลายจุดไม่ใช่จุดศูนย์กลางจุดเดียว เพราะหลังคายาวๆ ปลายใกล้กับ
       ปลายไกลเห็นต้นไม้ต่างกันมาก เส้นขอบฟ้าหนึ่งเส้นต่อหลังคาหนึ่งผืน
       จึงควรเป็นค่าเฉลี่ยของทั้งผืน ไม่ใช่ค่าที่จุดใดจุดหนึ่ง */
    function sampleRoof(layer) {
        const gj = layer.toGeoJSON();
        const bb = turf.bbox(gj);
        const pts = [];
        const nStep = Math.ceil(Math.sqrt(MAX_SAMPLES));
        for (let i = 0; i < nStep; i++) {
            for (let j = 0; j < nStep; j++) {
                const lng = bb[0] + (bb[2] - bb[0]) * (i + 0.5) / nStep;
                const lat = bb[1] + (bb[3] - bb[1]) * (j + 0.5) / nStep;
                try {
                    if (turf.booleanPointInPolygon(turf.point([lng, lat]), gj)) pts.push({ lat, lng });
                } catch (e) { /* รูปทรงพัง ข้ามจุดนั้นไป */ }
            }
        }
        if (!pts.length) {                                   // หลังคาแคบมากจนตารางไม่โดนเลย
            const c = turf.centerOfMass(gj).geometry.coordinates;
            pts.push({ lat: c[1], lng: c[0] });
        }
        return pts;
    }

    /* ความสูงของแผงเหนือระดับพื้น ใช้ค่ากลางแนวลาด เพราะแผงกระจายอยู่ตลอด
       แนวลาด ไม่ได้กระจุกที่ปลายใดปลายหนึ่ง

       คำนวณจากชายคา ระยะไหล และความชัน ซึ่งเป็นวิธีเดียวกับที่ระบบใช้หา
       ความสูงสันเสมอ ไม่อ่านค่าสันที่เก็บไว้ตรงๆ เพราะค่านั้นเป็นผลลัพธ์
       ที่ถูกเขียนทับทุกครั้งที่ประมวลผล ถ้าอ่านตรงๆ จะได้ค่าเก่าค้างมา
       และมุมบังที่คำนวณได้จะไม่ตรงกับตอนเปิดไฟล์เดิมกลับมา */
    function roofPlaneHeight(layer) {
        const pc = layer.panelConfig || {};
        const scr = document.getElementById('roofHeightM');
        let eave = parseFloat(pc.eaveHeight_m);
        if (!isFinite(eave)) eave = scr ? (parseFloat(scr.value) || 0) : 0;

        const run = parseFloat(pc.roofRunM);
        const slope = parseFloat(pc.slope);
        if (isFinite(run) && run > 0 && isFinite(slope)) {
            return eave + (run / 2) * Math.tan(slope * Math.PI / 180);
        }
        const ridge = parseFloat(pc.ridgeHeight_m);
        if (isFinite(ridge)) return (eave + ridge) / 2;
        return eave;
    }

    /* ── สร้างเส้นขอบฟ้าของหลังคาหนึ่งผืนจากต้นไม้ทุกต้น ────────────────── */
    function horizonFor(layer, trees) {
        if (!trees.length) return '';
        const samples = sampleRoof(layer);
        const z = roofPlaneHeight(layer);
        const F = frameAt(samples[0].lat, samples[0].lng);

        const bins = [];
        for (let a = -180; a < 180; a += AZI_STEP) bins.push(a);

        const sums = new Array(bins.length).fill(0);
        samples.forEach(s => {
            const sp = F.toXY(s.lat, s.lng);
            bins.forEach((a, k) => {
                let best = 0;
                trees.forEach(t => {
                    const tp = F.toXY(t.ll.lat, t.ll.lng);
                    const e = elevationAt(tp.e - sp.e, tp.n - sp.n, t.r, t.h - z, a);
                    if (e > best) best = e;
                });
                sums[k] += best;
            });
        });

        const lines = [];
        let any = false;
        bins.forEach((a, k) => {
            const v = sums[k] / samples.length;
            if (v >= MIN_ELEV) any = true;
            lines.push(a + ',' + v.toFixed(2));
        });
        return any ? lines.join('\n') : '';
    }

    /* ── คำนวณใหม่ทั้งไซต์ แล้วเขียนลงหลังคาแต่ละผืน ────────────────────── */
    function recompute(silent) {
        const trees = treeLayers().map(l => ({
            ll: l.getLatLng(),
            r: Math.max(0.3, parseFloat(l.treeData.canopyR_m) || 3),
            h: Math.max(0.3, (parseFloat(l.treeData.height_m) || 8) + (parseFloat(l.treeData.growth_m) || 0))
        }));

        const report = [];
        roofLayers().forEach((layer, i) => {
            if (!layer.panelConfig) layer.panelConfig = {};
            const hz = horizonFor(layer, trees);
            if (hz) layer.panelConfig.horizonProfile = hz;
            else delete layer.panelConfig.horizonProfile;

            let peak = 0;
            if (hz) hz.split('\n').forEach(l => { const v = parseFloat(l.split(',')[1]); if (v > peak) peak = v; });
            report.push({ id: i + 1, peak: peak });
        });

        if (typeof processPolygonsAndPanels === 'function') processPolygonsAndPanels();
        if (typeof saveMapState === 'function') saveMapState();
        renderStatus(trees.length, report);
        return report;
    }

    function renderStatus(nTrees, report) {
        const box = document.getElementById('treeStatusBox');
        if (!box) return;
        if (!nTrees) {
            box.innerHTML = '<span style="color:#64748b;">ยังไม่มีต้นไม้ในไซต์</span>';
            return;
        }
        const rows = report.map(r => 'หลังคา ' + r.id + ': มุมบังสูงสุด ' +
            (r.peak >= 0.05 ? r.peak.toFixed(1) + '°' : 'ไม่โดนบัง')).join('<br>');
        box.innerHTML = '<b>ต้นไม้ ' + nTrees + ' ต้น</b><br>' + rows +
            '<div style="color:#64748b; margin-top:4px;">มุมบังถูกส่งเข้ารายงานเป็นเส้นขอบฟ้ารายหลังคา</div>';
    }

    /* ── สร้างชั้นข้อมูลต้นไม้หนึ่งต้น ──────────────────────────────────────
       ใช้ทั้งตอนวางใหม่และตอนเปิดไฟล์เก่ากลับมา วงกลมบนแผนที่มีรัศมีเท่า
       ทรงพุ่มจริง ผู้ใช้จึงเห็นทันทีว่าพุ่มไม้กินพื้นที่ถึงตรงไหน */
    function makeLayer(latlng, data) {
        const d = data || {};
        const r = Math.max(0.3, parseFloat(d.canopyR_m) || 3);
        const lyr = L.circle(latlng, {
            radius: r, color: '#15803d', weight: 2,
            fillColor: '#22c55e', fillOpacity: 0.35, dashArray: '3, 3'
        });
        lyr.drawMode = 'tree';
        lyr.treeData = {
            canopyR_m: r,
            height_m: Math.max(0.3, parseFloat(d.height_m) || 8),
            growth_m: Math.max(0, parseFloat(d.growth_m) || 0)
        };
        attach(lyr);
        return lyr;
    }

    /* ── วางต้นไม้ ──────────────────────────────────────────────────────── */
    function place(latlng) {
        const num = (id, dflt) => {
            const el = document.getElementById(id);
            const v = el ? parseFloat(el.value) : NaN;
            return isFinite(v) ? v : dflt;
        };
        const lyr = makeLayer(latlng, {
            canopyR_m: num('treeCanopyR', 3),
            height_m: num('treeHeightM', 8),
            growth_m: num('treeGrowthM', 0)
        });
        editableItems.addLayer(lyr);
        recompute();
        return lyr;
    }

    /* ผูกพฤติกรรมให้ต้นไม้ ใช้ทั้งตอนวางใหม่และตอนเปิดไฟล์เก่ากลับมา */
    function attach(lyr) {
        lyr.on('click', function (ev) {
            L.DomEvent.stop(ev);
            if (typeof setActiveRoofLayer === 'function') setActiveRoofLayer(this);
            const d = this.treeData || {};
            const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
            set('treeCanopyR', d.canopyR_m); set('treeHeightM', d.height_m); set('treeGrowthM', d.growth_m);
        });
        lyr.bindTooltip(() => {
            const d = lyr.treeData || {};
            return 'ต้นไม้ · ทรงพุ่ม R ' + d.canopyR_m + ' ม. · สูง ' + d.height_m + ' ม.' +
                   (d.growth_m > 0 ? ' (+' + d.growth_m + ' เผื่อโต)' : '');
        }, { direction: 'top' });
    }

    function arm() {
        armed = !armed;
        const btn = document.getElementById('btnPlaceTree');
        if (btn) {
            btn.style.background = armed ? '#15803d' : '#f0fdf4';
            btn.style.color = armed ? '#fff' : '#15803d';
            btn.innerText = armed ? '⏳ คลิกบนแผนที่เพื่อวาง' : '🌳 วางต้นไม้';
        }
        if (map) map.getContainer().style.cursor = armed ? 'crosshair' : '';
    }

    function disarm() { if (armed) arm(); }

    /* อัปเดตค่าของต้นไม้ที่กำลังเลือกอยู่ เมื่อผู้ใช้แก้ตัวเลขในช่องกรอก */
    function syncSelected() {
        const lyr = (typeof activeRoofLayer !== 'undefined') ? activeRoofLayer : null;
        if (!lyr || lyr.drawMode !== 'tree') return;
        const num = (id, dflt) => {
            const el = document.getElementById(id);
            const v = el ? parseFloat(el.value) : NaN;
            return isFinite(v) ? v : dflt;
        };
        lyr.treeData = {
            canopyR_m: Math.max(0.3, num('treeCanopyR', 3)),
            height_m: Math.max(0.3, num('treeHeightM', 8)),
            growth_m: Math.max(0, num('treeGrowthM', 0))
        };
        lyr.setRadius(lyr.treeData.canopyR_m);
        recompute();
    }

    function init() {
        if (typeof map === 'undefined' || !map) return;
        map.on('click', (e) => { if (armed) { place(e.latlng); disarm(); } });
        const btn = document.getElementById('btnPlaceTree');
        if (btn) btn.addEventListener('click', arm);
        ['treeCanopyR', 'treeHeightM', 'treeGrowthM'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', syncSelected);
        });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') disarm(); });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    global.AscTree = {
        place, recompute, attach, arm, disarm, makeLayer,
        _horizonFor: horizonFor, _elevationAt: elevationAt, _sampleRoof: sampleRoof
    };

})(window);
