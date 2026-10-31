// เครื่องมือ 3D แบบ SketchUp ในตัวเขียนแบบ (โดย ลุงพี)
// เลือก · push-pull ทุกหน้า (บน = สูง · ข้าง = ดันผนังของกล่องออก/เข้า) · สี่เหลี่ยมบนพื้น/บนหน้ากล่อง · ย้าย (Ctrl = คัดลอก) · หมุน 15°
// · ทาสีวัสดุ · ตลับเมตร · รวมกลุ่ม — ทุกการแก้ผ่าน hist.commit (Ctrl+Z ได้)
import * as THREE from "three";
import * as M from "./model.js?v=0.17.0";

const MM = 0.001;
const snap = (v, s) => Math.round(v / s) * s;

export class Sketch3D {
  constructor(view, host) {
    this.v = view; this.host = host; this.tool = "orbit"; this.sel = new Set(); this.mat = "white";
    this.ray = new THREE.Raycaster(); this.ndc = new THREE.Vector2(); this.drag = null; this.tape = null;
    this.over = new THREE.Group(); this.over.name = "ตัวช่วย"; view.scene.add(this.over);
    this.label = document.createElement("div"); this.label.className = "tape-label"; this.label.hidden = true;
    view.canvas.parentNode.appendChild(this.label);
    const c = view.canvas;
    c.addEventListener("pointerdown", (e) => this.down(e), true);
    c.addEventListener("pointermove", (e) => this.move(e), true);
    c.addEventListener("pointerup", (e) => this.up(e), true);
    view.onBuilt = () => this.decorate();
  }
  get doc() { return this.host.hist.doc; }

  setTool(t) {
    this.tool = t; this.drag = null; this.clearOver();
    this.v.canvas.style.cursor = t === "orbit" ? "grab" : t === "paint" ? "cell" : "crosshair";
    this.host.status(HELP[t] || "");
    if (t !== "tape") this.label.hidden = true;
  }

  // ---------------------------------------------------------------- ยิงเมาส์
  pick(e) {
    const r = this.v.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.v.camera);
    return this.ray;
  }
  hit(e, types) {
    this.pick(e);
    const objs = [...this.v.model.children, ...(this.v.asc ? this.v.asc.children : [])];
    const h = this.ray.intersectObjects(objs, true).find((x) => x.object.isMesh && (!types || types.includes(x.object.userData.type)));
    if (!h) return null;
    const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
    return { ...h, n, type: h.object.userData.type, id: h.object.userData.id };
  }
  plane(e, y) {
    this.pick(e);
    const p = new THREE.Vector3();
    return this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), p) ? p : null;
  }
  mass(id) { return this.doc.masses.find((m) => m.id === id); }
  groupOf(id) { const m = this.mass(id); return m && m.gid ? this.doc.masses.filter((x) => x.gid === m.gid).map((x) => x.id) : [id]; }

  // ---------------------------------------------------------------- เมาส์
  down(e) {
    if (e.button !== 0 || this.tool === "orbit") return;
    const t = this.tool;
    const own = () => { e.stopImmediatePropagation(); this.v.controls.enabled = false; this.v.canvas.setPointerCapture(e.pointerId); };
    if (t === "select") {
      const h = this.hit(e, ["masses"]);
      if (!h) { if (!e.shiftKey) this.sel.clear(); this.v.build(); this.host.onSelect3D && this.host.onSelect3D([]); return; }
      const ids = this.groupOf(h.id);
      if (!e.shiftKey) this.sel.clear();
      ids.forEach((id) => (e.shiftKey && this.sel.has(id) ? this.sel.delete(id) : this.sel.add(id)));
      this.v.build(); this.host.onSelect3D && this.host.onSelect3D([...this.sel]);
      return;
    }
    if (t === "pushpull") {
      const h = this.hit(e, ["masses"]); if (!h) return;
      const m = this.mass(h.id); if (!m) return; own();
      this.host.hist.commit(() => {});
      if (h.n.y > 0.9) {
        const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3().subVectors(this.v.camera.position, h.point).setY(0).normalize(), h.point);
        this.drag = { kind: "top", m, h0: m.height, y0: h.point.y, plane: pl };
      } else if (Math.abs(h.n.y) < 0.2) {
        const np = [h.n.x, -h.n.z];                                     // ทิศตั้งฉากของหน้าในพิกัดแบบ
        let best = -1, bd = -2;
        for (let i = 0; i < m.pts.length; i++) {
          const a = m.pts[i], b = m.pts[(i + 1) % m.pts.length], d = M.norm(M.sub(b, a)), out = M.polygonArea(m.pts) > 0 ? [d[1], -d[0]] : [-d[1], d[0]];
          const sc = out[0] * np[0] + out[1] * np[1] - M.projectOnSegment([h.point.x / MM, -h.point.z / MM], a, b).d / 1e6;
          if (sc > bd) { bd = sc; best = i; }
        }
        const dir = new THREE.Vector3(np[0], 0, -np[1]).normalize();
        const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize(), h.point);
        if (Math.abs(pl.normal.dot(new THREE.Vector3().subVectors(this.v.camera.position, h.point).normalize())) < 0.15) pl.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), h.point);
        this.drag = { kind: "side", m, i: best, n: np, orig: m.pts.map((p) => p.slice()), p0: h.point.clone(), dir, plane: pl };
      } else { this.drag = null; this.v.controls.enabled = true; }
      return;
    }
    if (t === "rect") {
      const h = this.hit(e, ["masses"]);
      const top = h && h.n.y > 0.9 ? this.mass(h.id) : null;
      const y = top ? ((top.base || 0) + top.height) * MM : 0;
      const p = top ? h.point : this.plane(e, 0); if (!p) return; own();
      this.drag = { kind: "rect", y, a: [snap(p.x / MM, 50), snap(-p.z / MM, 50)], b: null, base: top ? (top.base || 0) + top.height : 0 };
      return;
    }
    if (t === "move") {
      const h = this.hit(e, ["masses"]); if (!h) return;
      if (!this.sel.has(h.id)) { this.sel = new Set(this.groupOf(h.id)); }
      own(); this.host.hist.commit(() => {});
      const ms = [...this.sel].map((id) => this.mass(id)).filter(Boolean);
      const y = (Math.min(...ms.map((m) => m.base || 0))) * MM;
      const p0 = this.plane(e, y);
      this.drag = { kind: "move", ms, orig: ms.map((m) => m.pts.map((q) => q.slice())), p0, y, copy: e.ctrlKey };
      return;
    }
    if (t === "rotate") {
      const h = this.hit(e, ["masses"]); if (!h) return; e.stopImmediatePropagation();
      if (!this.sel.has(h.id)) this.sel = new Set(this.groupOf(h.id));
      const ms = [...this.sel].map((id) => this.mass(id)).filter(Boolean), all = ms.flatMap((m) => m.pts);
      const c = all.reduce((s, p) => [s[0] + p[0] / all.length, s[1] + p[1] / all.length], [0, 0]), a = ((e.shiftKey ? -15 : 15) * Math.PI) / 180;
      const rot = (p) => { const x = p[0] - c[0], y = p[1] - c[1]; return [Math.round(c[0] + x * Math.cos(a) - y * Math.sin(a)), Math.round(c[1] + x * Math.sin(a) + y * Math.cos(a))]; };
      const ids = new Set(ms.map((m) => m.id));
      this.host.hist.commit((d) => d.masses.forEach((m) => { if (ids.has(m.id)) m.pts = m.pts.map(rot); }));
      this.host.onChange(); this.host.status(`หมุน ${e.shiftKey ? -15 : 15}° (Shift = ทวนทาง)`);
      return;
    }
    if (t === "paint") {
      const h = this.hit(e, ["masses", "walls", "roof"]); if (!h) return; e.stopImmediatePropagation();
      const mat = this.mat;
      this.host.hist.commit((d) => {
        if (h.type === "masses") { const ids = new Set(this.groupOf(h.id)); d.masses.forEach((m) => ids.has(m.id) && (m.mat = mat)); }
        else if (h.type === "walls") { const w = d.walls.find((x) => x.id === h.id); if (w) w.mat = mat; }
        else d.roof.mat = mat;
      });
      this.host.onChange();
      return;
    }
    if (t === "tape") {
      const h = this.hit(e); const p = h ? h.point : this.plane(e, 0); if (!p) return; e.stopImmediatePropagation();
      if (!this.tape) { this.tape = p.clone(); this.host.status("ตลับเมตร: คลิกจุดที่สอง"); }
      else { this.showTape(this.tape, p, e); this.tape = null; }
    }
  }

  move(e) {
    const d = this.drag; if (!d) return;
    e.stopImmediatePropagation();
    if (d.kind === "top") {
      this.pick(e); const p = new THREE.Vector3(); if (!this.ray.ray.intersectPlane(d.plane, p)) return;
      d.m.height = Math.max(50, snap(d.h0 + (p.y - d.y0) / MM, 50));
      this.v.build(); this.host.status(`push-pull: สูง ${d.m.height.toLocaleString()} มม.`);
    } else if (d.kind === "side") {
      this.pick(e); const p = new THREE.Vector3(); if (!this.ray.ray.intersectPlane(d.plane, p)) return;
      const dist = snap(p.clone().sub(d.p0).dot(d.dir) / MM, 50), n = d.m.pts.length, i = d.i;
      d.m.pts = d.orig.map((q, k) => (k === i || k === (i + 1) % n ? [q[0] + d.n[0] * dist, q[1] + d.n[1] * dist] : q.slice()));
      this.v.build(); this.host.status(`push-pull ด้านข้าง: ${dist > 0 ? "ดันออก" : "ดันเข้า"} ${Math.abs(dist).toLocaleString()} มม.`);
    } else if (d.kind === "rect") {
      const p = this.plane(e, d.y); if (!p) return;
      d.b = [snap(p.x / MM, 50), snap(-p.z / MM, 50)];
      this.clearOver();
      const [a, b] = [d.a, d.b], y = d.y + 0.01;
      const pts = [[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]], [a[0], a[1]]].map((q) => new THREE.Vector3(q[0] * MM, y, -q[1] * MM));
      this.over.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xe8892b })));
      this.host.status(`สี่เหลี่ยม ${Math.abs(b[0] - a[0]).toLocaleString()} × ${Math.abs(b[1] - a[1]).toLocaleString()} มม.`);
    } else if (d.kind === "move") {
      const p = this.plane(e, d.y); if (!p || !d.p0) return;
      const dx = snap((p.x - d.p0.x) / MM, 50), dy = snap(-(p.z - d.p0.z) / MM, 50);
      d.ms.forEach((m, k) => (m.pts = d.orig[k].map((q) => [q[0] + dx, q[1] + dy])));
      d.delta = [dx, dy];
      this.v.build(); this.host.status(`ย้าย ${dx.toLocaleString()}, ${dy.toLocaleString()} มม.${d.copy ? " (คัดลอก)" : ""}`);
    }
  }

  up(e) {
    const d = this.drag; if (!d) return;
    e.stopImmediatePropagation(); this.drag = null; this.v.controls.enabled = true; this.clearOver();
    if (d.kind === "rect") {
      if (!d.b || Math.abs(d.b[0] - d.a[0]) < 100 || Math.abs(d.b[1] - d.a[1]) < 100) return;
      const [x0, x1] = [Math.min(d.a[0], d.b[0]), Math.max(d.a[0], d.b[0])], [y0, y1] = [Math.min(d.a[1], d.b[1]), Math.max(d.a[1], d.b[1])];
      const m = { id: M.uid("m"), name: "กล่อง", pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], base: d.base, height: this.host.defaults().massHeight, mat: this.mat };
      this.host.hist.commit((doc) => doc.masses.push(m));
      this.sel = new Set([m.id]); this.host.onChange();
      this.host.status("สร้างกล่องแล้ว — ใช้ push-pull ดึงความสูง/ดันด้านข้างได้");
      return;
    }
    if (d.kind === "move" && d.copy && d.delta) {
      // Ctrl ค้างตอนเริ่มลาก = คัดลอก: คืนตำแหน่งเดิม แล้วเพิ่มชุดใหม่ที่ตำแหน่งปลายทาง
      const gid = d.ms.some((m) => m.gid) ? M.uid("g") : null;
      const copies = d.ms.map((m, k) => ({ ...JSON.parse(JSON.stringify(m)), id: M.uid("m"), gid: m.gid ? gid : undefined, pts: d.orig[k].map((q) => [q[0] + d.delta[0], q[1] + d.delta[1]]) }));
      d.ms.forEach((m, k) => (m.pts = d.orig[k]));
      this.host.hist.doc.masses.push(...copies);
      this.sel = new Set(copies.map((m) => m.id));
    }
    this.host.onChange();
  }

  // ---------------------------------------------------------------- อื่น ๆ
  group() {
    if (this.sel.size < 2) return this.host.status("เลือกกล่องอย่างน้อย 2 ชิ้น (Shift+คลิก) แล้วกดรวมกลุ่ม");
    const gid = M.uid("g"), ids = new Set(this.sel);
    this.host.hist.commit((d) => d.masses.forEach((m) => ids.has(m.id) && (m.gid = gid)));
    this.host.onChange(); this.host.status(`รวมกลุ่ม ${ids.size} ชิ้น — คลิกชิ้นใดก็เลือกทั้งกลุ่ม`);
  }
  ungroup() {
    const ids = new Set(this.sel);
    this.host.hist.commit((d) => d.masses.forEach((m) => ids.has(m.id) && delete m.gid));
    this.host.onChange(); this.host.status("แยกกลุ่มแล้ว");
  }
  remove() {
    if (!this.sel.size) return;
    const ids = new Set(this.sel); this.sel.clear();
    this.host.hist.commit((d) => (d.masses = d.masses.filter((m) => !ids.has(m.id))));
    this.host.onChange();
  }
  decorate() {
    for (const o of this.v.model.children) {
      if (o.isMesh && o.userData.type === "masses" && this.sel.has(o.userData.id)) {
        const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry), new THREE.LineBasicMaterial({ color: 0x2f7bff, depthTest: false }));
        e.position.copy(o.position); e.rotation.copy(o.rotation); e.renderOrder = 5; this.v.model.add(e);
      }
    }
  }
  clearOver() { this.over.traverse((o) => o.geometry && o.geometry.dispose()); this.over.clear(); }
  showTape(a, b) {
    this.clearOver();
    this.over.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color: 0xffcc00, depthTest: false })));
    const dist = a.distanceTo(b) / MM, mid = a.clone().add(b).multiplyScalar(0.5).project(this.v.camera);
    const r = this.v.canvas.getBoundingClientRect();
    this.label.textContent = `${Math.round(dist).toLocaleString()} มม. (${(dist / 1000).toFixed(3)} ม.)`;
    this.label.style.left = `${((mid.x + 1) / 2) * r.width}px`; this.label.style.top = `${((1 - mid.y) / 2) * r.height}px`;
    this.label.hidden = false;
    this.host.status(`ตลับเมตร: ${Math.round(dist).toLocaleString()} มม. · ΔZ ${Math.round((b.y - a.y) / MM).toLocaleString()} มม.`);
  }
}

const HELP = {
  orbit: "หมุนมุมมอง: ลากซ้าย · เลื่อน: ลากขวา · ซูม: ล้อเมาส์",
  select: "คลิกกล่องเพื่อเลือก · Shift = เพิ่ม/เอาออก · Delete ลบ",
  pushpull: "push-pull: ลากหน้าบนขึ้น/ลง = ความสูง · ลากหน้าข้าง = ดันผนังออก/เข้า (ทีละ 50 มม.)",
  rect: "สี่เหลี่ยม: ลากบนพื้นหรือบนหน้าบนของกล่อง (ซ้อนชั้นได้) → ได้กล่องใหม่",
  move: "ย้าย: ลากกล่อง/กลุ่ม (ทีละ 50 มม.) · กด Ctrl ค้างตอนเริ่มลาก = คัดลอก",
  rotate: "หมุน: คลิกกล่อง = หมุน 15° · Shift+คลิก = หมุนกลับ",
  paint: "ทาสี: เลือกวัสดุ แล้วคลิกกล่อง/ผนัง/หลังคา",
  tape: "ตลับเมตร: คลิก 2 จุดบนผิวหรือพื้น",
};
