// แผง ข้อมูลวัตถุ (Entity Info) รวมของ 2D/3D — แก้ค่าได้ทุกชนิด · ค่าที่พิมพ์ใช้ตามนั้น (ผิดกติกาเตือน ไม่บีบค่า) (โดย ลุงพี)
import * as M from "./model.js?v=0.31.5";
import * as SEL from "./sel3d.js?v=0.31.5";
import { PALETTE } from "./materials.js?v=0.31.5";
import * as SOL from "./mesh.js?v=0.31.5";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ROOF = [["none", "ไม่มี"], ["flat", "เรียบ"], ["shed", "เพิง"], ["gable", "จั่ว"], ["hip", "ปั้นหยา"], ["curved", "โค้ง"]];
const matSel = (v, k = "mat") => `<select data-k="${k}"><option value="">ค่าเริ่มต้น</option>${PALETTE.filter((p) => !p.hide).map((p) => `<option value="${p.key}" ${p.key === v ? "selected" : ""}>${esc(p.th)}</option>`).join("")}</select>`;
const num = (k, v, step = 10, extra = "") => `<input type="number" data-k="${k}" step="${step}" value="${v ?? ""}" ${extra}>`;
const txt = (k, v) => `<input data-k="${k}" value="${esc(v ?? "")}">`;
const ro = (v) => `<span class="mono">${esc(v)}</span>`;

/** ก้อนผิว+เส้น (0.26): ทั้งก้อน · หน้า · เส้น · จุด */
const chk = (k, on) => `<input type="checkbox" data-k="${k}" ${on ? "checked" : ""}>`;
function solidRows(key, s) {
  const p = SEL.sub(key), f = (m) => `${(m / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 })} ม.`;
  if (p.kind === "f") {
    const fi = +p.ref, F = s.faces[fi]; if (!F) return [];
    const n = SOL.normal(s, fi), tilt = Math.round((Math.acos(Math.max(-1, Math.min(1, n[2]))) * 180) / Math.PI);
    const az = Math.round(((Math.atan2(n[0], n[1]) * 180) / Math.PI + 360) % 360), dir = tilt < 2 ? "หันขึ้น (หน้าบน)" : tilt > 178 ? "หันลง (หน้าล่าง)" : `ทิศ ${az}° · เอียง ${tilt}°`;
    return [["พื้นที่", ro(`${(SOL.faceArea(s, fi) / 1e6).toFixed(2)} ตร.ม.`)], ["หันไปทาง", ro(dir)], ["วัสดุหน้านี้", matSel(F.mat, "fmat")], ["จำนวนรู", ro(F.loops.length - 1)]];
  }
  if (p.kind === "e") {
    const k = p.ref, E = SOL.edges(s).get(k);
    return [["ความยาว", ro(f(SOL.edgeLen(s, k)))], ["หน้าที่ติดกัน", ro(E ? E.faces.length : 0)], ["ซ่อนเส้น", chk("ehide", (s.hidden || []).includes(k))], ["เส้นนุ่ม (Soft)", chk("esoft", (s.soft || []).includes(k))]];
  }
  if (p.kind === "v") { const v = s.verts[+p.ref] || [0, 0, 0]; return [["ตำแหน่ง (มม.)", ro(v.map((x) => Math.round(x).toLocaleString()).join(" , "))]]; }
  const b = SOL.bbox(s);
  return [["ชื่อ", txt("name", s.name)], ["วัสดุทั้งก้อน", matSel(s.mat)], ["ฐาน (มม.)", num("sbase", b.lo[2], 50)], ["สูง (มม.)", num("sheight", b.hi[2] - b.lo[2], 50)],
    ["ขนาด", ro(`${f(b.hi[0] - b.lo[0])} × ${f(b.hi[1] - b.lo[1])}`)], ["หน้า / เส้น", ro(`${s.faces.length} / ${SOL.edges(s).size}`)],
    ["ปริมาตร", ro(SOL.isClosed(s) ? `${(SOL.volume(s) / 1e9).toFixed(2)} ม.³` : "ยังไม่ปิดสนิท")]];
}

/** ฟิลด์ของแต่ละชนิด: [ป้าย, html] */
function rows(doc, t, o) {
  const f = (m) => `${(m / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 })} ม.`;
  if (t === "walls") return [["ยาว (มม.)", num("len", Math.round(M.wallLength(o)), 10)], ["หนา (มม.)", num("thick", o.thick)], ["สูง (มม.)", num("height", o.height, 50)], ["ฐานที่ระดับ (มม.)", num("base", o.base || 0, 50)], ["วัสดุ", matSel(o.mat)], ["ช่องเปิด", ro(`${doc.openings.filter((x) => x.wall === o.id).length} ช่อง`)]];
  if (t === "openings") return [["ชนิด", `<select data-k="kind"><option value="door" ${o.kind === "door" ? "selected" : ""}>ประตู</option><option value="window" ${o.kind === "window" ? "selected" : ""}>หน้าต่าง</option></select>`], ["รหัส", txt("mark", o.mark)], ["กว้าง (มม.)", num("width", o.width)], ["สูง (มม.)", num("height", o.height)], ["สูงจากพื้น (มม.)", num("sill", o.sill)]];
  if (t === "roof") return [["ทรง", `<select data-k="type">${ROOF.map(([k, th]) => `<option value="${k}" ${o.type === k ? "selected" : ""}>${th}</option>`).join("")}</select>`], ["ความชัน (°)", num("pitch", o.pitch, 1)], ["ชายคายื่น (มม.)", num("overhang", o.overhang, 50)], ["วัสดุ", matSel(o.mat)]];
  if (t === "masses") return [["ชื่อ", txt("name", o.name)], ["สูง (มม.)", num("height", o.height, 50)], ["ฐาน (มม.)", num("base", o.base || 0, 50)], ["วัสดุ", matSel(o.mat)], ["พื้นที่", ro(`${(Math.abs(M.polygonArea(o.pts)) / 1e6).toFixed(2)} ตร.ม.`)]];
  if (t === "struct") {
    const base = [["รหัส", txt("mark", o.mark)], ["วัสดุ", matSel(o.mat)]];
    if (o.kind === "column") return [...base, ["หน้าตัด กว้าง (มม.)", num("w", o.w)], ["หน้าตัด ลึก (มม.)", num("l", o.l || o.w)], ["โคนเสา (มม.)", num("base", o.base, 50)], ["หัวเสา (มม.)", num("top", o.top, 50)], ["เหล็กเสริม", txt("rebar", o.rebar)]];
    if (o.kind === "beam") return [...base, ["กว้าง (มม.)", num("w", o.w)], ["ลึก (มม.)", num("d", o.d)], ["หลังคาน (มม.)", num("z", o.z, 50)], ["ยาว", ro(f(M.dist(o.a, o.b)))], ["เหล็กเสริม", txt("rebar", o.rebar)]];
    if (o.kind === "footing") return [...base, ["กว้าง (มม.)", num("w", o.w, 50)], ["ยาว (มม.)", num("l", o.l, 50)], ["หนา (มม.)", num("t", o.t, 50)], ["หลังฐาน (มม.)", num("z", o.z, 50)], ["เข็ม", txt("pile", o.pile)]];
    if (o.kind === "stair") return [...base, ["กว้าง (มม.)", num("w", o.w, 50)], ["จำนวนขั้น", num("n", o.n, 1)], ["ลูกนอน (มม.)", num("run", o.run, 10)], ["ฐาน (มม.)", num("base", o.base, 50)], ["สูงรวม (มม.)", num("rise", o.rise, 50)]];
    return base;
  }
  if (t === "items" && o.kind === "model") { const s = Number(o.s) || 1, m = (v) => ((v * s) / 1000).toFixed(2);
    return [["ชื่อป้าย", txt("name", o.name)], ["ขนาดจริง", ro(`${m(o.w)} × ${m(o.d)} × ${m(o.h)} ม. (กว้าง × ลึก × สูง)`)], ["ตัวคูณ", num("s", s, 0.05)], ["หมุน (°)", num("rot", o.rot || 0, 15)], ["ระดับ (มม.)", num("z", o.z || 0, 50)],
      ["ไฟล์ต้นทาง", ro(o.src || "-")], ["สามเหลี่ยม", ro((o.tris || 0).toLocaleString())]]; }
  if (t === "items") return [["ตัวคูณ", num("s", o.s || 1, 0.05)], ["หมุน (°)", num("rot", o.rot || 0, 15)], ["ระดับ (มม.)", num("z", o.z || 0, 50)]];
  if (t === "sweeps") return [["หน้าตัด กว้าง", num("w", o.w)], ["หน้าตัด สูง", num("h", o.h)], ["ระดับ (มม.)", num("z", o.z || 0, 50)], ["วัสดุ", matSel(o.mat)]];
  if (t === "texts3d") return [["ข้อความ", txt("s", o.s)], ["ขนาดตัวอักษร (มม.)", num("h", o.h)]];
  if (t === "texts") return [["ข้อความ", txt("s", o.s)], ["ขนาดตัวอักษร (มม.)", num("h", o.h)]];
  if (t === "dims") return [["ระยะเส้นมิติ (มม.)", num("offset", o.offset ?? 600, 50)], ["ระยะวัด", ro(f(M.dist(o.a, o.b)))]];
  if (t === "dims3d") return [["ระยะยก (มม.)", num("off", o.off ?? 400, 50)], ["ระยะวัด", ro(f(Math.hypot(o.a[0] - o.b[0], o.a[1] - o.b[1], (o.a[2] || 0) - (o.b[2] || 0))))]];
  if (t === "syms") return [["ขนาด (เท่า)", num("scale", o.scale || 1, 0.1)], ["หมุน (°)", num("rot", o.rot || 0, 15)]];
  if (t === "lines") return [["จำนวนจุด", ro(o.pts.length)], ["ระดับ (มม.)", num("z", o.z || 0, 50)]];
  return [];
}

export function entityHTML(doc, keys) {
  const ks = keys.filter((k) => SEL.find(doc, k));
  if (!ks.length) return `<p class="note">ยังไม่ได้เลือก — ใช้ <b>เลือก</b> (Space) แล้วคลิกวัตถุใดก็ได้ในภาพ 3D หรือผัง 2D: ผนัง หลังคา ประตู หน้าต่าง เสา คาน กล่อง ต้นไม้ · Shift+คลิก = เลือกหลายชิ้น · Ctrl+A = ทั้งหมด</p>`;
  const [t] = SEL.split(ks[0]), o = SEL.find(doc, ks[0]), same = ks.every((k) => k.startsWith(t + ":"));
  const head = `<div class="ent-h"><b>${esc(t === "struct" ? SEL.STRUCT_TH[o.kind] || "โครงสร้าง" : SEL.NAME[t] || t)}${ks.length > 1 ? ` · เลือก ${ks.length} ชิ้น` : ""}</b><small>${esc(SEL.describe(doc, ks[0]))}</small></div>`;
  if (!same) return head + `<p class="note">เลือกหลายชนิดพร้อมกัน — ใช้ ย้าย (M) · หมุน (Q) · Delete · Ctrl+C/V ได้ทั้งชุด · แก้ค่าทีละชนิด: Shift+คลิกเอาออกให้เหลือชนิดเดียว</p>`;
  const R = t === "solids" ? solidRows(ks[0], o) : rows(doc, t, o);
  return head + `<div class="kv ent" data-keys="${esc(ks.join(","))}">${R.map(([l, h]) => `<span>${l}</span>${h}`).join("")}</div>` +
    `<div class="row" style="margin-top:8px"><button type="button" class="chipb" data-ent="del">🗑 ลบ</button><button type="button" class="chipb" data-ent="copy">⧉ คัดลอก</button>${t === "walls" ? '<button type="button" class="chipb" data-ent="door">＋ ประตู</button><button type="button" class="chipb" data-ent="window">＋ หน้าต่าง</button>' : ""}</div>`;
}

/** ค่าที่แก้ในแผง → doc (ใช้กับทุกชิ้นที่เลือก ถ้าเป็นชนิดเดียวกัน) · คืนข้อความเตือน (ถ้ามี) */
export function applyField(doc, keys, k, raw) {
  let warn = "";
  for (const key of keys) {
    const [t] = SEL.split(key), o = SEL.find(doc, key); if (!o) continue;
    if (t === "solids") { warn = applySolid(o, key, k, raw) || warn; continue; }
    const isNum = (t === "items" && k === "s") || !["name", "mark", "s", "mat", "kind", "type", "rebar", "pile"].includes(k);   // ชิ้นส่วน: s = ตัวคูณ (ตัวเลข) · ข้อความ: s = ตัวอักษร
    const v = isNum ? Number(raw) : raw;
    if (isNum && (raw === "" || isNaN(v))) return "ค่าไม่ใช่ตัวเลข — ไม่ได้เปลี่ยน";
    if (isNum && v <= 0 && !["base", "sill", "rot", "z", "offset", "off", "top"].includes(k)) return "ค่าต้องมากกว่า 0 — ไม่ได้เปลี่ยน";
    if (t === "walls" && k === "len") { const u = M.norm(M.sub(o.b, o.a)); o.b = M.add(o.a, M.mul(u, v)).map((x) => Math.round(x)); continue; }
    if (k === "mat" && !v) delete o.mat; else o[k] = v;
    if (t === "openings") {
      const w = doc.walls.find((x) => x.id === o.wall);
      if (w && o.width > M.wallLength(w)) warn = "⚠ ช่องเปิดกว้างกว่าผนัง — ตรวจค่าอีกครั้ง";
      if (w && o.sill + o.height > w.height) warn = "⚠ ช่องเปิดสูงเกินผนัง — ตรวจค่าอีกครั้ง";
    }
    if (t === "struct" && o.kind === "column" && (o.top ?? 0) <= (o.base ?? 0)) warn = "⚠ หัวเสาต่ำกว่าโคนเสา — ตรวจค่าอีกครั้ง";
  }
  return warn;
}
/** ก้อนผิว+เส้น: ค่าที่แก้ในแผง (ค่าที่พิมพ์ใช้ตามนั้น · ผิดกติกาเตือน ไม่บีบค่า) */
function applySolid(s, key, k, raw) {
  const p = SEL.sub(key);
  if (k === "name") { s.name = raw; return ""; }
  if (k === "mat") { if (raw) s.mat = raw; else delete s.mat; return ""; }
  if (k === "fmat") { const F = s.faces[+p.ref]; if (F) { if (raw) F.mat = raw; else delete F.mat; } return ""; }
  if (k === "ehide" || k === "esoft") {
    const L = k === "ehide" ? (s.hidden = s.hidden || []) : (s.soft = s.soft || []), on = raw === true || raw === "true" || raw === "on";
    const i = L.indexOf(p.ref); if (on && i < 0) L.push(p.ref); if (!on && i >= 0) L.splice(i, 1); return "";
  }
  const v = Number(raw); if (raw === "" || isNaN(v)) return "ค่าไม่ใช่ตัวเลข — ไม่ได้เปลี่ยน";
  const b = SOL.bbox(s);
  if (k === "sbase") { const dz = Math.round(v - b.lo[2]); s.verts = s.verts.map((q) => [q[0], q[1], q[2] + dz]); return ""; }
  if (k === "sheight") {
    if (v <= 0) return "ค่าต้องมากกว่า 0 — ไม่ได้เปลี่ยน";
    const h = b.hi[2] - b.lo[2] || 1; s.verts = s.verts.map((q) => [q[0], q[1], Math.round(b.lo[2] + ((q[2] - b.lo[2]) * v) / h)]); return "";
  }
  return "";
}
