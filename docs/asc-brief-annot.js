/* ============================================================================
 *  ASC · ตัวใส่ป้ายกำกับบนรูปหน้างาน (ใบสั่งงานช่าง)
 *
 *  หลักการเดียวที่ต้องรู้ : พิกัดทุกตัวเป็น "พิกเซลของภาพจริง"
 *  ----------------------------------------------------------------------
 *  SVG ที่วางทับรูปตั้ง viewBox = "0 0 กว้างจริง สูงจริง" เบราว์เซอร์จึงย่อ
 *  ขยายพิกัดให้เองตามขนาดที่แสดง ป้ายจะอยู่ตรงจุดเดิมเสมอ ทั้งบนจอมือถือ
 *  จอคอม และตอนสั่งพิมพ์ลงกระดาษ ถ้าเก็บเป็นพิกเซลบนจอ ป้ายจะเลื่อนทุกครั้ง
 *  ที่ขนาดเปลี่ยน ซึ่งเป็นกับดักที่พลาดกันบ่อย
 *
 *  ชนิดของป้าย (เท่าที่บรีฟจริงใช้ ไม่ทำเกิน)
 *  ----------------------------------------------------------------------
 *    label  ป้ายข้อความพร้อมเส้นชี้ — "ตำแหน่งติดตั้งอินเวอร์เตอร์"
 *    arrow  ลูกศรชี้จุด
 *    rect   กรอบเน้นบริเวณ
 *    route  แนวเดินท่อ แยกสไตล์ IMC กับ PVC ตามที่บรีฟเดิมแยกไว้
 *    step   หมุดตัวเลขลำดับขั้นตอน
 * ==========================================================================*/

(function (global) {
    'use strict';

    const NS = 'http://www.w3.org/2000/svg';

    /* ข้อความที่ใช้ซ้ำแทบทุกงาน พิมพ์เองก็ได้ แต่เลือกเร็วกว่าและสะกดตรงกันทุกใบ */
    const PRESETS = [
        'ตำแหน่งติดตั้งแผงโซลาร์เซลล์', 'ตำแหน่งติดตั้งอินเวอร์เตอร์',
        'ตู้เมนไฟบ้านลูกค้า', 'มิเตอร์การไฟฟ้า', 'ตู้เมนก่อนเข้าบ้าน',
        'จุดขนานไฟ', 'กล่องพักสายก่อนเข้าในบ้าน', 'เอ๊าท์เลทบ็อกซ์',
        'บริเวณติดตั้งแท่งกราวด์', 'แนวเดินท่อ IMC', 'แนวเดินท่อ PVC'
    ];

    const TOOLS = [
        { id: 'label', name: 'ป้ายข้อความ', icon: '🏷' },
        { id: 'arrow', name: 'ลูกศร',       icon: '↗' },
        { id: 'rect',  name: 'กรอบเน้น',    icon: '▭' },
        { id: 'imc',   name: 'ท่อ IMC',     icon: '━' },
        { id: 'pvc',   name: 'ท่อ PVC',     icon: '┅' },
        { id: 'step',  name: 'หมุดลำดับ',   icon: '①' }
    ];

    const COLOR = { label: '#E8A317', arrow: '#C4432B', rect: '#1E5A8A',
                    imc: '#0D9488', pvc: '#7C3AED', step: '#C4432B' };

    /* ══════════════════════════════════════════════════════════════════
       วาดป้ายลง SVG — ใช้ทั้งในตัวแก้ไขและในหน้าบรีฟ

       ขนาดเส้นและตัวอักษรคิดเป็นสัดส่วนของภาพ (ผ่าน k) ไม่ใช่ค่าคงที่
       ภาพ 800 พิกเซลกับ 3000 พิกเซลจึงได้ป้ายที่ดูหนาเท่ากันเมื่อแสดงผล
       ══════════════════════════════════════════════════════════════════ */
    function draw(svg, ann, w, h, opts) {
        const o = opts || {};
        const k = Math.max(w, h) / 1000;          // ตัวคูณให้เส้นหนาพอ ๆ กันทุกขนาดภาพ
        const sw = Math.max(1.5, 3 * k);
        const fs = Math.max(11, 19 * k);
        const el = (t, at) => { const e = document.createElementNS(NS, t);
            for (const a in at) e.setAttribute(a, at[a]); return e; };

        const g = el('g', { 'data-i': o.index == null ? '' : String(o.index) });
        if (o.selected) g.setAttribute('opacity', '0.75');
        const c = ann.color || COLOR[ann.t] || '#E8A317';

        if (ann.t === 'label') {
            const pad = 7 * k, tw = (String(ann.text || '').length * fs * 0.52) + pad * 2, th = fs * 1.7;
            // เส้นชี้ลากจากกล่องข้อความไปหาจุดที่ชี้
            g.appendChild(el('line', { x1: ann.tx, y1: ann.ty, x2: ann.x, y2: ann.y,
                stroke: c, 'stroke-width': sw, 'stroke-linecap': 'round' }));
            g.appendChild(el('circle', { cx: ann.x, cy: ann.y, r: 5 * k,
                fill: '#fff', stroke: c, 'stroke-width': sw }));
            g.appendChild(el('rect', { x: ann.tx - tw / 2, y: ann.ty - th / 2, width: tw, height: th,
                rx: 6 * k, fill: c, stroke: '#fff', 'stroke-width': Math.max(1, 1.5 * k) }));
            const t = el('text', { x: ann.tx, y: ann.ty + fs * 0.36, fill: '#fff',
                'font-size': fs, 'font-family': 'Kanit, sans-serif', 'text-anchor': 'middle' });
            t.textContent = ann.text || '';
            g.appendChild(t);

        } else if (ann.t === 'arrow') {
            const dx = ann.x2 - ann.x1, dy = ann.y2 - ann.y1;
            const L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
            const hd = Math.min(26 * k, L * 0.4);   // หัวลูกศรต้องไม่ยาวเกินตัวลูกศรเอง
            const bx = ann.x2 - ux * hd, by = ann.y2 - uy * hd;
            g.appendChild(el('line', { x1: ann.x1, y1: ann.y1, x2: bx, y2: by,
                stroke: c, 'stroke-width': sw * 1.3, 'stroke-linecap': 'round' }));
            g.appendChild(el('polygon', {
                points: [ann.x2 + ',' + ann.y2,
                         (bx - uy * hd * 0.42) + ',' + (by + ux * hd * 0.42),
                         (bx + uy * hd * 0.42) + ',' + (by - ux * hd * 0.42)].join(' '),
                fill: c }));

        } else if (ann.t === 'rect') {
            g.appendChild(el('rect', { x: Math.min(ann.x, ann.x + ann.w), y: Math.min(ann.y, ann.y + ann.h),
                width: Math.abs(ann.w), height: Math.abs(ann.h), rx: 5 * k,
                fill: 'none', stroke: c, 'stroke-width': sw * 1.3 }));

        } else if (ann.t === 'route') {
            const pts = (ann.pts || []).map(p => p[0] + ',' + p[1]).join(' ');
            if (pts) {
                // เส้นขาวหนุนข้างหลัง ทำให้แนวท่อยังเห็นชัดบนรูปที่พื้นหลังยุ่ง
                g.appendChild(el('polyline', { points: pts, fill: 'none', stroke: '#fff',
                    'stroke-width': sw * 2.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.75 }));
                const line = el('polyline', { points: pts, fill: 'none', stroke: c,
                    'stroke-width': sw * 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
                if (ann.style === 'pvc') line.setAttribute('stroke-dasharray', (10 * k) + ' ' + (7 * k));
                g.appendChild(line);
            }

        } else if (ann.t === 'step') {
            const r = 15 * k;
            g.appendChild(el('circle', { cx: ann.x, cy: ann.y, r: r, fill: c, stroke: '#fff', 'stroke-width': sw }));
            const t = el('text', { x: ann.x, y: ann.y + r * 0.36, fill: '#fff', 'font-size': r * 1.15,
                'font-family': 'Kanit, sans-serif', 'font-weight': '600', 'text-anchor': 'middle' });
            t.textContent = String(ann.n || 1);
            g.appendChild(t);
        }
        svg.appendChild(g);
        return g;
    }

    /* สร้าง SVG ทั้งใบจากระเบียนรูป — หน้าบรีฟเรียกตัวนี้ตอนวาดสไลด์ */
    function buildSVG(rec) {
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 ' + rec.w + ' ' + rec.h);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
        (rec.annotations || []).forEach((a, i) => draw(svg, a, rec.w, rec.h, { index: i }));
        return svg;
    }

    /* ══════════════════════════════════════════════════════════════════
       ตัวแก้ไข — เปิดเป็นหน้าต่างเต็มจอ
       ══════════════════════════════════════════════════════════════════ */
    let styled = false;
    function injectStyle() {
        if (styled) return; styled = true;
        const s = document.createElement('style');
        s.textContent = `
.abz-back{position:fixed;inset:0;background:rgba(15,30,51,.88);z-index:9999;display:flex;flex-direction:column;
  font-family:'Sarabun',system-ui,sans-serif}
.abz-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px 14px;background:#0F1E33;color:#fff;flex:none}
.abz-bar .sp{margin-left:auto}
.abz-t{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22);color:#fff;border-radius:9px;
  padding:7px 13px;font-family:'Kanit',sans-serif;font-size:13px;cursor:pointer}
.abz-t.on{background:#E8A317;border-color:#E8A317;color:#0F1E33;font-weight:500}
.abz-t.go{background:#E8A317;border-color:#E8A317;color:#0F1E33;font-weight:500}
.abz-t.del{background:rgba(196,67,43,.9);border-color:transparent}
.abz-stage{flex:1;overflow:auto;display:flex;align-items:center;justify-content:center;padding:14px}
.abz-holder{position:relative;max-width:100%;max-height:100%;line-height:0;box-shadow:0 10px 40px rgba(0,0,0,.5)}
.abz-holder img{max-width:100%;max-height:calc(100vh - 150px);display:block}
.abz-holder svg{position:absolute;inset:0;width:100%;height:100%}
.abz-hint{color:#B9C7D6;font-size:12.5px;padding:0 14px 10px;font-family:'Kanit',sans-serif;flex:none}
.abz-holder.draw{cursor:crosshair}
.abz-holder g{cursor:move}
.abz-holder g.sel{outline:none}
`;
        document.head.appendChild(s);
    }

    /* เปิดตัวแก้ไข rec = ระเบียนจาก AscBriefStore · onSave(rec) เรียกเมื่อกดบันทึก */
    function open(rec, onSave) {
        injectStyle();
        let tool = 'label';
        let anns = JSON.parse(JSON.stringify(rec.annotations || []));
        let sel = -1;
        let drafting = null;      // สถานะระหว่างลากสร้างของใหม่
        let routePts = null;      // แนวท่อที่กำลังปักทีละจุด

        const back = document.createElement('div'); back.className = 'abz-back';
        const bar  = document.createElement('div'); bar.className = 'abz-bar';
        const stage= document.createElement('div'); stage.className = 'abz-stage';
        const hint = document.createElement('div'); hint.className = 'abz-hint';
        const holder = document.createElement('div'); holder.className = 'abz-holder draw';
        const img = document.createElement('img'); img.src = rec.dataUrl;
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 ' + rec.w + ' ' + rec.h);

        TOOLS.forEach(t => {
            const b = document.createElement('button');
            b.className = 'abz-t' + (t.id === tool ? ' on' : '');
            b.innerHTML = t.icon + ' ' + t.name;
            b.onclick = () => { tool = t.id; routePts = null; sel = -1;
                [...bar.querySelectorAll('.abz-t')].forEach(x => x.classList.remove('on'));
                b.classList.add('on'); redraw(); };
            bar.appendChild(b);
        });
        const spacer = document.createElement('span'); spacer.className = 'sp'; bar.appendChild(spacer);

        const bDel = document.createElement('button'); bDel.className = 'abz-t del'; bDel.textContent = '🗑 ลบที่เลือก';
        bDel.onclick = () => { if (sel >= 0) { anns.splice(sel, 1); sel = -1; redraw(); } };
        const bUndo = document.createElement('button'); bUndo.className = 'abz-t'; bUndo.textContent = '↩ ถอยหลัง';
        bUndo.onclick = () => { anns.pop(); sel = -1; redraw(); };
        const bCancel = document.createElement('button'); bCancel.className = 'abz-t'; bCancel.textContent = 'ยกเลิก';
        bCancel.onclick = close;
        const bSave = document.createElement('button'); bSave.className = 'abz-t go'; bSave.textContent = '✓ บันทึก';
        bSave.onclick = () => { rec.annotations = anns; close(); if (onSave) onSave(rec); };
        [bDel, bUndo, bCancel, bSave].forEach(b => bar.appendChild(b));

        holder.appendChild(img); holder.appendChild(svg);
        stage.appendChild(holder);
        back.appendChild(bar); back.appendChild(stage); back.appendChild(hint);
        document.body.appendChild(back);

        function setHint() {
            hint.textContent =
                tool === 'label' ? 'คลิกจุดที่ต้องการชี้ แล้วพิมพ์ข้อความ · ลากป้ายที่วางแล้วเพื่อย้าย'
              : tool === 'rect'  ? 'ลากคลุมบริเวณที่ต้องการเน้น'
              : tool === 'arrow' ? 'ลากจากท้ายลูกศรไปหาปลายที่ต้องการชี้'
              : tool === 'step'  ? 'คลิกเพื่อปักหมุดลำดับ เลขจะไล่ให้เอง'
              : 'คลิกทีละจุดตามแนวท่อ · ดับเบิลคลิกหรือกด Esc เพื่อจบเส้น';
        }

        /* หน้าจอ → พิกเซลของภาพจริง ต้องหารด้วยขนาดที่แสดงจริง ไม่ใช่ขนาดไฟล์ */
        function pt(ev) {
            const r = img.getBoundingClientRect();
            /* รูปที่ยังไม่ได้จัดวาง (แท็บซ่อนอยู่ หรือหน้าต่างกว้างศูนย์) ให้ขนาดเป็นศูนย์
               ถ้าหารต่อไปจะได้ NaN แล้วป้ายจะถูกบันทึกเป็นพิกัดเสียโดยไม่มีใครรู้ */
            if (!(r.width > 0) || !(r.height > 0)) return null;
            const cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
            const cy = (ev.touches ? ev.touches[0].clientY : ev.clientY) - r.top;
            return { x: Math.round(cx / r.width * rec.w), y: Math.round(cy / r.height * rec.h) };
        }

        function redraw() {
            while (svg.firstChild) svg.removeChild(svg.firstChild);
            anns.forEach((a, i) => {
                const g = draw(svg, a, rec.w, rec.h, { index: i, selected: i === sel });
                g.style.pointerEvents = 'auto';
                g.addEventListener('mousedown', ev => { ev.stopPropagation(); startMove(ev, i); });
            });
            if (drafting) draw(svg, drafting, rec.w, rec.h, {});
            if (routePts && routePts.length) draw(svg, { t: 'route', pts: routePts, style: tool }, rec.w, rec.h, {});
            setHint();
        }

        /* ลากย้ายทั้งชิ้น ทุกชนิดขยับพิกัดของตัวเองพร้อมกันทั้งหมด */
        function startMove(ev, i) {
            sel = i; redraw();
            const a = anns[i], p0 = pt(ev);
            if (!p0) return;
            const snap = JSON.parse(JSON.stringify(a));
            const move = e => {
                const p = pt(e); if (!p) return;
                const dx = p.x - p0.x, dy = p.y - p0.y;
                if (a.t === 'label') { a.x = snap.x + dx; a.y = snap.y + dy; a.tx = snap.tx + dx; a.ty = snap.ty + dy; }
                else if (a.t === 'arrow') { a.x1 = snap.x1 + dx; a.y1 = snap.y1 + dy; a.x2 = snap.x2 + dx; a.y2 = snap.y2 + dy; }
                else if (a.t === 'route') { a.pts = snap.pts.map(q => [q[0] + dx, q[1] + dy]); }
                else { a.x = snap.x + dx; a.y = snap.y + dy; }
                redraw();
            };
            const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
            document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
        }

        holder.addEventListener('mousedown', ev => {
            if (ev.target.closest('g')) return;      // แตะของเดิม = ย้าย ไม่ใช่สร้างใหม่
            const p = pt(ev);
            if (!p) return;
            sel = -1;

            if (tool === 'label') {
                const text = askText();
                if (!text) { redraw(); return; }
                // วางกล่องข้อความเยื้องขึ้นซ้าย ให้เห็นทั้งจุดที่ชี้และตัวป้าย
                anns.push({ t: 'label', x: p.x, y: p.y,
                            tx: Math.max(rec.w * 0.12, p.x - rec.w * 0.16),
                            ty: Math.max(rec.h * 0.07, p.y - rec.h * 0.13), text: text });
                redraw(); return;
            }
            if (tool === 'step') {
                // นับจากเลขสูงสุดที่มีอยู่ ไม่ใช่จำนวนหมุด ไม่งั้นลบหมุดกลางแล้วเลขจะซ้ำ
                const n = anns.reduce((mx, a) => a.t === 'step' ? Math.max(mx, a.n || 0) : mx, 0) + 1;
                anns.push({ t: 'step', x: p.x, y: p.y, n: n });
                redraw(); return;
            }
            if (tool === 'imc' || tool === 'pvc') {
                if (!routePts) routePts = [];
                routePts.push([p.x, p.y]);
                redraw(); return;
            }
            // arrow กับ rect สร้างด้วยการลาก
            drafting = tool === 'arrow'
                ? { t: 'arrow', x1: p.x, y1: p.y, x2: p.x, y2: p.y }
                : { t: 'rect',  x: p.x,  y: p.y,  w: 0,   h: 0 };
            const move = e => {
                const q = pt(e); if (!q) return;
                if (drafting.t === 'arrow') { drafting.x2 = q.x; drafting.y2 = q.y; }
                else { drafting.w = q.x - drafting.x; drafting.h = q.y - drafting.y; }
                redraw();
            };
            const up = () => {
                document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
                const big = drafting.t === 'arrow'
                    ? Math.hypot(drafting.x2 - drafting.x1, drafting.y2 - drafting.y1) > rec.w * 0.02
                    : Math.abs(drafting.w) > rec.w * 0.02 && Math.abs(drafting.h) > rec.h * 0.02;
                if (big) anns.push(drafting);     // กันเผลอคลิกแล้วได้ชิ้นจิ๋วที่มองไม่เห็น
                drafting = null; redraw();
            };
            document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
        });

        holder.addEventListener('dblclick', () => finishRoute());
        function finishRoute() {
            if (routePts && routePts.length >= 2) anns.push({ t: 'route', pts: routePts, style: tool });
            routePts = null; redraw();
        }

        /* กล่องพิมพ์ข้อความพร้อมชุดสำเร็จรูป — prompt ธรรมดาพอสำหรับงานนี้
           และไม่พาไลบรารีหน้าต่างซ้อนเข้ามาในหน้าที่ตั้งใจให้ไม่มี dependency */
        function askText() {
            const menu = PRESETS.map((p, i) => (i + 1) + '. ' + p).join('\n');
            const v = prompt('พิมพ์ข้อความป้าย หรือใส่เลขเพื่อเลือกจากรายการ\n\n' + menu, '');
            if (v == null) return '';
            const t = String(v).trim();
            if (/^\d+$/.test(t)) { const i = Number(t) - 1; return PRESETS[i] || ''; }
            return t;
        }

        function onKey(e) {
            if (e.key === 'Escape') { if (routePts) finishRoute(); else close(); }
            else if ((e.key === 'Delete' || e.key === 'Backspace') && sel >= 0) { anns.splice(sel, 1); sel = -1; redraw(); }
        }
        document.addEventListener('keydown', onKey);

        function close() {
            document.removeEventListener('keydown', onKey);
            back.remove();
        }

        img.onload = redraw;
        if (img.complete) redraw();
    }

    global.AscBriefAnnot = { open: open, buildSVG: buildSVG, draw: draw, PRESETS: PRESETS, TOOLS: TOOLS };
})(window);
