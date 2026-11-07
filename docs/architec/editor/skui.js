// หน้าตาแบบ SketchUp ของมุมมอง 3D ในตัวเขียนแบบ (0.23.0 · ตามหน้าตัวอย่างที่ลุงพีอนุมัติ · โดย ลุงพี)
// เมนู 10 หมวด · แถบเครื่องมือ (มาตรฐาน · เงา · รูปแบบ · ตำแหน่ง · มุมมอง · ตัด/ฉาก) · ชุดเครื่องมือใหญ่ 37 ปุ่ม · ถาดเครื่องมือ 11 แผง (ติดขวา)
// ข้อมูลโมเดล 11 หน้า · แถบเครื่องมือ (ติ๊กเลือก) · Render ภาพนำเสนอ · ช่องเดิมของ main.js (#sun-date #sun-time #section #scenes #mat3d) ยังใช้ร่วม
import * as THREE from "three";
import { STYLES, TAGS } from "./view3d.js?v=0.31.1";
import { PALETTE, swatch } from "./materials.js?v=0.31.1";
import { KINDS } from "./props3d.js?v=0.31.1";
import { entityHTML, applyField } from "./entity.js?v=0.31.1";
import * as SEL from "./sel3d.js?v=0.31.1";
import { Tools3D, SETTINGS } from "./tools3d.js?v=0.31.1";
import { openImport3d } from "./import3d.js?v=0.31.1";

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem("ascaEditor." + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("ascaEditor." + k, JSON.stringify(v)); } catch { /* */ } },
};
// ไอคอน (ชุดเดียวกับหน้าตัวอย่างที่อนุมัติ)
const IC = {
  new: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M12 11v6M9 14h6"/>', open: '<path d="M3 7h6l2 2h10v11H3z"/>', save: '<path d="M5 3h12l3 3v15H5z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',
  cut: '<circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><path d="M8 16L18 3M16 16L6 3"/>', copy: '<rect x="8" y="8" width="12" height="12"/><path d="M16 8V4H4v12h4"/>',
  paste: '<rect x="5" y="4" width="14" height="17"/><rect x="9" y="2" width="6" height="4"/>', erase: '<circle cx="12" cy="12" r="8"/><path d="M9 9l6 6M15 9l-6 6"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-4"/>', redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h4"/>',
  print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8"/><path d="M7 14h10v7H7z"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  shadow: '<path d="M4 16l6-10 10 4-6 10z" fill="currentColor" fill-opacity=".25"/><path d="M4 16l6-10 10 4-6 10z"/>',
  xray: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z" fill="currentColor" fill-opacity=".18"/><path d="M4 8l8 4 8-4M12 12v8"/><path d="M4 8v8l8 4M12 4v8" stroke-dasharray="2 2"/>',
  back: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/><path d="M4 16l8-4 8 4M12 4v8" stroke-dasharray="1.5 2"/>',
  wire: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8M4 16l8-4 8 4M12 4v8"/>',
  hidden: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>',
  shaded: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z" fill="#b7ad8c"/><path d="M12 12l8-4v8l-8 4z" fill="#8f876c"/><path d="M4 8l8 4 8-4M12 12v8"/>',
  tex: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z" fill="#444"/><path d="M5 10h6M5 13h6M5 16h6M13 11l6-3M13 14l6-3M13 17l6-3" stroke="#ddd"/><path d="M4 8l8 4 8-4M12 12v8"/>',
  mono: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z" fill="#3a8fd9"/><path d="M12 12l8-4v8l-8 4z" fill="#246aa8"/><path d="M4 8l8 4 8-4M12 12v8"/>',
  render: '<circle cx="12" cy="13" r="4"/><path d="M4 8h3l2-3h6l2 3h3v11H4z"/>',
  location: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 7c-2 0-3.5 1.4-3.5 3.3 0 2.4 3.5 6.2 3.5 6.2s3.5-3.8 3.5-6.2C15.5 8.4 14 7 12 7z"/><circle cx="12" cy="10.3" r="1.2"/>',
  terrain: '<path d="M3 18l5-7 4 4 3-3 6 6z" fill="currentColor" fill-opacity=".2"/><path d="M3 18l5-7 4 4 3-3 6 6z"/>',
  viso: '<path d="M4 9l8-4 8 4-8 4z" fill="#c9a07a"/><path d="M4 9v7l8 4V13zM20 9v7l-8 4V13z"/><path d="M9 11v5"/>', vtop: '<path d="M5 9h14v11H5z"/><path d="M3 9l9-6 9 6"/><path d="M10 20v-5h4v5"/>',
  vfront: '<path d="M4 10l8-6 8 6v10H4z"/><path d="M10 20v-6h4v6"/>', vright: '<path d="M4 10l8-6 8 6v10H4z"/><path d="M7 13h3v3H7zM14 13h3v3h-3z"/>',
  vback: '<path d="M4 10l8-6 8 6v10H4z"/>', vleft: '<path d="M3 11h18v9H3zM5 11V7h14v4"/>',
  select: '<path d="M6 3l11 8-5 1 3 7-2 1-3-7-4 4z" fill="currentColor"/>', component: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/><rect x="14" y="2" width="8" height="6" rx="1"/>',
  paint: '<path d="M5 11l7-7 7 7-7 7z" fill="currentColor" fill-opacity=".15"/><path d="M5 11l7-7 7 7-7 7z"/><path d="M19 13c1 2 2 3 2 4a2 2 0 0 1-4 0c0-1 1-2 2-4z" fill="currentColor"/>',
  eraser: '<path d="M4 15l8-8 6 6-6 6H8z" fill="#f2a3b0"/><path d="M4 15l8-8 6 6-6 6H8z"/><path d="M13 19h8"/>', tagtool: '<path d="M3 12V4h8l10 10-7 7z"/><circle cx="7.5" cy="8.5" r="1.4"/>',
  line: '<path d="M4 20L20 4" stroke="#c63a2b" stroke-width="2"/><path d="M17 3l4 4"/>', freehand: '<path d="M3 17c3-8 5 4 8-4s5 2 7-3 3 5 3 5" stroke="#c63a2b"/>',
  rect: '<rect x="4" y="5" width="16" height="14" fill="currentColor" fill-opacity=".12"/><path d="M4 19L20 5" stroke="#c63a2b"/>', rrect: '<path d="M6 4l14 4-4 14-14-4z" fill="currentColor" fill-opacity=".12"/><path d="M6 4l14 4-4 14-14-4z"/>',
  circle: '<circle cx="12" cy="12" r="8" fill="currentColor" fill-opacity=".12"/><path d="M12 12l6-5" stroke="#c63a2b"/>', polygon: '<path d="M12 3l8 6-3 10H7L4 9z" fill="currentColor" fill-opacity=".12"/><path d="M12 12l8-3" stroke="#c63a2b"/>',
  arc: '<path d="M4 18A11 11 0 0 1 20 6" stroke="#c63a2b"/><circle cx="4" cy="18" r="1.4"/><circle cx="20" cy="6" r="1.4"/>', arc2: '<path d="M4 18A11 11 0 0 1 20 6"/><path d="M4 18L20 6" stroke-dasharray="2 2" stroke="#c63a2b"/>',
  arc3: '<path d="M4 18A11 11 0 0 1 20 6"/><circle cx="11" cy="8.5" r="1.4" fill="#c63a2b"/>', pie: '<path d="M12 12L4 18A11 11 0 0 1 20 6z" fill="currentColor" fill-opacity=".15"/><path d="M12 12L4 18A11 11 0 0 1 20 6z"/>',
  push: '<path d="M4 15l8-4 8 4-8 4z" fill="#c9b48b"/><path d="M12 13V3M9 6l3-3 3 3" stroke="#c63a2b" stroke-width="2"/>', follow: '<path d="M4 18c0-6 4-12 12-12" stroke-width="5" stroke="#c63a2b" stroke-opacity=".7"/><path d="M14 4l4 2-3 3"/>',
  move: '<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" stroke="#c63a2b"/>', rotate: '<path d="M20 12a8 8 0 1 1-3-6.2" stroke="#c63a2b" stroke-width="2"/><path d="M17 2v4h4"/>',
  scale: '<rect x="3" y="9" width="12" height="12" fill="currentColor" fill-opacity=".15"/><path d="M13 11l8-8M15 3h6v6" stroke="#c63a2b"/>', offset: '<path d="M4 20V4h16"/><path d="M8 20V8h12" stroke="#c63a2b"/>',
  tape: '<rect x="3" y="11" width="10" height="9" rx="2" fill="#f2c94c"/><path d="M13 15l8-8" stroke-width="2"/>', dim: '<path d="M4 7v10M20 7v10M4 12h16M4 12l3-2M4 12l3 2M20 12l-3-2M20 12l-3 2"/>',
  protractor: '<path d="M3 18a9 9 0 0 1 18 0z" fill="#f2c94c" fill-opacity=".6"/><path d="M12 18l6-8"/>', text: '<rect x="12" y="3" width="9" height="8"/><path d="M14 5h5M16.5 5v5M3 21l9-10"/>',
  axes: '<path d="M12 12V3" stroke="#2c62c9"/><path d="M12 12l8 5" stroke="#c63a2b"/><path d="M12 12l-8 5" stroke="#2e9a3e"/>', text3d: '<path d="M7 20L12 4l5 16M9 14h6" stroke-width="2.4"/>',
  orbit: '<path d="M4 12a8 4 0 1 0 16 0 8 4 0 1 0-16 0" stroke="#c63a2b"/><path d="M12 4a4 8 0 1 0 0 16" stroke="#2e9a3e"/>', pan: '<path d="M8 13V6a1.5 1.5 0 0 1 3 0v5V4a1.5 1.5 0 0 1 3 0v7V6a1.5 1.5 0 0 1 3 0v8c0 4-2 7-6 7s-6-3-7-6l-1-3a1.5 1.5 0 0 1 3-1z"/>',
  zoom: '<circle cx="10" cy="10" r="6"/><path d="M15 15l6 6"/>', zoomwin: '<rect x="3" y="3" width="11" height="11" stroke="#c63a2b"/><circle cx="12" cy="12" r="5"/><path d="M16 16l5 5"/>',
  extents: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke="#c63a2b"/><path d="M9 9l6 6M15 9l-6 6"/>', previous: '<circle cx="11" cy="11" r="6"/><path d="M15 15l6 6M8 11h6M8 11l2-2M8 11l2 2" stroke="#2c62c9"/>',
  poscam: '<circle cx="12" cy="6" r="2"/><path d="M12 8v8M8 22l4-6 4 6M8 12h8"/>', look: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
  walk: '<path d="M8 4c2 0 3 2 2 5l-2 4H5c-1-3 0-9 3-9zM16 9c2 0 3 2 2 5l-2 4h-3c-1-3 0-9 3-9z" fill="currentColor"/>', section: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16" stroke="#e08a2c"/><path d="M16 8l3-3"/>',
  tray: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M15 4v16M17 8h2M17 11h2"/>', toolbars: '<rect x="3" y="4" width="18" height="5"/><rect x="3" y="12" width="8" height="8"/>',
};
// ไอคอนเครื่องมือผัง 2D (ชุดเดียวกับ 3D) + งานโครงสร้าง
Object.assign(IC, {
  p2wall: '<rect x="3" y="9" width="18" height="6" fill="currentColor" fill-opacity=".35"/><path d="M3 9h18M3 15h18M3 9v6M21 9v6"/>',
  p2room: '<path d="M4 4h16v16H4z" stroke-width="2.6"/><path d="M14 20v-5"/>',
  p2door: '<path d="M4 20h4M16 20h4" stroke-width="2.4"/><path d="M8 20V6"/><path d="M8 6a12 12 0 0 1 12 14" stroke-dasharray="2 2"/>',
  p2window: '<rect x="3" y="9" width="18" height="6"/><path d="M3 12h18" stroke="#3a8fd6"/>',
  p2box: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z" fill="currentColor" fill-opacity=".15"/><path d="M4 8l8 4 8-4M12 12v8"/>',
  p2line: '<path d="M4 18L20 6"/><circle cx="4" cy="18" r="1.6"/><circle cx="20" cy="6" r="1.6"/>',
  p2dim: '<path d="M4 7v10M20 7v10M4 12h16" stroke="#b5522b"/><path d="M7 10l-3 2 3 2M17 10l3 2-3 2" stroke="#b5522b"/>',
  p2text: '<path d="M5 6h14M12 6v13M9 19h6"/>',
  p2symbol: '<circle cx="12" cy="12" r="7"/><path d="M12 5v14M5 12h14"/>',
  p2calib: '<path d="M3 17L17 3l4 4L7 21H3z"/><path d="M8 12l2 2M11 9l2 2M14 6l2 2"/>',
  p2column: '<rect x="7" y="7" width="10" height="10" fill="currentColor"/><path d="M3 12h4M17 12h4M12 3v4M12 17v4" stroke-dasharray="1.5 1.5"/>',
  p2beam: '<rect x="2" y="9" width="4" height="6" fill="currentColor"/><rect x="18" y="9" width="4" height="6" fill="currentColor"/><path d="M6 10h12M6 14h12" stroke-dasharray="3 2"/>',
  p2footing: '<rect x="4" y="4" width="16" height="16" stroke-dasharray="3 2"/><rect x="9" y="9" width="6" height="6" fill="currentColor"/>',
  p2slab: '<path d="M3 16l5-7h13l-5 7z" fill="currentColor" fill-opacity=".18"/><path d="M3 16l5-7h13l-5 7zM6 16l4-5.5M10 16l4-5.5M14 16l4-5.5"/>',
  p2stair: '<path d="M3 20h4v-4h4v-4h4V8h4V4" stroke-width="2"/>',
  p2fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><rect x="8" y="8" width="8" height="8" stroke-dasharray="2 1.5"/>',
});
const TOOLS2D = {
  select: ["เลือก / ย้าย", "V", "select"], pan: ["เลื่อนจอ", "H", "pan"], wall: ["ผนัง", "W", "p2wall"], room: ["ห้องสี่เหลี่ยม", "R", "p2room"],
  door: ["ประตู", "D", "p2door"], window: ["หน้าต่าง", "N", "p2window"], box: ["กล่อง push-pull", "B", "p2box"], line: ["เส้น", "L", "p2line"],
  dim: ["มิติ", "M", "p2dim"], text: ["ข้อความ", "T", "p2text"], symbol: ["สัญลักษณ์", "S", "p2symbol"], erase: ["ลบ", "E", "eraser"],
  column: ["เสา", "C", "p2column"], beam: ["คาน", "G", "p2beam"], footing: ["ฐานราก", "F", "p2footing"], slab: ["พื้นโครงสร้าง", "", "p2slab"], stair: ["บันได", "", "p2stair"], calib: ["ตั้งระยะภาพลอกแบบ", "K", "p2calib"],
};
const BIG2 = [["select", "pan"], ["wall", "room"], ["door", "window"], ["box", "line"], ["dim", "text"], ["symbol", "erase"], "งานโครงสร้าง", ["column", "beam"], ["footing", "slab"], ["stair", "calib"]];
const icon = (k) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${IC[k] || IC.info}</svg>`;

// ------------------------------------------------------------------ เครื่องมือ 37 ปุ่ม (ชุดเครื่องมือใหญ่ · Large Tool Set) — [ชื่อไทย, อังกฤษ, คีย์, คำแนะนำ]
const TOOLS = {
  select: ["เลือก", "Select", "Space", "คลิกกล่อง/ชิ้นส่วนเพื่อเลือก · Shift = เพิ่ม/เอาออก · ข้อมูลอยู่ที่ถาด ข้อมูลวัตถุ"], component: ["สร้าง Component (รวมกลุ่ม)", "Make Component", "", "เลือกกล่องอย่างน้อย 2 ชิ้น (Shift+คลิก) แล้วกดปุ่มนี้ = รวมเป็นชิ้นเดียว"],
  paint: ["ถังสี", "Paint Bucket", "B", "เลือกวัสดุในถาด วัสดุ แล้วคลิกผนัง/กล่อง/หลังคา/หน้าตัดกวาด"], eraser: ["ยางลบ", "Eraser", "E", "คลิกวัตถุที่จะลบ: กล่อง/หน้า ชิ้นส่วน เส้น ข้อความ มิติ (Ctrl+Z ย้อน)"],
  tagtool: ["Tag", "Tag", "", "เลือก Tag ปัจจุบันในถาด Tags แล้วคลิกวัตถุเพื่อใส่ Tag นั้น"],
  line: ["เส้น", "Line", "L", "คลิกทีละจุดบนพื้น/หน้าบนกล่อง · คลิกจุดแรก = ปิดเป็นหน้า · ดับเบิลคลิก/Enter = จบเป็นเส้น · พิมพ์ระยะ + Enter"],
  freehand: ["วาดอิสระ", "Freehand", "", "กดค้างแล้วลากวาด · ปล่อยใกล้จุดเริ่ม = หน้า"], rect: ["สี่เหลี่ยม", "Rectangle", "R", "ลาก หรือคลิกมุมแรกแล้วคลิกมุมตรงข้าม บนพื้นหรือบนหน้าบนของกล่อง → กล่องใหม่ (สูงตามค่าเริ่มต้น)"],
  rrect: ["สี่เหลี่ยมหมุน", "Rotated Rectangle", "", "คลิกปลายด้านแรก 2 จุด แล้วลากความกว้าง → หน้า"], circle: ["วงกลม", "Circle", "C", "คลิกจุดศูนย์กลาง แล้วลากรัศมี (พิมพ์รัศมี + Enter) → หน้า"],
  polygon: ["หลายเหลี่ยม", "Polygon", "", "คลิกศูนย์กลาง ลากรัศมี · พิมพ์ 8s + Enter = 8 ด้าน → หน้า"], arc: ["โค้ง", "Arc", "A", "คลิกศูนย์กลาง → จุดเริ่ม → จุดจบ → เส้นโค้ง"],
  arc2: ["โค้ง 2 จุด", "2 Point Arc", "", "คลิกจุดเริ่ม → จุดจบ → ลากความโค้ง"], arc3: ["โค้ง 3 จุด", "3 Point Arc", "", "คลิก 3 จุดบนโค้ง"], pie: ["พาย", "Pie", "", "คลิกศูนย์กลาง → ขอบโค้ง 2 จุด → หน้ารูปพาย"],
  pushpull: ["Push/Pull", "Push/Pull", "P", "ลากหน้าบนขึ้น/ลง = ความสูง · ลากหน้าข้าง = ดันออก/เข้า (ทีละ 50 มม.) · ปล่อยแล้วพิมพ์ระยะ + Enter = พอดี"],
  follow: ["Follow Me", "Follow Me", "", "คลิกเส้นที่วาดไว้ → กวาดหน้าตัดสี่เหลี่ยมตามเส้น (พิมพ์ 200x300 + Enter = กว้าง×สูง) · ใช้ทำคาน รั้ว ราง ขอบสระ"],
  move: ["ย้าย", "Move", "M", "ลากกล่อง/ชิ้นส่วน (ทีละ 50 มม.) · กด Ctrl ค้างตอนเริ่มลาก = คัดลอก"], rotate: ["หมุน", "Rotate", "Q", "คลิกกล่อง/ชิ้นส่วน = หมุน 15° · Shift = ทวนทาง"],
  scale: ["ย่อขยาย", "Scale", "S", "กดที่กล่อง/ชิ้นส่วนแล้วลากซ้าย-ขวา · หรือเลือกแล้วพิมพ์ตัวคูณ + Enter"], offset: ["Offset", "Offset", "F", "คลิกหน้าบนของกล่อง แล้วลากเข้า/ออก → หน้าใหม่ขนานขอบ"],
  tape: ["ตลับเมตร", "Tape Measure", "T", "คลิก 2 จุดบนผิวหรือพื้น → ระยะตามหน่วยใน ข้อมูลโมเดล"], dim: ["มิติ", "Dimensions", "", "คลิก 2 จุด → เส้นมิติ 3D ค้างในแบบ"],
  protractor: ["ไม้โปรแทรกเตอร์", "Protractor", "", "คลิกจุดยอดมุม → แขนแรก → แขนที่สอง → อ่านมุม"], text: ["ข้อความ", "Text", "", "คลิกวัตถุ → ข้อความชี้ (ค่าเริ่มเป็นชื่อ + พื้นที่)"],
  axes: ["แกน", "Axes", "", "คลิกจุดกำเนิดใหม่ แล้วคลิกทิศแกนแดง"], text3d: ["ข้อความ 3D", "3D Text", "", "คลิกพื้น/ผิว → ตัวอักษรตั้ง ทอดเงาได้ (ป้ายชื่อโครงการ)"],
  orbit: ["หมุนรอบ", "Orbit", "O", "ลากเมาส์ซ้าย = หมุนรอบ · ปุ่มขวาลาก = เลื่อน · ล้อ = ซูม"], pan: ["เลื่อนภาพ", "Pan", "H", "ลากเมาส์ซ้ายเพื่อเลื่อนภาพ"],
  zoom: ["ซูม", "Zoom", "Z", "ลากเมาส์ซ้ายขึ้น/ลงเพื่อซูม"], zoomwin: ["ซูมกรอบ", "Zoom Window", "", "ลากกรอบรอบส่วนที่จะดูใกล้"],
  extents: ["ดูทั้งหมด", "Zoom Extents", "Shift+Z", ""], previous: ["มุมก่อนหน้า", "Previous", "", ""],
  poscam: ["ตั้งกล้อง", "Position Camera", "", "คลิกบนพื้น/กล่อง → ยืนตรงนั้นที่ระดับสายตา 1.65 ม."], look: ["มองรอบ", "Look Around", "", "ลากเมาส์ซ้ายเพื่อหันมองรอบตัว (ยืนอยู่กับที่)"],
  walk: ["เดิน", "Walk", "", "WASD / ลูกศร = เดิน · Shift = เร็ว · ลากเมาส์ซ้าย = หันมอง"], section: ["ระนาบตัด", "Section Plane", "", ""],
};
const ACTS = new Set(["component", "extents", "previous", "section"]);
const BIG = [["select", "component"], ["paint", "eraser"], ["tagtool", null], "-", ["line", "freehand"], ["rect", "rrect"], ["circle", "polygon"], ["arc", "arc2"], ["arc3", "pie"], "-",
  ["move", "pushpull"], ["rotate", "follow"], ["scale", "offset"], "-", ["tape", "dim"], ["protractor", "text"], ["axes", "text3d"], "-", ["orbit", "pan"], ["zoom", "zoomwin"], ["extents", "previous"], "-", ["poscam", "look"], ["walk", "section"]];
const ICK = { pushpull: "push" };
const UNITS = Object.assign({ format: "decimal", len: "mm", prec: 0, snap: true, ang: 15 }, store.get("units", {}));
SETTINGS.rotStep = UNITS.ang || 15;                                     // ข้อมูลโมเดล → หน่วย → จับมุมทุก (องศา) = มุมหมุนต่อคลิก (เดิมบันทึกแต่ไม่ได้ใช้)
const MI = Object.assign({ trans: true, transSec: 1.5, delay: 2, res: "1920x1080", textColor: "#1d2733" }, store.get("mi", {}));
Object.assign(SETTINGS, store.get("settings", {}));
const saveSettings = () => { store.set("settings", SETTINGS); store.set("mi", MI); };
/** ระยะ (เมตร) → ข้อความตามหน่วยที่ตั้งใน Model Info */
export function fmtLen(m) {
  const u = UNITS;
  if (u.format === "decimal") { const k = { mm: 1000, cm: 100, m: 1 }[u.len]; return (m * k).toLocaleString("en-US", { minimumFractionDigits: u.prec, maximumFractionDigits: u.prec }) + " " + { mm: "มม.", cm: "ซม.", m: "ม." }[u.len]; }
  const inch = m / 0.0254;
  if (u.format === "engineering") return (inch / 12).toFixed(2) + "'";
  const den = 16, tot = Math.round(inch * den), ft = Math.floor(tot / (12 * den)), rem = tot - ft * 12 * den, ins = Math.floor(rem / den), fr = rem % den;
  const g = (a, b) => (b ? g(b, a % b) : a), frac = fr ? ` ${fr / g(fr, den)}/${den / g(fr, den)}` : "";
  return u.format === "fractional" ? `${Math.floor(tot / den)}${frac}"` : `${ft}' ${ins}${frac}"`;
}
const IFC = { walls: "IfcWall", openings: "IfcDoor / IfcWindow", roof: "IfcRoof", pv: "IfcSolarDevice", masses: "IfcBuildingElementProxy", slab: "IfcSlab", land: "IfcGeographicElement", pool: "IfcBuildingElementProxy (สระ)", items: "IfcFurnishingElement", notes: "IfcAnnotation", asc: "IfcBuildingElementProxy", site: "IfcSite" };

/** opts: { view, sk, hist, M, status, sunNow, act(name), demo(), saveImage(blob, name), onChange() } */
export function initSkUI(opts) {
  const { view, sk, hist, M, status, sunNow, act } = opts;
  view.fmtLen = fmtLen; view.dimText = SETTINGS.dimText;
  const ext = new Tools3D(view, sk, { hist, status, onChange: opts.onChange, defaults: () => ({}), onSelect3D: (ks) => { renderTray("entity"); renderTray("outliner"); opts.onSelect3D && opts.onSelect3D(ks); } });
  if (store.get("theme", "")) document.documentElement.dataset.theme = store.get("theme", "");
  const toast = (m) => status(m);

  // ---------------------------------------------------------------- แถบเครื่องมือ (Standard · Shadows · Styles · Location · Views · ตัด/ฉาก)
  const tb = (id, title, ic, extra = "") => `<button type="button" class="sk" data-tbb="${id}" title="${esc(title)}" aria-label="${esc(title)}" ${extra}>${icon(ic || id)}</button>`;
  $("#tgStd").innerHTML = [["new", "ใหม่ (New · Ctrl+N)"], ["open", "เปิด (Open · Ctrl+O)"], ["save", "บันทึก (Save · Ctrl+S)"], ["cut", "ตัด (Cut · Ctrl+X)"], ["copy", "คัดลอก (Copy · Ctrl+C)"], ["paste", "วาง (Paste · Ctrl+V)"],
    ["erase", "ลบที่เลือก (Erase · Delete)"], ["undo", "ย้อน (Undo · Ctrl+Z)"], ["redo", "ทำซ้ำ (Redo · Ctrl+Y)"], ["print", "พิมพ์ / Plot PDF (Print)"], ["info", "ข้อมูลโมเดล (Model Info)"]].map(([k, t]) => tb(k, t)).join("");
  $("#skShadow").innerHTML = icon("shadow");
  $("#skStyles").innerHTML = STYLES.map((s) => `<button type="button" class="sk" data-style="${s.k}" title="${s.th} (${s.en})">${icon(s.k)}</button>`).join("");
  $("#tgLoc").innerHTML = tb("location", "ตำแหน่งที่ตั้ง (Add Location) — พิกัดโครงการ") + tb("terrain", "แสดง/ซ่อนภูมิประเทศ (Toggle Terrain): พื้นดิน + ภาพดาวเทียม");
  $("#skViews").innerHTML = [["iso", "ไอโซเมตริก (Iso)"], ["top", "ด้านบน (Top)"], ["front", "ด้านหน้า (Front)"], ["right", "ด้านขวา (Right)"], ["back", "ด้านหลัง (Back)"], ["left", "ด้านซ้าย (Left)"]]
    .map(([k, t]) => `<button type="button" class="sk" data-view3="${k}" title="${t}">${icon("v" + k)}</button>`).join("");
  const STD = {
    new: () => act("new"), open: () => $("#open-file").click(), save: () => act("save"), cut: () => ext.copy(true), copy: () => ext.copy(false), paste: () => ext.paste(),
    erase: () => { const a = ext.removeSel(); if (sk.sel.size) sk.remove(); else if (!a) status("เลือกวัตถุก่อน (เครื่องมือ เลือก)"); }, undo: () => act("undo"), redo: () => act("redo"), print: () => act("plot"), info: () => modelInfo("units"),
    location: () => modelInfo("geo"), terrain: () => { view.setTagVisible("site", view.hiddenTags.has("site")); refresh(); renderTray("tags"); status(view.hiddenTags.has("site") ? "ซ่อนภูมิประเทศ (พื้นดิน/ภาพดาวเทียม)" : "แสดงภูมิประเทศ"); },
  };
  $("#toolbars").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tbb]"); if (b && STD[b.dataset.tbb]) return STD[b.dataset.tbb]();
    const s = e.target.closest("[data-style]"); if (s) return setStyle(s.dataset.style);
    const v = e.target.closest("[data-view3]"); if (v) return view.setView(v.dataset.view3);
  });
  const setStyle = (k) => { view.setStyle(k); store.set("style", k); refresh(); renderTray("styles"); };
  $("#skShadow").onclick = () => { view.setShadows(!view.shadowsOn); refresh(); renderTray("shadows"); };
  // เดือน/เวลา ↔ ช่องวันที่/เวลาเดิม
  const mon = $("#skMonth"), tim = $("#skTime"), lbl = $("#skTimeLbl");
  const fromInputs = () => {
    const d = $("#sun-date").value, t = $("#sun-time").value || "10:00";
    if (d) mon.value = Number(d.split("-")[1]) - 1;
    const [hh, mm] = t.split(":").map(Number); tim.value = hh + mm / 60;
    lbl.textContent = `${t} น. · ${["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."][mon.value]}`;
  };
  mon.oninput = () => { const d = $("#sun-date").value || new Date().toISOString().slice(0, 10), [y] = d.split("-"); $("#sun-date").value = `${y}-${String(Number(mon.value) + 1).padStart(2, "0")}-15`; $("#sun-date").dispatchEvent(new Event("change")); fromInputs(); };
  tim.oninput = () => { const v = Number(tim.value), hh = Math.floor(v), mm = Math.round((v - hh) * 60 / 15) * 15; $("#sun-time").value = `${String(hh).padStart(2, "0")}:${String(mm % 60).padStart(2, "0")}`; $("#sun-time").dispatchEvent(new Event("input")); fromInputs(); };
  $("#sun-date").addEventListener("change", fromInputs); $("#sun-time").addEventListener("input", fromInputs);
  fromInputs();
  // ซ่อน/แสดงแถบ (View → Toolbars)
  const TG = [["std", "มาตรฐาน (Standard)", "#tgStd"], ["shadow", "เงา (Shadows)", "#tgShadow"], ["styles", "รูปแบบ (Styles)", "#skStyles"], ["loc", "ตำแหน่ง (Location)", "#tgLoc"], ["views", "มุมมอง (Views)", "#skViews"],
    ["sect", "ตัด + ฉาก (Section · Scenes)", "#tgSect"], ["big", "ชุดเครื่องมือใหญ่ (Large Tool Set)", "#tools3d"]];
  const tgHide = new Set(store.get("tgHide", []));
  const applyTg = () => { for (const [k, , sel] of TG) $(sel).hidden = tgHide.has(k); view.resize(); };
  function toolbarsDlg() {
    const d = dlg("tb-dlg", "แถบเครื่องมือ (Toolbars)", `<div style="display:grid;gap:6px">${TG.map(([k, t]) => `<label class="ck"><input type="checkbox" data-tg="${k}" ${tgHide.has(k) ? "" : "checked"}> ${t}</label>`).join("")}</div><p class="note">ติ๊กเลือกแถบที่จะแสดง (แบบ View → Toolbars ของ SketchUp) · จำค่าไว้ในเครื่องนี้</p>`);
    d.querySelectorAll("[data-tg]").forEach((c) => (c.onchange = () => { c.checked ? tgHide.delete(c.dataset.tg) : tgHide.add(c.dataset.tg); store.set("tgHide", [...tgHide]); applyTg(); }));
  }

  // ---------------------------------------------------------------- เครื่องมือผัง 2D (ซ้ายของผัง · 2 คอลัมน์ ชุดไอคอนเดียวกับ 3D)
  $("#tools").innerHTML = BIG2.map((row) => typeof row === "string" ? `<hr><small class="bigcap">${row}</small>` : row.map((t) => { const d = TOOLS2D[t], tt = `${d[0]}${d[1] ? " (" + d[1] + ")" : ""}`; return `<button type="button" data-tool="${t}" class="${t === "select" ? "on" : ""}" title="${esc(tt)}" aria-label="${esc(tt)}">${icon(d[2])}</button>`; }).join("")).join("");
  if ($("#fit2dBtn")) $("#fit2dBtn").innerHTML = icon("p2fit");
  // ---------------------------------------------------------------- ชุดเครื่องมือใหญ่ (ซ้าย · 2 คอลัมน์)
  const big = $("#tools3d");
  big.innerHTML = BIG.map((row) => row === "-" ? "<hr>" : row.map((t) => { if (!t) return "<span></span>"; const d = TOOLS[t], tt = `${d[0]} (${d[1]}${d[2] ? " · " + d[2] : ""})`; return ACTS.has(t) ? `<button type="button" data-a3="${t}" title="${esc(tt)}" aria-label="${esc(tt)}">${icon(ICK[t] || t)}</button>` : `<button type="button" data-t3="${t}" title="${esc(tt)}" aria-label="${esc(tt)}">${icon(ICK[t] || t)}</button>`; }).join("")).join("");
  big.addEventListener("click", (e) => { const b = e.target.closest("[data-a3]"); if (b) doAct(b.dataset.a3); });
  function doAct(a) {
    if (a === "component") return sk.group();
    if (a === "extents") return view.fit();
    if (a === "previous") return view.previous();
    if (a === "section") {
      const on = view.section == null, h = Math.round(((hist.doc.walls[0] && hist.doc.walls[0].height) || 3000) * 0.5);
      $("#section").value = on ? h : 12000; $("#section").dispatchEvent(new Event("input")); refresh();
      status(on ? `ระนาบตัดที่ ${fmtLen(h / 1000)} — เห็นภายในอาคาร · เลื่อนระดับที่แถบ ตัด · กดอีกครั้งเพื่อปิด` : "ปิดระนาบตัด");
    }
  }
  const orig = sk.setTool.bind(sk);
  sk.setTool = (t) => {
    orig(t);
    const L = view.controls.mouseButtons;
    L.LEFT = t === "pan" ? THREE.MOUSE.PAN : t === "zoom" ? THREE.MOUSE.DOLLY : THREE.MOUSE.ROTATE;
    if (t === "look" || t === "walk") { view.prevView = [view.camera.position.clone(), view.controls.target.clone()]; if (t === "walk") ext.startWalk(); else { const dir = view.controls.target.clone().sub(view.camera.position).normalize(); view.controls.target.copy(view.camera.position.clone().add(dir.multiplyScalar(0.3))); } }
    view.canvas.style.cursor = t === "pan" ? "grab" : t === "zoom" ? "zoom-in" : view.canvas.style.cursor;
    const d = TOOLS[t]; if (d && d[3]) status(`${d[0]} (${d[1]}): ${d[3]}`);
    if (t === "place") status(`วาง${ext.placing === "model" && ext.placeTpl ? " " + ext.placeTpl.name : (KINDS.find((k) => k.k === ext.placing) || {}).th || "ชิ้นส่วน"}: คลิกบนพื้น/หน้าบนกล่อง (วางหลายครั้งได้ · Esc จบ)`);
    renderTray("instructor"); renderTray("components");
  };
  // ตั้งกล้อง: คลิก (ไม่ลาก) บนพื้น/กล่อง
  let down = null; const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  view.canvas.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY }; });
  view.canvas.addEventListener("pointerup", (e) => {
    if (sk.tool !== "poscam" || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return;
    const r = view.canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, view.camera);
    const h = ray.intersectObjects([view.model, view.asc, view.ground], true).find((x) => x.object.isMesh); if (!h) return;
    const p = h.point, dir = view.controls.target.clone().sub(view.camera.position).setY(0).normalize();
    view.flyTo(new THREE.Vector3(p.x, p.y + 1.65, p.z), new THREE.Vector3(p.x, p.y + 1.6, p.z).addScaledVector(dir, 6));
    status("ยืนที่จุดคลิก ระดับสายตา 1.65 ม. · เลือก มองรอบ หรือ เดิน ต่อได้");
  });

  // ---------------------------------------------------------------- เมนู (9 เมนู แบบ SketchUp)
  const T3 = (t) => () => opts.setTool3d(t), T2 = (t) => () => opts.setTool2d(t);
  let mode = "split";
  const MENUS = [
    ["ไฟล์", [["ใหม่", "Ctrl+N", () => act("new")], ["เปิด…", "Ctrl+O", () => $("#open-file").click()], ["บันทึก", "Ctrl+S", () => act("save")], ["เปิดแบบตัวอย่าง: บ้าน 2 ชั้น คสล. + โซลาร์ (งานจริง)", "", () => opts.demo()], ["เปิดแบบตัวอย่าง: บ้านพร้อมสระ (ภาพนำเสนอ)", "", () => opts.demo("pool")], "-",
      ["นำเข้าไฟล์ CAD (DXF/DWG/PDF)…", "", () => act("cad")], ["นำเข้า 3D SketchUp (.skp, .dae)…", "", () => openImport3d({ hist, view, ext, status, setTool3d: opts.setTool3d, onChange: opts.onChange })], ["ภาพลอกแบบ…", "", () => $("#trace-file").click()], "-",
      ["ส่งออกภาพ (Render)…", "", () => renderDlg()], ["ส่งออก GLB → Blender", "", () => act("glb")], ["ส่งออก DXF (ผัง 2D)", "", () => act("dxf")], ["Plot PDF…", "Ctrl+P", () => act("plot")], ["ชุดแบบก่อสร้าง A3…", "", () => act("drawset")]]],
    ["แก้ไข", [["ย้อน", "Ctrl+Z", () => act("undo")], ["ทำซ้ำ", "Ctrl+Y", () => act("redo")], "-", ["ตัด", "Ctrl+X", () => ext.copy(true)], ["คัดลอก", "Ctrl+C", () => ext.copy(false)], ["วาง", "Ctrl+V", () => ext.paste()], ["ลบที่เลือก", "Delete", STD.erase], "-",
      ["เลือกทั้งหมด", "Ctrl+A", () => selectAll(), "3d"], ["ยกเลิกเลือก", "Esc", () => { sk.S.clear(); ext.selChanged(); }], "-", ["ลบเส้นไกด์ทั้งหมด", "", () => { hist.commit((d) => (d.guides = [])); opts.onChange(); status("ลบเส้นไกด์แล้ว"); }, "3d"], "-", ["รวมกลุ่ม (Make Group)", "", () => sk.group()], ["แยกกลุ่ม", "", () => sk.ungroup()]]],
    ["มุมมอง", [["แถบเครื่องมือ…", "", toolbarsDlg], ["ถาดเครื่องมือ (Default Tray)", "", () => toggleTray()], "-", ["เงา", "", () => $("#skShadow").click(), "3d"], ["หมอก", "", () => { view.setFog(!view.fogOn); status(view.fogOn ? "เปิดหมอก (ไกลจางลง)" : "ปิดหมอก"); }, "3d"],
      ["แกน", "", () => { view.axes.visible = !view.axes.visible; view.invalidate(); }, "3d"], "-", ...STYLES.map((s) => [`รูปแบบ: ${s.th}`, "", () => setStyle(s.k), "3d"]), "-",
      ["ผัง 2D อย่างเดียว", "", () => $('[data-view="2d"]').click()], ["ผัง 2D | 3D", "", () => $('[data-view="split"]').click()], ["3D อย่างเดียว", "", () => $('[data-view="3d"]').click()]]],
    ["กล้อง", [["ดูทั้งผัง 2D", "", () => act("fit2d"), "2d"], "-", ["มุมก่อนหน้า", "", () => view.previous()], "-", ...[["iso", "ไอโซเมตริก"], ["top", "ด้านบน"], ["front", "ด้านหน้า"], ["right", "ด้านขวา"], ["back", "ด้านหลัง"], ["left", "ด้านซ้าย"]].map(([k, t]) => [`มุมมองมาตรฐาน: ${t}`, "", () => view.setView(k)]), "-",
      ["ตั้งกล้อง", "", T3("poscam")], ["มองรอบ", "", T3("look")], ["เดิน", "", T3("walk")], "-", ["หมุนรอบ", "O", T3("orbit")], ["เลื่อนภาพ", "H", T3("pan")], ["ซูม", "Z", T3("zoom")], ["ซูมกรอบ", "", T3("zoomwin")], ["ดูทั้งหมด", "Shift+Z", () => view.fit()], "-",
      ["บันทึกมุมนี้เป็นฉาก…", "", () => act("scene-add")]]],
    ["วาด", [...["wall", "room", "door", "window", "box", "line", "dim", "text", "symbol"].map((t) => [`ผัง: ${TOOLS2D[t][0]}`, TOOLS2D[t][1], T2(t), "2d"]), "-",
      ...["line", "freehand", "rect", "rrect", "circle", "polygon", "arc", "arc2", "arc3", "pie"].map((t) => [`3D: ${TOOLS[t][0]}`, TOOLS[t][2], T3(t), "3d"])]],
    ["โครงสร้าง", [["ชั้นอาคาร · ตรวจขนาด · ตาราง…", "", () => act("struct")], ["ตรวจลำดับงาน…", "", () => act("workflow")], ["ตรวจตามมาตรฐาน…", "", () => act("standards")], "-", ...["column", "beam", "footing", "slab", "stair"].map((t) => [TOOLS2D[t][0], TOOLS2D[t][1], T2(t), "2d"]), "-",
      ["แสดงเฉพาะโครงสร้าง (ซ่อนผนัง หลังคา)", "", () => { for (const k of ["walls", "openings", "roof", "pv"]) view.setTagVisible(k, view.hiddenTags.has("struct") ? true : !view.hiddenTags.has(k) ? false : true); view.setTagVisible("struct", true); renderTray("tags"); status("สลับมุมมองโครงสร้าง (ถาด Tags เปิด/ปิดทีละกลุ่มได้)"); }, "3d"]]],
    ["เครื่องมือ", [...["select", "pan", "erase", "calib"].map((t) => [`ผัง: ${TOOLS2D[t][0]}`, TOOLS2D[t][1], T2(t), "2d"]), "-",
      ...["select", "component", "eraser", "tagtool", "paint", "move", "rotate", "scale", "offset", "pushpull", "follow"].map((t) => [TOOLS[t][0], TOOLS[t][2], ACTS.has(t) ? () => doAct(t) : T3(t), "3d"]), "-",
      ...["tape", "dim", "protractor", "text", "axes", "text3d"].map((t) => [TOOLS[t][0], TOOLS[t][2], T3(t), "3d"]), "-", ["ระนาบตัด (Section Plane)", "", () => doAct("section"), "3d"], ["ระนาบตัดบนหน้า (คลิกหน้าแล้วลากเข้า)", "", () => ext.sol.sectionStart(), "3d"], ["ล้างระนาบตัด", "", () => ext.sol.sectionClear(), "3d"], "-",
      ["Solid Tools: รวม (Union)", "", () => ext.sol.solidOp("union"), "3d"], ["Solid Tools: ลบ (Subtract)", "", () => ext.sol.solidOp("subtract"), "3d"], ["Solid Tools: ตัด (Trim)", "", () => ext.sol.solidOp("trim"), "3d"],
      ["Solid Tools: ตัดกัน (Intersect)", "", () => ext.sol.solidOp("intersect"), "3d"], ["Solid Tools: แยก (Split)", "", () => ext.sol.solidOp("split"), "3d"], ["Solid Tools: เปลือกนอก (Outer Shell)", "", () => ext.sol.solidOp("shell"), "3d"],
      ["ตัดกันที่ผิว: กับที่เลือก (Intersect Faces)", "", () => ext.sol.intersectWith("sel"), "3d"], ["ตัดกันที่ผิว: กับทั้งโมเดล", "", () => ext.sol.intersectWith("model"), "3d"], "-",
      ["ทำเป็น Component", "", () => ext.sol.makeComponent(), "3d"], ["แตกกลุ่ม/Component (Explode)", "", () => ext.sol.explodeSel(), "3d"], ["ซ่อนที่เลือก", "", () => ext.sol.hideSel(), "3d"], ["แสดงที่ซ่อนทั้งหมด", "", () => ext.sol.unhideAll(), "3d"],
      ["ล็อก/ปลดล็อก", "", () => ext.sol.lockSel(), "3d"], ["กลับด้านหน้า (Reverse Faces)", "", () => ext.sol.reverseSel(), "3d"], "-",
      ["Sandbox: พื้นผิวจากเส้นชั้นความสูง", "", () => ext.sol.terrainFromSel(), "3d"], ["Sandbox: พื้นผิวตาราง (From Scratch)", "", () => ext.sol.terrainGridNew(), "3d"], ["Sandbox: ดันพื้น (Smoove)", "", () => ext.sol.smooveStart(), "3d"]]],
    ["หน้าต่าง", [["ข้อมูลโมเดล (Model Info)", "", () => modelInfo("units")], ["ถาดเครื่องมือ (Default Tray)", "", () => toggleTray(true)], ["ชิ้นส่วน (Components)", "", () => openPanel("components"), "3d"], ["จับคู่ภาพถ่าย (Match Photo)", "", () => openPanel("match"), "3d"],
      ["โครงสร้างโมเดล (Outliner)", "", () => openPanel("outliner")], "-", ["สลับธีม สว่าง/มืด", "", () => { const r = document.documentElement, cur = r.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); r.dataset.theme = cur === "dark" ? "light" : "dark"; store.set("theme", r.dataset.theme); }]]],
    ["ส่วนเสริม", [["ASCA: โซลาร์ — ผลผลิต + สตริง + Single Line Diagram", "", () => act("solar")], ["ASCA: โครงสร้าง — ตรวจขนาด + ตาราง", "", () => act("struct")], ["ASCA: ผลผลิตไฟฟ้าโซลาร์ (หน้าหลัก pvlib)", "", () => act("yield")], ["ASCA: ชุดแบบก่อสร้าง + IFC", "", () => act("drawset")], ["ASCA: ร่างกล่องอาคารด้วย AI", "", () => act("ai-draft")],
      ["ASCA: Render สมจริงด้วย Blender", "", () => { act("glb"); status("ส่งออก GLB แล้ว → เปิดหน้าหลัก แท็บ Render (Blender) เพื่อ render แบบ path tracing"); }]]],
    ["ช่วยเหลือ", [["โหมดช่วยเหลือ (ชี้ปุ่มไหนก็ได้)", "F1", () => window.ascaHelp?.setMode(true)], ["คู่มือ ASC Architect", "", () => open("../manual/", "_blank")], ["คีย์ลัด", "Shift+F1", () => keysDlg()], ["ผู้แนะนำ (Instructor)", "", () => openPanel("instructor"), "3d"], ["เกี่ยวกับ ASC Architect", "", () => modelInfo("credits")]]],
  ];
  const mb = $("#menubar");
  MENUS.forEach(([name, items]) => {
    const w = document.createElement("div"), b = document.createElement("button"); b.type = "button"; b.textContent = name; w.append(b); mb.append(w);
    const openMenu = (e) => {
      e.stopPropagation(); const was = w.classList.contains("open"); closeMenus(); if (was && e.type === "click") return; w.classList.add("open");
      const r = b.getBoundingClientRect(), dd = document.createElement("div"); dd.className = "dd"; dd.id = "ddm";
      const vis = items.filter((it) => it === "-" || !it[3] || mode === "split" || it[3] === mode);
      vis.forEach((it, i) => { if (it === "-") { if (i && vis[i - 1] !== "-" && i < vis.length - 1) dd.append(document.createElement("hr")); return; } const x = document.createElement("button"); x.type = "button"; x.dataset.menu = `${name}/${it[0]}`; x.innerHTML = `${esc(it[0])}${it[1] ? `<kbd>${esc(it[1])}</kbd>` : ""}`; x.onclick = (ev) => { ev.stopPropagation(); closeMenus(); it[2](); }; dd.append(x); });
      document.body.append(dd); dd.style.left = Math.max(4, Math.min(r.left, innerWidth - dd.offsetWidth - 8)) + "px"; dd.style.top = r.bottom + 2 + "px";
    };
    b.onclick = openMenu; b.onmouseenter = (e) => { if ($("#ddm")) openMenu(e); };
    w.dataset.menu = name; w._items = items;
  });
  /** สลับโหมด 2D / 2D+3D / 3D: ซ่อนเมนูที่ไม่มีรายการของโหมดนั้น + แผงถาดตามโหมด */
  function applyMode(m) {
    mode = m;
    for (const w of $$(".menubar > div")) w.hidden = !(w._items || []).some((it) => it !== "-" && (!it[3] || m === "split" || it[3] === m));
    closeMenus(); renderTray(); refresh();
  }
  addEventListener("click", closeMenus);
  function closeMenus() { $("#ddm")?.remove(); $$(".menubar > div").forEach((d) => d.classList.remove("open")); }
  function selectAll() {
    const d = hist.doc; sk.S.clear();
    for (const [t, L] of [["walls", "walls"], ["masses", "masses"], ["items", "items3d"], ["struct", "struct"], ["sweeps", "sweeps"], ["lines", "lines"], ["texts3d", "texts3d"], ["dims3d", "dims3d"]]) for (const o of d[L] || []) sk.S.add(SEL.key(t, o.id));
    ext.selChanged(); status(`เลือกทั้งหมด ${sk.S.size} ชิ้น (ผนัง ${d.walls.length} · โครงสร้าง ${(d.struct || []).length} · กล่อง ${d.masses.length} · ชิ้นส่วน ${d.items3d.length})`);
  }

  // ---------------------------------------------------------------- ถาดเครื่องมือ (Default Tray · 11 แผง) — ติดขวา เปิดตั้งแต่เริ่ม
  const PANELS = [["entity", "ข้อมูลวัตถุ", "Entity Info"], ["materials", "วัสดุ", "Materials", "3d"], ["components", "ชิ้นส่วน", "Components", "3d"], ["styles", "รูปแบบ", "Styles", "3d"], ["tags", "Tags", "Tags", "3d"], ["shadows", "เงา", "Shadows", "3d"],
    ["scenes", "ฉาก", "Scenes", "3d"], ["instructor", "ผู้แนะนำ", "Instructor", "3d"], ["soften", "ลบเหลี่ยมขอบ", "Soften Edges", "3d"], ["match", "จับคู่ภาพถ่าย", "Match Photo", "3d"], ["outliner", "โครงสร้างโมเดล", "Outliner"]];
  const open = new Set(store.get("trayOpen", ["entity", "materials", "scenes"]));
  const thumbs = new Map(), photo = { url: null, op: 0.5 };
  const tagCount = () => { const c = {}; for (const m of view.meshes()) { const t = m.userData.tag, id = m.userData.id ?? m.uuid; (c[t] = c[t] || new Set()).add(id); } return c; };
  function panel(k) {
    const d = hist.doc;
    if (k === "entity") {
      const info = ext.selectedInfo();
      if (info && sk.S.size === 1) return entityHTML(d, [...sk.S]) + `<p class="note">ชิ้นส่วน: ${esc(info.th)} · ขนาดแบบ ${esc(info.size)} · Tag ${esc(info.tag)}</p>`;
      return entityHTML(d, [...sk.S]);
    }
    if (k === "materials") return `<div class="sw">${PALETTE.filter((p) => !p.hide).map((p) => { const u = swatch(p.key); return `<button type="button" data-mat="${p.key}" class="${sk.mat === p.key ? "on" : ""}" title="${esc(p.th)}" style="${u ? `background-image:url(${u})` : `background:${p.base}`}"><span>${esc(p.th)}</span></button>`; }).join("")}</div><p class="note">เลือกวัสดุ แล้วใช้ ถังสี คลิกผิว · หน้าที่วาดใหม่/กล่องใหม่ใช้วัสดุนี้ · ทุกลายมีความนูน (normal map) และความมันตามจริง</p>`;
    if (k === "components") return `<div class="cmp">${KINDS.map((c) => `<button type="button" data-cmp="${c.k}" class="${sk.tool === "place" && ext.placing === c.k ? "on" : ""}" title="${esc(c.size)}">${icon(c.k === "pv" ? "shaded" : c.k === "car" ? "viso" : "component")}${esc(c.th)}</button>`).join("")}</div>
      <label class="ck"><input type="checkbox" id="cRand" ${SETTINGS.compRandom ? "checked" : ""}> สุ่มมุมหมุน/ขนาดเล็กน้อย (ดูเป็นธรรมชาติ)</label><p class="note">คลิกชิ้นส่วน แล้วคลิกบนพื้นหรือหน้าบนกล่องเพื่อวาง (หลายครั้งได้ · Esc จบ) · ย้าย หมุน ย่อขยาย ลบ ได้เหมือนกล่อง · บันทึกในไฟล์แบบ</p>`;
    if (k === "styles") return `<div class="row">${STYLES.map((s) => `<button type="button" class="chipb${view.style === s.k ? " on" : ""}" data-style="${s.k}">${s.th}</button>`).join("")}</div>
      <label class="ck"><input type="checkbox" id="trAO" ${view.aoOn ? "checked" : ""}> เงาซอกมุม (AO) ในภาพนำเสนอ</label><label class="ck"><input type="checkbox" id="trFog" ${view.fogOn ? "checked" : ""}> หมอก (ไกลจางลง)</label><p class="note">ภาพนำเสนอ = วัสดุ PBR + ท้องฟ้าจริง + เงานุ่ม + AO + ลบรอยหยัก · การ์ดจออ่อนใช้ สีพื้น + ลายวัสดุ จะเร็วกว่า</p>`;
    if (k === "tags") { const c = tagCount(); return TAGS.map((t) => `<div class="tagrow"><button type="button" data-tag="${t.k}" title="เปิด/ปิด">${view.hiddenTags.has(t.k) ? "—" : "👁"}</button><label><input type="radio" name="curTag" value="${t.k}" ${SETTINGS.curTag === t.k ? "checked" : ""} title="Tag ปัจจุบัน (เครื่องมือ Tag)"> ${esc(t.th)}</label><small>${c[t.k] ? c[t.k].size : 0}</small></div>`).join("") + `<p class="note">👁 ปิด Tag = ซ่อนทุกชิ้นใน Tag นั้น (ไม่ลบ) · วงกลม = Tag ปัจจุบันของเครื่องมือ Tag</p>`; }
    if (k === "shadows") return `<div class="kv"><span>เงา</span><label class="ck" style="margin:0"><input type="checkbox" id="trSh" ${view.shadowsOn ? "checked" : ""}> แสดงเงา</label><span>เวลา</span><span>${esc($("#skTimeLbl").textContent)}</span><span>แสงแดด</span><input type="range" id="trLight" min="0.3" max="1.6" step="0.05" value="${view.light}"><span>พิกัด</span><span>${d.site.lat ?? 13.75}°N · ${d.site.lon ?? 100.52}°E</span></div><p class="note">เลื่อนเวลาใกล้ค่ำ (ราว 18:00) = ฉากพลบค่ำ ท้องฟ้าส้ม กระจกเรืองแสง โคมไฟติด</p>`;
    if (k === "scenes") { const sc = d.scenes || []; return (sc.length ? `<div class="scn">${sc.map((s, i) => `<button type="button" data-scn="${i}"><img alt="" src="${thumbs.get(i) || ""}">${esc(s.name)}</button>`).join("")}</div>` : `<p class="note">ยังไม่มีฉาก</p>`) +
      `<div class="row" style="margin-top:6px"><button type="button" class="chipb" data-scact="add">＋ เพิ่มฉาก</button><button type="button" class="chipb" data-scact="play" ${sc.length > 1 ? "" : "disabled"}>▶ เล่นฉาก</button><button type="button" class="chipb" data-scact="del" ${sc.length ? "" : "disabled"}>ลบฉากล่าสุด</button></div><p class="note">ฉาก = มุมกล้อง + วันเวลา · เวลาเปลี่ยนฉากตั้งที่ ข้อมูลโมเดล → ภาพเคลื่อนไหว</p>`; }
    if (k === "instructor") { const t = sk.tool, dd = TOOLS[t]; return `<b>${esc(dd ? `${dd[0]} (${dd[1]})` : t === "place" ? "วางชิ้นส่วน" : t)}</b><p class="note">${esc(dd ? dd[3] : "คลิกบนพื้นเพื่อวาง")}</p><p class="note">ทั่วไป: ล้อเมาส์ = ซูม · ปุ่มขวาลาก = เลื่อน · Esc = ยกเลิก/กลับเครื่องมือเลือก · Ctrl+Z ย้อน · ช่อง ระยะ ที่แถบล่างพิมพ์ค่าได้ระหว่างวาด</p>`; }
    if (k === "soften") return `<div class="kv"><span>มุมขอบ</span><input type="range" id="trSoft" min="1" max="89" value="${view.edgeAngle}"><span></span><span class="note" style="margin:0">ขอบหักมุมน้อยกว่า <b>${view.edgeAngle}</b>° ไม่แสดงเส้น (รูปแบบที่มีเส้น)</span></div>`;
    if (k === "match") return `<label class="btn" style="display:inline-block">เลือกภาพถ่ายหน้างาน…<input type="file" id="mpFile" accept="image/*" hidden></label>
      <div class="kv" style="margin-top:6px"><span>ความจาง</span><input type="range" id="mpOp" min="0.1" max="1" step="0.05" value="${photo.op}"><span>มุมเลนส์</span><input type="range" id="mpFov" min="15" max="90" step="1" value="${Math.round(view.camera.fov)}"><span></span><span class="mono" id="mpFovV">${Math.round(view.camera.fov)}°</span></div>
      <div class="row" style="margin-top:6px"><button type="button" class="chipb" id="mpHide" ${photo.url ? "" : "disabled"}>${$("#matchImg").hidden ? "แสดงภาพ" : "ซ่อนภาพ"}</button><button type="button" class="chipb" data-scact="add">บันทึกเป็นฉาก</button></div>
      <p class="note">วางภาพถ่ายทับมุมมอง 3D แล้วหมุน/เลื่อนกล้อง + ปรับมุมเลนส์ให้ขอบอาคารตรงภาพ → บันทึกเป็นฉาก · ภาพอยู่ในหน่วยความจำ ไม่บันทึกลงไฟล์แบบ</p>`;
    if (k === "outliner") {
      const row = (t, sel, attrs = "", dep = 1) => `<div class="orow${sel ? " on" : ""}" style="--d:${dep}" ${attrs}>${t}</div>`, s2 = M.summary(d), gs = new Map();
      const one = (t, o, label) => row(esc(label), sk.S.has(SEL.key(t, o.id)), `data-okey="${SEL.key(t, o.id)}"`, 2);
      const grp = (title, list, t, label) => list.length ? row(`▾ ${title} <small>${list.length}</small>`) + list.slice(0, 150).map((o, i) => one(t, o, label(o, i))).join("") : "";
      for (const m of d.masses) { const g = m.gid || m.id; gs.set(g, [...(gs.get(g) || []), m]); }
      const lv = (z) => (z || 0) >= 2500 ? "ชั้น 2" : "ชั้น 1";
      return `<div class="outl">${row(`▾ <b>${esc(d.name)}</b>`, false, "", 0)}
        ${grp("ผนัง", d.walls, "walls", (w) => `ผนัง ${lv(w.base)} · ${(M.wallLength(w) / 1000).toFixed(2)} ม.`)}
        ${grp("ประตู หน้าต่าง", d.openings, "openings", (o) => `${o.mark || (o.kind === "door" ? "ประตู" : "หน้าต่าง")} ${o.width}×${o.height}`)}
        ${row(`หลังคา ${esc(d.roof.type || "-")} · แผงโซลาร์ ${s2.pvCount || 0}`, sk.S.has("roof:roof"), 'data-okey="roof:roof"', 1)}
        ${grp("โครงสร้าง", d.struct || [], "struct", (o) => `${SEL.STRUCT_TH[o.kind] || ""} ${o.mark || ""}`)}
        ${d.masses.length ? row(`▾ กล่อง / หน้า <small>${d.masses.length}</small>`) + [...gs.values()].map((ms) => ms.length > 1 ? row(`▸ กลุ่ม ${ms.length} ชิ้น`, ms.every((m) => sk.sel.has(m.id)), `data-okey="masses:${ms[0].id}"`, 2) : one("masses", ms[0], ms[0].name || "กล่อง")).join("") : ""}
        ${grp("ชิ้นส่วน", d.items3d, "items", (it) => (it.kind === "model" ? `โมเดล 3D: ${it.name || ""}` : (KINDS.find((x) => x.k === it.kind) || { th: it.kind }).th))}
        ${grp("เส้น", d.lines, "lines", (l, i) => `เส้น ${i + 1}`)}${grp("หน้าตัดกวาด", d.sweeps, "sweeps", (x, i) => `Follow Me ${i + 1}`)}
        ${grp("ข้อความ 3D", d.texts3d, "texts3d", (x) => x.s)}${grp("มิติ 3D", d.dims3d, "dims3d", (x, i) => `มิติ ${i + 1}`)}
        ${row(`โมเดล ASC Studio <small>${view.asc.children.length ? "มี" : "-"}</small>`)}</div>`;
    }
    return "";
  }
  function renderTray(only) {
    const t = $("#props"); if (t.hidden) return;
    if (only && !open.has(only)) return;
    const body = $("#trayBody"), y = body.scrollTop;
    body.innerHTML = PANELS.filter((x) => !x[3] || mode === "split" || x[3] === mode).map(([k, th, en]) => `<div class="tp${open.has(k) ? " open" : ""}" data-p="${k}"><button type="button" class="th" data-tp="${k}">${th}<em>${en}</em></button><div class="tbody">${open.has(k) ? panel(k) : ""}</div></div>`).join("");
    body.scrollTop = y;
  }
  function openPanel(k, quiet) {
    if (quiet) { if ($("#props").hidden) return; if (!open.has(k)) { open.add(k); store.set("trayOpen", [...open]); renderTray(); } else renderTray(k); return; }
    toggleTray(true); open.add(k); store.set("trayOpen", [...open]); renderTray(); const el = $(`[data-p="${k}"]`); if (el) el.scrollIntoView({ block: "nearest" });
  }
  function toggleTray(force) { const t = $("#props"); t.hidden = force === true ? false : !t.hidden; store.set("tray", !t.hidden); if (!t.hidden) renderTray(); refresh(); setTimeout(() => view.resize(), 30); }
  $("#trayX").onclick = () => { toggleTray(); status("เปิดถาดอีกครั้ง: เมนู หน้าต่าง → ถาดเครื่องมือ"); };
  const tb3 = $("#trayBody");
  const editMass = (fn) => { const ids = new Set(sk.sel); hist.commit((d) => d.masses.forEach((m) => ids.has(m.id) && fn(m))); opts.onChange(); };
  const editItems = (fn) => { const ids = new Set(ext.itemSel); hist.commit((d) => d.items3d.forEach((x) => ids.has(x.id) && fn(x))); opts.onChange(); };
  tb3.addEventListener("click", (e) => {
    const tp = e.target.closest("[data-tp]"); if (tp) { const k = tp.dataset.tp; open.has(k) ? open.delete(k) : open.add(k); store.set("trayOpen", [...open]); if (k === "scenes" && open.has(k)) makeThumbs(); renderTray(); return; }
    const m = e.target.closest("[data-mat]"); if (m) { const sel = $("#mat3d"); sel.value = m.dataset.mat; sel.dispatchEvent(new Event("change")); renderTray("materials"); return; }
    const c = e.target.closest("[data-cmp]"); if (c) { ext.placing = c.dataset.cmp; opts.setTool3d("place"); return; }
    const s = e.target.closest("[data-style]"); if (s) return setStyle(s.dataset.style);
    const tg = e.target.closest("[data-tag]"); if (tg) { view.setTagVisible(tg.dataset.tag, view.hiddenTags.has(tg.dataset.tag)); renderTray("tags"); return; }
    const sc = e.target.closest("[data-scn]"); if (sc) return goScene(Number(sc.dataset.scn));
    const sa = e.target.closest("[data-scact]"); if (sa) { if (sa.dataset.scact === "add") { act("scene-add"); setTimeout(() => { makeThumbs(); renderTray("scenes"); }, 50); } if (sa.dataset.scact === "play") playScenes(); if (sa.dataset.scact === "del") { hist.commit((d) => d.scenes.pop()); opts.onChange(); renderTray("scenes"); } return; }
    const ok = e.target.closest("[data-okey]"); if (ok) { if (!e.shiftKey) sk.S.clear(); ext.expand(ok.dataset.okey).forEach((x) => sk.S.add(x)); ext.selChanged(); return; }
    const en = e.target.closest("[data-ent]"); if (en) { const a = en.dataset.ent;
      if (a === "del") ext.removeSel();
      if (a === "copy") { ext.copy(false); ext.paste(); }
      if (a === "door" || a === "window") { const wk = [...sk.S].find((x) => x.startsWith("walls:")), w = wk && SEL.find(hist.doc, wk); if (w) { const o = { id: M.uid("o"), wall: w.id, kind: a, t: 0.5, ...(a === "door" ? { width: 900, height: 2100, sill: 0 } : { width: 1200, height: 1100, sill: 900 }) }; hist.commit((dd) => dd.openings.push(o)); opts.onChange(); sk.S.clear(); sk.S.add("openings:" + o.id); ext.selChanged(); status(`เพิ่ม${a === "door" ? "ประตู" : "หน้าต่าง"}กลางผนังแล้ว — ใช้ ย้าย (M) เลื่อนไปตามผนัง`); } }
      return; }
    if (e.target.id === "mpHide") { $("#matchImg").hidden = !$("#matchImg").hidden; renderTray("match"); }
  });
  tb3.addEventListener("change", (e) => {
    const id = e.target.id, v = e.target.value;
    if (id === "trAO") { view.aoOn = e.target.checked; view.applyStyle(); }
    if (id === "trFog") view.setFog(e.target.checked);
    if (id === "trSh") { view.setShadows(e.target.checked); refresh(); }
    if (id === "trSoft") { view.setEdgeAngle(Number(v)); renderTray("soften"); }
    if (id === "cRand") { SETTINGS.compRandom = e.target.checked; saveSettings(); }
    const ent = e.target.closest(".ent [data-k]");
    if (ent) { const keys = e.target.closest(".ent").dataset.keys.split(","); let warn = ""; hist.commit((dd) => { warn = applyField(dd, keys, ent.dataset.k, ent.type === "checkbox" ? ent.checked : ent.value); }); if (warn && /ไม่ได้เปลี่ยน/.test(warn)) hist.undo(); opts.onChange(); renderTray("entity"); if (warn) status(warn); return; }
    if (id === "eName") editMass((m) => (m.name = v || "กล่อง"));
    if (id === "eTag") editMass((m) => (m.tag = v));
    if (id === "eH") editMass((m) => (m.height = Math.max(1, Number(v) || 1)));
    if (id === "eB") editMass((m) => (m.base = Number(v) || 0));
    if (id === "eS") editItems((x) => (x.s = Math.max(0.1, Number(v) || 1)));
    if (id === "eR") editItems((x) => (x.rot = ((Number(v) || 0) % 360 + 360) % 360));
    if (e.target.name === "curTag") { SETTINGS.curTag = v; saveSettings(); }
    if (id === "mpFile" && e.target.files[0]) { if (photo.url) URL.revokeObjectURL(photo.url); photo.url = URL.createObjectURL(e.target.files[0]); const im = $("#matchImg"); im.src = photo.url; im.style.opacity = photo.op; im.hidden = false; renderTray("match"); status("จับคู่ภาพถ่าย: หมุน/เลื่อนกล้อง + ปรับมุมเลนส์ให้อาคารตรงภาพ แล้วบันทึกเป็นฉาก"); }
  });
  tb3.addEventListener("input", (e) => {
    if (e.target.id === "trLight") view.setLight(Number(e.target.value));
    if (e.target.id === "mpOp") { photo.op = Number(e.target.value); $("#matchImg").style.opacity = photo.op; }
    if (e.target.id === "mpFov") { view.camera.fov = Number(e.target.value); view.camera.updateProjectionMatrix(); $("#mpFovV").textContent = e.target.value + "°"; }
  });
  function makeThumbs() { (hist.doc.scenes || []).forEach((s, i) => thumbs.set(i, view.thumbnail(s.pos, s.target))); }
  function goScene(i, ms) {
    const x = (hist.doc.scenes || [])[i]; if (!x) return;
    view.flyTo(new THREE.Vector3().fromArray(x.pos), new THREE.Vector3().fromArray(x.target), ms ?? (MI.trans ? MI.transSec * 1000 : 1));
    if (x.sun) { $("#sun-date").value = x.sun.date; $("#sun-time").value = x.sun.time; sunNow(); fromInputs(); }
    status(`ฉาก: ${x.name}`);
  }
  let playT = null;
  function playScenes() {
    clearTimeout(playT); const sc = hist.doc.scenes || []; let i = 0;
    const step = () => { if (i >= sc.length) return status("เล่นฉากครบแล้ว"); goScene(i++); playT = setTimeout(step, (MI.transSec + MI.delay) * 1000); };
    step();
  }

  // ---------------------------------------------------------------- หน้าต่างโต้ตอบ (Model Info · Toolbars · Render · คีย์ลัด)
  function dlg(id, title, html, foot = "") {
    let d = $("#" + id); if (!d) { d = document.createElement("div"); d.id = id; d.className = "dlg"; document.body.append(d); }
    d.hidden = false; d.innerHTML = `<div class="dlg-box"><h3>${title}</h3><div class="dlg-body">${html}</div><div class="dlg-foot"><span>${foot}</span><button type="button" data-x>ปิด</button></div></div>`;
    d.querySelector("[data-x]").onclick = () => (d.hidden = true); d.onclick = (e) => { if (e.target === d) d.hidden = true; };
    return d;
  }
  function modelInfo(page) {
    const pages = [["anim", "ภาพเคลื่อนไหว"], ["class", "การจัดประเภท"], ["comp", "ชิ้นส่วน"], ["credits", "ผู้สร้าง"], ["dims", "มิติ"], ["file", "ไฟล์"], ["geo", "ตำแหน่งที่ตั้ง"], ["render", "การแสดงผล"], ["stats", "สถิติ"], ["text", "ข้อความ"], ["units", "หน่วย"]];
    const d = hist.doc, sel = (id, list, cur) => `<select id="${id}">${list.map(([v, t]) => `<option value="${v}" ${String(cur) === String(v) ? "selected" : ""}>${t}</option>`).join("")}</select>`;
    const sec = (p) => {
      if (p === "units") return `<h4>หน่วยวัด</h4><div class="migrid">
        <label>รูปแบบ${sel("uFmt", [["decimal", "ทศนิยม (Decimal)"], ["architectural", "สถาปัตย์ (ฟุต-นิ้ว)"], ["engineering", "วิศวกรรม (ฟุต)"], ["fractional", "เศษส่วน (นิ้ว)"]], UNITS.format)}</label>
        <label>ความยาว<select id="uLen" ${UNITS.format !== "decimal" ? "disabled" : ""}>${[["mm", "มิลลิเมตร"], ["cm", "เซนติเมตร"], ["m", "เมตร"]].map(([v, t]) => `<option value="${v}" ${UNITS.len === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>
        <label>ความละเอียดที่แสดง${sel("uPrec", [0, 1, 2, 3].map((n) => [n, n ? "0." + "0".repeat(n) : "0"]), UNITS.prec)}</label>
        <label>จับมุมทุก (องศา)${sel("uAng", [5, 10, 15, 30, 45, 90].map((n) => [n, n]), UNITS.ang)}</label></div>
        <p class="note">ตัวอย่าง: ผนังยาว 4,250 มม. แสดงเป็น <b>${fmtLen(4.25)}</b> · ใช้กับตลับเมตร มิติ 3D และถาด ข้อมูลวัตถุ (ค่าในแบบเก็บเป็น มม. เสมอ)</p>`;
      if (p === "geo") return `<h4>ตำแหน่งที่ตั้ง</h4><div class="migrid"><label>ละติจูด (°N)<input type="number" step="any" id="gLat" value="${d.site.lat ?? ""}" placeholder="13.75"></label><label>ลองจิจูด (°E)<input type="number" step="any" id="gLon" value="${d.site.lon ?? ""}" placeholder="100.52"></label>
        <label>ทิศเหนือของแบบ (°)<input type="number" step="any" id="gNorth" value="${d.site.north || 0}"></label></div><p class="note">ใช้คำนวณดวงอาทิตย์และเงา · โครงการจาก ASC Studio ได้พิกัดอัตโนมัติ · ว่าง = ใช้กรุงเทพฯ</p>`;
      if (p === "render") return `<h4>การแสดงผล</h4><label class="ck"><input type="checkbox" id="rAA" ${view.smaa.enabled ? "checked" : ""}> ลบรอยหยัก (SMAA)</label><label class="ck"><input type="checkbox" id="rAO" ${view.aoOn ? "checked" : ""}> เงาซอกมุม AO (ภาพนำเสนอ)</label>
        <label class="ck"><input type="checkbox" id="rFog" ${view.fogOn ? "checked" : ""}> หมอก</label><div class="migrid" style="margin-top:8px"><label>ขนาดภาพ Render${sel("rRes", [["1920x1080", "1920 × 1080 (Full HD)"], ["2560x1440", "2560 × 1440 (2K)"], ["3840x2160", "3840 × 2160 (4K)"]], MI.res)}</label></div>
        <p class="note">📷 Render ภาพนำเสนอ (แถบล่างขวา) = ภาพนิ่งคุณภาพสูง (AO 32 ตัวอย่าง · เงา 4096) จากมุมที่เห็นอยู่ · ภาพสมจริงขั้นสุด: ส่งออก GLB → Render (Blender)</p>`;
      if (p === "stats") { const s = M.summary(d); return `<h4>สถิติ</h4><div class="kv"><span>ผนัง</span><b>${d.walls.length}</b><span>ช่องเปิด</span><b>${d.openings.length}</b><span>กล่อง/หน้า</span><b>${d.masses.length}</b><span>ชิ้นส่วน</span><b>${d.items3d.length}</b><span>เส้น</span><b>${d.lines.length}</b><span>ข้อความ/มิติ 3D</span><b>${d.texts3d.length} / ${d.dims3d.length}</b><span>หน้าตัดกวาด</span><b>${d.sweeps.length}</b><span>ฉาก</span><b>${(d.scenes || []).length}</b><span>แผงโซลาร์</span><b>${s.pvCount || 0} แผง · ${s.pvKwp || 0} kWp</b><span>ชิ้นใน 3D</span><b>${view.meshes().length}</b></div>`; }
      if (p === "anim") return `<h4>ภาพเคลื่อนไหว (การเปลี่ยนฉาก)</h4><label class="ck"><input type="checkbox" id="aOn" ${MI.trans ? "checked" : ""}> เปิดการเลื่อนกล้องระหว่างฉาก</label><div class="migrid" style="margin-top:8px"><label>เวลาเปลี่ยนฉาก (วินาที)<input type="number" id="aSec" min="0.2" max="10" step="0.1" value="${MI.transSec}"></label><label>หยุดที่แต่ละฉาก (วินาที)<input type="number" id="aDelay" min="0" max="20" step="0.5" value="${MI.delay}"></label></div><p class="note">ใช้กับการคลิกฉากในถาด และปุ่ม ▶ เล่นฉาก</p>`;
      if (p === "class") { const ms = [...sk.sel].map((id) => d.masses.find((m) => m.id === id)).filter(Boolean); return `<h4>การจัดประเภท (Classifications · IFC)</h4><div class="kv">${TAGS.map((t) => `<span>${esc(t.th)}</span><span class="mono">${IFC[t.k] || "-"}</span>`).join("")}</div>
        ${ms.length ? `<div class="migrid" style="margin-top:8px"><label>ประเภทของกล่องที่เลือก (${ms.length})${sel("cIfc", [["", "ตาม Tag"], ["IfcColumn", "IfcColumn เสา"], ["IfcBeam", "IfcBeam คาน"], ["IfcSlab", "IfcSlab พื้น"], ["IfcWall", "IfcWall ผนัง"], ["IfcRoof", "IfcRoof หลังคา"], ["IfcStair", "IfcStair บันได"], ["IfcFurnishingElement", "IfcFurnishingElement ครุภัณฑ์"]], ms[0].ifc || "")}</label></div>` : `<p class="note">เลือกกล่องก่อน เพื่อกำหนดประเภทรายชิ้น</p>`}
        <p class="note">ประเภทที่กำหนดเก็บในไฟล์แบบ (ช่อง ifc ของกล่อง) — ชุดแบบ/IFC รุ่นนี้ยังจัดประเภทตามชนิดวัตถุเอง ไม่ได้อ่านช่องนี้</p>`; }
      if (p === "comp") { const n = {}; d.items3d.forEach((x) => (n[x.kind] = (n[x.kind] || 0) + 1)); return `<h4>ชิ้นส่วน (Components)</h4><label class="ck"><input type="checkbox" id="cR2" ${SETTINGS.compRandom ? "checked" : ""}> สุ่มมุมหมุน/ขนาดตอนวาง</label><div class="migrid" style="margin-top:8px"><label>ขนาดเริ่มต้น (เท่า)${sel("cScale", [[0.75, "0.75"], [1, "1.0"], [1.25, "1.25"], [1.5, "1.5"]], SETTINGS.compScale)}</label></div>
        <div class="kv" style="margin-top:8px">${KINDS.map((k) => `<span>${esc(k.th)}</span><b>${n[k.k] || 0}</b>`).join("")}</div>`; }
      if (p === "credits") return `<h4>ผู้สร้าง</h4><p data-brand="block"></p><div class="migrid"><label>ผู้ออกแบบ / ผู้เขียนแบบ<input id="crAuthor" value="${esc((d.credits && d.credits.author) || "")}" placeholder="ชื่อผู้ออกแบบ"></label></div><p class="note">ASCA · Design · Structure · Single line diagrams · ชิ้นส่วน 3D ทั้งหมดสร้างในโปรแกรม (ไม่มีลิขสิทธิ์ของผู้อื่น)</p>`;
      if (p === "dims") return `<h4>มิติ (Dimensions)</h4><div class="migrid"><label>ความสูงตัวเลขมิติ (มม.)${sel("dH", [[150, "150"], [250, "250"], [400, "400"], [600, "600"]], SETTINGS.dimText)}</label></div><button type="button" id="dAll" style="margin-top:8px">ใช้กับมิติ 3D ที่มีอยู่ทั้งหมด (${d.dims3d.length})</button><p class="note">หน่วยของตัวเลขตามหน้า หน่วย · เส้นมิติยกขึ้นจากจุดวัด 400 มม.</p>`;
      if (p === "file") { const kb = (new Blob([JSON.stringify(d)]).size / 1024).toFixed(1); return `<h4>ไฟล์</h4><div class="kv"><span>ชื่อแบบ</span><b>${esc(d.name)}</b><span>รุ่นไฟล์</span><b>${esc(d.app)} v${d.version}</b><span>ขนาด</span><b>${kb} KB</b><span>สถานะ</span><b>${esc($("#saved").textContent || "บันทึกแล้ว")}</b><span>หน่วยในไฟล์</span><b>มิลลิเมตร</b></div><button type="button" id="fSave" style="margin-top:8px">บันทึกตอนนี้ (Ctrl+S)</button><p class="note">เปลี่ยนชื่อแบบที่ช่องชื่อมุมซ้ายบน · ไฟล์เป็น .json เปิดซ้ำได้ด้วย ไฟล์ → เปิด</p>`; }
      if (p === "text") return `<h4>ข้อความ</h4><div class="migrid"><label>ข้อความชี้: สูง (มม.)${sel("tH", [[150, "150"], [250, "250"], [400, "400"]], SETTINGS.textH)}</label><label>ข้อความ 3D: สูง (มม.)${sel("t3H", [[300, "300"], [600, "600"], [1000, "1,000"], [1500, "1,500"]], SETTINGS.text3dH)}</label></div><p class="note">ใช้กับข้อความที่วางต่อจากนี้ · แก้ข้อความเดิม: ลบแล้ววางใหม่</p>`;
      return "";
    };
    const dd = dlg("mi-dlg", "ข้อมูลโมเดล (Model Info)", `<div class="mibody"><nav>${pages.map(([k, t]) => `<button type="button" data-mi="${k}" class="${k === page ? "on" : ""}">${t}</button>`).join("")}</nav><section id="miS">${sec(page)}</section></div>`);
    dd.querySelector(".dlg-box").classList.add("mi");
    const wire = (p) => {
      const set = (k, v) => { UNITS[k] = v; store.set("units", UNITS); $("#miS").innerHTML = sec("units"); wire("units"); renderTray(); view.buildNotes(); };
      const on = (id, ev, fn) => { const el = $("#" + id); if (el) el[ev] = () => fn(el); };
      on("uFmt", "onchange", (el) => set("format", el.value)); on("uLen", "onchange", (el) => set("len", el.value)); on("uPrec", "onchange", (el) => set("prec", Number(el.value))); on("uAng", "onchange", (el) => { set("ang", Number(el.value)); SETTINGS.rotStep = Number(el.value); });
      on("rAA", "onchange", (el) => (view.smaa.enabled = el.checked)); on("rAO", "onchange", (el) => { view.aoOn = el.checked; view.applyStyle(); }); on("rFog", "onchange", (el) => view.setFog(el.checked)); on("rRes", "onchange", (el) => { MI.res = el.value; saveSettings(); });
      const geo = () => { hist.commit((dd2) => { const la = $("#gLat").value, lo = $("#gLon").value; dd2.site.lat = la === "" ? null : Number(la); dd2.site.lon = lo === "" ? null : Number(lo); dd2.site.north = Number($("#gNorth").value) || 0; }); opts.onChange(); sunNow(); };
      on("gLat", "onchange", geo); on("gLon", "onchange", geo); on("gNorth", "onchange", geo);
      on("aOn", "onchange", (el) => { MI.trans = el.checked; saveSettings(); }); on("aSec", "onchange", (el) => { MI.transSec = Number(el.value) || 1.5; saveSettings(); }); on("aDelay", "onchange", (el) => { MI.delay = Number(el.value) || 0; saveSettings(); });
      on("cIfc", "onchange", (el) => editMass((m) => (el.value ? (m.ifc = el.value) : delete m.ifc)));
      on("cR2", "onchange", (el) => { SETTINGS.compRandom = el.checked; saveSettings(); }); on("cScale", "onchange", (el) => { SETTINGS.compScale = Number(el.value); saveSettings(); });
      on("crAuthor", "onchange", (el) => { hist.commit((dd2) => (dd2.credits = { ...(dd2.credits || {}), author: el.value })); opts.onChange(); });
      on("dH", "onchange", (el) => { SETTINGS.dimText = Number(el.value); view.dimText = SETTINGS.dimText; saveSettings(); }); on("dAll", "onclick", () => { hist.commit((dd2) => dd2.dims3d.forEach((x) => (x.h = SETTINGS.dimText))); opts.onChange(); status("ปรับความสูงตัวเลขมิติทั้งหมดแล้ว"); });
      on("fSave", "onclick", () => act("save")); on("tH", "onchange", (el) => { SETTINGS.textH = Number(el.value); saveSettings(); }); on("t3H", "onchange", (el) => { SETTINGS.text3dH = Number(el.value); saveSettings(); });
      if (window.ascaBrandRefresh) window.ascaBrandRefresh();
    };
    dd.querySelectorAll("[data-mi]").forEach((b) => (b.onclick = () => { dd.querySelectorAll("[data-mi]").forEach((x) => x.classList.toggle("on", x === b)); $("#miS").innerHTML = sec(b.dataset.mi); wire(b.dataset.mi); }));
    wire(page);
  }
  function renderDlg() {
    const [w, h] = MI.res.split("x").map(Number), was = view.style;
    if (was !== "render") view.setStyle("render");
    status(`กำลัง Render ${w}×${h}…`);
    setTimeout(async () => {
      const url = view.renderStill(w, h, false); if (was !== "render") view.setStyle(was);
      const d = dlg("render-dlg", "📷 ภาพนำเสนอ (Render)", `<div class="shot"><img src="${url}" alt="ภาพ render จากมุมที่เห็นอยู่"></div><p class="note">${w} × ${h} · AO 32 ตัวอย่าง · เงา 4096 · จากมุมกล้องปัจจุบัน · เปลี่ยนขนาดที่ ข้อมูลโมเดล → การแสดงผล</p>`,
        `<button type="button" class="accent" id="rSave">บันทึกภาพ PNG</button>`);
      d.querySelector(".dlg-box").classList.add("wide");
      $("#rSave").onclick = async () => { const blob = await (await fetch(url)).blob(); await opts.saveImage(blob, `_render_${w}x${h}.png`); };
      status(`Render เสร็จ ${w}×${h}`);
    }, 40);
  }
  function keysDlg() {
    const k3 = Object.entries(TOOLS).filter(([, d]) => d[2]).map(([, d]) => `<tr><td>${esc(d[2])}</td><td>${esc(d[0])} (${esc(d[1])})</td></tr>`).join("");
    dlg("keys-dlg", "คีย์ลัด", `<table class="k"><tr><th colspan="2">มุมมอง 3D (ชี้เมาส์ในช่อง 3D)</th></tr>${k3}<tr><td>Ctrl+C / X / V</td><td>คัดลอก / ตัด / วาง กล่องและชิ้นส่วน</td></tr><tr><td>Ctrl+A</td><td>เลือกทั้งหมด</td></tr><tr><td>Delete</td><td>ลบที่เลือก</td></tr><tr><td>Esc</td><td>ยกเลิกการวาด / กลับเครื่องมือเลือก</td></tr><tr><td>Enter</td><td>จบเส้น · ใช้ค่าที่พิมพ์ในช่องระยะ</td></tr>
      <tr><th colspan="2">ทั่วไป</th></tr><tr><td>Ctrl+Z / Ctrl+Y</td><td>ย้อน / ทำซ้ำ</td></tr><tr><td>Ctrl+S</td><td>บันทึก</td></tr><tr><td>ล้อเมาส์</td><td>ซูม</td></tr><tr><td>ปุ่มขวาลาก</td><td>เลื่อนภาพ</td></tr><tr><td>V H W R D N B L M T S E K</td><td>เครื่องมือผัง 2D (ชี้เมาส์ในผัง)</td></tr></table>`);
  }

  function refresh() {
    $$("#skStyles [data-style]").forEach((b) => b.classList.toggle("on", b.dataset.style === view.style));
    $("#skShadow").classList.toggle("on", view.shadowsOn);
    $$('[data-tbb="terrain"]').forEach((b) => b.classList.toggle("on", !view.hiddenTags.has("site")));
    $$('[data-a3="section"]').forEach((b) => b.classList.toggle("on", view.section != null));
    const st = STYLES.find((s) => s.k === view.style);
    $("#vlabel").textContent = (st ? st.th : "") + (view.section != null ? ` · ตัดที่ ${fmtLen(view.section / 1000)}` : "") + (sk.tool === "walk" ? " · เดิน" : "");
  }
  // เริ่ม: รูปแบบ/ถาด/แถบที่จำไว้
  view.setStyle(store.get("style", "render"));
  $("#props").hidden = !store.get("tray", innerWidth >= 900);   // จอแคบ: ถาดเป็นแผงลอย เริ่มแบบปิด
  applyTg(); refresh(); renderTray();
  view.onBuilt = ((prev) => () => { prev && prev(); renderTray("entity"); renderTray("outliner"); renderTray("tags"); refresh(); })(view.onBuilt);
  $("#section").addEventListener("input", () => refresh());
  $("#renderBtn").onclick = renderDlg;
  return { renderTray, openPanel, modelInfo, refresh, renderDlg, keysDlg, ext, selectAll, doAct, closeMenus, applyMode };
}
