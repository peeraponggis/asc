// ส่งออกผัง 2D เป็น DXF R12 (ASCII) — เปิดได้ใน CadCraft · LibreCAD · FreeCAD · AutoCAD (โดย ลุงพี)
// ตัวอักษรไทยเขียนเป็น \U+XXXX (รูปแบบมาตรฐานของ DXF) · ชั้นตาม AIA เดียวกับแม่แบบใน cadcraft\templates
import { wallPolygon, openingSpans, wallLength, norm, sub, add, mul, perp, dist } from "./model.js?v=0.25.0";
import * as ST from "./struct.js?v=0.25.0";

const LAYERS = [["A-WALL", 7], ["A-DOOR", 3], ["A-GLAZ", 4], ["A-DIMS", 2], ["A-TEXT", 7], ["A-MASS", 5], ["A-LINE", 8], ["A-SYMB", 6], ["S-COLS", 1], ["S-BEAM", 5], ["S-FOOT", 30], ["S-SLAB", 8], ["S-STAIR", 7], ["S-TEXT", 1]];

function enc(s) {
  return String(s).replace(/[^\x20-\x7e]/g, (c) => "\\U+" + c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0"));
}
const f = (v) => (Math.round(v * 1000) / 1000).toString();

/** opts.level = ชั้นที่ส่งออก (ผังพื้นชั้นนั้น + โครงสร้างของชั้น) · ไม่ระบุ = ทุกชั้นซ้อนกัน */
export function toDXF(doc, opts = {}) {
  const lv = opts.level || null, on = (t, o) => ST.onLevel(doc, lv, t, o);
  const out = [];
  const g = (code, val) => out.push(String(code), String(val));
  const line = (layer, a, b) => { g(0, "LINE"); g(8, layer); g(10, f(a[0])); g(20, f(a[1])); g(30, 0); g(11, f(b[0])); g(21, f(b[1])); g(31, 0); };
  const poly = (layer, pts, closed) => pts.forEach((p, i) => { if (closed || i < pts.length - 1) line(layer, p, pts[(i + 1) % pts.length]); });
  const arc = (layer, c, r, a0, a1) => { g(0, "ARC"); g(8, layer); g(10, f(c[0])); g(20, f(c[1])); g(30, 0); g(40, f(r)); g(50, f(a0)); g(51, f(a1)); };
  const text = (layer, p, h, s, rot = 0) => { g(0, "TEXT"); g(8, layer); g(10, f(p[0])); g(20, f(p[1])); g(30, 0); g(40, f(h)); g(1, enc(s)); if (rot) g(50, f(rot)); };

  g(0, "SECTION"); g(2, "HEADER"); g(9, "$ACADVER"); g(1, "AC1009"); g(9, "$INSUNITS"); g(70, 4); g(0, "ENDSEC");
  g(0, "SECTION"); g(2, "TABLES"); g(0, "TABLE"); g(2, "LAYER"); g(70, LAYERS.length);
  for (const [n, c] of LAYERS) { g(0, "LAYER"); g(2, n); g(70, 0); g(62, c); g(6, "CONTINUOUS"); }
  g(0, "ENDTAB"); g(0, "ENDSEC");
  g(0, "SECTION"); g(2, "ENTITIES");

  for (const w of doc.walls) {
    if (!on("walls", w)) continue;
    const u = norm(sub(w.b, w.a)), n = mul(perp(u), w.thick / 2), L = wallLength(w);
    const at = (s) => add(w.a, mul(u, s));
    // เส้นผนัง 2 ข้าง เว้นช่องเปิด
    let cur = 0;
    const spans = openingSpans(doc, w);
    const seg = (s0, s1) => { line("A-WALL", add(at(s0), n), add(at(s1), n)); line("A-WALL", sub(at(s0), n), sub(at(s1), n)); };
    for (const sp of spans) {
      if (sp.s0 > cur) seg(cur, sp.s0);
      line("A-WALL", add(at(sp.s0), n), sub(at(sp.s0), n));
      line("A-WALL", add(at(sp.s1), n), sub(at(sp.s1), n));
      const o = sp.o;
      if (o.kind === "door") {
        const hinge = add(at(sp.s0), n), leafEnd = add(hinge, mul(perp(u), sp.s1 - sp.s0));
        line("A-DOOR", hinge, leafEnd);
        const a0 = (Math.atan2(u[1], u[0]) * 180) / Math.PI;
        arc("A-DOOR", hinge, sp.s1 - sp.s0, a0, a0 + 90);
      } else {
        for (const k of [-0.5, 0, 0.5]) line("A-GLAZ", add(at(sp.s0), mul(n, k * 2 * 0.5)), add(at(sp.s1), mul(n, k * 2 * 0.5)));
      }
      cur = sp.s1;
    }
    if (cur < L) seg(cur, L);
    line("A-WALL", add(w.a, n), sub(w.a, n));
    line("A-WALL", add(w.b, n), sub(w.b, n));
  }
  // โครงสร้าง: เสา (ทึบ = 4 เส้น + กากบาท) · คาน (เส้นคู่) · ฐานราก · พื้น · บันได + รหัส
  const L = ST.levels(doc), li = lv ? L.indexOf(lv) : 0, top = lv && L[li + 1] ? L[li + 1].z : 1e9;
  for (const o of doc.struct || []) {
    if (o.kind === "column" && (!lv || ((o.base ?? 0) < top - 100 && (o.top ?? 3000) > lv.z + 100))) { const r = ST.rectOf(o); poly("S-COLS", r, true); line("S-COLS", r[0], r[2]); line("S-COLS", r[1], r[3]); text("S-TEXT", add(o.p, [o.w / 2 + 60, o.w / 2 + 60]), 150, o.mark || "C"); }
    else if (o.kind === "footing" && (!lv || li === 0)) { poly("S-FOOT", ST.rectOf(o), true); text("S-TEXT", add(o.p, [o.w / 2 + 60, -o.l / 2 - 220]), 150, o.mark || "F"); }
    else if (o.kind === "beam" && on("struct", o)) { const P = ST.beamPoly(o); line("S-BEAM", P[0], P[1]); line("S-BEAM", P[3], P[2]); const m = mul(add(o.a, o.b), 0.5), u = norm(sub(o.b, o.a)), a = (Math.atan2(u[1], u[0]) * 180) / Math.PI; text("S-TEXT", add(m, mul(perp(u), o.w / 2 + 80)), 150, `${o.mark} ${o.w}x${o.d}`, a > 90 || a <= -90 ? a + 180 : a); }
    else if (o.kind === "slab" && on("struct", o)) { poly("S-SLAB", o.pts, true); for (const h of o.holes || []) { poly("S-SLAB", h, true); line("S-SLAB", h[0], h[2]); line("S-SLAB", h[1], h[3]); } const c = o.pts.reduce((s, p) => add(s, mul(p, 1 / o.pts.length)), [0, 0]); text("S-TEXT", c, 180, `${o.mark} t=${o.t}`); }
    else if (o.kind === "stair" && on("struct", o)) { const r = ST.rectOf(o), u = norm(sub(r[1], r[0])); poly("S-STAIR", r, true); for (let k = 1; k < o.n; k++) { const a = add(r[0], mul(u, k * o.run)); line("S-STAIR", a, add(a, sub(r[3], r[0]))); } text("S-TEXT", add(r[0], mul(sub(r[3], r[0]), 0.5)), 150, "UP"); }
  }
  for (const m of doc.masses) {
    if (!on("masses", m)) continue;
    poly("A-MASS", m.pts, true);
    const c = m.pts.reduce((s, p) => add(s, mul(p, 1 / m.pts.length)), [0, 0]);
    text("A-MASS", c, 150, `H=${Math.round(m.height)}`);
  }
  for (const l of doc.lines) poly("A-LINE", l.pts, l.closed);
  for (const d of doc.dims) {
    const u = norm(sub(d.b, d.a)), n = mul(perp(u), d.offset ?? 600);
    const a = add(d.a, n), b = add(d.b, n);
    line("A-DIMS", d.a, a); line("A-DIMS", d.b, b); line("A-DIMS", a, b);
    for (const p of [a, b]) line("A-DIMS", add(p, mul(add(u, perp(u)), 80)), sub(p, mul(add(u, perp(u)), 80)));
    const mid = mul(add(a, b), 0.5), ang = (Math.atan2(u[1], u[0]) * 180) / Math.PI;
    text("A-DIMS", add(mid, mul(perp(u), 60)), 180, String(Math.round(dist(d.a, d.b))), ang > 90 || ang <= -90 ? ang + 180 : ang);
  }
  for (const t of doc.texts) text("A-TEXT", t.p, t.h || 250, t.s);
  for (const s of doc.syms) text("A-SYMB", s.p, 150, `[${s.name}]`);
  g(0, "ENDSEC"); g(0, "EOF");
  return out.join("\r\n") + "\r\n";
}
