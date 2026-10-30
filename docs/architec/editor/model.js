// แบบจำลองข้อมูลตัวเขียนแบบ pee_architec — ไม่มี DOM/three (ทดสอบด้วย node ได้) (โดย ลุงพี)
// หน่วย มม. · แกน x ขวา y ขึ้น (บนกระดาษ = ทิศเหนือของแบบ) · ความสูง z
export const DEFAULTS = {
  wall: { thick: 200, height: 3000 },
  door: { width: 900, height: 2100, sill: 0 },
  window: { width: 1200, height: 1100, sill: 900 },
  mass: { height: 3000 },
  roof: { type: "gable", pitch: 20, overhang: 600, ridge: "auto", thick: 150, rise: 0, facets: 6, angle: null },
  pv: { enabled: true, length: 2278, width: 1134, gap: 20, edge: 400, watt: 550, portrait: true },
};

let seq = 0;
export function uid(prefix) { seq += 1; return prefix + Date.now().toString(36) + seq.toString(36); }

export function newDoc(name) {
  return {
    app: "pee_architec-drawing", version: 1, name: name || "แบบใหม่", units: "mm",
    site: { lat: null, lon: null, north: 0 },
    walls: [], openings: [], masses: [], lines: [], dims: [], texts: [], syms: [], trees: [], cads: [], backdrop: null,
    roof: Object.assign({}, DEFAULTS.roof), pv: Object.assign({}, DEFAULTS.pv),
  };
}

export function normalize(doc) {
  const d = Object.assign(newDoc(), doc || {});
  for (const k of ["walls", "openings", "masses", "lines", "dims", "texts", "syms", "trees", "cads"]) d[k] = Array.isArray(d[k]) ? d[k] : [];
  d.roof = Object.assign({}, DEFAULTS.roof, d.roof || {});
  d.pv = Object.assign({}, DEFAULTS.pv, d.pv || {});
  d.site = Object.assign({ lat: null, lon: null, north: 0 }, d.site || {});
  return d;
}

// ------------------------------------------------------------------ ประวัติ (undo/redo)
export class History {
  constructor(doc, limit = 200) { this.limit = limit; this.past = []; this.future = []; this.doc = normalize(doc); }
  commit(mutate) {
    this.past.push(JSON.stringify(this.doc));
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
    mutate(this.doc);
    return this.doc;
  }
  undo() { if (!this.past.length) return false; this.future.push(JSON.stringify(this.doc)); this.doc = JSON.parse(this.past.pop()); return true; }
  redo() { if (!this.future.length) return false; this.past.push(JSON.stringify(this.doc)); this.doc = JSON.parse(this.future.pop()); return true; }
  replace(doc) { this.past.push(JSON.stringify(this.doc)); this.future = []; this.doc = normalize(doc); }
}

// ------------------------------------------------------------------ เรขาคณิต 2D
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const mul = (a, k) => [a[0] * k, a[1] * k];
export const len = (a) => Math.hypot(a[0], a[1]);
export const dist = (a, b) => len(sub(a, b));
export const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
export const perp = (a) => [-a[1], a[0]];

export function wallLength(w) { return dist(w.a, w.b); }

/** สี่เหลี่ยมผนัง (มุม 4 จุด) */
export function wallPolygon(w) {
  const u = norm(sub(w.b, w.a)), n = mul(perp(u), w.thick / 2);
  return [add(w.a, n), add(w.b, n), sub(w.b, n), sub(w.a, n)];
}

/** ระยะจากจุดถึงเส้นผนัง + ตำแหน่ง t (0..1) */
export function projectOnSegment(p, a, b) {
  const ab = sub(b, a), L2 = ab[0] * ab[0] + ab[1] * ab[1];
  const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / L2)) : 0;
  const q = add(a, mul(ab, t));
  return { t, q, d: dist(p, q) };
}

export function pointInPolygon(p, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function polygonArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; s += x1 * y2 - x2 * y1; }
  return s / 2;
}

/** ช่องเปิดของผนัง → ช่วง [s0, s1] (มม. จากปลาย a) เรียงตามตำแหน่ง ตัดให้อยู่ในผนัง */
export function openingSpans(doc, wall) {
  const L = wallLength(wall);
  return doc.openings.filter((o) => o.wall === wall.id).map((o) => {
    const c = o.t * L, h = o.width / 2;
    return { o, s0: Math.max(0, c - h), s1: Math.min(L, c + h) };
  }).sort((a, b) => a.s0 - b.s0);
}

/** ชิ้นผนังสำหรับ 3D: [{s0, s1, z0, z1}] — ตัดรูประตู/หน้าต่างออก */
export function wallPieces(doc, wall) {
  const L = wallLength(wall), H = wall.height, out = [];
  let cur = 0;
  for (const { o, s0, s1 } of openingSpans(doc, wall)) {
    if (s0 > cur) out.push({ s0: cur, s1: s0, z0: 0, z1: H });
    const top = Math.min(H, o.sill + o.height);
    if (o.sill > 0) out.push({ s0, s1, z0: 0, z1: o.sill });
    if (top < H) out.push({ s0, s1, z0: top, z1: H });
    cur = Math.max(cur, s1);
  }
  if (cur < L) out.push({ s0: cur, s1: L, z0: 0, z1: H });
  return out.filter((p) => p.s1 - p.s0 > 0.5 && p.z1 - p.z0 > 0.5);
}

export function bounds(doc) {
  const xs = [], ys = [];
  const addp = (p) => { xs.push(p[0]); ys.push(p[1]); };
  doc.walls.forEach((w) => wallPolygon(w).forEach(addp));
  doc.masses.forEach((m) => m.pts.forEach(addp));
  doc.lines.forEach((l) => l.pts.forEach(addp));
  doc.dims.forEach((d) => { addp(d.a); addp(d.b); });
  doc.texts.forEach((t) => addp(t.p));
  doc.trees.forEach((t) => { addp([t.p[0] - t.r, t.p[1] - t.r]); addp([t.p[0] + t.r, t.p[1] + t.r]); });
  for (const c of doc.cads || []) {
    if (!c.bbox) continue;
    const k = c.toMM; addp([c.dx + c.bbox[0] * k, c.dy + c.bbox[1] * k]); addp([c.dx + c.bbox[2] * k, c.dy + c.bbox[3] * k]);
  }
  if (doc.imported) {
    (doc.imported.outlines || []).forEach((o) => o.pts.forEach(addp));
    const ft = doc.imported.features;
    if (ft) { ft.trees.forEach((t) => { addp([t.c[0] - t.r, t.c[1] - t.r]); addp([t.c[0] + t.r, t.c[1] + t.r]); });
      [...ft.obstacles, ...ft.walls, ...ft.equipment, ...ft.routes].forEach((o) => o.pts.forEach(addp)); }
    const tv = doc.imported.top; if (tv) { addp([tv.x, tv.y]); addp([tv.x + tv.w, tv.y - tv.h]); }
  }
  doc.syms.forEach((s) => addp(s.p));
  if (!xs.length) return null;
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** กรอบผนัง (ใช้วางพื้น/หลังคา) — เฉพาะผนัง ไม่รวมเส้นช่วย */
export function wallBounds(doc) {
  if (!doc.walls.length) return null;
  const pts = doc.walls.flatMap(wallPolygon);
  return { x0: Math.min(...pts.map((p) => p[0])), y0: Math.min(...pts.map((p) => p[1])),
           x1: Math.max(...pts.map((p) => p[0])), y1: Math.max(...pts.map((p) => p[1])) };
}

/** ห้องสี่เหลี่ยม → ผนัง 4 ด้าน (แนวศูนย์กลางผนัง) */
export function rectWalls(p0, p1, thick, height) {
  const [x0, x1] = [Math.min(p0[0], p1[0]), Math.max(p0[0], p1[0])], [y0, y1] = [Math.min(p0[1], p1[1]), Math.max(p0[1], p1[1])];
  const c = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  return c.map((a, i) => ({ id: uid("w"), a, b: c[(i + 1) % 4], thick, height }));
}

// ------------------------------------------------------------------ หลังคา
/** แนวอาคาร: มุมของผนังที่ยาวที่สุด (องศา ทวนเข็มจากแกน x) — หลังคาวางตามแนวนี้ ไม่ใช่ตามแกนกระดาษ */
export function buildingAngle(doc) {
  if (doc.roof.angle != null && doc.roof.angle !== "") return Number(doc.roof.angle);
  let best = null;
  for (const w of doc.walls) { const L = wallLength(w); if (!best || L > best.L) best = { L, w }; }
  if (!best) return 0;
  const a = (Math.atan2(best.w.b[1] - best.w.a[1], best.w.b[0] - best.w.a[0]) * 180) / Math.PI;
  return ((a % 180) + 180) % 180 > 90 ? (((a % 180) + 180) % 180) - 180 : ((a % 180) + 180) % 180;   // −90…90
}
const rot2 = (p, deg) => { const c = Math.cos((deg * Math.PI) / 180), s = Math.sin((deg * Math.PI) / 180); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; };

/** ทิศและมุมเอียงจากเรขาคณิตของหน้า (ทิศ 0 = เหนือของแบบ ตามเข็ม + ทิศเหนือจริง) */
function faceOrientation(pts3, north) {
  const n = norm3(cross3(sub3(pts3[1], pts3[0]), sub3(pts3[pts3.length - 1], pts3[0])));
  const up = n[2] < 0 ? mul3(n, -1) : n;
  const tilt = (Math.acos(Math.max(-1, Math.min(1, up[2]))) * 180) / Math.PI;
  const az = tilt < 0.5 ? 180 : (Math.atan2(up[0], up[1]) * 180) / Math.PI;
  return { normal: up, tilt: Math.round(tilt * 10) / 10, azimuth: Math.round((((az + north) % 360) + 360) % 360 * 10) / 10 };
}

/** หลังคาจากผนัง → { faces: [{key, pts3, tilt, azimuth, normal, gable?}], base, ridgeZ, angle }
 *  พิกัด 3D: x, y (แบบ มม.), z ขึ้น · ฐานหลังคาที่ความสูงผนังสูงสุด · วางตามแนวอาคาร (buildingAngle)
 *  ทรง: none · flat · shed (ลาดลงด้านล่างของแนวอาคาร) · gable · hip · curved (โค้งแบ่ง facets ช่วง สูง rise) */
export function roofFaces(doc) {
  const r = doc.roof;
  if (!doc.walls.length || r.type === "none") return { faces: [], base: 0, angle: 0 };
  const ang = buildingAngle(doc), north = doc.site.north || 0;
  const pts = doc.walls.flatMap(wallPolygon).map((p) => rot2(p, -ang));          // พิกัดตามแนวอาคาร
  const bx0 = Math.min(...pts.map((p) => p[0])), bx1 = Math.max(...pts.map((p) => p[0]));
  const by0 = Math.min(...pts.map((p) => p[1])), by1 = Math.max(...pts.map((p) => p[1]));
  const base = Math.max(...doc.walls.map((w) => w.height));
  const o = r.overhang, x0 = bx0 - o, x1 = bx1 + o, y0 = by0 - o, y1 = by1 + o;
  const W = x1 - x0, D = y1 - y0, tan = Math.tan((r.pitch * Math.PI) / 180);
  const along = r.ridge === "x" || ((r.ridge === "auto" || r.ridge === "long") && W >= D) || (r.ridge === "short" && W < D) ? "x" : "y";
  const L = [];                                                                    // หน้าในพิกัดแนวอาคาร
  const P = (x, y, z) => [x, y, z];
  if (r.type === "flat") L.push({ key: "U", pts3: [P(x0, y0, base), P(x1, y0, base), P(x1, y1, base), P(x0, y1, base)] });
  else if (r.type === "shed") L.push({ key: "S", pts3: [P(x0, y0, base), P(x1, y0, base), P(x1, y1, base + D * tan), P(x0, y1, base + D * tan)] });
  else if (r.type === "curved") {
    // โค้งวงกลม: ช่วงกว้าง span ความสูง rise → แบ่ง n ช่วงมุมเท่ากัน (แบบเดียวกับ ASC Studio)
    const n = Math.max(2, Math.round(r.facets || 6));
    const span = along === "x" ? D : W, rise = r.rise > 0 ? r.rise : (span / 2) * tan / 2;
    const R = (span * span) / (8 * rise) + rise / 2, half = Math.asin(Math.min(1, span / 2 / R));
    const prof = [];                                                               // [ระยะตามช่วง, z]
    for (let i = 0; i <= n; i++) { const t = -half + (2 * half * i) / n; prof.push([span / 2 + R * Math.sin(t), base + rise - R * (1 - Math.cos(t))]); }
    prof[0][1] = base; prof[n][1] = base;
    for (let i = 0; i < n; i++) {
      const [s0, z0] = prof[i], [s1, z1] = prof[i + 1];
      if (along === "x") L.push({ key: "C" + (i + 1), pts3: [P(x0, y0 + s0, z0), P(x1, y0 + s0, z0), P(x1, y0 + s1, z1), P(x0, y0 + s1, z1)] });
      else L.push({ key: "C" + (i + 1), pts3: [P(x0 + s0, y1, z0), P(x0 + s0, y0, z0), P(x0 + s1, y0, z1), P(x0 + s1, y1, z1)] });
    }
    const endA = prof.map(([s, z]) => (along === "x" ? P(x0, y0 + s, z) : P(x0 + s, y0, z)));
    const endB = prof.map(([s, z]) => (along === "x" ? P(x1, y0 + s, z) : P(x0 + s, y1, z)));
    L.push({ key: "end1", pts3: endA, gable: true }, { key: "end2", pts3: endB.reverse(), gable: true });
  } else if (along === "x") {
    const ym = (y0 + y1) / 2, top = base + (D / 2) * tan;
    if (r.type === "gable") L.push(
      { key: "S", pts3: [P(x0, y0, base), P(x1, y0, base), P(x1, ym, top), P(x0, ym, top)] },
      { key: "N", pts3: [P(x1, y1, base), P(x0, y1, base), P(x0, ym, top), P(x1, ym, top)] },
      { key: "gW", pts3: [P(x0, y0, base), P(x0, ym, top), P(x0, y1, base)], gable: true },
      { key: "gE", pts3: [P(x1, y1, base), P(x1, ym, top), P(x1, y0, base)], gable: true });
    else {
      const k = Math.min(D / 2, W / 2), ra = P(x0 + k, ym, top), rb = P(x1 - k, ym, top);
      L.push({ key: "S", pts3: [P(x0, y0, base), P(x1, y0, base), rb, ra] }, { key: "N", pts3: [P(x1, y1, base), P(x0, y1, base), ra, rb] },
             { key: "W", pts3: [P(x0, y1, base), P(x0, y0, base), ra] }, { key: "E", pts3: [P(x1, y0, base), P(x1, y1, base), rb] });
    }
  } else {
    const xm = (x0 + x1) / 2, top = base + (W / 2) * tan;
    if (r.type === "gable") L.push(
      { key: "W", pts3: [P(x0, y1, base), P(x0, y0, base), P(xm, y0, top), P(xm, y1, top)] },
      { key: "E", pts3: [P(x1, y0, base), P(x1, y1, base), P(xm, y1, top), P(xm, y0, top)] },
      { key: "gS", pts3: [P(x1, y0, base), P(xm, y0, top), P(x0, y0, base)], gable: true },
      { key: "gN", pts3: [P(x0, y1, base), P(xm, y1, top), P(x1, y1, base)], gable: true });
    else {
      const k = Math.min(W / 2, D / 2), ra = P(xm, y0 + k, top), rb = P(xm, y1 - k, top);
      L.push({ key: "W", pts3: [P(x0, y1, base), P(x0, y0, base), ra, rb] }, { key: "E", pts3: [P(x1, y0, base), P(x1, y1, base), rb, ra] },
             { key: "S", pts3: [P(x0, y0, base), P(x1, y0, base), ra] }, { key: "N", pts3: [P(x1, y1, base), P(x0, y1, base), rb] });
    }
  }
  // หมุนกลับเข้าพิกัดแบบ + ทิศ/มุมเอียงจากเรขาคณิตจริง
  const faces = L.map((f) => {
    const pts3 = f.pts3.map((p) => { const q = rot2([p[0], p[1]], ang); return [q[0], q[1], p[2]]; });
    return f.gable ? { ...f, pts3 } : { ...f, pts3, ...faceOrientation(pts3, north) };
  });
  const ridgeZ = Math.max(...faces.flatMap((f) => f.pts3.map((p) => p[2])));
  return { faces, base, ridgeZ, angle: ang };
}

/** คะแนนการรับแดด (ซีกโลกเหนือ): หันใต้ + เอียงน้อยดีกว่า · ไม่ใช่หน้าจั่ว */
function sunScore(f) { return f.tilt < 3 ? 0.9 : Math.cos(((f.azimuth - 180) * Math.PI) / 180) * Math.cos((f.tilt * Math.PI) / 180); }

export function bestRoofFace(faces) {
  const cand = faces.filter((f) => !f.gable);
  return cand.length ? cand.reduce((a, b) => (sunScore(b) > sunScore(a) ? b : a)) : null;
}

/** ด้านที่ควรวางแผง: หันใต้พอสมควร (คะแนน ≥ 0.3) และเอียงไม่เกิน 35° — หลังคาโค้งได้หลายช่วง */
export function pvFaces(faces) {
  return faces.filter((f) => !f.gable && f.tilt <= 35 && sunScore(f) >= 0.3);
}

/** วางแผงบนด้านหลังคาหนึ่งด้าน → ตำแหน่งแผงในพิกัดระนาบ (u ตามชายคา, v ขึ้นลาด) + 3D */
export function pvLayout(doc, face) {
  const p = doc.pv;
  if (!face || !p.enabled) return { panels: [], count: 0, kwp: 0, face: null };
  const P = face.pts3;
  const e0 = P[0], e1 = P[1];                                   // ชายคา/ขอบล่าง = จุด 0→1
  const uDir = norm3(sub3(e1, e0));
  const n = face.normal || norm3(cross3(sub3(P[1], P[0]), sub3(P[P.length - 1], P[0])));
  let vDir = norm3(cross3(n, uDir));
  if (face.tilt < 0.5) vDir = norm3([-uDir[1], uDir[0], 0]);
  const to2 = (q) => { const d = sub3(q, e0); return [dot3(d, uDir), dot3(d, vDir)]; };
  const poly = P.map(to2);
  const pw = p.portrait ? p.width : p.length, ph = p.portrait ? p.length : p.width, g = p.gap, edge = p.edge;
  const us = poly.map((q) => q[0]), vs = poly.map((q) => q[1]);
  const panels = [];
  for (let v = Math.min(...vs) + edge; v + ph <= Math.max(...vs) - edge + 1e-6; v += ph + g) {
    for (let u = Math.min(...us) + edge; u + pw <= Math.max(...us) - edge + 1e-6; u += pw + g) {
      const corners = [[u, v], [u + pw, v], [u + pw, v + ph], [u, v + ph]];
      if (corners.every((c) => pointInPolygon(c, poly) && insetOk(c, poly, edge))) {
        const to3 = (c) => add3(e0, add3(mul3(uDir, c[0]), mul3(vDir, c[1])));
        panels.push({ c2: corners, c3: corners.map(to3), normal: n });
      }
    }
  }
  return { panels, count: panels.length, kwp: Math.round(panels.length * p.watt) / 1000, face, normal: n };
}

/** วางแผงทุกด้านที่เหมาะ → รวมจำนวน · kWp · มุมเอียง/ทิศเฉลี่ยถ่วงน้ำหนักตามจำนวนแผง (ใช้คำนวณผลผลิต) */
export function pvLayoutAll(doc, faces) {
  const parts = doc.pv.enabled ? pvFaces(faces).map((f) => pvLayout(doc, f)).filter((x) => x.count) : [];
  const count = parts.reduce((s, x) => s + x.count, 0);
  const panels = parts.flatMap((x) => x.panels);
  if (!count) return { panels, count: 0, kwp: 0, parts, tilt: null, azimuth: null };
  const tilt = parts.reduce((s, x) => s + x.face.tilt * x.count, 0) / count;
  // ทิศเฉลี่ยแบบเวกเตอร์ (กัน 350° กับ 10° เฉลี่ยได้ 180°)
  const sx = parts.reduce((s, x) => s + Math.sin((x.face.azimuth * Math.PI) / 180) * x.count, 0);
  const sy = parts.reduce((s, x) => s + Math.cos((x.face.azimuth * Math.PI) / 180) * x.count, 0);
  const az = ((Math.atan2(sx, sy) * 180) / Math.PI + 360) % 360;
  return { panels, count, kwp: Math.round(count * doc.pv.watt) / 1000, parts, tilt: Math.round(tilt * 10) / 10, azimuth: Math.round(az) };
}

function insetOk(c, poly, edge) {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    if (projectOnSegment(c, a, b).d < edge - 1e-6) return false;
  }
  return true;
}
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm3 = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// ------------------------------------------------------------------ นำเข้างาน ASC Studio (Design Auto)
/** งานที่ส่งออกจาก ASC Studio → แบบของตัวเขียนแบบ "แบบนำเข้า" — ไม่วาดใหม่:
 *  3D = 3d.glb ของ ASC Studio ทั้งก้อน (หลังคา · แผงตามที่ออกแบบจริง · อุปกรณ์ · ต้นไม้)
 *  2D = ภาพดาวเทียม map.png (ตำแหน่งจาก world file) + ภาพมุมบนของโมเดล + เส้นขอบอาคาร (แก้ไม่ได้ เป็นชั้นอ้างอิง)
 *  ASC Studio: หน่วยเมตร x = ตะวันออก y = เหนือ จุดกำเนิดที่พิกัดไซต์ → ที่นี่ มม. แกนเดียวกัน (glb: x ตะวันออก · y ขึ้น · z = −เหนือ)
 *  opts: { exportName, glb: "3d.glb", pgw, image: {url, width, height}, summary: {kwp, modules, tilt, azimuth} } */
export function importDesignAuto(da, opts = {}) {
  const site = da.site || {};
  const doc = newDoc(site.projectName || opts.name || "งานจาก ASC Studio");
  doc.site = { lat: site.lat ?? null, lon: site.lng ?? null, north: 0 };
  doc.roof.type = "none";                             // หลังคา/แผงมาจากโมเดล ASC Studio ไม่สร้างซ้ำ
  doc.pv.enabled = false;
  const mm = (p) => [Math.round(p.x * 1000), Math.round(p.y * 1000)];
  const outlines = [];
  for (const b of da.buildings || []) {
    const fp = (b.footprint || []).map(mm);
    if (fp.length >= 3) outlines.push({ name: b.name || "อาคาร", pts: fp, roofType: b.roofType, eave: b.eaveHeightM, rise: b.riseM });
  }
  doc.imported = {
    from: "ASC Studio", exportName: opts.exportName || "", importedAt: new Date().toISOString(),
    glb: opts.glb || null, outlines, summary: opts.summary || null, features: designAutoFeatures(da),
  };
  // ไม่มี 3d.glb (นำเข้าจาก JSON อย่างเดียว) → ตัวอาคารเป็นกล่องสูงเท่าชายคา ให้ 3D มีของให้ดู/วาดต่อ
  if (!opts.glb) for (const o of outlines) doc.masses.push({ id: uid("m"), name: `${o.name} (ASC)`, pts: o.pts, base: 0, height: Math.round((o.eave || 3) * 1000) });
  if (opts.pgw && opts.image && site.lat != null) doc.backdrop = backdropFromWorldFile(opts.pgw, opts.image, site.lat, site.lng);
  return doc;
}

/** ของบนผังที่ ASC Studio วางไว้ (หน่วยเมตร → มม.) — วาดเป็นชั้นอ้างอิงเหมือนในหน้าออกแบบของ ASC Studio:
 *  ต้นไม้ (วงร่มไม้) · สิ่งกีดขวาง (กล่องหมุนได้) · ผนัง · อุปกรณ์ (อินเวอร์เตอร์/ตู้ ตามขนาดจริง) · แนวสาย DC/AC */
export function designAutoFeatures(da) {
  const mm = (p) => [Math.round((p.x || 0) * 1000), Math.round((p.y || 0) * 1000)];
  const box = (c, w, d, rotDeg) => {
    const r = ((rotDeg || 0) * Math.PI) / 180, cs = Math.cos(r), sn = Math.sin(r);
    return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([x, y]) => [Math.round(c[0] + x * cs - y * sn), Math.round(c[1] + x * sn + y * cs)]);
  };
  const f = { trees: [], obstacles: [], walls: [], equipment: [], routes: [] };
  for (const t of da.trees || []) if (t.at) f.trees.push({ name: t.name || "ต้นไม้", c: mm(t.at), r: Math.round((t.canopyRM || 2) * 1000), h: t.heightM });
  for (const o of da.obstacles || []) if (o.at) f.obstacles.push({ name: o.name || "สิ่งกีดขวาง", pts: box(mm(o.at), (o.wM || 1) * 1000, (o.dM || 1) * 1000, o.rotDeg), h: o.heightM });
  for (const w of da.walls || []) if (w.a && w.b) f.walls.push({ name: w.name || "ผนัง", pts: [mm(w.a), mm(w.b)], t: Math.round((w.thicknessM || 0.1) * 1000) });
  for (const e of da.equipment || []) if (e.at) {
    // อุปกรณ์ติดผนัง: กว้าง = widthMm หันตาม facingDeg (มุมทิศ 0 = เหนือ) · ลึก = depthMm
    f.equipment.push({ name: e.name || e.kind || "อุปกรณ์", kind: e.kind, pts: box(mm(e.at), e.widthMm || 500, e.depthMm || 250, -(e.facingDeg || e.wallAzimuthDeg || 0)) });
  }
  for (const r of da.routes || []) if ((r.points || []).length >= 2) f.routes.push({ name: r.name || "", kind: r.kind || "dc", pts: r.points.map(mm) });
  return f;
}

/** world file (.pgw, หน่วยองศา) + ขนาดภาพ → ตำแหน่งภาพดาวเทียมในพิกัดแบบ (มม.) */
export function backdropFromWorldFile(pgw, image, lat0, lon0) {
  const v = String(pgw).trim().split(/\s+/).map(Number);
  if (v.length < 6 || v.some(isNaN)) return null;
  const [a, , , e, c, f] = v;                         // ขนาดพิกเซล x · y(ติดลบ) · ศูนย์กลางพิกเซลซ้ายบน
  const mLat = 111132.92 - 559.82 * Math.cos((2 * lat0 * Math.PI) / 180), mLon = 111412.84 * Math.cos((lat0 * Math.PI) / 180);
  const left = (c - a / 2 - lon0) * mLon, top = (f - e / 2 - lat0) * mLat;
  return { url: image.url, x: Math.round(left * 1000), y: Math.round(top * 1000), w: Math.round(image.width * a * mLon * 1000),
           h: Math.round(image.height * -e * mLat * 1000), opacity: 0.75 };
}

// ------------------------------------------------------------------ สรุปปริมาณ
export function summary(doc) {
  const wallLen = doc.walls.reduce((s, w) => s + wallLength(w), 0);
  const b = wallBounds(doc);
  const rf = roofFaces(doc), pv = pvLayoutAll(doc, rf.faces);
  return {
    walls: doc.walls.length, wallLengthM: Math.round(wallLen) / 1000,
    doors: doc.openings.filter((o) => o.kind === "door").length, windows: doc.openings.filter((o) => o.kind === "window").length,
    footprintM2: b ? Math.round(((b.x1 - b.x0) * (b.y1 - b.y0)) / 1e4) / 100 : 0,
    pvCount: pv.count, pvKwp: pv.kwp, pvTilt: pv.tilt, pvAzimuth: pv.azimuth, pvFaces: pv.parts.length,
  };
}
