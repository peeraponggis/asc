// เครื่องมือ 3D ชุดเต็มแบบ SketchUp (0.23.0 · โดย ลุงพี) — ต่อจาก sketch3d.js (เลือก push-pull สี่เหลี่ยม ย้าย หมุน ทาสี ตลับเมตร)
// วาด: เส้น วาดอิสระ สี่เหลี่ยมหมุน วงกลม หลายเหลี่ยม โค้ง (ศูนย์กลาง · 2 จุด · 3 จุด) พาย → รูปปิด = หน้า (Face) ดึงด้วย Push/Pull ได้ · เส้นเปิด = เส้นในผัง
// แก้: ยางลบ Tag ย่อขยาย Offset Follow Me (กวาดหน้าตัดตามเส้น) · ใส่ข้อมูล: มิติ 3D ไม้โปรแทรกเตอร์ ข้อความชี้ แกน ข้อความ 3D
// กล้อง: ซูมกรอบ เดิน (WASD/ลูกศร) · ชิ้นส่วน: วางต้นไม้ รถ ฯลฯ · คัดลอก/ตัด/วาง · ทุกการแก้ผ่าน hist.commit (Ctrl+Z ได้)
import * as THREE from "three";
import * as M from "./model.js?v=0.23.0";
import { kindTh, KINDS } from "./props3d.js?v=0.23.0";

const MM = 0.001;
const snap = (v, s = 50) => Math.round(v / s) * s;
const toPlan = (P) => [Math.round(P.x / MM), Math.round(-P.z / MM)];
const v3 = (p, z = 0) => new THREE.Vector3(p[0] * MM, z * MM, -p[1] * MM);
/** วงกลมผ่าน 3 จุด (ผัง) → {c, r} หรือ null ถ้าอยู่แนวเดียวกัน */
function circle3(a, b, c) {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1])); if (Math.abs(d) < 1e-6) return null;
  const s = (p) => p[0] * p[0] + p[1] * p[1];
  const ux = (s(a) * (b[1] - c[1]) + s(b) * (c[1] - a[1]) + s(c) * (a[1] - b[1])) / d, uy = (s(a) * (c[0] - b[0]) + s(b) * (a[0] - c[0]) + s(c) * (b[0] - a[0])) / d;
  return { c: [ux, uy], r: Math.hypot(a[0] - ux, a[1] - uy) };
}
const ang = (c, p) => Math.atan2(p[1] - c[1], p[0] - c[0]);
/** จุดบนโค้งจากมุม a0 ไป a1 (ทิศ dir = +1 ทวนเข็ม / −1 ตามเข็ม) */
function arcPts(c, r, a0, a1, dir, seg = 24) {
  let sweep = a1 - a0; if (dir > 0) { while (sweep <= 0) sweep += Math.PI * 2; } else { while (sweep >= 0) sweep -= Math.PI * 2; }
  const n = Math.max(4, Math.ceil((Math.abs(sweep) / (Math.PI * 2)) * seg * 2));
  return Array.from({ length: n + 1 }, (_, i) => { const t = a0 + (sweep * i) / n; return [Math.round(c[0] + r * Math.cos(t)), Math.round(c[1] + r * Math.sin(t))]; });
}
/** โค้งผ่าน 3 จุด a → m → b */
function arcThrough(a, m, b) {
  const C = circle3(a, m, b); if (!C) return [a, b];
  const a0 = ang(C.c, a), a1 = ang(C.c, b), am = ang(C.c, m), norm = (x) => ((x % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const dir = norm(am - a0) < norm(a1 - a0) ? 1 : -1; return arcPts(C.c, C.r, a0, a1, dir);
}
/** ขยับรูปหลายเหลี่ยมเข้า/ออก d มม. (+ = ออก) */
function offsetPoly(pts, d) {
  const n = pts.length, ccw = M.polygonArea(pts) > 0, out = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    const e1 = M.norm(M.sub(p1, p0)), e2 = M.norm(M.sub(p2, p1)), n1 = ccw ? [e1[1], -e1[0]] : [-e1[1], e1[0]], n2 = ccw ? [e2[1], -e2[0]] : [-e2[1], e2[0]];
    const bis = M.norm([n1[0] + n2[0], n1[1] + n2[1]]), k = d / Math.max(0.2, bis[0] * n2[0] + bis[1] * n2[1]);
    out.push([Math.round(p1[0] + bis[0] * k), Math.round(p1[1] + bis[1] * k)]);
  }
  return out;
}

export const SETTINGS = { polySides: 6, sweepW: 200, sweepH: 200, text3dH: 600, textH: 250, dimText: 250, compRandom: true, compScale: 1, curTag: "masses" };

export class Tools3D {
  constructor(view, sk, host) {
    this.v = view; this.sk = sk; this.host = host; this.pts = []; this.st = null; this.clip = null; this.itemSel = new Set(); this.placing = null;
    sk.ext = this; this.ray = new THREE.Raycaster(); this.ray.params.Line.threshold = 0.15;
    this.prot = document.createElement("div"); this.prot.className = "tape-label"; this.prot.hidden = true; view.canvas.parentNode.appendChild(this.prot);
    this.zbox = document.createElement("div"); this.zbox.className = "zoombox"; this.zbox.hidden = true; view.canvas.parentNode.appendChild(this.zbox);
    view.canvas.addEventListener("dblclick", (e) => { if (["line", "arc", "arc2", "arc3"].includes(sk.tool)) { e.preventDefault(); this.finish(); } });
    addEventListener("keydown", (e) => this.walkKey(e));
    const prev = view.onBuilt; view.onBuilt = () => { prev && prev(); this.decorate(); };
  }
  get doc() { return this.host.hist.doc; }
  get tool() { return this.sk.tool; }
  busy() { return this.pts.length > 0 || !!this.st; }
  commit(fn, msg) { this.host.hist.commit(fn); this.host.onChange(); if (msg) this.host.status(msg); }
  reset() { this.pts = []; this.st = null; this.sk.clearOver(); this.prot.hidden = true; this.zbox.hidden = true; }

  // ---------------------------------------------------------------- ยิงเมาส์ + จับจุด
  ndc(e) { const r = this.v.canvas.getBoundingClientRect(); return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); }
  hitAny(e, filter) {
    this.ray.setFromCamera(this.ndc(e), this.v.camera);
    const objs = [...this.v.model.children, ...this.v.notes.children];
    const h = this.ray.intersectObjects(objs, true).find((x) => {
      const o = x.object, u = o.userData || {};
      if (o.isLineSegments && o.parent && o.parent.isMesh) return false;          // เส้นขอบของรูปแบบเส้น
      if (!o.visible || !(o.isMesh || o.isLine || o.isSprite) || !u.type) return false;
      return !filter || filter(u);
    });
    if (!h) return null;
    const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
    return { ...h, n, type: h.object.userData.type, id: h.object.userData.id };
  }
  /** จุดยอดใกล้เมาส์ (≤ 12 px): มุมกล่องบน/ล่าง · จุดของเส้น · ฐานชิ้นส่วน */
  vsnap(e) {
    const r = this.v.canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, cam = this.v.camera, cands = [];
    for (const m of this.doc.masses) for (const p of m.pts) { cands.push([p, m.base || 0]); cands.push([p, (m.base || 0) + m.height]); }
    for (const l of this.doc.lines) for (const p of l.pts) cands.push([p, l.z || 0]);
    for (const p of this.pts) cands.push([p.p, p.z]);
    let best = null, bd = 12;
    for (const [p, z] of cands) {
      const q = v3(p, z).project(cam); if (q.z > 1) continue;
      const d = Math.hypot(((q.x + 1) / 2) * r.width - mx, ((1 - q.y) / 2) * r.height - my); if (d < bd) { bd = d; best = { p: p.slice(), z }; }
    }
    return best;
  }
  /** จุดสำหรับวาด: จุดยอด → ระนาบที่เริ่มวาด → ผิวบนของกล่อง → พื้น (จับกริด 50 มม.) */
  point(e) {
    const s = this.vsnap(e); if (s) return { ...s, snap: true };
    this.ray.setFromCamera(this.ndc(e), this.v.camera);
    if (this.planeZ == null) {
      const h = this.hitAny(e, (u) => u.type === "masses");
      if (h && h.n.y > 0.9) { this.planeZ = Math.round(h.point.y / MM); }
      else this.planeZ = 0;
    }
    const P = new THREE.Vector3(); if (!this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.planeZ * MM), P)) return null;
    const p = toPlan(P); return { p: [snap(p[0]), snap(p[1])], z: this.planeZ };
  }
  showPts(list, closed, color = 0xe8892b) {
    this.sk.clearOver(); if (list.length < 2) return;
    const pts = list.map((q) => v3(q.p || q, q.z ?? this.planeZ ?? 0)); if (closed) pts.push(pts[0]);
    this.sk.over.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, depthTest: false })));
  }

  // ---------------------------------------------------------------- เมาส์ (เรียกจาก sketch3d.js ก่อนเครื่องมือเดิม · คืน true = จัดการแล้ว)
  down(e) {
    const t = this.tool; if (e.button !== 0) return false;
    const own = () => { e.stopImmediatePropagation(); this.v.controls.enabled = false; };
    // ชิ้นส่วนในฉาก: เลือก/ย้าย/หมุน/ลบ ได้แบบเดียวกับกล่อง
    if (["select", "move", "rotate", "eraser", "scale", "tagtool", "paint"].includes(t)) {
      const h = this.hitAny(e, (u) => ["masses", "items", "lines", "texts3d", "dims3d", "sweeps", "walls", "roof", "openings"].includes(u.type));
      if (h && h.type === "items") return this.onItem(e, t, h, own);
      if (h && t === "eraser") { own(); this.erase(h); return true; }
      if (h && t === "tagtool" && ["masses", "sweeps"].includes(h.type)) { own(); this.tagObj(h); return true; }
      if (h && t === "paint" && h.type === "sweeps") { own(); const mat = this.sk.mat; this.commit((d) => { const s = d.sweeps.find((x) => x.id === h.id); if (s) s.mat = mat; }); return true; }
      if (t === "select" && !e.shiftKey && this.itemSel.size) { this.itemSel.clear(); }
      if (t === "scale" && h && h.type === "masses") { own(); return this.scaleStart(e, h); }
      if (t === "eraser" || t === "tagtool") { e.stopImmediatePropagation(); return true; }
      return false;
    }
    if (t === "place") {
      const p = this.point(e); this.planeZ = null; if (!p) return true; own();
      const kind = this.placing, it = { id: M.uid("i"), kind, p: p.p, z: p.z, rot: SETTINGS.compRandom ? Math.round(Math.random() * 360) : 0, s: +(SETTINGS.compScale * (SETTINGS.compRandom ? 0.9 + Math.random() * 0.25 : 1)).toFixed(2) };
      this.commit((d) => d.items3d.push(it), `วาง${kindTh(kind)}แล้ว — คลิกวางต่อได้ · Esc จบ`);
      return true;
    }
    if (["line", "rrect", "circle", "polygon", "arc", "arc2", "arc3", "pie", "dim", "protractor", "axes"].includes(t)) {
      const p = this.point(e); if (!p) return true; own(); this.click(t, p); return true;
    }
    if (t === "freehand") { const p = this.point(e); if (!p) return true; own(); this.v.canvas.setPointerCapture(e.pointerId); this.st = { kind: "free", list: [p] }; return true; }
    if (t === "offset") { const h = this.hitAny(e, (u) => u.type === "masses"); if (!h || h.n.y < 0.9) { this.host.status("Offset: คลิกที่หน้าบนของกล่อง/หน้า แล้วลากเข้า/ออก"); e.stopImmediatePropagation(); return true; } own(); const m = this.doc.masses.find((x) => x.id === h.id); this.st = { kind: "offset", m, p0: toPlan(h.point), y: h.point.y }; return true; }
    if (t === "follow") {
      const h = this.hitAny(e, (u) => u.type === "lines"); e.stopImmediatePropagation();
      if (!h) { this.host.status("Follow Me: คลิกที่เส้น (วาดด้วยเครื่องมือ เส้น/โค้ง) — หน้าตัด กว้าง×สูง ตามช่องระยะ เช่น 200x300"); return true; }
      const l = this.doc.lines.find((x) => x.id === h.id); if (!l) return true;
      const sw = { id: M.uid("s"), pts: l.pts.map((q) => q.slice()), closed: !!l.closed, z: l.z || 0, w: SETTINGS.sweepW, h: SETTINGS.sweepH, mat: this.sk.mat };
      this.commit((d) => d.sweeps.push(sw), `Follow Me: กวาดหน้าตัด ${sw.w}×${sw.h} มม. ตามเส้น ${l.pts.length} จุด · วัสดุ ${sw.mat}`);
      return true;
    }
    if (t === "text" || t === "text3d") {
      const h = this.hitAny(e, (u) => ["masses", "walls", "roof", "items", "sweeps", "slab"].includes(u.type)); e.stopImmediatePropagation();
      const P = h ? h.point : (() => { this.ray.setFromCamera(this.ndc(e), this.v.camera); const q = new THREE.Vector3(); return this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), q) ? q : null; })();
      if (!P) return true;
      let def = "ข้อความ";
      if (h && h.type === "masses") { const m = this.doc.masses.find((x) => x.id === h.id); if (m) def = `${m.name || "กล่อง"} ${(Math.abs(M.polygonArea(m.pts)) / 1e6).toFixed(2)} ตร.ม.`; }
      else if (h && h.type === "items") def = h.object.userData.name || def;
      const s = prompt(t === "text" ? "ข้อความชี้ (Text)" : "ข้อความ 3D", t === "text" ? def : "ASC Architect"); if (!s) return true;
      const p = toPlan(P), z = Math.round(P.y / MM);
      const yaw = Math.round((Math.atan2(this.v.camera.position.x - P.x, this.v.camera.position.z - P.z) * 180) / Math.PI);
      const rec = t === "text" ? { id: M.uid("x"), kind: "label", s, p, z, at: [p[0] + 600, p[1]], atz: z + 900, h: SETTINGS.textH } : { id: M.uid("x"), kind: "3d", s, p, z, h: SETTINGS.text3dH, rot: yaw };
      this.commit((d) => d.texts3d.push(rec), t === "text" ? "ใส่ข้อความชี้แล้ว" : "ใส่ข้อความ 3D แล้ว (ตั้งหันหาผู้มอง · ทอดเงาได้)");
      return true;
    }
    if (t === "zoomwin") { own(); const r = this.v.canvas.getBoundingClientRect(); this.st = { kind: "zoom", x0: e.clientX - r.left, y0: e.clientY - r.top }; this.v.canvas.setPointerCapture(e.pointerId); return true; }
    return false;
  }
  move(e) {
    const t = this.tool, st = this.st;
    if (st && st.kind === "item") { e.stopImmediatePropagation(); const P = this.planeAt(e, st.y); if (!P) return true; const q = toPlan(P); st.it.p = [snap(st.orig[0] + q[0] - st.p0[0]), snap(st.orig[1] + q[1] - st.p0[1])]; this.v.build(); this.host.status(`ย้าย${kindTh(st.it.kind)} ${st.it.p[0] - st.orig[0]}, ${st.it.p[1] - st.orig[1]} มม.`); return true; }
    if (st && st.kind === "scale") { e.stopImmediatePropagation(); const k = Math.max(0.05, Math.round((1 + (e.clientX - st.x0) / 200) * 20) / 20); this.applyScale(st, k); return true; }
    if (st && st.kind === "free") { e.stopImmediatePropagation(); const p = this.point(e); if (p && M.dist(p.p, st.list[st.list.length - 1].p) > 100) { st.list.push(p); this.showPts(st.list, false); } return true; }
    if (st && st.kind === "offset") {
      e.stopImmediatePropagation(); const P = this.planeAt(e, st.y); if (!P) return true;
      const q = toPlan(P), c = st.m.pts.reduce((s, p) => [s[0] + p[0] / st.m.pts.length, s[1] + p[1] / st.m.pts.length], [0, 0]);
      st.d = snap(M.dist(q, c) - M.dist(st.p0, c), 10); st.poly = offsetPoly(st.m.pts, st.d);
      this.showPts(st.poly.map((p) => ({ p, z: Math.round(st.y / MM) })), true); this.host.status(`Offset ${st.d > 0 ? "ออก" : "เข้า"} ${Math.abs(st.d).toLocaleString()} มม. (พิมพ์ระยะ + Enter ได้)`); return true;
    }
    if (st && st.kind === "zoom") { e.stopImmediatePropagation(); const r = this.v.canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; Object.assign(this.zbox.style, { left: Math.min(x, st.x0) + "px", top: Math.min(y, st.y0) + "px", width: Math.abs(x - st.x0) + "px", height: Math.abs(y - st.y0) + "px" }); this.zbox.hidden = false; st.x1 = x; st.y1 = y; return true; }
    if (this.pts.length && ["line", "rrect", "circle", "polygon", "arc", "arc2", "arc3", "pie", "dim", "protractor", "axes"].includes(t)) { const p = this.point(e); if (p) this.preview(t, p); return true; }
    return false;
  }
  up(e) {
    const st = this.st; if (!st) return false;
    e.stopImmediatePropagation(); this.v.controls.enabled = true;
    if (st.kind === "item" || st.kind === "scale") { this.st = null; this.host.onChange(); return true; }
    if (st.kind === "free") {
      this.st = null; const L = st.list; this.sk.clearOver(); if (L.length < 2) return true;
      const closed = L.length > 3 && M.dist(L[0].p, L[L.length - 1].p) < 400;
      this.makeShape(L.map((q) => q.p), closed, L[0].z); this.planeZ = null; return true;
    }
    if (st.kind === "offset") {
      this.st = null; this.sk.clearOver(); if (!st.poly || !st.d) return true;
      const m = st.m, f = { id: M.uid("m"), name: "หน้า Offset", pts: st.poly, base: (m.base || 0) + m.height, height: 1, mat: m.mat };
      this.commit((d) => d.masses.push(f), `Offset ${st.d} มม. → หน้าใหม่บนกล่อง (ใช้ Push/Pull ดึงขึ้น/กดลงได้)`); return true;
    }
    if (st.kind === "zoom") {
      this.st = null; this.zbox.hidden = true; if (st.x1 == null || Math.abs(st.x1 - st.x0) < 8) return true;
      const r = this.v.canvas.getBoundingClientRect(), cx = (st.x0 + st.x1) / 2, cy = (st.y0 + st.y1) / 2;
      const fake = { clientX: r.left + cx, clientY: r.top + cy }, h = this.hitAny(fake);
      let tgt = h && h.point; if (!tgt) { this.ray.setFromCamera(this.ndc(fake), this.v.camera); tgt = new THREE.Vector3(); if (!this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), tgt)) return true; }
      const k = Math.max(Math.abs(st.x1 - st.x0) / r.width, Math.abs(st.y1 - st.y0) / r.height), cam = this.v.camera, dir = cam.position.clone().sub(tgt), dist = Math.max(1, dir.length() * k);
      this.v.flyTo(tgt.clone().add(dir.normalize().multiplyScalar(dist)), tgt); this.host.status("ซูมกรอบแล้ว · มุมก่อนหน้า = ย้อนกลับ"); return true;
    }
    this.st = null; return true;
  }
  planeAt(e, y) { this.ray.setFromCamera(this.ndc(e), this.v.camera); const P = new THREE.Vector3(); return this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), P) ? P : null; }

  // ---------------------------------------------------------------- ชิ้นส่วน
  onItem(e, t, h, own) {
    const it = this.doc.items3d.find((x) => x.id === h.id); if (!it) return false;
    own(); if (t !== "move" && t !== "scale") this.v.controls.enabled = true;
    if (t === "eraser") { this.erase(h); return true; }
    if (t === "tagtool") { const tag = SETTINGS.curTag; this.commit((d) => { const x = d.items3d.find((q) => q.id === it.id); if (x) x.tag = tag; }); return true; }
    if (t === "paint") { this.host.status("ชิ้นส่วนใช้วัสดุของตัวเอง (ต้นไม้ รถ) — ทาสีได้เฉพาะกล่อง ผนัง หลังคา หน้าตัดกวาด"); return true; }
    if (t === "rotate") { this.commit((d) => { const x = d.items3d.find((q) => q.id === it.id); if (x) x.rot = ((x.rot || 0) + (e.shiftKey ? -15 : 15) + 360) % 360; }, `หมุน${kindTh(it.kind)} 15°`); return true; }
    if (t === "select") { if (!e.shiftKey) { this.itemSel.clear(); this.sk.sel.clear(); } this.itemSel.has(it.id) && e.shiftKey ? this.itemSel.delete(it.id) : this.itemSel.add(it.id); this.v.build(); return true; }
    if (t === "move" || t === "scale") {
      this.host.hist.commit(() => {}); const live = this.doc.items3d.find((x) => x.id === it.id);
      this.itemSel = new Set([it.id]); this.v.canvas.setPointerCapture(e.pointerId);
      if (t === "move") this.st = { kind: "item", it: live, orig: live.p.slice(), p0: toPlan(h.point), y: (live.z || 0) * MM };
      else this.st = { kind: "scale", items: [[live, live.s || 1]], masses: [], x0: e.clientX };
      return true;
    }
    return false;
  }
  erase(h) {
    const key = { masses: "masses", items: "items3d", lines: "lines", texts3d: "texts3d", dims3d: "dims3d", sweeps: "sweeps" }[h.type];
    if (!key) return this.host.status("ยางลบ: ลบได้ กล่อง/หน้า ชิ้นส่วน เส้น ข้อความ มิติ หน้าตัดกวาด (ผนัง/ประตู ลบในผัง 2D)");
    const ids = h.type === "masses" ? new Set(this.sk.groupOf(h.id)) : new Set([h.id]);
    this.commit((d) => (d[key] = d[key].filter((x) => !ids.has(x.id))), "ลบแล้ว (Ctrl+Z ย้อนได้)");
    ids.forEach((id) => { this.sk.sel.delete(id); this.itemSel.delete(id); });
  }
  tagObj(h) {
    const tag = SETTINGS.curTag, key = h.type === "masses" ? "masses" : "sweeps", ids = h.type === "masses" ? new Set(this.sk.groupOf(h.id)) : new Set([h.id]);
    this.commit((d) => d[key].forEach((x) => ids.has(x.id) && (x.tag = tag)), `ใส่ Tag "${tag}" แล้ว (เลือก Tag ปัจจุบันที่ถาด Tags)`);
  }
  scaleStart(e, h) {
    this.host.hist.commit(() => {}); this.sk.sel.has(h.id) || (this.sk.sel = new Set(this.sk.groupOf(h.id)));
    const ms = [...this.sk.sel].map((id) => this.doc.masses.find((m) => m.id === id)).filter(Boolean), all = ms.flatMap((m) => m.pts);
    const c = all.reduce((s, p) => [s[0] + p[0] / all.length, s[1] + p[1] / all.length], [0, 0]);
    this.st = { kind: "scale", c, masses: ms.map((m) => [m, m.pts.map((p) => p.slice()), m.height, m.base || 0]), items: [], x0: e.clientX }; this.v.canvas.setPointerCapture(e.pointerId);
    return true;
  }
  applyScale(st, k) {
    for (const [m, pts, h, b] of st.masses) { m.pts = pts.map((p) => [Math.round(st.c[0] + (p[0] - st.c[0]) * k), Math.round(st.c[1] + (p[1] - st.c[1]) * k)]); m.height = Math.max(1, Math.round(h * k)); m.base = b; }
    for (const [it, s0] of st.items) it.s = +(s0 * k).toFixed(2);
    st.k = k; this.v.build(); this.host.status(`ย่อขยาย ×${k.toFixed(2)} (ลากซ้าย/ขวา · พิมพ์ตัวคูณ + Enter ได้)`);
  }

  // ---------------------------------------------------------------- เครื่องมือวาดแบบคลิกทีละจุด
  click(t, p) {
    const P = this.pts; P.push(p);
    const done = (fn) => { fn(); this.pts = []; this.planeZ = null; this.sk.clearOver(); this.prot.hidden = true; };
    const need = { rrect: 3, circle: 2, polygon: 2, arc: 3, arc2: 3, arc3: 3, pie: 3, dim: 2, protractor: 3, axes: 2 }[t];
    if (t === "line") {
      if (P.length > 2 && M.dist(p.p, P[0].p) < 1 && p.z === P[0].z) return done(() => this.makeShape(P.slice(0, -1).map((q) => q.p), true, P[0].z));
      this.host.status(`เส้น: ${P.length} จุด · คลิกจุดแรกเพื่อปิดเป็นหน้า · ดับเบิลคลิก/Enter จบเป็นเส้น · พิมพ์ระยะ + Enter ได้`); return;
    }
    if (P.length < need) { this.host.status(this.hint(t, P.length)); return; }
    const z = P[0].z;
    if (t === "rrect") done(() => this.makeShape(this.rrect(P[0].p, P[1].p, P[2].p), true, z));
    if (t === "circle" || t === "polygon") done(() => { const n = t === "circle" ? 24 : SETTINGS.polySides, r = M.dist(P[0].p, P[1].p), a0 = ang(P[0].p, P[1].p); this.makeShape(Array.from({ length: n }, (_, i) => [Math.round(P[0].p[0] + r * Math.cos(a0 + (i * 2 * Math.PI) / n)), Math.round(P[0].p[1] + r * Math.sin(a0 + (i * 2 * Math.PI) / n))]), true, z); });
    if (t === "arc") done(() => this.makeShape(this.arcC(P[0].p, P[1].p, P[2].p), false, z));
    if (t === "arc2") done(() => this.makeShape(arcThrough(P[0].p, P[2].p, P[1].p), false, z));
    if (t === "arc3") done(() => this.makeShape(arcThrough(P[0].p, P[1].p, P[2].p), false, z));
    if (t === "pie") done(() => this.makeShape([P[0].p, ...this.arcC(P[0].p, P[1].p, P[2].p)], true, z));
    if (t === "dim") done(() => { const rec = { id: M.uid("n"), a: [...P[0].p, P[0].z], b: [...P[1].p, P[1].z], off: 400, h: SETTINGS.dimText }; this.commit((d) => d.dims3d.push(rec), `มิติ 3D ${this.v.fmtLen(Math.hypot(rec.a[0] - rec.b[0], rec.a[1] - rec.b[1], rec.a[2] - rec.b[2]) / 1000)}`); });
    if (t === "protractor") { const a = this.angleOf(P); this.host.status(`มุม ${a.toFixed(1)}° (ไม้โปรแทรกเตอร์) · คลิกจุดใหม่เพื่อวัดอีก`); this.pts = []; this.planeZ = null; }
    if (t === "axes") done(() => { const rot = Math.round((ang(P[0].p, P[1].p) * 180) / Math.PI); this.commit((d) => (d.axes3d = { o: [...P[0].p, P[0].z], rot }), `ย้ายแกนไปที่ ${P[0].p.join(", ")} มม. · หมุน ${rot}°`); });
  }
  hint(t, n) {
    return { rrect: ["", "สี่เหลี่ยมหมุน: คลิกปลายด้านแรก", "ลากความกว้าง แล้วคลิก (พิมพ์ระยะ + Enter ได้)"], circle: ["", "วงกลม: ลากรัศมี แล้วคลิก (พิมพ์รัศมี + Enter)"],
      polygon: ["", `หลายเหลี่ยม ${SETTINGS.polySides} ด้าน: ลากรัศมีแล้วคลิก (พิมพ์ เช่น 8s = 8 ด้าน)`], arc: ["", "โค้ง: คลิกจุดเริ่ม", "คลิกจุดจบ (ทวนเข็มจากจุดเริ่ม)"],
      arc2: ["", "โค้ง 2 จุด: คลิกจุดจบ", "ลากความโค้ง แล้วคลิก"], arc3: ["", "โค้ง 3 จุด: คลิกจุดบนโค้ง", "คลิกจุดจบ"], pie: ["", "พาย: คลิกจุดเริ่มของขอบโค้ง", "คลิกจุดจบ"],
      dim: ["", "มิติ: คลิกจุดที่สอง"], protractor: ["", "ไม้โปรแทรกเตอร์: คลิกแขนแรก", "คลิกแขนที่สอง"], axes: ["", "แกน: คลิกทิศแกนแดง (X)"] }[t][n] || "";
  }
  rrect(a, b, c) { const u = M.norm(M.sub(b, a)), n = [-u[1], u[0]], w = (c[0] - b[0]) * n[0] + (c[1] - b[1]) * n[1]; return [a, b, [Math.round(b[0] + n[0] * w), Math.round(b[1] + n[1] * w)], [Math.round(a[0] + n[0] * w), Math.round(a[1] + n[1] * w)]]; }
  arcC(c, s, e) { return arcPts(c, M.dist(c, s), ang(c, s), ang(c, e), 1); }
  angleOf(P) { const a = M.norm(M.sub(P[1].p, P[0].p)), b = M.norm(M.sub(P[2].p, P[0].p)); return (Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1]))) * 180) / Math.PI; }
  preview(t, p) {
    const P = this.pts, z = P[0].z, L = (arr, closed) => this.showPts(arr.map((q) => ({ p: q, z })), closed), fmt = (mm) => this.v.fmtLen(mm / 1000);
    if (t === "line") { L([...P.map((q) => q.p), p.p], false); this.host.status(`เส้น ${fmt(M.dist(P[P.length - 1].p, p.p))}${p.snap ? " · จับจุดยอด" : ""}`); }
    if (t === "rrect") { if (P.length === 1) L([P[0].p, p.p], false); else L(this.rrect(P[0].p, P[1].p, p.p), true); }
    if (t === "circle" || t === "polygon") { const n = t === "circle" ? 24 : SETTINGS.polySides, r = M.dist(P[0].p, p.p), a0 = ang(P[0].p, p.p); L(Array.from({ length: n }, (_, i) => [P[0].p[0] + r * Math.cos(a0 + (i * 2 * Math.PI) / n), P[0].p[1] + r * Math.sin(a0 + (i * 2 * Math.PI) / n)]), true); this.host.status(`รัศมี ${fmt(r)}`); }
    if (t === "arc" || t === "pie") { if (P.length === 1) L([P[0].p, p.p], false); else { const arc = this.arcC(P[0].p, P[1].p, p.p); L(t === "pie" ? [P[0].p, ...arc] : arc, t === "pie"); } }
    if (t === "arc2") { if (P.length === 1) L([P[0].p, p.p], false); else L(arcThrough(P[0].p, p.p, P[1].p), false); }
    if (t === "arc3") { if (P.length === 1) L([P[0].p, p.p], false); else L(arcThrough(P[0].p, P[1].p, p.p), false); }
    if (t === "dim") { this.showPts([P[0], p], false, 0xb5522b); this.host.status(`มิติ ${fmt(Math.hypot(p.p[0] - P[0].p[0], p.p[1] - P[0].p[1], p.z - P[0].z))}`); }
    if (t === "axes") { this.showPts([P[0], p], false, 0xd0302f); }
    if (t === "protractor") {
      this.showPts(P.length === 1 ? [P[0], p] : [P[1], P[0], p], false, 0x2e7d4f);
      if (P.length === 2) { const a = this.angleOf([P[0], P[1], p]), q = v3(P[0].p, z).project(this.v.camera), r = this.v.canvas.getBoundingClientRect(); this.prot.textContent = a.toFixed(1) + "°"; this.prot.style.left = ((q.x + 1) / 2) * r.width + "px"; this.prot.style.top = ((1 - q.y) / 2) * r.height + "px"; this.prot.hidden = false; }
    }
  }
  /** รูปปิด → หน้า (กล่องสูง 1 มม. ดึงด้วย Push/Pull) · รูปเปิด → เส้น (เห็นในผัง 2D ด้วย) */
  makeShape(pts, closed, z) {
    if (pts.length < 2) return;
    if (closed && pts.length >= 3 && Math.abs(M.polygonArea(pts)) > 1e4) {
      const m = { id: M.uid("m"), name: "หน้า (Face)", pts, base: z || 0, height: 1, mat: this.sk.mat };
      this.commit((d) => d.masses.push(m), `ได้หน้าใหม่ ${(Math.abs(M.polygonArea(pts)) / 1e6).toFixed(2)} ตร.ม. — ใช้ Push/Pull (P) ดึงเป็นกล่อง`);
      this.sk.sel = new Set([m.id]);
    } else {
      const l = { id: M.uid("l"), pts, closed: false, z: z || 0 };
      this.commit((d) => d.lines.push(l), `ได้เส้น ${pts.length} จุด (เห็นในผัง 2D · ใช้ Follow Me กวาดหน้าตัดตามเส้นนี้ได้)`);
    }
  }
  finish() { if (this.tool === "line" && this.pts.length >= 2) this.makeShape(this.pts.map((q) => q.p), false, this.pts[0].z); this.reset(); this.planeZ = null; }
  cancel() { if (this.busy()) { this.reset(); this.planeZ = null; return true; } return false; }

  /** ช่องระยะ (VCB): ความยาวเส้น · รัศมี · จำนวนด้าน (8s) · หน้าตัด Follow Me (200x300) · ตัวคูณย่อขยาย · ระยะ Offset */
  typed(str) {
    const t = this.tool, s = String(str).trim().replace(/,/g, ""); if (!s) return false;
    if (t === "polygon" && /^\d+s$/i.test(s)) { SETTINGS.polySides = Math.max(3, Math.min(64, parseInt(s))); this.host.status(`หลายเหลี่ยม ${SETTINGS.polySides} ด้าน`); return true; }
    if (t === "follow" && /^\d+\s*[x*]\s*\d+$/i.test(s)) { const [w, h] = s.split(/[x*]/i).map(Number); Object.assign(SETTINGS, { sweepW: w, sweepH: h }); this.host.status(`Follow Me: หน้าตัด ${w}×${h} มม. — คลิกเส้น`); return true; }
    const v = Number(s); if (!isFinite(v)) return false;
    if (t === "scale") { const st = { c: null, masses: [], items: [] }; const ms = [...this.sk.sel].map((id) => this.doc.masses.find((m) => m.id === id)).filter(Boolean);
      if (!ms.length && !this.itemSel.size) return false; this.host.hist.commit(() => {}); const all = ms.flatMap((m) => m.pts); st.c = all.length ? all.reduce((a, p) => [a[0] + p[0] / all.length, a[1] + p[1] / all.length], [0, 0]) : [0, 0];
      st.masses = ms.map((m) => [m, m.pts.map((p) => p.slice()), m.height, m.base || 0]); st.items = this.doc.items3d.filter((x) => this.itemSel.has(x.id)).map((x) => [x, x.s || 1]); this.applyScale(st, v); this.host.onChange(); return true; }
    const P = this.pts; if (!P.length) return false;
    const last = P[P.length - 1], over = this.sk.over.children[0], dirTo = () => { if (!over) return [1, 0]; const a = over.geometry.attributes.position, n = a.count, q = [a.getX(n - 1) / MM, -a.getZ(n - 1) / MM]; return M.norm(M.sub(q, last.p)); };
    if (t === "line") { const d = dirTo(), p = { p: [Math.round(last.p[0] + d[0] * v), Math.round(last.p[1] + d[1] * v)], z: last.z }; this.click(t, p); this.preview(t, p); return true; }
    if ((t === "circle" || t === "polygon") && P.length === 1) { this.click(t, { p: [P[0].p[0] + v, P[0].p[1]], z: P[0].z }); return true; }
    if (t === "rrect" && P.length === 2) { const u = M.norm(M.sub(P[1].p, P[0].p)); this.click(t, { p: [P[1].p[0] - u[1] * v, P[1].p[1] + u[0] * v], z: P[0].z }); return true; }
    return false;
  }

  // ---------------------------------------------------------------- เดิน (Walk) · คัดลอก/ตัด/วาง · ไฮไลต์ชิ้นส่วนที่เลือก
  walkKey(e) {
    if (this.tool !== "walk" || (e.target.matches && e.target.matches("input, select, textarea"))) return;
    const k = { w: 1, arrowup: 1, s: -1, arrowdown: -1 }[e.key.toLowerCase()], side = { a: -1, arrowleft: -1, d: 1, arrowright: 1 }[e.key.toLowerCase()];
    if (!k && !side) return; e.preventDefault();
    const cam = this.v.camera, tg = this.v.controls.target, fw = tg.clone().sub(cam.position).setY(0).normalize(), rt = new THREE.Vector3().crossVectors(fw, new THREE.Vector3(0, 1, 0)), step = e.shiftKey ? 1.2 : 0.4;
    const mv = fw.multiplyScalar((k || 0) * step).add(rt.multiplyScalar((side || 0) * step)); cam.position.add(mv); tg.add(mv); this.v.controls.update();
    this.host.status(`เดิน: ${this.v.fmtLen(cam.position.y)} จากพื้น · WASD/ลูกศร = เดิน · Shift = เร็ว · ลากเมาส์ = หันมอง`);
  }
  startWalk() {
    const cam = this.v.camera, tg = this.v.controls.target, dir = tg.clone().sub(cam.position).setY(0).normalize();
    cam.position.y = 1.65; tg.copy(cam.position).addScaledVector(dir, 0.3); tg.y = 1.6; this.v.controls.update();
  }
  copy(cut) {
    const ms = this.doc.masses.filter((m) => this.sk.sel.has(m.id)), its = this.doc.items3d.filter((x) => this.itemSel.has(x.id));
    if (!ms.length && !its.length) { this.host.status("เลือกกล่อง/ชิ้นส่วนก่อน (เครื่องมือ เลือก)"); return false; }
    this.clip = JSON.parse(JSON.stringify({ ms, its }));
    if (cut) { const a = new Set(ms.map((m) => m.id)), b = new Set(its.map((x) => x.id)); this.commit((d) => { d.masses = d.masses.filter((m) => !a.has(m.id)); d.items3d = d.items3d.filter((x) => !b.has(x.id)); }); this.sk.sel.clear(); this.itemSel.clear(); }
    this.host.status(`${cut ? "ตัด" : "คัดลอก"} ${ms.length} กล่อง · ${its.length} ชิ้นส่วน — Ctrl+V วาง (ห่างเดิม 1 ม.)`); return true;
  }
  paste() {
    if (!this.clip) return this.host.status("ยังไม่ได้คัดลอก");
    const off = 1000, gmap = new Map(), ms = this.clip.ms.map((m) => ({ ...JSON.parse(JSON.stringify(m)), id: M.uid("m"), gid: m.gid ? gmap.get(m.gid) || (gmap.set(m.gid, M.uid("g")), gmap.get(m.gid)) : undefined, pts: m.pts.map((p) => [p[0] + off, p[1] - off]) }));
    const its = this.clip.its.map((x) => ({ ...x, id: M.uid("i"), p: [x.p[0] + off, x.p[1] - off] }));
    this.commit((d) => { d.masses.push(...ms); d.items3d.push(...its); }, `วาง ${ms.length} กล่อง · ${its.length} ชิ้นส่วน (ห่างเดิม 1 ม. · ใช้ ย้าย ปรับตำแหน่ง)`);
    this.sk.sel = new Set(ms.map((m) => m.id)); this.itemSel = new Set(its.map((x) => x.id)); this.clip = { ms: ms.map((m) => ({ ...m })), its: its.map((x) => ({ ...x })) };
  }
  removeSel() { const b = new Set(this.itemSel); if (!b.size) return false; this.commit((d) => (d.items3d = d.items3d.filter((x) => !b.has(x.id))), `ลบ ${b.size} ชิ้นส่วน`); this.itemSel.clear(); return true; }
  decorate() {
    for (const o of this.v.model.children) if (o.isGroup && o.userData.type === "items" && this.itemSel.has(o.userData.id)) { const bh = new THREE.BoxHelper(o, 0x2f7bff); bh.material.depthTest = false; bh.renderOrder = 5; bh.userData.helper = true; this.v.model.add(bh); }
  }
  selectedInfo() {
    const its = this.doc.items3d.filter((x) => this.itemSel.has(x.id)); if (!its.length) return null;
    const it = its[0], k = KINDS.find((x) => x.k === it.kind);
    return { n: its.length, th: kindTh(it.kind), size: k ? k.size : "", s: it.s || 1, rot: it.rot || 0, tag: it.tag || "items", p: it.p };
  }
}
