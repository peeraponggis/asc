// คำสั่งที่ผู้ช่วย piBot เสนอได้ (แบบ ASC Studio shared/actions.json) + ตัวตรวจค่า + ตัวแปลงคำสั่งภาษาไทยในเครื่อง (โดย ลุงพี)
// ไม่มี DOM — ทดสอบด้วย node ได้ (tests/assistant.test.mjs)
//   · ทุกคำสั่งมีชนิด/ช่วงค่า/ตัวเลือกของพารามิเตอร์ — ค่าผิดชนิดหรือเกินช่วง = ทิ้งคำสั่งนั้นพร้อมบอกเหตุผล (ไม่ตัดค่าให้เอง)
//   · kind: doc = เปลี่ยนแบบ (ต้องกดยืนยัน + เลิกทำได้) · ui = เปิดหน้าต่าง/สลับมุมมอง (ต้องกดยืนยัน) · read = อ่านผลอย่างเดียว (ทำทันที ไม่เปลี่ยนอะไร)
//   · ตัวเลขในผลลัพธ์มาจากโค้ดของหน้า (window.ascaAI.run) เท่านั้น — AI ไม่คิดตัวเลขเอง
//   · คำถามขอข้อมูล (ทำไม · อย่างไร · ยังไง · คืออะไร …) ไม่แปลงเป็นคำสั่ง

const ED = ["editor"], CAD = ["cad"], HOME = ["home"], ALL = ["editor", "cad", "home"];
export const TABS = { home: "หน้าแรก", projects: "โครงการ", yield: "ผลผลิตไฟฟ้า", strings: "จัดสตริง", library: "คลังสัญลักษณ์", templates: "แม่แบบ & โปรแกรม" };
export const ROOF_TH = { none: "ไม่มีหลังคา", flat: "เรียบ", shed: "เพิง", gable: "จั่ว", hip: "ปั้นหยา", curved: "โค้ง" };
const VIEW_TH = { "2d": "2D", split: "2D+3D", "3d": "3D" };

/** แคตตาล็อกคำสั่ง — params: { ชื่อ: { type: number|string|boolean, min, max, enum, required, unit, enumFrom } } · needOne = ต้องมีอย่างน้อยหนึ่งค่า */
export const CATALOG = [
  { name: "wall.draw", pages: ED, kind: "ui", say: "เลือกเครื่องมือวาดผนัง/ห้อง (ผู้ใช้คลิกวาดเอง)", words: "วาด ผนัง กำแพง ห้อง เครื่องมือ wall room draw",
    llm: "Select the wall or room drawing tool; the user then clicks on the plan", params: { tool: { type: "string", enum: ["wall", "room"] } } },
  { name: "room.add", pages: ED, kind: "doc", say: "เพิ่มห้องสี่เหลี่ยม (ผนัง 4 ด้าน)", words: "วาด เพิ่ม ห้อง สี่เหลี่ยม กว้าง ยาว room",
    llm: "Add a rectangular room with the width/depth the user said (metres). Only numbers the user said.",
    params: { w: { type: "number", min: 0.5, max: 100, unit: "ม.", required: true }, d: { type: "number", min: 0.5, max: 100, unit: "ม.", required: true },
      x: { type: "number", min: -1000, max: 1000, unit: "ม." }, y: { type: "number", min: -1000, max: 1000, unit: "ม." } } },
  { name: "level.add", pages: ED, kind: "doc", say: "เพิ่มชั้นอาคาร", words: "เพิ่ม ชั้น ชั้นใหม่ ชั้นบน level floor storey",
    llm: "Add a building level on top (z = floor level mm, h = storey height mm)", params: { z: { type: "number", min: 0, max: 100000, unit: "มม." }, h: { type: "number", min: 2000, max: 10000, unit: "มม." } } },
  { name: "roof.set", pages: ED, kind: "doc", say: "ตั้งหลังคา", words: "หลังคา จั่ว ปั้นหยา เพิง เรียบ โค้ง ชัน องศา ชายคา roof pitch",
    llm: "Set roof type / pitch (deg) / overhang (mm)", needOne: true,
    params: { type: { type: "string", enum: ["none", "flat", "shed", "gable", "hip", "curved"] }, pitch: { type: "number", min: 0, max: 60, unit: "°" }, overhang: { type: "number", min: 0, max: 3000, unit: "มม." } } },
  { name: "struct.autoframe", pages: ED, kind: "doc", say: "สร้างเสา คาน ฐานรากจากผนัง", words: "สร้าง โครงสร้าง โครง เสา คาน ฐานราก อัตโนมัติ frame",
    llm: "Create columns, footings and beams automatically from the walls", params: {} },
  { name: "struct.check", pages: ED, kind: "read", say: "ตรวจขนาดโครงสร้างเบื้องต้น", words: "ตรวจ โครงสร้าง คาน เสา ฐานราก ผ่าน ไม่ผ่าน check",
    llm: "Run the structural size check and show the real numbers", params: {} },
  { name: "struct.open", pages: ED, kind: "ui", say: "เปิดหน้าต่างโครงสร้าง", words: "หน้าต่าง โครงสร้าง ตาราง เสา คาน", llm: "Open the structure window (levels, frame, check table)", params: {} },
  { name: "beam.resize", pages: ED, kind: "doc", say: "เปลี่ยนขนาดคาน (ทุกตัวที่มีรหัสนี้)", words: "คาน ขนาด ลึก กว้าง ขยาย beam", needOne: ["w", "d"],
    llm: "Resize every beam with this mark (w = width mm, d = depth mm)",
    params: { mark: { type: "string", required: true, pattern: "^[A-Za-z]{1,3}\\d{0,3}$" }, w: { type: "number", min: 100, max: 1000, unit: "มม." }, d: { type: "number", min: 150, max: 2000, unit: "มม." } } },
  { name: "column.resize", pages: ED, kind: "doc", say: "เปลี่ยนขนาดเสา (ทุกต้นที่มีรหัสนี้)", words: "เสา ขนาด ขยาย column", needOne: ["w", "l"],
    llm: "Resize every column with this mark (w, l = section mm)",
    params: { mark: { type: "string", required: true, pattern: "^[A-Za-z]{1,3}\\d{0,3}$" }, w: { type: "number", min: 100, max: 1500, unit: "มม." }, l: { type: "number", min: 100, max: 1500, unit: "มม." } } },
  { name: "pv.set", pages: ED, kind: "doc", say: "ตั้งแผงโซลาร์อัตโนมัติบนหลังคา", words: "แผง โซลาร์ วาง เปิด ปิด วัตต์ pv panel", needOne: true,
    llm: "Turn automatic PV panel layout on/off, or set panel watt", params: { on: { type: "boolean" }, watt: { type: "number", min: 100, max: 900, unit: "W" } } },
  { name: "solar.sld", pages: ED, kind: "ui", say: "เปิดหน้าต่าง ⚡ โซลาร์ + SLD (กดสร้าง SLD ในหน้าต่าง)", words: "โซลาร์ sld single line diagram เบรกเกอร์ สายไฟ",
    llm: "Open the solar + single line diagram window (the program computes sizes; never invent numbers)", params: {} },
  { name: "plot.open", pages: ED, kind: "ui", say: "เปิดหน้าต่าง Plot PDF", words: "plot พิมพ์ pdf กระดาษ", llm: "Open the Plot PDF dialog", params: {} },
  { name: "drawset.open", pages: ED, kind: "ui", say: "เปิดหน้าต่างชุดแบบก่อสร้าง", words: "ชุดแบบ แบบก่อสร้าง a3 ifc", llm: "Open the construction drawing set dialog", params: {} },
  { name: "view.set", pages: ED, kind: "ui", say: "สลับมุมมอง", words: "มุมมอง โหมด 3d 2d แยกจอ view",
    llm: "Switch view mode: 2d, split (2D+3D) or 3d", params: { mode: { type: "string", enum: ["2d", "split", "3d"], required: true } } },
  { name: "workflow.check", pages: ED, kind: "read", say: "ตรวจลำดับงาน", words: "ตรวจ ลำดับงาน งาน เตือน ขาด workflow", llm: "Check workflow order and data consistency warnings", params: {} },
  { name: "bom.summary", pages: ED, kind: "read", say: "สรุปวัสดุ/ปริมาณงาน", words: "สรุป วัสดุ ปริมาณ คอนกรีต เหล็ก bom", llm: "Summarise materials and quantities computed by the program", params: {} },
  { name: "undo", pages: ED, kind: "doc", say: "ย้อน 1 ขั้น (Ctrl+Z)", words: "ย้อน เลิกทำ undo", llm: "Undo the last change", params: {} },
  { name: "auto.design", pages: ED, kind: "auto", say: "ออกแบบอัตโนมัติทีละขั้น (ผัง → 3D → โครงสร้าง → โซลาร์ → ชุดแบบ)", words: "ออกแบบ อัตโนมัติ ทีละขั้น auto design",
    llm: "Start the step-by-step auto design (asks before every step)", params: {} },
  { name: "help.open", pages: ALL, kind: "ui", say: "ชี้ปุ่ม/เปิดคู่มือ", words: "คู่มือ ช่วยเหลือ ปุ่ม อยู่ไหน help",
    llm: "Point at a button / open the manual entry by help key like editor:act:plot", params: { key: { type: "string", required: true, pattern: "^(editor|cad|home):[\\w-]+:.+$" } } },
  { name: "file.open", pages: CAD, kind: "ui", say: "เปิดไฟล์ DWG/DXF/PDF", words: "เปิด ไฟล์ dwg dxf pdf open", llm: "Open the file dialog", params: {} },
  { name: "cad.command", pages: CAD, kind: "ui", say: "เริ่มคำสั่ง CAD", words: "คำสั่ง line offset trim command",
    llm: "Start a CAD command by its name (LINE, OFFSET, TRIM …)", params: { name: { type: "string", required: true, enumFrom: "commands" } } },
  { name: "tab.set", pages: HOME, kind: "ui", say: "ไปที่แท็บ", words: "แท็บ ไป หน้าแรก โครงการ ผลผลิต สตริง คลัง แม่แบบ tab",
    llm: "Switch the home page tab", params: { tab: { type: "string", enum: Object.keys(TABS), required: true } } },
];
export const spec = (name) => CATALOG.find((s) => s.name === name);

/** หน้า → กลุ่มคำสั่ง (หน้าแรกมีหลายแท็บ: home projects yield …) */
export const group = (page) => (page === "editor" || page === "cad" ? page : "home");
export const specsFor = (page) => CATALOG.filter((s) => s.pages.includes(group(page)));

// ---------------------------------------------------------------- ตรวจค่า
/**
 * รับเฉพาะคำสั่งที่มีจริงในหน้านี้ + ค่าถูกชนิด/อยู่ในช่วง/อยู่ในตัวเลือก + มีค่าที่บังคับ
 * ctx = { page, enums: { commands: [...] } } · คืน { ok: [{name, params}], dropped: ["เหตุผล"] }
 */
export function validateActions(list, ctx = {}) {
  const specs = ctx.page ? specsFor(ctx.page) : CATALOG, ok = [], dropped = [];
  for (const raw of (Array.isArray(list) ? list : []).slice(0, 6)) {
    if (!raw || typeof raw !== "object") continue;
    const nm = String(raw.name ?? raw.action ?? "").trim();
    // โมเดลเล็กบางครั้งตอบชื่อที่เห็นบนจอแทนชื่อคำสั่ง → เทียบกับคำบรรยาย
    const s = specs.find((x) => x.name === nm) || (nm.length >= 3 ? specs.find((x) => x.say === nm || x.say.startsWith(nm)) : null);
    if (!s) { dropped.push(`${nm || "?"}: ไม่มีคำสั่งนี้ในหน้านี้`); continue; }
    const given = raw.params && typeof raw.params === "object" ? raw.params : {}, params = {};
    let bad = "";
    for (const [k, p] of Object.entries(s.params || {})) {
      const v = given[k];
      if (v === undefined || v === null || v === "") { if (p.required) bad = `ต้องมีค่า ${k}`; if (bad) break; continue; }
      if (p.type === "number") {
        const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
        if (!Number.isFinite(n)) { bad = `${k} ต้องเป็นตัวเลข`; break; }
        if ((p.min !== undefined && n < p.min) || (p.max !== undefined && n > p.max)) { bad = `${k} = ${n} อยู่นอกช่วง ${p.min ?? ""}–${p.max ?? ""}${p.unit ? " " + p.unit : ""}`; break; }
        params[k] = n;
      } else if (p.type === "boolean") {
        if (v === true || v === "true" || v === 1 || v === "1" || v === "on") params[k] = true;
        else if (v === false || v === "false" || v === 0 || v === "0" || v === "off") params[k] = false;
        else { bad = `${k} ต้องเป็น true/false`; break; }
      } else {
        const t = String(v).trim().slice(0, 120);
        const list2 = p.enum || (p.enumFrom && ctx.enums && ctx.enums[p.enumFrom]);
        if (list2) {
          const hit = list2.find((e) => String(e).toLowerCase() === t.toLowerCase());
          if (!hit) { bad = `${k} = ${t} ไม่อยู่ในตัวเลือก${p.enum ? " (" + p.enum.join("|") + ")" : ""}`; break; }
          params[k] = hit;
        } else if (p.pattern && !new RegExp(p.pattern).test(t)) { bad = `${k} = ${t} รูปแบบไม่ถูก`; break; }
        else params[k] = t;
      }
    }
    if (!bad && s.needOne) {
      const keys = Array.isArray(s.needOne) ? s.needOne : Object.keys(s.params || {});
      if (!keys.some((k) => params[k] !== undefined)) bad = `ต้องระบุอย่างน้อยหนึ่งค่า (${keys.join(", ")})`;
    }
    if (bad) dropped.push(`${s.name}: ${bad}`); else ok.push({ name: s.name, params });
  }
  return { ok, dropped };
}

/** คำสั่งที่เกี่ยวกับคำถาม (ไม่เกิน max) — prompt สั้น โมเดลเล็กตอบทัน · ลำดับ: คำตรงกับคำในคำถาม → คำสั่งหลักของหน้า */
const CORE = { editor: ["struct.check", "workflow.check", "room.add", "roof.set", "view.set", "auto.design"], cad: ["file.open", "cad.command"], home: ["tab.set"] };
export function relevantActions(q, page, max = 8) {
  const specs = specsFor(page), qn = String(q).toLowerCase(), picked = [];
  const score = (s) => `${s.name.replace(/[._]/g, " ")} ${s.words} ${s.say}`.toLowerCase().split(/[\s()·,/+]+/).filter((w) => w.length > 1 && qn.includes(w)).length;
  const add = (s) => { if (s && picked.length < max && !picked.includes(s)) picked.push(s); };
  specs.map((s) => [score(s), s]).filter(([n]) => n > 0).sort((a, b) => b[0] - a[0]).forEach(([, s]) => add(s));
  for (const n of CORE[group(page)] || []) add(specs.find((s) => s.name === n));
  return picked;
}
/** รายการคำสั่งแบบย่อสำหรับโมเดล: ชื่อ(พารามิเตอร์:ชนิด[ช่วง]|ตัวเลือก) — คำอธิบาย */
export function actionCatalog(specs) {
  return specs.map((a) => {
    const ps = Object.entries(a.params || {}).map(([k, p]) => `${k}${p.required ? "*" : ""}:${p.enum ? p.enum.join("|") : p.type}${p.min !== undefined || p.max !== undefined ? `[${p.min ?? ""}..${p.max ?? ""}]` : ""}${p.unit || ""}`).join(", ");
    return `- ${a.name}(${ps}) — ${a.llm}`;
  }).join("\n");
}

/** คำอธิบายคำสั่งเป็นภาษาคน (บนการ์ด) */
export function describe(a) {
  if (!a) return "";
  if (a.tool === "press") return `กดปุ่ม ${a.label || a.key}`;
  if (a.tool === "set") return `ตั้งค่า ${a.label || a.id}`;
  const s = spec(a.name), p = a.params || {};
  if (!s) return a.name;
  switch (a.name) {
    case "room.add": return `เพิ่มห้อง ${p.w} × ${p.d} ม.${p.x != null || p.y != null ? ` ที่มุม (${p.x ?? 0}, ${p.y ?? 0}) ม.` : " (ต่อจากผนังเดิมทางขวา)"}`;
    case "wall.draw": return p.tool === "room" ? "เลือกเครื่องมือห้อง (คลิก 2 มุมในผัง)" : "เลือกเครื่องมือผนัง (คลิกจุดในผัง)";
    case "roof.set": return "ตั้งหลังคา: " + [p.type && ROOF_TH[p.type], p.pitch != null && `ชัน ${p.pitch}°`, p.overhang != null && `ชายคา ${p.overhang} มม.`].filter(Boolean).join(" · ");
    case "beam.resize": return `คาน ${p.mark}: ` + [p.w != null && `กว้าง ${p.w}`, p.d != null && `ลึก ${p.d}`].filter(Boolean).join(" · ") + " มม.";
    case "column.resize": return `เสา ${p.mark}: ` + [p.w != null && `${p.w}`, p.l != null && `${p.l}`].filter(Boolean).join(" × ") + " มม.";
    case "level.add": return "เพิ่มชั้น" + (p.z != null ? ` ที่ระดับ ${p.z} มม.` : " บนชั้นบนสุด") + (p.h != null ? ` สูง ${p.h} มม.` : "");
    case "pv.set": return [p.on === true && "เปิดวางแผงโซลาร์อัตโนมัติ", p.on === false && "ปิดแผงโซลาร์", p.watt != null && `แผง ${p.watt} W`].filter(Boolean).join(" · ");
    case "view.set": return `มุมมอง ${VIEW_TH[p.mode] || p.mode}`;
    case "tab.set": return `ไปแท็บ ${TABS[p.tab] || p.tab}`;
    case "cad.command": return `เริ่มคำสั่ง ${String(p.name).toUpperCase()}`;
    case "help.open": return `ชี้ปุ่ม/คู่มือ ${p.key}`;
    default: return s.say;
  }
}

// ---------------------------------------------------------------- คำถามขอข้อมูล · ภาษา · ที่มาของคำตอบ
/** คำถามขอข้อมูล — ตอบอย่างเดียว ไม่เสนอการ์ดคำสั่ง · "ช่วย…ได้ไหม" ยังเป็นคำสั่ง */
export const isInfoQuestion = (q) => /ทำไม|อย่างไร|ยังไง|คืออะไร|อะไร|ที่ไหน|ตรงไหน|อยู่ไหน|เท่าไร|เท่าไหร่|แบบไหน|หมายถึง|ແນວໃດ|ເປັນຫຍັງ|ແມ່ນຫຍັງ|ຢູ່ໃສ|\b(how|why|what|where|which|explain)\b/i.test(String(q));

/** ภาษาของคำถาม: lo (อักษรลาว) · th (อักษรไทย) · en (ตัวอักษรละติน) · ไม่มีตัวอักษร = th */
export function detectLang(q) {
  const s = String(q), th = (s.match(/[฀-๿]/g) || []).length, lo = (s.match(/[຀-໿]/g) || []).length, en = (s.match(/[A-Za-z]/g) || []).length;
  if (lo && lo >= th) return "lo";
  if (th) return "th";
  return en >= 2 ? "en" : "th";
}
/** คำตอบผิดภาษา (ใช้ขอให้แปลซ้ำ) */
export function wrongLang(say, lang = "th") {
  const s = String(say), th = (s.match(/[฀-๿]/g) || []).length, lo = (s.match(/[຀-໿]/g) || []).length, en = (s.match(/[A-Za-z]/g) || []).length;
  const n = s.replace(/\s/g, "").length || 1;
  if (lang === "en") return (th + lo) / n > 0.2;
  if (lang === "lo") return th > lo;
  return lo > th || (th === 0 && en / n > 0.5 && n > 12);                    // ไทย: ตอบเป็นลาว หรือเป็นอังกฤษล้วน
}
export const LANG_RULE = {
  th: "ตอบเป็นภาษาไทย",
  lo: 'ข้อความ answer ต้องเป็นภาษาลาว (ພາສາລາວ) เพราะผู้ใช้ถามเป็นภาษาลาว · ความรู้เป็นภาษาไทย ให้แปลเป็นภาษาลาว · ไม่พบ = "ບໍ່ພົບໃນຄູ່ມື"',
  en: 'The "answer" MUST be in English because the user asked in English · the knowledge is in Thai: translate it · not found = "Not found in the manual"',
};
export const LANG_TAIL = { th: "", lo: "\n\n(ຕອບ answer ເປັນພາສາລາວເທົ່ານັ້ນ)", en: "\n\n(Write the answer in English only. Do not answer in Thai.)" };
export const saysNotFound = (s) => /ไม่พบในคู่มือ|ບໍ່ພົບໃນຄູ່ມື|not (found )?in the manual/i.test(String(s));

/** ตัวเลขในคำตอบที่ตรงกับตัวเลขในข้อมูลงาน (สถานะหน้า/ผลตรวจ) — ใช้บอกว่าคำตอบใช้ข้อมูลในงานจริง */
export function usedNumbers(answer, context) {
  const nums = (s) => (String(s).match(/\d[\d,]*(?:\.\d+)?/g) || []).map((x) => x.replace(/,/g, "")).filter((x) => x.length >= 2 || Number(x) >= 2);
  const ctx = new Set(nums(context));
  return nums(answer).some((n) => ctx.has(n));
}
/** ป้ายที่มา — คิดจากสิ่งที่ใช้จริง ไม่ให้โมเดลบอกเอง
 *  kb = ใช้ชิ้นความรู้ที่ค้นได้จริง · data = ตัวเลข/ผลตรวจ/คำสั่งจากงานที่เปิดอยู่ · llm ตอบโดยไม่ใช้ทั้งสอง = ความรู้ทั่วไป · ไม่พบในคู่มือ = ไม่มีป้าย */
export const BADGE = { kb: "📚 คลัง", data: "🗂️ ข้อมูลในงาน", general: "🌐 ความรู้ทั่วไป" };
export function answerSource({ kb = false, data = false, llm = false, notFound = false } = {}) {
  const out = [];
  if (kb) out.push("kb");
  if (data) out.push("data");
  if (!out.length && llm && !notFound) out.push("general");
  return out;
}

// ---------------------------------------------------------------- ตัวแปลงคำสั่งในเครื่อง (ไม่ใช้ AI)
const TH_DIGITS = "๐๑๒๓๔๕๖๗๘๙", LO_DIGITS = "໐໑໒໓໔໕໖໗໘໙";
export function normalize(t) {
  return String(t).toLowerCase()
    .replace(/[๐-๙]/g, (c) => String(TH_DIGITS.indexOf(c))).replace(/[໐-໙]/g, (c) => String(LO_DIGITS.indexOf(c)))
    .replace(/(\d),(\d{3})\b/g, "$1$2").replace(/[×✕*]/g, " x ").replace(/คูณ|\bby\b/g, " x ")
    .replace(/(\d)\s*x\s*(\d)/g, "$1 x $2").replace(/\s+/g, " ").trim();
}
/** ความยาว → เมตร (ตามหน่วยที่พิมพ์ · ไม่มีหน่วย: ≥ 100 ถือเป็น มม.) */
const toM = (v, u) => (/มม|mm/.test(u || "") ? v / 1000 : /ซม|cm/.test(u || "") ? v / 100 : /ม|m/.test(u || "") ? v : v >= 100 ? v / 1000 : v);
/** ขนาดหน้าตัด → มม. (ไม่มีหน่วย: < 100 ถือเป็น ซม. แบบที่ช่างพูด "คาน 20x50") */
const toMM = (v, u) => (/มม|mm/.test(u || "") ? v : /ซม|cm/.test(u || "") ? v * 10 : /ม\.?$|^m$/.test(u || "") ? v * 1000 : v < 100 ? v * 10 : v);
const UNIT = "(มม\\.?|ซม\\.?|เมตร|ม\\.?|mm|cm|m)?";
const NUM = "(\\d+(?:\\.\\d+)?)";
const round = (v, n = 3) => Math.round(v * 10 ** n) / 10 ** n;

/** ข้อความ → [{name, params}] หรือ null (ไม่ใช่คำสั่งที่รู้จัก) · page = หน้าปัจจุบัน */
export function routeLocal(text, page = "editor") {
  if (isInfoQuestion(text)) return null;
  const s = normalize(text), g = group(page), out = [];
  if (g === "cad") {
    if (/เปิดไฟล์|open file|^เปิด\s*(dwg|dxf|pdf)/.test(s)) return [{ name: "file.open", params: {} }];
    const m = s.match(/^(?:คำสั่ง|สั่ง|รัน|run|ใช้คำสั่ง)?\s*([a-z]{1,12})$/);
    return m ? [{ name: "cad.command", params: { name: m[1].toUpperCase() } }] : null;
  }
  if (g === "home") {
    const T = [["projects", /โครงการ|project/], ["yield", /ผลผลิต|yield/], ["strings", /สตริง|string/], ["library", /คลัง|library/], ["templates", /แม่แบบ|template/], ["home", /หน้าแรก|home/]];
    if (!/ไป|เปิด|แท็บ|tab|go/.test(s)) return null;
    const t = T.find(([, re]) => re.test(s));
    return t ? [{ name: "tab.set", params: { tab: t[0] } }] : null;
  }
  // ---- ตัวเขียนแบบ
  if (/ออกแบบ(ให้|อัตโนมัติ)|ออกแบบทีละขั้น|auto.?design|design (it )?for me/.test(s)) return [{ name: "auto.design", params: {} }];
  if (/^(ย้อน|เลิกทำ|undo|ยกเลิกล่าสุด|ย้อนกลับ)/.test(s)) return [{ name: "undo", params: {} }];

  // ห้อง 4x5 · ห้องกว้าง 4 ยาว 5
  const room = s.match(new RegExp(`(?:ห้อง|room)\\D{0,16}?${NUM}\\s*${UNIT}\\s*x\\s*${NUM}\\s*${UNIT}`)) ||
    s.match(new RegExp(`(?:ห้อง|room).{0,8}กว้าง\\s*${NUM}\\s*${UNIT}.{0,6}(?:ยาว|ลึก)\\s*${NUM}\\s*${UNIT}`));
  if (room) {
    const u2 = room[4] || room[2];
    out.push({ name: "room.add", params: { w: round(toM(Number(room[1]), room[2] || u2)), d: round(toM(Number(room[3]), u2)) } });
  } else if (/(วาด|เขียน|draw).{0,8}(ผนัง|กำแพง|wall)/.test(s)) out.push({ name: "wall.draw", params: { tool: "wall" } });
  else if (/(วาด|เขียน|เพิ่ม|draw).{0,8}(ห้อง|room)/.test(s)) out.push({ name: "wall.draw", params: { tool: "room" } });

  // คาน B1 20x50 · เสา C1 25x25 (ก่อนสร้างโครง เพราะมีคำ เสา/คาน)
  const rs = s.match(new RegExp(`(คาน|beam|เสา|column)\\s*([a-z]{1,3}\\d{0,3})\\b\\D{0,20}?${NUM}\\s*${UNIT}\\s*x\\s*${NUM}\\s*${UNIT}`));
  const rd = !rs && s.match(new RegExp(`(คาน|beam)\\s*([a-z]{1,3}\\d{0,3})\\b.{0,12}?(?:ลึก|สูง|depth)\\s*${NUM}\\s*${UNIT}`));
  if (rs) {
    const beam = /คาน|beam/.test(rs[1]), u = rs[6] || rs[4];
    const a = round(toMM(Number(rs[3]), rs[4] || u), 0), b = round(toMM(Number(rs[5]), u), 0);
    out.push(beam ? { name: "beam.resize", params: { mark: rs[2].toUpperCase(), w: a, d: b } } : { name: "column.resize", params: { mark: rs[2].toUpperCase(), w: a, l: b } });
  } else if (rd) out.push({ name: "beam.resize", params: { mark: rd[2].toUpperCase(), d: round(toMM(Number(rd[3]), rd[4]), 0) } });
  else if (/(สร้าง|วาง|ใส่|เพิ่ม|ทำ).{0,10}(โครงสร้าง|โครง|เสา|คาน|ฐานราก)/.test(s) && !/หน้าต่าง/.test(s)) out.push({ name: "struct.autoframe", params: {} });

  if (/เพิ่มชั้น|ชั้นใหม่|ต่อเติมชั้น|add (a )?(floor|level|storey)/.test(s)) {
    const h = s.match(new RegExp(`(?:สูง|height)\\s*${NUM}\\s*${UNIT}`));
    out.push({ name: "level.add", params: h ? { h: round(toM(Number(h[1]), h[2]) * 1000, 0) } : {} });
  }
  if (/ตรวจ.{0,8}(โครงสร้าง|คาน|เสา|ฐานราก)|check struct/.test(s)) out.push({ name: "struct.check", params: {} });
  else if (/ตรวจ(งาน|ลำดับ|แบบ)|^ตรวจ$|check (work|plan)/.test(s)) out.push({ name: "workflow.check", params: {} });
  if (/(เปิด|ดู).{0,6}(หน้าต่าง)?\s*โครงสร้าง$|หน้าต่างโครงสร้าง/.test(s) && !out.some((a) => a.name === "struct.autoframe")) out.push({ name: "struct.open", params: {} });

  // มุมมอง
  const V = "(โหมด|มุมมอง|เปิด|ดู|สลับ|view|ไป).{0,8}";
  if (/^(2d\s*\+\s*3d|split)$/.test(s) || new RegExp(V + "(2d\\s*\\+\\s*3d|แยกจอ|split|สองจอ)").test(s)) out.push({ name: "view.set", params: { mode: "split" } });
  else if (/^3d$/.test(s) || new RegExp(V + "(3d|3 มิติ|สามมิติ)").test(s)) out.push({ name: "view.set", params: { mode: "3d" } });
  else if (/^2d$/.test(s) || new RegExp(V + "(2d|2 มิติ|ผังอย่างเดียว)").test(s)) out.push({ name: "view.set", params: { mode: "2d" } });

  // หลังคา
  const type = /ไม่มีหลังคา|ลบหลังคา|เอาหลังคาออก|no roof/.test(s) ? "none" : /ปั้นหยา|\bhip\b/.test(s) ? "hip" : /จั่ว|gable/.test(s) ? "gable" : /เพิง|\bshed\b/.test(s) ? "shed"
    : /หลังคา.{0,6}(แบน|เรียบ|ดาดฟ้า)|flat roof/.test(s) ? "flat" : /หลังคา.{0,6}โค้ง|curved/.test(s) ? "curved" : undefined;
  const roofy = type || /หลังคา|roof/.test(s);
  if (roofy) {
    const p = {};
    if (type) p.type = type;
    const pi = s.match(new RegExp(`${NUM}\\s*(?:องศา|°|deg)`)) || s.match(new RegExp(`(?:ชัน|ลาด|เอียง|pitch)\\D{0,8}${NUM}`));
    if (pi) p.pitch = Number(pi[1]);
    const ov = s.match(new RegExp(`(?:ชายคา|overhang)\\D{0,10}${NUM}\\s*${UNIT}`));
    if (ov) p.overhang = round(toM(Number(ov[1]), ov[2] || (Number(ov[1]) < 10 ? "ม" : "มม")) * 1000, 0);
    if (Object.keys(p).length) out.push({ name: "roof.set", params: p });
  }
  // แผงโซลาร์ / SLD
  let pv = null;
  if (/(^|[^เ])ปิด.{0,6}แผง|(เอา|ลบ).{0,8}แผง.{0,10}ออก|ลบแผง|ไม่เอาแผง/.test(s)) pv = { on: false };
  else if (/(เปิด|วาง|ใส่|เพิ่ม|ติด).{0,6}แผง/.test(s)) pv = { on: true };
  const wt = s.match(/แผง.{0,10}?(\d{3})\s*(?:w|วัตต์|watt)|(\d{3})\s*(?:w|วัตต์|watt)/);
  if (wt) pv = { ...(pv || {}), watt: Number(wt[1] || wt[2]) };
  if (pv) out.push({ name: "pv.set", params: pv });
  else if (/\bsld\b|single ?line|ไดอะแกรม|(เปิด|ทำ|สร้าง).{0,6}โซลาร์/.test(s)) out.push({ name: "solar.sld", params: {} });
  if (/\bplot\b|พล็อต|พลอต|พิมพ์\s*(pdf|แบบ)/.test(s)) out.push({ name: "plot.open", params: {} });
  if (/ชุดแบบ/.test(s)) out.push({ name: "drawset.open", params: {} });
  if (/สรุปวัสดุ|\bbom\b|ปริมาณ(วัสดุ|งาน)|ถอดแบบ|ถอดปริมาณ/.test(s)) out.push({ name: "bom.summary", params: {} });
  return out.length ? out : null;
}
