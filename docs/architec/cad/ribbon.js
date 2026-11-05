// เมนูแบบ Ribbon + แถบเครื่องมือลอย + คลังสัญลักษณ์ + ตั้งค่าเมาส์ ของหน้า CAD 2D (โดย ลุงพี)
// ปุ่มคำสั่งใช้ data-cmd (app.js รันเอง) · ปุ่มสัญลักษณ์ data-sym · ปุ่มหน้าตา data-ui · จำค่าใน localStorage (ascaCad.*)
import { CATS, SYMS, LIB_CAT, LIB_PAPER, symSVG } from "./symbols.js?v=0.31.0";

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const store = {
  get(k, d) { try { const v = localStorage.getItem("ascaCad." + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("ascaCad." + k, JSON.stringify(v)); } catch { /* เบราว์เซอร์ไม่ให้เก็บ */ } },
};

// ------------------------------------------------------------------ ไอคอน (เส้น 24×24 สีตามตัวอักษร)
const IC = {
  LINE: '<path d="M4 20L20 4"/><circle cx="4" cy="20" r="1.6"/><circle cx="20" cy="4" r="1.6"/>', PLINE: '<path d="M3 18l5-9 6 6 7-11"/>',
  RECTANG: '<rect x="4" y="6" width="16" height="12"/>', CIRCLE: '<circle cx="12" cy="12" r="8"/><path d="M12 12h8"/>',
  ARC: '<path d="M4 18A10 10 0 0 1 20 10"/><circle cx="4" cy="18" r="1.4"/><circle cx="20" cy="10" r="1.4"/>', TEXT: '<path d="M5 5h14M12 5v14M9 19h6"/>',
  HATCH: '<rect x="4" y="4" width="16" height="16"/><path d="M4 12l8-8M4 20L20 4M12 20l8-8"/>',
  MOVE: '<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>', COPY: '<rect x="8" y="8" width="12" height="12"/><path d="M16 8V4H4v12h4"/>',
  ROTATE: '<path d="M20 12a8 8 0 1 1-3-6.2"/><path d="M17 2v4h4"/>', SCALE: '<rect x="3" y="11" width="10" height="10"/><path d="M13 11l8-8M15 3h6v6"/>',
  MIRROR: '<path d="M12 3v18" stroke-dasharray="2 2"/><path d="M9 6L3 18h6zM15 6l6 12h-6z"/>', OFFSET: '<path d="M4 16L16 4M8 20L20 8"/>',
  TRIM: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8 7.5L20 18M8 16.5L20 6"/>', EXTEND: '<path d="M3 12h12M20 4v16M12 9l3 3-3 3"/>',
  FILLET: '<path d="M4 4v8a8 8 0 0 0 8 8h8"/>', ARRAY: '<rect x="3" y="3" width="6" height="6"/><rect x="15" y="3" width="6" height="6"/><rect x="3" y="15" width="6" height="6"/><rect x="15" y="15" width="6" height="6"/>',
  EXPLODE: '<path d="M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/>', ERASE: '<path d="M4 16l9-9 6 6-6 6H8z"/><path d="M13 19h7"/>',
  DIMLINEAR: '<path d="M4 6v12M20 6v12M4 12h16M4 12l3-2M4 12l3 2M20 12l-3-2M20 12l-3 2"/>', DIMALIGNED: '<path d="M4 16L16 4M7 19L19 7M7 19l1-4M7 19l4-1M19 7l-4 1M19 7l-1 4"/>',
  BLOCK: '<rect x="4" y="4" width="16" height="16"/><path d="M4 9h16M9 4v16"/>', INSERT: '<rect x="3" y="9" width="12" height="12"/><path d="M14 3h7v7M21 3l-9 9"/>',
  DIST: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>', AREA: '<path d="M4 18l3-12 13 3-4 11z"/><path d="M8 14h6" stroke-dasharray="2 2"/>',
  ID: '<circle cx="12" cy="12" r="2"/><path d="M12 3v5M12 16v5M3 12h5M16 12h5"/>', CAL: '<path d="M3 20h18M3 20V8M21 20V8M7 16h10"/><path d="M7 16l2-2M7 16l2 2M17 16l-2-2M17 16l-2 2"/>',
  MATCHPROP: '<path d="M14 4l6 6-9 9H5v-6z"/><path d="M12 6l6 6"/>', WIRE: '<path d="M3 17h7V7h11"/><circle cx="3" cy="17" r="1.6"/><circle cx="21" cy="7" r="1.6"/>',
  NEW: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>', OPEN: '<path d="M3 7h6l2 2h10v11H3z"/>', SAVE: '<path d="M5 3h12l3 3v15H5z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',
  SAVEAS: '<path d="M5 3h10l3 3v6M5 3v18h7"/><path d="M8 3v5h7V3M15 15l3 3 3-3M18 11v7"/>', PLOT: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8"/><path d="M7 14h10v7H7z"/>',
  PARTIAL: '<rect x="3" y="3" width="18" height="18" stroke-dasharray="3 2"/><rect x="8" y="8" width="8" height="8"/>',
  U: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-4"/>', REDO: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h4"/>',
  ZE: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><rect x="8" y="8" width="8" height="8"/>', LAYER: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  PASTE: '<rect x="5" y="4" width="14" height="17"/><rect x="9" y="2" width="6" height="4"/>', CUTCLIP: '<circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><path d="M8 16L18 3M16 16L6 3"/>',
  COPYCLIP: '<rect x="8" y="8" width="12" height="12"/><path d="M16 8V4H4v12h4"/>', SELALL: '<rect x="3" y="3" width="18" height="18" stroke-dasharray="3 2"/><path d="M8 12l3 3 5-6"/>',
  OSNAP: '<rect x="8" y="8" width="8" height="8"/><path d="M3 3l5 5M21 21l-5-5"/>', ORTHO: '<path d="M5 4v15h15"/><path d="M5 15h4v4"/>',
  catalog: '<rect x="3" y="3" width="7" height="7"/><circle cx="17" cy="6.5" r="3.5"/><path d="M3 21l3.5-7 3.5 7z"/><rect x="14" y="14" width="7" height="7"/>',
  mouse: '<rect x="6" y="3" width="12" height="18" rx="6"/><path d="M12 3v6"/>', keys: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  reset: '<path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M7 2v4H3"/>', icons: '<rect x="3" y="12" width="7" height="7"/><rect x="12" y="4" width="9" height="15"/>',
  ribbon: '<rect x="3" y="4" width="18" height="5"/><rect x="3" y="12" width="8" height="8"/><path d="M14 13h7M14 17h7"/>',
  WALL: '<path d="M3 7h15v13M3 11h11v9"/>', ROOM: '<rect x="3" y="3" width="18" height="18"/><path d="M7 11h10M7 15h6"/>', POLYGON: '<path d="M12 3l8 6-3 10H7L4 9z"/>',
  BUS: '<path d="M3 9h18" stroke-width="4"/><path d="M7 9v11M12 9v11M17 9v11"/>', DOT: '<path d="M3 12h18M12 12v9"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/>',
  PIPE: '<path d="M3 9h18M3 15h18"/><path d="M8 7v10M16 7v10"/>', DUCT: '<rect x="3" y="7" width="18" height="10"/><path d="M3 12h18" stroke-dasharray="4 2 1 2"/>',
  TAG: '<path d="M3 12V4h8l10 10-7 7z"/><circle cx="7.5" cy="8.5" r="1.4"/>', AUTONUM: '<path d="M4 7l2-1v11M3 17h6M13 9a3 3 0 1 1 5 2.2L13 17h6"/>',
  BOM: '<rect x="4" y="3" width="16" height="18"/><path d="M8 8h8M8 12h8M8 16h5"/>', SENSLIST: '<rect x="3" y="5" width="18" height="14"/><path d="M3 10h18M3 14.5h18M9 5v14"/><circle cx="17" cy="7.5" r="1" fill="currentColor"/>',
  GRID: '<path d="M3 8h18M3 16h18M8 3v18M16 3v18"/>', LEADER: '<path d="M4 20l8-8h8M4 20l1-4M4 20l4-1"/>', TABLE: '<rect x="3" y="4" width="18" height="16"/><path d="M3 9h18M3 14h18M10 4v16"/>',
  ZIN: '<circle cx="10" cy="10" r="6"/><path d="M15 15l6 6M7 10h6M10 7v6"/>', ZOUT: '<circle cx="10" cy="10" r="6"/><path d="M15 15l6 6M7 10h6"/>',
  select: '<path d="M6 3l11 8-5 1 3 7-2 1-3-7-4 4z"/>', mylib: '<path d="M4 4h6v16H4zM10 4h5v16h-5zM15 5l4-1 2 15-4 1z"/>', SNAP: '<circle cx="12" cy="12" r="3"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/>',
  theme: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor"/>', import: '<path d="M12 3v12M8 11l4 4 4-4"/><path d="M4 17v4h16v-4"/>',
  PSIG: '<path d="M3 12h18" stroke-dasharray="4 2.5"/><circle cx="3" cy="12" r="1.5"/><circle cx="21" cy="12" r="1.5"/>',
  PWL: '<path d="M3 19h18" stroke-dasharray=".5 3.4"/><path d="M7 10a7 7 0 0 1 10 0M9.5 12.8a3.5 3.5 0 0 1 5 0"/><circle cx="12" cy="15.4" r=".9" fill="currentColor"/>',
};
// ท่อตามชนิด: เส้น (ประตามชนิด) + ตัวย่อ
const PIPEIC = { PCW: ["CW", "5 2"], PHW: ["HW", "5 1.5 1 1.5"], PS: ["S", ""], PW: ["W", ""], PV: ["V", "1.8 1.4"], PRD: ["RD", "4 1 .8 1"] };
for (const [k, [lab, dash]] of Object.entries(PIPEIC)) IC[k] = `<path d="M2 18h20"${dash ? ` stroke-dasharray="${dash}"` : ""}${k === "PS" ? ' stroke-width="2.6"' : ""}/><text x="12" y="12" font-size="${lab.length > 1 ? 9 : 11}" text-anchor="middle" fill="currentColor" stroke="none" font-family="Consolas, monospace">${lab}</text>`;
const icon = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${IC[n] || IC.ID}</svg>`;

// ------------------------------------------------------------------ ชื่อปุ่ม (คำสั่งเดิมของหน้า CAD 2D) + คำสั่งหน้าตา
const LABEL = {
  LINE: "เส้น", PLINE: "โพลีไลน์", RECTANG: "สี่เหลี่ยม", CIRCLE: "วงกลม", ARC: "โค้ง 3 จุด", TEXT: "ข้อความ", HATCH: "แรเงา",
  MOVE: "ย้าย", COPY: "คัดลอกวาง", ROTATE: "หมุน", SCALE: "ย่อขยาย", MIRROR: "สะท้อน", ERASE: "ลบ", OFFSET: "Offset", TRIM: "ตัดเส้น", EXTEND: "ยืดเส้น",
  FILLET: "Fillet", ARRAY: "Array", EXPLODE: "แตกชิ้น", DIMLINEAR: "มิติ", DIMALIGNED: "มิติเอียง", BLOCK: "สร้าง Block", INSERT: "แทรก Block",
  DIST: "วัดระยะ", AREA: "พื้นที่", ID: "พิกัดจุด", CAL: "ตั้งระยะ", MATCHPROP: "Match", WIRE: "สายไฟ", NEW: "ใหม่", OPEN: "เปิด", SAVE: "บันทึก", SAVEAS: "บันทึกเป็น…",
  PLOT: "Plot PDF", PARTIAL: "แก้บางส่วน", U: "ย้อน", REDO: "ทำซ้ำ", ZE: "ดูทั้งหมด", LAYER: "Layer ใหม่", PASTE: "วาง", CUTCLIP: "ตัด", COPYCLIP: "คัดลอก", SELALL: "เลือกทั้งหมด",
  OSNAP: "จับจุด", ORTHO: "ล็อกแนวฉาก", GRID: "กริด", SNAP: "จับกริด", LEADER: "ป้ายชี้", TABLE: "ตาราง", ZIN: "ซูมเข้า", ZOUT: "ซูมออก",
  WALL: "ผนัง", ROOM: "ป้ายห้อง", POLYGON: "หลายเหลี่ยม", BUS: "บัสบาร์", DOT: "จุดต่อสาย", PIPE: "ท่อ", DUCT: "ท่อลม", TAG: "ชื่ออุปกรณ์", AUTONUM: "เรียงเลข",
  BOM: "ตาราง BOM", SENSLIST: "ตารางจุดวัด", PCW: "ท่อ CW", PHW: "ท่อ HW", PS: "ท่อ S", PW: "ท่อ W", PV: "ท่อ V", PRD: "ท่อ RD", PSIG: "สายสัญญาณ", PWL: "สัญญาณไร้สาย",
};
const KEY = { LINE: "L", PLINE: "PL", RECTANG: "REC", CIRCLE: "C", ARC: "A", TEXT: "T", HATCH: "H", MOVE: "M", COPY: "CO", ROTATE: "RO", SCALE: "SC", MIRROR: "MI",
  ERASE: "E · Delete", OFFSET: "O", TRIM: "TR", EXTEND: "EX", FILLET: "F", ARRAY: "AR", EXPLODE: "X", DIMLINEAR: "DLI", DIMALIGNED: "DAL", BLOCK: "B", INSERT: "I",
  DIST: "DI", AREA: "AA", ID: "ID", CAL: "CAL", MATCHPROP: "MA", WIRE: "WI", NEW: "Ctrl+N", OPEN: "Ctrl+O", SAVE: "Ctrl+S", PLOT: "Ctrl+P", U: "Ctrl+Z", REDO: "Ctrl+Y",
  ZE: "ZE", PASTE: "Ctrl+V", CUTCLIP: "Ctrl+X", COPYCLIP: "Ctrl+C", SELALL: "Ctrl+A", OSNAP: "F3", ORTHO: "F8", GRID: "F7", SNAP: "F9",
  LEADER: "LE", TABLE: "TB", ZIN: "ZI", ZOUT: "ZO", WALL: "WA", ROOM: "RM", POLYGON: "POL", BUS: "BUS", DOT: "JD", PIPE: "PP", DUCT: "DU", TAG: "TAG", AUTONUM: "AN", BOM: "BOM", SENSLIST: "SENS",
  PCW: "PCW", PHW: "PHW", PS: "PS", PW: "PW", PV: "PV", PRD: "PRD", PSIG: "PSIG", PWL: "PWL" };
const UI = {
  "UI:CATALOG": ["คลังสัญลักษณ์", "catalog"], "UI:MOUSE": ["เมาส์", "mouse"], "UI:KEYS": ["คีย์ลัด", "keys"], "UI:ICONS": ["ไอคอนใหญ่", "icons"],
  "UI:RESET": ["จัดแถบใหม่", "reset"], "UI:RIBBON": ["ย่อแถบเมนู", "ribbon"], "UI:THEME": ["สว่าง/มืด", "theme"], "UI:IMPORT": ["นำเข้า DWG/DXF", "import"],
  "UI:MYLIB": ["คลังของฉัน", "mylib"], "UI:SELECT": ["เลือก", "select"],
};
const TOGGLE = new Set(["OSNAP", "ORTHO", "GRID", "SNAP"]);

// ------------------------------------------------------------------ Ribbon + แถบลอย (s: = สัญลักษณ์ใหม่ · L: = คลังเดิม)
const RIB = [
  { id: "home", t: "หน้าแรก", g: [["ไฟล์", ["NEW", "OPEN", "SAVE", "SAVEAS", "PLOT", "PARTIAL"]], ["คลิปบอร์ด", ["PASTE", "CUTCLIP", "COPYCLIP"]], ["ประวัติ", ["U", "REDO"]],
    ["วาดเร็ว", ["LINE", "PLINE", "RECTANG", "CIRCLE", "TEXT"]], ["เลือก แก้", ["UI:SELECT", "SELALL", "MOVE", "COPY", "ERASE"]], ["Layer", "layer"]] },
  { id: "draw", t: "วาด", g: [["เส้น", ["LINE", "PLINE", "ARC"]], ["รูปทรง", ["RECTANG", "CIRCLE", "POLYGON"]], ["พื้นผิว", ["HATCH"]], ["ข้อความ", ["TEXT"]]] },
  { id: "modify", t: "แก้ไข", g: [["ย้าย หมุน", ["MOVE", "COPY", "ROTATE", "SCALE", "MIRROR"]], ["แก้รูป", ["OFFSET", "TRIM", "EXTEND", "FILLET"]], ["อื่น ๆ", ["ARRAY", "EXPLODE", "ERASE", "MATCHPROP"]]] },
  { id: "annot", t: "ใส่ข้อมูล", g: [["มิติ", ["DIMLINEAR", "DIMALIGNED", "LEADER"]], ["ข้อความ ตาราง", ["TEXT", "TABLE", "BOM", "SENSLIST", "ROOM"]], ["Block", ["BLOCK", "INSERT"]], ["วัด", ["DIST", "AREA", "ID", "CAL"]],
    ["แผ่นงาน", ["L:FRAME_A3_TH", "L:FRAME_A3_IEC", "s:NORTH", "s:SECT", "s:GRIDB", "s:LEVEL"]]] },
  { id: "build", t: "อาคาร", g: [["ผนัง ห้อง", ["WALL", "ROOM"]], ["ประตู หน้าต่าง", ["L:DOOR_900", "L:DOOR_DOUBLE_1600", "L:DOOR_SLIDING_1800", "L:WINDOW_1200", "L:WINDOW_SLIDING_1800"]],
    ["โครงสร้าง", ["L:COLUMN_200", "L:COLUMN_300", "L:STAIR_1200x3000"]], ["สุขภัณฑ์ เฟอร์นิเจอร์", ["L:WC", "L:LAVATORY", "s:SHOWER", "s:BED", "s:TABLE4", "s:DESK"]]] },
  { id: "elec", t: "ไฟฟ้า", g: [["สาย", ["WIRE", "BUS", "DOT"]], ["อุปกรณ์ SLD", ["s:UTIL", "s:TR", "s:KWH", "s:CB", "s:CB_TH", "s:MCB", "s:FUSE", "s:SPD", "s:EARTH", "s:MOTOR"]],
    ["ในอาคาร", ["s:LIGHT", "s:FLUO1", "s:SW1", "s:RECG", "s:ACU", "s:LP"]], ["ควบคุม", ["s:NO", "s:NC", "s:COIL", "s:OL"]], ["ชื่อ เลข ตาราง", ["TAG", "AUTONUM", "BOM"]]] },
  { id: "solar", t: "โซลาร์", g: [["แผง (ขนาดจริง)", ["L:PV_1722x1134", "L:PV_2278x1134", "L:PV_2382x1134", "L:PV_2384x1303"]],
    ["SLD โซลาร์", ["s:PV", "s:PVSTR", "L:MPPT_INPUT", "L:DC_ISOLATOR", "L:DC_SPD", "L:DC_FUSE", "s:INV", "s:MICROINV", "s:BATT", "s:CTZERO", "L:SMART_METER", "s:EVCHG"]],
    ["บนหลังคา", ["L:RAIL_4200", "L:CLAMP_MARK", "L:STRING_TAG", "L:COMBINER_TOP", "L:INVERTER_TOP", "L:WALKWAY_1000", "L:LIGHTNING_ROD"]]] },
  { id: "water", t: "ระบบน้ำ", g: [["ท่อ (เส้นตามชนิด)", ["PCW", "PHW", "PS", "PW", "PV", "PRD"]], ["อุปกรณ์ประปา", ["s:WM", "s:GATE", "s:CHECK", "s:PRV", "s:FAUCET", "s:EWH", "s:BOOST", "s:WTANK"]],
    ["ระบาย บำบัด", ["s:FD", "s:CO", "s:RD", "s:MH", "s:GT", "s:SEPTIC"]], ["สุขภัณฑ์ ดับเพลิง", ["L:WC", "L:LAVATORY", "s:SHOWER", "s:SPRK", "s:FHC"]]] },
  { id: "mep", t: "งานระบบ", g: [["วาล์ว ปั๊ม", ["PIPE", "s:GATE", "s:GLOBE", "s:BALL", "s:CHECK", "s:CTRLV", "s:PUMP", "s:TANK"]], ["ข้อต่อ", ["s:ELB", "s:TEE", "s:RED", "s:FLG"]],
    ["ปรับอากาศ", ["DUCT", "s:SUPD", "s:RETG", "s:FCU", "s:AHU", "s:VD", "s:FD_H"]]] },
  { id: "sens", t: "เซนเซอร์", g: [["น้ำ", ["s:S_PH", "s:S_DO", "s:S_TURB", "s:S_LT", "s:S_FT", "s:S_LEAK"]], ["เสียง สั่น", ["s:S_NOISE", "s:S_VIB"]],
    ["อากาศ", ["s:S_PM25", "s:S_CO2", "s:S_TRH", "s:S_VOC", "s:S_WIND", "s:S_IRR"]], ["ดิน", ["s:S_SM", "s:S_ST", "s:S_NPK", "s:S_GWL"]], ["เครือข่าย", ["s:GW", "s:NODE", "s:CLOUD", "s:RTU", "PSIG", "PWL"]], ["ตาราง", ["SENSLIST", "AUTONUM"]]] },
  { id: "sym", t: "สัญลักษณ์", g: [["คลัง", ["UI:CATALOG"]], ["หมวด", "cats"], ["นำเข้า", ["UI:IMPORT", "UI:MYLIB"]]] },
  { id: "view", t: "มุมมอง", g: [["ซูม", ["ZE", "ZIN", "ZOUT"]], ["แถบเครื่องมือ (ติ๊กเลือก)", "tbs"], ["ช่วยวาด", ["GRID", "SNAP", "OSNAP", "ORTHO"]], ["หน้าตา", ["UI:MOUSE", "UI:ICONS", "UI:THEME", "UI:RESET", "UI:KEYS"]]] },
];
const TB_DEF = { // ตำแหน่งเริ่มต้น (y ติดลบ = นับจากขอบล่าง)
  draw: { show: true, x: 6, y: 6, v: true, min: false }, modify: { show: true, x: 60, y: 6, v: false, min: false }, elec: { show: false, x: 60, y: 60, v: false, min: false },
  solar: { show: false, x: 60, y: 114, v: false, min: false }, sens: { show: false, x: 60, y: 168, v: false, min: false }, annot: { show: false, x: 360, y: 60, v: false, min: false },
  aids: { show: true, x: 60, y: -50, v: false, min: false }, water: { show: false, x: 60, y: 222, v: false, min: false }, build: { show: false, x: 360, y: 114, v: false, min: false },
  mep: { show: false, x: 360, y: 168, v: false, min: false }, view: { show: false, x: 360, y: -50, v: false, min: false },
};
const TBS = [
  ["draw", "วาด", ["UI:SELECT", "LINE", "PLINE", "RECTANG", "CIRCLE", "ARC", "POLYGON", "TEXT", "HATCH", "DIMLINEAR"]],
  ["modify", "แก้ไข", ["MOVE", "COPY", "ROTATE", "SCALE", "MIRROR", "OFFSET", "TRIM", "EXTEND", "FILLET", "ERASE", "U", "REDO"]],
  ["annot", "ใส่ข้อมูล", ["DIMLINEAR", "DIMALIGNED", "LEADER", "TEXT", "TAG", "BOM", "L:FRAME_A3_TH", "BLOCK", "INSERT", "DIST", "AREA"]],
  ["elec", "ไฟฟ้า", ["WIRE", "BUS", "DOT", "s:CB", "s:CB_TH", "s:FUSE", "s:TR", "s:KWH", "s:SPD", "s:EARTH", "TAG", "AUTONUM"]],
  ["solar", "โซลาร์", ["L:PV_2278x1134", "s:PV", "s:INV", "s:BATT", "L:DC_ISOLATOR", "L:DC_SPD", "s:CTZERO"]],
  ["sens", "เซนเซอร์", ["s:S_PH", "s:S_LT", "s:S_NOISE", "s:S_PM25", "s:S_TRH", "s:S_SM", "s:GW", "PWL", "SENSLIST"]],
  ["build", "อาคาร", ["WALL", "ROOM", "L:DOOR_900", "L:WINDOW_1200", "L:COLUMN_300", "L:WC"]],
  ["water", "ระบบน้ำ", ["PCW", "PHW", "PS", "PW", "PV", "PRD", "s:FD", "s:CO", "s:WM", "s:FAUCET"]],
  ["mep", "ท่อ / HVAC", ["PIPE", "DUCT", "s:GATE", "s:CHECK", "s:PUMP", "s:SUPD"]],
  ["aids", "ช่วยวาด", ["GRID", "SNAP", "OSNAP", "ORTHO", "ZE", "UI:CATALOG", "UI:MOUSE"]],
  ["view", "มุมมอง", ["ZE", "ZIN", "ZOUT", "UI:MOUSE", "UI:THEME", "UI:KEYS"]],
].map(([id, t, items]) => ({ id, t, items, ...TB_DEF[id], ...(store.get("tb", {})[id] || {}) }));
const saveTb = () => store.set("tb", Object.fromEntries(TBS.map((tb) => [tb.id, { show: tb.show, x: tb.x, y: tb.y, v: tb.v, min: tb.min }])));

// ------------------------------------------------------------------ รายการสัญลักษณ์ (ใหม่ + คลังเดิม)
export const ENTRIES = new Map();
for (const s of Object.values(SYMS)) ENTRIES.set("s:" + s.id, { key: "s:" + s.id, cat: s.cat, short: s.short, th: s.th, std: s.std, sym: s, real: s.real, layer: s.layer });
async function loadLibrary() {
  try {
    const r = await fetch("../library/catalog.json?v=0.31.0"); if (!r.ok) return;
    const c = await r.json();
    for (const it of c.symbols || []) {
      const cat = LIB_CAT[it.group]; if (!cat) continue;
      ENTRIES.set("L:" + it.name, { key: "L:" + it.name, cat, short: it.th.replace(/\s*\(.*$/, "").slice(0, 22), th: it.th, std: CATS[cat].std + " · คลังเดิม", lib: it.library, name: it.name,
        svg: "../" + it.svg.replace(/^library\//, "library/"), paper: LIB_PAPER.has(it.library), attrs: it.attributes || [], layer: CATS[cat].layer });
    }
  } catch { /* ไม่มีคลังเดิม — ใช้เฉพาะชุดใหม่ */ }
}
async function loadMylib() {
  for (const k of [...ENTRIES.keys()]) if (k.startsWith("M:")) ENTRIES.delete(k);
  try {
    const r = await fetch("/api/cad/mylib"); if (!r.ok) return;
    for (const L of (await r.json()).libs || []) for (const n of L.blocks) ENTRIES.set(`M:${L.lib}|${n}`, { key: `M:${L.lib}|${n}`, cat: "mylib", short: n.slice(0, 22), th: `${n} (${L.file})`, std: "คลังของฉัน · " + L.file, lib: L.lib, name: n, mine: true, attrs: [], layer: "0" });
  } catch { /* รุ่นออนไลน์ไม่มีคลังของฉัน */ }
}
const thumbCache = new Map();
/** ภาพย่อของ Block ในคลังของฉัน (วาดจากเส้นของ block จริง) */
async function drawMyThumbs() {
  for (const cv of $$("canvas[data-mythumb]")) {
    const e = ENTRIES.get(cv.dataset.mythumb); if (!e) continue;
    if (thumbCache.has(e.key)) { cv.replaceWith(Object.assign(new Image(), { src: thumbCache.get(e.key), className: cv.className })); continue; }
    try {
      const r = await fetch("/api/cad/libblock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lib: e.lib, name: e.name }) }); const g = await r.json(); if (!r.ok) continue;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [f] of g.d) for (let i = 0; i < f.length; i += 2) { x0 = Math.min(x0, f[i]); x1 = Math.max(x1, f[i]); y0 = Math.min(y0, f[i + 1]); y1 = Math.max(y1, f[i + 1]); }
      const c = document.createElement("canvas"); c.width = 92; c.height = 76; const x = c.getContext("2d"), s = Math.min(84 / (x1 - x0 || 1), 68 / (y1 - y0 || 1));
      x.fillStyle = "#fff"; x.fillRect(0, 0, 92, 76); x.strokeStyle = "#1d2733"; x.lineWidth = 1; x.beginPath();
      for (const [f, cl] of g.d) { x.moveTo(4 + (f[0] - x0) * s, 72 - (f[1] - y0) * s); for (let i = 2; i < f.length; i += 2) x.lineTo(4 + (f[i] - x0) * s, 72 - (f[i + 1] - y0) * s); if (cl) x.closePath(); }
      x.stroke(); const url = c.toDataURL(); thumbCache.set(e.key, url); cv.replaceWith(Object.assign(new Image(), { src: url, className: cv.className }));
    } catch { /* วาดภาพย่อไม่ได้ ข้าม */ }
  }
}
function importLib() {
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".dwg,.dxf";
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return; API.log && API.log(`กำลังนำเข้า ${f.name} เป็นคลังของฉัน…`);
    try {
      const r = await fetch("/api/cad/mylib?name=" + encodeURIComponent(f.name), { method: "POST", body: f }); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status);
      await loadMylib(); SC.filter = "mylib"; store.set("catFilter", "mylib"); sideTab("sym"); API.log && API.log(`นำเข้า ${j.file}: ${j.blocks.length} Block → หมวด คลังของฉัน`);
    } catch (e) { API.log && API.log("นำเข้าไม่สำเร็จ: " + e.message); }
  };
  inp.click();
}
const thumb = (e, cls) => e.sym ? symSVG(e.sym, cls) : e.mine ? `<canvas class="${cls || ""} lib" data-mythumb="${esc(e.key)}" width="46" height="38"></canvas>` : `<img class="${cls || ""} lib" src="${esc(e.svg)}" alt="" loading="lazy">`;

// ------------------------------------------------------------------ ปุ่ม
let API = null;
function btn(id, cls) {
  const b = document.createElement("button");
  b.className = cls; b.type = "button";
  if (id.startsWith("s:") || id.startsWith("L:") || id.startsWith("M:")) {
    const e = ENTRIES.get(id);
    if (!e) { b.hidden = true; return b; }
    b.dataset.sym = id; b.title = `${e.th} · ${e.std}${e.real ? " · ขนาดจริง" : ""}`;
    b.innerHTML = thumb(e, "sym") + (cls === "rb" ? `<span>${esc(e.short)}</span>` : "");
  } else if (UI[id]) {
    b.dataset.ui = id; b.title = UI[id][0]; b.innerHTML = icon(UI[id][1]) + (cls === "rb" ? `<span>${UI[id][0]}</span>` : "");
  } else {
    if (TOGGLE.has(id)) b.dataset.ui = "UI:" + id; else b.dataset.cmd = id;
    b.title = (LABEL[id] || id) + (KEY[id] ? ` (${KEY[id]})` : "");
    b.innerHTML = icon(id) + (cls === "rb" ? `<span>${LABEL[id] || id}</span>` : "");
  }
  b.setAttribute("aria-label", b.title);
  return b;
}
let curTab = store.get("tab", "home");
function buildRibbon() {
  const tabs = $("#tabs"); tabs.innerHTML = "";
  for (const r of RIB) tabs.insertAdjacentHTML("beforeend", `<button type="button" class="tab${r.id === curTab ? " on" : ""}" data-tab="${r.id}">${r.t}</button>`);
  tabs.insertAdjacentHTML("beforeend", `<span class="sp"></span><button type="button" class="rmin" id="rmin" title="ย่อ/ขยายแถบเมนู (Ctrl+F1 · ดับเบิลคลิกแท็บ)">${document.body.classList.contains("rmin") ? "⌄" : "⌃"}</button>`);
  const R = RIB.find((r) => r.id === curTab) || RIB[0], pane = document.createElement("div"); pane.className = "pane";
  for (const [label, items] of R.g) {
    const g = document.createElement("div"); g.className = "rg"; const row = document.createElement("div"); row.className = "row";
    if (Array.isArray(items)) items.forEach((id) => row.append(btn(id, "rb")));
    else if (items === "layer") row.innerHTML = `<div class="rcol"><label class="muted" for="layer-rib" style="font-size:11px">Layer ปัจจุบัน / ของที่เลือก</label><select id="layer-rib"></select><span class="muted" style="font-size:11px">สัญลักษณ์เข้า layer ตามหมวดเอง</span></div>`;
    else if (items === "tbs") row.innerHTML = `<div class="rcol tbchecks">${TBS.map((tb) => `<label><input type="checkbox" data-tbchk="${tb.id}" ${tb.show ? "checked" : ""}> ${tb.t}</label>`).join("")}</div>`;
    else if (items === "cats") for (const [k, c] of Object.entries(CATS)) {
      const first = [...ENTRIES.values()].find((e) => e.cat === k); if (!first) continue;
      const b = document.createElement("button"); b.type = "button"; b.className = "rb"; b.dataset.cat = k; b.title = c.t + " · " + c.std;
      b.innerHTML = thumb(first, "sym") + `<span>${esc(c.t)}</span>`; row.append(b);
    }
    g.append(row); g.insertAdjacentHTML("beforeend", `<div class="lbl">${label}</div>`); pane.append(g);
  }
  const rb = $("#ribbon"); rb.innerHTML = ""; rb.append(pane);
  if (API && API.layersChanged) API.layersChanged();
  refresh();
}
function setRibbonMin(on) { document.body.classList.toggle("rmin", on); document.body.classList.remove("rpop"); store.set("rmin", on); buildRibbon(); }

// ------------------------------------------------------------------ แถบเครื่องมือลอย
function buildToolbars() {
  $$(".ftb").forEach((n) => n.remove());
  const wrap = $("#wrap");
  for (const tb of TBS) {
    const el = document.createElement("div"); el.className = "ftb"; el.dataset.tb = tb.id;
    el.innerHTML = `<div class="h" title="ลากเพื่อย้าย · คลิกขวาเลือกแถบ"><span class="grip"></span><b>${tb.t}</b><button type="button" data-a="o" title="สลับแนวตั้ง/แนวนอน">⇄</button><button type="button" data-a="m" title="ย่อ/ขยาย">–</button><button type="button" data-a="x" title="ปิดแถบ (เปิดใหม่ที่ มุมมอง → แถบเครื่องมือ)">×</button></div><div class="b"></div>`;
    tb.items.forEach((id) => el.querySelector(".b").append(btn(id, "tb")));
    wrap.append(el); tb.el = el;
    el.querySelector(".h").addEventListener("pointerdown", (e) => dragWin(e, el, tb));
    el.querySelector(".h").addEventListener("click", (e) => {
      const a = e.target.dataset && e.target.dataset.a; if (!a) return;
      if (a === "o") tb.v = !tb.v; if (a === "m") tb.min = !tb.min; if (a === "x") return showTb(tb.id, false);
      placeToolbars(); saveTb();
    });
  }
  placeToolbars();
}
export function placeToolbars() {
  const wrap = $("#wrap"); if (!wrap) return; const W = wrap.clientWidth, H = wrap.clientHeight; if (W < 50) return;
  for (const tb of TBS) {
    const el = tb.el; if (!el) continue;
    el.hidden = !tb.show; el.classList.toggle("v", tb.v); el.classList.toggle("min", tb.min);
    el.querySelector('[data-a="m"]').textContent = tb.min ? "+" : "–";
    let x = tb.x, y = tb.y < 0 ? H + tb.y : tb.y;
    x = Math.max(2, Math.min(x, W - el.offsetWidth - 2)); y = Math.max(2, Math.min(y, H - el.offsetHeight - 2));
    el.style.left = x + "px"; el.style.top = y + "px";
  }
  $$("[data-tbchk]").forEach((c) => { c.checked = TBS.find((t) => t.id === c.dataset.tbchk).show; });
}
function showTb(id, on) { const tb = TBS.find((t) => t.id === id); tb.show = on; placeToolbars(); saveTb(); }
function dragWin(e, el, tb) {
  if (e.target.closest("button") || e.button !== 0) return;
  e.preventDefault(); const wr = $("#wrap").getBoundingClientRect(), r = el.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top; el.classList.add("drag");
  const mv = (ev) => {
    let x = ev.clientX - wr.left - ox, y = ev.clientY - wr.top - oy; const W = wr.width - el.offsetWidth, H = wr.height - el.offsetHeight;
    if (x < 14) x = 4; if (y < 14) y = 4; if (x > W - 14) x = W - 4; if (y > H - 14) y = H - 4;  // แม่เหล็กติดขอบ
    x = Math.max(0, Math.min(x, W)); y = Math.max(0, Math.min(y, H)); el.style.left = x + "px"; el.style.top = y + "px";
    if (tb) { tb.x = x; tb.y = y > wr.height / 2 ? y - wr.height : y; }
  };
  const up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); el.classList.remove("drag"); if (tb) saveTb(); };
  addEventListener("pointermove", mv); addEventListener("pointerup", up);
}
function closeCtx() { $("#ctxmenu")?.remove(); }

// ------------------------------------------------------------------ แผงคลังสัญลักษณ์
const SC = { filter: store.get("catFilter", "all"), query: "", favs: new Set(store.get("favs", [])), recent: store.get("recent", []) };
export function noteRecent(key) { SC.recent = [key, ...SC.recent.filter((x) => x !== key)].slice(0, 12); store.set("recent", SC.recent); }
export function renderCatalog(activeKey) {
  const body = $("#symdock"); if (!body || body.hidden) return;
  const q = SC.query.trim().toLowerCase(), all = [...ENTRIES.values()];
  const match = (e) => !q || (e.th + " " + e.short + " " + e.key + " " + e.std + " " + CATS[e.cat].t).toLowerCase().includes(q);
  const chip = (k, t, n) => `<button type="button" class="chip${SC.filter === k ? " on" : ""}" data-cf="${k}">${esc(t)}${n != null ? `<i>${n}</i>` : ""}</button>`;
  const tiles = (list) => `<div class="tiles">${list.map((e) => `<div class="tile${activeKey === e.key ? " on" : ""}" draggable="true" data-sym="${esc(e.key)}" title="${esc(e.th)} · ${esc(e.std)}${e.real ? " · ขนาดจริง" : ""} — คลิกแล้ววาง หรือลากลงแบบ">` +
    `<button type="button" class="star${SC.favs.has(e.key) ? " f" : ""}" data-fav="${esc(e.key)}" title="ที่ชอบ">★</button>${thumb(e)}<span class="nm">${esc(e.short)}</span>${e.lib ? '<em title="จากคลังเดิมของ ASCA (DXF)">DXF</em>' : ""}</div>`).join("")}</div>`;
  let h = `<input class="search" id="symq" placeholder="ค้นหา เช่น เบรกเกอร์ วาล์ว แผงโซลาร์ PM2.5" value="${esc(SC.query)}">`;
  h += `<div class="chips">${chip("all", "ทั้งหมด", all.filter(match).length)}${chip("fav", "★ ที่ชอบ", SC.favs.size)}${chip("recent", "ใช้ล่าสุด", SC.recent.length)}` +
    Object.entries(CATS).map(([k, c]) => chip(k, c.t, all.filter((e) => e.cat === k && match(e)).length)).join("") + "</div>";
  if (SC.filter === "fav" || SC.filter === "recent") {
    const list = (SC.filter === "fav" ? [...SC.favs] : SC.recent).map((k) => ENTRIES.get(k)).filter((e) => e && match(e));
    h += list.length ? tiles(list) : `<p class="dnote">${SC.filter === "fav" ? "ยังไม่มี — ชี้ที่สัญลักษณ์แล้วกด ★" : "ยังไม่ได้วางสัญลักษณ์"}</p>`;
  } else for (const [k, c] of Object.entries(CATS)) {
    if (SC.filter !== "all" && SC.filter !== k) continue;
    const list = all.filter((e) => e.cat === k && match(e)); if (!list.length) continue;
    h += `<div class="cath">${esc(c.t)}<span>${esc(c.std)} · layer ${c.layer}</span></div>` + tiles(list);
  }
  if (SC.filter === "mylib" && !all.some((e) => e.cat === "mylib")) h += `<p class="dnote">ยังไม่มี — กด นำเข้า DWG/DXF (แท็บ สัญลักษณ์) เลือกไฟล์ที่มี Block เช่นคลังที่ดาวน์โหลดมาเอง · เก็บในเครื่องนี้เท่านั้น (ไม่ใส่ในชุดติดตั้ง/git)</p>`;
  h += `<p><button type="button" class="btn" data-ui="UI:IMPORT">นำเข้าคลังจาก DWG/DXF…</button></p>`;
  h += `<p class="dnote">คลิกแล้ววาง (คลิกหลายครั้งได้ · Esc จบ) หรือลากลงแบบ · ขณะวาง กด R หมุน 90° · F กลับด้าน · สัญลักษณ์ไฟฟ้า/ท่อจับที่ขั้วแรก ต่อเข้าปลายสายที่ชี้อยู่ได้เลย ·
    สัญลักษณ์แผนผังย่อขยายตามมาตราส่วนที่แถบล่าง · ประตู/เฟอร์นิเจอร์/แผงเป็นขนาดจริง · บันทึกแล้วเป็น Block + ชื่ออุปกรณ์ (ATTRIB TAG) เปิดใน AutoCAD ได้</p>`;
  const had = document.activeElement && document.activeElement.id === "symq", pos = had ? document.activeElement.selectionStart : 0;
  body.innerHTML = h;
  if (had) { const i = $("#symq"); i.focus(); i.setSelectionRange(pos, pos); }
  drawMyThumbs();
}

// ------------------------------------------------------------------ เคอร์เซอร์ (ตั้งค่าได้)
export const CURSOR = Object.assign({ style: "cad", size: 4, pick: 8, lw: 1, color: "auto", dyn: true }, store.get("cursor", {}));
/** วาดเคอร์เซอร์ที่ (x, y) บนจอ — picking = ไม่ได้อยู่ในคำสั่ง (แสดงกล่องเลือก) */
export function drawCursor(ctx, x, y, W, H, ink, picking) {
  const cs = CURSOR; if (cs.style === "arrow") return;
  ctx.strokeStyle = cs.color === "auto" ? ink : cs.color; ctx.lineWidth = cs.lw; ctx.globalAlpha = cs.color === "auto" ? 0.75 : 1; ctx.beginPath();
  const L = cs.size >= 100 ? Math.max(W, H) * 2 : Math.max(8, (cs.size / 100) * Math.max(W, H) / 2), pb = cs.pick / 2, X = Math.round(x) + 0.5, Y = Math.round(y) + 0.5;
  const showPick = cs.style === "cad" && picking;
  if (cs.style === "cad" || cs.style === "cross" || cs.style === "gap") {
    const g = cs.style === "gap" ? Math.max(4, pb) : showPick ? pb : 0;
    ctx.moveTo(X - L, Y); ctx.lineTo(X - g, Y); ctx.moveTo(X + g, Y); ctx.lineTo(X + L, Y);
    ctx.moveTo(X, Y - L); ctx.lineTo(X, Y - g); ctx.moveTo(X, Y + g); ctx.lineTo(X, Y + L);
    if (showPick) ctx.rect(X - pb, Y - pb, 2 * pb, 2 * pb);
  } else if (cs.style === "dot") { ctx.arc(X, Y, Math.max(5, pb + 2), 0, 7); ctx.moveTo(X + 1.5, Y); ctx.arc(X, Y, 1.5, 0, 7); }
  ctx.stroke(); ctx.globalAlpha = 1;
}
function openWin(id, title, html) {
  closeWin(id); const w = document.createElement("div"); w.className = "win"; w.id = "win-" + id;
  w.innerHTML = `<div class="wh"><b>${title}</b><button type="button" title="ปิด (Esc)">×</button></div><div class="wb">${html}</div>`;
  $("#wrap").append(w); w.style.left = Math.max(8, $("#wrap").clientWidth - w.offsetWidth - 12) + "px"; w.style.top = "12px";
  w.querySelector(".wh button").onclick = () => closeWin(id); w.querySelector(".wh").addEventListener("pointerdown", (e) => dragWin(e, w)); return w;
}
function closeWin(id) { $("#win-" + id)?.remove(); }
export function closeWins() { const any = $$(".win").length; $$(".win").forEach((w) => w.remove()); closeCtx(); return any > 0; }
function showMouse() {
  const c = CURSOR, seg = (k, opts) => `<div class="seg" data-k="${k}">${opts.map(([v, t]) => `<button type="button" data-v="${v}" class="${String(c[k]) === String(v) ? "on" : ""}">${t}</button>`).join("")}</div>`;
  const w = openWin("mouse", "ตั้งค่าเมาส์ / เคอร์เซอร์", `
    <div class="field">รูปแบบ</div>${seg("style", [["cad", "✛ CAD + กล่องเลือก"], ["cross", "┼ กากบาท"], ["gap", "⌖ เว้นกลาง"], ["dot", "◎ วงกลม"], ["arrow", "↖ ลูกศร"]])}
    <div class="field">ความยาวเส้นกากบาท <b id="vSize">${c.size >= 100 ? "เต็มจอ" : c.size + "%"}</b></div><input type="range" id="cSize" min="2" max="100" value="${c.size}">
    <div class="field">ขนาดกล่องเลือก (pickbox) <b id="vPick">${c.pick} px</b></div><input type="range" id="cPick" min="2" max="24" value="${c.pick}">
    <div class="field">ความหนาเส้น</div>${seg("lw", [[1, "บาง"], [1.5, "กลาง"], [2.5, "หนา"]])}
    <div class="field">สี</div>${seg("color", [["auto", "ตามธีม"], ["#e8892b", "ส้ม"], ["#3ddc84", "เขียว"], ["#4fc3f7", "ฟ้า"], ["#ff5c5c", "แดง"]])}
    <div class="field">แสดงระยะ/มุมข้างเมาส์ขณะวาด</div>${seg("dyn", [[true, "แสดง"], [false, "ไม่แสดง"]])}
    <p class="muted small" style="margin-bottom:0">ขยับเมาส์บนแบบเพื่อดูผลทันที · ค่าจำไว้ในเครื่องนี้</p>`);
  const save = () => { store.set("cursor", CURSOR); $("#cv").classList.toggle("arrow", CURSOR.style === "arrow"); API && API.redraw(); };
  w.querySelectorAll(".seg").forEach((sg) => sg.addEventListener("click", (e) => {
    const b = e.target.closest("[data-v]"); if (!b) return; const k = sg.dataset.k, raw = b.dataset.v;
    c[k] = raw === "true" ? true : raw === "false" ? false : isNaN(+raw) ? raw : +raw; sg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); save();
  }));
  $("#cSize").oninput = (e) => { c.size = +e.target.value; $("#vSize").textContent = c.size >= 100 ? "เต็มจอ" : c.size + "%"; save(); };
  $("#cPick").oninput = (e) => { c.pick = +e.target.value; $("#vPick").textContent = c.pick + " px"; save(); };
}
export function showKeys() {
  const rows = [
    ["ทั่วไป", [["Ctrl+N / O / S / P", "ใหม่ · เปิด · บันทึก · Plot PDF"], ["Ctrl+Z / Ctrl+Y", "ย้อน · ทำซ้ำ (Ctrl+Shift+Z ก็ได้)"], ["Ctrl+C / X / V", "คัดลอก · ตัด · วาง (คลิกตำแหน่งวาง)"],
      ["Ctrl+A", "เลือกทั้งหมด"], ["Ctrl+D", "ทำสำเนาที่เลือก (คลิกตำแหน่งวาง)"], ["Delete", "ลบที่เลือก"], ["Esc", "ยกเลิกคำสั่ง / ยกเลิกเลือก / ปิดหน้าต่าง"],
      ["Enter / Space", "จบคำสั่ง · ว่างอยู่ = ทำคำสั่งล่าสุดซ้ำ"], ["Ctrl+F1", "ย่อ/ขยายแถบเมนู Ribbon"], ["F1", "โหมดช่วยเหลือ: ชี้ปุ่มไหนก็ได้"], ["Shift+F1", "หน้าต่างนี้"], ["Shift ค้าง + ชี้ปุ่ม", "คำอธิบายสั้นทันที"]]],
    ["ช่วยวาด", [["F3", "จับจุด OSNAP"], ["F7", "แสดงกริด GRID"], ["F8", "ล็อกแนวฉาก ORTHO"], ["F9", "จับกริด SNAP (ระยะกริดเลือกที่แถบล่าง)"], ["R / F", "ขณะวางสัญลักษณ์: หมุน 90° · กลับด้าน"]]],
    ["เมาส์", [["ล้อเมาส์", "ซูมตรงตำแหน่งเมาส์"], ["กดล้อ/ปุ่มขวาค้างลาก", "เลื่อนจอ"], ["คลิกที่วัตถุ", "เลือก (Shift = เอาออก)"], ["ลากกรอบ", "ซ้าย→ขวา เต็มกรอบ · ขวา→ซ้าย แตะกรอบ"]]],
    ["พิมพ์คำสั่ง (แบบ AutoCAD)", Object.entries(KEY).filter(([, k]) => !k.startsWith("Ctrl") && !/^F\d/.test(k)).map(([c, k]) => [k, LABEL[c] || c])],
  ];
  openWin("keys", "คีย์ลัดและคำสั่ง", `<table class="k">${rows.map(([h, r]) => `<tr><th colspan="2">${h}</th></tr>` + r.map(([k, d]) => `<tr><td>${esc(k)}</td><td>${esc(d)}</td></tr>`).join("")).join("")}</table>`);
}

// ------------------------------------------------------------------ สถานะปุ่ม
let ACTIVE = null;
export function setActive(name) { ACTIVE = name; refresh(); }
export function refresh() {
  $$("[data-cmd]").forEach((b) => b.classList.toggle("on", b.dataset.cmd === ACTIVE));
  $$("[data-sym]").forEach((b) => b.classList.toggle("on", "SYM:" + b.dataset.sym === ACTIVE));
  if (API) $$("[data-ui]").forEach((b) => { const k = b.dataset.ui.slice(3); if (TOGGLE.has(k)) b.classList.toggle("on", !!API.state(k)); if (k === "ICONS") b.classList.toggle("on", document.body.classList.contains("bigicons")); });
}
export function sideTab(t) {
  $$(".stabs [data-st]").forEach((b) => b.classList.toggle("on", b.dataset.st === t));
  $("#symdock").hidden = t !== "sym"; $("#propdock").hidden = t !== "props"; store.set("side", t);
  if (t === "sym") renderCatalog(ACTIVE && ACTIVE.startsWith("SYM:") ? ACTIVE.slice(4) : null);
}

// ------------------------------------------------------------------ เริ่ม
/** api: { place(key), state(k), toggle(k), redraw(), dropAt(key, clientX, clientY) } */
export async function initUI(api) {
  API = api;
  if (store.get("big", false)) document.body.classList.add("bigicons");
  if (store.get("theme", "")) document.documentElement.dataset.theme = store.get("theme", "");
  if (store.get("rmin", false)) document.body.classList.add("rmin");
  $$("[data-ic]").forEach((b) => { b.innerHTML = icon(b.dataset.ic); });
  await loadLibrary(); await loadMylib();
  buildRibbon(); buildToolbars(); sideTab(store.get("side", "sym"));
  $("#cv").classList.toggle("arrow", CURSOR.style === "arrow");
  $("#tabs").addEventListener("click", (e) => {
    if (e.target.id === "rmin") return setRibbonMin(!document.body.classList.contains("rmin"));
    const b = e.target.closest("[data-tab]"); if (!b) return; curTab = b.dataset.tab; store.set("tab", curTab); buildRibbon();
    if (document.body.classList.contains("rmin")) document.body.classList.add("rpop");
  });
  $("#tabs").addEventListener("dblclick", (e) => { if (e.target.closest("[data-tab]")) setRibbonMin(!document.body.classList.contains("rmin")); });
  document.addEventListener("click", (e) => {
    const s = e.target.closest("[data-sym]"), u = e.target.closest("[data-ui]"), c = e.target.closest("[data-cat]");
    if (e.target.closest("[data-fav]")) { const k = e.target.closest("[data-fav]").dataset.fav; SC.favs.has(k) ? SC.favs.delete(k) : SC.favs.add(k); store.set("favs", [...SC.favs]); renderCatalog(); return; }
    if (e.target.closest("[data-cf]")) { SC.filter = e.target.closest("[data-cf]").dataset.cf; store.set("catFilter", SC.filter); renderCatalog(); return; }
    if (s) { api.place(s.dataset.sym); }
    else if (c) { SC.filter = c.dataset.cat; store.set("catFilter", SC.filter); sideTab("sym"); }
    else if (u) uiAction(u.dataset.ui);
    if ((s || u || c || e.target.closest("[data-cmd]")) && document.body.classList.contains("rpop")) document.body.classList.remove("rpop");
    else if (document.body.classList.contains("rpop") && !e.target.closest(".ribbon, .tabs")) document.body.classList.remove("rpop");
  });
  document.addEventListener("change", (e) => { const k = e.target.dataset && e.target.dataset.tbchk; if (k) showTb(k, e.target.checked); });
  $("#symdock").addEventListener("input", (e) => { if (e.target.id === "symq") { SC.query = e.target.value; renderCatalog(); } });
  $("#symdock").addEventListener("dragstart", (e) => { const t = e.target.closest("[data-sym]"); if (t) { e.dataTransfer.setData("text/asca-sym", t.dataset.sym); e.dataTransfer.effectAllowed = "copy"; } });
  const cv = $("#cv");
  cv.addEventListener("dragover", (e) => { if ([...e.dataTransfer.types].includes("text/asca-sym")) e.preventDefault(); });
  cv.addEventListener("drop", (e) => { const k = e.dataTransfer.getData("text/asca-sym"); if (k) { e.preventDefault(); api.dropAt(k, e.clientX, e.clientY); } });
  $$(".stabs [data-st]").forEach((b) => (b.onclick = () => sideTab(b.dataset.st)));
  document.addEventListener("contextmenu", (e) => {
    if (!e.target.closest(".ftb, .ribbon, .tabs")) return; e.preventDefault(); closeCtx();
    const m = document.createElement("div"); m.className = "ctx"; m.id = "ctxmenu";
    m.innerHTML = TBS.map((tb) => `<label><input type="checkbox" data-tbchk="${tb.id}" ${tb.show ? "checked" : ""}> ${tb.t}</label>`).join("") +
      `<hr><button type="button" data-ui="UI:RIBBON">${document.body.classList.contains("rmin") ? "ขยาย" : "ย่อ"}แถบเมนู Ribbon</button><button type="button" data-ui="UI:ICONS">ไอคอนใหญ่ / เล็ก</button><button type="button" data-ui="UI:RESET">จัดแถบกลับค่าเริ่มต้น</button>`;
    document.body.append(m); m.style.left = Math.min(e.clientX, innerWidth - 210) + "px"; m.style.top = Math.min(e.clientY, innerHeight - m.offsetHeight - 8) + "px";
  });
  addEventListener("pointerdown", (e) => { if (!e.target.closest("#ctxmenu")) closeCtx(); }, true);
  new ResizeObserver(() => placeToolbars()).observe($("#wrap"));
}
export function uiAction(id) {
  closeCtx();
  if (id === "UI:CATALOG") { sideTab("sym"); setTimeout(() => $("#symq")?.focus(), 0); }
  else if (id === "UI:MOUSE") showMouse();
  else if (id === "UI:KEYS") showKeys();
  else if (id === "UI:RIBBON") setRibbonMin(!document.body.classList.contains("rmin"));
  else if (id === "UI:ICONS") { document.body.classList.toggle("bigicons"); store.set("big", document.body.classList.contains("bigicons")); placeToolbars(); }
  else if (id === "UI:RESET") { TBS.forEach((tb) => Object.assign(tb, TB_DEF[tb.id])); placeToolbars(); saveTb(); }
  else if (id === "UI:OSNAP" || id === "UI:ORTHO" || id === "UI:GRID") API.toggle(id.slice(3).toLowerCase());
  else if (id === "UI:SNAP") API.toggle("gsnap");
  else if (id === "UI:IMPORT") importLib();
  else if (id === "UI:MYLIB") { SC.filter = "mylib"; store.set("catFilter", "mylib"); sideTab("sym"); }
  else if (id === "UI:SELECT") API.select();
  else if (id === "UI:THEME") { const r = document.documentElement, cur = r.dataset.theme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"); r.dataset.theme = cur === "light" ? "dark" : "light"; store.set("theme", r.dataset.theme); API.redraw(); }
  refresh();
}
