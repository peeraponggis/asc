// Solid Tools (รวม · ลบ · ตัด · ตัดกัน · แยก · เปลือกนอก) ของก้อนผิว+เส้น — 0.28 (โดย ลุงพี)
// ใช้ต้นไม้ BSP แบบ csg.js (Evan Wallace, MIT) เขียนใหม่สำหรับหน่วย มม. · ไม่ใช้ three (ทดสอบด้วย node ได้)
import * as SOL from "./mesh.js?v=0.31.5";

const EPS = 0.01;                                         // มม.
const COPLANAR = 0, FRONT = 1, BACK = 2, SPANNING = 3;
const { sub, add, mul, dot, cross, norm } = SOL.V;
const lerp = (a, b, t) => add(a, mul(sub(b, a), t));

class Plane {
  constructor(n, w) { this.n = n; this.w = w; }
  static from(a, b, c) { const n = norm(cross(sub(b, a), sub(c, a))); return new Plane(n, dot(n, a)); }
  clone() { return new Plane(this.n.slice(), this.w); }
  flip() { this.n = mul(this.n, -1); this.w = -this.w; }
  split(poly, cf, cb, f, b) {
    let type = 0; const types = poly.v.map((p) => { const t = dot(this.n, p) - this.w, k = t < -EPS ? BACK : t > EPS ? FRONT : COPLANAR; type |= k; return k; });
    if (type === COPLANAR) (dot(this.n, poly.plane.n) > 0 ? cf : cb).push(poly);
    else if (type === FRONT) f.push(poly);
    else if (type === BACK) b.push(poly);
    else {
      const F = [], B = [];
      for (let i = 0; i < poly.v.length; i++) {
        const j = (i + 1) % poly.v.length, ti = types[i], tj = types[j], vi = poly.v[i], vj = poly.v[j];
        if (ti !== BACK) F.push(vi); if (ti !== FRONT) B.push(ti !== BACK ? vi.slice() : vi);
        if ((ti | tj) === SPANNING) { const t = (this.w - dot(this.n, vi)) / dot(this.n, sub(vj, vi)), v = lerp(vi, vj, t); F.push(v); B.push(v.slice()); }
      }
      if (F.length >= 3) f.push(new Poly(F, poly.mat)); if (B.length >= 3) b.push(new Poly(B, poly.mat));
    }
  }
}
class Poly {
  constructor(v, mat) { this.v = v; this.mat = mat; this.plane = Plane.from(v[0], v[1], v[2]); }
  clone() { return new Poly(this.v.map((p) => p.slice()), this.mat); }
  flip() { this.v.reverse(); this.plane.flip(); }
}
class Node {
  constructor(polys) { this.plane = null; this.front = null; this.back = null; this.polys = []; if (polys) this.build(polys); }
  clone() { const n = new Node(); n.plane = this.plane && this.plane.clone(); n.front = this.front && this.front.clone(); n.back = this.back && this.back.clone(); n.polys = this.polys.map((p) => p.clone()); return n; }
  invert() { for (const p of this.polys) p.flip(); this.plane.flip(); if (this.front) this.front.invert(); if (this.back) this.back.invert(); const t = this.front; this.front = this.back; this.back = t; }
  clipPolys(polys) {
    if (!this.plane) return polys.slice();
    let f = [], b = [];
    for (const p of polys) this.plane.split(p, f, b, f, b);
    if (this.front) f = this.front.clipPolys(f);
    b = this.back ? this.back.clipPolys(b) : [];
    return f.concat(b);
  }
  clipTo(bsp) { this.polys = bsp.clipPolys(this.polys); if (this.front) this.front.clipTo(bsp); if (this.back) this.back.clipTo(bsp); }
  all() { let p = this.polys.slice(); if (this.front) p = p.concat(this.front.all()); if (this.back) p = p.concat(this.back.all()); return p; }
  build(polys) {
    if (!polys.length) return;
    if (!this.plane) this.plane = polys[0].plane.clone();
    const f = [], b = [];
    for (const p of polys) this.plane.split(p, this.polys, this.polys, f, b);
    if (f.length) { if (!this.front) this.front = new Node(); this.front.build(f); }
    if (b.length) { if (!this.back) this.back = new Node(); this.back.build(b); }
  }
}

/** ก้อน → รูปหลายเหลี่ยม (สามเหลี่ยม) */
function toPolys(s) {
  const out = [];
  s.faces.forEach((F, fi) => { for (const t of SOL.triangulate(s, fi)) { const v = t.map((i) => s.verts[i].slice()); if (SOL.V.len(cross(sub(v[1], v[0]), sub(v[2], v[0]))) > 1e-6) out.push(new Poly(v, F.mat || s.mat)); } });
  return out;
}
/** รูปหลายเหลี่ยม → ก้อน (รวมจุดตำแหน่งเดียวกัน · รวมหน้าระนาบเดียวกัน) */
function fromPolys(polys, base) {
  const idx = new Map(), verts = [], faces = [];
  const vi = (p) => { const q = p.map((x) => Math.round(x)), k = q.join(","); if (!idx.has(k)) { idx.set(k, verts.length); verts.push(q); } return idx.get(k); };
  for (const P of polys) {
    const L = []; for (const p of P.v) { const i = vi(p); if (L[L.length - 1] !== i) L.push(i); }
    if (L.length > 1 && L[0] === L[L.length - 1]) L.pop();
    if (new Set(L).size >= 3) faces.push({ loops: [L], mat: P.mat === base.mat ? undefined : P.mat });
  }
  const s = { id: SOL.uid("s"), name: base.name, verts, faces };
  if (base.mat) s.mat = base.mat; if (base.gid) s.gid = base.gid; if (base.tag) s.tag = base.tag;
  return SOL.mergeCoplanar(SOL.cleanup(fixTJunctions(s)));
}
/** แทรกจุดที่อยู่กลางเส้นของหน้าอื่น (T-junction จากการตัด BSP) ให้หน้าติดกันมีเส้นตรงกัน → รวมหน้าได้ ก้อนปิดสนิท */
function fixTJunctions(s) {
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (const F of s.faces) F.loops = F.loops.map((L) => {
      const out = [];
      L.forEach((a, k) => {
        out.push(a); const b = L[(k + 1) % L.length], A = s.verts[a], B = s.verts[b];
        const mids = [];
        s.verts.forEach((p, i) => { if (i === a || i === b) return; const t = SOL.onSeg(p, A, B, 0.6); if (t > 1e-6 && t < 1 - 1e-6) mids.push([t, i]); });
        if (mids.length) { mids.sort((x, y) => x[0] - y[0]); for (const [, i] of mids) out.push(i); changed = true; }
      });
      return out;
    });
    if (!changed) break;
  }
  return s;
}
const run = (a, b, op) => {
  const A = new Node(toPolys(a)), B = new Node(toPolys(b));
  if (op === "union") { A.clipTo(B); B.clipTo(A); B.invert(); B.clipTo(A); B.invert(); A.build(B.all()); return A.all(); }
  if (op === "subtract") { A.invert(); A.clipTo(B); B.clipTo(A); B.invert(); B.clipTo(A); B.invert(); A.build(B.all()); A.invert(); return A.all(); }
  A.invert(); B.clipTo(A); B.invert(); A.clipTo(B); B.clipTo(A); A.build(B.all()); A.invert(); return A.all();   // intersect
};
const ok = (s) => (s && s.faces.length >= 4 ? s : null);

/** รวม (Union) / เปลือกนอก (Outer Shell): สองก้อนเป็นก้อนเดียว ไม่มีผิวภายใน */
export const union = (a, b) => ok(fromPolys(run(a, b, "union"), a));
/** ลบ (Subtract): ก้อนแรกเจาะออกจากก้อนที่สอง (แบบ SketchUp: ก้อนแรกหายไป) → b − a */
export const subtract = (a, b) => ok(fromPolys(run(b, a, "subtract"), b));
/** ตัด (Trim): เหมือนลบแต่ก้อนแรกยังอยู่ → [a, b − a] */
export const trim = (a, b) => { const r = subtract(a, b); return r ? [a, r] : null; };
/** ตัดกัน (Intersect): เหลือเฉพาะส่วนที่ซ้อนกัน */
export const intersect = (a, b) => ok(fromPolys(run(a, b, "intersect"), a));
/** แยก (Split): [a − b, a ∩ b, b − a] — ใช้แทน Intersect Faces (ได้เส้นรอยตัดเป็นชิ้น ลบต่อได้) */
export const split = (a, b) => {
  const A = ok(fromPolys(run(a, b, "subtract"), a)), I = intersect(a, b), B = ok(fromPolys(run(b, a, "subtract"), b));
  return [A, I, B].filter(Boolean);
};
export const outerShell = union;
