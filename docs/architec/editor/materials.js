// วัสดุสำหรับทาสี (แบบ paint bucket ของ SketchUp) — ลายสร้างจาก canvas ในเครื่อง ไม่ต้องโหลดภาพ (โดย ลุงพี)
import * as THREE from "three";

export const PALETTE = [
  { key: "white", th: "ทาสีขาว", color: "#ece6dc", rough: 0.85 },
  { key: "concrete", th: "คอนกรีต", color: "#a8a49b", rough: 0.92, tex: "noise" },
  { key: "brick", th: "อิฐแดง", color: "#a5523a", rough: 0.9, tex: "brick" },
  { key: "wood", th: "ไม้", color: "#9c6b3f", rough: 0.7, tex: "wood" },
  { key: "glass", th: "กระจก", color: "#9fc7e6", rough: 0.05, glass: true },
  { key: "metal", th: "เมทัลชีท", color: "#8c96a3", rough: 0.35, metal: 0.6, tex: "ribs" },
  { key: "roof_red", th: "หลังคาแดง", color: "#9b3b2c", rough: 0.6, tex: "ribs" },
  { key: "grass", th: "หญ้า", color: "#6f9a4c", rough: 0.95, tex: "noise" },
  { key: "tile", th: "กระเบื้องพื้น", color: "#d9d3c7", rough: 0.4, tex: "tile" },
  { key: "dark", th: "เทาเข้ม", color: "#4a4f57", rough: 0.6 },
];
const cache = new Map();

function canvasTex(kind, base) {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d"); g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  const shade = (a) => `rgba(0,0,0,${a})`, light = (a) => `rgba(255,255,255,${a})`;
  if (kind === "noise") for (let i = 0; i < 4000; i++) { g.fillStyle = Math.random() < 0.5 ? shade(0.06) : light(0.06); g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  if (kind === "brick") { g.fillStyle = "#cfc6b8"; for (let y = 0; y < 256; y += 32) { g.fillRect(0, y, 256, 4); for (let x = (y / 32) % 2 ? 0 : 32; x < 256; x += 64) g.fillRect(x, y, 4, 32); } }
  if (kind === "wood") for (let y = 0; y < 256; y += 6) { g.strokeStyle = shade(0.08 + Math.random() * 0.08); g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(80, y + 4, 170, y - 4, 256, y + 2); g.stroke(); }
  if (kind === "ribs") for (let x = 0; x < 256; x += 32) { g.fillStyle = light(0.18); g.fillRect(x, 0, 6, 256); g.fillStyle = shade(0.15); g.fillRect(x + 6, 0, 3, 256); }
  if (kind === "tile") { g.strokeStyle = shade(0.2); g.lineWidth = 3; for (let i = 0; i <= 256; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); } }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(0.5, 0.5);                                              // ExtrudeGeometry ใช้ UV เป็นเมตร → ลาย 1 ชุด ≈ 2 ม.
  return t;
}

export function material(key) {
  const p = PALETTE.find((x) => x.key === key) || PALETTE[0];
  if (cache.has(p.key)) return cache.get(p.key);
  let m;
  if (p.glass) m = new THREE.MeshPhysicalMaterial({ color: p.color, roughness: p.rough, transmission: 0.55, transparent: true, opacity: 0.5 });
  else m = new THREE.MeshStandardMaterial({ color: p.tex ? "#ffffff" : p.color, roughness: p.rough, metalness: p.metal || 0, map: p.tex ? canvasTex(p.tex, p.color) : null });
  m.name = p.th;
  cache.set(p.key, m);
  return m;
}
