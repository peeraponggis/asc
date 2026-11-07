// เครื่องมือผิว+เส้นแบบ SketchUp ในภาพ 3D — 0.26 (โดย ลุงพี · docs/mockup-0.26-sketchup.html)
// เลือก: คลิก 1 = เส้น/หน้า · 2 = หน้า+ขอบ · 3 = ทั้งก้อน · ก้อนในกลุ่ม: คลิก = ทั้งกลุ่ม · ดับเบิลคลิก = เข้าไปแก้ในกลุ่ม (Esc ออก)
// ลาก (เลือก/ย้าย): หน้า = เข้าออกตามแนวตั้งฉาก ผิวข้างเคียงยืดตาม · เส้น/จุด = ย้ายตามแกนที่ใกล้ทิศเมาส์ (ลูกศร → ← ↑ ล็อกแกน แดง/เขียว/น้ำเงิน · ↓ ปลดล็อก)
// Push/Pull: หน้าใดก็ได้ของก้อน · Ctrl = ดึงสำเนา · ดับเบิลคลิก = ระยะล่าสุด · ทุกงาน: ปล่อยแล้วพิมพ์ระยะ + Enter = พอดี
import * as THREE from "three";
import * as SOL from "./mesh.js?v=0.31.1";
import * as SEL from "./sel3d.js?v=0.31.1";
import * as CSG from "./csg.js?v=0.31.1";

const MM = 0.001;
const W = (p) => new THREE.Vector3(p[0] * MM, p[2] * MM, -p[1] * MM);          // มม. (x,y,z ขึ้น) → three
const AX = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
const AXC = { x: 0xd93a2b, y: 0x2e9b45, z: 0x2f6fd6 }, AXT = { x: "แกนแดง", y: "แกนเขียว", z: "แกนน้ำเงิน" };
const snapTo = (v, s) => Math.round(v / s) * s;

export class SolidTools {
  constructor(view, sk, tools, host) {
    this.v = view; this.sk = sk; this.t = tools; this.host = host;
    this.drag = null; this.last = null; this.click = { n: 0, t: 0, x: 0, y: 0 }; this.lock = null; this.openGid = null;
    // ไฮไลต์วาดในชั้นบน (notesScene · วาดหลังภาพเต็ม ไม่ผ่าน tone mapping) → สีน้ำเงิน/ส้มชัดทุกรูปแบบแสดงผล
    this.hl = new THREE.Group(); this.hl.name = "เลือกผิว/เส้น"; view.notesScene.add(this.hl);
    this.hov = new THREE.Group(); this.hov.name = "ชี้ผิว/เส้น"; view.notesScene.add(this.hov);
    addEventListener("keydown", (e) => this.key(e));
    const build = view.build.bind(view); view.build = (...a) => { const r = build(...a); this.fade(); this.applyClip(); return r; };   // แก้ในกลุ่ม: ส่วนนอกจาง · ระนาบตัดเฉพาะแบบ (0.30)
    this.secPlanes = [];
  }
  get doc() { return this.host.hist.doc; }
  solid(id) { return (this.doc.solids || []).find((s) => s.id === id); }
  status(s) { this.host.status(s); }

  // ---------------------------------------------------------------- ยิงเมาส์
  /** ชี้อะไร: { type: "solids"|"masses", id, fi, kind: "e"|"f"|"v", ref, point } — เส้น/จุดเลือกจากระยะบนจอ (≤ 7 px) */
  pick(e) {
    const ray = this.t.ray; ray.setFromCamera(this.t.ndc(e), this.v.camera);
    const objs = [...this.v.model.children];
    const h = ray.intersectObjects(objs, true).find((x) => x.object.isMesh && !x.object.userData.helper && ["solids", "masses"].includes(x.object.userData.type) && x.object.visible);
    if (!h) return null;
    const u = h.object.userData, out = { type: u.type, id: u.id, point: h.point, dist: h.distance };
    if (u.type === "masses") return out;
    const s = this.solid(u.id); if (!s) return null;
    out.fi = h.object.geometry.userData.faceOfTri ? h.object.geometry.userData.faceOfTri[h.faceIndex] : 0;
    // จุด / เส้นใกล้เมาส์ (เฉพาะที่มองเห็น: ไม่ไกลกว่าผิวที่ชนเกิน 2%)
    const r = this.v.canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, cam = this.v.camera;
    const scr = (p) => { const q = W(p).project(cam); return [((q.x + 1) / 2) * r.width, ((1 - q.y) / 2) * r.height, q.z]; };
    const vis = (p) => W(p).distanceTo(cam.position) <= h.distance * 1.02 + 0.05;
    // เส้น: จุดบนเส้นที่ใกล้แนวเมาส์ที่สุด (3 มิติ) ต้องไม่อยู่หลังผิวที่ชน
    const visSeg = (a, b) => { const P = new THREE.Vector3(), Q = new THREE.Vector3(); ray.ray.distanceSqToSegment(W(a), W(b), P, Q); return P.distanceTo(ray.ray.origin) <= h.distance * 1.02 + 0.05; };
    let bv = -1, bvd = 9;
    s.verts.forEach((p, i) => { const q = scr(p); const d = Math.hypot(q[0] - mx, q[1] - my); if (d < bvd && vis(p)) { bvd = d; bv = i; } });
    if (bv >= 0 && this.wantVerts) { out.kind = "v"; out.ref = String(bv); return out; }
    let be = null, bed = 7; const soft = s.terrain ? new Set(s.soft || []) : null;      // ภูมิประเทศ: เส้นนุ่มไม่ให้คลิกโดน (คลิก = หน้า)
    for (const [k, E] of SOL.edges(s)) {
      if (soft && soft.has(k)) continue;
      const a = scr(s.verts[E.a]), b = scr(s.verts[E.b]), dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((mx - a[0]) * dx + (my - a[1]) * dy) / L2)), d = Math.hypot(a[0] + dx * t - mx, a[1] + dy * t - my);
      if (d < bed && visSeg(s.verts[E.a], s.verts[E.b])) { bed = d; be = k; }
    }
    if (be) { out.kind = "e"; out.ref = be; return out; }
    out.kind = "f"; out.ref = String(out.fi); return out;
  }
  inOpenGroup(o) { return !o.gid || o.gid === this.openGid; }
  /** กล่องยืด → ผิว+เส้น (ครั้งแรกที่แก้ระดับหน้า/เส้น) · คืน id ใหม่ */
  convert(mid) {
    const m = this.doc.masses.find((x) => x.id === mid); if (!m) return null;
    const s = SOL.fromMass(m);
    this.host.hist.commit((d) => { d.masses = d.masses.filter((x) => x.id !== mid); (d.solids = d.solids || []).push(s); });
    for (const k of [...this.sk.S]) if (k === "masses:" + mid) { this.sk.S.delete(k); this.sk.S.add("solids:" + s.id); }
    this.host.onChange();
    return s.id;
  }
  groupKeys(gid) {
    return [...this.doc.masses.filter((m) => m.gid === gid).map((m) => "masses:" + m.id), ...(this.doc.solids || []).filter((s) => s.gid === gid).map((s) => "solids:" + s.id)];
  }
  subKeys(s, kind, ref) {
    const id = s.id;
    if (kind === "f") return [`solids:${id}:f:${ref}`];
    if (kind === "e") return [`solids:${id}:e:${ref}`];
    return [`solids:${id}:v:${ref}`];
  }

  // ---------------------------------------------------------------- เมาส์ (เรียกจาก tools3d.js ก่อน · คืน true = จัดการแล้ว)
  down(e) {
    if (e.button !== 0) return false;
    const tool = this.t.tool;
    if (this.secPick) { this.wantVerts = false; const h = this.pick(e); if (h && h.type === "solids") { e.stopImmediatePropagation(); return this.sectionAt(e, h); } }
    if (this.rot) { e.stopImmediatePropagation(); this.wantVerts = true; return this.rotClick(e, this.pick(e)); }
    if (this.smOn) { this.wantVerts = false; const h = this.pick(e); if (h && h.type === "solids" && this.solid(h.id).terrain) { e.stopImmediatePropagation(); return this.smooveDown(e, h); } return false; }
    if (tool === "rotate") { this.wantVerts = true; const h = this.pick(e); if (h && h.type === "solids" && this.inOpenGroup(this.solid(h.id))) { e.stopImmediatePropagation(); return this.rotClick(e, h); } }
    if (tool === "scale" && (this.selSolidsQuick() || (() => { const h = this.pick(e); return h && h.type === "solids"; })())) { e.stopImmediatePropagation(); return this.scaleDown(e); }
    if (tool === "follow") { this.wantVerts = false; const h = this.pick(e); if (h && h.type === "solids" && this.pathSel()) { e.stopImmediatePropagation(); return this.followAt(e, h); } }
    // สี่เหลี่ยมบนหน้าแบบคลิก-คลิก: คลิกที่สอง = มุมตรงข้าม
    if (this.drag && this.drag.kind === "frect" && this.drag.clicked) { e.stopImmediatePropagation(); this.drag.clicked = false; this.drag.second = true; return true; }
    if (!["select", "move", "pushpull", "eraser", "paint", "rect", "offset", "tape"].includes(tool)) return false;
    if (["eraser", "paint", "rect", "offset", "tape"].includes(tool)) {
      this.wantVerts = false; const h = this.pick(e);
      if (!h || h.type !== "solids") return false;                       // กล่องยืด/ที่ว่าง: เครื่องมือเดิม
      const s0 = this.solid(h.id); if (!this.inOpenGroup(s0)) return false;
      if (tool === "tape" && h.kind !== "e") return false;                // ตลับเมตรวัดระยะ: แบบเดิม · คลิกเส้น = เส้นไกด์
      e.stopImmediatePropagation();
      if (tool === "eraser") { this.eraseAt(e, h); return true; }
      if (tool === "paint") { this.paintAt(e, h); return true; }
      if (tool === "tape") return this.guideStart(e, h);
      return this.faceDrawStart(e, h, tool === "rect" ? "frect" : "foffset");
    }
    this.wantVerts = tool === "move";                                   // จุด: เฉพาะเครื่องมือย้าย (แบบ SketchUp)
    let h = this.pick(e);
    // นับคลิก (ดับเบิล/สามครั้ง) ที่ตำแหน่งเดิม
    const now = performance.now(), c = this.click;
    c.n = now - c.t < 420 && Math.hypot(e.clientX - c.x, e.clientY - c.y) < 6 ? c.n + 1 : 1; c.t = now; c.x = e.clientX; c.y = e.clientY;
    if (!h) { if (tool === "select" && this.openGid && c.n === 1) { /* คลิกที่ว่างในกลุ่ม: ยกเลิกเลือก (ยังอยู่ในกลุ่ม) */ } return false; }
    const obj = h.type === "masses" ? this.doc.masses.find((m) => m.id === h.id) : this.solid(h.id); if (!obj) return false;
    // ก้อนในกลุ่มที่ปิดอยู่: คลิก = ทั้งกลุ่ม (ทำแบบเดิม) · ดับเบิลคลิก = เข้าไปแก้ในกลุ่ม
    if (obj.gid && obj.gid !== this.openGid) {
      if (tool === "select" && c.n >= 2) { this.openGid = obj.gid; this.status("แก้ไขในกลุ่ม — คลิกเส้น/หน้าได้ทีละชิ้น · ส่วนนอกกลุ่มจาง · Esc = ออกจากกลุ่ม"); this.v.build(); return true; }
      if (h.type === "masses" || tool !== "select") return false;
      e.stopImmediatePropagation(); this.sk.S.clear(); this.groupKeys(obj.gid).forEach((k) => this.sk.S.add(k)); this.t.selChanged(); return true;
    }
    if (tool === "pushpull") return this.ppStart(e, h, c.n);
    // เลือก/ย้าย: กล่องยืดแปลงเป็นผิว+เส้นก่อน (1 ขั้นย้อนได้)
    if (tool === "move") {
      // ย้าย (แบบ SketchUp): ทั้งก้อนถูกเลือก = ย้ายทั้งก้อน (tools3d.js) · ชี้หน้า/เส้น/จุดของก้อน = ยืดสิ่งนั้น (ที่เลือกไว้ก่อน = ยืดทั้งชุด)
      if (h.type !== "solids") return false;
      const s = this.solid(h.id); if (this.sk.S.has("solids:" + s.id)) return false;
      e.stopImmediatePropagation();
      if (!this.isSelected(s, h)) { this.sk.S.clear(); this.subKeys(s, h.kind, h.ref).forEach((k) => this.sk.S.add(k)); this.t.selChanged(); }
      this.stretchStart(e, s, h); return true;
    }
    if (h.type === "masses") { const nid = this.convert(h.id); if (!nid) return false; h = this.pick(e); if (!h || h.type !== "solids") return true; }
    const s = this.solid(h.id); e.stopImmediatePropagation();
    {
      let ks;
      if (c.n >= 3) ks = ["solids:" + s.id];
      else if (c.n === 2) {
        const E = SOL.edges(s);
        if (h.kind === "e") ks = [`solids:${s.id}:e:${h.ref}`, ...E.get(h.ref).faces.map((f) => `solids:${s.id}:f:${f}`)];
        else { const fi = h.fi; ks = [`solids:${s.id}:f:${fi}`]; for (const [k, x] of E) if (x.faces.includes(fi)) ks.push(`solids:${s.id}:e:${k}`); }
      } else ks = this.subKeys(s, h.kind, h.ref);
      if (e.shiftKey || e.ctrlKey) { const all = ks.every((x) => this.sk.S.has(x)); ks.forEach((x) => (all ? this.sk.S.delete(x) : this.sk.S.add(x))); }
      else { this.sk.S.clear(); ks.forEach((x) => this.sk.S.add(x)); }
      this.t.selChanged();
    }
    // กดค้างที่ของที่เลือกแล้วลาก = ย้าย/ยืด
    if (this.isSelected(s, h) && c.n === 1) this.stretchStart(e, s, h);
    return true;
  }
  selSolidsQuick() { for (const k of this.sk.S) if (k.startsWith("solids:") && !SEL.isSub(k)) return true; return false; }
  isSelected(s, h) { const k = `solids:${s.id}`; return this.sk.S.has(`${k}:${h.kind}:${h.ref}`) || (h.kind === "f" && this.sk.S.has(`${k}:f:${h.fi}`)); }

  /** จุดที่ย้ายตามสิ่งที่เลือกในก้อนนี้ */
  selVerts(s) {
    const out = new Set(), pre = `solids:${s.id}:`;
    for (const k of this.sk.S) {
      if (!k.startsWith(pre)) continue; const [kind, ref] = k.slice(pre.length).split(":");
      if (kind === "f" && s.faces[+ref]) SOL.faceVerts(s, +ref).forEach((i) => out.add(i));
      else if (kind === "e") ref.split("-").map(Number).forEach((i) => out.add(i));
      else if (kind === "v") out.add(+ref);
    }
    return [...out];
  }

  // ---------------------------------------------------------------- ย้าย/ยืด
  stretchStart(e, s, h) {
    if (s.locked) { this.status("⚠ ก้อนนี้ล็อกอยู่ — ปลดล็อก: เครื่องมือ → ล็อก/ปลดล็อก"); return; }
    const vis = this.selVerts(s); if (!vis.length) return;
    const onlyFace = [...this.sk.S].filter((k) => k.startsWith(`solids:${s.id}:`)).every((k) => k.includes(":f:")) && h.kind === "f";
    const n = onlyFace ? SOL.normal(s, h.fi) : null;
    this.drag = { kind: "stretch", id: s.id, vis, orig: JSON.parse(JSON.stringify(s)), p0: h.point.clone(), x0: e.clientX, y0: e.clientY, n, moved: false, dist: 0, axis: null, committed: false };
    this.v.controls.enabled = false; try { this.v.canvas.setPointerCapture(e.pointerId); } catch (err) { /* ไม่มี pointer จริง */ }
  }
  /** ทิศที่ย้าย: ล็อกแกน → แกนนั้น · หน้าเดียว → ตั้งฉากหน้า · อื่น ๆ → แกนที่ใกล้ทิศเมาส์บนจอที่สุด */
  dirOf(d, e) {
    if (this.lock) return { v: AX[this.lock], name: this.lock };
    if (d.n) return { v: d.n, name: "n" };
    const r = this.v.canvas.getBoundingClientRect(), cam = this.v.camera, P = d.p0, mx = e.clientX - d.x0, my = e.clientY - d.y0;
    let best = "x", bs = -1;
    for (const k of ["x", "y", "z"]) {
      const a = P.clone().project(cam), b = P.clone().add(W(AX[k].map((v) => v * 1000))).project(cam);
      const sx = ((b.x - a.x) / 2) * r.width, sy = (-(b.y - a.y) / 2) * r.height, L = Math.hypot(sx, sy) || 1;
      const sc = Math.abs((mx * sx + my * sy) / L);
      if (sc > bs) { bs = sc; best = k; }
    }
    return { v: AX[best], name: best };
  }
  /** ระยะตามแนว dir จากเมาส์ (มม.) — ระนาบที่มีแนวนั้นและหันหากล้อง */
  distAlong(e, P0, dir) {
    const ray = this.t.ray; ray.setFromCamera(this.t.ndc(e), this.v.camera);
    const D = W(dir).normalize().multiplyScalar(1000), camDir = this.v.camera.position.clone().sub(P0);
    const pn = camDir.clone().sub(D.clone().multiplyScalar(camDir.dot(D) / D.lengthSq())).normalize();
    const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(pn, P0), X = new THREE.Vector3();
    if (!ray.ray.intersectPlane(pl, X)) return null;
    return X.sub(P0).dot(D.normalize()) / MM;
  }
  move(e) {
    if (this.rot) { e.stopImmediatePropagation(); this.rotMove(e); return true; }
    const d = this.drag;
    if (!d && this.smOn) { if (e.buttons === 0) this.smHover(e); return false; }
    if (d && d.kind === "smoove") { e.stopImmediatePropagation(); this.smooveMove(e); return true; }
    if (!d) { if (e.buttons === 0 && ["select", "move", "pushpull", "eraser"].includes(this.t.tool)) this.hover(e); return false; }
    if (d.kind === "scale") { e.stopImmediatePropagation(); this.scaleMove(e); return true; }
    if (d.kind === "sec") { e.stopImmediatePropagation(); this.sectionMove(e); return true; }
    e.stopImmediatePropagation();
    if (d.kind === "frect" || d.kind === "foffset") { if (e.buttons || d.clicked) d.moved = d.moved || Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 4; this.faceDrawMove(e); return true; }
    if (d.kind === "guide") { d.moved = true; this.guideMove(e); return true; }
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 4) return true;
    if (!d.moved) { d.moved = true; this.host.hist.commit(() => {}); d.committed = true; }
    const dir = this.dirOf(d, e), raw = this.distAlong(e, d.p0, dir.v); if (raw == null) return true;
    const dist = e.shiftKey ? Math.round(raw) : snapTo(raw, 10); d.dist = dist; d.axis = dir;
    this.apply(d, dist);
    const what = d.kind === "pp" ? "Push/Pull" : "ย้าย/ยืด", ax = dir.name === "n" ? "ตั้งฉากหน้า" : AXT[dir.name];
    this.status(`${what}: ${dist > 0 ? "" : "−"}${Math.abs(dist).toLocaleString()} มม. (${ax}${this.lock ? " · ล็อก" : ""})${d.kind === "pp" && d.copy ? " · Ctrl = ดึงสำเนา" : ""}${this.folded ? ` · พับหน้าเอียง ${this.folded} หน้า` : ""} — ลูกศร → ← ↑ ล็อกแกน · ปล่อยแล้วพิมพ์ระยะ + Enter`);
    return true;
  }
  apply(d, dist) {
    const s = d.orig; let out;
    if (d.kind === "pp") {
      const depth = dist < 0 && !d.copy ? this.throughDepth(s, d.fi) : Infinity;
      out = -dist >= depth - 1 ? SOL.pushThrough(s, d.fi) || SOL.pushPull(s, d.fi, dist) : SOL.pushPull(s, d.fi, dist, { copy: d.copy });   // ดันถึงหน้าตรงข้าม = เจาะทะลุ
      d.through = -dist >= depth - 1;
    }
    else out = SOL.moveVerts(s, d.vis, d.axis.v.map((v) => v * dist));
    this.folded = out._folded || 0; delete out._folded;
    const L = this.doc.solids, i = L.findIndex((x) => x.id === d.id); if (i >= 0) L[i] = out;
    this.v.build();
  }
  up(e) {
    const d = this.drag; if (!d) return false;
    e.stopImmediatePropagation();
    if (d.kind === "frect" && !d.moved && !d.second) { d.clicked = true; this.status("สี่เหลี่ยมบนหน้า: คลิกมุมตรงข้าม (Esc = ยกเลิก)"); return true; }
    if (d.kind === "frect" || d.kind === "foffset") { this.faceDrawEnd(); return true; }
    if (d.kind === "guide") { this.guideEnd(); return true; }
    if (d.kind === "scale") { this.drag = null; this.v.controls.enabled = true; this.lastScale = d; this.host.onChange(); this.t.selChanged(); this.syncComp(d.orig, d.id); return true; }
    if (d.kind === "smoove") { this.drag = null; this.v.controls.enabled = true; this.lastSm = d; this.clear(this.hov); this.host.onChange(); this.status(`ดันพื้น ${(d.dz || 0).toLocaleString()} มม. รัศมี ${this.smR.toLocaleString()} มม. — พิมพ์ความสูง + Enter แก้ให้พอดี · Esc = ออก`); return true; }
    if (d.kind === "sec") { this.drag = null; this.v.controls.enabled = true; if (d.plane) this.secPlanes.push(d.plane); this.status(`ระนาบตัดลึก ${d.off.toLocaleString()} มม. (${this.secPlanes.length} ระนาบ) — สั่งซ้ำเพื่อเพิ่มระนาบ · ล้าง: เครื่องมือ → ล้างระนาบตัด`); return true; }
    this.drag = null; this.v.controls.enabled = true;
    if (!d.moved) { if (d.committed) this.host.hist.undo(); return true; }
    this.last = { ...d }; this.t.lastMove = null; this.sk.lastPush = null;
    if (d.kind === "pp") { this.lastPP = d.dist; this.prune(d.id); }
    this.syncComp(d.orig, d.id);
    this.host.onChange(); this.t.selChanged();
    this.status(`${d.kind === "pp" ? "Push/Pull" : "ย้าย/ยืด"} ${d.dist.toLocaleString()} มม. — พิมพ์ระยะ + Enter เพื่อแก้ให้พอดี`);
    return true;
  }
  /** ลบกุญแจหน้า/เส้นที่ไม่มีแล้ว (หลังรูปเปลี่ยน) */
  prune(id) {
    const s = this.solid(id); if (!s) return; const E = SOL.edges(s);
    for (const k of [...this.sk.S]) { const p = SEL.sub(k); if (p.id !== id || !p.kind) continue; if ((p.kind === "f" && !s.faces[+p.ref]) || (p.kind === "e" && !E.has(p.ref)) || (p.kind === "v" && !s.verts[+p.ref])) this.sk.S.delete(k); }
  }
  /** งานแบบเดิม (ย้ายทั้งชิ้น · Push/Pull กล่องยืด) เพิ่งทำ → ค่าที่พิมพ์ต่อเป็นของงานนั้น ไม่ใช่ของผิว+เส้น */
  forget() { this.lastSm = null; this.last = null; this.lastRot = null; this.lastScale = null; this.lastGuide = null; this.lastFace = null; }
  /** พิมพ์ระยะ + Enter หลังลาก */
  typed(v) {
    if (!isFinite(v) || this.drag) return false;
    if (this.smOn) {                                                    // ดันพื้น: ก่อนดัน = รัศมี · หลังดัน = ความสูงพอดี
      const L = this.lastSm;
      if (!L) { if (v <= 0) return true; this.smR = Math.round(v); this.status(`ดันพื้น: รัศมี ${this.smR.toLocaleString()} มม. — คลิกค้างบนพื้นแล้วลากขึ้น/ลง`); return true; }
      const i = this.doc.solids.findIndex((x) => x.id === L.id); if (i >= 0) this.doc.solids[i] = SOL.smoove(L.orig, L.c, L.r, v);
      L.dz = v; this.clear(this.hov); this.host.onChange(); this.status(`ดันพื้น ${v.toLocaleString()} มม. พอดี (รัศมี ${L.r.toLocaleString()} มม.)`); return true;
    }
    if (this.t.tool === "tape" && this.lastGuide) {                     // เส้นไกด์: ระยะจากขอบพอดี
      const G = this.lastGuide; this.host.hist.commit((x) => { const g = (x.guides || []).find((q) => q.id === G.id); if (g) g.p = SOL.V.add(G.A, SOL.V.mul(G.off, v)).map(Math.round); });
      this.host.onChange(); this.status(`เส้นไกด์ห่าง ${v.toLocaleString()} มม. พอดี`); return true;
    }
    if (this.t.tool === "offset" && this.lastFace && this.lastFace.kind === "foffset") {   // Offset บนหน้า: ระยะเข้าพอดี
      const F = this.lastFace, s = F.orig, L0 = s.faces[F.fi].loops[0].map((i) => [SOL.V.dot(s.verts[i], F.b.u), SOL.V.dot(s.verts[i], F.b.v)]), off = SOL.V.dot(F.o, F.n);
      const O = offset2(L0, -Math.abs(v)), sa = (Q) => Q.reduce((t, q, i) => t + q[0] * Q[(i + 1) % Q.length][1] - Q[(i + 1) % Q.length][0] * q[1], 0);
      if (Math.sign(sa(O)) !== Math.sign(sa(L0)) || Math.abs(sa(O)) < 2e4) { this.status(`⚠ Offset เข้า ${Math.abs(v).toLocaleString()} มม. เกินครึ่งความกว้างหน้า — ไม่ได้เปลี่ยน`); return true; }
      const pts = O.map(([u, w]) => SOL.V.add(SOL.V.add(SOL.V.mul(F.b.u, u), SOL.V.mul(F.b.v, w)), SOL.V.mul(F.n, off)).map(Math.round));
      const r = SOL.addInnerFace(s, F.fi, pts); if (!r) { this.status("ระยะนี้ทำให้รูปออกนอกหน้า — ไม่ได้เปลี่ยน"); return true; }
      this.host.hist.commit((x) => { const i = x.solids.findIndex((q) => q.id === s.id); if (i >= 0) x.solids[i] = r.s; });
      this.host.onChange(); this.status(`Offset เข้า ${Math.abs(v).toLocaleString()} มม. พอดี`); return true;
    }
    if (this.t.tool === "rotate" && this.lastRot) { this.host.hist.commit(() => {}); this.rotApply(this.lastRot, v); this.host.onChange(); this.status(`หมุน ${v}° พอดี`); return true; }
    if (this.t.tool === "scale" && this.lastScale) {
      const d = this.lastScale; if (!v) { this.status("⚠ ตัวคูณต้องไม่เป็น 0 — ไม่ได้เปลี่ยน"); return true; }
      const before = JSON.parse(JSON.stringify(this.solid(d.id) || d.orig)), F = d.g.map((g) => (g === 0 ? 1 : v)); this.host.hist.commit((x) => { const i = x.solids.findIndex((q) => q.id === d.id); if (i >= 0) x.solids[i] = SOL.scaleAxes(d.orig, d.anchor, F); });
      this.host.onChange(); this.syncComp(before, d.id); this.status(`ย่อขยาย ${F.join(" × ")} พอดี`); return true;
    }
    const L = this.last; if (!L) return false;
    if (!["select", "move", "pushpull"].includes(this.t.tool)) return false;
    const before = JSON.parse(JSON.stringify(this.solid(L.id) || L.orig));      // Component: เทียบกับรูปก่อนพิมพ์ (หลังลาก)
    this.host.hist.commit(() => {}); this.apply(L, v); L.dist = v; this.syncComp(before, L.id);
    if (L.kind === "pp") { this.lastPP = v; this.prune(L.id); }
    this.host.onChange(); this.t.selChanged();
    this.status(`${L.kind === "pp" ? "Push/Pull" : "ย้าย/ยืด"} ${v.toLocaleString()} มม. พอดี`);
    return true;
  }

  // ---------------------------------------------------------------- Push/Pull ผิว+เส้น
  ppStart(e, h, n) {
    if (h.type === "masses") return false;                               // กล่องยืด: ใช้ Push/Pull แบบเดิม (sketch3d.js)
    const s = this.solid(h.id); if (!s) return false; e.stopImmediatePropagation();
    if (s.locked) { this.status("⚠ ก้อนนี้ล็อกอยู่"); return true; }
    if (n >= 2 && this.lastPP) {                                        // ดับเบิลคลิก = ระยะล่าสุด
      if (this.drag) { this.drag = null; }
      this.host.hist.commit(() => {}); const d = { kind: "pp", id: s.id, fi: h.fi, orig: JSON.parse(JSON.stringify(s)), copy: e.ctrlKey };
      this.apply(d, this.lastPP); this.last = { ...d, dist: this.lastPP }; this.prune(s.id); this.host.onChange();
      this.status(`Push/Pull ระยะเดิม ${this.lastPP.toLocaleString()} มม.`); return true;
    }
    this.drag = { kind: "pp", id: s.id, fi: h.fi, orig: JSON.parse(JSON.stringify(s)), p0: h.point.clone(), x0: e.clientX, y0: e.clientY, n: SOL.normal(s, h.fi), copy: e.ctrlKey, moved: false, dist: 0, committed: false };
    this.v.controls.enabled = false; try { this.v.canvas.setPointerCapture(e.pointerId); } catch (err) { /* */ }
    return true;
  }

  // ---------------------------------------------------------------- คีย์
  key(e) {
    if (e.target && e.target.matches && e.target.matches("input, select, textarea")) return;
    const m = { ArrowRight: "x", ArrowLeft: "y", ArrowUp: "z" }[e.key];
    if (m && ["move", "select", "pushpull", "line"].includes(this.t.tool)) { e.preventDefault(); this.lock = this.lock === m ? null : m; this.status(this.lock ? `ล็อก${AXT[m]} — กดซ้ำหรือลูกศรลง = ปลดล็อก` : "ปลดล็อกแกน"); return; }
    if (e.key === "ArrowDown" && this.lock) { e.preventDefault(); this.lock = null; this.status("ปลดล็อกแกน"); }
  }
  cancel() {
    if (this.drag) { const d = this.drag; this.drag = null; this.v.controls.enabled = true; this.clear(this.hov); if (d.committed) this.host.hist.undo(); this.host.onChange(); return true; }
    if (this.chain) { this.lineFinish(true); return false; }
    if (this.smOn) { this.smOn = false; this.lastSm = null; this.clear(this.hov); this.v.invalidate(); this.status("ออกจากดันพื้นแล้ว"); return true; }
    if (this.openGid) { this.openGid = null; this.status("ออกจากกลุ่มแล้ว"); this.v.build(); this.decorate(); return true; }
    return false;
  }

  // ---------------------------------------------------------------- ไฮไลต์
  clear(g) { g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); g.clear(); }
  /** ลายจุดน้ำเงินแบบ SketchUp (หน้าที่เลือก) */
  dots(color) {
    const key = "_dots" + color; if (this[key]) return this[key];
    const c = document.createElement("canvas"); c.width = c.height = 8; const g = c.getContext("2d");
    g.fillStyle = color === 0x2f7bff ? "rgba(47,123,255,0.22)" : "rgba(232,137,43,0.22)"; g.fillRect(0, 0, 8, 8); g.fillStyle = color === 0x2f7bff ? "#1d5fe0" : "#c46a10"; g.fillRect(1, 1, 2, 2); g.fillRect(5, 5, 2, 2);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
    return (this[key] = t);
  }
  faceMesh(s, fi, color, op) {
    const pos = [], uv = [], b = SOL.basis(SOL.normal(s, fi));
    for (const t of SOL.triangulate(s, fi)) for (const i of t) { const p = W(s.verts[i]); pos.push(p.x, p.y, p.z); uv.push(SOL.V.dot(s.verts[i], b.u) / 160, SOL.V.dot(s.verts[i], b.v) / 160); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: this.dots(color), color: 0xffffff, transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false, depthTest: false, toneMapped: false }));
    m.renderOrder = 5; m.raycast = () => {}; return m;
  }
  edgeMesh(a, b, color) {
    const A = W(a), B = W(b), L = A.distanceTo(B); if (L < 1e-6) return null;
    const r = Math.max(0.012, this.v.camera.position.distanceTo(A.clone().add(B).multiplyScalar(0.5)) * 0.0025);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 6, 1), new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.95, toneMapped: false }));
    m.position.copy(A.clone().add(B).multiplyScalar(0.5)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    m.renderOrder = 6; m.raycast = () => {}; return m;
  }
  dot(p, color) { const r = Math.max(0.03, this.v.camera.position.distanceTo(W(p)) * 0.006), m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), new THREE.MeshBasicMaterial({ color, depthTest: false, toneMapped: false })); m.position.copy(W(p)); m.renderOrder = 7; m.raycast = () => {}; return m; }
  decorate() {
    this.clear(this.hl);
    for (const k of this.sk.S) {
      const p = SEL.sub(k); if (!k.startsWith("solids:") || !p.kind) continue;
      const s = this.solid(p.id); if (!s) continue;
      if (p.kind === "f" && s.faces[+p.ref]) this.hl.add(this.faceMesh(s, +p.ref, 0x2f7bff, 0.32));
      if (p.kind === "e") { const [a, b] = p.ref.split("-").map(Number); if (s.verts[a] && s.verts[b]) { const m = this.edgeMesh(s.verts[a], s.verts[b], 0x2f7bff); m && this.hl.add(m); } }
      if (p.kind === "v" && s.verts[+p.ref]) this.hl.add(this.dot(s.verts[+p.ref], 0x2f7bff));
    }
    if (!this.gd) { this.gd = new THREE.Group(); this.gd.name = "เส้นไกด์"; this.v.notesScene.add(this.gd); }
    this.clear(this.gd); for (const g of this.doc.guides || []) this.gd.add(this.guideLine(g.p, g.d));
    if (this.openGid) {                                                  // กำลังแก้ในกลุ่ม: กรอบประรอบกลุ่ม
      const box = new THREE.Box3(); for (const s of this.doc.solids || []) if (s.gid === this.openGid) s.verts.forEach((p) => box.expandByPoint(W(p)));
      if (!box.isEmpty()) { const bh = new THREE.Box3Helper(box, 0x888888); bh.material.depthTest = false; bh.raycast = () => {}; this.hl.add(bh); }
    }
    this.v.invalidate();
  }
  hover(e) {
    const h = this.pick(e); this.clear(this.hov);
    if (h && h.type === "solids") {
      const s = this.solid(h.id);
      if (s && this.inOpenGroup(s)) {
        if (h.kind === "e") { const [a, b] = h.ref.split("-").map(Number); const m = this.edgeMesh(s.verts[a], s.verts[b], 0xe8892b); m && this.hov.add(m); }
        else if (h.kind === "v") this.hov.add(this.dot(s.verts[+h.ref], 0xe8892b));
        else if (this.t.tool === "pushpull") this.hov.add(this.faceMesh(s, h.fi, 0xe8892b, 0.25));
      }
    }
    this.v.invalidate();
  }
}

// ================================================================ ขั้น B (0.27): แบ่ง/ตัด · ยางลบ · ลบ · ถังสี · สี่เหลี่ยม/Offset บนหน้า · ทะลุ · เส้นไกด์
const P3 = (q) => [q.p[0], q.p[1], q.z];
const offset2 = (pts, d) => {                                        // ขอบขนาน 2 มิติ (บวก = ออก)
  const n = pts.length, A = pts.reduce((s, p, i) => s + p[0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * p[1], 0) > 0, out = [];
  const nv = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return A ? [dy / l, -dx / l] : [-dy / l, dx / l]; };
  for (let i = 0; i < n; i++) {
    const n1 = nv(pts[(i - 1 + n) % n], pts[i]), n2 = nv(pts[i], pts[(i + 1) % n]), b = [n1[0] + n2[0], n1[1] + n2[1]], bl = Math.hypot(b[0], b[1]) || 1;
    const k = d / Math.max(0.2, (b[0] / bl) * n2[0] + (b[1] / bl) * n2[1]); out.push([pts[i][0] + (b[0] / bl) * k, pts[i][1] + (b[1] / bl) * k]);
  }
  return out;
};
Object.assign(SolidTools.prototype, {
  /** หาก้อน+หน้าที่เส้น a–b (3 มิติ มม.) วางอยู่ (ปลายทั้งสองบนขอบหรือมุม · กลางเส้นอยู่ในหน้า) */
  faceOfSeg(a, b) {
    const m = a.map((v, i) => (v + b[i]) / 2);
    for (const s of this.doc.solids || []) {
      if (!this.inOpenGroup(s)) continue;
      for (let fi = 0; fi < s.faces.length; fi++) {
        const { n, d } = SOL.plane(s, fi);
        if (Math.abs(SOL.V.dot(n, a) - d) > 3 || Math.abs(SOL.V.dot(n, b) - d) > 3 || !SOL.inFace(s, fi, m)) continue;
        return { s, fi, n };
      }
    }
    return null;
  },
  /** เครื่องมือเส้น: ทุกช่วงที่ลากจากขอบถึงขอบบนหน้าของก้อน = แบ่งหน้านั้น (เรียกจาก tools3d.click) · คืน true = ช่วงนี้ใช้แบ่งแล้ว */
  lineSeg(P) {
    if (P.length < 2) return false;
    const a = P3(P[P.length - 2]), b = P3(P[P.length - 1]), hit = this.faceOfSeg(a, b); if (!hit) return false;
    const r = SOL.splitFace(hit.s, hit.fi, a, b); if (!r) return false;
    this.host.hist.commit((d) => { const i = d.solids.findIndex((x) => x.id === hit.s.id); if (i >= 0) d.solids[i] = r.s; });
    this.host.onChange(); this.syncComp(hit.s, hit.s.id);
    if (!this.chain || this.chain.id !== hit.s.id) this.chain = { id: hit.s.id, pts: [a], n: hit.n, segs: 0 };
    this.chain.pts.push(b); this.chain.segs++;
    this.status(`แบ่งหน้าแล้ว (${this.chain.segs} ช่วง) — ลากต่อไปหน้าถัดไปในระนาบเดียวกันเพื่อตัดทั้งก้อน · Enter/ดับเบิลคลิก = จบ · Esc = จบเฉพาะแบ่งหน้า`);
    return true;
  },
  /** จบเส้น: ≥ 2 ช่วงบนหลายหน้าของก้อนเดียวและอยู่ระนาบเดียวกัน = ตัดทั้งก้อนเป็น 2 ส่วน · คืน true = ไม่ต้องสร้างเส้นปกติ */
  lineFinish(cancel) {
    const c = this.chain; this.chain = null; if (!c) return false;
    if (cancel || c.segs < 2) { this.status(c.segs ? "แบ่งหน้าแล้ว — ใช้ Push/Pull ดึงหน้าที่แบ่ง หรือวาดต่อรอบก้อนเพื่อตัด" : ""); return true; }
    const pl = SOL.planeFrom(c.pts, c.n), s = this.solid(c.id);
    if (!pl || !s) { this.status("เส้นไม่อยู่ระนาบเดียวกัน — แบ่งเฉพาะหน้า (ตัดทั้งก้อนต้องลากเส้นในระนาบเดียว)"); return true; }
    const parts = SOL.cutByPlane(s, pl); if (!parts) { this.status("ระนาบของเส้นไม่ผ่านก้อน — แบ่งเฉพาะหน้า"); return true; }
    parts[0].name = `${s.name || "ก้อน"} ก`; parts[1].name = `${s.name || "ก้อน"} ข`;
    this.host.hist.commit((d) => { const i = d.solids.findIndex((x) => x.id === s.id); if (i >= 0) d.solids.splice(i, 1, ...parts); });
    this.sk.S.clear(); this.host.onChange(); this.t.selChanged();
    const v = (x) => (SOL.isClosed(x) ? `${(SOL.volume(x) / 1e9).toFixed(2)} ม.³` : "—");
    this.status(`ตัดก้อนเป็น 2 ส่วน (${v(parts[0])} · ${v(parts[1])}) — คลิก 3 ครั้งที่ส่วนที่ไม่ใช้แล้วกด Delete`);
    return true;
  },
  /** ลบที่เลือกระดับหน้า/เส้น (กด Delete) · คืน true = จัดการแล้ว */
  deleteSel() {
    const by = new Map();
    for (const k of this.sk.S) { const p = SEL.sub(k); if (!k.startsWith("solids:") || !p.kind) continue; if (!by.has(p.id)) by.set(p.id, { f: [], e: [] }); if (p.kind === "f") by.get(p.id).f.push(+p.ref); if (p.kind === "e") by.get(p.id).e.push(p.ref); }
    if (!by.size) return false;
    let nf = 0, ne = 0;
    this.host.hist.commit((d) => {
      for (const [id, x] of by) {
        const i = d.solids.findIndex((s) => s.id === id); if (i < 0) continue;
        let s = d.solids[i];
        if (x.f.length) { s = SOL.eraseFaces(s, x.f); nf += x.f.length; }
        else for (const k of x.e) { s = SOL.eraseEdge(s, k); ne++; }
        if (!s.faces.length) d.solids.splice(i, 1); else d.solids[i] = s;
      }
    });
    this.sk.S.clear(); this.host.onChange(); this.t.selChanged();
    this.status(`ลบ${nf ? ` ${nf} หน้า` : ""}${ne ? ` ${ne} เส้น (หน้าระนาบเดียวกันรวมเป็นหน้าเดียว)` : ""} — Ctrl+Z ย้อนได้`);
    return true;
  },
  /** ยางลบ: เส้น = ลบ (หน้าระนาบเดียวกันรวม) · Shift = ซ่อนเส้น · Ctrl = ทำเส้นนุ่ม */
  eraseAt(e, h) {
    const s = this.solid(h.id); if (!s || h.kind !== "e") { this.status("ยางลบ: คลิกที่เส้นเพื่อลบ (หน้าที่แบ่งรวมกลับ) · ลบทั้งก้อน: เลือกคลิก 3 ครั้งแล้วกด Delete"); return; }
    const k = h.ref;
    if (e.shiftKey || e.ctrlKey) {
      const L = e.shiftKey ? "hidden" : "soft";
      this.host.hist.commit((d) => { const x = d.solids.find((q) => q.id === s.id); if (x) { x[L] = x[L] || []; if (!x[L].includes(k)) x[L].push(k); } });
      this.host.onChange(); this.status(e.shiftKey ? "ซ่อนเส้นแล้ว (เปิดคืนที่ ข้อมูลวัตถุ ของเส้น)" : "ทำเส้นนุ่มแล้ว"); return;
    }
    this.host.hist.commit((d) => { const i = d.solids.findIndex((q) => q.id === s.id); if (i >= 0) d.solids[i] = SOL.eraseEdge(d.solids[i], k); });
    this.host.onChange(); this.syncComp(s, s.id); this.status("ลบเส้นแล้ว — Ctrl+Z ย้อนได้");
  },
  /** ถังสี: คลิก = หน้านั้น · Ctrl = หน้าที่ติดกัน · Shift = แทนทั้งแบบ · Ctrl+Shift = ทั้งก้อน · Alt = ดูดวัสดุจากหน้า */
  paintAt(e, h) {
    const s = this.solid(h.id); if (!s) return;
    const F = s.faces[h.fi];
    if (e.altKey) { const m = (F && F.mat) || s.mat || "white"; this.sk.mat = m; this.status(`ดูดวัสดุ: ${m} — คลิกหน้าอื่นเพื่อทา`); this.host.onChange(); return; }
    const mat = this.sk.mat, eff = (o, f) => (f && f.mat) || o.mat || "";
    if (e.ctrlKey && !e.shiftKey) {                                       // Ctrl: หน้าที่ติดกัน (ผ่านเส้น) ที่วัสดุเดียวกับหน้าที่คลิก
      const want = eff(s, F), E = SOL.edges(s), seen = new Set([h.fi]), st = [h.fi];
      while (st.length) { const f = st.pop(); for (const e2 of E.values()) if (e2.faces.includes(f)) for (const g of e2.faces) if (!seen.has(g) && eff(s, s.faces[g]) === want) { seen.add(g); st.push(g); } }
      this.host.hist.commit((d) => { const x = d.solids.find((q) => q.id === s.id); if (x) for (const f of seen) x.faces[f].mat = mat; });
      this.host.onChange(); this.status(`ทาหน้าที่ติดกัน ${seen.size} หน้า`); return;
    }
    if (e.shiftKey && !e.ctrlKey) {                                       // Shift: ทุกหน้าในแบบที่ใช้วัสดุเดียวกับหน้าที่คลิก (แทนวัสดุ)
      const want = eff(s, F); let n = 0;
      this.host.hist.commit((d) => { for (const x of d.solids || []) x.faces.forEach((f) => { if (eff(x, f) === want) { f.mat = mat; n++; } }); });
      this.host.onChange(); this.status(`แทนวัสดุ "${want || "เดิม"}" ทั้งแบบ ${n} หน้า (Ctrl+Shift = ทั้งก้อน)`); return;
    }
    this.host.hist.commit((d) => { const x = d.solids.find((q) => q.id === s.id); if (!x) return; if (e.shiftKey) { x.mat = mat; x.faces.forEach((f) => delete f.mat); } else if (x.faces[h.fi]) x.faces[h.fi].mat = mat; });
    this.host.onChange(); this.status(e.shiftKey ? "ทาทั้งก้อนแล้ว" : "ทาหน้านี้แล้ว (Ctrl = หน้าที่ติดกัน · Shift = แทนทั้งแบบ · Ctrl+Shift = ทั้งก้อน · Alt = ดูดวัสดุ)");
  },
  /** สี่เหลี่ยม/Offset บนหน้าใดก็ได้ของก้อน: เริ่ม */
  faceDrawStart(e, h, kind) {
    const s = this.solid(h.id); if (!s) return false;
    const n = SOL.normal(s, h.fi), b = SOL.basis(n), P0 = [h.point.x / MM, -h.point.z / MM, h.point.y / MM];
    this.drag = { kind, id: s.id, fi: h.fi, n, b, o: P0, a: [SOL.V.dot(P0, b.u), SOL.V.dot(P0, b.v)], x0: e.clientX, y0: e.clientY, moved: false, clicked: false };
    this.v.controls.enabled = false; return true;
  },
  faceDrawMove(e) {
    const d = this.drag, ray = this.t.ray; ray.setFromCamera(this.t.ndc(e), this.v.camera);
    const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(W(d.n).normalize(), W(d.o)), X = new THREE.Vector3(); if (!ray.ray.intersectPlane(pl, X)) return;
    const p = [X.x / MM, -X.z / MM, X.y / MM], q = [SOL.V.dot(p, d.b.u), SOL.V.dot(p, d.b.v)];
    const back = (u, v) => { const off = SOL.V.dot(d.o, d.n); return SOL.V.add(SOL.V.add(SOL.V.mul(d.b.u, u), SOL.V.mul(d.b.v, v)), SOL.V.mul(d.n, off)); };
    this.clear(this.hov);
    if (d.kind === "frect") {
      const u0 = snapTo(d.a[0], 10), v0 = snapTo(d.a[1], 10), u1 = snapTo(q[0], 10), v1 = snapTo(q[1], 10);
      d.pts = [back(u0, v0), back(u1, v0), back(u1, v1), back(u0, v1)];
      this.status(`สี่เหลี่ยมบนหน้า ${Math.abs(u1 - u0).toLocaleString()} × ${Math.abs(v1 - v0).toLocaleString()} มม. — คลิก/ปล่อยที่มุมตรงข้าม`);
    } else {
      const s = this.solid(d.id), L = s.faces[d.fi].loops[0].map((i) => [SOL.V.dot(s.verts[i], d.b.u), SOL.V.dot(s.verts[i], d.b.v)]);
      const c = L.reduce((t, p2) => [t[0] + p2[0] / L.length, t[1] + p2[1] / L.length], [0, 0]);
      d.dist = snapTo(Math.hypot(q[0] - c[0], q[1] - c[1]) - Math.hypot(d.a[0] - c[0], d.a[1] - c[1]), 10);
      d.pts = offset2(L, d.dist).map(([u, v]) => back(u, v));
      this.status(`Offset ${d.dist < 0 ? "เข้า" : "ออก"} ${Math.abs(d.dist).toLocaleString()} มม. บนหน้า — ปล่อยแล้วพิมพ์ระยะ + Enter ได้`);
    }
    const g = new THREE.BufferGeometry().setFromPoints([...d.pts, d.pts[0]].map(W)); const ln = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xe8892b, depthTest: false, toneMapped: false })); ln.raycast = () => {}; this.hov.add(ln); this.v.invalidate();
  },
  faceDrawEnd() {
    const d = this.drag; this.drag = null; this.v.controls.enabled = true; this.clear(this.hov);
    if (!d.pts) return;
    const s = this.solid(d.id); if (!s) return;
    if (d.kind === "foffset" && d.dist >= 0) { this.status("Offset บนหน้า: ลากเข้าด้านใน (ออกนอกหน้าไม่ได้)"); return; }
    const r = SOL.addInnerFace(s, d.fi, d.pts.map((p) => p.map(Math.round)));
    if (!r) { this.status("รูปที่วาดต้องอยู่ในหน้าทั้งหมด — วาดใหม่ให้อยู่ในขอบหน้า"); return; }
    this.host.hist.commit((x) => { const i = x.solids.findIndex((q) => q.id === s.id); if (i >= 0) x.solids[i] = r.s; });
    this.lastFace = { id: s.id, fi: d.fi, kind: d.kind, orig: s, face: r.face, b: d.b, o: d.o, n: d.n }; this.syncComp(s, s.id);
    this.sk.S.clear(); this.sk.S.add(`solids:${s.id}:f:${r.face}`); this.host.onChange(); this.t.selChanged();
    this.status(`${d.kind === "frect" ? "สี่เหลี่ยม" : "Offset"} บนหน้าแล้ว → ได้หน้าใหม่ (เลือกไว้) — Push/Pull ดันเข้า = ช่องเว้า · ดันทะลุ = ช่องเปิด${d.kind === "foffset" ? " · พิมพ์ระยะ + Enter แก้ระยะ" : ""}`);
  },
  /** ระยะดันทะลุของหน้า (ถึงหน้าตรงข้ามที่ขนาน) — ไม่มี = Infinity */
  throughDepth(s, fi) {
    const n = SOL.normal(s, fi), c = SOL.centroid(s, s.faces[fi].loops[0]); let bd = Infinity;
    s.faces.forEach((G, gi) => { if (gi === fi || SOL.V.dot(SOL.normal(s, gi), n) > -1 + 1e-6) return; const depth = SOL.V.dot(n, c) + SOL.plane(s, gi).d; if (depth > 0.5 && depth < bd && SOL.inFace(s, gi, SOL.V.sub(c, SOL.V.mul(n, depth)))) bd = depth; });
    return bd;
  },

  // ---------------------------------------------------------------- เส้นไกด์ (ตลับเมตร)
  guideStart(e, h) {
    const s = this.solid(h.id); const [a, b] = h.ref.split("-").map(Number), A = s.verts[a], B = s.verts[b], dir = SOL.V.norm(SOL.V.sub(B, A));
    const cands = SOL.edges(s).get(h.ref).faces.map((f) => SOL.V.norm(SOL.V.cross(SOL.normal(s, f), dir)));
    this.drag = { kind: "guide", A, B, dir, cands, p0: h.point.clone(), x0: e.clientX, y0: e.clientY, moved: false, dist: 0 };
    this.v.controls.enabled = false; return true;
  },
  guideMove(e) {
    const d = this.drag, r = this.v.canvas.getBoundingClientRect(), cam = this.v.camera, mx = e.clientX - d.x0, my = e.clientY - d.y0;
    let best = d.cands[0], bs = -1;
    for (const c of d.cands.flatMap((c) => [c, SOL.V.mul(c, -1)])) {
      const a = d.p0.clone().project(cam), b = d.p0.clone().add(W(c.map((v) => v * 1000))).project(cam);
      const sx = ((b.x - a.x) / 2) * r.width, sy = (-(b.y - a.y) / 2) * r.height, sc = (mx * sx + my * sy) / (Math.hypot(sx, sy) || 1);
      if (sc > bs) { bs = sc; best = c; }
    }
    const dist = this.distAlong(e, d.p0, best); if (dist == null) return;
    d.off = best; d.dist = Math.max(0, snapTo(dist, 10));
    this.clear(this.hov); this.hov.add(this.guideLine(SOL.V.add(d.A, SOL.V.mul(best, d.dist)), d.dir, 0xd4a636)); this.v.invalidate();
    this.status(`เส้นไกด์ห่างขอบ ${d.dist.toLocaleString()} มม. — ปล่อยแล้วพิมพ์ระยะ + Enter ได้`);
  },
  guideEnd() {
    const d = this.drag; this.drag = null; this.v.controls.enabled = true; this.clear(this.hov);
    if (!d.off || !d.dist) return;
    const g = { id: SOL.uid("g"), p: SOL.V.add(d.A, SOL.V.mul(d.off, d.dist)).map(Math.round), d: d.dir };
    this.host.hist.commit((x) => { (x.guides = x.guides || []).push(g); });
    this.lastGuide = { id: g.id, A: d.A, off: d.off };
    this.host.onChange(); this.status(`สร้างเส้นไกด์ห่าง ${d.dist.toLocaleString()} มม. — พิมพ์ระยะ + Enter แก้ให้พอดี · ลบทั้งหมด: แก้ไข → ลบเส้นไกด์`);
  },
  guideLine(p, dir, color = 0x666666) {
    const a = W(SOL.V.sub(p, SOL.V.mul(dir, 60000))), b = W(SOL.V.add(p, SOL.V.mul(dir, 60000)));
    const g = new THREE.BufferGeometry().setFromPoints([a, b]); const m = new THREE.LineDashedMaterial({ color, dashSize: 0.25, gapSize: 0.18, depthTest: false, transparent: true, opacity: 0.85, toneMapped: false });
    const l = new THREE.Line(g, m); l.computeLineDistances(); l.raycast = () => {}; return l;
  },
  /** จุดตัดของเส้นไกด์กับเส้นของก้อน (ใช้จับจุดตอนวาด) */
  guideSnaps() {
    const out = [];
    for (const g of this.doc.guides || []) for (const s of this.doc.solids || []) for (const e of SOL.edges(s).values()) {
      const A = s.verts[e.a], B = s.verts[e.b], u = SOL.V.sub(B, A), w0 = SOL.V.sub(A, g.p), a = SOL.V.dot(u, u), b = SOL.V.dot(u, g.d), c = SOL.V.dot(g.d, g.d), dd = SOL.V.dot(u, w0), ee = SOL.V.dot(g.d, w0), den = a * c - b * b;
      if (Math.abs(den) < 1e-9) continue;
      const sc = (b * ee - c * dd) / den, tc = (a * ee - b * dd) / den; if (sc < -1e-6 || sc > 1 + 1e-6) continue;
      const P = SOL.V.add(A, SOL.V.mul(u, sc)), Q = SOL.V.add(g.p, SOL.V.mul(g.d, tc));
      if (SOL.V.len(SOL.V.sub(P, Q)) < 2) out.push(P.map(Math.round));
    }
    return out;
  },
});

// ================================================================ ขั้น C (0.28): Solid Tools · หมุน/ย่อขยายแบบ SketchUp · Follow Me · Component · ระนาบตัดบนหน้า · ซ่อน/ล็อก/แตก/กลับด้าน
Object.assign(SolidTools.prototype, {
  /** ก้อนที่เลือกทั้งก้อน (ตามลำดับที่เลือก) — กล่องยืดที่เลือกแปลงเป็นผิว+เส้นให้ */
  selSolids() {
    const ids = [];
    for (const k of [...this.sk.S]) {
      if (k.startsWith("masses:")) { const id = this.convert(k.slice(7)); if (id) ids.push(id); }
      else if (k.startsWith("solids:") && !SEL.isSub(k)) ids.push(k.slice(7));
    }
    return [...new Set(ids)].map((id) => this.solid(id)).filter(Boolean);
  },
  /** Solid Tools: op = union · subtract · trim · intersect · split · shell */
  solidOp(op) {
    const L = this.selSolids(), TH = { union: "รวม (Union)", subtract: "ลบ (Subtract)", trim: "ตัด (Trim)", intersect: "ตัดกัน (Intersect)", split: "แยก (Split)", shell: "เปลือกนอก (Outer Shell)", faces: "ตัดกันที่ผิว (Intersect Faces)" };
    if (L.length < 2) return this.status(`${TH[op]}: เลือกก้อน 2 ก้อน (คลิก 3 ครั้งก้อนแรก แล้ว Shift+คลิก 3 ครั้งก้อนที่สอง) · ก้อนแรก = ตัวกระทำ`);
    if (L.some((s) => s.locked)) return this.status("⚠ มีก้อนที่ล็อกอยู่ — ปลดล็อกก่อน");
    const [a, b] = L; let out = null, remove = [a.id, b.id];
    if (op === "union" || op === "shell") out = [CSG.union(a, b)];
    else if (op === "subtract") out = [CSG.subtract(a, b)];
    else if (op === "trim") { const r = CSG.trim(a, b); out = r && [r[1]]; remove = [b.id]; }
    else if (op === "intersect") out = [CSG.intersect(a, b)];
    else out = CSG.split(a, b);
    if (!out || !out.length || out.some((x) => !x)) return this.status(`${TH[op]}: ไม่ได้ผล — ก้อนไม่ซ้อนกัน หรือก้อนไม่ปิดสนิท (ตรวจที่ ข้อมูลวัตถุ)`);
    this.host.hist.commit((d) => { d.solids = d.solids.filter((s) => !remove.includes(s.id)); d.solids.push(...out); });
    this.sk.S.clear(); out.forEach((s) => this.sk.S.add("solids:" + s.id)); this.host.onChange(); this.t.selChanged();
    const v = (s) => (SOL.isClosed(s) ? `${(SOL.volume(s) / 1e9).toFixed(2)} ม.³` : "ไม่ปิดสนิท");
    this.status(`${TH[op]} แล้ว → ${out.length} ก้อน (${out.map(v).join(" · ")})`);
  },
  /** ทำเป็น Component: ก้อนที่เลือกเป็นต้นแบบ · สำเนา (Ctrl+ย้าย / คัดลอก-วาง) = ชิ้นเดียวกัน แก้ชิ้นหนึ่งเปลี่ยนทุกชิ้น */
  makeComponent() {
    const L = this.selSolids(); if (!L.length) return this.status("Component: เลือกก้อนก่อน (คลิก 3 ครั้ง)");
    const cid = SOL.uid("c");
    this.host.hist.commit((d) => d.solids.forEach((s) => { if (L.some((x) => x.id === s.id)) s.cid = cid; }));
    this.host.onChange(); this.status(`ทำเป็น Component แล้ว (${L.length} ก้อน) — คัดลอก (Ctrl+ย้าย หรือ Ctrl+C/V) ได้ชิ้นเดียวกัน · แก้ชิ้นใดก็เปลี่ยนทุกชิ้น · แตก Component: เครื่องมือ → แตกกลุ่ม/Component`);
  },
  /** หลังแก้ก้อน (ก่อน → หลัง): Component อื่นที่เป็นสำเนาเลื่อนตำแหน่งของก่อน → เปลี่ยนตาม */
  syncComp(before, afterId) {
    if (!before || !before.cid) return;
    const after = this.solid(afterId); if (!after) return; let n = 0;
    for (const s of this.doc.solids) {
      if (s.id === afterId || s.cid !== before.cid || s.verts.length !== before.verts.length) continue;
      const off = SOL.V.sub(s.verts[0], before.verts[0]);
      if (!s.verts.every((p, i) => SOL.V.len(SOL.V.sub(p, SOL.V.add(before.verts[i], off))) < 2)) continue;   // หมุนแล้ว/รูปไม่ตรง = ไม่ใช่สำเนาเลื่อนตำแหน่ง
      s.verts = after.verts.map((p) => SOL.V.add(p, off).map(Math.round)); s.faces = JSON.parse(JSON.stringify(after.faces)); n++;
    }
    if (n) { this.v.build(); this.status(`แก้ Component แล้ว — เปลี่ยนตามทุกชิ้น (${n + 1} ชิ้น)`); }
  },
  /** ซ่อน · ล็อก · แตก · กลับด้านหน้า (เมนู เครื่องมือ) */
  hideSel() { const L = this.selSolids(); if (!L.length) return this.status("ซ่อน: เลือกก้อนก่อน"); this.host.hist.commit((d) => d.solids.forEach((s) => { if (L.some((x) => x.id === s.id)) s.off = true; })); this.sk.S.clear(); this.host.onChange(); this.t.selChanged(); this.status(`ซ่อน ${L.length} ก้อน — แสดงคืน: เครื่องมือ → แสดงที่ซ่อนทั้งหมด`); },
  unhideAll() { let n = 0; this.host.hist.commit((d) => (d.solids || []).forEach((s) => { if (s.off) { delete s.off; n++; } })); this.host.onChange(); this.status(`แสดงคืน ${n} ก้อน`); },
  lockSel() { const L = this.selSolids(); if (!L.length) return this.status("ล็อก: เลือกก้อนก่อน"); const on = !L[0].locked; this.host.hist.commit((d) => d.solids.forEach((s) => { if (L.some((x) => x.id === s.id)) { if (on) s.locked = true; else delete s.locked; } })); this.host.onChange(); this.status(on ? `ล็อก ${L.length} ก้อน — แก้/ย้ายไม่ได้จนปลดล็อก (สั่งซ้ำ = ปลดล็อก)` : "ปลดล็อกแล้ว"); },
  explodeSel() { const L = this.selSolids(); if (!L.length) return this.status("แตกกลุ่ม/Component: เลือกก้อนก่อน"); this.host.hist.commit((d) => d.solids.forEach((s) => { if (L.some((x) => x.id === s.id)) { delete s.gid; delete s.cid; } })); this.host.onChange(); this.status(`แตกกลุ่ม/Component ${L.length} ก้อน — แก้ทีละก้อนได้`); },
  reverseSel() {
    const by = new Map(); for (const k of this.sk.S) { const p = SEL.sub(k); if (p.kind === "f") { if (!by.has(p.id)) by.set(p.id, []); by.get(p.id).push(+p.ref); } }
    if (!by.size) return this.status("กลับด้านหน้า: เลือกหน้าก่อน (คลิกหน้า)");
    this.host.hist.commit((d) => { for (const [id, f] of by) { const i = d.solids.findIndex((s) => s.id === id); if (i >= 0) d.solids[i] = SOL.reverseFaces(d.solids[i], f); } });
    this.host.onChange(); this.status("กลับด้านหน้าแล้ว");
  },

  // ---------------------------------------------------------------- หมุน (ไม้โปรแทรกเตอร์): คลิกจุดหมุน → คลิกแนวอ้างอิง → หมุนแล้วคลิก (พิมพ์มุม + Enter ได้)
  rotClick(e, h) {
    const P = h ? [h.point.x / MM, -h.point.z / MM, h.point.y / MM] : null;
    if (!this.rot) {
      if (!h || h.type !== "solids") return false;
      const s = this.solid(h.id); if (s.locked) { this.status("⚠ ก้อนนี้ล็อกอยู่"); return true; }
      const sel = this.selSolids(), subV = this.selVerts(s);
      let targets = sel.length ? sel.map((x) => x.id) : [s.id], copied = false;
      if (e.ctrlKey && (sel.length || !subV.length)) {                  // Ctrl = หมุนสำเนา (ต้นฉบับอยู่ที่เดิม)
        const cl = targets.map((id) => ({ ...JSON.parse(JSON.stringify(this.solid(id))), id: SOL.uid("s") }));
        this.host.hist.commit((d) => d.solids.push(...cl)); targets = cl.map((x) => x.id); copied = true;
      }
      const axis = this.lock ? AX[this.lock] : SOL.normal(s, h.fi);
      this.rot = { c: P.map(Math.round), axis, targets, copied, vis: !copied && !sel.length && subV.length ? subV : null, orig: targets.map((id) => JSON.parse(JSON.stringify(this.solid(id)))), step: 1 };
      this.status(`หมุน: แกน${this.lock ? AXT[this.lock] : "ตั้งฉากหน้าที่คลิก"} — คลิกแนวอ้างอิง (ลูกศร → ← ↑ เปลี่ยนแกนก่อนคลิกแรก)`); return true;
    }
    const R = this.rot, Q = P || this.rayPlanePoint(e, R.c, R.axis); if (!Q) return true;
    if (R.step === 1) { R.ref = SOL.V.sub(Q, R.c); R.step = 2; if (!R.copied) this.host.hist.commit(() => {}); this.status("หมุน: ขยับเมาส์แล้วคลิกเพื่อจบ (พิมพ์มุม + Enter ได้ · ลบ = ตามเข็ม)"); return true; }
    this.rot = null; this.lastRot = { ...R }; if (R.copied) { this.sk.S.clear(); R.targets.forEach((id) => this.sk.S.add("solids:" + id)); } this.host.onChange(); this.t.selChanged(); this.status(`หมุน${R.copied ? "สำเนา" : ""} ${R.deg ?? 0}° แล้ว — พิมพ์มุม + Enter แก้ให้พอดี`); return true;
  },
  rayPlanePoint(e, c, n) { const ray = this.t.ray; ray.setFromCamera(this.t.ndc(e), this.v.camera); const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(W(n).normalize(), W(c)), X = new THREE.Vector3(); return ray.ray.intersectPlane(pl, X) ? [X.x / MM, -X.z / MM, X.y / MM] : null; },
  rotMove(e) {
    const R = this.rot; if (!R || R.step !== 2) return;
    const Q = this.rayPlanePoint(e, R.c, R.axis); if (!Q) return;
    const a = SOL.V.norm(R.ref), b = SOL.V.norm(SOL.V.sub(Q, R.c)), ang = Math.atan2(SOL.V.dot(SOL.V.cross(a, b), SOL.V.norm(R.axis)), SOL.V.dot(a, b));
    let deg = (ang * 180) / Math.PI; deg = e.shiftKey ? Math.round(deg) : Math.round(deg / 15) * 15 === Math.round(deg) ? Math.round(deg) : Math.round(deg / 5) * 5;
    this.rotApply(R, deg); this.status(`หมุน ${deg}° — คลิกเพื่อจบ (ทีละ 5° · Shift = ทีละ 1°) · พิมพ์มุม + Enter`);
  },
  rotApply(R, deg) {
    R.deg = deg;
    R.targets.forEach((id, k) => { const i = this.doc.solids.findIndex((s) => s.id === id); if (i >= 0) this.doc.solids[i] = SOL.rotateAxis(R.orig[k], R.c, R.axis, deg, R.vis); });
    this.v.build();
  },

  // ---------------------------------------------------------------- ย่อขยาย: จุดจับ 26 ตำแหน่งรอบกรอบก้อน (มุม = ทุกแกนเท่ากัน · กลางขอบ = 2 แกน · กลางหน้า = 1 แกน · Ctrl = จากกึ่งกลาง)
  grips(s) {
    const { lo, hi } = SOL.bbox(s), out = [];
    for (const i of [-1, 0, 1]) for (const j of [-1, 0, 1]) for (const k of [-1, 0, 1]) { if (!i && !j && !k) continue; out.push({ g: [i, j, k], p: [[lo[0], (lo[0] + hi[0]) / 2, hi[0]][i + 1], [lo[1], (lo[1] + hi[1]) / 2, hi[1]][j + 1], [lo[2], (lo[2] + hi[2]) / 2, hi[2]][k + 1]] }); }
    return { out, lo, hi };
  },
  scaleDown(e) {
    const ids = this.selSolids().map((s) => s.id); let s = ids.length ? this.solid(ids[0]) : null;
    if (!s) { const h = this.pick(e); if (!h || h.type !== "solids") return false; s = this.solid(h.id); }
    if (s.locked) { this.status("⚠ ก้อนนี้ล็อกอยู่"); return true; }
    const r = this.v.canvas.getBoundingClientRect(), { out, lo, hi } = this.grips(s), cam = this.v.camera;
    let best = null, bd = 12;
    for (const G of out) { const q = W(G.p).project(cam), d = Math.hypot(((q.x + 1) / 2) * r.width - (e.clientX - r.left), ((1 - q.y) / 2) * r.height - (e.clientY - r.top)); if (d < bd) { bd = d; best = G; } }
    if (!best) { this.scaleTarget = s.id; this.decorate(); this.status("ย่อขยาย: ลากจุดจับสีเขียว — มุม = ทุกแกนเท่ากัน · กลางขอบ = 2 แกน · กลางหน้า = 1 แกน · Ctrl = จากกึ่งกลาง · พิมพ์ตัวคูณ + Enter"); return true; }
    const c = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
    const anchor = e.ctrlKey ? c : best.g.map((g, k) => (g === 0 ? c[k] : g > 0 ? lo[k] : hi[k]));
    this.host.hist.commit(() => {});
    this.drag = { kind: "scale", id: s.id, orig: JSON.parse(JSON.stringify(s)), g: best.g, anchor, gp: best.p, x0: e.clientX, y0: e.clientY, moved: true, committed: true };
    this.v.controls.enabled = false; return true;
  },
  scaleMove(e) {
    const d = this.drag, cam = this.v.camera, r = this.v.canvas.getBoundingClientRect();
    const A = W(d.anchor).project(cam), G = W(d.gp).project(cam), ax = ((A.x + 1) / 2) * r.width, ay = ((1 - A.y) / 2) * r.height, gx = ((G.x + 1) / 2) * r.width, gy = ((1 - G.y) / 2) * r.height;
    const mx = e.clientX - r.left, my = e.clientY - r.top, L0 = Math.hypot(gx - ax, gy - ay) || 1;
    let f = ((mx - ax) * (gx - ax) + (my - ay) * (gy - ay)) / (L0 * L0); f = Math.round(f * 100) / 100; if (Math.abs(f) < 0.01) f = 0.01;
    const F = d.g.map((g) => (g === 0 ? 1 : f)); d.f = F;
    const i = this.doc.solids.findIndex((x) => x.id === d.id); if (i >= 0) this.doc.solids[i] = SOL.scaleAxes(d.orig, d.anchor, F);
    this.v.build(); this.status(`ย่อขยาย ${F.map((x) => x.toFixed(2)).join(" × ")} — ปล่อยแล้วพิมพ์ตัวคูณ + Enter (เช่น 2 หรือ 2,1,0.5)`);
  },

  // ---------------------------------------------------------------- Follow Me: หน้าตัดรูปใดก็ได้ + ทาง (เส้นที่เลือก หรือเส้นของก้อนที่เลือก)
  pathSel() {
    for (const k of this.sk.S) if (k.startsWith("lines:")) { const l = this.doc.lines.find((x) => x.id === k.slice(6)); if (l) { const P = l.pts.map((p) => [p[0], p[1], l.z || 0]); return { pts: l.closed ? P : P, closed: !!l.closed }; } }
    // เส้นของก้อนที่เลือก (ต่อกันเป็นสาย)
    const segs = []; let sid = null;
    for (const k of this.sk.S) { const p = SEL.sub(k); if (p.kind === "e") { sid = p.id; segs.push(p.ref.split("-").map(Number)); } }
    if (!segs.length) return null;
    const s = this.solid(sid), deg = new Map(); for (const [a, b] of segs) { deg.set(a, (deg.get(a) || 0) + 1); deg.set(b, (deg.get(b) || 0) + 1); }
    let start = [...deg.entries()].find(([, n]) => n === 1)?.[0] ?? segs[0][0]; const closed = ![...deg.values()].some((n) => n === 1);
    const used = new Set(), chain = [start];
    for (let g = 0; g < segs.length; g++) { const k = segs.findIndex((sg, i) => !used.has(i) && sg.includes(chain[chain.length - 1])); if (k < 0) break; used.add(k); const [a, b] = segs[k]; chain.push(a === chain[chain.length - 1] ? b : a); }
    if (closed && chain[chain.length - 1] === chain[0]) chain.pop();
    return { pts: chain.map((i) => s.verts[i].slice()), closed };
  },
  followAt(e, h) {
    const path = this.pathSel(); if (!path) return false;
    const s = this.solid(h.id), F = s.faces[h.fi]; if (!F) return false;
    const prof = F.loops[0].map((i) => s.verts[i].slice());
    const sw = SOL.sweep(prof, path.pts, { closed: path.closed, name: "Follow Me", mat: F.mat || s.mat || this.sk.mat });
    if (!sw || !sw.faces.length) { this.status("Follow Me: กวาดไม่ได้ — วางหน้าตัดที่ต้นทางให้ตั้งฉากกับทาง"); return true; }
    const flat = s.faces.length === 1;                                 // หน้าตัดเป็นหน้าแบนเดี่ยว = ใช้แล้วลบทิ้ง (แบบ SketchUp)
    this.host.hist.commit((d) => { if (flat) d.solids = d.solids.filter((x) => x.id !== s.id); d.solids.push(sw); });
    this.sk.S.clear(); this.sk.S.add("solids:" + sw.id); this.host.onChange(); this.t.selChanged();
    this.status(`Follow Me: กวาดหน้าตัด ${prof.length} มุม ตามทาง ${path.pts.length} จุด${path.closed ? " (วงรอบ)" : ""} → ${SOL.isClosed(sw) ? `${(SOL.volume(sw) / 1e9).toFixed(3)} ม.³` : "ก้อนใหม่"}`);
    return true;
  },

  // ---------------------------------------------------------------- ระนาบตัดบนหน้า: คลิกหน้า → ระนาบขนานหน้านั้น · ลากเข้าเพื่อเลื่อน · คลิกจบ
  sectionStart() { this.secPick = true; this.status("ระนาบตัด: คลิกหน้าใดก็ได้ของก้อน แล้วลากเข้าเพื่อเลื่อนระนาบ · คลิกจบ · ล้าง: เครื่องมือ → ล้างระนาบตัด"); },
  sectionAt(e, h) {
    const s = this.solid(h.id), n = SOL.normal(s, h.fi), P = [h.point.x / MM, -h.point.z / MM, h.point.y / MM];
    this.secPick = false; this.drag = { kind: "sec", n, p0: h.point.clone(), P, x0: e.clientX, y0: e.clientY, moved: true, off: 0 }; this.v.controls.enabled = false;
    this.setClip(n, P, 0); return true;
  },
  setClip(n, P, off) {
    const N = W(n).normalize().multiplyScalar(-1), pt = W(SOL.V.sub(P, SOL.V.mul(n, off)));
    const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(N, pt);
    if (this.drag && this.drag.kind === "sec") this.drag.plane = pl;
    this.clipList = [...this.secPlanes, pl]; this.v.renderer.clippingPlanes = []; this.v.section = null; this.applyClip(); this.v.invalidate();
  },
  sectionMove(e) { const d = this.drag, dist = this.distAlong(e, d.p0, SOL.V.mul(d.n, -1)); if (dist == null) return; d.off = Math.max(0, snapTo(dist, 10)); this.setClip(d.n, d.P, d.off); this.status(`ระนาบตัดลึกจากหน้า ${d.off.toLocaleString()} มม. — ปล่อยเพื่อจบ`); },
  sectionClear() { this.secPlanes = []; this.clipList = []; this.applyClip(); this.v.renderer.clippingPlanes = []; this.v.invalidate(); this.status("ล้างระนาบตัดแล้ว"); },
});

// ---------------------------------------------------------------- Sandbox ภูมิประเทศ (0.29): พื้นผิวจากเส้นชั้นความสูง · ตาราง · ดันพื้น
Object.assign(SolidTools.prototype, {
  selLines() { return [...this.sk.S].filter((k) => k.startsWith("lines:")).map((k) => this.doc.lines.find((l) => l.id === k.slice(6))).filter(Boolean); },
  /** เส้นที่เลือก (แต่ละเส้นมีระดับ z ของตัวเอง: ข้อมูลวัตถุ → ระดับ) → ผิวสามเหลี่ยม */
  terrainFromSel() {
    const L = this.selLines(), P = SOL.contourPoints(L, 1000);
    if (!L.length || P.length < 3) return this.status("Sandbox: เลือกเส้นชั้นความสูงก่อน (Shift+คลิกเส้นที่วาดไว้ · ตั้งระดับแต่ละเส้นที่ ข้อมูลวัตถุ → ระดับ)");
    const s = SOL.terrain(P); if (!s) return this.status("Sandbox: สร้างผิวไม่ได้ — จุดอยู่แนวเดียวกันหมด");
    const zs = new Set(L.map((l) => l.z || 0));
    this.host.hist.commit((d) => (d.solids = d.solids || []).push(s));
    this.sk.S.clear(); this.sk.S.add("solids:" + s.id); this.host.onChange(); this.t.selChanged();
    const { lo, hi } = SOL.bbox(s);
    this.status(`Sandbox: ผิวภูมิประเทศจากเส้น ${L.length} เส้น → ${s.faces.length} สามเหลี่ยม · สูง ${((hi[2] - lo[2]) / 1000).toFixed(2)} ม. · ${((hi[0] - lo[0]) / 1000).toFixed(1)} × ${((hi[1] - lo[1]) / 1000).toFixed(1)} ม.${zs.size < 2 ? " ⚠ ทุกเส้นระดับเดียวกัน = ผิวเรียบ (ตั้งระดับเส้นที่ ข้อมูลวัตถุ)" : ""} — ดันพื้น: เครื่องมือ → Sandbox: ดันพื้น`);
  },
  /** ตาราง (From Scratch): ครอบเส้นที่เลือก หรือ 20 × 20 ม. ที่จุดกำเนิด · ช่องละ 1 ม. */
  terrainGridNew() {
    const L = this.selLines(); let o = [-10000, -10000], w = 20000, h = 20000;
    if (L.length) { const P = L.flatMap((l) => l.pts), xs = P.map((p) => p[0]), ys = P.map((p) => p[1]); o = [Math.min(...xs), Math.min(...ys)]; w = Math.max(1000, Math.max(...xs) - o[0]); h = Math.max(1000, Math.max(...ys) - o[1]); }
    const s = SOL.terrainGrid(o, w, h, 1000, L.length ? L[0].z || 0 : 0);
    this.host.hist.commit((d) => (d.solids = d.solids || []).push(s));
    this.sk.S.clear(); this.sk.S.add("solids:" + s.id); this.host.onChange(); this.t.selChanged();
    this.status(`Sandbox: พื้นผิวตาราง ${(w / 1000).toFixed(1)} × ${(h / 1000).toFixed(1)} ม. ช่องละ 1 ม. — ดันพื้น: เครื่องมือ → Sandbox: ดันพื้น`);
  },
  smooveStart() {
    this.smOn = true; this.smR = this.smR || 3000; this.lastSm = null;
    this.status(`ดันพื้น (Smoove): รัศมี ${this.smR.toLocaleString()} มม. (พิมพ์ตัวเลข + Enter เปลี่ยนรัศมี) — คลิกค้างบนผิวภูมิประเทศแล้วลากขึ้น/ลง · Esc = ออก`);
  },
  smHover(e) {
    this.clear(this.hov); const h = this.pick(e);
    if (h && h.type === "solids" && this.solid(h.id).terrain) this.hov.add(this.smRing([h.point.x / MM, -h.point.z / MM, h.point.y / MM], this.smR));
    this.v.invalidate();
  },
  smRing(c, r) {
    const P = []; for (let i = 0; i <= 48; i++) { const a = (i / 48) * Math.PI * 2; P.push(W([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a), c[2]])); }
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(P), new THREE.LineBasicMaterial({ color: 0xe8892b, depthTest: false, toneMapped: false }));
    l.renderOrder = 6; l.raycast = () => {}; return l;
  },
  smooveDown(e, h) {
    const s = this.solid(h.id); if (s.locked) { this.status("⚠ ก้อนนี้ล็อกอยู่"); return true; }
    const c = [h.point.x / MM, -h.point.z / MM, h.point.y / MM].map(Math.round);
    this.host.hist.commit(() => {});
    this.drag = { kind: "smoove", id: s.id, orig: JSON.parse(JSON.stringify(s)), c, r: this.smR, p0: h.point.clone(), dz: 0, committed: true, moved: true };
    this.v.controls.enabled = false; return true;
  },
  smooveMove(e) {
    const d = this.drag, raw = this.distAlong(e, d.p0, [0, 0, 1]); if (raw == null) return;
    d.dz = e.shiftKey ? Math.round(raw) : snapTo(raw, 50);
    const i = this.doc.solids.findIndex((x) => x.id === d.id); if (i >= 0) this.doc.solids[i] = SOL.smoove(d.orig, d.c, d.r, d.dz);
    this.v.build(); this.clear(this.hov); this.hov.add(this.smRing([d.c[0], d.c[1], d.c[2] + d.dz], d.r));
    this.status(`ดันพื้น ${d.dz > 0 ? "+" : ""}${d.dz.toLocaleString()} มม. รัศมี ${d.r.toLocaleString()} มม. — ปล่อยแล้วพิมพ์ความสูง + Enter ได้`);
  },
});

// ---------------------------------------------------------------- 0.30: ครบตามหน้าตัวอย่าง — รูปทรงบนหน้า · ตัดกันที่ผิวกับทั้งโมเดล · แก้ในกลุ่มส่วนนอกจาง
Object.assign(SolidTools.prototype, {
  /** หน้าของก้อนที่จุด P (มม.) อยู่ → ระนาบสำหรับวาด { id, fi, n, d, b, o } */
  faceOfPoint(P, hit) {
    if (hit) { const s = this.solid(hit.id); if (s && !s.off && this.inOpenGroup(s) && s.faces[hit.fi]) { const { n, d } = SOL.plane(s, hit.fi); if (Math.abs(SOL.V.dot(n, P) - d) < 3) return { id: s.id, fi: hit.fi, n, d, b: SOL.basis(n), o: P }; } }
    for (const s of this.doc.solids || []) {
      if (s.off || !this.inOpenGroup(s)) continue;
      const fi = SOL.faceAt(s, P); if (fi < 0) continue;
      const { n, d } = SOL.plane(s, fi); return { id: s.id, fi, n, d, b: SOL.basis(n), o: P };
    }
    return null;
  },
  /** รูปที่วาดบนหน้า: รูปปิดในหน้า = หน้าใหม่ (ดึงเข้า/ออกได้) · โค้ง/เส้นอิสระจากขอบถึงขอบ = แบ่งหน้า */
  shapeOnFace(fd, pts3, closed) {
    const s = this.solid(fd.id); if (!s) return false;
    if (s.locked) { this.status("⚠ ก้อนนี้ล็อกอยู่"); return false; }
    const r = closed ? SOL.addInnerFace(s, fd.fi, pts3) : SOL.splitFacePath(s, fd.fi, pts3);
    if (!r) { this.status(closed ? "⚠ รูปต้องอยู่ในหน้าทั้งหมด (ไม่แตะ/ไม่เกินขอบ) และไม่เล็กเกินไป" : "⚠ โค้ง/เส้นอิสระต้องเริ่มและจบบนขอบของหน้า (จับจุด \"บนขอบ\") จึงแบ่งหน้าได้"); return false; }
    this.host.hist.commit((d) => { const i = d.solids.findIndex((x) => x.id === s.id); if (i >= 0) d.solids[i] = r.s; });
    this.host.onChange(); this.syncComp(s, s.id);
    this.status(closed ? "วาดรูปบนหน้าแล้ว — ได้หน้าใหม่ ใช้ Push/Pull ดึงเข้า (ทำช่อง) หรือดึงออกได้" : "แบ่งหน้าด้วยโค้ง/เส้นอิสระแล้ว — ใช้ Push/Pull ดึงส่วนที่แบ่งได้");
    return true;
  },
  /** ตัดกันที่ผิว: "model" = ก้อนที่เลือกกับทุกก้อนที่ซ้อนกัน · "sel" = ระหว่างก้อนที่เลือก (ได้ชิ้นแยกตามรอยตัด) */
  intersectWith(mode) {
    const sel = this.selSolids().filter((s) => !s.locked);
    if (!sel.length) return this.status("ตัดกันที่ผิว: เลือกก้อนก่อน (คลิก 3 ครั้ง)");
    const over = (a, b) => { const A = SOL.bbox(a), B = SOL.bbox(b); return [0, 1, 2].every((k) => A.lo[k] < B.hi[k] && B.lo[k] < A.hi[k]); };
    const pool = mode === "model" ? (this.doc.solids || []).filter((s) => !s.off && !s.locked && !sel.includes(s) && SOL.isClosed(s)) : sel.slice(1);
    let cur = mode === "model" ? sel : [sel[0]], made = [], gone = new Set(), n = 0;
    for (const a0 of cur) {
      let a = a0;
      for (const b of pool) {
        if (gone.has(b.id) || !over(a, b)) continue;
        const r = CSG.split(a, b); if (!r || r.length < 2) continue;
        gone.add(a.id); gone.add(b.id); n++;
        const [A, I, B] = r.length === 3 ? r : [r[0], r[1], null];
        made = made.filter((x) => x !== a); made.push(I); if (B) made.push(B); a = A; made.push(A);
      }
    }
    if (!n) return this.status("ตัดกันที่ผิว: ไม่มีก้อนที่ซ้อนกัน (หรือก้อนไม่ปิดสนิท)");
    made = [...new Set(made)].filter(Boolean);
    this.host.hist.commit((d) => { d.solids = d.solids.filter((s) => !gone.has(s.id)); d.solids.push(...made); });
    this.sk.S.clear(); made.forEach((s) => this.sk.S.add("solids:" + s.id)); this.host.onChange(); this.t.selChanged();
    this.status(`ตัดกันที่ผิว${mode === "model" ? "กับทั้งโมเดล" : "กับที่เลือก"}: ${n} คู่ → ${made.length} ชิ้นตามรอยตัด — ลบชิ้นที่ไม่ใช้ได้`);
  },
  /** ระนาบตัดบนหน้า: ตัดเฉพาะวัตถุในแบบ (พื้นดิน/ท้องฟ้าไม่โดนตัด) — ใส่ระนาบที่วัสดุของทุกชิ้น */
  applyClip() {
    const L = this.clipList || []; this.v.renderer.localClippingEnabled = true;
    const set = (m) => {                                                 // ระหว่างตัด: เห็นผิวด้านในของผนัง (ทั้งสองด้าน) · ล้างแล้วคืนค่าเดิม
      if (!m || !(L.length || (m.clippingPlanes && m.clippingPlanes.length))) return;
      if (L.length) { if (m.userData.side0 == null) m.userData.side0 = m.side; m.side = THREE.DoubleSide; } else if (m.userData.side0 != null) { m.side = m.userData.side0; delete m.userData.side0; }
      m.clippingPlanes = L.length ? L : null; m.needsUpdate = true;
    };
    this.v.model.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(set); });
  },
  /** แก้ในกลุ่ม: ทุกชิ้นนอกกลุ่มจาง (แบบ SketchUp) */
  fade() {
    const gid = this.openGid; if (!gid) return;
    this._fade = this._fade || new Map();
    const dim = (m) => { if (!this._fade.has(m.uuid)) { const c = m.clone(); c.transparent = true; c.opacity = 0.18; c.depthWrite = false; this._fade.set(m.uuid, c); } return this._fade.get(m.uuid); };
    this.v.model.traverse((o) => {
      const u = o.userData || {}; if (!o.isMesh || !u.type || !u.id) return;
      const obj = (this.doc[u.type] || []).find((x) => x.id === u.id); if (obj && obj.gid === gid) return;
      o.material = Array.isArray(o.material) ? o.material.map(dim) : dim(o.material);
    });
  },
});
