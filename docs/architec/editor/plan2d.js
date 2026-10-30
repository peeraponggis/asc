// กระดานวาด 2D (SVG) ของตัวเขียนแบบ pee_architec (โดย ลุงพี)
// เครื่องมือ: เลือก/ย้าย · ผนัง · ห้อง · กล่อง (push-pull) · ประตู · หน้าต่าง · เส้น · มิติ · ข้อความ · สัญลักษณ์ · ลบ
// จับจุด: กริด · ปลายผนัง/เส้น · ตั้งฉาก (Shift ปิด) · พิมพ์ระยะแล้ว Enter ระหว่างวาด (แบบ SketchUp)
import * as M from "./model.js?v=0.9.0";
import * as CAD from "./cadlayer.js?v=0.9.0";

const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
};

export class Plan2D {
  constructor(svg, host) {
    this.svg = svg; this.host = host;                 // host: { hist, onChange(), onSelect(sel), status(msg), vcb }
    this.scale = 0.05; this.ox = 0; this.oy = 0;       // px ต่อ มม. · จุดกำเนิดบนจอ
    this.tool = "select"; this.grid = 100; this.ortho = true; this.snapOn = true;
    this.draft = null; this.sel = null; this.hover = null; this.drag = null; this.symbol = null;
    // ไฟล์ CAD นำเข้าวาดบน canvas ใต้ SVG (เส้นนับแสนเส้นยังลื่น) — SVG ใช้กับสิ่งที่แก้ไขได้
    this.cv = document.createElement("canvas"); this.cv.className = "cadcanvas";
    svg.parentNode.insertBefore(this.cv, svg);
    this.layer = { bg: el("g", {}, svg), main: el("g", {}, svg), draft: el("g", {}, svg) };
    this._bind();
    this.resize();
  }

  get doc() { return this.host.hist.doc; }

  // ---------------------------------------------------------------- พิกัด
  toScreen(p) { return [this.ox + p[0] * this.scale, this.oy - p[1] * this.scale]; }
  toWorld(x, y) { return [(x - this.ox) / this.scale, (this.oy - y) / this.scale]; }
  resize() {
    const r = this.svg.getBoundingClientRect();
    this.w = r.width; this.h = r.height;
    this.dpr = window.devicePixelRatio || 1;
    this.cv.width = Math.round(this.w * this.dpr); this.cv.height = Math.round(this.h * this.dpr);
    if (!this._inited && this.w) { this.ox = this.w * 0.15; this.oy = this.h * 0.85; this._inited = true; }
    this.render();
  }
  fit() {
    const b = M.bounds(this.doc);
    if (!b) { this.scale = 0.05; this.ox = this.w * 0.15; this.oy = this.h * 0.85; return this.render(); }
    const pad = 60, bw = Math.max(b.x1 - b.x0, 1000), bh = Math.max(b.y1 - b.y0, 1000);
    this.scale = Math.min((this.w - 2 * pad) / bw, (this.h - 2 * pad) / bh);
    this.ox = pad + (this.w - 2 * pad - bw * this.scale) / 2 - b.x0 * this.scale;
    this.oy = this.h - pad - (this.h - 2 * pad - bh * this.scale) / 2 + b.y0 * this.scale;
    this.render();
  }
  setTool(t) {
    this.tool = t; this.draft = null; this.host.vcb("");
    this.svg.style.cursor = t === "select" ? "default" : t === "pan" ? "grab" : "crosshair";
    this.render();
    this.host.status(HELP[t] || "");
  }

  // ---------------------------------------------------------------- จับจุด
  snap(p, from, ev) {
    let best = null;
    const tol = 12 / this.scale;
    if (this.snapOn) {
      const pts = [];
      this.doc.walls.forEach((w) => pts.push(w.a, w.b));
      this.doc.lines.forEach((l) => pts.push(...l.pts));
      this.doc.masses.forEach((m) => pts.push(...m.pts));
      if (this.draft && this.draft.pts) pts.push(...this.draft.pts.slice(0, -1));
      for (const q of this.host.cadSnap ? this.host.cadSnap(p, tol) : []) pts.push(q);
      for (const q of pts) { const d = M.dist(p, q); if (d < tol && (!best || d < best.d)) best = { p: q.slice(), d, kind: "จุดปลาย" }; }
    }
    if (best) return best;
    let q = p.slice();
    if (from && this.ortho && !(ev && ev.shiftKey)) {
      const v = M.sub(p, from);
      const ang = Math.atan2(v[1], v[0]), step = Math.PI / 4;
      const a = Math.round(ang / step) * step, L = M.len(v);
      q = [from[0] + Math.cos(a) * L, from[1] + Math.sin(a) * L];
      const g = this.grid;
      if (g) { const L2 = Math.round(L / g) * g; q = [from[0] + Math.cos(a) * L2, from[1] + Math.sin(a) * L2]; }
      return { p: q.map((x) => Math.round(x)), kind: "ตั้งฉาก/45°" };
    }
    if (this.grid) q = q.map((x) => Math.round(x / this.grid) * this.grid);
    return { p: q, kind: "กริด" };
  }

  // ---------------------------------------------------------------- เลือก
  hit(p) {
    const tol = 8 / this.scale, d = this.doc;
    for (const o of d.openings) {
      const w = d.walls.find((x) => x.id === o.wall); if (!w) continue;
      const c = M.add(w.a, M.mul(M.sub(w.b, w.a), o.t));
      if (M.dist(p, c) < Math.max(o.width / 2, tol)) return { type: "openings", id: o.id };
    }
    for (const t of d.texts) if (M.dist(p, t.p) < Math.max((t.h || 250) * 2, tol)) return { type: "texts", id: t.id };
    for (const s of d.syms) if (M.dist(p, s.p) < Math.max(500 * (s.scale || 1), tol)) return { type: "syms", id: s.id };
    for (const x of d.dims) { const u = M.norm(M.sub(x.b, x.a)), n = M.mul(M.perp(u), x.offset ?? 600);
      if (M.projectOnSegment(p, M.add(x.a, n), M.add(x.b, n)).d < tol) return { type: "dims", id: x.id }; }
    for (const w of d.walls) if (M.projectOnSegment(p, w.a, w.b).d < Math.max(w.thick / 2, tol)) return { type: "walls", id: w.id };
    for (const l of d.lines) for (let i = 0; i < l.pts.length - (l.closed ? 0 : 1); i++)
      if (M.projectOnSegment(p, l.pts[i], l.pts[(i + 1) % l.pts.length]).d < tol) return { type: "lines", id: l.id };
    for (const m of d.masses) if (M.pointInPolygon(p, m.pts)) return { type: "masses", id: m.id };
    return null;
  }
  find(sel) { return sel ? (this.doc[sel.type] || []).find((x) => x.id === sel.id) : null; }
  select(sel) { this.sel = sel; this.host.onSelect(sel, this.find(sel)); this.render(); }

  deleteSelected() {
    if (!this.sel) return;
    const s = this.sel;
    this.host.hist.commit((d) => {
      d[s.type] = d[s.type].filter((x) => x.id !== s.id);
      if (s.type === "walls") d.openings = d.openings.filter((o) => o.wall !== s.id);
    });
    this.select(null); this.host.onChange();
  }

  // ---------------------------------------------------------------- เมาส์/คีย์บอร์ด
  _bind() {
    const sv = this.svg;
    const pos = (e) => { const r = sv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    sv.addEventListener("wheel", (e) => {
      e.preventDefault();
      const [x, y] = pos(e), k = Math.exp(-e.deltaY * 0.0015), w = this.toWorld(x, y);
      this.scale = Math.min(5, Math.max(0.002, this.scale * k));
      this.ox = x - w[0] * this.scale; this.oy = y + w[1] * this.scale;
      this.render();
    }, { passive: false });
    sv.addEventListener("pointerdown", (e) => {
      sv.setPointerCapture(e.pointerId);
      const [x, y] = pos(e);
      if (e.button === 1 || e.button === 2 || this.tool === "pan" || this._space) { this.drag = { pan: true, x, y, ox: this.ox, oy: this.oy }; return; }
      this._down(this.toWorld(x, y), e);
    });
    sv.addEventListener("pointermove", (e) => {
      const [x, y] = pos(e);
      if (this.drag && this.drag.pan) { this.ox = this.drag.ox + x - this.drag.x; this.oy = this.drag.oy + y - this.drag.y; return this.render(); }
      this._move(this.toWorld(x, y), e);
    });
    sv.addEventListener("pointerup", (e) => {
      if (this.drag && this.drag.pan) { this.drag = null; return; }
      this._up(this.toWorld(...pos(e)), e);
    });
    sv.addEventListener("dblclick", () => this.finish());
    sv.addEventListener("contextmenu", (e) => e.preventDefault());
    new ResizeObserver(() => this.resize()).observe(sv);
  }

  key(e) {
    if (e.key === " ") { this._space = e.type === "keydown"; return false; }
    if (e.type !== "keydown") return false;
    if (e.key === "Escape") { if (this.draft) { this.finish(); } else this.select(null); return true; }
    if (e.key === "Enter") {
      const v = this.host.vcb();
      if (v && this.draft) { this.typed(v); return true; }
      if (this.draft && this.draft.pts) this.finish();      // ห้อง/กล่อง/มิติ ที่ยังมีมุมเดียว: Enter เปล่าไม่ทิ้งร่าง
      return true;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && this.sel && !this.host.vcb()) { this.deleteSelected(); return true; }
    return false;
  }

  _down(p, e) {
    const t = this.tool, last = this.draft && this.draft.pts ? this.draft.pts[this.draft.pts.length - 2] : null;
    const s = this.snap(p, this.draft && this.draft.from ? this.draft.from : last, e).p;
    if (t === "select") {
      const h = this.hit(p);
      this.select(h);
      if (h) {
        const obj = this.find(h);
        const handle = h.type === "walls" ? (M.dist(p, obj.a) < 10 / this.scale + obj.thick / 2 ? "a" : M.dist(p, obj.b) < 10 / this.scale + obj.thick / 2 ? "b" : null) : null;
        this.drag = { sel: h, start: p, snap0: s, handle, before: JSON.stringify(this.doc), moved: false };
      }
      return;
    }
    if (t === "erase") { const h = this.hit(p); if (h) { this.sel = h; this.deleteSelected(); } return; }
    if (t === "wall" || t === "line") {
      if (!this.draft) this.draft = { kind: t, pts: [s, s] };
      else { this.draft.pts[this.draft.pts.length - 1] = s; this.draft.pts.push(s.slice()); }
      this.host.vcb("");
      return this.render();
    }
    if (t === "room" || t === "box" || t === "dim") {
      if (!this.draft) { this.draft = { kind: t, from: s, to: s }; return this.render(); }
      this.draft.to = s; return this.commitTwoPoint();
    }
    if (t === "door" || t === "window") return this.placeOpening(p, t);
    if (t === "text") {
      const str = prompt("ข้อความ"); if (!str) return;
      this.host.hist.commit((d) => d.texts.push({ id: M.uid("t"), p: s, s: str, h: 250 }));
      return this.host.onChange();
    }
    if (t === "symbol" && this.symbol) {
      const sym = this.symbol;
      this.host.hist.commit((d) => d.syms.push({ id: M.uid("s"), name: sym.name, svg: sym.svg, p: s, rot: 0, scale: 1, size: sym.size || 1000 }));
      return this.host.onChange();
    }
  }

  _move(p, e) {
    const last = this.draft && this.draft.pts ? this.draft.pts[this.draft.pts.length - 2] : this.draft && this.draft.from;
    const sn = this.snap(p, this.tool === "select" ? null : last, e);
    this.cursor = sn;
    if (this.drag && this.drag.sel) {
      const obj = this.find(this.drag.sel); if (!obj) return;
      const d = this.snap(M.sub(M.add(this.drag.snap0, M.sub(p, this.drag.start)), [0, 0]), null, e).p;
      const delta = M.sub(d, this.drag.snap0);
      if (!this.drag.moved && M.len(M.sub(p, this.drag.start)) < 4 / this.scale) return;
      if (!this.drag.moved) { this.host.hist.commit(() => {}); this.drag.moved = true; this.drag.orig = JSON.parse(JSON.stringify(obj)); }
      const o = this.drag.orig, typ = this.drag.sel.type;
      const mv = (q) => M.add(q, delta);
      if (typ === "walls") {
        if (this.drag.handle) obj[this.drag.handle] = this.snap(p, null, e).p;
        else { obj.a = mv(o.a); obj.b = mv(o.b); }
      } else if (typ === "masses" || typ === "lines") obj.pts = o.pts.map(mv);
      else if (typ === "dims") { obj.a = mv(o.a); obj.b = mv(o.b); }
      else if (typ === "texts" || typ === "syms") obj.p = mv(o.p);
      else if (typ === "openings") {
        const w = this.doc.walls.find((x) => x.id === obj.wall);
        if (w) obj.t = M.projectOnSegment(p, w.a, w.b).t;
      }
      this.render(); this.host.onSelect(this.sel, obj, true);
      return;
    }
    if (this.draft) {
      if (this.draft.pts) this.draft.pts[this.draft.pts.length - 1] = sn.p;
      else this.draft.to = sn.p;
      const a = this.draft.pts ? this.draft.pts[this.draft.pts.length - 2] : this.draft.from, b = sn.p;
      const L = M.dist(a, b);
      this.host.status(`${sn.kind} · ยาว ${Math.round(L).toLocaleString()} มม.` + (this.draft.from ? ` · ${Math.abs(b[0] - a[0]).toLocaleString()} × ${Math.abs(b[1] - a[1]).toLocaleString()}` : "") + " — พิมพ์ระยะแล้ว Enter ได้");
    } else this.host.status(`${sn.kind} · x ${Math.round(sn.p[0]).toLocaleString()} · y ${Math.round(sn.p[1]).toLocaleString()} มม.`);
    this.render();
  }

  _up() {
    if (this.drag && this.drag.sel) {
      if (this.drag.moved) this.host.onChange();
      this.drag = null;
    }
  }

  /** พิมพ์ระยะ (มม.) ระหว่างวาด — "3000" หรือ "4000,3000" สำหรับห้อง/กล่อง */
  typed(v) {
    const nums = v.split(/[,x×*\s]+/).map(Number).filter((n) => !isNaN(n) && n > 0);
    if (!nums.length) return;
    if (this.draft.pts) {
      const pts = this.draft.pts, a = pts[pts.length - 2], b = pts[pts.length - 1];
      const u = M.len(M.sub(b, a)) ? M.norm(M.sub(b, a)) : [1, 0];
      const q = M.add(a, M.mul(u, nums[0])).map((x) => Math.round(x));
      pts[pts.length - 1] = q; pts.push(q.slice());
    } else if (this.draft.from) {
      const a = this.draft.from, b = this.draft.to;
      const sx = Math.sign(b[0] - a[0]) || 1, sy = Math.sign(b[1] - a[1]) || 1;
      const w = nums[0], h = nums.length > 1 ? nums[1] : nums[0];
      this.draft.to = this.draft.kind === "dim" ? M.add(a, M.mul(M.len(M.sub(b, a)) ? M.norm(M.sub(b, a)) : [1, 0], w)) : [a[0] + sx * w, a[1] + sy * h];
      this.commitTwoPoint();
    }
    this.host.vcb("");
    this.render();
  }

  finish() {
    const d = this.draft; this.draft = null;
    if (d && d.pts) {
      const pts = d.pts.slice(0, -1).filter((p, i, a) => i === 0 || M.dist(p, a[i - 1]) > 1);
      if (pts.length >= 2) {
        const closed = pts.length > 2 && M.dist(pts[0], pts[pts.length - 1]) < 1;
        const P = closed ? pts.slice(0, -1) : pts;
        const cfg = this.host.defaults();
        this.host.hist.commit((doc) => {
          if (d.kind === "wall") {
            for (let i = 0; i < P.length - (closed ? 0 : 1); i++)
              doc.walls.push({ id: M.uid("w"), a: P[i], b: P[(i + 1) % P.length], thick: cfg.wallThick, height: cfg.wallHeight });
          } else doc.lines.push({ id: M.uid("l"), pts: P, closed });
        });
        this.host.onChange();
      }
    }
    this.host.vcb("");
    this.render();
  }

  commitTwoPoint() {
    const d = this.draft; this.draft = null;
    const a = d.from, b = d.to, cfg = this.host.defaults();
    if (M.dist(a, b) < 1) return this.render();
    this.host.hist.commit((doc) => {
      if (d.kind === "room") doc.walls.push(...M.rectWalls(a, b, cfg.wallThick, cfg.wallHeight));
      else if (d.kind === "box") {
        const [x0, x1] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])], [y0, y1] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])];
        doc.masses.push({ id: M.uid("m"), pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], base: 0, height: cfg.massHeight, name: "กล่อง" });
      } else if (d.kind === "dim") doc.dims.push({ id: M.uid("d"), a, b, offset: 600 });
    });
    this.host.onChange();
    this.render();
  }

  placeOpening(p, kind) {
    let best = null;
    for (const w of this.doc.walls) { const pr = M.projectOnSegment(p, w.a, w.b); if (pr.d < w.thick / 2 + 12 / this.scale && (!best || pr.d < best.pr.d)) best = { w, pr }; }
    if (!best) return this.host.status("คลิกบนผนังเพื่อวาง" + (kind === "door" ? "ประตู" : "หน้าต่าง"));
    const cfg = Object.assign({}, M.DEFAULTS[kind], this.host.defaults()[kind] || {});
    const L = M.wallLength(best.w), half = cfg.width / 2;
    const t = Math.min(1 - half / L, Math.max(half / L, best.pr.t));
    if (cfg.width >= L) return this.host.status("ผนังสั้นกว่าความกว้างช่องเปิด");
    this.host.hist.commit((d) => d.openings.push({ id: M.uid("o"), wall: best.w.id, kind, t, width: cfg.width, height: cfg.height, sill: cfg.sill }));
    this.host.onChange();
  }

  // ---------------------------------------------------------------- วาด
  render() {
    const L = this.layer, s = this.scale, d = this.doc;
    for (const g of Object.values(L)) g.textContent = "";
    this._grid();
    this._drawCad();
    // ชั้นนำเข้า: ภาพดาวเทียม → ภาพมุมบนของโมเดล ASC Studio → เส้นขอบอาคาร (อ้างอิง แก้ไม่ได้)
    const img = (b, cls) => { const [x, y] = this.toScreen([b.x, b.y]);
      el("image", { href: b.url, x, y, width: b.w * s, height: b.h * s, preserveAspectRatio: "none", class: cls, opacity: b.opacity ?? 1 }, L.bg); };
    if (d.backdrop && this.showBackdrop !== false) img(d.backdrop, "backdrop");
    if (d.imported && d.imported.top) img(d.imported.top, "ascTop");
    if (d.imported) for (const o of d.imported.outlines || []) {
      el("polygon", { points: o.pts.map((p) => this.toScreen(p).map((v) => v.toFixed(1)).join(",")).join(" "), class: "ascOutline" }, L.bg);
      const c = o.pts.reduce((a, q) => M.add(a, M.mul(q, 1 / o.pts.length)), [0, 0]), [cx, cy] = this.toScreen(c);
      el("text", { x: cx, y: cy, class: "ascLbl" }, L.bg).textContent = `${o.name} · ASC Studio`;
    }
    const ft = d.imported && d.imported.features;
    if (ft) {
      const pts = (a) => a.map((p) => this.toScreen(p).map((v) => v.toFixed(1)).join(",")).join(" ");
      const lbl = (p, txt, cls) => { const [x, y] = this.toScreen(p); el("text", { x, y, class: cls || "ascLbl2" }, L.bg).textContent = txt; };
      for (const t of ft.trees) { const [x, y] = this.toScreen(t.c); el("circle", { cx: x, cy: y, r: Math.max(2, t.r * s), class: "ascTree" }, L.bg); lbl(t.c, t.name); }
      for (const o of ft.obstacles) { el("polygon", { points: pts(o.pts), class: "ascObst" }, L.bg); lbl(o.pts[0], o.name); }
      for (const w of ft.walls) el("polyline", { points: pts(w.pts), class: "ascWall", "stroke-width": Math.max(1.5, w.t * s) }, L.bg);
      for (const r of ft.routes) el("polyline", { points: pts(r.pts), class: "ascRoute " + (r.kind === "ac" ? "ac" : "dc") }, L.bg);
      for (const e of ft.equipment) { el("polygon", { points: pts(e.pts), class: "ascEquip" }, L.bg); lbl(e.pts[2], e.name); }
    }
    const P = (p) => this.toScreen(p).map((v) => v.toFixed(1)).join(",");
    const isSel = (type, id) => this.sel && this.sel.type === type && this.sel.id === id;
    // กล่อง (มวล push-pull)
    for (const m of d.masses) {
      el("polygon", { points: m.pts.map(P).join(" "), class: "mass" + (isSel("masses", m.id) ? " sel" : "") }, L.main);
      const c = m.pts.reduce((a, q) => M.add(a, M.mul(q, 1 / m.pts.length)), [0, 0]);
      const [x, y] = this.toScreen(c);
      el("text", { x, y, class: "lbl" }, L.main).textContent = `${m.name || "กล่อง"} สูง ${Math.round(m.height).toLocaleString()}`;
    }
    // ผนัง
    for (const w of d.walls) el("polygon", { points: M.wallPolygon(w).map(P).join(" "), class: "wall" + (isSel("walls", w.id) ? " sel" : "") }, L.main);
    // ช่องเปิด
    for (const w of d.walls) {
      const u = M.norm(M.sub(w.b, w.a)), n = M.mul(M.perp(u), w.thick / 2);
      for (const { o, s0, s1 } of M.openingSpans(d, w)) {
        const at = (k) => M.add(w.a, M.mul(u, k));
        el("polygon", { points: [M.add(at(s0), n), M.add(at(s1), n), M.sub(at(s1), n), M.sub(at(s0), n)].map(P).join(" "), class: "gap" + (isSel("openings", o.id) ? " sel" : "") }, L.main);
        if (o.kind === "door") {
          const hinge = M.add(at(s0), n), r = s1 - s0, leaf = M.add(hinge, M.mul(M.perp(u), r));
          el("line", { x1: this.toScreen(hinge)[0], y1: this.toScreen(hinge)[1], x2: this.toScreen(leaf)[0], y2: this.toScreen(leaf)[1], class: "door" }, L.main);
          const e = this.toScreen(M.add(at(s1), n));
          el("path", { d: `M${P(leaf)} A${(r * s).toFixed(1)},${(r * s).toFixed(1)} 0 0 1 ${e[0].toFixed(1)},${e[1].toFixed(1)}`, class: "swing" }, L.main);
        } else {
          for (const k of [-0.5, 0, 0.5]) {
            const a = this.toScreen(M.add(at(s0), M.mul(n, k))), b = this.toScreen(M.add(at(s1), M.mul(n, k)));
            el("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: "glass" }, L.main);
          }
        }
      }
    }
    for (const l of d.lines) el(l.closed ? "polygon" : "polyline", { points: l.pts.map(P).join(" "), class: "line" + (isSel("lines", l.id) ? " sel" : "") }, L.main);
    for (const x of d.dims) this._dim(x, L.main, isSel("dims", x.id));
    for (const t of d.texts) {
      const [x, y] = this.toScreen(t.p);
      el("text", { x, y, class: "txt" + (isSel("texts", t.id) ? " sel" : ""), "font-size": Math.max(9, (t.h || 250) * s * 1.35) }, L.main).textContent = t.s;
    }
    for (const sy of d.syms) {
      const size = (sy.size || 1000) * (sy.scale || 1) * s, [x, y] = this.toScreen(sy.p);
      const img = el("image", { href: "../" + sy.svg, x: x - size / 2, y: y - size / 2, width: size, height: size, class: isSel("syms", sy.id) ? "sel" : "" }, L.main);
      if (sy.rot) img.setAttribute("transform", `rotate(${-sy.rot} ${x} ${y})`);
    }
    // ด้ามจับปลายผนังที่เลือก
    const sw = this.sel && this.sel.type === "walls" && this.find(this.sel);
    if (sw) for (const q of [sw.a, sw.b]) { const [x, y] = this.toScreen(q); el("rect", { x: x - 4, y: y - 4, width: 8, height: 8, class: "handle" }, L.main); }
    // ร่าง
    if (this.draft) {
      const dr = this.draft;
      if (dr.pts) {
        if (dr.kind === "wall") {
          const th = this.host.defaults().wallThick;
          for (let i = 0; i < dr.pts.length - 1; i++) if (M.dist(dr.pts[i], dr.pts[i + 1]) > 1)
            el("polygon", { points: M.wallPolygon({ a: dr.pts[i], b: dr.pts[i + 1], thick: th }).map(P).join(" "), class: "wall draft" }, L.draft);
        } else el("polyline", { points: dr.pts.map(P).join(" "), class: "line draft" }, L.draft);
      } else if (dr.kind === "dim") this._dim({ a: dr.from, b: dr.to, offset: 600 }, L.draft, false);
      else {
        const a = this.toScreen(dr.from), b = this.toScreen(dr.to);
        el("rect", { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), width: Math.abs(b[0] - a[0]), height: Math.abs(b[1] - a[1]), class: dr.kind === "room" ? "wall draft" : "mass draft" }, L.draft);
      }
    }
    if (this.cursor && this.tool !== "select" && this.tool !== "pan") {
      const [x, y] = this.toScreen(this.cursor.p);
      el("circle", { cx: x, cy: y, r: this.cursor.kind === "จุดปลาย" ? 6 : 3, class: this.cursor.kind === "จุดปลาย" ? "snap end" : "snap" }, L.draft);
    }
    this._north();
  }

  _drawCad() {
    const ctx = this.cv.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.cv.width, this.cv.height);
    const ink = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#1d2733";
    for (const { ref, built } of this.host.cads()) if (built && !ref.off) CAD.draw(ctx, ref, built, { scale: this.scale, ox: this.ox, oy: this.oy, dpr: this.dpr }, ink);
  }

  _dim(x, g, sel) {
    const u = M.norm(M.sub(x.b, x.a)), n = M.mul(M.perp(u), x.offset ?? 600);
    const a = M.add(x.a, n), b = M.add(x.b, n), S = (p) => this.toScreen(p);
    const cls = "dim" + (sel ? " sel" : "");
    for (const [p, q] of [[x.a, a], [x.b, b], [a, b]]) el("line", { x1: S(p)[0], y1: S(p)[1], x2: S(q)[0], y2: S(q)[1], class: cls }, g);
    for (const p of [a, b]) { const t1 = S(M.add(p, M.mul(M.add(u, M.perp(u)), 80))), t2 = S(M.sub(p, M.mul(M.add(u, M.perp(u)), 80)));
      el("line", { x1: t1[0], y1: t1[1], x2: t2[0], y2: t2[1], class: cls + " tick" }, g); }
    const m = S(M.add(M.mul(M.add(a, b), 0.5), M.mul(M.perp(u), 120)));
    let ang = (-Math.atan2(u[1], u[0]) * 180) / Math.PI; if (ang > 90 || ang < -90) ang += 180;
    el("text", { x: m[0], y: m[1], class: "dimtxt", transform: `rotate(${ang} ${m[0]} ${m[1]})` }, g).textContent = Math.round(M.dist(x.a, x.b)).toLocaleString();
  }

  _grid() {
    const g = this.layer.bg, s = this.scale;
    el("rect", { x: 0, y: 0, width: this.w, height: this.h, class: "paper" }, g);
    let step = 100; while (step * s < 8) step *= 10;
    for (const [k, cls] of [[step, "g1"], [step * 10, "g2"]]) {
      const [wx0, wy1] = this.toWorld(0, 0), [wx1, wy0] = this.toWorld(this.w, this.h);
      if ((wx1 - wx0) / k > 400) continue;
      for (let x = Math.floor(wx0 / k) * k; x <= wx1; x += k) { const X = this.toScreen([x, 0])[0]; el("line", { x1: X, y1: 0, x2: X, y2: this.h, class: cls }, g); }
      for (let y = Math.floor(wy0 / k) * k; y <= wy1; y += k) { const Y = this.toScreen([0, y])[1]; el("line", { x1: 0, y1: Y, x2: this.w, y2: Y, class: cls }, g); }
    }
    const o = this.toScreen([0, 0]);
    el("line", { x1: o[0] - 10, y1: o[1], x2: o[0] + 30, y2: o[1], class: "axis x" }, g);
    el("line", { x1: o[0], y1: o[1] + 10, x2: o[0], y2: o[1] - 30, class: "axis y" }, g);
    el("text", { x: 10, y: this.h - 10, class: "scale" }, g).textContent = `กริด ${step.toLocaleString()} มม.`;
  }

  _north() {
    const n = (this.doc.site.north || 0) * Math.PI / 180, cx = this.w - 34, cy = 40, g = el("g", { class: "north" }, this.layer.draft);
    const tip = [cx + Math.sin(-n) * 18, cy - Math.cos(-n) * 18], l = [cx + Math.sin(-n + 2.6) * 12, cy - Math.cos(-n + 2.6) * 12], r = [cx + Math.sin(-n - 2.6) * 12, cy - Math.cos(-n - 2.6) * 12];
    el("circle", { cx, cy, r: 20 }, g);
    el("polygon", { points: [tip, l, [cx, cy], r].map((p) => p.join(",")).join(" ") }, g);
    el("text", { x: tip[0], y: tip[1] - 6 }, g).textContent = "N";
  }
}

const HELP = {
  select: "คลิกเลือก · ลากเพื่อย้าย · ลากปลายผนังเพื่อยืด · Delete ลบ · ล้อเมาส์ซูม · คลิกขวา/กลางลากเลื่อนจอ",
  wall: "คลิกจุดเริ่ม แล้วคลิกต่อไปเรื่อย ๆ · พิมพ์ระยะ (มม.) แล้ว Enter · ดับเบิลคลิก/Esc จบ · Shift = ไม่ล็อกมุม",
  room: "คลิก 2 มุมของห้อง หรือคลิกมุมแรกแล้วพิมพ์ 4000,3000 Enter",
  box: "กล่องสำหรับ push-pull: คลิก 2 มุม (หรือพิมพ์ กว้าง,ยาว) แล้วไปดึงความสูงในมุมมอง 3D",
  door: "คลิกบนผนังเพื่อวางประตู (ตั้งความกว้างในแผงขวา)",
  window: "คลิกบนผนังเพื่อวางหน้าต่าง",
  line: "เส้นช่วย: คลิกต่อเนื่อง · ดับเบิลคลิกจบ",
  dim: "เส้นบอกระยะ: คลิก 2 จุด",
  text: "คลิกตำแหน่งแล้วพิมพ์ข้อความ",
  symbol: "เลือกสัญลักษณ์จากรายการซ้าย แล้วคลิกวาง",
  erase: "คลิกสิ่งที่ต้องการลบ",
  pan: "ลากเพื่อเลื่อนจอ",
};
