// เรขาคณิตขั้นที่ 2 ของ CAD 2D: จุดตัด · OFFSET · TRIM · EXTEND · FILLET · ARRAY · EXPLODE · มิติ · HATCH (โดย ลุงพี)
// ไม่มี DOM — ทดสอบด้วย node ได้ · วัตถุใช้รูปแบบเดียวกับ geom.js ({t, g, d, x})
import * as G from "./geom.js?v=0.10.0";

const EPS = 1e-9;
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const P = (p) => [r4(p[0]), r4(p[1])];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const len = (a) => Math.hypot(a[0], a[1]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const deg = (r) => (r * 180) / Math.PI;
const rad = (d) => (d * Math.PI) / 180;
const angAt = (c, p) => ((deg(Math.atan2(p[1] - c[1], p[0] - c[0])) % 360) + 360) % 360;
/** มุม a อยู่ในช่วงโค้ง a0→a1 (ทวนเข็ม) หรือไม่ */
export function inArc(a, a0, a1) { const s = (((a1 - a0) % 360) + 360) % 360 || 360, d = (((a - a0) % 360) + 360) % 360; return d <= s + 1e-7; }

// ------------------------------------------------------------------ ชิ้นส่วนพื้นฐาน (เส้นตรง / โค้ง) ของวัตถุ
/** วัตถุ → ชิ้น [{k:'L', a, b} | {k:'A', c, r, a0, a1} | {k:'C', c, r}] ในพิกัดโลก */
export function prims(e) {
  const g = e.g;
  if (g && e.t === "LINE") return [{ k: "L", a: g.a, b: g.b }];
  if (g && e.t === "CIRCLE") return [{ k: "C", c: g.c, r: g.r }];
  if (g && e.t === "ARC") return [{ k: "A", c: g.c, r: g.r, a0: g.a0, a1: g.a1 }];
  if (g && e.t === "LWPOLYLINE") {
    const out = [], n = g.pts.length;
    for (let i = 0; i < n - (g.closed ? 0 : 1); i++) {
      const p = g.pts[i], q = g.pts[(i + 1) % n], b = p[2] || 0;
      if (!b) out.push({ k: "L", a: [p[0], p[1]], b: [q[0], q[1]], i });
      else out.push({ ...bulgeArc(p, q, b), i });
    }
    return out;
  }
  // อื่น ๆ: ใช้เส้นแสดงผล (block · มิติ · spline ฯลฯ)
  const out = [];
  for (const [f, cl] of e.d || []) {
    const n = f.length / 2;
    for (let i = 0; i < n - 1; i++) out.push({ k: "L", a: [f[2 * i], f[2 * i + 1]], b: [f[2 * i + 2], f[2 * i + 3]] });
    if (cl && n > 2) out.push({ k: "L", a: [f[2 * n - 2], f[2 * n - 1]], b: [f[0], f[1]] });
  }
  return out;
}

/** bulge ระหว่าง p→q → โค้ง {k:'A', c, r, a0, a1, rev} (rev = เดินตามเข็ม) */
export function bulgeArc(p, q, b) {
  const L = Math.hypot(q[0] - p[0], q[1] - p[1]), th = 4 * Math.atan(b), r = L / (2 * Math.sin(th / 2));
  const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], n = [-(q[1] - p[1]) / L, (q[0] - p[0]) / L], h = r * Math.cos(th / 2);
  const c = [m[0] + n[0] * h, m[1] + n[1] * h], R = Math.abs(r);
  const a0 = angAt(c, p), a1 = angAt(c, q);
  return b > 0 ? { k: "A", c, r: R, a0, a1, rev: false } : { k: "A", c, r: R, a0: a1, a1: a0, rev: true };
}

// ------------------------------------------------------------------ จุดตัด
function segSeg(a, b, c, d, extA = false) {
  const r = sub(b, a), s = sub(d, c), den = cross(r, s);
  if (Math.abs(den) < EPS) return [];
  const t = cross(sub(c, a), s) / den, u = cross(sub(c, a), r) / den;
  if ((extA || (t >= -1e-9 && t <= 1 + 1e-9)) && u >= -1e-9 && u <= 1 + 1e-9) return [{ p: add(a, mul(r, t)), t }];
  return [];
}
function lineCircle(a, b, c, rr, extA = false) {
  const d = sub(b, a), f = sub(a, c), A = dot(d, d), B = 2 * dot(f, d), C = dot(f, f) - rr * rr, disc = B * B - 4 * A * C;
  if (disc < -EPS || A < EPS) return [];
  const sq = Math.sqrt(Math.max(0, disc)), out = [];
  for (const t of disc < EPS ? [-B / (2 * A)] : [(-B - sq) / (2 * A), (-B + sq) / (2 * A)]) if (extA || (t >= -1e-9 && t <= 1 + 1e-9)) out.push({ p: add(a, mul(d, t)), t });
  return out;
}
function circleCircle(c1, r1, c2, r2) {
  const d = len(sub(c2, c1)); if (d < EPS || d > r1 + r2 + EPS || d < Math.abs(r1 - r2) - EPS) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r1 * r1 - a * a)), u = norm(sub(c2, c1)), m = add(c1, mul(u, a));
  return h < EPS ? [m] : [add(m, mul([-u[1], u[0]], h)), sub(m, mul([-u[1], u[0]], h))];
}
const onPrim = (q, p) => q.k !== "A" || inArc(angAt(q.c, p), q.a0, q.a1);

/** จุดตัดระหว่างชิ้น p (ให้ t ถ้า p เป็นเส้นตรง · extend = ยืดเส้นตรง p ไม่จำกัด) กับชิ้น q */
export function intersect(p, q, extend = false) {
  let pts = [];
  if (p.k === "L" && q.k === "L") pts = segSeg(p.a, p.b, q.a, q.b, extend);
  else if (p.k === "L") pts = lineCircle(p.a, p.b, q.c, q.r, extend).filter((x) => onPrim(q, x.p));
  else if (q.k === "L") pts = lineCircle(q.a, q.b, p.c, p.r).filter((x) => onPrim(p, x.p)).map((x) => ({ p: x.p }));
  else pts = circleCircle(p.c, p.r, q.c, q.r).filter((x) => onPrim(p, x) && onPrim(q, x)).map((x) => ({ p: x }));
  return pts.filter((x) => onPrim(p, x.p) || extend);
}

/** จุดตัดทั้งหมดของวัตถุ e กับรายการวัตถุ others (สำหรับ OSNAP จุดตัด) */
export function intersections(e, others) {
  const out = [], A = prims(e);
  for (const o of others) { if (o === e) continue; const B = prims(o); for (const a of A) for (const b of B) for (const x of intersect(a, b)) out.push(x.p); }
  return out;
}

/** จุดตั้งฉากจาก p ลงชิ้น (OSNAP perpendicular) · จุดใกล้สุดบนวัตถุ (nearest) */
export function perpendicular(e, p) {
  const out = [];
  for (const q of prims(e)) {
    if (q.k === "L") { const d = sub(q.b, q.a), L2 = dot(d, d); if (L2 < EPS) continue; const t = dot(sub(p, q.a), d) / L2; if (t >= 0 && t <= 1) out.push(add(q.a, mul(d, t))); }
    else { const u = norm(sub(p, q.c)), x = add(q.c, mul(u, q.r)); if (onPrim(q, x)) out.push(x); }
  }
  return out;
}
export function nearest(e, p) {
  let best = null;
  for (const q of prims(e)) {
    let x;
    if (q.k === "L") { const d = sub(q.b, q.a), L2 = dot(d, d), t = L2 ? Math.max(0, Math.min(1, dot(sub(p, q.a), d) / L2)) : 0; x = add(q.a, mul(d, t)); }
    else { x = add(q.c, mul(norm(sub(p, q.c)), q.r)); if (!onPrim(q, x)) continue; }
    const dd = len(sub(x, p)); if (!best || dd < best.d) best = { p: x, d: dd };
  }
  return best && best.p;
}

// ------------------------------------------------------------------ OFFSET (ด้านที่ side ชี้)
export function offset(e, dist, side) {
  const g = e.g;
  if (!g) return null;
  if (e.t === "LINE") {
    const d = norm(sub(g.b, g.a)), n = [-d[1], d[0]], s = cross(d, sub(side, g.a)) >= 0 ? 1 : -1;
    return { t: "LINE", g: { a: P(add(g.a, mul(n, dist * s))), b: P(add(g.b, mul(n, dist * s))) } };
  }
  if (e.t === "CIRCLE" || e.t === "ARC") {
    const out = len(sub(side, g.c)) > g.r ? 1 : -1, r = g.r + out * dist;
    if (r <= EPS) return null;
    return { t: e.t, g: { ...g, r: r4(r) } };
  }
  if (e.t === "LWPOLYLINE") {
    // เลื่อนทุกช่วงไปด้านเดียวกัน แล้วหาจุดตัดของช่วงที่ติดกัน (ช่วงโค้ง bulge: ประมาณด้วยคอร์ด)
    const pts = g.pts.map((p) => [p[0], p[1]]), n = pts.length, closed = g.closed;
    const area = G_area(pts), segs = [];
    // ด้านของ side: เทียบกับช่วงที่ใกล้ที่สุด
    let best = 0, bd = Infinity;
    for (let i = 0; i < n - (closed ? 0 : 1); i++) { const a = pts[i], b = pts[(i + 1) % n], dd = G.segDist(side, a[0], a[1], b[0], b[1]); if (dd < bd) { bd = dd; best = i; } }
    const a0 = pts[best], b0 = pts[(best + 1) % n], s = cross(sub(b0, a0), sub(side, a0)) >= 0 ? 1 : -1;
    void area;
    for (let i = 0; i < n - (closed ? 0 : 1); i++) {
      const a = pts[i], b = pts[(i + 1) % n], d = norm(sub(b, a)), nn = [-d[1] * s * dist, d[0] * s * dist];
      segs.push([add(a, nn), add(b, nn)]);
    }
    const out = [];
    const m = segs.length;
    for (let i = 0; i < m; i++) {
      if (!closed && i === 0) { out.push(segs[0][0]); continue; }
      const prev = segs[(i - 1 + m) % m], cur = segs[i];
      out.push(lineX(prev, cur));                                // จุดตัดของแนวเส้น (ไม่จำกัดช่วง) · ขนานกัน → ใช้จุดต้น
    }
    if (!closed) out.push(segs[m - 1][1]);
    return { t: "LWPOLYLINE", g: { pts: out.map((p) => [...P(p), 0]), closed, w: g.w || 0 } };
  }
  return null;
}
function lineX(s1, s2) { const r = sub(s1[1], s1[0]), s = sub(s2[1], s2[0]), den = cross(r, s); if (Math.abs(den) < EPS) return s2[0]; const t = cross(sub(s2[0], s1[0]), s) / den; return add(s1[0], mul(r, t)); }
function G_area(pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
export const polyArea = G_area;

// ------------------------------------------------------------------ TRIM / EXTEND
/** ตัดส่วนของ e ที่คลิก (pick) ออก โดยใช้วัตถุอื่นเป็นขอบตัด → รายการวัตถุใหม่ (0–2 ชิ้น) หรือ null ถ้าไม่มีจุดตัด */
export function trim(e, pick, cutters) {
  const g = e.g; if (!g) return null;
  const cuts = [];
  for (const c of cutters) if (c !== e) for (const q of prims(c)) for (const p of prims(e)) for (const x of intersect(p, q)) cuts.push(x.p);
  if (e.t === "LINE") {
    const d = sub(g.b, g.a), L2 = dot(d, d), tp = dot(sub(pick, g.a), d) / L2;
    const ts = cuts.map((p) => dot(sub(p, g.a), d) / L2).filter((t) => t > 1e-7 && t < 1 - 1e-7).sort((a, b) => a - b);
    if (!ts.length) return null;
    const lo = Math.max(0, ...ts.filter((t) => t < tp)), hi = Math.min(1, ...ts.filter((t) => t > tp));
    const out = [];
    if (lo > 1e-7) out.push({ t: "LINE", g: { a: g.a, b: P(add(g.a, mul(d, lo))) } });
    if (hi < 1 - 1e-7) out.push({ t: "LINE", g: { a: P(add(g.a, mul(d, hi))), b: g.b } });
    return out;
  }
  if (e.t === "CIRCLE" || e.t === "ARC") {
    const full = e.t === "CIRCLE", a0 = full ? 0 : g.a0, span = full ? 360 : ((((g.a1 - g.a0) % 360) + 360) % 360 || 360);
    const rel = (a) => ((((a - a0) % 360) + 360) % 360);
    const as = [...new Set(cuts.map((p) => r4(rel(angAt(g.c, p)))))].filter((a) => a > 1e-6 && a < span - 1e-6).sort((x, y) => x - y);
    if (!as.length || (full && as.length < 2)) return null;
    const ap = rel(angAt(g.c, pick));
    if (full) {
      let lo = as.filter((a) => a <= ap).pop(), hi = as.find((a) => a > ap);
      if (lo == null) lo = as[as.length - 1] - 360; if (hi == null) hi = as[0] + 360;
      return [{ t: "ARC", g: { c: g.c, r: g.r, a0: r4((a0 + hi) % 360), a1: r4((a0 + lo + 360) % 360) } }];
    }
    const lo = Math.max(0, ...as.filter((a) => a < ap)), hi = Math.min(span, ...as.filter((a) => a > ap)), out = [];
    if (lo > 1e-6) out.push({ t: "ARC", g: { c: g.c, r: g.r, a0: g.a0, a1: r4((a0 + lo) % 360) } });
    if (hi < span - 1e-6) out.push({ t: "ARC", g: { c: g.c, r: g.r, a0: r4((a0 + hi) % 360), a1: g.a1 } });
    return out;
  }
  if (e.t === "LWPOLYLINE" && !g.closed) {
    // ตัดตามระยะทางตามแนวโพลีไลน์ (ช่วงตรงเท่านั้นแม่นยำ · ช่วงโค้งใช้คอร์ด)
    const pts = g.pts.map((p) => [p[0], p[1]]), acc = [0];
    for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + len(sub(pts[i], pts[i - 1])));
    const at = (p) => { let best = null; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], d = sub(b, a), L2 = dot(d, d) || 1, t = Math.max(0, Math.min(1, dot(sub(p, a), d) / L2)), q = add(a, mul(d, t)), dd = len(sub(q, p)); if (!best || dd < best.d) best = { d: dd, s: acc[i] + t * Math.sqrt(L2) }; } return best.s; };
    const total = acc[acc.length - 1], sp = at(pick);
    const ss = cuts.map(at).filter((s) => s > 1e-7 && s < total - 1e-7).sort((a, b) => a - b);
    if (!ss.length) return null;
    const lo = Math.max(0, ...ss.filter((s) => s < sp)), hi = Math.min(total, ...ss.filter((s) => s > sp));
    const piece = (s0, s1) => { const out = [pointAt(pts, acc, s0)]; for (let i = 1; i < pts.length - 1; i++) if (acc[i] > s0 + 1e-9 && acc[i] < s1 - 1e-9) out.push(pts[i]); out.push(pointAt(pts, acc, s1)); return { t: "LWPOLYLINE", g: { pts: out.map((p) => [...P(p), 0]), closed: false, w: g.w || 0 } }; };
    const out = [];
    if (lo > 1e-7) out.push(piece(0, lo));
    if (hi < total - 1e-7) out.push(piece(hi, total));
    return out;
  }
  return null;
}
function pointAt(pts, acc, s) { for (let i = 0; i < pts.length - 1; i++) if (s <= acc[i + 1] + 1e-12) { const t = (s - acc[i]) / ((acc[i + 1] - acc[i]) || 1); return add(pts[i], mul(sub(pts[i + 1], pts[i]), t)); } return pts[pts.length - 1]; }

/** ยืดปลายเส้นตรง/โค้งด้านที่คลิกไปชนขอบที่ใกล้ที่สุด */
export function extend(e, pick, bounds) {
  const g = e.g; if (!g) return null;
  if (e.t === "LINE") {
    const endB = len(sub(pick, g.b)) < len(sub(pick, g.a)), from = endB ? g.a : g.b, to = endB ? g.b : g.a;
    const ray = { k: "L", a: from, b: to }, L = len(sub(to, from));
    let best = null;
    for (const b of bounds) if (b !== e) for (const q of prims(b)) for (const x of intersect(ray, q, true)) {
      const t = x.t; if (t > 1 + 1e-7 && (!best || t < best.t)) best = { t, p: x.p };
    }
    if (!best) return null;
    void L;
    return { t: "LINE", g: endB ? { a: g.a, b: P(best.p) } : { a: P(best.p), b: g.b } };
  }
  if (e.t === "ARC") {
    const endA1 = len(sub(pick, ptOn(g, g.a1))) < len(sub(pick, ptOn(g, g.a0)));
    let best = null;
    for (const b of bounds) if (b !== e) for (const q of prims(b)) for (const x of intersect({ k: "C", c: g.c, r: g.r }, q)) {
      const a = angAt(g.c, x.p), d = endA1 ? (((a - g.a1) % 360) + 360) % 360 : (((g.a0 - a) % 360) + 360) % 360;
      if (d > 1e-6 && !inArc(a, g.a0, g.a1) && (!best || d < best.d)) best = { d, a };
    }
    if (!best) return null;
    return { t: "ARC", g: endA1 ? { ...g, a1: r4(best.a) } : { ...g, a0: r4(best.a) } };
  }
  return null;
}
const ptOn = (g, a) => [g.c[0] + g.r * Math.cos(rad(a)), g.c[1] + g.r * Math.sin(rad(a))];

// ------------------------------------------------------------------ FILLET (เส้นตรง 2 เส้น · รัศมี 0 = มุมแหลม)
export function fillet(e1, p1, e2, p2, r) {
  if (e1.t !== "LINE" || e2.t !== "LINE") return null;
  const A = e1.g, B = e2.g, X = segSeg(A.a, A.b, B.a, B.b, true);
  const den = cross(sub(A.b, A.a), sub(B.b, B.a)); if (Math.abs(den) < EPS) return null;
  const ip = lineX([A.a, A.b], [B.a, B.b]); void X;
  // ฝั่งที่เก็บ: ปลายที่ไกลจากจุดตัดในทิศที่คลิก
  // ปลายที่เก็บ: ปลายด้านที่คลิกซึ่งไกลจากจุดตัดที่สุด (ส่วนที่ใกล้จุดตัดถูกตัด/ยืดให้พอดี)
  const keep = (L, pk) => {
    const da = len(sub(L.a, ip)), db = len(sub(L.b, ip)), dir = sub(pk, ip);
    const sa = dot(sub(L.a, ip), dir) > 1e-12, sb = dot(sub(L.b, ip), dir) > 1e-12;
    if (sa && sb) return da >= db ? L.a : L.b;
    if (sa) return L.a; if (sb) return L.b;
    return da >= db ? L.a : L.b;
  };
  const fa = keep(A, p1), fb = keep(B, p2), u = norm(sub(fa, ip)), v = norm(sub(fb, ip));
  if (r <= EPS) return { e1: { t: "LINE", g: { a: P(fa), b: P(ip) } }, e2: { t: "LINE", g: { a: P(ip), b: P(fb) } }, arc: null };
  const half = Math.acos(Math.max(-1, Math.min(1, dot(u, v)))) / 2, dlen = r / Math.tan(half);
  if (dlen > len(sub(fa, ip)) + 1e-6 || dlen > len(sub(fb, ip)) + 1e-6) return null;
  const t1 = add(ip, mul(u, dlen)), t2 = add(ip, mul(v, dlen)), bis = norm(add(u, v)), c = add(ip, mul(bis, r / Math.sin(half)));
  let a0 = angAt(c, t1), a1 = angAt(c, t2);
  if ((((a1 - a0) % 360) + 360) % 360 > 180) [a0, a1] = [a1, a0];
  return { e1: { t: "LINE", g: { a: P(fa), b: P(t1) } }, e2: { t: "LINE", g: { a: P(t2), b: P(fb) } }, arc: { t: "ARC", g: { c: P(c), r: r4(r), a0: r4(a0), a1: r4(a1) } } };
}

// ------------------------------------------------------------------ ARRAY
export function rectArray(rows, cols, dx, dy) {
  const out = [];
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) if (i || j) out.push(G.translate(j * dx, i * dy));
  return out;
}
export function polarArray(n, center, totalDeg = 360, rotateItems = true) {
  const out = [], step = Math.abs(totalDeg - 360) < 1e-9 ? 360 / n : totalDeg / (n - 1);
  for (let i = 1; i < n; i++) out.push(rotateItems ? G.rotateAt(step * i, center) : null);
  return out.filter(Boolean);
}

// ------------------------------------------------------------------ EXPLODE
/** โพลีไลน์ → เส้น/โค้ง · วัตถุแสดงผลอย่างเดียว (block ฯลฯ) → เส้นจากเส้นแสดงผล + ข้อความ */
export function explode(e) {
  if (e.t === "LWPOLYLINE") return prims(e).map((q) => q.k === "L" ? { t: "LINE", g: { a: P(q.a), b: P(q.b) } } : { t: "ARC", g: { c: P(q.c), r: r4(q.r), a0: r4(q.a0), a1: r4(q.a1) } });
  if (e.t === "LINE" || e.t === "CIRCLE" || e.t === "ARC" || e.t === "TEXT" || e.t === "MTEXT" || e.t === "POINT") return null;
  const out = [];
  for (const [f, cl] of e.d || []) {
    const pts = []; for (let i = 0; i < f.length; i += 2) pts.push([f[i], f[i + 1], 0]);
    if (pts.length === 2) out.push({ t: "LINE", g: { a: P(pts[0]), b: P(pts[1]) } });
    else if (pts.length > 2) out.push({ t: "LWPOLYLINE", g: { pts, closed: !!cl, w: 0 } });
  }
  for (const [x, y, h, rot, s] of e.x || []) out.push({ t: "TEXT", g: { p: [x, y], h, rot, s, ha: 0, va: 0 } });
  return out;
}

// ------------------------------------------------------------------ มิติ (แสดงผลฝั่งหน้าเว็บ · server สร้าง DIMENSION จริงตอนบันทึก)
/** มิติแนวตรง: kind 'h' แนวนอน · 'v' แนวตั้ง · 'al' ตามแนวจุด · loc = ตำแหน่งเส้นมิติ */
export function dimGeom(p1, p2, loc, kind) {
  let dir;
  if (kind === "al") dir = norm(sub(p2, p1));
  else if (kind === "v") dir = [0, 1];
  else if (kind === "h") dir = [1, 0];
  else dir = Math.abs(loc[0] - (p1[0] + p2[0]) / 2) > Math.abs(loc[1] - (p1[1] + p2[1]) / 2) ? [0, 1] : [1, 0];
  const n = [-dir[1], dir[0]], off = dot(sub(loc, p1), n);
  const d1 = add(p1, mul(n, off)), dd = dot(sub(p2, p1), dir), d2 = add(d1, mul(dir, dd));
  return { p1: P(p1), p2: P(p2), loc: P(add(d1, mul(dir, dd / 2))), angle: r4(deg(Math.atan2(dir[1], dir[0]))), value: Math.abs(dd), d1, d2, n, dir, aligned: kind === "al" };
}
export function dimDisplay(g, txtH) {
  const { p1, p2, d1, d2, dir, n, value } = g.d1 ? g : dimGeom(g.p1, g.p2, g.loc, g.aligned ? "al" : Math.abs(g.angle) < 45 || Math.abs(g.angle) > 135 ? "h" : "v");
  const ext = 0.25 * txtH, off = (q, p) => { const v = sub(q, p), s = dot(v, n) >= 0 ? 1 : -1; return add(q, mul(n, s * ext)); };
  const tick = (q) => [...add(q, mul(add(dir, n), -0.6 * txtH)), ...add(q, mul(add(dir, n), 0.6 * txtH))];
  const ang = (deg(Math.atan2(dir[1], dir[0])) + 360) % 360, rot = ang > 90 && ang <= 270 ? ang - 180 : ang;
  const mid = mul(add(d1, d2), 0.5), s = fmtDim(value), tw = s.length * txtH * 0.6;
  const tp = add(add(mid, mul(norm(dir), -tw / 2 * (rot === ang ? 1 : -1))), mul(n, txtH * 0.4 * (dot(n, [0, 1]) >= 0 ? 1 : -1)));
  return {
    d: [[[...p1, ...off(d1, p1)], 0, 256], [[...p2, ...off(d2, p2)], 0, 256], [[...d1, ...d2], 0, 256], [tick(d1), 0, 256], [tick(d2), 0, 256]].map(([f, c, col]) => [f.map(r4), c, col]),
    x: [[r4(tp[0]), r4(tp[1]), txtH, r4(rot), s, 256]],
  };
}
export function fmtDim(v) { return Math.abs(v - Math.round(v)) < 1e-6 ? String(Math.round(v)) : (Math.round(v * 100) / 100).toString(); }

// ------------------------------------------------------------------ HATCH (ลายเส้น ANSI31 ในรูปปิด)
export function hatchLines(boundary, spacing, angleDeg = 45) {
  const a = rad(angleDeg), u = [Math.cos(a), Math.sin(a)], n = [-u[1], u[0]];
  const proj = boundary.map((p) => dot(p, n)), lo = Math.min(...proj), hi = Math.max(...proj), out = [];
  if (!(spacing > 0) || (hi - lo) / spacing > 4000) return out;
  for (let s = Math.ceil(lo / spacing) * spacing; s <= hi; s += spacing) {
    const xs = [];
    for (let i = 0; i < boundary.length; i++) {
      const p = boundary[i], q = boundary[(i + 1) % boundary.length], dp = dot(p, n) - s, dq = dot(q, n) - s;
      if ((dp < 0) !== (dq < 0)) { const t = dp / (dp - dq); xs.push(dot(add(p, mul(sub(q, p), t)), u)); }
    }
    xs.sort((x, y) => x - y);
    for (let i = 0; i + 1 < xs.length; i += 2) out.push([...add(mul(n, s), mul(u, xs[i])), ...add(mul(n, s), mul(u, xs[i + 1]))].map(r4));
  }
  return out;
}

/** ขอบรูปปิดของวัตถุ (สำหรับ HATCH / AREA) */
export function closedBoundary(e, tol = 0.01) {
  if (e.t === "CIRCLE") { const f = G.arcPoints(e.g.c, e.g.r, 0, 360, tol); const out = []; for (let i = 0; i < f.length - 2; i += 2) out.push([f[i], f[i + 1]]); return out; }
  if (e.t === "LWPOLYLINE" && e.g.closed) { const f = G.displayOf("LWPOLYLINE", e.g, tol).d[0][0]; const out = []; for (let i = 0; i < f.length; i += 2) out.push([f[i], f[i + 1]]); return out; }
  return null;
}
