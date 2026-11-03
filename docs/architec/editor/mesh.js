// ผิว + เส้น (mesh แบบ SketchUp) ของตัวเขียนแบบ 3D — 0.26 (โดย ลุงพี · docs/mockup-0.26-sketchup.html)
// เก็บในแบบเป็น doc.solids = [{ id, name, verts: [[x,y,z] มม.], faces: [{ loops: [[i…] วงนอก, [i…] รู…], mat? }], mat?, gid?, tag? }]
//   วงนอกเรียงทวนเข็มเมื่อมองจากด้านนอก (normal ชี้ออก) · รูเรียงตามเข็ม · เส้น = ขอบของหน้า (ไม่เก็บแยก)
// ไฟล์นี้ไม่ใช้ three.js (ทดสอบด้วย node ได้) — ตัววาดอยู่ที่ view3d.js
const EPS = 0.5;                                     // มม. — ระยะถือว่าเป็นจุด/ระนาบเดียวกัน

export const uid = (p = "s") => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const V = { sub, add, mul, dot, cross, len, norm };
const r1 = (v) => Math.round(v);
const clone = (s) => JSON.parse(JSON.stringify(s));
export const ekey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

// ---------------------------------------------------------------- สร้าง
/** กล่องยืด (mass: ผัง + ฐาน + สูง) → ผิว+เส้น */
export function fromMass(m) {
  let pts = m.pts.map((p) => [p[0], p[1]]);
  if (area2(pts) < 0) pts = pts.reverse();          // ทวนเข็มเมื่อมองจากบน
  const n = pts.length, z0 = m.base || 0, z1 = z0 + Math.max(1, m.height);
  const verts = [...pts.map((p) => [p[0], p[1], z0]), ...pts.map((p) => [p[0], p[1], z1])];
  const faces = [{ loops: [[...Array(n).keys()].reverse()] }, { loops: [[...Array(n).keys()].map((i) => i + n)] }];
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; faces.push({ loops: [[i, j, j + n, i + n]] }); }
  const s = { id: m.id && !m.id.startsWith("m") ? m.id : uid("s"), name: m.name || "ก้อน", verts, faces };
  for (const k of ["mat", "gid", "tag"]) if (m[k] !== undefined) s[k] = m[k];
  return s;
}
/** หน้าแบน (ผังหลายเหลี่ยมที่ระดับ z) — วาดเส้นปิดรูป/สี่เหลี่ยม แล้วค่อย Push/Pull */
export function flatFace(pts, z = 0, name = "หน้า (Face)") {
  let p = pts.map((q) => [q[0], q[1]]); if (area2(p) < 0) p = p.reverse();
  return { id: uid("s"), name, verts: p.map((q) => [q[0], q[1], z]), faces: [{ loops: [[...p.keys()]] }] };
}
/** หน้าแบนบนระนาบใดก็ได้ (จุด 3 มิติเรียงรอบ) · n = ทิศที่ต้องการให้หน้าหันไป */
export function face3(pts3, n, name = "หน้า (Face)") {
  let p = pts3.map((q) => q.map(r1));
  const nn = newell(p); if (n && dot(nn, n) < 0) p = p.reverse();
  return { id: uid("s"), name, verts: p, faces: [{ loops: [[...p.keys()]] }] };
}

// ---------------------------------------------------------------- เรขาคณิตของหน้า
export function area2(p) { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a / 2; }
function newell(P) { let x = 0, y = 0, z = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; x += (a[1] - b[1]) * (a[2] + b[2]); y += (a[2] - b[2]) * (a[0] + b[0]); z += (a[0] - b[0]) * (a[1] + b[1]); } return [x, y, z]; }
/** ทิศตั้งฉากของหน้า (หน่วย) */
export function normal(s, f) { const F = typeof f === "number" ? s.faces[f] : f; return norm(newell(F.loops[0].map((i) => s.verts[i]))); }
/** ระนาบของหน้า: n·p = d */
export function plane(s, f) { const n = normal(s, f), F = typeof f === "number" ? s.faces[f] : f; const c = centroid(s, F.loops[0]); return { n, d: dot(n, c) }; }
export function centroid(s, loop) { const c = [0, 0, 0]; for (const i of loop) { c[0] += s.verts[i][0] / loop.length; c[1] += s.verts[i][1] / loop.length; c[2] += s.verts[i][2] / loop.length; } return c; }
/** พื้นที่หน้า (มม.²) หักรู */
export function faceArea(s, f) {
  const F = s.faces[f], n = normal(s, f);
  return F.loops.reduce((acc, L, k) => acc + (k ? -1 : 1) * Math.abs(dot(newell(L.map((i) => s.verts[i])), n)) / 2, 0);
}
/** แกนสองแกนบนระนาบหน้า (สำหรับแปลงเป็น 2 มิติ) */
export function basis(n) {
  const up = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = norm(cross(up, n)), v = cross(n, u); return { u, v };
}
const to2 = (p, b) => [dot(p, b.u), dot(p, b.v)];

/** แบ่งหน้าเป็นสามเหลี่ยม (รองรับรู) → [[i,j,k]] เป็นดัชนีจุดของก้อน */
export function triangulate(s, f) {
  const F = s.faces[f], n = normal(s, f), b = basis(n);
  // รวมรูเข้าวงนอกด้วยสะพาน (bridge) แล้วตัดหู (ear clipping)
  let ring = F.loops[0].slice();
  const holes = F.loops.slice(1).map((L) => L.slice()).sort((A, B) => Math.max(...B.map((i) => to2(s.verts[i], b)[0])) - Math.max(...A.map((i) => to2(s.verts[i], b)[0])));
  for (const H of holes) ring = bridge(s, ring, H, b);
  return earClip(s, ring, b);
}
function bridge(s, ring, H, b) {
  const P = (i) => to2(s.verts[i], b);
  let hi = 0; H.forEach((i, k) => { if (P(i)[0] > P(H[hi])[0]) hi = k; });
  const hp = P(H[hi]); let best = -1, bd = Infinity;
  ring.forEach((i, k) => {
    const q = P(i); if (q[0] < hp[0] - EPS) return; const d = Math.hypot(q[0] - hp[0], q[1] - hp[1]);
    if (d < bd && visible(s, ring, H, hp, q, b)) { bd = d; best = k; }
  });
  if (best < 0) ring.forEach((i, k) => { const q = P(i), d = Math.hypot(q[0] - hp[0], q[1] - hp[1]); if (d < bd) { bd = d; best = k; } });
  const h = [...H.slice(hi), ...H.slice(0, hi), H[hi]];
  return [...ring.slice(0, best + 1), ...h, ring[best], ...ring.slice(best + 1)];
}
function segX(a, b, c, d) {
  const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}
function visible(s, ring, H, a, b2, b) {
  const P = (i) => to2(s.verts[i], b);
  for (const L of [ring, H]) for (let k = 0; k < L.length; k++) if (segX(a, b2, P(L[k]), P(L[(k + 1) % L.length]))) return false;
  return true;
}
function earClip(s, ring, b) {
  const P = ring.map((i) => to2(s.verts[i], b)), idx = [...ring.keys()], out = [];
  const ccw = area2(P) >= 0;
  const conv = (a, c, d) => ((P[c][0] - P[a][0]) * (P[d][1] - P[a][1]) - (P[c][1] - P[a][1]) * (P[d][0] - P[a][0])) * (ccw ? 1 : -1) > 1e-9;
  const inTri = (p, a, c, d) => { const s1 = (q, r) => (r[0] - q[0]) * (p[1] - q[1]) - (r[1] - q[1]) * (p[0] - q[0]); const x = s1(P[a], P[c]), y = s1(P[c], P[d]), z = s1(P[d], P[a]); return (x > 0 && y > 0 && z > 0) || (x < 0 && y < 0 && z < 0); };
  // จุดที่อยู่บนเส้นทแยงใหม่ (จุดแทรกกลางขอบ เช่น จากการแบ่งหน้า) ห้ามข้าม — ไม่งั้นเส้นทแยงทับจุดนั้น เส้นต่อกันไม่ครบตอนตัดก้อน
  const onDiag = (p, a, b) => { const ab = [b[0] - a[0], b[1] - a[1]], ap = [p[0] - a[0], p[1] - a[1]], L2 = ab[0] * ab[0] + ab[1] * ab[1]; if (!L2) return false; const t = (ab[0] * ap[0] + ab[1] * ap[1]) / L2; return t > 1e-6 && t < 1 - 1e-6 && Math.abs(ab[0] * ap[1] - ab[1] * ap[0]) / Math.sqrt(L2) < 1; };
  let guard = 0;
  while (idx.length > 3 && guard++ < 10000) {
    let cut = false;
    for (let k = 0; k < idx.length; k++) {
      const a = idx[(k + idx.length - 1) % idx.length], c = idx[k], d = idx[(k + 1) % idx.length];
      if (!conv(a, c, d)) continue;
      if (idx.some((e) => e !== a && e !== c && e !== d && ring[e] !== ring[a] && ring[e] !== ring[c] && ring[e] !== ring[d] && (inTri(P[e], a, c, d) || onDiag(P[e], P[a], P[d])))) continue;
      out.push([ring[a], ring[c], ring[d]]); idx.splice(k, 1); cut = true; break;
    }
    if (!cut) { const [a, c, d] = idx; out.push([ring[a], ring[c], ring[d]]); idx.splice(1, 1); }   // รูปผิดปกติ: ตัดต่อไปไม่ให้ค้าง
  }
  if (idx.length === 3) out.push(idx.map((k) => ring[k]));
  return out;
}

// ---------------------------------------------------------------- เส้น
/** เส้นทั้งหมด (ไม่ซ้ำ) → Map key → { a, b, faces: [ดัชนีหน้า] } */
export function edges(s) {
  const E = new Map();
  s.faces.forEach((F, fi) => F.loops.forEach((L) => L.forEach((a, k) => {
    const b = L[(k + 1) % L.length], key = ekey(a, b);
    if (!E.has(key)) E.set(key, { a: Math.min(a, b), b: Math.max(a, b), faces: [] });
    E.get(key).faces.push(fi);
  })));
  return E;
}
export function edgeLen(s, key) { const [a, b] = key.split("-").map(Number); return len(sub(s.verts[a], s.verts[b])); }
/** หน้าที่ใช้จุดนี้ */
export function facesOfVert(s, vi) { const out = []; s.faces.forEach((F, fi) => { if (F.loops.some((L) => L.includes(vi))) out.push(fi); }); return out; }
/** จุดของหน้า (ทุกวง) */
export const faceVerts = (s, f) => [...new Set(s.faces[f].loops.flat())];

// ---------------------------------------------------------------- ปริมาตร / ขอบเขต
export function volume(s) {
  let v = 0;
  s.faces.forEach((F, fi) => { for (const [a, b, c] of triangulate(s, fi)) v += dot(s.verts[a], cross(s.verts[b], s.verts[c])) / 6; });
  return Math.abs(v);
}
export function bbox(s) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of s.verts) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
  return { lo, hi };
}
/** ก้อนปิดสนิทไหม (ทุกเส้นมี 2 หน้า) */
export function isClosed(s) { for (const e of edges(s).values()) if (e.faces.length !== 2) return false; return s.faces.length >= 4; }

// ---------------------------------------------------------------- ย้าย / ยืด
/** ย้ายจุด (ดัชนี) ไปตาม delta แล้วพับหน้าที่บิดเป็นสามเหลี่ยม (Autofold) · คืนก้อนใหม่ */
export function moveVerts(s0, vis, delta, { autofold = true } = {}) {
  const s = clone(s0), set = new Set(vis);
  for (const i of set) s.verts[i] = s.verts[i].map((v, k) => r1(v + delta[k]));
  if (autofold) foldNonPlanar(s);
  return s;
}
export function planarity(s, f) {
  const { n, d } = plane(s, f); let m = 0;
  for (const i of faceVerts(s, f)) m = Math.max(m, Math.abs(dot(n, s.verts[i]) - d));
  return m;
}
/** หน้าที่บิด (ไม่อยู่ระนาบเดียว) → แตกเป็นสามเหลี่ยม · หน้าที่มีรูจะไม่แตก (เตือนทางสถานะแทน) */
export function foldNonPlanar(s) {
  const out = []; let folded = 0;
  s.faces.forEach((F, fi) => {
    if (F.loops.length > 1 || planarity(s, fi) <= EPS * 2 || F.loops[0].length <= 3) { out.push(F); return; }
    // แตกจากมุมแรก (fan) — ตาม SketchUp ที่พับเป็นสามเหลี่ยม
    const L = F.loops[0]; for (let k = 1; k < L.length - 1; k++) out.push({ ...F, loops: [[L[0], L[k], L[k + 1]]] }); folded++;
  });
  s.faces = out; s._folded = folded; return s;
}

// ---------------------------------------------------------------- Push/Pull
/** ดึงหน้า fi ตามทิศตั้งฉากเป็นระยะ dist (มม. · ลบ = ดันเข้า)
 *  · หน้าข้างเคียงตั้งฉากกับหน้านี้ทั้งหมด = ยืดหน้าข้างเคียงตาม (ไม่มีหน้าใหม่)
 *  · ไม่ใช่ (หรือ copy) = สร้างหน้าข้างใหม่ทุกขอบ แล้วรวมหน้าระนาบเดียวกันที่ติดกัน */
export function pushPull(s0, fi, dist, { copy = false } = {}) {
  const s = clone(s0), F = s.faces[fi], n = normal(s, fi), off = mul(n, dist);
  const E = edges(s), adj = new Set();
  for (const L of F.loops) L.forEach((a, k) => { for (const g of E.get(ekey(a, L[(k + 1) % L.length])).faces) if (g !== fi) adj.add(g); });
  const allPerp = [...adj].every((g) => Math.abs(dot(normal(s, g), n)) < 1e-3);
  if (!copy && allPerp && adj.size) {
    for (const i of faceVerts(s, fi)) s.verts[i] = s.verts[i].map((v, k) => r1(v + off[k]));
    return s;
  }
  // สร้างจุดใหม่ + หน้าข้าง
  const map = new Map(); for (const i of faceVerts(s, fi)) { map.set(i, s.verts.length); s.verts.push(s.verts[i].map((v, k) => r1(v + off[k]))); }
  const sides = [];
  for (const L of F.loops) L.forEach((a, k) => {
    const b = L[(k + 1) % L.length];
    // ด้านข้าง [a, b, b', a'] → ทิศ = dist·(d×n): ดึงออก = หันออกจากขอบ · ดันเข้า = หันเข้าช่องเว้า (ถูกทั้งสองแบบ)
    sides.push({ loops: [[a, b, map.get(b), map.get(a)]], mat: F.mat });
  });
  const moved = { ...F, loops: F.loops.map((L) => L.map((i) => map.get(i))) };
  if (copy) {
    // คัดลอก: หน้าเดิมยังอยู่ (หันกลับ ถ้าดึงออกจะเป็นผนังกั้นภายใน — SketchUp ทำแบบเดียวกัน)
    s.faces.push(moved, ...sides);
  } else {
    s.faces[fi] = moved; s.faces.push(...sides);
  }
  return mergeCoplanar(cleanup(s));
}

// ---------------------------------------------------------------- รวมหน้า / ล้าง
/** รวมหน้า 2 หน้าที่อยู่ระนาบเดียวกัน ทิศเดียวกัน และมีเส้นร่วม (เฉพาะหน้าไม่มีรู) · ลบหน้าที่ซ้อนกลับทิศ */
export function mergeCoplanar(s) {
  let changed = true, guard = 0;
  while (changed && guard++ < 500) {
    changed = false;
    const E = edges(s);
    for (const [key, e] of E) {
      if (e.faces.length !== 2) continue;
      const [f, g] = e.faces; if (f === g) continue;
      const A = s.faces[f], B = s.faces[g];
      if (A.loops.length > 1 || B.loops.length > 1 || (A.mat || "") !== (B.mat || "")) continue;
      const na = normal(s, f), nb = normal(s, g);
      if (dot(na, nb) < 1 - 1e-6) continue;
      const pa = plane(s, f); if (Math.abs(dot(pa.n, centroid(s, B.loops[0])) - pa.d) > EPS * 2) continue;
      const m = joinLoops(A.loops[0], B.loops[0]); if (!m) continue;
      s.faces[f] = { ...A, loops: [m] }; s.faces.splice(g, 1); changed = true; break;
    }
  }
  return dropCollinear(cleanup(s));
}
/** ต่อวงสองวงที่มีเส้นร่วม (สวนทางกัน) → วงเดียว: ตัดคู่เส้นที่สวนกันทิ้ง แล้วเดินตามเส้นที่เหลือ */
function joinLoops(A, B) {
  const dir = [];
  for (const L of [A, B]) L.forEach((a, k) => dir.push([a, L[(k + 1) % L.length]]));
  const has = new Set(dir.map(([a, b]) => a + ">" + b));
  const rest = dir.filter(([a, b]) => !has.has(b + ">" + a));
  if (rest.length === dir.length) return null;                    // ไม่มีเส้นร่วม
  const next = new Map();
  for (const [a, b] of rest) { if (next.has(a)) return null; next.set(a, b); }   // จุดแตะกันหลายทาง: ไม่รวม
  const out = [rest[0][0]]; let v = next.get(out[0]), guard = 0;
  while (v !== out[0] && v !== undefined && guard++ < rest.length + 1) { out.push(v); v = next.get(v); }
  return v === out[0] && out.length === rest.length ? out : null;  // ได้หลายวง (เกิดรู) = ไม่รวม
}
/** ลบจุดที่อยู่กลางเส้นตรงและใช้แค่ 2 หน้า (เส้นตรงต่อเนื่อง) */
export function dropCollinear(s) {
  const use = new Map(); s.faces.forEach((F) => F.loops.forEach((L) => L.forEach((i) => use.set(i, (use.get(i) || 0) + 1))));
  for (const F of s.faces) F.loops = F.loops.map((L) => {
    if (L.length <= 3) return L;
    const keep = L.filter((v, k) => {
      if (use.get(v) > 2) return true;
      const a = s.verts[L[(k + L.length - 1) % L.length]], b = s.verts[v], c = s.verts[L[(k + 1) % L.length]];
      return len(cross(sub(b, a), sub(c, b))) > EPS * len(sub(c, a));
    });
    return keep.length >= 3 ? keep : L;
  });
  // ลบจุดเดียวกันออกจากทุกหน้าให้ตรงกัน (เส้นตรงที่ติดกัน 2 หน้า)
  const used = new Set(); s.faces.forEach((F) => F.loops.forEach((L) => L.forEach((i) => used.add(i))));
  for (const F of s.faces) F.loops = F.loops.map((L) => L.filter((i) => used.has(i)));
  return compact(s);
}
/** ลบหน้าที่เสื่อม (< 3 จุด · พื้นที่ ~0) และจุดที่ไม่ถูกใช้ */
export function cleanup(s) {
  s.faces = s.faces.filter((F) => F.loops[0] && F.loops[0].length >= 3);
  s.faces = s.faces.filter((F, fi) => faceArea(s, fi) > 1);
  return compact(s);
}
export function compact(s) {
  const used = new Set(); s.faces.forEach((F) => F.loops.forEach((L) => L.forEach((i) => used.add(i))));
  const map = new Map(), verts = [];
  s.verts.forEach((p, i) => { if (used.has(i)) { map.set(i, verts.length); verts.push(p); } });
  s.verts = verts; s.faces = s.faces.map((F) => ({ ...F, loops: F.loops.map((L) => L.map((i) => map.get(i))) }));
  return s;
}

// ---------------------------------------------------------------- แปลงทั้งก้อน
export function translate(s0, d) { const s = clone(s0); s.verts = s.verts.map((p) => p.map((v, k) => r1(v + (d[k] || 0)))); return s; }
export function rotateZ(s0, deg, c) { const a = (deg * Math.PI) / 180, co = Math.cos(a), si = Math.sin(a), s = clone(s0); s.verts = s.verts.map(([x, y, z]) => [r1(c[0] + (x - c[0]) * co - (y - c[1]) * si), r1(c[1] + (x - c[0]) * si + (y - c[1]) * co), z]); return s; }
/** ผังจากด้านบน: วงนอกของหน้าที่หันขึ้น (ใช้กับผัง 2D · DXF · ชุดแบบ) → [{ pts:[[x,y]], z, base }] */
export function topOutlines(s) {
  const { lo } = bbox(s), out = [];
  s.faces.forEach((F, fi) => { const n = normal(s, fi); if (n[2] > 0.5) { const L = F.loops[0]; out.push({ pts: L.map((i) => [s.verts[i][0], s.verts[i][1]]), z: Math.max(...L.map((i) => s.verts[i][2])), base: lo[2] }); } });
  return out;
}
/** หาหน้าที่ระนาบตรงกับจุด p (มม.) มากที่สุด — สำหรับวาดบนหน้า */
export function faceAt(s, p) {
  let best = -1, bd = Infinity;
  s.faces.forEach((F, fi) => { const { n, d } = plane(s, fi), dist = Math.abs(dot(n, p) - d); if (dist < bd && dist < 5 && inFace(s, fi, p)) { bd = dist; best = fi; } });
  return best;
}
/** จุด p อยู่ในหน้า (บนระนาบหน้า) ไหม */
export function inFace(s, fi, p) {
  const F = s.faces[fi], b = basis(normal(s, fi)), q = to2(p, b);
  const pip = (L) => { const P = L.map((i) => to2(s.verts[i], b)); let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > q[1]) !== (P[j][1] > q[1]) && q[0] < ((P[j][0] - P[i][0]) * (q[1] - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; };
  return pip(F.loops[0]) && !F.loops.slice(1).some(pip);
}

// ================================================================ ขั้น B: แบ่ง · ตัด · ลบ · รู (0.27)
const near = (a, b, e = EPS * 2) => Math.abs(a[0] - b[0]) <= e && Math.abs(a[1] - b[1]) <= e && Math.abs(a[2] - b[2]) <= e;
/** จุด p (มม.) อยู่บนเส้น a–b ไหม → t (0..1) หรือ -1 */
export function onSeg(p, a, b, tol = 2) {
  const ab = sub(b, a), L2 = dot(ab, ab); if (!L2) return -1;
  const t = dot(sub(p, a), ab) / L2; if (t < -1e-6 || t > 1 + 1e-6) return -1;
  return len(sub(add(a, mul(ab, t)), p)) <= tol ? Math.max(0, Math.min(1, t)) : -1;
}
/** หาจุดเดิมที่ตรงกับ p หรือแทรกจุดใหม่บนเส้นที่ p อยู่ (ทุกหน้าที่ใช้เส้นนั้นได้จุดเพิ่ม) · คืนดัชนี หรือ -1 ถ้าไม่อยู่บนเส้นใด */
export function vertexAt(s, p, tol = 2) {
  const i = s.verts.findIndex((v) => near(v, p, tol)); if (i >= 0) return i;
  for (const e of edges(s).values()) {
    const t = onSeg(p, s.verts[e.a], s.verts[e.b], tol); if (t <= 0 || t >= 1) continue;
    const ni = s.verts.length; s.verts.push(p.map(r1));
    for (const F of s.faces) F.loops = F.loops.map((L) => { const out = []; L.forEach((v, k) => { out.push(v); const w = L[(k + 1) % L.length]; if (ekey(v, w) === ekey(e.a, e.b)) out.push(ni); }); return out; });
    return ni;
  }
  return -1;
}
function inPoly(s, L, p, fi) { const b = basis(normal(s, fi)), q = to2(p, b), P = L.map((i) => to2(s.verts[i], b)); let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > q[1]) !== (P[j][1] > q[1]) && q[0] < ((P[j][0] - P[i][0]) * (q[1] - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; }
/** แบ่งหน้าด้วยเส้นจากขอบถึงขอบ (pA, pB อยู่บนขอบวงนอก) → { s, faces: [หน้าเดิม, หน้าใหม่] } หรือ null */
export function splitFace(s0, fi, pA, pB) {
  const s = clone(s0), a = vertexAt(s, pA), b = vertexAt(s, pB);
  if (a < 0 || b < 0 || a === b) return null;
  const F = s.faces[fi], L = F.loops[0], ia = L.indexOf(a), ib = L.indexOf(b);
  if (ia < 0 || ib < 0 || (ia + 1) % L.length === ib || (ib + 1) % L.length === ia) return null;   // เส้นเดิม/ไม่อยู่บนหน้านี้
  if (!inFace(s, fi, mul(add(s.verts[a], s.verts[b]), 0.5))) return null;                         // เส้นแบ่งต้องผ่านในหน้า
  const walk = (i, j) => { const out = [L[i]]; let k = i; while (k !== j) { k = (k + 1) % L.length; out.push(L[k]); } return out; };
  const A = walk(ia, ib), B = walk(ib, ia), holes = F.loops.slice(1);
  s.faces[fi] = { ...F, loops: [A] }; s.faces.push({ ...F, loops: [B] });
  for (const H of holes) (inPoly(s, A, centroid(s, H), fi) ? s.faces[fi] : s.faces[s.faces.length - 1]).loops.push(H);
  return { s, faces: [fi, s.faces.length - 1] };
}
/** แบ่งหน้าด้วยเส้นหลายช่วง (โค้ง · วาดอิสระ): ปลายทั้งสองบนขอบวงนอก จุดกลางอยู่ในหน้า → { s, faces } หรือ null */
export function splitFacePath(s0, fi, pts3) {
  if (pts3.length < 2) return null;
  if (pts3.length === 2) return splitFace(s0, fi, pts3[0], pts3[1]);
  const s = clone(s0), mid = pts3.slice(1, -1);
  if (!mid.every((p) => inFace(s, fi, p))) return null;
  const a = vertexAt(s, pts3[0]), b = vertexAt(s, pts3[pts3.length - 1]);
  if (a < 0 || b < 0 || a === b) return null;
  const F = s.faces[fi], L = F.loops[0], ia = L.indexOf(a), ib = L.indexOf(b);
  if (ia < 0 || ib < 0) return null;
  const mi = mid.map((p) => { s.verts.push(p.map(r1)); return s.verts.length - 1; });
  const walk = (i, j) => { const out = [L[i]]; let k = i; while (k !== j) { k = (k + 1) % L.length; out.push(L[k]); } return out; };
  const A = [...walk(ia, ib), ...[...mi].reverse()], B = [...walk(ib, ia), ...mi], holes = F.loops.slice(1);
  s.faces[fi] = { ...F, loops: [A] }; s.faces.push({ ...F, loops: [B] });
  for (const H of holes) (inPoly(s, A, centroid(s, H), fi) ? s.faces[fi] : s.faces[s.faces.length - 1]).loops.push(H);
  return { s, faces: [fi, s.faces.length - 1] };
}
/** วาดรูปปิดในหน้า (เช่น สี่เหลี่ยมบนผนัง) → หน้านั้นมีรู + หน้าใหม่ตรงรู (ดึงเข้า = ช่องเว้า · ดันทะลุ = ช่องเปิด) */
export function addInnerFace(s0, fi, pts3) {
  const s = clone(s0), n = normal(s, fi);
  if (!pts3.every((p) => inFace(s, fi, p))) return null;
  if (Math.abs(dot(newell(pts3), n)) / 2 < 1e4) return null;               // เล็กกว่า 10 ซม.² (เช่น Offset จนเหลือศูนย์) = ไม่สร้าง
  let loop = pts3.map((p) => { s.verts.push(p.map(r1)); return s.verts.length - 1; });
  if (dot(newell(loop.map((i) => s.verts[i])), n) < 0) loop = loop.reverse();
  s.faces[fi].loops.push([...loop].reverse());
  s.faces.push({ loops: [loop], mat: s.faces[fi].mat });
  return { s, face: s.faces.length - 1 };
}
/** ลบเส้น: สองหน้าระนาบเดียวกัน = รวมเป็นหน้าเดียว · ไม่ใช่ = ลบหน้าที่ติดเส้นนั้น (ก้อนเปิด แบบ SketchUp) */
export function eraseEdge(s0, key) {
  const s = clone(s0), E = edges(s).get(key); if (!E) return s;
  if (E.faces.length === 2) {
    const [f, g] = E.faces, A = s.faces[f], B = s.faces[g];
    if (dot(normal(s, f), normal(s, g)) > 1 - 1e-6 && A.loops.length === 1 && B.loops.length === 1) {
      const m = joinLoops(A.loops[0], B.loops[0]);
      if (m) { s.faces[f] = { ...A, loops: [m] }; s.faces.splice(g, 1); return dropCollinear(cleanup(s)); }
    }
  }
  s.faces = s.faces.filter((_, i) => !E.faces.includes(i));
  return compact(s);
}
export function eraseFaces(s0, fis) { const s = clone(s0), set = new Set(fis); s.faces = s.faces.filter((_, i) => !set.has(i)); return compact(s); }

function toTris(s0) { const s = clone(s0), faces = []; s0.faces.forEach((F, fi) => { for (const t of triangulate(s0, fi)) faces.push({ loops: [t], mat: F.mat }); }); s.faces = faces; return s; }
function edgeCount(s, a, b) { let n = 0; for (const F of s.faces) for (const L of F.loops) L.forEach((v, k) => { if (ekey(v, L[(k + 1) % L.length]) === ekey(a, b)) n++; }); return n; }
/** ตัดก้อนด้วยระนาบ { n, d } (n·p = d) → [ก้อนฝั่ง n บวก, ก้อนฝั่งลบ] ปิดผิวรอยตัดให้ · ระนาบไม่ผ่านก้อน = null */
export function cutByPlane(s0, pl) {
  const side = (p) => dot(pl.n, p) - pl.d, sd = s0.verts.map(side);
  if (!(sd.some((v) => v > EPS) && sd.some((v) => v < -EPS))) return null;
  const T = toTris(s0), cut = new Map(), parts = [[], []];
  const P = T.verts.map((p) => p.slice()), sv = P.map(side);
  const mid = (a, b) => { const k = ekey(a, b); if (cut.has(k)) return cut.get(k); const t = sv[a] / (sv[a] - sv[b]); P.push(add(P[a], mul(sub(P[b], P[a]), t)).map(r1)); sv.push(0); cut.set(k, P.length - 1); return P.length - 1; };
  for (const F of T.faces) {
    const L = F.loops[0];
    for (const [pi, sign] of [[0, 1], [1, -1]]) {
      const out = [];
      L.forEach((a, k) => {
        const b = L[(k + 1) % L.length], va = sv[a] * sign, vb = sv[b] * sign;
        if (va >= -EPS) out.push(a);
        if ((va > EPS && vb < -EPS) || (va < -EPS && vb > EPS)) out.push(mid(a, b));
      });
      if (out.length >= 3) parts[pi].push({ loops: [out], mat: F.mat });
    }
  }
  const make = (pi, sign) => {
    const s = { ...clone(s0), id: uid("s"), verts: P.map((p) => p.slice()), faces: parts[pi] };
    // ผิวรอยตัด: เส้นบนระนาบที่มีหน้าใช้แค่ด้านเดียว ต่อเป็นวง (สวนทางกับหน้าที่ใช้) · หันออก = ทิศ −sign·n
    const open = [];
    for (const F of s.faces) { const L = F.loops[0]; L.forEach((a, k) => { const b = L[(k + 1) % L.length]; if (Math.abs(sv[a]) <= EPS && Math.abs(sv[b]) <= EPS && edgeCount(s, a, b) === 1) open.push([a, b]); }); }
    const next = new Map(); for (const [a, b] of open) next.set(b, a);
    const seen = new Set(), caps = [];
    for (const [a0] of open) {
      if (seen.has(a0)) continue; const loop = [a0]; seen.add(a0); let v = next.get(a0), g = 0;
      while (v !== undefined && v !== a0 && g++ < 100000) { loop.push(v); seen.add(v); v = next.get(v); }
      if (v === a0 && loop.length >= 3) caps.push(loop);
    }
    for (let L of caps) { if (dot(newell(L.map((i) => s.verts[i])), mul(pl.n, -sign)) < 0) L = L.reverse(); s.faces.push({ loops: [L] }); }
    return mergeCoplanar(cleanup(s));
  };
  return [make(0, 1), make(1, -1)];
}
/** ระนาบจากจุดของเส้นที่วาด · มีเส้นเดียว = ระนาบที่มีเส้นนั้นและตั้งฉากกับหน้าที่วาด (n0) · จุดไม่อยู่ระนาบเดียวกัน = null */
export function planeFrom(pts, n0) {
  let best = null;
  for (let i = 1; i < pts.length && !best; i++) for (let j = i + 1; j < pts.length; j++) { const c = cross(sub(pts[i], pts[0]), sub(pts[j], pts[0])); if (len(c) > 1e3) { best = norm(c); break; } }
  if (!best && n0 && pts.length >= 2) { const c = cross(sub(pts[1], pts[0]), n0); if (len(c) > 1e-6) best = norm(c); }
  if (!best) return null;
  if (!pts.every((p) => Math.abs(dot(best, sub(p, pts[0]))) <= 3)) return null;
  return { n: best, d: dot(best, pts[0]) };
}
/** Push/Pull ทะลุ: หน้า fi (เช่น หน้าที่วาดในผนัง) ดันเข้าจนถึงหน้าตรงข้ามที่ขนานกัน → เจาะรูทะลุ */
export function pushThrough(s0, fi) {
  const n = normal(s0, fi), c = centroid(s0, s0.faces[fi].loops[0]);
  let best = -1, bd = Infinity;
  s0.faces.forEach((G, gi) => { if (gi === fi || dot(normal(s0, gi), n) > -1 + 1e-6) return; const pg = plane(s0, gi), dist = dot(n, c) - (-pg.d); const depth = dot(n, c) + pg.d; void dist; if (depth > EPS && depth < bd && inFace(s0, gi, sub(c, mul(n, depth)))) { bd = depth; best = gi; } });
  if (best < 0) return null;
  const s = pushPull(s0, fi, -bd);
  const target = dot(n, c) - bd, area0 = faceArea(s0, fi);
  const mi = s.faces.findIndex((G, gi) => G.loops.length === 1 && dot(normal(s, gi), n) > 1 - 1e-6 && Math.abs(dot(n, centroid(s, G.loops[0])) - target) < EPS * 4 && Math.abs(faceArea(s, gi) - area0) < area0 * 0.01);
  if (mi < 0) return null;
  const hole = s.faces[mi].loops[0], hc = centroid(s, hole);
  const oi = s.faces.findIndex((G, gi) => gi !== mi && dot(normal(s, gi), n) < -1 + 1e-6 && Math.abs(dot(n, centroid(s, G.loops[0])) - target) < EPS * 4 && inFace(s, gi, hc));
  if (oi < 0) return null;
  s.faces[oi].loops.push(hole.slice());
  s.faces.splice(mi, 1);
  return compact(s);
}

// ================================================================ ขั้น C: หมุนรอบแกนใดก็ได้ · ย่อขยายตามแกน · Follow Me รูปใดก็ได้ · กลับด้านหน้า (0.28)
/** หมุนจุด (vis = ดัชนี · ไม่ระบุ = ทั้งก้อน) รอบแกน axis ผ่านจุด c เป็นมุม deg (มือขวา) */
export function rotateAxis(s0, c, axis, deg, vis) {
  const s = clone(s0), k = norm(axis), a = (deg * Math.PI) / 180, co = Math.cos(a), si = Math.sin(a), set = vis ? new Set(vis) : null;
  s.verts = s.verts.map((p, i) => {
    if (set && !set.has(i)) return p;
    const v = sub(p, c), r = add(add(mul(v, co), mul(cross(k, v), si)), mul(k, dot(k, v) * (1 - co)));   // Rodrigues
    return add(c, r).map(r1);
  });
  if (set) foldNonPlanar(s);
  return s;
}
/** ย่อขยายตามแกน (f = [fx, fy, fz]) รอบจุดยึด anchor · ตัวคูณลบ = กลับด้าน (กลับทิศหน้าให้) */
export function scaleAxes(s0, anchor, f, vis) {
  const s = clone(s0), set = vis ? new Set(vis) : null;
  s.verts = s.verts.map((p, i) => (set && !set.has(i) ? p : p.map((v, j) => r1(anchor[j] + (v - anchor[j]) * f[j]))));
  if (f[0] * f[1] * f[2] < 0) s.faces = s.faces.map((F) => ({ ...F, loops: F.loops.map((L) => L.slice().reverse()) }));
  if (set) foldNonPlanar(s);
  return s;
}
/** กลับด้านหน้า (Reverse Faces) */
export function reverseFaces(s0, fis) { const s = clone(s0), set = new Set(fis); s.faces = s.faces.map((F, i) => (set.has(i) ? { ...F, loops: F.loops.map((L) => L.slice().reverse()) } : F)); return s; }
/** Follow Me: กวาดหน้าตัด (จุด 3 มิติเรียงรอบ วางที่ต้นทาง) ไปตามเส้นทาง (จุด 3 มิติ) · มุมเลี้ยวตัดตามเส้นแบ่งครึ่งมุม · ทางปิด = วงรอบ */
export function sweep(profile, path, { closed = false, name = "Follow Me", mat } = {}) {
  const P = path.map((p) => p.slice()); if (P.length < 2) return null;
  const n = P.length, seg = (i) => norm(sub(P[(i + 1) % n], P[i]));
  // ระนาบที่แต่ละจุดของทาง: ตั้งฉากกับทิศเฉลี่ย (ครึ่งมุม) — ต้น/ปลายทางเปิด = ตั้งฉากช่วงแรก/สุดท้าย
  const planeN = (i) => { if (!closed && i === 0) return seg(0); if (!closed && i === n - 1) return seg(n - 2); const a = seg((i - 1 + n) % n), b = seg(i); const m = add(a, b); return len(m) < 1e-9 ? b : norm(m); };
  const rings = [], d0 = seg(0);
  let cur = profile.map((p) => p.slice());
  // ย้ายหน้าตัดไปที่จุดแรก (ฉายตามทิศช่วงแรกลงระนาบจุดแรก)
  const proj = (pts, o, nn, dir) => pts.map((p) => { const t = dot(nn, sub(o, p)) / (dot(nn, dir) || 1e-9); return add(p, mul(dir, t)); });
  cur = proj(cur, P[0], planeN(0), d0); rings.push(cur);
  const last = closed ? n : n - 1;
  for (let i = 1; i <= last; i++) {
    const j = i % n, dir = seg((i - 1 + n) % n);
    const nxt = proj(cur, P[j], planeN(j), dir);
    if (closed && i === n) break;
    rings.push(nxt); cur = nxt;
  }
  const verts = [], faces = [], m = profile.length;
  for (const R of rings) for (const p of R) verts.push(p.map(r1));
  const R = rings.length, segs = closed ? R : R - 1;
  for (let r = 0; r < segs; r++) {
    const a = r * m, b = ((r + 1) % R) * m;
    for (let k = 0; k < m; k++) { const k2 = (k + 1) % m; faces.push({ loops: [[a + k, a + k2, b + k2, b + k]] }); }
  }
  if (!closed) {
    // ฝาปิดหัวท้าย: เดินสวนกับหน้าข้างที่ใช้ขอบเดียวกัน (ผิวทั้งก้อนหันทางเดียวกัน) แล้วค่อยกลับทั้งก้อนถ้าปริมาตรติดลบ
    faces.push({ loops: [[...Array(m).keys()].reverse()] });
    faces.push({ loops: [[...Array(m).keys()].map((k) => (R - 1) * m + k)] });
  }
  let s = { id: uid("s"), name, verts, faces }; if (mat) s.mat = mat;
  // ทิศหน้า: ปริมาตรติดลบ = กลับทุกหน้า
  let v = 0; s.faces.forEach((F, fi) => { for (const [x, y, z] of triangulate(s, fi)) v += dot(s.verts[x], cross(s.verts[y], s.verts[z])) / 6; });
  if (v < 0) s = reverseFaces(s, s.faces.map((_, i) => i));
  return mergeCoplanar(cleanup(s));
}

// ---------------------------------------------------------------- Sandbox ภูมิประเทศ (0.29): พื้นผิวจากเส้นชั้นความสูง · ตาราง · ดันพื้น
/** Delaunay (Bowyer–Watson) บนระนาบ XY → สามเหลี่ยม [i,j,k] ทวนเข็ม (มองจากบน) */
export function delaunay(P) {
  const n = P.length; if (n < 3) return [];
  let lx = Infinity, ly = Infinity, hx = -Infinity, hy = -Infinity;
  for (const [x, y] of P) { lx = Math.min(lx, x); ly = Math.min(ly, y); hx = Math.max(hx, x); hy = Math.max(hy, y); }
  const d = Math.max(hx - lx, hy - ly) || 1, mx = (lx + hx) / 2, my = (ly + hy) / 2;
  const Q = P.map((p) => [p[0], p[1]]).concat([[mx - 20 * d, my - d], [mx + 20 * d, my - d], [mx, my + 20 * d]]);
  const circ = (a, b, c) => {
    const [ax, ay] = Q[a], [bx, by] = Q[b], [cx, cy] = Q[c], D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (Math.abs(D) < 1e-12) return { x: 0, y: 0, r: Infinity };
    const A = ax * ax + ay * ay, B = bx * bx + by * by, C = cx * cx + cy * cy;
    const x = (A * (by - cy) + B * (cy - ay) + C * (ay - by)) / D, y = (A * (cx - bx) + B * (ax - cx) + C * (bx - ax)) / D;
    return { x, y, r: (ax - x) ** 2 + (ay - y) ** 2 };
  };
  let T = [{ v: [n, n + 1, n + 2], c: circ(n, n + 1, n + 2) }];
  for (let i = 0; i < n; i++) {
    const [px, py] = Q[i], bad = [], keep = [];
    for (const t of T) ((px - t.c.x) ** 2 + (py - t.c.y) ** 2 < t.c.r * (1 + 1e-12) ? bad : keep).push(t);
    const cnt = new Map();
    for (const t of bad) for (let k = 0; k < 3; k++) { const a = t.v[k], b = t.v[(k + 1) % 3], key = a < b ? a + "," + b : b + "," + a; const e = cnt.get(key); if (e) e.n++; else cnt.set(key, { a, b, n: 1 }); }
    T = keep;
    for (const { a, b, n: m } of cnt.values()) if (m === 1) T.push({ v: [a, b, i], c: circ(a, b, i) });
  }
  const out = [];
  for (const { v: [a, b, c] } of T) {
    if (a >= n || b >= n || c >= n) continue;
    const s = (Q[b][0] - Q[a][0]) * (Q[c][1] - Q[a][1]) - (Q[b][1] - Q[a][1]) * (Q[c][0] - Q[a][0]);
    if (Math.abs(s) < 1e-6) continue;
    out.push(s > 0 ? [a, b, c] : [a, c, b]);
  }
  return out;
}
/** ผิวภูมิประเทศจากจุด 3D (สามเหลี่ยม · เส้นในซ่อนแบบ soft) — จุดซ้ำ XY ใกล้กว่า 1 มม. ใช้ตัวแรก */
export function terrain(pts, { name = "ภูมิประเทศ", mat = "grass", maxEdge = Infinity } = {}) {
  const verts = [], seen = new Map();
  for (const p of pts) { const k = Math.round(p[0]) + "," + Math.round(p[1]); if (seen.has(k)) continue; seen.set(k, verts.length); verts.push([Math.round(p[0]), Math.round(p[1]), Math.round(p[2] || 0)]); }
  const tris = delaunay(verts).filter((t) => [0, 1, 2].every((k) => Math.hypot(verts[t[k]][0] - verts[t[(k + 1) % 3]][0], verts[t[k]][1] - verts[t[(k + 1) % 3]][1]) <= maxEdge));
  if (!tris.length) return null;
  const s = { id: uid("s"), name, verts, faces: tris.map((t) => ({ loops: [t] })), terrain: true };
  if (mat) s.mat = mat;
  compact(s);
  const E = edges(s); s.soft = [...E.entries()].filter(([, e]) => e.faces.length > 1).map(([k]) => k);
  return s;
}
/** เส้นชั้นความสูง [{pts:[[x,y]], z, closed}] → จุด (แบ่งช่วงยาวทุก step มม.) */
export function contourPoints(lines, step = 1000) {
  const out = [];
  for (const l of lines) {
    const P = l.pts, z = l.z || 0, m = P.length, segs = l.closed ? m : m - 1;
    if (!l.closed || m === 1) out.push([P[m - 1][0], P[m - 1][1], z]);
    for (let i = 0; i < segs; i++) {
      const a = P[i], b = P[(i + 1) % m], L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.ceil(L / step));
      for (let j = 0; j < k; j++) out.push([a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k, z]);
    }
  }
  return out;
}
/** พื้นผิวตาราง (From Scratch): กว้าง w × ลึก h มม. ช่องละ cell มม. มุมล่างซ้าย o */
export function terrainGrid(o, w, h, cell = 1000, z = 0) {
  const nx = Math.max(1, Math.round(w / cell)), ny = Math.max(1, Math.round(h / cell)), pts = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) pts.push([o[0] + (w * i) / nx, o[1] + (h * j) / ny, z]);
  const s = { id: uid("s"), name: "ภูมิประเทศ (ตาราง)", verts: pts.map((p) => p.map(Math.round)), faces: [], terrain: true, mat: "grass" };
  const I = (i, j) => j * (nx + 1) + i;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { s.faces.push({ loops: [[I(i, j), I(i + 1, j), I(i + 1, j + 1)]] }, { loops: [[I(i, j), I(i + 1, j + 1), I(i, j + 1)]] }); }
  const E = edges(s); s.soft = [...E.entries()].filter(([, e]) => e.faces.length > 1).map(([k]) => k);
  return s;
}
/** ดันพื้น (Smoove): จุดในรัศมี r (แนวราบ) จาก c ขึ้น/ลง dz แบบโค้งนุ่ม (cos) — ใช้กับผิวสามเหลี่ยม */
export function smoove(s, c, r, dz) {
  const out = JSON.parse(JSON.stringify(s));
  out.verts = s.verts.map((p) => { const d = Math.hypot(p[0] - c[0], p[1] - c[1]); return d >= r ? p.slice() : [p[0], p[1], Math.round(p[2] + (dz * (1 + Math.cos((Math.PI * d) / r))) / 2)]; });
  return out;
}
