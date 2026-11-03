// นำเข้า 3D SketchUp (.skp .dae ฯลฯ) — ส่วนคำนวณล้วน ไม่มี DOM/three (ทดสอบด้วย node ได้) (โดย ลุงพี)
// หน่วยในไฟล์ · ขนาดจริงเป็นเมตร · งบสามเหลี่ยม (โมเดลหนัก → รุ่นแสดงผลเบา) · ชิ้นส่วน items3d ชนิด "model" · คลังชิ้นส่วนของฉัน

/** หน่วยที่เลือกได้ (ค่า m = กี่เมตรต่อ 1 หน่วยในไฟล์) */
export const UNITS = [
  { k: "m", th: "เมตร", m: 1 }, { k: "cm", th: "เซนติเมตร", m: 0.01 }, { k: "mm", th: "มิลลิเมตร", m: 0.001 },
  { k: "in", th: "นิ้ว", m: 0.0254 }, { k: "ft", th: "ฟุต", m: 0.3048 },
];
export const unitM = (k) => (UNITS.find((u) => u.k === k) || UNITS[0]).m;
export const unitTh = (k) => (UNITS.find((u) => u.k === k) || UNITS[0]).th;

/** ชนิดไฟล์ที่รับ: [นามสกุล, คำอธิบาย, รุ่นที่ใช้ได้] */
export const FORMATS = [
  [".glb .gltf", "glTF (Blender · SketchUp ส่งออก · เว็บ)", "ทุกรุ่น"],
  [".dae .kmz", "COLLADA (SketchUp: File › Export › 3D Model)", "ทุกรุ่น"],
  [".obj .stl", "OBJ / STL (โปรแกรม 3D ทั่วไป)", "ทุกรุ่น"],
  [".skp", "SketchUp ต้นฉบับ (แปลงที่เครื่องนี้)", "รุ่นในเครื่องเท่านั้น"],
];
export const ACCEPT = ".glb,.gltf,.dae,.kmz,.obj,.stl,.skp,.zip";
export const TRI_LIMIT = 60000;               // เกินนี้ = โมเดลหนัก → ทำรุ่นแสดงผลเบาให้อัตโนมัติ
export const SIMPLIFY_MAX_VERTS = 15000;      // ชิ้นที่จุดยอด (หลังรวมจุดซ้ำ) เกินนี้ ลดรูปช้าเกินไป (SimplifyModifier ช้าแบบกำลังสอง) — ข้าม แจ้งตามจริง
export const SIMPLIFY_BUDGET_MS = 6000;       // เวลารวมสูงสุดของการทำรุ่นแสดงผลเบา

export const extOf = (name) => { const m = /\.([a-z0-9]+)$/i.exec(String(name || "")); return m ? m[1].toLowerCase() : ""; };
export const baseName = (name) => String(name || "").split(/[\\/]/).pop().replace(/\.[a-z0-9]+$/i, "");

/** ไฟล์ .zip/.kmz → เลือกไฟล์โมเดลแรกตามลำดับ .dae → .skp → .obj → .glb → .gltf → .stl (ข้ามโฟลเดอร์ __MACOSX) */
export function pickZipEntry(names) {
  const ok = names.filter((n) => !/(^|\/)__MACOSX\//.test(n) && !/(^|\/)\._/.test(n));
  for (const e of ["dae", "skp", "obj", "glb", "gltf", "stl"]) { const f = ok.find((n) => extOf(n) === e); if (f) return f; }
  return null;
}

/** หน่วยจากค่า "เมตรต่อหน่วย" (เช่น <unit meter="0.0254"/> ของ COLLADA) → หน่วยที่ใกล้ที่สุด */
export function unitFromMeter(meter) {
  const v = Number(meter); if (!(v > 0)) return "m";
  return UNITS.reduce((a, b) => (Math.abs(Math.log(b.m / v)) < Math.abs(Math.log(a.m / v)) ? b : a)).k;
}
/** ข้อมูลหน่วย/แกนตั้งในไฟล์ .dae */
export function daeAsset(text) {
  const s = String(text || "").slice(0, 20000);
  const u = /<unit\b[^>]*\bmeter\s*=\s*"([^"]+)"/i.exec(s), ax = /<up_axis>\s*([XYZ]_UP)\s*<\/up_axis>/i.exec(s);
  return { meter: u ? Number(u[1]) : null, upAxis: ax ? ax[1].toUpperCase() : "Y_UP" };
}
/** เดาหน่วยจากขนาดด้านยาวสุด (ไฟล์ที่ไม่บอกหน่วย เช่น .obj .stl): ลอง ม. → มม. → ซม. → นิ้ว ตัวแรกที่ได้ขนาดของจริง 0.5–60 ม. (งานสถาปัตย์ใช้ มม. มากกว่า ซม.) */
export function guessUnit(maxRaw) {
  const v = Math.abs(Number(maxRaw) || 0); if (!v) return "m";
  for (const k of ["m", "mm", "cm", "in"]) { const L = v * unitM(k); if (L >= 0.5 && L <= 60) return k; }
  return v > 60 ? "mm" : "m";
}
/** หน่วยในไฟล์: glTF = เมตรเสมอ · .dae/.kmz = ตาม <unit> · อื่น ๆ = เดาจากขนาด → { unit, why } */
export function detectUnit({ ext, daeMeter, size }) {
  if (ext === "glb" || ext === "gltf" || ext === "skp") return { unit: "m", why: "glTF ใช้หน่วยเมตรเสมอ" };
  if ((ext === "dae" || ext === "kmz") && daeMeter > 0) { const unit = unitFromMeter(daeMeter); return { unit, why: `ไฟล์ระบุหน่วย ${unitTh(unit)}` }; }
  const mx = Math.max(...(size || [0]).map((x) => Math.abs(x) || 0));
  const unit = guessUnit(mx); return { unit, why: "ไฟล์ไม่ระบุหน่วย — เดาจากขนาด ตรวจอีกครั้ง" };
}

const r3 = (x) => Math.round(x * 1000) / 1000;
/** ขนาดดิบ [x, y(สูง), z] ในหน่วยไฟล์ → { w กว้าง, d ลึก, h สูง } เป็นเมตร */
export function sizeMeters(raw, unit) {
  const k = unitM(unit); return { w: r3(Math.abs(raw[0]) * k), d: r3(Math.abs(raw[2]) * k), h: r3(Math.abs(raw[1]) * k) };
}
const f2 = (m) => (Math.round(m * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** "กว้าง × ลึก × สูง ม." */
export const fmtSize = (s) => `${f2(s.w)} × ${f2(s.d)} × ${f2(s.h)} ม.`;
/** ขนาดเตือน: เล็ก/ใหญ่ผิดปกติ (มักเลือกหน่วยผิด) — คืนข้อความ หรือ "" */
export function sizeWarning(s) {
  const mx = Math.max(s.w, s.d, s.h);
  if (mx > 300) return "⚠ ใหญ่กว่า 300 ม. — หน่วยในไฟล์น่าจะผิด";
  if (mx > 0 && mx < 0.05) return "⚠ เล็กกว่า 5 ซม. — หน่วยในไฟล์น่าจะผิด";
  return "";
}

/** งบสามเหลี่ยม: เกิน limit = หนัก → ต้องลดเหลือประมาณ limit (keep = สัดส่วนที่เก็บไว้) */
export function triBudget(tris, limit = TRI_LIMIT) {
  const n = Math.max(0, tris | 0);
  return { tris: n, limit, heavy: n > limit, keep: n > limit ? Math.max(0.02, limit / n) : 1 };
}
/** แผนลดรูปทีละชิ้น: meshes = [{verts, tris}] → [{remove: จำนวนจุดยอดที่ลด, skip: เหตุผล}] (SimplifyModifier ลดตามจำนวนจุดยอด) */
export function planSimplify(meshes, limit = TRI_LIMIT, maxVerts = SIMPLIFY_MAX_VERTS) {
  const total = meshes.reduce((s, m) => s + (m.tris || 0), 0), b = triBudget(total, limit);
  return meshes.map((m) => {
    if (!b.heavy || (m.tris || 0) < 200) return { remove: 0, skip: b.heavy ? "เล็กอยู่แล้ว" : "" };
    if (m.verts > maxVerts) return { remove: 0, skip: "ชิ้นใหญ่เกินกว่าจะลดรูปทันเวลา" };
    return { remove: Math.floor(m.verts * (1 - b.keep)), skip: "" };
  });
}
/** ข้อความผลการลดรูป (บอกตามจริงเมื่อทำไม่ได้/ได้ไม่ถึงเป้า) */
export function simplifyNote(before, after, limit = TRI_LIMIT, timedOut = false) {
  if (before <= limit) return "";
  if (after >= before) return `⚠ โมเดลหนัก ${before.toLocaleString()} สามเหลี่ยม — ทำรุ่นแสดงผลเบาไม่ได้${timedOut ? " (เกินเวลาที่กำหนด)" : ""} ใช้ตัวเต็ม อาจหน่วงเครื่อง`;
  const pct = Math.round((1 - after / before) * 100);
  return after > limit * 1.2
    ? `⚠ ลดได้บางส่วน ${before.toLocaleString()} → ${after.toLocaleString()} สามเหลี่ยม (−${pct}%)${timedOut ? " · หมดเวลาที่กำหนด" : ""} — ยังหนักอยู่`
    : `รุ่นแสดงผลเบา ${before.toLocaleString()} → ${after.toLocaleString()} สามเหลี่ยม (−${pct}%)`;
}

/** ชิ้นส่วน items3d ชนิด "model" (ขนาดเก็บเป็น มม. ที่ตัวคูณ 1 · โมเดลจริงอยู่ใน IndexedDB/out\models ตามรหัส ref) */
export function makeModelItem(info, at = {}) {
  const mm = (m) => Math.round((Number(m) || 0) * 1000);
  return {
    id: at.id || "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), kind: "model", ref: info.ref, name: info.name || "โมเดล 3D",
    p: (at.p || [0, 0]).map((v) => Math.round(v)), z: Math.round(at.z || 0), rot: at.rot || 0, s: 1,
    w: mm(info.size.w), d: mm(info.size.d), h: mm(info.size.h), tris: info.tris || 0, src: info.src || "", unit: info.unit || "m",
  };
}
/** ป้ายชิ้น: ชื่อ · กว้าง × ลึก × สูง ม. (รวมตัวคูณ) */
export function modelLabel(it) {
  const s = Number(it.s) || 1;
  return `${it.name || "โมเดล 3D"} · ${fmtSize({ w: (it.w * s) / 1000, d: (it.d * s) / 1000, h: (it.h * s) / 1000 })}`;
}
/** มุม 4 จุดของรอยฐานในผัง (มม.) — ตามตำแหน่ง มุมหมุน ตัวคูณ */
export function footprint(it) {
  const s = Number(it.s) || 1, w = (it.w || 800) * s, d = (it.d || 800) * s, r = ((it.rot || 0) * Math.PI) / 180, c = Math.cos(r), sn = Math.sin(r);
  return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([u, v]) => [it.p[0] + u * c - v * sn, it.p[1] + u * sn + v * c]);
}

/** คลังชิ้นส่วนของฉัน (เก็บใน localStorage): เพิ่ม/แทนที่ตาม ref · ใหม่สุดก่อน · ไม่เกิน max */
export function libAdd(list, entry, max = 60) {
  const L = (Array.isArray(list) ? list : []).filter((x) => x && x.ref !== entry.ref);
  return [{ ...entry }, ...L].slice(0, max);
}
export const libRemove = (list, ref) => (Array.isArray(list) ? list : []).filter((x) => x && x.ref !== ref);
