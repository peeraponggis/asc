// การเลือกรวมของ 2D/3D + งานแก้ทั่วไป (ย้าย หมุน ลบ คัดลอก) ได้ทุกชนิดวัตถุ (โดย ลุงพี)
// กุญแจ = "ชนิด:id" เช่น "walls:w1" · หลังคาทั้งผืน = "roof:roof" · ไม่มี DOM/three (ทดสอบด้วย node ได้)
import * as M from "./model.js?v=0.31.1";
import * as SOL from "./mesh.js?v=0.31.1";

/** มุมมองของชุดที่เลือกเฉพาะชนิดเดียว (ให้โค้ดเดิมที่ใช้ sk.sel / ext.itemSel ทำงานต่อได้) */
export class TypedSet {
  constructor(S, t) { this.S = S; this.p = t + ":"; }
  has(id) { return this.S.has(this.p + id); }
  add(id) { this.S.add(this.p + id); return this; }
  delete(id) { return this.S.delete(this.p + id); }
  clear() { for (const k of [...this.S]) if (k.startsWith(this.p)) this.S.delete(k); }
  get size() { let n = 0; for (const k of this.S) if (k.startsWith(this.p)) n++; return n; }
  *[Symbol.iterator]() { for (const k of [...this.S]) if (k.startsWith(this.p)) yield k.slice(this.p.length); }
  forEach(f) { for (const id of this) f(id); }
}

export const key = (type, id) => `${type}:${type === "roof" ? "roof" : id}`;
export const split = (k) => { const i = k.indexOf(":"); return [k.slice(0, i), k.slice(i + 1)]; };
/** กุญแจย่อยของก้อนผิว+เส้น: "solids:id:f:3" (หน้า) · ":e:1-2" (เส้น) · ":v:5" (จุด) */
export const isSub = (k) => k.startsWith("solids:") && k.split(":").length > 2;
export const sub = (k) => { const p = k.split(":"); return { id: p[1], kind: p[2] || null, ref: p[3] }; };

/** ชนิดที่เก็บเป็นรายการใน doc (ชื่อชนิดใน 3D → ชื่อรายการใน doc) */
export const LIST = { walls: "walls", openings: "openings", masses: "masses", solids: "solids", items: "items3d", lines: "lines", texts3d: "texts3d", dims3d: "dims3d", sweeps: "sweeps", syms: "syms", texts: "texts", dims: "dims", struct: "struct" };
export const NAME = { walls: "ผนัง", openings: "ประตู/หน้าต่าง", roof: "หลังคา", masses: "กล่อง/หน้า", solids: "ก้อน (ผิว+เส้น)", items: "ชิ้นส่วน", lines: "เส้น", texts3d: "ข้อความ 3D", dims3d: "มิติ 3D", sweeps: "หน้าตัดกวาด", syms: "สัญลักษณ์", texts: "ข้อความ", dims: "มิติ", struct: "โครงสร้าง" };
export const STRUCT_TH = { column: "เสา", beam: "คาน", footing: "ฐานราก", slab: "พื้น", stair: "บันได" };

export function find(doc, k) {
  const [t, id] = split(k);
  if (t === "roof") return doc.roof;
  if (t === "solids") { const sid = id.split(":")[0]; return (doc.solids || []).find((x) => x.id === sid); }   // "solids:id" หรือ "solids:id:f:3" / ":e:1-2" → ทั้งก้อน
  const L = doc[LIST[t]]; return L ? L.find((x) => x.id === id) : null;
}

/** จุดในแนวราบของวัตถุ (ใช้หาจุดศูนย์กลาง/หมุน) */
function ptsOf(doc, t, o) {
  if (t === "walls") return [o.a, o.b];
  if (t === "openings") { const w = doc.walls.find((x) => x.id === o.wall); return w ? [M.add(w.a, M.mul(M.sub(w.b, w.a), o.t))] : []; }
  if (t === "masses" || t === "lines" || t === "sweeps") return o.pts;
  if (t === "solids") return o.verts;
  if (t === "items" || t === "syms" || t === "texts") return [o.p];
  if (t === "texts3d") return [o.p];
  if (t === "dims3d" || t === "dims") return [o.a, o.b];
  if (t === "struct") return o.kind === "beam" ? [o.a, o.b] : [o.p];
  return [];
}
export function center(doc, keys) {
  const all = []; for (const k of keys) { const [t] = split(k), o = find(doc, k); if (o) all.push(...ptsOf(doc, t, o)); }
  if (!all.length) return [0, 0];
  return [all.reduce((s, p) => s + p[0], 0) / all.length, all.reduce((s, p) => s + p[1], 0) / all.length];
}

const mv = (p, dx, dy) => { p[0] = Math.round(p[0] + dx); p[1] = Math.round(p[1] + dy); };
/** ย้ายวัตถุในแนวราบ (มม.) — ประตู/หน้าต่างเลื่อนไปตามผนัง */
export function translate(doc, keys, dx, dy) {
  for (const k of keys) {
    const [t] = split(k), o = find(doc, k); if (!o) continue;
    if (t === "walls") { mv(o.a, dx, dy); mv(o.b, dx, dy); }
    else if (t === "openings") {
      const w = doc.walls.find((x) => x.id === o.wall); if (!w || keys.has?.(key("walls", w.id))) continue;
      const u = M.norm(M.sub(w.b, w.a)), L = M.wallLength(w) || 1;
      o.t = Math.max(0, Math.min(1, o.t + (dx * u[0] + dy * u[1]) / L));
    }
    else if (t === "masses" || t === "lines" || t === "sweeps") o.pts.forEach((p) => mv(p, dx, dy));
    else if (t === "solids") { if (!isSub(k)) o.verts.forEach((p) => mv(p, dx, dy)); }
    else if (t === "items" || t === "syms" || t === "texts") mv(o.p, dx, dy);
    else if (t === "texts3d") { mv(o.p, dx, dy); if (o.at) mv(o.at, dx, dy); }
    else if (t === "dims3d" || t === "dims") { mv(o.a, dx, dy); mv(o.b, dx, dy); }
    else if (t === "struct") { if (o.kind === "beam") { mv(o.a, dx, dy); mv(o.b, dx, dy); } else mv(o.p, dx, dy); }
  }
}
/** หมุนรอบจุด c (องศา ทวนเข็ม) */
export function rotate(doc, keys, deg, c) {
  const a = (deg * Math.PI) / 180, cs = Math.cos(a), sn = Math.sin(a);
  const r = (p) => { const x = p[0] - c[0], y = p[1] - c[1]; p[0] = Math.round(c[0] + x * cs - y * sn); p[1] = Math.round(c[1] + x * sn + y * cs); };
  for (const k of keys) {
    const [t] = split(k), o = find(doc, k); if (!o) continue;
    if (t === "walls") { r(o.a); r(o.b); }
    else if (t === "masses" || t === "lines" || t === "sweeps") o.pts.forEach(r);
    else if (t === "solids") { if (!isSub(k)) o.verts.forEach(r); }
    else if (t === "items" || t === "syms") { r(o.p); o.rot = ((((o.rot || 0) + deg) % 360) + 360) % 360; }
    else if (t === "texts" || t === "texts3d") { r(o.p); if (o.at) r(o.at); if (t === "texts3d" && o.kind === "3d") o.rot = ((((o.rot || 0) + deg) % 360) + 360) % 360; }
    else if (t === "dims3d" || t === "dims") { r(o.a); r(o.b); }
    else if (t === "struct") { if (o.kind === "beam") { r(o.a); r(o.b); } else { r(o.p); o.rot = ((((o.rot || 0) + deg) % 360) + 360) % 360; } }
  }
}
/** ลบ — ผนังลบประตู/หน้าต่างของตัวเองด้วย · หลังคา = ตั้งเป็น "ไม่มี" */
export function remove(doc, keys) {
  const by = {};
  for (const k of keys) { if (isSub(k)) continue; const [t, id] = split(k); (by[t] = by[t] || new Set()).add(id); }   // หน้า/เส้นของก้อน: ลบที่ tools3d (ลบหน้า/รวมหน้า)
  for (const [t, ids] of Object.entries(by)) {
    if (t === "roof") { doc.roof.type = "none"; continue; }
    const L = LIST[t]; if (!L) continue;
    doc[L] = doc[L].filter((x) => !ids.has(x.id));
    if (t === "walls") doc.openings = doc.openings.filter((o) => !ids.has(o.wall));
  }
}
/** สำเนาของที่เลือก (ผนังพาประตู/หน้าต่างไปด้วย) → { list: [[ชนิด, obj]] } */
export function copyOf(doc, keys) {
  const out = [], walls = new Set();
  for (const k of keys) {
    const [t] = split(k), o = find(doc, k); if (!o || t === "roof" || isSub(k)) continue;
    if (t === "openings" && keys.has && keys.has(key("walls", o.wall))) continue;
    out.push([t, JSON.parse(JSON.stringify(o))]); if (t === "walls") walls.add(o.id);
  }
  for (const o of doc.openings) if (walls.has(o.wall)) out.push(["openings", JSON.parse(JSON.stringify(o))]);
  return { list: out };
}
/** วางสำเนา (id ใหม่ · เลื่อน dx,dy) → ชุดกุญแจใหม่ */
export function paste(doc, clip, dx, dy) {
  const ids = new Map(), gids = new Map(), keys = new Set();
  const nid = (t, old) => { const n = M.uid({ walls: "w", openings: "o", masses: "m", solids: "s", items: "i", lines: "l", sweeps: "s", struct: "c" }[t] || "x"); ids.set(old, n); return n; };
  const items = clip.list.map(([t, o]) => [t, JSON.parse(JSON.stringify(o))]);
  for (const [t, o] of items) if (t !== "openings" || !ids.has(o.wall)) o.id = nid(t, o.id);
  for (const [t, o] of items) {
    if (t === "openings") { if (ids.has(o.wall)) { o.wall = ids.get(o.wall); o.id = M.uid("o"); } else continue; }
    if (o.gid) { if (!gids.has(o.gid)) gids.set(o.gid, M.uid("g")); o.gid = gids.get(o.gid); }
    const k = key(t, o.id); keys.add(k);
    doc[LIST[t]].push(o);
  }
  const moved = new Set([...keys].filter((k) => !k.startsWith("openings:")));
  translate(doc, moved, dx, dy);
  return keys;
}

/** คำอธิบายสั้นของสิ่งที่เลือก (แถบสถานะ/ป้ายเมาส์ชี้) */
export function describe(doc, k, fmt = (m) => `${(m / 1000).toFixed(2)} ม.`) {
  const [t] = split(k), o = find(doc, k); if (!o) return "";
  if (t === "walls") return `ผนัง ยาว ${fmt(M.wallLength(o))} · หนา ${o.thick} มม. · สูง ${fmt(o.height)}${o.base ? ` · ฐานที่ ${fmt(o.base)}` : ""}`;
  if (t === "openings") return `${o.kind === "door" ? "ประตู" : "หน้าต่าง"} ${o.width}×${o.height} มม.${o.mark ? ` (${o.mark})` : ""}`;
  if (t === "roof") return `หลังคา${{ gable: "จั่ว", hip: "ปั้นหยา", flat: "เรียบ", shed: "เพิง", curved: "โค้ง" }[o.type] || ""} ลาด ${o.pitch}° · ชายคา ${o.overhang} มม.`;
  if (t === "solids") {
    const p = k.split(":");
    if (p[2] === "f") { const f = +p[3]; return `หน้า (Face) ${(SOL.faceArea(o, f) / 1e6).toFixed(2)} ตร.ม. · ${o.name || "ก้อน"}`; }
    if (p[2] === "e") return `เส้น (Edge) ยาว ${fmt(SOL.edgeLen(o, p[3]))} · ${o.name || "ก้อน"}`;
    if (p[2] === "v") return `จุด (Vertex) · ${o.name || "ก้อน"}`;
    const b = SOL.bbox(o); return `${o.name || "ก้อน"} · ${fmt(b.hi[0] - b.lo[0])} × ${fmt(b.hi[1] - b.lo[1])} × ${fmt(b.hi[2] - b.lo[2])} · ${o.faces.length} หน้า · ${SOL.isClosed(o) ? `ปริมาตร ${(SOL.volume(o) / 1e9).toFixed(2)} ม.³` : "ยังไม่ปิดสนิท"}`;
  }
  if (t === "masses") return `${o.name || "กล่อง"} สูง ${fmt(o.height)} · พื้นที่ ${(Math.abs(M.polygonArea(o.pts)) / 1e6).toFixed(2)} ตร.ม.`;
  if (t === "items" && o.kind === "model") { const s = Number(o.s) || 1, m = (v) => ((v * s) / 1000).toFixed(2); return `โมเดล 3D ${o.name || ""} · ${m(o.w)} × ${m(o.d)} × ${m(o.h)} ม.`; }
  if (t === "struct") return `${STRUCT_TH[o.kind] || "โครงสร้าง"} ${o.mark || ""} ${o.kind === "beam" ? `${o.w}×${o.d} มม. ยาว ${fmt(M.dist(o.a, o.b))}` : o.kind === "footing" ? `${o.w}×${o.l}×${o.t} มม.` : o.kind === "stair" ? `กว้าง ${o.w} มม. · ${o.n} ขั้น` : `${o.w}×${o.l || o.w} มม. สูง ${fmt((o.top || 0) - (o.base || 0))}`}`.trim();
  return NAME[t] || t;
}
