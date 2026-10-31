// อ่านไฟล์ DXF ในเบราว์เซอร์ (รุ่นออนไลน์ไม่มี server) → ข้อมูลรูปแบบเดียวกับ /api/cad/load (โดย ลุงพี)
// { name, version, insunits, units, toMM, guessToMM, bbox, view, layers:[{name,color,on,count}], polys:[[layer,aci,closed,[x,y,…]]],
//   texts:[[layer,aci,x,y,h,rot,str]], segments, skipped:{type:n} } — กติกาเดียวกับ server/core/cad.py (extract)
// รองรับ: LINE · LWPOLYLINE · POLYLINE · CIRCLE · ARC · ELLIPSE · SPLINE · TEXT · MTEXT · ATTRIB · INSERT (ซ้อน/อาร์เรย์) · DIMENSION ·
//         LEADER · HATCH (ขอบ) · SOLID/TRACE/3DFACE · ACAD_TABLE · ไม่มี DOM — ทดสอบด้วย node ได้
// ไม่รองรับ: DWG · DXF แบบ binary · วัตถุ ACIS (3DSOLID/REGION) · MLEADER → นับใน skipped

export const UNIT_MM = { 0: 1, 1: 25.4, 2: 304.8, 3: 1609344, 4: 1, 5: 10, 6: 1000, 7: 1e6, 8: 2.54e-5, 9: 0.0254, 10: 914.4, 14: 100, 15: 10000, 16: 100000 };
export const UNIT_NAME = { 0: "ไม่ระบุ (ถือเป็น มม.)", 1: "นิ้ว", 2: "ฟุต", 4: "มม.", 5: "ซม.", 6: "ม.", 10: "หลา", 14: "เดซิเมตร" };
export const MAX_SEGMENTS = 1500000;
const CODEPAGE = { ANSI_874: "windows-874", ANSI_1252: "windows-1252", ANSI_1250: "windows-1250", ANSI_1251: "windows-1251", ANSI_932: "shift_jis",
  ANSI_936: "gbk", ANSI_949: "euc-kr", ANSI_950: "big5", ANSI_1253: "windows-1253", ANSI_1254: "windows-1254", ANSI_1255: "windows-1255", ANSI_1256: "windows-1256" };

export class DxfError extends Error {}

/** ไบต์ของไฟล์ → ข้อความ: R2007 ขึ้นไปเป็น UTF-8 · รุ่นเก่าใช้ $DWGCODEPAGE (แบบไทยมัก ANSI_874) */
export function decodeDXF(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 65536));
  if (head.startsWith("AutoCAD Binary DXF")) throw new DxfError("ไฟล์ DXF แบบ binary — เปิดในโปรแกรม CAD แล้ว Save As เป็น DXF แบบข้อความ (ASCII) หรือใช้รุ่นในเครื่อง");
  const ver = /\$ACADVER\s*\r?\n\s*1\s*\r?\n\s*(AC\d+)/.exec(head);
  const cp = /\$DWGCODEPAGE\s*\r?\n\s*3\s*\r?\n\s*(\S+)/.exec(head);
  let enc = "utf-8";
  if (!ver || ver[1] < "AC1021") enc = (cp && CODEPAGE[cp[1].toUpperCase()]) || "windows-1252";
  try { return new TextDecoder(enc).decode(bytes); } catch (e) { return new TextDecoder("utf-8").decode(bytes); }
}

// ---------------------------------------------------------------- อ่านคู่ group code / ค่า (ไม่แยกทั้งไฟล์เป็น array — ประหยัด RAM)
function reader(text) {
  let i = 0;
  const line = () => {
    if (i >= text.length) return null;
    let j = text.indexOf("\n", i); if (j < 0) j = text.length;
    let s = text.slice(i, j); i = j + 1;
    if (s.endsWith("\r")) s = s.slice(0, -1);
    return s;
  };
  let peeked = null;
  const next = () => {
    if (peeked) { const p = peeked; peeked = null; return p; }
    const c = line(); if (c === null) return null;
    const v = line(); if (v === null) return null;
    return [parseInt(c, 10), v];
  };
  return { next, back(p) { peeked = p; } };
}

/** อ่านวัตถุ 1 ตัว (หลัง 0/TYPE) จนถึง 0 ถัดไป → { t, p: [[code, value]…] } */
function readEntity(rd, type) {
  const p = [];
  for (;;) {
    const g = rd.next();
    if (!g) break;
    if (g[0] === 0) { rd.back(g); break; }
    p.push(g);
  }
  return { t: type, p };
}

const num = (v, d = 0) => { const x = parseFloat(v); return Number.isFinite(x) ? x : d; };
function get(e, code, d) { for (const [c, v] of e.p) if (c === code) return v; return d; }
const getn = (e, code, d = 0) => num(get(e, code, undefined), d);

/** อ่านทั้งไฟล์ → header · layers · blocks · entities */
function parse(text) {
  const rd = reader(text);
  const header = {}, layers = new Map(), blocks = new Map(), entities = [];
  let g;
  while ((g = rd.next())) {
    if (g[0] !== 0 || g[1] !== "SECTION") continue;
    const s = rd.next(); if (!s) break;
    const sec = s[1];
    if (sec === "HEADER") {
      let name = null;
      while ((g = rd.next()) && !(g[0] === 0 && g[1] === "ENDSEC")) {
        if (g[0] === 9) { name = g[1]; header[name] = {}; } else if (name) header[name][g[0]] = g[1];
      }
    } else if (sec === "TABLES") {
      while ((g = rd.next()) && !(g[0] === 0 && g[1] === "ENDSEC")) {
        if (g[0] === 0 && g[1] === "LAYER") {
          const e = readEntity(rd, "LAYER");
          const nm = get(e, 2, "0"), c = Math.trunc(getn(e, 62, 7)), fl = Math.trunc(getn(e, 70, 0));
          layers.set(nm, { color: Math.abs(c) || 7, on: c >= 0 && !(fl & 1), count: 0 });
        }
      }
    } else if (sec === "BLOCKS" || sec === "ENTITIES") {
      let blk = null;
      while ((g = rd.next()) && !(g[0] === 0 && g[1] === "ENDSEC")) {
        if (g[0] !== 0) continue;
        const e = readEntity(rd, g[1]);
        if (e.t === "BLOCK") { blk = { name: get(e, 2, ""), bx: getn(e, 10), by: getn(e, 20), ents: [] }; blocks.set(blk.name, blk); continue; }
        if (e.t === "ENDBLK") { blk = null; continue; }
        const list = sec === "BLOCKS" ? (blk ? blk.ents : null) : entities;
        if (!list) continue;
        if (e.t === "VERTEX" || e.t === "ATTRIB" || e.t === "SEQEND") {        // ลูกของ POLYLINE / INSERT ตัวก่อนหน้า
          const par = list[list.length - 1];
          if (par && !par.closedKids && (par.t === "POLYLINE" || par.t === "INSERT")) {
            if (e.t === "SEQEND") par.closedKids = true; else (par.kids || (par.kids = [])).push(e);
          }
          continue;
        }
        list.push(e);
      }
    }
  }
  return { header, layers, blocks, entities };
}

// ---------------------------------------------------------------- เรขาคณิต (เมทริกซ์ 2D: x' = a·x + c·y + e · y' = b·x + d·y + f)
const I = [1, 0, 0, 1, 0, 0];
const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
const T = (x, y) => [1, 0, 0, 1, x, y];
const R = (deg) => { const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r); return [c, s, -s, c, 0, 0]; };
const S = (sx, sy) => [sx, 0, 0, sy, 0, 0];
const MIRROR = [-1, 0, 0, 1, 0, 0];                       // ทิศ extrusion (0,0,−1) — วัตถุถูกสะท้อนแกน x (arbitrary axis)

function arcPts(cx, cy, r, a0, sweep, tol) {
  const n = Math.max(2, Math.min(720, Math.ceil(Math.abs(sweep) / (tol > 0 && r > tol ? 2 * Math.acos(1 - tol / r) : Math.PI / 36))));
  const out = [];
  for (let k = 0; k <= n; k++) { const a = a0 + (sweep * k) / n; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return out;
}
const sweepCCW = (a0, a1) => { let s = a1 - a0; while (s <= 0) s += 2 * Math.PI; return s; };

/** bulge ระหว่างจุด p→q → จุดบนโค้ง (ไม่รวม p) */
function bulgePts(p, q, b, tol) {
  if (!b) return [q];
  const dx = q[0] - p[0], dy = q[1] - p[1], c = Math.hypot(dx, dy);
  if (c < 1e-12) return [q];
  const th = 4 * Math.atan(b), r = c / (2 * Math.sin(th / 2));
  const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, h = r * Math.cos(th / 2);
  const nx = -dy / c, ny = dx / c;
  const cx = mx + nx * h, cy = my + ny * h;
  const a0 = Math.atan2(p[1] - cy, p[0] - cx);
  return arcPts(cx, cy, Math.abs(r), a0, th, tol).slice(1);
}

function vertsWithBulge(vs, closed, tol) {
  if (!vs.length) return [];
  const out = [[vs[0][0], vs[0][1]]];
  const n = vs.length;
  for (let k = 0; k < (closed ? n : n - 1); k++) out.push(...bulgePts(vs[k], vs[(k + 1) % n], vs[k][2] || 0, tol));
  if (closed && out.length > 1) out.pop();
  return out;
}

/** B-spline (de Boor) — เส้นโค้ง SPLINE */
function splinePts(deg, knots, ctrl, weights, tol, steps) {
  const n = ctrl.length;
  if (n < deg + 1 || knots.length !== n + deg + 1) return ctrl.map((c) => [c[0], c[1]]);
  const w = weights.length === n ? weights : ctrl.map(() => 1);
  const u0 = knots[deg], u1 = knots[n], out = [];
  const N = Math.max(8, Math.min(2000, steps || n * 12));
  for (let s = 0; s <= N; s++) {
    let u = u0 + ((u1 - u0) * s) / N;
    let k = deg; while (k < n - 1 && u >= knots[k + 1]) k++;
    const d = [];
    for (let j = 0; j <= deg; j++) { const c = ctrl[k - deg + j], ww = w[k - deg + j]; d.push([c[0] * ww, c[1] * ww, ww]); }
    for (let r = 1; r <= deg; r++) for (let j = deg; j >= r; j--) {
      const i = k - deg + j, den = knots[i + deg - r + 1] - knots[i];
      const a = den ? (u - knots[i]) / den : 0;
      d[j] = [(1 - a) * d[j - 1][0] + a * d[j][0], (1 - a) * d[j - 1][1] + a * d[j][1], (1 - a) * d[j - 1][2] + a * d[j][2]];
    }
    out.push([d[deg][0] / d[deg][2], d[deg][1] / d[deg][2]]);
  }
  return out;
}

const SPECIAL = { "%%c": "Ø", "%%C": "Ø", "%%d": "°", "%%D": "°", "%%p": "±", "%%P": "±", "%%%": "%" };
const unescape = (s) => s.replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
const plainText = (s) => unescape(s).replace(/%%[cCdDpP%]/g, (m) => SPECIAL[m]).replace(/%%[uUoOkK]/g, "");
/** MTEXT → ข้อความล้วน (ตัดรหัสจัดรูปแบบ) */
export function mtextPlain(s) {
  return unescape(s)
    .replace(/\\\\/g, "\u0000").replace(/\\\{/g, "\u0001").replace(/\\\}/g, "\u0002")      // \\ \{ \} = ตัวอักษรจริง
    .replace(/\\P/g, "\n").replace(/\\~/g, " ")
    .replace(/\\S([^;]*?)[#^/]([^;]*?);/g, "$1/$2")                                        // เศษส่วนซ้อน
    .replace(/\\[ACFfHQTWcp][^;]*;/g, "")                                                  // รหัสที่มีค่า … ;
    .replace(/\\[LlOoKkX]/g, "")                                                           // ขีดเส้นใต้/บน/ฆ่า
    .replace(/[{}]/g, "")
    .replace(/\u0000/g, "\\").replace(/\u0001/g, "{").replace(/\u0002/g, "}")
    .replace(/%%[cCdDpP%]/g, (m) => SPECIAL[m]);
}

// ---------------------------------------------------------------- อ่าน DXF → ข้อมูลสำหรับวาด
export function readDXF(text, name = "drawing.dxf", maxSegments = MAX_SEGMENTS) {
  if (typeof text !== "string") text = decodeDXF(text);
  if (text.startsWith("AutoCAD Binary DXF")) throw new DxfError("ไฟล์ DXF แบบ binary — Save As เป็น DXF แบบข้อความ (ASCII) ก่อน");
  const { header, layers, blocks, entities } = parse(text);
  if (!entities.length && !blocks.size) throw new DxfError("ไม่ใช่ไฟล์ DXF หรือไฟล์เสีย — ไม่พบส่วน ENTITIES");
  const insunits = Math.trunc(num((header.$INSUNITS || {})[70], 0));
  const em = header.$EXTMIN || {}, ex = header.$EXTMAX || {};
  const size = Math.hypot(num(ex[10]) - num(em[10]), num(ex[20]) - num(em[20]));
  const tol = size && size < 1e12 && num(ex[10]) > num(em[10]) ? Math.max(size / 20000, 1e-6) : 0;
  const polys = [], texts = [], skipped = {};
  let segs = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const skip = (t) => { skipped[t] = (skipped[t] || 0) + 1; };
  const layerOf = (nm, c) => { let L = layers.get(nm); if (!L) { L = { color: c || 7, on: true, count: 0 }; layers.set(nm, L); } return L; };
  const colorOf = (c, layer) => (c === 256 || c === 0 ? layerOf(layer).color : Math.abs(c) || 7);

  function addPoly(m, layer, color, pts, closed) {
    if (pts.length < 2) return;
    const f = new Array(pts.length * 2);
    for (let k = 0; k < pts.length; k++) {
      const [x, y] = pts[k], X = m[0] * x + m[2] * y + m[4], Y = m[1] * x + m[3] * y + m[5];
      if (!Number.isFinite(X) || !Number.isFinite(Y)) return;
      f[2 * k] = X; f[2 * k + 1] = Y;
      if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
    }
    polys.push([layer, color, closed ? 1 : 0, f]);
    segs += pts.length;
    layerOf(layer, color).count++;
  }
  function addText(m, layer, color, x, y, h, rot, str) {
    if (!str || !str.trim()) return;
    const X = m[0] * x + m[2] * y + m[4], Y = m[1] * x + m[3] * y + m[5];
    const sy = Math.hypot(m[2], m[3]), ang = (Math.atan2(m[1], m[0]) * 180) / Math.PI;
    const mir = m[0] * m[3] - m[1] * m[2] < 0;
    texts.push([layer, color, X, Y, h * sy, (mir ? -rot : rot) + ang, str.slice(0, 400)]);
    if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
    layerOf(layer, 7).count++;
  }

  function hatchPaths(e) {
    const p = e.p, paths = [];
    let i = p.findIndex(([c]) => c === 91);
    if (i < 0) return paths;
    const np = Math.trunc(num(p[i][1])); i++;
    const at = (c) => (i < p.length && p[i][0] === c ? num(p[i++][1]) : (i++, 0));
    for (let k = 0; k < np && i < p.length; k++) {
      while (i < p.length && p[i][0] !== 92) i++;
      if (i >= p.length) break;
      const flags = Math.trunc(num(p[i++][1])), pts = [];
      if (flags & 2) {                                                         // ขอบแบบ polyline
        let hasB = 0;
        while (i < p.length && p[i][0] !== 93) { if (p[i][0] === 72) hasB = Math.trunc(num(p[i][1])); i++; }
        const n = Math.trunc(num(p[i++][1]));
        const vs = [];
        for (let v = 0; v < n && i < p.length; v++) {
          const x = at(10), y = at(20); let b = 0;
          if (hasB && i < p.length && p[i][0] === 42) b = num(p[i++][1]);
          vs.push([x, y, b]);
        }
        pts.push(...vertsWithBulge(vs, true, tol));                              // ขอบ hatch ปิดเสมอ
      } else {                                                                  // ขอบแบบเส้นต่อกัน
        while (i < p.length && p[i][0] !== 93) i++;
        const ne = Math.trunc(num(p[i++][1]));
        for (let ed = 0; ed < ne && i < p.length; ed++) {
          while (i < p.length && p[i][0] !== 72) i++;
          const typ = Math.trunc(num(p[i++][1]));
          if (typ === 1) { const a = [at(10), at(20)], b = [at(11), at(21)]; if (!pts.length) pts.push(a); pts.push(b); }
          else if (typ === 2) {
            const cx = at(10), cy = at(20), r = at(40), s = at(50), en = at(51), ccw = at(73);
            const a0 = (s * Math.PI) / 180, a1 = (en * Math.PI) / 180;
            pts.push(...(ccw ? arcPts(cx, cy, r, a0, sweepCCW(a0, a1), tol) : arcPts(cx, cy, r, -a0, -sweepCCW(a0, a1), tol)));
          } else if (typ === 3) {
            const cx = at(10), cy = at(20), mx = at(11), my = at(21), ratio = at(40), s = at(50), en = at(51), ccw = at(73);
            const a0 = (s * Math.PI) / 180, a1 = (en * Math.PI) / 180, R0 = Math.hypot(mx, my), rot = Math.atan2(my, mx);
            const sw = ccw ? sweepCCW(a0, a1) : -sweepCCW(a0, a1), st = ccw ? a0 : -a0;
            for (const [u, v] of arcPts(0, 0, 1, st, sw, tol / Math.max(R0, 1e-9))) {
              const X = u * R0, Y = v * R0 * ratio;
              pts.push([cx + X * Math.cos(rot) - Y * Math.sin(rot), cy + X * Math.sin(rot) + Y * Math.cos(rot)]);
            }
          } else if (typ === 4) {                                                // spline ในขอบ hatch
            const deg = Math.trunc(at(94)); i += 2;                               // 73 rational · 74 periodic
            const nk = Math.trunc(at(95)), nc = Math.trunc(at(96)), knots = [], ctrl = [], wts = [];
            for (let q = 0; q < nk; q++) knots.push(at(40));
            for (let q = 0; q < nc; q++) { ctrl.push([at(10), at(20)]); if (i < p.length && p[i][0] === 42) wts.push(num(p[i++][1])); }
            pts.push(...splinePts(deg, knots, ctrl, wts, tol));
            while (i < p.length && ![72, 92, 97, 75].includes(p[i][0])) i++;
          }
        }
      }
      if (pts.length > 1) paths.push(pts);
    }
    return paths;
  }

  function walk(list, m, inLayer, inColor, depth) {
    for (const e of list) {
      if (segs > maxSegments) { skip("เกินขีดจำกัด"); continue; }
      let layer = get(e, 8, "0");
      let c = Math.trunc(getn(e, 62, 256));
      if (inLayer !== null && layer === "0") layer = inLayer;                    // ชิ้นใน block บน layer 0 → layer ของ block
      if (inLayer !== null && c === 0) c = inColor;                              // BYBLOCK → สีของ block
      const t = e.t, color = colorOf(c, layer);
      const ocs = getn(e, 230, 1) < 0 ? mul(m, MIRROR) : m;
      try {
        if (t === "LINE") addPoly(m, layer, color, [[getn(e, 10), getn(e, 20)], [getn(e, 11), getn(e, 21)]], false);
        else if (t === "LWPOLYLINE") {
          const vs = [];
          for (const [cd, v] of e.p) { if (cd === 10) vs.push([num(v), 0, 0]); else if (cd === 20 && vs.length) vs[vs.length - 1][1] = num(v); else if (cd === 42 && vs.length) vs[vs.length - 1][2] = num(v); }
          const closed = (Math.trunc(getn(e, 70)) & 1) === 1;
          addPoly(ocs, layer, color, vertsWithBulge(vs, closed, tol), closed);
        } else if (t === "POLYLINE") {
          const fl = Math.trunc(getn(e, 70));
          if (fl & 64 || fl & 16) { skip(t); continue; }                         // polyface / mesh
          const vs = (e.kids || []).filter((v) => v.t === "VERTEX").map((v) => [getn(v, 10), getn(v, 20), getn(v, 42)]);
          const closed = (fl & 1) === 1;
          addPoly(fl & 8 ? m : ocs, layer, color, vertsWithBulge(vs, closed, tol), closed);
        } else if (t === "CIRCLE") addPoly(ocs, layer, color, arcPts(getn(e, 10), getn(e, 20), getn(e, 40), 0, 2 * Math.PI, tol).slice(0, -1), true);
        else if (t === "ARC") {
          const a0 = (getn(e, 50) * Math.PI) / 180, a1 = (getn(e, 51) * Math.PI) / 180;
          addPoly(ocs, layer, color, arcPts(getn(e, 10), getn(e, 20), getn(e, 40), a0, sweepCCW(a0, a1), tol), false);
        } else if (t === "ELLIPSE") {
          const cx = getn(e, 10), cy = getn(e, 20), mx = getn(e, 11), my = getn(e, 21), ratio = getn(e, 40, 1);
          const s = getn(e, 41, 0), en = getn(e, 42, 2 * Math.PI), R0 = Math.hypot(mx, my), rot = Math.atan2(my, mx);
          const sw = sweepCCW(s, en), full = Math.abs(sw - 2 * Math.PI) < 1e-6;
          const flip = getn(e, 230, 1) < 0 ? -1 : 1;                             // จุดศูนย์กลาง/แกนหลักเป็นพิกัดจริง — extrusion −z แค่กลับด้านแกนรอง
          const pts = arcPts(0, 0, 1, s, sw, tol / Math.max(R0, 1e-9)).map(([u, v]) => { const X = u * R0, Y = flip * v * R0 * ratio; return [cx + X * Math.cos(rot) - Y * Math.sin(rot), cy + X * Math.sin(rot) + Y * Math.cos(rot)]; });
          addPoly(m, layer, color, full ? pts.slice(0, -1) : pts, full);
        } else if (t === "SPLINE") {
          const deg = Math.trunc(getn(e, 71, 3)), knots = [], ctrl = [], wts = [], fit = [];
          for (const [cd, v] of e.p) {
            if (cd === 40) knots.push(num(v)); else if (cd === 41) wts.push(num(v));
            else if (cd === 10) ctrl.push([num(v), 0]); else if (cd === 20 && ctrl.length) ctrl[ctrl.length - 1][1] = num(v);
            else if (cd === 11) fit.push([num(v), 0]); else if (cd === 21 && fit.length) fit[fit.length - 1][1] = num(v);
          }
          const pts = ctrl.length ? splinePts(deg, knots, ctrl, wts, tol) : fit;
          addPoly(m, layer, color, pts, (Math.trunc(getn(e, 70)) & 1) === 1);
        } else if (t === "TEXT" || t === "ATTRIB") {
          if (t === "ATTRIB" && Math.trunc(getn(e, 70)) & 1) continue;           // attribute ที่ซ่อน
          addText(ocs, layer, color, getn(e, 10), getn(e, 20), getn(e, 40, 1) || 1, getn(e, 50), plainText(get(e, 1, "")));
        } else if (t === "MTEXT") {
          let s = ""; for (const [cd, v] of e.p) if (cd === 3) s += v; s += get(e, 1, "");
          let rot = getn(e, 50);
          if (get(e, 11) !== undefined) rot = (Math.atan2(getn(e, 21), getn(e, 11)) * 180) / Math.PI;
          addText(m, layer, color, getn(e, 10), getn(e, 20), getn(e, 40, 1) || 1, rot, mtextPlain(s));
        } else if (t === "INSERT" || t.endsWith("DIMENSION") || t === "ACAD_TABLE") {
          const b = blocks.get(get(e, 2, ""));
          if (!b || depth >= 16) { if (!b) skip(t); continue; }
          if (t === "ACAD_TABLE") {                                              // ตาราง: block วางที่จุด 10/20 หมุนตามทิศ 11/21
            const ang = (Math.atan2(getn(e, 21), getn(e, 11, 1)) * 180) / Math.PI;
            walk(b.ents, mul(m, mul(T(getn(e, 10), getn(e, 20)), mul(R(ang), T(-b.bx, -b.by)))), layer, c, depth + 1);
            continue;
          }
          if (t !== "INSERT") { walk(b.ents, mul(ocs, T(getn(e, 12), getn(e, 22))), layer, c, depth + 1); continue; }   // เส้นระยะ: เลื่อนตามจุด 12/22
          const sx = getn(e, 41, 1) || 1, sy = getn(e, 42, 1) || 1, rot = getn(e, 50);
          const cols = Math.max(1, Math.trunc(getn(e, 70, 1))), rows = Math.max(1, Math.trunc(getn(e, 71, 1)));
          const cs = getn(e, 44), rs = getn(e, 45);
          const base = mul(ocs, mul(T(getn(e, 10), getn(e, 20)), R(rot)));
          for (let r = 0; r < Math.min(rows, 500); r++) for (let k = 0; k < Math.min(cols, 500); k++) {
            const bm = mul(base, mul(T(k * cs, r * rs), mul(S(sx, sy), T(-b.bx, -b.by))));
            walk(b.ents, bm, layer, c, depth + 1);
          }
          for (const a of e.kids || []) walk([a], m, null, 256, depth);         // ATTRIB อยู่ในพิกัดจริงแล้ว
        } else if (t === "LEADER") {
          const vs = []; for (const [cd, v] of e.p) { if (cd === 10) vs.push([num(v), 0]); else if (cd === 20 && vs.length) vs[vs.length - 1][1] = num(v); }
          addPoly(m, layer, color, vs, false);
        } else if (t === "HATCH" || t === "MPOLYGON") {
          for (const pts of hatchPaths(e)) addPoly(ocs, layer, color, pts, true);
        } else if (t === "IMAGE" || t === "WIPEOUT") {                           // ขอบภาพ / แผ่นบัง (เหมือน ezdxf make_path)
          const ux = getn(e, 11), uy = getn(e, 21), vx = getn(e, 12), vy = getn(e, 22), hgt = getn(e, 23);
          const ox = getn(e, 10) + ux * 0.5 - vx * 0.5, oy = getn(e, 20) + uy * 0.5 - vy * 0.5;
          let bp = []; for (const [cd, v] of e.p) { if (cd === 14) bp.push([num(v), 0]); else if (cd === 24 && bp.length) bp[bp.length - 1][1] = num(v); }
          if (bp.length < 2) bp = [[-0.5, -0.5], [getn(e, 13) - 0.5, hgt - 0.5]];
          if (bp.length === 2) { const [p0, p1] = bp; bp = [p0, [p1[0], p0[1]], p1, [p0[0], p1[1]]]; }
          addPoly(m, layer, color, bp.map(([px, py]) => [ox + ux * px + vx * (hgt - py), oy + uy * px + vy * (hgt - py)]), true);
        } else if (t === "MLINE") {                                              // เส้นคู่: แต่ละเส้นย่อย = จุดยอด + ทิศมุมต่อ × ระยะเลื่อน
          const ne = Math.trunc(getn(e, 73)), closed = (Math.trunc(getn(e, 71)) & 2) === 2;
          const lines = Array.from({ length: ne }, () => []);
          let vx = 0, vy = 0, mx = 0, my = 0, el = -1, first = false;
          for (const [cd, v] of e.p) {
            if (cd === 11) { vx = num(v); el = -1; } else if (cd === 21) vy = num(v);
            else if (cd === 13) mx = num(v); else if (cd === 23) my = num(v);
            else if (cd === 74) { el++; first = true; }
            else if (cd === 41 && first) { first = false; if (lines[el]) lines[el].push([vx + mx * num(v), vy + my * num(v)]); }
          }
          for (const ln of lines) addPoly(m, layer, color, ln, closed);
        } else if (t === "MULTILEADER" || t === "MLEADER") {                    // เส้นชี้ (ต่อถึงจุดเชื่อม) + ข้อความ
          let txt = "", tx = 0, ty = 0, th = 1, sect = "", line = [], conn = null, want = false;
          for (const [cd, v] of e.p) {
            if (cd === 302) { sect = v.startsWith("LEADER_LINE") ? "line" : v.startsWith("LEADER") ? "leader" : sect; if (sect === "line") line = []; if (sect === "leader") { conn = null; want = true; } }
            else if (cd === 305) { if (sect === "line") { addPoly(m, layer, color, conn ? [...line, conn] : line, false); sect = "leader"; } else sect = ""; }
            else if (sect === "line" && cd === 10) line.push([num(v), 0]); else if (sect === "line" && cd === 20 && line.length) line[line.length - 1][1] = num(v);
            else if (sect === "leader" && want && cd === 10) conn = [num(v), 0]; else if (sect === "leader" && want && cd === 20 && conn) { conn[1] = num(v); want = false; }
            else if (cd === 304) txt = v; else if (cd === 12 && !sect) tx = num(v); else if (cd === 22 && !sect) ty = num(v); else if (cd === 41 && !sect) th = num(v) || th;
          }
          if (txt) mtextPlain(txt).split("\n").forEach((s, k) => addText(m, layer, color, tx, ty - th - k * th * 1.667, th, 0, s));   // ทีละบรรทัด (จุด 12/22 = มุมบนซ้าย)
        } else if (t === "SOLID" || t === "TRACE" || t === "3DFACE") {
          const vs = [[10, 20], [11, 21], [13, 23], [12, 22]].filter(([a]) => get(e, a) !== undefined).map(([a, b2]) => [getn(e, a), getn(e, b2)]);
          addPoly(t === "3DFACE" ? m : ocs, layer, color, vs, true);
        } else if (["POINT", "ATTDEF", "VIEWPORT", "SEQEND", "VERTEX"].includes(t)) continue;
        else skip(t);
      } catch (err) { skip(t); }
    }
  }

  const model = entities.filter((e) => get(e, 67, "0").trim() !== "1");
  walk(model.length ? model : entities, I, null, 256, 0);
  if (!polys.length && !texts.length) throw new DxfError("ไฟล์ว่าง — ไม่มีเส้นหรือข้อความใน model space");
  const bbox = [x0, y0, x1, y1];
  let guess = null;
  if (insunits === 0) { const w = Math.max(x1 - x0, y1 - y0); guess = w > 1 && w < 2000 ? 1000 : 1; }
  const ver = (header.$ACADVER || {})[1] || "";
  return {
    name, version: ver, insunits, units: UNIT_NAME[insunits] || String(insunits), toMM: UNIT_MM[insunits] || 1, guessToMM: guess, bbox,
    layers: [...layers.entries()].filter(([, v]) => v.count).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([nm, v]) => ({ name: nm, ...v })),
    polys, texts, segments: segs, skipped, view: robustBBox(polys, texts, bbox), client: true,
  };
}

/** กรอบมุมมองแรกที่ไม่โดนวัตถุหลงทางดึง (เหมือน robust_bbox ของ server) */
export function robustBBox(polys, texts, bbox) {
  const xs = [], ys = [];
  const step = Math.max(1, Math.floor(polys.length / 40000));
  for (let i = 0; i < polys.length; i += step) { xs.push(polys[i][3][0]); ys.push(polys[i][3][1]); }
  const ts = Math.max(1, Math.floor(texts.length / 5000));
  for (let i = 0; i < texts.length; i += ts) { xs.push(texts[i][2]); ys.push(texts[i][3]); }
  if (xs.length < 50) return bbox;
  xs.sort((a, b) => a - b); ys.sort((a, b) => a - b);
  const n = xs.length, k = Math.floor(n / 200);
  const fence = (v) => { const q1 = v[Math.floor(n / 4)], q3 = v[Math.floor((3 * n) / 4)], iqr = q3 - q1; return [Math.max(v[k], q1 - 1.5 * iqr), Math.min(v[n - 1 - k], q3 + 1.5 * iqr)]; };
  const [fx0, fx1] = fence(xs), [fy0, fy1] = fence(ys);
  if (fx1 <= fx0 || fy1 <= fy0) return bbox;
  const w = fx1 - fx0, h = fy1 - fy0, r = [fx0 - w * 0.05, fy0 - h * 0.05, fx1 + w * 0.05, fy1 + h * 0.05];
  const full = Math.max(bbox[2] - bbox[0], bbox[3] - bbox[1]);
  return full > 1.5 * Math.max(r[2] - r[0], r[3] - r[1], 1e-9) ? r : bbox;
}
