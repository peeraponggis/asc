// เครื่องมือ 3D ชุดเต็มแบบ SketchUp (0.23.0 · โดย ลุงพี) — ต่อจาก sketch3d.js (เลือก push-pull สี่เหลี่ยม ย้าย หมุน ทาสี ตลับเมตร)
// วาด: เส้น วาดอิสระ สี่เหลี่ยมหมุน วงกลม หลายเหลี่ยม โค้ง (ศูนย์กลาง · 2 จุด · 3 จุด) พาย → รูปปิด = หน้า (Face) ดึงด้วย Push/Pull ได้ · เส้นเปิด = เส้นในผัง
// แก้: ยางลบ Tag ย่อขยาย Offset Follow Me (กวาดหน้าตัดตามเส้น) · ใส่ข้อมูล: มิติ 3D ไม้โปรแทรกเตอร์ ข้อความชี้ แกน ข้อความ 3D
// กล้อง: ซูมกรอบ เดิน (WASD/ลูกศร) · ชิ้นส่วน: วางต้นไม้ รถ ฯลฯ · คัดลอก/ตัด/วาง · ทุกการแก้ผ่าน hist.commit (Ctrl+Z ได้)
import * as THREE from "three";
import * as M from "./model.js?v=0.31.1";
import { kindTh, KINDS } from "./props3d.js?v=0.31.1";
import * as SEL from "./sel3d.js?v=0.31.1";
import { makeModelItem, modelLabel } from "./import3d-core.js?v=0.31.1";
import { SolidTools } from "./solid3d.js?v=0.31.1";
import * as SOL from "./mesh.js?v=0.31.1";

/** ชนิดที่คลิกเลือกได้ใน 3D (ทุกอย่างที่เห็น ยกเว้นพื้นดิน/แผงโซลาร์อัตโนมัติ) */
const PICK = new Set(["walls", "openings", "roof", "masses", "solids", "items", "lines", "texts3d", "dims3d", "sweeps", "struct"]);

const MM = 0.001;
const cap = (el, id) => { try { el.setPointerCapture(id); } catch (e) { /* ไม่มี pointer ที่กดอยู่จริง — ข้ามได้ */ } };
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

export const SETTINGS = { rotStep: 15, polySides: 6, sweepW: 200, sweepH: 200, text3dH: 600, textH: 250, dimText: 250, compRandom: true, compScale: 1, curTag: "masses" };

const FACE_T = new Set(["rrect", "circle", "polygon", "arc", "arc2", "arc3", "pie", "freehand"]);   // รูปที่วาดบนหน้าของก้อนได้ (0.30)
export class Tools3D {
  constructor(view, sk, host) {
    this.v = view; this.sk = sk; this.host = host; this.pts = []; this.st = null; this.clip = null; this.placing = null; this.lastMove = null;
    this.sol = new SolidTools(view, sk, this, host);                         // ผิว+เส้นแบบ SketchUp (0.26)
    this._is = new SEL.TypedSet(sk.S, "items");
    sk.ext = this; this.ray = new THREE.Raycaster(); this.ray.params.Line.threshold = 0.15;
    this.hov = new THREE.Group(); this.hov.name = "เมาส์ชี้"; view.scene.add(this.hov); this.hovKey = null; this._hovT = 0;
    this.prot = document.createElement("div"); this.prot.className = "tape-label"; this.prot.hidden = true; view.canvas.parentNode.appendChild(this.prot);
    this.zbox = document.createElement("div"); this.zbox.className = "zoombox"; this.zbox.hidden = true; view.canvas.parentNode.appendChild(this.zbox);
    view.canvas.addEventListener("dblclick", (e) => { if (["line", "arc", "arc2", "arc3"].includes(sk.tool)) { e.preventDefault(); this.finish(); } });
    addEventListener("keydown", (e) => this.walkKey(e));
    const prev = view.onBuilt; view.onBuilt = () => { prev && prev(); this.decorate(); };
  }
  get doc() { return this.host.hist.doc; }
  get tool() { return this.sk.tool; }
  get itemSel() { return this._is; }
  set itemSel(v) { this._is.clear(); for (const id of v) this._is.add(id); }
  busy() { return this.pts.length > 0 || !!this.st; }
  commit(fn, msg) { this.host.hist.commit(fn); this.host.onChange(); if (msg) this.host.status(msg); }
  reset() { this.fd = null; this.pts = []; this.st = null; this.sk.clearOver(); this.prot.hidden = true; this.zbox.hidden = true; if (this.hov) this.clearHover(); }

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
    // ก้อนผิว+เส้น (0.26): จุดปลาย + จุดกลางเส้น (ตัวจับจุดแบบ SketchUp)
    for (const q of this.sol.guideSnaps()) cands.push([[q[0], q[1]], q[2], "จุดตัดเส้นไกด์"]);
    for (const s of this.doc.solids || []) {
      for (const v of s.verts) cands.push([[v[0], v[1]], v[2], "ปลาย"]);
      for (const e of SOL.edges(s).values()) { const a = s.verts[e.a], b = s.verts[e.b]; cands.push([[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], (a[2] + b[2]) / 2, "จุดกลาง"]); }
    }
    let best = null, bd = 12;
    for (const [p, z, kind] of cands) {
      const q = v3(p, z).project(cam); if (q.z > 1) continue;
      const d = Math.hypot(((q.x + 1) / 2) * r.width - mx, ((1 - q.y) / 2) * r.height - my); if (d < bd) { bd = d; best = { p: [Math.round(p[0]), Math.round(p[1])], z: Math.round(z), kind: kind || "ปลาย" }; }
    }
    if (best) return best;
    // บนขอบ: จุดที่ใกล้เมาส์ที่สุดบนเส้นของก้อน (≤ 8 px)
    let be = null, bed = 8;
    for (const s of this.doc.solids || []) for (const e of SOL.edges(s).values()) {
      const A = s.verts[e.a], B = s.verts[e.b], a = v3([A[0], A[1]], A[2]).project(cam), b = v3([B[0], B[1]], B[2]).project(cam);
      if (a.z > 1 || b.z > 1) continue;
      const ax = ((a.x + 1) / 2) * r.width, ay = ((1 - a.y) / 2) * r.height, bx = ((b.x + 1) / 2) * r.width, by = ((1 - b.y) / 2) * r.height, dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((mx - ax) * dx + (my - ay) * dy) / L2)), d = Math.hypot(ax + dx * t - mx, ay + dy * t - my);
      if (d < bed) { bed = d; be = { p: [Math.round(A[0] + (B[0] - A[0]) * t), Math.round(A[1] + (B[1] - A[1]) * t)], z: Math.round(A[2] + (B[2] - A[2]) * t), kind: "บนขอบ" }; }
    }
    return be;
  }
  /** จุดสำหรับวาด: จุดยอด → ระนาบที่เริ่มวาด → ผิวบนของกล่อง → พื้น (จับกริด 50 มม.) */
  point(e) {
    const s = this.vsnap(e), fd = this.fd;
    if (!fd && FACE_T.has(this.tool)) { const h = this.hitAny(e, (u) => u.type === "solids"), fo = h && h.object.geometry.userData.faceOfTri; this.faceHit = h ? { id: h.id, fi: fo ? fo[h.faceIndex] : 0 } : null; }   // หน้าที่อยู่ใต้เมาส์จริง (คลิกบนขอบ = หน้าที่เห็น)
    if (s && (!fd || Math.abs(SOL.V.dot(fd.n, [s.p[0], s.p[1], s.z]) - fd.d) < 3)) return { ...s, snap: true };
    if (fd) { const X = this.sol.rayPlanePoint(e, fd.o, fd.n); return X ? { p: [Math.round(X[0]), Math.round(X[1])], z: Math.round(X[2]), face: true } : null; }   // วาดบนหน้าเดิม (0.30)
    // ผิวของก้อน (0.27): จุดบนหน้าใดก็ได้ (รวมผนังตั้ง) — วาดเส้นแบ่ง/ตัดบนหน้านั้น · รูปทรง/โค้ง/วาดอิสระ = แบ่งหน้า (0.30)
    const hs = this.hitAny(e, (u) => u.type === "solids");
    if (hs && (this.tool === "line" || this.tool === "dim" || FACE_T.has(this.tool))) return { p: [Math.round(hs.point.x / MM), Math.round(-hs.point.z / MM)], z: Math.round(hs.point.y / MM), face: true };
    this.ray.setFromCamera(this.ndc(e), this.v.camera);
    if (this.planeZ == null) {
      const h = this.hitAny(e, (u) => u.type === "masses");
      if (h && h.n.y > 0.9) { this.planeZ = Math.round(h.point.y / MM); }
      else this.planeZ = 0;
    }
    const P = new THREE.Vector3(); if (!this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.planeZ * MM), P)) return null;
    const p = toPlan(P), out = { p: [snap(p[0]), snap(p[1])], z: this.planeZ };
    // ขนานแกน (แบบ SketchUp): ทิศจากจุดล่าสุดใกล้แกนแดง/เขียวไม่เกิน 3° → จัดให้ตรงแกน
    const last = this.pts[this.pts.length - 1];
    if (last && this.sol && !this.sol.lock) {
      const dx = out.p[0] - last.p[0], dy = out.p[1] - last.p[1], a = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI;
      if (Math.hypot(dx, dy) > 200 && a < 3) { out.p[1] = last.p[1]; out.axis = "แกนแดง"; } else if (Math.hypot(dx, dy) > 200 && a > 87) { out.p[0] = last.p[0]; out.axis = "แกนเขียว"; }
    }
    if (last && !out.axis && !(this.sol && this.sol.lock)) { const q = this.paraSnap(last, out.p); if (q) { out.p = q.p; out.axis = q.label; out.para = true; } }
    if (last && this.sol && this.sol.lock === "x") { out.p[1] = last.p[1]; out.axis = "แกนแดง (ล็อก)"; }
    if (last && this.sol && this.sol.lock === "y") { out.p[0] = last.p[0]; out.axis = "แกนเขียว (ล็อก)"; }
    return out;
  }
  /** ขนาน/ตั้งฉากกับขอบที่มีอยู่ (แบบ SketchUp · สีม่วง) — ทิศจากจุดล่าสุดห่างไม่เกิน 2° */
  paraSnap(last, p) {
    const dx = p[0] - last.p[0], dy = p[1] - last.p[1], L = Math.hypot(dx, dy); if (L < 300) return null;
    const a = Math.atan2(dy, dx), D = this.edgeDirs(), tol = (2 * Math.PI) / 180;
    for (const e of D) for (const [b, label] of [[e, "ขนานกับขอบ"], [e + Math.PI / 2, "ตั้งฉากกับขอบ"]]) {
      let df = (a - b) % Math.PI; if (df > Math.PI / 2) df -= Math.PI; if (df < -Math.PI / 2) df += Math.PI;
      if (Math.abs(df) > tol) continue;
      const u = [Math.cos(b), Math.sin(b)], t = dx * u[0] + dy * u[1];
      return { p: [Math.round(last.p[0] + u[0] * t), Math.round(last.p[1] + u[1] * t)], label };
    }
    return null;
  }
  /** ทิศขอบแนวราบในแบบ (ก้อน · กล่อง · ผนัง · เส้น) ที่ไม่ตรงแกน — จำไว้ระหว่างวาดรูปเดียว */
  edgeDirs() {
    const d = this.doc, key = this.pts.length + ":" + (d.solids || []).length + ":" + d.masses.length + ":" + d.walls.length + ":" + d.lines.length;
    if (this._ed && this._ed.key === key && this._ed.doc === d) return this._ed.D;
    const out = [], add = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1]; if (Math.hypot(dx, dy) < 200) return; let t = Math.atan2(dy, dx) % (Math.PI / 2); if (t < 0) t += Math.PI / 2; if (t < 0.02 || t > Math.PI / 2 - 0.02) return; const ang = Math.atan2(dy, dx); if (!out.some((x) => Math.abs(Math.sin(x - ang)) < 0.005)) out.push(ang); };
    for (const s of d.solids || []) for (const e of SOL.edges(s).values()) { const A = s.verts[e.a], B = s.verts[e.b]; if (Math.abs(A[2] - B[2]) < 2) add(A, B); }
    for (const m of d.masses) m.pts.forEach((p, i) => add(p, m.pts[(i + 1) % m.pts.length]));
    for (const w of d.walls) if (w.a && w.b) add(w.a, w.b);
    for (const l of d.lines) for (let i = 0; i + 1 < l.pts.length; i++) add(l.pts[i], l.pts[i + 1]);
    this._ed = { key, doc: d, D: out.slice(0, 400) }; return this._ed.D;
  }
  /** รูปทรงบนหน้าของก้อน: จุดในระนาบหน้า → 2 มิติ (ฐาน u,v ของหน้า) → ตัวสร้างรูปเดิม → กลับเป็น 3 มิติ */
  faceShape(t, P, partial) {
    const { b, n, d } = this.fd, to2 = (q) => { const X = [q.p[0], q.p[1], q.z]; return [SOL.V.dot(X, b.u), SOL.V.dot(X, b.v)]; };
    const up = (q) => SOL.V.add(SOL.V.add(SOL.V.mul(b.u, q[0]), SOL.V.mul(b.v, q[1])), SOL.V.mul(n, d)).map(Math.round), Q = P.map(to2);
    let pts = [], closed = false;
    if (t === "freehand") pts = Q;
    else if (t === "circle" || t === "polygon") { const k = t === "circle" ? 24 : SETTINGS.polySides, r = M.dist(Q[0], Q[1]), a0 = ang(Q[0], Q[1]); pts = Array.from({ length: k }, (_, i) => [Q[0][0] + r * Math.cos(a0 + (i * 2 * Math.PI) / k), Q[0][1] + r * Math.sin(a0 + (i * 2 * Math.PI) / k)]); closed = true; }
    else if (Q.length === 2 && partial) pts = Q;
    else if (t === "rrect") { pts = this.rrect(Q[0], Q[1], Q[2]); closed = true; }
    else if (t === "arc") pts = this.arcC(Q[0], Q[1], Q[2]);
    else if (t === "arc2") pts = arcThrough(Q[0], Q[2], Q[1]);
    else if (t === "arc3") pts = arcThrough(Q[0], Q[1], Q[2]);
    else if (t === "pie") { pts = [Q[0], ...this.arcC(Q[0], Q[1], Q[2])]; closed = true; }
    return { pts: pts.map(up), closed };
  }
  showPts(list, closed, color = 0xe8892b) {
    this.sk.clearOver(); if (list.length < 2) return;
    const pts = list.map((q) => v3(q.p || q, q.z ?? this.planeZ ?? 0)); if (closed) pts.push(pts[0]);
    this.sk.over.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, depthTest: false })));
  }

  // ---------------------------------------------------------------- เมาส์ (เรียกจาก sketch3d.js ก่อนเครื่องมือเดิม · คืน true = จัดการแล้ว)
  down(e) {
    if (this.sol.down(e)) return true;
    const t = this.tool; if (e.button !== 0) return false;
    const own = () => { e.stopImmediatePropagation(); this.v.controls.enabled = false; };
    // ทุกวัตถุในฉาก: เลือก ย้าย หมุน ลบ ทาสี Tag ย่อขยาย — ผนัง หลังคา ประตู/หน้าต่าง กล่อง โครงสร้าง ชิ้นส่วน เส้น ข้อความ มิติ
    if (["select", "move", "rotate", "eraser", "scale", "tagtool", "paint"].includes(t)) {
      const h = this.hitAny(e, (u) => PICK.has(u.type)), k = h ? this.keyOf(h) : null;
      if (t === "select") {
        if (!h) {                                                          // ที่ว่าง: คลิก = ยกเลิกเลือก · ลาก = กรอบเลือก (0.30 · หมุนรอบ = ปุ่มกลางเมาส์/เครื่องมือหมุนรอบ)
          if (!e.shiftKey && !e.ctrlKey && this.sk.S.size) { this.sk.S.clear(); this.selChanged(); }
          own(); const r = this.v.canvas.getBoundingClientRect(); this.st = { kind: "box", x0: e.clientX - r.left, y0: e.clientY - r.top, add: e.shiftKey || e.ctrlKey }; cap(this.v.canvas, e.pointerId); return true;
        }
        e.stopImmediatePropagation();
        const ks = this.expand(k);
        if (e.shiftKey || e.ctrlKey) { const all = ks.every((x) => this.sk.S.has(x)); ks.forEach((x) => (all ? this.sk.S.delete(x) : this.sk.S.add(x))); }
        else { this.sk.S.clear(); ks.forEach((x) => this.sk.S.add(x)); }
        this.selChanged(); return true;
      }
      if (!h) { if (t === "eraser" || t === "tagtool") { e.stopImmediatePropagation(); return true; } return false; }
      if (h.type === "items" && (t === "scale" || t === "tagtool" || t === "paint")) return this.onItem(e, t, h, own);
      if (t === "eraser") { own(); this.v.controls.enabled = true; this.erase(h); return true; }
      if (t === "tagtool") { own(); this.v.controls.enabled = true; this.tagObj(h); return true; }
      if (t === "paint") {
        if (h.type === "sweeps" || h.type === "struct") { own(); this.v.controls.enabled = true; const mat = this.sk.mat, L = h.type; this.commit((d) => { const s = d[L].find((x) => x.id === h.id); if (s) s.mat = mat; }); return true; }
        return false;                                                    // กล่อง ผนัง หลังคา → sketch3d.js
      }
      if (t === "scale") { if (h.type === "masses") { own(); return this.scaleStart(e, h); } this.host.status("ย่อขยาย: ใช้กับกล่อง/หน้า และชิ้นส่วน (ผนัง/โครงสร้าง แก้ขนาดที่ ข้อมูลวัตถุ)"); e.stopImmediatePropagation(); return true; }
      if (t === "move") { own(); return this.gmoveStart(e, h, k); }
      if (t === "rotate") { own(); this.v.controls.enabled = true; return this.grotate(e, k); }
      return false;
    }
    if (t === "place") {
      const p = this.point(e); this.planeZ = null; if (!p) return true; own();
      const kind = this.placing, tpl = kind === "model" && this.placeTpl;       // โมเดลนำเข้า (import3d.js): ขนาดจริง ไม่สุ่ม · ระดับไม่ต่ำกว่าชั้นที่เลือก
      const it = tpl ? makeModelItem(tpl, { id: M.uid("i"), p: p.p, z: Math.max(p.z, tpl.z || 0) })
        : { id: M.uid("i"), kind, p: p.p, z: p.z, rot: SETTINGS.compRandom ? Math.round(Math.random() * 360) : 0, s: +(SETTINGS.compScale * (SETTINGS.compRandom ? 0.9 + Math.random() * 0.25 : 1)).toFixed(2) };
      this.commit((d) => d.items3d.push(it), tpl ? `วาง ${modelLabel(it)} แล้ว — คลิกวางต่อได้ · Esc จบ` : `วาง${kindTh(kind)}แล้ว — คลิกวางต่อได้ · Esc จบ`);
      return true;
    }
    if (["line", "rrect", "circle", "polygon", "arc", "arc2", "arc3", "pie", "dim", "protractor", "axes"].includes(t)) {
      const p = this.point(e); if (!p) return true; own(); this.click(t, p); return true;
    }
    if (t === "freehand") { const p = this.point(e); if (!p) return true; own(); cap(this.v.canvas, e.pointerId); if (p.face || this.faceHit) this.fd = this.sol.faceOfPoint([p.p[0], p.p[1], p.z], this.faceHit); this.st = { kind: "free", list: [p] }; return true; }
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
    if (t === "zoomwin") { own(); const r = this.v.canvas.getBoundingClientRect(); this.st = { kind: "zoom", x0: e.clientX - r.left, y0: e.clientY - r.top }; cap(this.v.canvas, e.pointerId); return true; }
    return false;
  }
  move(e) {
    if (this.sol.move(e)) return true;
    const t = this.tool, st = this.st;
    if (st && st.kind === "gmove") {
      e.stopImmediatePropagation(); const P = this.planeAt(e, st.y); if (!P) return true;
      const q = toPlan(P); let dx = snap(q[0] - st.p0[0]), dy = snap(q[1] - st.p0[1]);
      if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }          // Shift = ล็อกแนวแกน
      this.restore(st); SEL.translate(this.doc, st.keys, dx, dy); st.d = [dx, dy];
      this.v.build(); this.host.status(`ย้าย ${this.v.fmtLen(Math.hypot(dx, dy) / 1000)} (${dx.toLocaleString()}, ${dy.toLocaleString()} มม.)${st.copy ? " · คัดลอก" : ""} · Shift = ล็อกแนว · ปล่อยแล้วพิมพ์ระยะ + Enter ได้`);
      return true;
    }
    if (!st && !this.pts.length && ["select", "move", "rotate", "eraser", "paint", "tagtool", "scale"].includes(t) && e.buttons === 0) { this.hover(e); return false; }
    if (st && st.kind === "item") { e.stopImmediatePropagation(); const P = this.planeAt(e, st.y); if (!P) return true; const q = toPlan(P); st.it.p = [snap(st.orig[0] + q[0] - st.p0[0]), snap(st.orig[1] + q[1] - st.p0[1])]; this.v.build(); this.host.status(`ย้าย${kindTh(st.it.kind)} ${st.it.p[0] - st.orig[0]}, ${st.it.p[1] - st.orig[1]} มม.`); return true; }
    if (st && st.kind === "scale") { e.stopImmediatePropagation(); const k = Math.max(0.05, Math.round((1 + (e.clientX - st.x0) / 200) * 20) / 20); this.applyScale(st, k); return true; }
    if (st && st.kind === "free") { e.stopImmediatePropagation(); const p = this.point(e); if (p && M.dist(p.p, st.list[st.list.length - 1].p) > 100) { st.list.push(p); this.showPts(st.list, false); } return true; }
    if (st && st.kind === "offset") {
      e.stopImmediatePropagation(); const P = this.planeAt(e, st.y); if (!P) return true;
      const q = toPlan(P), c = st.m.pts.reduce((s, p) => [s[0] + p[0] / st.m.pts.length, s[1] + p[1] / st.m.pts.length], [0, 0]);
      st.d = snap(M.dist(q, c) - M.dist(st.p0, c), 10); st.poly = offsetPoly(st.m.pts, st.d);
      this.showPts(st.poly.map((p) => ({ p, z: Math.round(st.y / MM) })), true); this.host.status(`Offset ${st.d > 0 ? "ออก" : "เข้า"} ${Math.abs(st.d).toLocaleString()} มม. (ปล่อยเมาส์แล้วพิมพ์ระยะ + Enter ได้)`); return true;
    }
    if (st && st.kind === "box") {
      e.stopImmediatePropagation(); const r = this.v.canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; st.x1 = x; st.y1 = y;
      Object.assign(this.zbox.style, { left: Math.min(x, st.x0) + "px", top: Math.min(y, st.y0) + "px", width: Math.abs(x - st.x0) + "px", height: Math.abs(y - st.y0) + "px", borderStyle: x < st.x0 ? "dashed" : "solid" }); this.zbox.hidden = false;
      this.host.status(x < st.x0 ? "กรอบเลือก ขวา→ซ้าย: เลือกทุกชิ้นที่แตะกรอบ" : "กรอบเลือก ซ้าย→ขวา: เลือกเฉพาะชิ้นที่อยู่ในกรอบทั้งชิ้น"); return true;
    }
    if (st && st.kind === "zoom") { e.stopImmediatePropagation(); const r = this.v.canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; Object.assign(this.zbox.style, { left: Math.min(x, st.x0) + "px", top: Math.min(y, st.y0) + "px", width: Math.abs(x - st.x0) + "px", height: Math.abs(y - st.y0) + "px" }); this.zbox.hidden = false; st.x1 = x; st.y1 = y; return true; }
    if (this.pts.length && ["line", "rrect", "circle", "polygon", "arc", "arc2", "arc3", "pie", "dim", "protractor", "axes"].includes(t)) { const p = this.point(e); if (p) this.preview(t, p); return true; }
    return false;
  }
  up(e) {
    if (this.sol.up(e)) return true;
    const st = this.st; if (!st) return false;
    e.stopImmediatePropagation(); this.v.controls.enabled = true;
    if (st.kind === "gmove") {
      this.st = null; const [dx, dy] = st.d || [0, 0];
      if (!dx && !dy) { this.host.hist.undo(); this.selChanged(); return true; }        // คลิกเฉย ๆ ไม่ได้ลาก = แค่เลือก
      if (st.copy) { const clip = SEL.copyOf(this.doc, st.keys); this.restore(st); const ks = SEL.paste(this.doc, clip, 0, 0); this.sk.S.clear(); ks.forEach((x) => this.sk.S.add(x)); }
      this.lastMove = { keys: new Set(this.sk.S), d: [dx, dy], copy: st.copy }; this.sol.forget();
      this.host.onChange(); this.selChanged(); return true;
    }
    if (st.kind === "item" || st.kind === "scale") { this.st = null; this.host.onChange(); return true; }
    if (st.kind === "box") { this.st = null; this.zbox.hidden = true; this.zbox.style.borderStyle = ""; if (st.x1 != null && Math.hypot(st.x1 - st.x0, st.y1 - st.y0) > 4) this.boxSelect(st); return true; }
    if (st.kind === "free") {
      this.st = null; const L = st.list; this.sk.clearOver(); if (L.length < 2) { this.fd = null; return true; }
      if (this.fd) { const P3 = L.map((q) => [q.p[0], q.p[1], q.z]), cl = L.length > 3 && SOL.V.len(SOL.V.sub(P3[0], P3[P3.length - 1])) < 400, fd = this.fd; this.fd = null; this.sol.shapeOnFace(fd, cl ? P3.slice(0, -1) : P3, cl); return true; }
      const closed = L.length > 3 && M.dist(L[0].p, L[L.length - 1].p) < 400;
      this.makeShape(L.map((q) => q.p), closed, L[0].z); this.planeZ = null; return true;
    }
    if (st.kind === "offset") {
      this.st = null; this.sk.clearOver(); if (!st.poly || !st.d) return true;
      const m = st.m, f = { id: M.uid("m"), name: "หน้า Offset", pts: st.poly, base: (m.base || 0) + m.height, height: 1, mat: m.mat };
      this.lastOffset = { src: m.id, face: f.id, sign: Math.sign(st.d) || 1 };                 // พิมพ์ระยะ + Enter ต่อได้ (แก้หน้าล่าสุด)
      this.commit((d) => d.masses.push(f), `Offset ${st.d} มม. → หน้าใหม่บนกล่อง · พิมพ์ระยะ + Enter เพื่อแก้ระยะให้พอดี`); return true;
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
      this.itemSel = new Set([it.id]); cap(this.v.canvas, e.pointerId);
      if (t === "move") this.st = { kind: "item", it: live, orig: live.p.slice(), p0: toPlan(h.point), y: (live.z || 0) * MM };
      else this.st = { kind: "scale", items: [[live, live.s || 1]], masses: [], x0: e.clientX };
      return true;
    }
    return false;
  }
  erase(h) {
    const ks = new Set(this.expand(this.keyOf(h))), what = SEL.describe(this.doc, [...ks][0]);
    this.commit((d) => SEL.remove(d, ks), `ลบ ${what}${ks.has("roof:roof") ? " (หลังคา = ไม่มี · เปิดใหม่ที่ ข้อมูลวัตถุ)" : ""} · Ctrl+Z ย้อนได้`);
    ks.forEach((k) => this.sk.S.delete(k)); this.selChanged();
  }
  tagObj(h) {
    const tag = SETTINGS.curTag, L = SEL.LIST[h.type];
    if (!L || h.type === "walls" || h.type === "openings") return this.host.status("Tag: ใส่ได้กับ กล่อง โครงสร้าง ชิ้นส่วน หน้าตัดกวาด (ผนัง/ประตู/หลังคา มี Tag ของตัวเองแล้ว)");
    const ids = h.type === "masses" ? new Set(this.sk.groupOf(h.id)) : new Set([h.id]);
    this.commit((d) => d[L].forEach((x) => ids.has(x.id) && (x.tag = tag)), `ใส่ Tag "${tag}" แล้ว (เลือก Tag ปัจจุบันที่ถาด Tags)`);
  }
  // ---------------------------------------------------------------- เลือก/ย้าย/หมุน ทุกชนิด
  keyOf(h) { return SEL.key(h.type, h.id); }
  /** คลิกชิ้นในกลุ่ม = ทั้งกลุ่ม */
  expand(k) {
    const [t, id] = SEL.split(k);
    const o = t === "masses" ? this.doc.masses.find((x) => x.id === id) : t === "solids" ? (this.doc.solids || []).find((x) => x.id === id) : null;
    if (o && o.gid && o.gid !== this.sol.openGid) return this.sol.groupKeys(o.gid);       // คลิกชิ้นในกลุ่ม = ทั้งกลุ่ม (กล่อง + ก้อนผิว+เส้น)
    return [k];
  }
  /** กรอบเลือก: ทุกชิ้นในฉากที่เลือกได้ — ซ้าย→ขวา ต้องอยู่ในกรอบทั้งชิ้น · ขวา→ซ้าย แตะกรอบ (มุมกล่องรอบชิ้นบนจอ) */
  boxSelect(st) {
    const r = this.v.canvas.getBoundingClientRect(), cam = this.v.camera, win = st.x1 >= st.x0;
    const L = Math.min(st.x0, st.x1), R = Math.max(st.x0, st.x1), Tp = Math.min(st.y0, st.y1), B = Math.max(st.y0, st.y1);
    const keys = new Map(), box = new THREE.Box3(), c = new THREE.Vector3();
    this.v.model.traverse((o) => {
      const u = o.userData || {}; if (!u.type || !PICK.has(u.type) || !o.visible || !(o.isMesh || o.isGroup)) return;
      const k = SEL.key(u.type, u.id), b = keys.get(k) || new THREE.Box3(); box.setFromObject(o); if (box.isEmpty()) return; b.union(box); keys.set(k, b);
    });
    const hit = [];
    for (const [k, b] of keys) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, behind = false;
      for (let i = 0; i < 8; i++) { c.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).project(cam); if (c.z > 1) behind = true; const sx = ((c.x + 1) / 2) * r.width, sy = ((1 - c.y) / 2) * r.height; x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy); }
      if (behind) continue;
      if (win ? x0 >= L && x1 <= R && y0 >= Tp && y1 <= B : x1 >= L && x0 <= R && y1 >= Tp && y0 <= B) hit.push(k);
    }
    if (!st.add) this.sk.S.clear();
    for (const k of hit) this.expand(k).forEach((x) => this.sk.S.add(x));
    this.selChanged(); this.host.status(`กรอบเลือก${win ? " (อยู่ในกรอบ)" : " (แตะกรอบ)"}: ${hit.length} ชิ้น — Shift/Ctrl + ลากกรอบ = เพิ่ม`);
  }
  selChanged() { this.clearHover(); this.sk.redeco(); this.sol.decorate(); this.host.onSelect3D && this.host.onSelect3D([...this.sk.S]); }
  restore(st) { for (const [k, js] of st.orig) { const o = SEL.find(this.doc, k); if (!o) continue; const src = JSON.parse(js); for (const p of Object.keys(src)) o[p] = src[p]; } }
  gmoveStart(e, h, k) {
    if (!this.sk.S.has(k)) { this.sk.S.clear(); this.expand(k).forEach((x) => this.sk.S.add(x)); }
    const keys = new Set([...this.sk.S].filter((x) => x !== "roof:roof"));
    if (!keys.size) { this.v.controls.enabled = true; this.host.status("หลังคาย้ายเองไม่ได้ — หลังคาสร้างตามผนัง: ย้ายผนัง หรือแก้ทรง/ชายคาที่ ข้อมูลวัตถุ"); return true; }
    this.host.hist.commit(() => {});
    this.st = { kind: "gmove", keys, orig: new Map([...keys].map((x) => [x, JSON.stringify(SEL.find(this.doc, x))])), p0: toPlan(h.point), y: h.point.y, copy: e.ctrlKey };
    cap(this.v.canvas, e.pointerId); this.clearHover(); this.v.build();
    return true;
  }
  grotate(e, k) {
    if (!this.sk.S.has(k)) { this.sk.S.clear(); this.expand(k).forEach((x) => this.sk.S.add(x)); }
    const keys = new Set([...this.sk.S].filter((x) => !x.startsWith("roof:") && !x.startsWith("openings:")));
    if (!keys.size) { this.host.status("หมุน: หลังคา/ประตู/หน้าต่างหมุนตามผนัง — เลือกผนังแทน"); return true; }
    const deg = e.shiftKey ? -SETTINGS.rotStep : SETTINGS.rotStep, c = SEL.center(this.doc, keys);
    this.commit((d) => SEL.rotate(d, keys, deg, c), `หมุน ${deg}° รอบจุดกลาง (Shift+คลิก = ทวนทาง · พิมพ์มุม + Enter = หมุนตามค่า)`); this.selChanged();
    return true;
  }
  /** เมาส์ชี้ = ไฮไลต์ + บอกว่าเป็นอะไร (แบบ SketchUp) */
  hover(e) {
    const now = performance.now(); if (now - this._hovT < 40) return; this._hovT = now;
    const h = this.hitAny(e, (u) => PICK.has(u.type)), k = h ? this.keyOf(h) : null;
    if (this.tool === "select") this.v.canvas.style.cursor = k ? "pointer" : "default";
    if (k === this.hovKey) return; this.hovKey = k;
    this.hov.traverse((o) => o.geometry && o.geometry.dispose()); this.hov.clear(); this.v.invalidate();
    if (!k) return;
    const [t, id] = SEL.split(k), mat = new THREE.LineBasicMaterial({ color: 0x59a6ff, depthTest: false, transparent: true, opacity: 0.75 });
    for (const o of this.v.model.children) {
      const u = o.userData || {}; if (u.type !== t || (t !== "roof" && u.id !== id) || (u.helper && t !== "texts3d")) continue;
      if (o.isGroup) { const bh = new THREE.BoxHelper(o, 0x59a6ff); bh.material.depthTest = false; this.hov.add(bh); continue; }
      if (!o.isMesh) continue;
      const ln = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 20), mat); ln.position.copy(o.position); ln.rotation.copy(o.rotation); ln.scale.copy(o.scale); ln.renderOrder = 4; this.hov.add(ln);
    }
    this.host.status(`${SEL.describe(this.doc, k)} — ${{ select: "คลิกเลือก · Shift = เพิ่ม/เอาออก", move: "ลากเพื่อย้าย · Ctrl = คัดลอก", rotate: "คลิก = หมุน", eraser: "คลิก = ลบ", paint: "คลิก = ทาวัสดุ", tagtool: "คลิก = ใส่ Tag", scale: "ลากซ้าย-ขวา = ย่อขยาย" }[this.tool] || ""}`);
  }
  clearHover() { this.hovKey = null; this.hov.traverse((o) => o.geometry && o.geometry.dispose()); this.hov.clear(); this.v.invalidate(); }
  scaleStart(e, h) {
    this.host.hist.commit(() => {}); this.sk.sel.has(h.id) || (this.sk.sel = new Set(this.sk.groupOf(h.id)));
    const ms = [...this.sk.sel].map((id) => this.doc.masses.find((m) => m.id === id)).filter(Boolean), all = ms.flatMap((m) => m.pts);
    const c = all.reduce((s, p) => [s[0] + p[0] / all.length, s[1] + p[1] / all.length], [0, 0]);
    this.st = { kind: "scale", c, masses: ms.map((m) => [m, m.pts.map((p) => p.slice()), m.height, m.base || 0]), items: [], x0: e.clientX }; cap(this.v.canvas, e.pointerId);
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
    const done = (fn) => { fn(); this.pts = []; this.fd = null; this.planeZ = null; this.sk.clearOver(); this.prot.hidden = true; };
    const need = { rrect: 3, circle: 2, polygon: 2, arc: 3, arc2: 3, arc3: 3, pie: 3, dim: 2, protractor: 3, axes: 2 }[t];
    if (t === "line") {
      if (this.sol.lineSeg(P)) return;                                     // ช่วงนี้แบ่งหน้าของก้อนแล้ว (0.27) · วาดต่อได้
      if (P.length > 2 && M.dist(p.p, P[0].p) < 1 && p.z === P[0].z) return done(() => this.makeShape(P.slice(0, -1).map((q) => q.p), true, P[0].z));
      this.host.status(`เส้น: ${P.length} จุด · คลิกจุดแรกเพื่อปิดเป็นหน้า · ดับเบิลคลิก/Enter จบเป็นเส้น · พิมพ์ระยะ + Enter ได้`); return;
    }
    if (FACE_T.has(t) && P.length === 1 && (p.face || this.faceHit)) this.fd = this.sol.faceOfPoint([p.p[0], p.p[1], p.z], this.faceHit);   // เริ่มบนหน้าของก้อน = วาดในระนาบหน้านั้น (ผนังตั้งได้)
    if (P.length < need) { this.host.status(this.hint(t, P.length) + (this.fd ? " · บนหน้าของก้อน" : "")); return; }
    if (this.fd && FACE_T.has(t)) { const r = this.faceShape(t, P), fd = this.fd; return done(() => this.sol.shapeOnFace(fd, r.pts, r.closed)); }
    const z = P[0].z;
    if (t === "rrect") done(() => this.makeShape(this.rrect(P[0].p, P[1].p, P[2].p), true, z));
    if (t === "circle" || t === "polygon") done(() => { const n = t === "circle" ? 24 : SETTINGS.polySides, r = M.dist(P[0].p, P[1].p), a0 = ang(P[0].p, P[1].p); this.makeShape(Array.from({ length: n }, (_, i) => [Math.round(P[0].p[0] + r * Math.cos(a0 + (i * 2 * Math.PI) / n)), Math.round(P[0].p[1] + r * Math.sin(a0 + (i * 2 * Math.PI) / n))]), true, z); });
    if (t === "arc") done(() => this.makeShape(this.arcC(P[0].p, P[1].p, P[2].p), false, z));
    if (t === "arc2") done(() => this.makeShape(arcThrough(P[0].p, P[2].p, P[1].p), false, z));
    if (t === "arc3") done(() => this.makeShape(arcThrough(P[0].p, P[1].p, P[2].p), false, z));
    if (t === "pie") done(() => this.makeShape([P[0].p, ...this.arcC(P[0].p, P[1].p, P[2].p)], true, z));
    if (t === "dim") done(() => { const rec = { id: M.uid("n"), a: [...P[0].p, P[0].z], b: [...P[1].p, P[1].z], off: 400, h: SETTINGS.dimText }; this.commit((d) => d.dims3d.push(rec), `มิติ 3D ${this.v.fmtLen(Math.hypot(rec.a[0] - rec.b[0], rec.a[1] - rec.b[1], rec.a[2] - rec.b[2]) / 1000)}`); });
    if (t === "protractor") {                                            // วัดมุม + เส้นไกด์ตามมุม (จากจุดยอดผ่านจุดที่สาม · แบบ SketchUp)
      const a = this.angleOf(P), A = [P[0].p[0], P[0].p[1], P[0].z], C = [P[2].p[0], P[2].p[1], P[2].z], v = SOL.V.sub(C, A), L = SOL.V.len(v);
      if (L > 1) { const g = { id: SOL.uid("g"), p: A, d: SOL.V.mul(v, 1 / L) }; this.host.hist.commit((x) => (x.guides = x.guides || []).push(g)); this.host.onChange(); this.sol.decorate(); }
      this.host.status(`มุม ${a.toFixed(1)}° — สร้างเส้นไกด์ตามมุมแล้ว (ลบทั้งหมด: แก้ไข → ลบเส้นไกด์ทั้งหมด) · คลิกจุดใหม่เพื่อวัดอีก`); this.pts = []; this.planeZ = null; this.sk.clearOver(); this.prot.hidden = true;
    }
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
    if (this.fd && FACE_T.has(t)) { const r = this.faceShape(t, [...this.pts, p], true); this.showPts(r.pts.map((q) => ({ p: [q[0], q[1]], z: q[2] })), r.closed); return; }
    const P = this.pts, z = P[0].z, L = (arr, closed) => this.showPts(arr.map((q) => ({ p: q, z })), closed), fmt = (mm) => this.v.fmtLen(mm / 1000);
    if (t === "line") { this.showPts([...P, p], false, p.para ? 0xc23bd0 : undefined); this.host.status(`เส้น ${fmt(M.dist(P[P.length - 1].p, p.p))}${p.snap ? ` · ${p.kind || "จับจุดยอด"}` : p.axis ? ` · ${p.para ? p.axis : "ขนาน" + p.axis}` : ""}`); }
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
  finish() { if (this.tool === "line" && this.sol.lineFinish(false)) { this.reset(); this.planeZ = null; return; } if (this.tool === "line" && this.pts.length >= 2) this.makeShape(this.pts.map((q) => q.p), false, this.pts[0].z); this.reset(); this.planeZ = null; }
  cancel() {
    if (this.sol.cancel()) return true;
    if (this.sk.drag && this.sk.drag.clicked) { this.sk.drag = null; this.sk.clearOver(); this.host.status("ยกเลิกสี่เหลี่ยมแล้ว"); return true; }   // สี่เหลี่ยมโหมดคลิก-คลิกที่คลิกมุมแรกไว้
    if (this.busy()) { this.reset(); this.planeZ = null; return true; } return false;
  }

  /** อาร์เรย์แบบ SketchUp หลังย้าย+Ctrl คัดลอก: x5 = สำเนาต่อไปอีกจนครบ 5 ชุดตามระยะเดิม · /5 = แบ่งระยะเป็น 5 ช่วงเท่ากัน */
  arrayCopy(n, divide) {
    const lm = this.lastMove; if (n < 2 || n > 200) { this.host.status("อาร์เรย์: ใช้ 2–200 ชุด"); return true; }
    const [dx, dy] = lm.d, clip = SEL.copyOf(this.doc, lm.keys), add = new Set(lm.keys);
    this.host.hist.commit((d) => {
      if (divide) { for (let k = 1; k < n; k++) SEL.paste(d, clip, Math.round((dx * k) / n - dx), Math.round((dy * k) / n - dy)).forEach((x) => add.add(x)); }
      else for (let k = 1; k < n; k++) SEL.paste(d, clip, dx * k, dy * k).forEach((x) => add.add(x));
    });
    this.lastMove = null; this.sk.S.clear(); add.forEach((x) => this.sk.S.add(x)); this.host.onChange(); this.selChanged();
    this.host.status(divide ? `อาร์เรย์: แบ่งระยะเป็น ${n} ช่วงเท่ากัน (${n} สำเนา)` : `อาร์เรย์: สำเนา ${n} ชุด ห่างชุดละ ${this.v.fmtLen(Math.hypot(dx, dy) / 1000)}`);
    return true;
  }
  /** ช่องระยะ (VCB): ความยาวเส้น · รัศมี · จำนวนด้าน (8s) · หน้าตัด Follow Me (200x300) · ตัวคูณย่อขยาย · ระยะ Offset */
  typed(str) {
    const t = this.tool, s = String(str).trim().replace(/,/g, ""); if (!s) return false;
    if (t === "polygon" && /^\d+s$/i.test(s)) { SETTINGS.polySides = Math.max(3, Math.min(64, parseInt(s))); this.host.status(`หลายเหลี่ยม ${SETTINGS.polySides} ด้าน`); return true; }
    if (t === "follow" && /^\d+\s*[x*]\s*\d+$/i.test(s)) { const [w, h] = s.split(/[x*]/i).map(Number); Object.assign(SETTINGS, { sweepW: w, sweepH: h }); this.host.status(`Follow Me: หน้าตัด ${w}×${h} มม. — คลิกเส้น`); return true; }
    const arr = /^(?:[x*]\s*(\d+)|(\d+)\s*[x*]|\/\s*(\d+))$/i.exec(s);
    if (arr && this.lastMove && this.lastMove.copy && !this.pts.length) return this.arrayCopy(+(arr[1] || arr[2] || arr[3]), !!arr[3]);
    const v = Number(s); if (!isFinite(v)) return false;
    if (this.sol.typed(v)) return true;                                                   // ผิว+เส้น (0.26–0.28): ระยะ/มุม/ตัวคูณพอดีหลังลาก — ก่อนงานแบบเดิม
    if (t === "move" && this.lastMove && !this.pts.length) {                          // ย้ายตามระยะที่พิมพ์ (ทิศเดียวกับที่ลากล่าสุด)
      const lm = this.lastMove, L = Math.hypot(...lm.d); if (!L) return false; const nd = [Math.round((lm.d[0] / L) * v), Math.round((lm.d[1] / L) * v)];
      this.commit((d) => SEL.translate(d, lm.keys, nd[0] - lm.d[0], nd[1] - lm.d[1]), `ย้ายเป็นระยะ ${this.v.fmtLen(v / 1000)} พอดี`); lm.d = nd; this.selChanged(); return true;
    }
    if (t === "offset" && this.lastOffset && !this.st) {                              // Offset ตามระยะที่พิมพ์ (ทิศเข้า/ออกเดียวกับที่ลากล่าสุด · ลบ = กลับทิศ)
      const lo = this.lastOffset, src = this.doc.masses.find((x) => x.id === lo.src); if (!src || !this.doc.masses.some((x) => x.id === lo.face)) return false;
      const dd = Math.abs(v) * (v < 0 ? -lo.sign : lo.sign), poly = offsetPoly(src.pts, dd);
      this.commit((d) => { const f = d.masses.find((x) => x.id === lo.face); if (f) f.pts = poly; }, `Offset ${dd > 0 ? "ออก" : "เข้า"} ${Math.abs(dd).toLocaleString()} มม. พอดี`); return true;
    }
    if (t === "rotate" && this.sk.S.size) {
      const keys = new Set([...this.sk.S].filter((x) => !x.startsWith("roof:") && !x.startsWith("openings:"))); if (!keys.size) return false;
      const c = SEL.center(this.doc, keys); this.commit((d) => SEL.rotate(d, keys, v, c), `หมุน ${v}° รอบจุดกลาง`); this.selChanged(); return true;
    }
    if (t === "scale") { const st = { c: null, masses: [], items: [] }; const ms = [...this.sk.sel].map((id) => this.doc.masses.find((m) => m.id === id)).filter(Boolean);
      if (!ms.length && !this.itemSel.size) return false; this.host.hist.commit(() => {}); const all = ms.flatMap((m) => m.pts); st.c = all.length ? all.reduce((a, p) => [a[0] + p[0] / all.length, a[1] + p[1] / all.length], [0, 0]) : [0, 0];
      st.masses = ms.map((m) => [m, m.pts.map((p) => p.slice()), m.height, m.base || 0]); st.items = this.doc.items3d.filter((x) => this.itemSel.has(x.id)).map((x) => [x, x.s || 1]); this.applyScale(st, v); this.host.onChange(); return true; }
    if (t === "pushpull" && this.sk.lastPush && !this.sk.drag) return this.sk.pushTyped(v);   // Push/Pull ตามระยะที่พิมพ์ (หน้าที่เพิ่งลาก)
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
    const keys = new Set(this.sk.S);
    if (!keys.size) { this.host.status("เลือกวัตถุก่อน (เครื่องมือ เลือก · คลิกผนัง กล่อง ต้นไม้ ฯลฯ)"); return false; }
    this.clip = SEL.copyOf(this.doc, keys);
    if (cut) { this.commit((d) => SEL.remove(d, keys)); this.sk.S.clear(); this.selChanged(); }
    this.host.status(`${cut ? "ตัด" : "คัดลอก"} ${this.clip.list.length} ชิ้น — Ctrl+V วาง (ห่างเดิม 1 ม. แล้วใช้ ย้าย ปรับ)`); return true;
  }
  paste() {
    if (!this.clip || !this.clip.list.length) return this.host.status("ยังไม่ได้คัดลอก");
    let ks; this.commit((d) => { ks = SEL.paste(d, this.clip, 1000, -1000); }, `วาง ${this.clip.list.length} ชิ้น (ห่างเดิม 1 ม. · ใช้ ย้าย ปรับตำแหน่ง)`);
    this.sk.S.clear(); ks.forEach((k) => this.sk.S.add(k)); this.selChanged();
  }
  removeSel() {
    if (this.sol.deleteSel()) return true;                                // หน้า/เส้นของก้อน (0.27)
    const keys = new Set(this.sk.S); if (!keys.size) return false;
    const n = keys.size, what = n === 1 ? SEL.describe(this.doc, [...keys][0]) : `${n} ชิ้น`;
    this.commit((d) => SEL.remove(d, keys), `ลบ ${what} (Ctrl+Z ย้อนได้)`); this.sk.S.clear(); this.selChanged(); return true;
  }
  decorate() { this.sol.decorate(); }
  selectedInfo() {
    const its = this.doc.items3d.filter((x) => this.itemSel.has(x.id)); if (!its.length || [...this.sk.S].some((k) => !k.startsWith("items:"))) return null;
    const it = its[0], k = KINDS.find((x) => x.k === it.kind);
    return { n: its.length, th: kindTh(it.kind), size: k ? k.size : "", s: it.s || 1, rot: it.rot || 0, tag: it.tag || "items", p: it.p };
  }
}
