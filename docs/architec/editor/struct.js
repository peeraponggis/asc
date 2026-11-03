// งานโครงสร้างคอนกรีตเสริมเหล็ก: เสา คาน ฐานราก พื้น บันได + ชั้นอาคาร + ตรวจขนาดเบื้องต้น (WSD) + ตาราง (โดย ลุงพี)
// ไม่มี DOM/three — ผัง 2D/3D เรียกฟังก์ชันวาดของตัวเอง · ทดสอบด้วย node ได้
// หน่วย มม. · ระดับ z = ระดับจริงจาก ±0.00 (หลังพื้นชั้น 1) · น้ำหนัก กก. · หน่วยแรง กก./ตร.ซม. (ksc)
import * as M from "./model.js?v=0.30.1";

export const KINDS = { column: "เสา", beam: "คาน", footing: "ฐานราก", slab: "พื้น", stair: "บันได" };
export const DEF = {
  column: { w: 200, l: 200, mark: "C1", rebar: "4-DB12 · ปลอก RB6@0.15" },
  beam: { w: 200, d: 400, mark: "B1", rebar: "บน 2-DB12 · ล่าง 3-DB12 · ปลอก RB6@0.15" },
  footing: { w: 1200, l: 1200, t: 350, z: -1200, mark: "F1", pile: "" },
  slab: { t: 120, mark: "S1" },
  stair: { w: 1200, n: 18, run: 250, mark: "ST1" },
};
/** วัสดุ + น้ำหนักบรรทุก (กฎกระทรวง ฉบับที่ 6 พ.ศ. 2527 ข้อ 15: ที่พักอาศัย 150 · หลังคา 30 กก./ตร.ม.) */
export const DESIGN = { fc: 240, fy: 4000, fyStir: 2400, conc: 2400, live: 150, liveRoof: 30, finish: 50, wall: 180, qa: 10000, cover: 50 };

/** ชั้นอาคาร (ค่าเริ่มต้น 1 ชั้น) */
export function levels(doc) {
  return doc.levels && doc.levels.length ? doc.levels : [{ id: "L1", name: "ชั้น 1", z: 0, h: 3000 }];
}
/** ระดับอ้างอิงของชิ้น (ใช้แยกชั้นในผัง) */
export function zOf(t, o) {
  if (t === "walls") return o.base || 0;
  if (t === "struct") return o.kind === "beam" || o.kind === "slab" ? (o.z ?? 0) : o.kind === "footing" ? -1e9 : (o.base ?? 0);
  if (t === "masses") return o.base || 0;
  return 0;
}
/** ชิ้นนี้อยู่ชั้นที่เลือกไหม (คาน/พื้นที่ระดับพื้นชั้น = อยู่ผังชั้นนั้น) */
export function onLevel(doc, lv, t, o) {
  if (!lv) return true;
  const L = levels(doc), z = zOf(t, o), i = L.findIndex((x) => x.id === lv.id);
  if (z === -1e9) return i === 0;                                                  // ฐานรากอยู่ผังชั้น 1
  const lo = i === 0 ? -1e9 : lv.z - 300, hi = i === L.length - 1 ? 1e9 : L[i + 1].z - 300;
  return z >= lo && z < hi;
}

// ---------------------------------------------------------------- เรขาคณิต
const rot = (p, deg) => { const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; };
/** มุม 4 จุดของเสา/ฐานราก/บันได (แนวราบ) */
export function rectOf(o) {
  if (o.kind === "stair") { const L = o.n * o.run, w = o.w; return [[0, -w / 2], [L, -w / 2], [L, w / 2], [0, w / 2]].map((q) => M.add(o.p, rot(q, o.rot || 0))); }
  const w = o.w, l = o.kind === "footing" ? o.l : o.l || o.w;
  return [[-w / 2, -l / 2], [w / 2, -l / 2], [w / 2, l / 2], [-w / 2, l / 2]].map((q) => M.add(o.p, rot(q, o.rot || 0)));
}
export function beamPoly(o) { return M.wallPolygon({ a: o.a, b: o.b, thick: o.w }); }
/** คลิกโดนชิ้นโครงสร้าง (ในผัง) */
export function hit(doc, p, tol, lv) {
  const list = (doc.struct || []).filter((o) => onLevel(doc, lv, "struct", o));
  for (const k of ["column", "stair", "beam", "footing", "slab"]) for (const o of list) {
    if (o.kind !== k) continue;
    if (k === "beam" && M.projectOnSegment(p, o.a, o.b).d < Math.max(o.w / 2, tol)) return o;
    if ((k === "column" || k === "footing" || k === "stair") && (M.pointInPolygon(p, rectOf(o)) || (k === "column" && M.dist(p, o.p) < tol))) return o;
    if (k === "slab" && M.pointInPolygon(p, o.pts)) return o;
  }
  return null;
}
/** จุดจับ (snap) ของโครงสร้าง: ศูนย์เสา ปลายคาน มุมพื้น */
export function snapPts(doc, lv) {
  const out = [];
  for (const o of doc.struct || []) {
    if (o.kind === "column" && (onLevel(doc, lv, "struct", o) || true)) out.push(o.p);
    if (o.kind === "beam" && onLevel(doc, lv, "struct", o)) out.push(o.a, o.b);
    if (o.kind === "slab" && onLevel(doc, lv, "struct", o)) out.push(...o.pts);
  }
  return out;
}

// ---------------------------------------------------------------- ปริมาณงาน (ตาราง)
const len = (o) => M.dist(o.a, o.b);
export function quantities(doc) {
  const rows = [], S = doc.struct || [];
  let conc = 0;
  for (const o of S) {
    let v = 0, size = "", n = 1;
    if (o.kind === "column") { v = (o.w * (o.l || o.w) * Math.max(0, (o.top ?? 3000) - (o.base ?? 0))) / 1e9; size = `${o.w}×${o.l || o.w}`; }
    if (o.kind === "beam") { v = (o.w * o.d * len(o)) / 1e9; size = `${o.w}×${o.d}`; }
    if (o.kind === "footing") { v = (o.w * o.l * o.t) / 1e9; size = `${o.w}×${o.l}×${o.t}`; }
    if (o.kind === "slab") { v = (Math.abs(M.polygonArea(o.pts)) * o.t) / 1e9; size = `หนา ${o.t}`; }
    if (o.kind === "stair") { const r = (o.rise || 3000) / o.n; v = (o.w * o.n * o.run * (r / 2 + 150)) / 1e9; size = `กว้าง ${o.w} · ${o.n} ขั้น`; }
    conc += v;
    const k = `${o.kind}|${o.mark}|${size}`, ex = rows.find((r) => r.k === k);
    if (ex) { ex.n += n; ex.v += v; } else rows.push({ k, kind: o.kind, mark: o.mark || "-", size, rebar: o.rebar || o.pile || "", n, v });
  }
  const order = ["footing", "column", "beam", "slab", "stair"];
  rows.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || String(a.mark).localeCompare(String(b.mark)));
  // เหล็กเสริมประมาณ (กก./ลบ.ม. คอนกรีต ตามชนิด — ค่าใช้ประมาณราคา ไม่ใช่ BBS)
  const RB = { footing: 60, column: 160, beam: 140, slab: 80, stair: 90 };
  const steel = rows.reduce((s, r) => s + r.v * (RB[r.kind] || 100), 0);
  return { rows, concrete: conc, steel, formwork: S.reduce((s, o) => s + (o.kind === "beam" ? (len(o) * (o.w + 2 * o.d)) / 1e6 : o.kind === "column" ? (2 * (o.w + (o.l || o.w)) * ((o.top ?? 3000) - (o.base ?? 0))) / 1e6 : o.kind === "slab" ? Math.abs(M.polygonArea(o.pts)) / 1e6 : 0), 0) };
}

// ---------------------------------------------------------------- ตรวจขนาดเบื้องต้น (WSD · ว.ส.ท. / ACI 318-63 แบบหน่วยแรงใช้งาน)
const BARS = [[12, 1.131], [16, 2.011], [20, 3.142], [25, 4.909]];           // DB มม. → พื้นที่ ตร.ซม.
function wsd(D) {
  const fc = 0.45 * D.fc, fs = Math.min(0.5 * D.fy, 1700), n = Math.round(134 / Math.sqrt(D.fc));
  const k = 1 / (1 + fs / (n * fc)), j = 1 - k / 3, R = 0.5 * fc * k * j;
  return { fc, fs, n, k, j, R, vc: 0.29 * Math.sqrt(D.fc) };
}
/** พื้นที่รับน้ำหนักด้านข้างของคาน (ครึ่งระยะถึงคานขนานตัวถัดไปบนพื้นเดียวกัน แต่ละข้าง สูงสุด 3 ม.) */
function tribWidth(beams, b, slabs) {
  const u = M.norm(M.sub(b.b, b.a)), n = M.perp(u), mid = M.mul(M.add(b.a, b.b), 0.5);
  let tw = 0;
  for (const side of [1, -1]) {
    const probe = M.add(mid, M.mul(n, side * 300));
    if (!slabs.some((s) => Math.abs((s.z ?? 0) - (b.z ?? 0)) < 200 && M.pointInPolygon(probe, s.pts))) continue;
    let best = 3000 * 2;
    for (const c of beams) {
      if (c === b || Math.abs((c.z ?? 0) - (b.z ?? 0)) > 200) continue;
      const v = M.norm(M.sub(c.b, c.a)); if (Math.abs(u[0] * v[1] - u[1] * v[0]) > 0.1) continue;   // ไม่ขนาน
      const pr = M.projectOnSegment(mid, c.a, c.b), off = (pr.q[0] - mid[0]) * n[0] + (pr.q[1] - mid[1]) * n[1];
      if (off * side > 100 && Math.abs(off) < best) best = Math.abs(off);
    }
    tw += Math.min(best / 2, 3000);
  }
  return tw;
}
export function check(doc, D0) {
  const D = Object.assign({}, DESIGN, doc.design || {}, D0 || {}), W = wsd(D), S = doc.struct || [];   // doc.design = ค่าที่แก้ในหน้าต่างโครงสร้าง (บันทึกไปกับแบบ)
  const beams = S.filter((o) => o.kind === "beam"), slabs = S.filter((o) => o.kind === "slab"), cols = S.filter((o) => o.kind === "column"), fts = S.filter((o) => o.kind === "footing");
  const topZ = Math.max(...levels(doc).map((l) => l.z), 0);
  const out = { beams: [], columns: [], footings: [], slabs: [], D, W };
  // พื้น: ทางเดียว/สองทาง ตรวจความหนาต่ำสุด (L/20 ทางเดียว · ช่วงสั้น×เส้นรอบ/180 สองทาง ตาม ว.ส.ท.)
  for (const s of slabs) {
    // แผ่นพื้นแบ่งเป็นช่อง (panel) ตามคานที่ระดับเดียวกัน → ช่องใหญ่สุดกำหนดความหนา
    const xs = s.pts.map((p) => p[0]), ys = s.pts.map((p) => p[1]), bx = [Math.min(...xs), Math.max(...xs)], by = [Math.min(...ys), Math.max(...ys)];
    const at = beams.filter((b) => Math.abs((b.z ?? 0) - (s.z ?? 0)) < 200);
    const gx = [...new Set([bx[0], bx[1], ...at.filter((b) => Math.abs(b.a[0] - b.b[0]) < 1).map((b) => b.a[0])])].filter((x) => x >= bx[0] && x <= bx[1]).sort((a, b) => a - b);
    const gy = [...new Set([by[0], by[1], ...at.filter((b) => Math.abs(b.a[1] - b.b[1]) < 1).map((b) => b.a[1])])].filter((y) => y >= by[0] && y <= by[1]).sort((a, b) => a - b);
    const sx = Math.max(...gx.slice(1).map((x, i) => x - gx[i])), sy = Math.max(...gy.slice(1).map((y, i) => y - gy[i]));
    const Ls = Math.min(sx, sy), Ll = Math.max(sx, sy), two = Ll / Ls <= 2;
    const roof = (s.z ?? 0) >= topZ + 1000, w = (D.conc * s.t) / 1000 + D.finish + (roof ? D.liveRoof : D.live);
    const tmin = Math.max(two ? 90 : 80, two ? (2 * (sx + sy)) / 180 : Ls / 24);               // ว.ส.ท.: สองทาง เส้นรอบรูป/180 · ทางเดียว L/24 (ต่อเนื่องด้านเดียว)
    out.slabs.push({ o: s, w, tmin: Math.round(tmin), span: `${(sx / 1000).toFixed(2)} × ${(sy / 1000).toFixed(2)} ม. (${two ? "สองทาง" : "ทางเดียว"})`, ok: s.t >= tmin, msg: s.t >= tmin ? "ผ่าน" : `ควรหนาอย่างน้อย ${Math.round(tmin)} มม.` });
  }
  // คาน: น้ำหนักจากพื้น (พื้นที่รับน้ำหนัก) + ผนังที่ตั้งบนคาน + น้ำหนักตัวเอง → M = wL²/8 · V = wL/2
  const R = new Map();                                                            // แรงปฏิกิริยาลงเสา (ปลายคาน)
  for (const b of beams) {
    const L = len(b) / 1000, slab = slabs.find((s) => Math.abs((s.z ?? 0) - (b.z ?? 0)) < 200), ws = slab ? (D.conc * slab.t) / 1000 + D.finish + ((slab.z ?? 0) >= topZ + 1000 ? D.liveRoof : D.live) : 0;
    const tw = tribWidth(beams, b, slabs) / 1000;
    const wallH = doc.walls.filter((w) => Math.abs((w.base || 0) - (b.z ?? 0)) < 200 && M.projectOnSegment(M.mul(M.add(w.a, w.b), 0.5), b.a, b.b).d < 150).reduce((m, w) => Math.max(m, w.height), 0) / 1000;
    const self = (D.conc * b.w * b.d) / 1e6, w = ws * tw + D.wall * wallH + self;          // กก./ม.
    const Mu = (w * L * L) / 8 * 100, V = (w * L) / 2;                                       // กก.-ซม. · กก.
    const bw = b.w / 10, d = (b.d - D.cover - 10) / 10, Mc = W.R * bw * d * d;
    const As = Mu / (W.fs * W.j * d), bar = BARS.find(([, a]) => Math.ceil(As / a) <= Math.max(2, Math.floor((bw - 8) / 4))) || BARS[BARS.length - 1], nb = Math.max(2, Math.ceil(As / bar[1]));
    const vcap = W.vc * bw * d, sReq = V > vcap ? Math.min(d / 2, (2 * 0.283 * 1200 * d) / (V - vcap)) : d / 2;
    const okM = Mu <= Mc, okV = V <= 2 * vcap * 2.5;
    out.beams.push({ o: b, L, w: Math.round(w), M: Math.round(Mu / 100), Mc: Math.round(Mc / 100), V: Math.round(V), As: +As.toFixed(2), bars: `${nb}-DB${bar[0]}`, stir: `RB6@${Math.max(5, Math.floor(sReq / 2.5) * 2.5).toFixed(0)} ซม.`, ok: okM && okV, msg: !okM ? `โมเมนต์เกินกำลังหน้าตัด (${Math.round(Mu / 100)} > ${Math.round(Mc / 100)} กก.-ม.) — เพิ่มความลึกคาน` : !okV ? "แรงเฉือนสูง — เพิ่มขนาด" : "ผ่าน" });
    for (const p of [b.a, b.b]) { const k = p.join(","); R.set(k, (R.get(k) || 0) + V); }
  }
  // เสา: รับแรงจากปลายคานทุกชั้นที่อยู่เหนือโคนเสา + น้ำหนักตัวเอง · P ≤ 0.85 Ag (0.25fc' + fs ρg) (ρg 1%)
  const nearR = (p, zmin) => { let s = 0; for (const b of beams) if ((b.z ?? 0) > zmin) for (const q of [b.a, b.b]) if (M.dist(q, p) < 150) { const r = out.beams.find((x) => x.o === b); s += r ? r.V : 0; } return s; };
  for (const c of cols) {
    const P = nearR(c.p, (c.base ?? 0) - 1) + (D.conc * c.w * (c.l || c.w) * Math.max(0, (c.top ?? 3000) - (c.base ?? 0))) / 1e9;
    const Ag = (c.w * (c.l || c.w)) / 100, Pa = 0.85 * Ag * (0.25 * D.fc + 0.4 * D.fy * 0.01);
    out.columns.push({ o: c, P: Math.round(P), Pa: Math.round(Pa), ok: P <= Pa, msg: P <= Pa ? "ผ่าน" : `น้ำหนักเกิน (${Math.round(P / 1000)} > ${Math.round(Pa / 1000)} ตัน) — ขยายหน้าตัด` });
  }
  // ฐานราก: แรงจากเสาที่ตั้งบนฐาน + น้ำหนักฐาน/ดินถม 10% ≤ กำลังรับน้ำหนักดิน (หรือเข็ม)
  for (const f of fts) {
    const c = out.columns.filter((x) => M.dist(x.o.p, f.p) < Math.max(f.w, f.l) / 2 && (x.o.base ?? 0) <= 100);
    const P = c.reduce((s, x) => s + x.P, 0) * 1.1, A = (f.w * f.l) / 1e6, pile = /(\d+)\s*ต้น.*?(\d+(?:\.\d+)?)\s*ตัน/.exec(f.pile || "");
    const cap = pile ? Number(pile[1]) * Number(pile[2]) * 1000 : A * D.qa, need = P / D.qa;
    out.footings.push({ o: f, P: Math.round(P), cap: Math.round(cap), ok: P <= cap, msg: P <= cap ? "ผ่าน" : pile ? "เพิ่มจำนวนเข็ม" : `ขยายฐานเป็นอย่างน้อย ${Math.ceil(Math.sqrt(need) * 10) / 10} × ${Math.ceil(Math.sqrt(need) * 10) / 10} ม.` });
  }
  out.ok = [...out.beams, ...out.columns, ...out.footings, ...out.slabs].every((r) => r.ok);
  return out;
}

// ---------------------------------------------------------------- สร้างโครงสร้างจากผนัง (ตัวช่วย): เสาทุกมุม/จุดตัดผนัง + คานตามแนวผนัง + ฐานรากใต้เสา
export function autoFrame(doc, opts = {}) {
  const L = levels(doc), z1 = L[0].z, col = Object.assign({}, DEF.column, opts.column), bm = Object.assign({}, DEF.beam, opts.beam), ft = Object.assign({}, DEF.footing, opts.footing);
  const key = (p) => p.map((v) => Math.round(v / 50) * 50).join(",");
  const pts = new Map();
  for (const w of doc.walls) if ((w.base || 0) <= z1 + 100 && w.thick >= 150) for (const p of [w.a, w.b]) pts.set(key(p), p);
  const out = [], top = L.length > 1 ? L[1].z : (L[0].z + L[0].h);
  for (const p of pts.values()) {
    out.push({ id: M.uid("c"), kind: "footing", p: p.slice(), ...pick(ft, "w", "l", "t", "z", "mark", "pile") });
    out.push({ id: M.uid("c"), kind: "column", p: p.slice(), w: col.w, l: col.l, base: ft.z, top: L[L.length - 1].z + (L[L.length - 1].h || 3000), mark: col.mark, rebar: col.rebar });
  }
  for (const lv of [{ z: 0, mark: "GB1" }, ...L.slice(1).map((l) => ({ z: l.z, mark: bm.mark })), { z: L[L.length - 1].z + (L[L.length - 1].h || 3000), mark: "RB1" }])
    for (const w of doc.walls) if ((w.base || 0) <= z1 + 100 && w.thick >= 150) out.push({ id: M.uid("c"), kind: "beam", a: w.a.slice(), b: w.b.slice(), w: bm.w, d: lv.mark === "GB1" ? 400 : lv.mark === "RB1" ? 400 : bm.d, z: lv.z, mark: lv.mark, rebar: bm.rebar });
  return out;
}
const pick = (o, ...k) => Object.fromEntries(k.map((x) => [x, o[x]]));
