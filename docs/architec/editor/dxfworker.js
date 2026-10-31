// อ่าน DXF ใน Web Worker (หน้าเว็บไม่ค้างตอนอ่านไฟล์ใหญ่) — รุ่นออนไลน์ (โดย ลุงพี)
import { readDXF, decodeDXF } from "./dxfread.js?v=0.16.0";

self.onmessage = (ev) => {
  const { buf, name } = ev.data;
  try { self.postMessage({ data: readDXF(decodeDXF(buf), name) }); } catch (e) { self.postMessage({ error: e.message || String(e) }); }
};
