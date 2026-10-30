// ชั้นไฟล์ CAD นำเข้า (DXF/DWG ที่ server อ่านแล้ว) — วาดบน canvas ด้วย Path2D ต่อ layer จึงซูม/เลื่อนแบบใหญ่ ๆ ได้ลื่น (โดย ลุงพี)
// ref (เก็บในแบบ): { id, file, name, toMM, dx, dy, bbox:[x0,y0,x1,y1] (หน่วยไฟล์), hidden: {layer: true} }
// data (จาก /api/cad/load): { polys: [[layer, aci, closed, [x,y,…]]], texts: [[layer, aci, x, y, h, rot, s]], layers: [{name, color, count}] }
import * as M from "./model.js?v=0.9.0";

const ACI = { 1: "#d0302f", 2: "#a88a00", 3: "#2e8b3d", 4: "#1b8a9e", 5: "#2f56c9", 6: "#a03aa8", 7: "", 8: "#7d858f", 9: "#a9b0b8",
              30: "#d9822b", 40: "#c26a00", 140: "#3a7bd5", 150: "#2f5fb3", 250: "#555", 251: "#6b6b6b", 252: "#888", 253: "#9e9e9e", 254: "#bbb" };
export function aciColor(c, ink) { return ACI[c] || (c === 7 ? ink : c > 9 && c < 250 ? `hsl(${Math.round(((c - 10) / 240) * 360)},55%,42%)` : "#8a929c"); }

/** สร้าง Path2D ต่อ layer (ทำครั้งเดียวต่อไฟล์) */
export function build(data) {
  const layers = new Map();
  const get = (name, color) => { let L = layers.get(name); if (!L) { L = { name, color, path: new Path2D(), byColor: new Map(), texts: [] }; layers.set(name, L); } return L; };
  for (const [ln, aci, closed, f] of data.polys) {
    const L = get(ln, aci);
    let p = L.byColor.get(aci); if (!p) { p = new Path2D(); L.byColor.set(aci, p); }
    p.moveTo(f[0], f[1]);
    for (let i = 2; i < f.length; i += 2) p.lineTo(f[i], f[i + 1]);
    if (closed) p.closePath();
  }
  for (const t of data.texts) get(t[0], t[1]).texts.push(t);
  return layers;
}

/** world (มม.) → จอ: x' = ox + (dx + x·k)·s · y' = oy − (dy + y·k)·s */
export function draw(ctx, ref, built, view, ink) {
  const k = ref.toMM, s = view.scale;
  ctx.save();
  ctx.setTransform(k * s * view.dpr, 0, 0, -k * s * view.dpr, (view.ox + ref.dx * s) * view.dpr, (view.oy - ref.dy * s) * view.dpr);
  ctx.lineWidth = 1 / (k * s);
  ctx.lineJoin = ctx.lineCap = "round";
  for (const L of built.values()) {
    if (ref.hidden && ref.hidden[L.name]) continue;
    for (const [aci, p] of L.byColor) { ctx.strokeStyle = aciColor(aci, ink); ctx.stroke(p); }
  }
  // ข้อความ: ข้ามตัวที่เล็กกว่า 3 px บนจอ (อ่านไม่ออกอยู่แล้ว และทำให้ช้า)
  for (const L of built.values()) {
    if (ref.hidden && ref.hidden[L.name]) continue;
    for (const [, aci, x, y, h, rot, str] of L.texts) {
      if (h * k * s < 3) continue;
      ctx.save();
      ctx.translate(x, y); ctx.rotate((rot * Math.PI) / 180); ctx.scale(1, -1);
      ctx.fillStyle = aciColor(aci, ink); ctx.font = `${h * 1.35}px Tahoma, sans-serif`;
      ctx.fillText(str, 0, 0);
      ctx.restore();
    }
  }
  ctx.restore();
}

export function worldBBox(ref) {
  const [x0, y0, x1, y1] = ref.bbox, k = ref.toMM;
  return { x0: ref.dx + x0 * k, y0: ref.dy + y0 * k, x1: ref.dx + x1 * k, y1: ref.dy + y1 * k };
}

const tf = (ref) => (x, y) => [Math.round((ref.dx + x * ref.toMM) * 10) / 10, Math.round((ref.dy + y * ref.toMM) * 10) / 10];

/** layer → เส้นที่แก้ไขได้ในแบบ */
export function toLines(ref, data, layer) {
  const T = tf(ref), out = [];
  for (const [ln, , closed, f] of data.polys) {
    if (ln !== layer) continue;
    const pts = []; for (let i = 0; i < f.length; i += 2) pts.push(T(f[i], f[i + 1]));
    out.push({ id: M.uid("l"), pts, closed: !!closed, layer: ln });
  }
  return out;
}

/** รูปปิดของ layer → กล่อง (push-pull ต่อได้ใน 3D) · ข้ามรูปเล็กกว่า minArea ตร.มม. */
export function toMasses(ref, data, layer, height, minArea = 250000) {
  const T = tf(ref), out = [];
  for (const [ln, , closed, f] of data.polys) {
    if (ln !== layer) continue;
    const pts = []; for (let i = 0; i < f.length; i += 2) pts.push(T(f[i], f[i + 1]));
    const isClosed = closed || (pts.length > 3 && M.dist(pts[0], pts[pts.length - 1]) < 1);
    if (!isClosed) continue;
    if (M.dist(pts[0], pts[pts.length - 1]) < 1) pts.pop();
    if (pts.length < 3 || Math.abs(M.polygonArea(pts)) < minArea) continue;
    out.push({ id: M.uid("m"), name: layer, pts, base: 0, height });
  }
  return out;
}

/** เส้นของ layer → ผนัง (ผนังเส้นเดียว: แต่ละช่วงเส้น = ผนัง 1 ช่วง) · ข้ามช่วงสั้นกว่า minLen มม. */
export function toWalls(ref, data, layer, thick, height, minLen = 300) {
  const T = tf(ref), out = [];
  for (const [ln, , closed, f] of data.polys) {
    if (ln !== layer) continue;
    const pts = []; for (let i = 0; i < f.length; i += 2) pts.push(T(f[i], f[i + 1]));
    const n = pts.length - (closed ? 0 : 1);
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if (M.dist(a, b) >= minLen) out.push({ id: M.uid("w"), a, b, thick, height });
    }
  }
  return out;
}

/** เส้น CAD ที่ระดับพื้นในฉาก 3D (Float32Array คู่จุด x,y,z หน่วยเมตร แกน three) */
export function segments3D(ref, data) {
  const vis = data.polys.filter((p) => !(ref.hidden && ref.hidden[p[0]]));
  let n = 0; for (const p of vis) n += (p[3].length / 2 - 1 + (p[2] ? 1 : 0));
  const arr = new Float32Array(n * 6), col = new Float32Array(n * 6);
  let j = 0;
  const k = ref.toMM / 1000, dx = ref.dx / 1000, dy = ref.dy / 1000;
  const rgb = (aci) => { const c = aciColor(aci, "#333333"); return hexOrHsl(c); };
  for (const [, aci, closed, f] of vis) {
    const [r, g, b] = rgb(aci), m = f.length / 2;
    const seg = (i0, i1) => {
      arr.set([dx + f[i0 * 2] * k, 0.02, -(dy + f[i0 * 2 + 1] * k), dx + f[i1 * 2] * k, 0.02, -(dy + f[i1 * 2 + 1] * k)], j);
      col.set([r, g, b, r, g, b], j); j += 6;
    };
    for (let i = 0; i < m - 1; i++) seg(i, i + 1);
    if (closed && m > 2) seg(m - 1, 0);
  }
  return { positions: arr, colors: col };
}

function hexOrHsl(c) {
  if (c[0] === "#") {
    const h = c.length === 4 ? c.slice(1).split("").map((x) => x + x).join("") : c.slice(1);
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  }
  const m = c.match(/hsl\((\d+),(\d+)%,(\d+)%\)/);
  if (!m) return [0.4, 0.4, 0.4];
  const H = +m[1] / 360, S = +m[2] / 100, L = +m[3] / 100;
  const q = L < 0.5 ? L * (1 + S) : L + S - L * S, p = 2 * L - q;
  const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(H + 1 / 3), f(H), f(H - 1 / 3)];
}
