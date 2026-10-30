// ฟอร์ม Plot PDF ใช้ร่วม CAD 2D + ตัวเขียนแบบ: กระดาษ · มาตราส่วน · พื้นที่ · ขาวดำ · ช่องกรอบชื่อ (โดย ลุงพี)
const KEY = "pa-plot";
export const PAPERS = ["A4", "A3", "A2", "A1", "A0"];
export const SCALES = [0, 20, 50, 75, 100, 150, 200, 250, 500, 1000];
const FIELDS = [
  ["DWG_TITLE", "ชื่อแบบ"], ["DWG_NO", "เลขที่แบบ"], ["PAGE", "หน้า"],
  ["PROJECT1", "โครงการ บรรทัด 1"], ["PROJECT2", "โครงการ บรรทัด 2"], ["PROJECT3", "โครงการ บรรทัด 3"],
  ["CUSTOMER1", "ลูกค้า/เจ้าของ"], ["CUSTOMER2", "ที่อยู่ลูกค้า"], ["SITE", "สถานที่ติดตั้ง"], ["LOCATION", "พิกัด"],
  ["DESIGNER1", "ผู้ออกแบบ/ผู้รับเหมา"], ["ENG_NAME", "วิศวกรไฟฟ้า"], ["ENG_LICENSE", "เลข ภฟก."], ["NOTE", "หมายเหตุ"],
];
const STATUS = ["FOR PRELIMINARY", "FOR PERMISSION", "FOR CONSTRUCTION", "FOR ASBUILT"];

function saved() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } }
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** HTML ของฟอร์ม · areas = [[ค่า, ป้าย], …] (ว่าง = ไม่มีตัวเลือกพื้นที่) · defs = ค่าตั้งต้นของช่องกรอบชื่อ */
export function plotFormHTML(areas, defs) {
  const s = saved(), f = { ...(defs || {}), ...(s.fields || {}) };
  if (defs && defs.DWG_TITLE) f.DWG_TITLE = defs.DWG_TITLE;          // ชื่อแบบตามไฟล์ที่เปิดอยู่เสมอ
  const opt = (v, t, cur) => `<option value="${v}"${String(v) === String(cur) ? " selected" : ""}>${t}</option>`;
  return `<div class="pform">
  <label>กระดาษ<select id="pl-paper">${PAPERS.map((p) => opt(p, p + " แนวนอน", s.paper || "A3")).join("")}</select></label>
  <label>มาตราส่วน<select id="pl-scale">${SCALES.map((n) => opt(n, n ? `1:${n}` : "พอดีกระดาษ", s.scale ?? 0)).join("")}<option value="c">กำหนดเอง…</option></select></label>
  <label>1 : <input type="number" id="pl-custom" min="1" step="any" value="${esc(s.custom || 100)}" disabled></label>
  ${areas && areas.length ? `<label>พื้นที่<select id="pl-area">${areas.map(([v, t]) => opt(v, t, s.area || areas[0][0])).join("")}</select></label>` : ""}
  <label class="chk"><input type="checkbox" id="pl-mono"${s.mono === false ? "" : " checked"}> ขาวดำ (เส้นดำทั้งหมด)</label>
  <label>สถานะแบบ<select id="pl-status">${opt("", "—", s.status || "")}${STATUS.map((t, i) => opt(i + 1, t, s.status || "")).join("")}</select></label>
  </div>
  <details class="pfields"><summary>ช่องกรอบชื่อ (จำค่าไว้ครั้งหน้า)</summary><div class="pform">
  ${FIELDS.map(([k, t]) => `<label>${t}<input type="text" data-f="${k}" value="${esc(f[k] || "")}"></label>`).join("")}
  </div></details>`;
}

/** ผูกตัวเลือก "กำหนดเอง" กับช่องตัวเลข */
export function wirePlotForm(root) {
  const sc = root.querySelector("#pl-scale"), cu = root.querySelector("#pl-custom");
  const s = saved();
  if (s.scale === "c") sc.value = "c";
  const upd = () => (cu.disabled = sc.value !== "c");
  sc.onchange = upd; upd();
}

/** อ่านฟอร์ม → {paper, scale (null = พอดี), area, mono, fields} และจำค่าไว้ */
export function readPlotForm(root) {
  const v = (id) => root.querySelector(id)?.value;
  const scSel = v("#pl-scale"), custom = parseFloat(v("#pl-custom"));
  const scale = scSel === "c" ? (custom > 0 ? custom : null) : Number(scSel) || null;
  const fields = {};
  root.querySelectorAll("[data-f]").forEach((i) => { if (i.value.trim()) fields[i.dataset.f] = i.value.trim(); });
  const st = v("#pl-status");
  const out = { paper: v("#pl-paper"), scale, area: v("#pl-area") || "all", mono: root.querySelector("#pl-mono").checked, fields: { ...fields } };
  if (st) out.fields["ST" + st] = "X";
  try {
    const keep = { ...fields }; delete keep.DWG_TITLE; delete keep.DWG_NO; delete keep.PAGE;
    localStorage.setItem(KEY, JSON.stringify({ paper: out.paper, scale: scSel === "c" ? "c" : scale || 0, custom, area: v("#pl-area") || saved().area, mono: out.mono, status: st, fields: keep }));
  } catch { /* โหมดส่วนตัว — ไม่จำก็ได้ */ }
  return out;
}
