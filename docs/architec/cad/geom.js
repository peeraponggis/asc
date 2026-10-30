// เรขาคณิตของหน้า CAD 2D — ไม่มี DOM (ทดสอบด้วย node ได้) (โดย ลุงพี)
// เมทริกซ์ 2D [a, b, c, d, e, f]: x' = a·x + c·y + e · y' = b·x + d·y + f (รูปแบบเดียวกับ canvas และ server)
export const I = [1, 0, 0, 1, 0, 0];
export const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];            // m ∘ n (ทำ n ก่อน)
export const ap = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
export const translate = (dx, dy) => [1, 0, 0, 1, dx, dy];
export const rotateAt = (deg, c) => { const r = (deg * Math.PI) / 180, co = Math.cos(r), s = Math.sin(r);
  return [co, s, -s, co, c[0] - co * c[0] + s * c[1], c[1] - s * c[0] - co * c[1]]; };
export const scaleAt = (k, c) => [k, 0, 0, k, c[0] * (1 - k), c[1] * (1 - k)];
/** สะท้อนรอบเส้นผ่านจุด p1 → p2 */
export function mirror(p1, p2) {
  const t = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]), co = Math.cos(2 * t), s = Math.sin(2 * t);
  const m = [co, s, s, -co, 0, 0];
  const q = ap(m, p1);
  return [co, s, s, -co, p1[0] - q[0], p1[1] - q[1]];
}
export const det = (m) => m[0] * m[3] - m[1] * m[2];
const scaleOf = (m) => Math.sqrt(Math.abs(det(m)));
const angleOf = (m) => (Math.atan2(m[1], m[0]) * 180) / Math.PI;
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const P = (p) => [r4(p[0]), r4(p[1])];
/** มุมข้อความหลังแปลง — สะท้อนแล้วยังอ่านได้ (เหมือน AutoCAD MIRRTEXT = 0) */
export function textRot(r, m) {
  if (det(m) >= 0) return r4((((r + angleOf(m)) % 360) + 360) % 360);
  let a = (((angleOf(m) - r) % 360) + 360) % 360;
  if (a > 90 && a <= 270) a = (a + 180) % 360;
  return r4(a);
}

// ------------------------------------------------------------------ แปลงวัตถุทั้งชิ้น (เรขาคณิตที่แก้ได้ + เส้นแสดงผล)
export function transformEntity(e, m) {
  const out = { ...e, d: e.d.map(([f, cl, col]) => { const g = new Array(f.length); for (let i = 0; i < f.length; i += 2) { const q = ap(m, [f[i], f[i + 1]]); g[i] = r4(q[0]); g[i + 1] = r4(q[1]); } return [g, cl, col]; }),
    x: (e.x || []).map(([x, y, h, rot, s, col]) => { const q = ap(m, [x, y]); return [r4(q[0]), r4(q[1]), r4(h * scaleOf(m)), textRot(rot, m), s, col]; }) };
  const flip = det(m) < 0, k = scaleOf(m), rot = angleOf(m);
  if (e.g) {
    const g = e.g, t = e.t;
    if (t === "LINE") out.g = { a: P(ap(m, g.a)), b: P(ap(m, g.b)) };
    else if (t === "LWPOLYLINE") out.g = { ...g, pts: g.pts.map((p) => [...P(ap(m, p)), flip ? -(p[2] || 0) : p[2] || 0]) };
    else if (t === "CIRCLE") out.g = { c: P(ap(m, g.c)), r: r4(g.r * k) };
    else if (t === "ARC") {
      // มุมเริ่ม/จบตามจุดปลายจริงหลังแปลง · สะท้อนแล้วทิศโค้งกลับ → สลับเริ่ม/จบ
      const end = (a) => ap(m, [g.c[0] + g.r * Math.cos((a * Math.PI) / 180), g.c[1] + g.r * Math.sin((a * Math.PI) / 180)]);
      const c = ap(m, g.c), ang = (q) => ((Math.atan2(q[1] - c[1], q[0] - c[0]) * 180) / Math.PI + 360) % 360;
      const s0 = ang(end(g.a0)), s1 = ang(end(g.a1));
      out.g = { c: P(c), r: r4(g.r * k), a0: r4(flip ? s1 : s0), a1: r4(flip ? s0 : s1) };
    } else if (t === "ELLIPSE") {
      const c = ap(m, g.c), tip = ap(m, [g.c[0] + g.maj[0], g.c[1] + g.maj[1]]);
      out.g = { ...g, c: P(c), maj: P([tip[0] - c[0], tip[1] - c[1]]), ...(flip ? { p0: r4(2 * Math.PI - g.p1), p1: r4(2 * Math.PI - g.p0) } : {}) };
    } else if (t === "TEXT" || t === "MTEXT") out.g = { ...g, p: P(ap(m, g.p)), h: r4(g.h * k), rot: textRot(g.rot || 0, m) };
    else if (t === "INSERT") out.g = { ...g, p: P(ap(m, g.p)), sx: r4(g.sx * k), sy: r4(flip ? -g.sy * k : g.sy * k), rot: r4((((flip ? rot - g.rot : g.rot + rot) % 360) + 360) % 360) };
    else if (t === "POINT") out.g = { p: P(ap(m, g.p)) };
  }
  if (!e.g || e.t === "INSERT") out.m = mul(m, e.m || I);   // วัตถุแสดงผลอย่างเดียว/บล็อก: server ใช้เมทริกซ์รวม
  return out;
}

// ------------------------------------------------------------------ สร้างเส้นแสดงผลจากเรขาคณิต (หลังแก้ค่าในแผงคุณสมบัติ / วาดใหม่)
export function arcPoints(c, r, a0, a1, tol) {
  let span = (((a1 - a0) % 360) + 360) % 360; if (span === 0) span = 360;
  const n = Math.max(8, Math.min(720, Math.ceil(((span * Math.PI) / 180) / (2 * Math.acos(Math.max(-1, 1 - tol / Math.max(r, 1e-9)))))));
  const out = [];
  for (let i = 0; i <= n; i++) { const a = ((a0 + (span * i) / n) * Math.PI) / 180; out.push(r4(c[0] + r * Math.cos(a)), r4(c[1] + r * Math.sin(a))); }
  return out;
}

/** bulge (tan(มุม/4)) ระหว่างจุด p→q → จุดบนโค้ง (ไม่รวม p) */
export function bulgePoints(p, q, b, tol) {
  if (!b) return [q[0], q[1]];
  const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy), th = 4 * Math.atan(b), r = L / (2 * Math.sin(th / 2));
  const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, h = r * Math.cos(th / 2), nx = -dy / L, ny = dx / L;
  const c = [mx + nx * h, my + ny * h];
  const a0 = (Math.atan2(p[1] - c[1], p[0] - c[0]) * 180) / Math.PI, sweep = (th * 180) / Math.PI;
  const R = Math.abs(r), n = Math.max(4, Math.ceil(Math.abs(sweep) / Math.max(1, (2 * Math.acos(Math.max(-1, 1 - tol / R)) * 180) / Math.PI)));
  const out = [];
  for (let i = 1; i <= n; i++) { const a = ((a0 + (sweep * i) / n) * Math.PI) / 180; out.push(r4(c[0] + R * Math.cos(a)), r4(c[1] + R * Math.sin(a))); }
  return out;
}

export function displayOf(t, g, tol = 0.01, color = 256) {
  if (t === "LINE") return { d: [[[...g.a, ...g.b], 0, color]], x: [] };
  if (t === "LWPOLYLINE") {
    const pts = g.pts, f = [pts[0][0], pts[0][1]], n = pts.length;
    for (let i = 0; i < n - (g.closed ? 0 : 1); i++) f.push(...bulgePoints(pts[i], pts[(i + 1) % n], pts[i][2] || 0, tol));
    return { d: [[f, g.closed ? 1 : 0, color]], x: [] };
  }
  if (t === "CIRCLE") return { d: [[arcPoints(g.c, g.r, 0, 360, tol), 1, color]], x: [] };
  if (t === "ARC") return { d: [[arcPoints(g.c, g.r, g.a0, g.a1, tol), 0, color]], x: [] };
  if (t === "ELLIPSE") {
    const ma = Math.hypot(g.maj[0], g.maj[1]), mi = ma * g.ratio, rot = Math.atan2(g.maj[1], g.maj[0]);
    let p0 = g.p0 ?? 0, p1 = g.p1 ?? 2 * Math.PI; if (p1 <= p0) p1 += 2 * Math.PI;
    const n = 96, f = [];
    for (let i = 0; i <= n; i++) { const a = p0 + ((p1 - p0) * i) / n, x = ma * Math.cos(a), y = mi * Math.sin(a);
      f.push(r4(g.c[0] + x * Math.cos(rot) - y * Math.sin(rot)), r4(g.c[1] + x * Math.sin(rot) + y * Math.cos(rot))); }
    return { d: [[f, 0, color]], x: [] };
  }
  if (t === "POINT") return { d: [[[...g.p, ...g.p], 0, color]], x: [] };
  if (t === "TEXT" || t === "MTEXT") return { d: [], x: [[g.p[0], g.p[1], g.h, g.rot || 0, plain(g.s), color]] };
  return null;
}

/** ข้อความ MTEXT ดิบ → ข้อความอ่าน (ตัดรหัสรูปแบบ \P \f... {}) */
export function plain(s) {
  return String(s).replace(/\\P/g, "\n").replace(/\\[A-Za-z][^;\\{}]*;/g, "").replace(/[{}]/g, "").replace(/\\~/g, " ");
}

// ------------------------------------------------------------------ ขอบเขต · ระยะ (เลือกวัตถุ)
export function bboxOf(e) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [f] of e.d) for (let i = 0; i < f.length; i += 2) { if (f[i] < x0) x0 = f[i]; if (f[i] > x1) x1 = f[i]; if (f[i + 1] < y0) y0 = f[i + 1]; if (f[i + 1] > y1) y1 = f[i + 1]; }
  for (const [x, y, h, , s] of e.x || []) { const w = (s.length || 1) * h * 0.7; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + h); }
  return [x0, y0, x1, y1];
}

export function segDist(p, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / L)) : 0;
  return Math.hypot(p[0] - ax - t * dx, p[1] - ay - t * dy);
}

export function distTo(e, p) {
  let best = Infinity;
  for (const [f, cl] of e.d) {
    const n = f.length / 2;
    for (let i = 0; i < n - 1; i++) best = Math.min(best, segDist(p, f[2 * i], f[2 * i + 1], f[2 * i + 2], f[2 * i + 3]));
    if (cl && n > 2) best = Math.min(best, segDist(p, f[2 * n - 2], f[2 * n - 1], f[0], f[1]));
  }
  for (const [x, y, h, , s] of e.x || []) { const w = (s.length || 1) * h * 0.7;
    if (p[0] >= x && p[0] <= x + w && p[1] >= y && p[1] <= y + h) best = 0; else best = Math.min(best, Math.hypot(p[0] - x, p[1] - y)); }
  return best;
}

// ------------------------------------------------------------------ จับจุด (OSNAP) จากเรขาคณิต
export function snapPoints(e) {
  const out = [], g = e.g;
  const add = (p, kind) => out.push({ p, kind });
  if (g && e.t === "LINE") { add(g.a, "end"); add(g.b, "end"); add([(g.a[0] + g.b[0]) / 2, (g.a[1] + g.b[1]) / 2], "mid"); return out; }
  if (g && e.t === "LWPOLYLINE") {
    g.pts.forEach((p, i) => { add([p[0], p[1]], "end"); const q = g.pts[(i + 1) % g.pts.length];
      if ((i < g.pts.length - 1 || g.closed) && !p[2]) add([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], "mid"); });
    return out;
  }
  if (g && (e.t === "CIRCLE" || e.t === "ARC")) {
    add(g.c, "center");
    for (const a of e.t === "ARC" ? [g.a0, g.a1] : [0, 90, 180, 270]) add([g.c[0] + g.r * Math.cos((a * Math.PI) / 180), g.c[1] + g.r * Math.sin((a * Math.PI) / 180)], e.t === "ARC" ? "end" : "quad");
    return out;
  }
  if (g && (e.t === "TEXT" || e.t === "MTEXT" || e.t === "INSERT" || e.t === "POINT")) { add(g.p, "ins"); return out; }
  for (const [f] of e.d) { if (f.length <= 64) for (let i = 0; i < f.length; i += 2) add([f[i], f[i + 1]], "end"); }
  return out;
}

/** แปลงข้อความพิมพ์เป็นจุด (แบบ AutoCAD): "x,y" · "@dx,dy" · "@ยาว<มุม" · "ยาว" (ตามทิศเมาส์จากจุดล่าสุด) */
export function parsePoint(s, last, cursor) {
  s = String(s).trim().replace(/\s+/g, "");
  let m;
  if ((m = s.match(/^@?(-?[\d.]+)<(-?[\d.]+)$/)) && last) { const L = +m[1], a = (+m[2] * Math.PI) / 180; return [last[0] + L * Math.cos(a), last[1] + L * Math.sin(a)]; }
  if ((m = s.match(/^@(-?[\d.]+),(-?[\d.]+)$/)) && last) return [last[0] + +m[1], last[1] + +m[2]];
  if ((m = s.match(/^(-?[\d.]+),(-?[\d.]+)$/))) return [+m[1], +m[2]];
  if ((m = s.match(/^(-?[\d.]+)$/)) && last && cursor) {
    const dx = cursor[0] - last[0], dy = cursor[1] - last[1], L = Math.hypot(dx, dy) || 1;
    return [last[0] + (+m[1] * dx) / L, last[1] + (+m[1] * dy) / L];
  }
  return null;
}
