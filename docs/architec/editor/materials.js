// วัสดุ PBR สำหรับทาสี (แบบ paint bucket ของ SketchUp) และภาพนำเสนอ — ลาย + ความนูน (normal map) วาดจาก canvas ในเครื่อง
// ไม่ต้องโหลดภาพ · UV ของโมเดลเป็นเมตร → tile = ขนาดลาย 1 รอบ (ม.) (โดย ลุงพี)
import * as THREE from "three";

// key เดิมยังใช้ได้ทุกตัว (แบบที่บันทึกไว้ทาสีด้วย key เหล่านี้)
export const PALETTE = [
  { key: "white", th: "ผนังฉาบสีขาว", tex: "plaster", base: "#e2dcd2", tile: 2.5, rough: 0.9, ns: 0.4 },
  { key: "concrete", th: "คอนกรีตขัดมัน", tex: "concrete", base: "#a9a59e", tile: 3, rough: 0.75, ns: 0.3 },
  { key: "brick", th: "อิฐแดง", tex: "brick", base: "#a5523a", tile: 1.2, rough: 0.9, ns: 1.2 },
  { key: "wood", th: "ไม้ระแนง", tex: "wood", base: "#9c6b3f", tile: 1.4, rough: 0.62, ns: 1 },
  { key: "deck", th: "พื้นไม้เทียม", tex: "deck", base: "#8a5a34", tile: 1.6, rough: 0.7, ns: 1 },
  { key: "stone", th: "หินกาบ", tex: "stone", base: "#9a8f80", tile: 1.6, rough: 0.92, ns: 1.2 },
  { key: "granite", th: "พื้นหินแกรนิต", tex: "paving", base: "#b5afa6", tile: 1.2, rough: 0.7, ns: 0.6 },
  { key: "tile", th: "กระเบื้องพื้น", tex: "tile", base: "#d9d3c7", tile: 1.2, rough: 0.4, ns: 0.5 },
  { key: "glass", th: "กระจก", glass: true, base: "#51646f" },
  { key: "metal", th: "เมทัลชีทเทาเข้ม", tex: "ribs", base: "#3c4148", tile: 1.2, rough: 0.42, metal: 0.55, ns: 1 },
  { key: "roof_red", th: "หลังคาแดง", tex: "ribs", base: "#8e3a2b", tile: 1.2, rough: 0.55, metal: 0.2, ns: 1 },
  { key: "grass", th: "หญ้า", tex: "grass", base: "#4f7a33", tile: 3, rough: 1, ns: 0.8, env: 0.5 },
  { key: "dark", th: "เทาเข้ม", base: "#4a4f57", rough: 0.6 },
  { key: "alu", th: "อลูมิเนียมดำ", base: "#26292d", rough: 0.35, metal: 0.75 },
  { key: "pv", th: "แผงโซลาร์", tex: "pv", base: "#0d1626", tile: 1, rough: 0.2, metal: 0.35, env: 1.6, ns: 0 },
  { key: "water", th: "น้ำในสระ", water: true, base: "#2f9fc6" },
  { key: "pooltile", th: "กระเบื้องสระ", tex: "pooltile", base: "#3b9cc4", tile: 0.6, rough: 0.35, ns: 0.6 },
  { key: "fabric", th: "ผ้าโซฟา", tex: "fabric", base: "#6f747b", tile: 0.5, rough: 0.95, ns: 0.5 },
  { key: "interior", th: "ผนังภายใน", base: "#d9cfc0", rough: 0.9 },
  { key: "white2", th: "สีขาวเรียบ", base: "#f1efea", rough: 0.6 },
  { key: "carpaint", th: "สีรถ (เมทัลลิก)", car: true, base: "#9aa4ae" },
  { key: "trunk", th: "ลำต้นไม้", base: "#5a4331", rough: 0.95, hide: true },
  { key: "leaf", th: "ใบไม้", leaf: true, base: "#3d6b2a", hide: true },
  { key: "lamp", th: "โคมไฟ", lamp: true, base: "#fff1d6", hide: true },
];
const cache = new Map(), texCache = new Map();
const R = (a, b) => a + Math.random() * (b - a);

function normalFrom(h, strength) {
  const s = h.width, src = h.getContext("2d").getImageData(0, 0, s, s).data, c = document.createElement("canvas"); c.width = c.height = s;
  const g = c.getContext("2d"), img = g.createImageData(s, s), d = img.data, H = (x, y) => src[((((y + s) % s) * s) + ((x + s) % s)) * 4] / 255;
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength, l = Math.hypot(dx, dy, 1), i = (y * s + x) * 4;
    d[i] = (-dx / l * 0.5 + 0.5) * 255; d[i + 1] = (dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); return c;
}
function speckle(g, s, n, cols, sz = 2) { for (let i = 0; i < n; i++) { g.fillStyle = cols[(Math.random() * cols.length) | 0]; const r = R(0.5, sz); g.fillRect(Math.random() * s, Math.random() * s, r, r); } }
/** ลายแต่ละแบบ: ระบายสีลงภาพสี (g) + ความสูงลงภาพเทา (h) */
const PAINT = {
  plaster(g, h, s, base) { g.fillStyle = base; g.fillRect(0, 0, s, s); speckle(g, s, 9000, ["rgba(0,0,0,.035)", "rgba(255,255,255,.08)", "rgba(120,100,80,.04)"], 3); speckle(h, s, 12000, ["#7a7a7a", "#888", "#828282"], 3); },
  concrete(g, h, s, base) { g.fillStyle = base; g.fillRect(0, 0, s, s); for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? "0,0,0" : "255,255,255"},${R(0.02, 0.06)})`; g.beginPath(); g.arc(R(0, s), R(0, s), R(20, 90), 0, 7); g.fill(); } speckle(g, s, 8000, ["rgba(0,0,0,.07)", "rgba(255,255,255,.06)"]); speckle(h, s, 9000, ["#777", "#8a8a8a"]); },
  brick(g, h, s, base) {
    g.fillStyle = "#cfc6b8"; g.fillRect(0, 0, s, s); h.fillStyle = "#202020"; h.fillRect(0, 0, s, s);
    const bh = 32, bw = 96; for (let y = 0; y < s; y += bh) for (let x = (y / bh) % 2 ? -bw / 2 : 0; x < s; x += bw) {
      const c = new THREE.Color(base).offsetHSL(R(-0.02, 0.02), R(-0.1, 0.05), R(-0.08, 0.06)); g.fillStyle = "#" + c.getHexString(); g.fillRect(x + 3, y + 3, bw - 6, bh - 6); h.fillStyle = "#c8c8c8"; h.fillRect(x + 3, y + 3, bw - 6, bh - 6);
    }
    speckle(g, s, 6000, ["rgba(0,0,0,.08)", "rgba(255,255,255,.05)"]);
  },
  wood(g, h, s) {
    const bw = 64; for (let x = 0; x < s; x += bw) {
      g.fillStyle = `hsl(${R(24, 30)}, ${R(38, 48)}%, ${R(34, 44)}%)`; g.fillRect(x, 0, bw, s);
      for (let k = 0; k < 26; k++) { g.strokeStyle = `rgba(40,20,5,${R(0.05, 0.16)})`; g.lineWidth = R(0.6, 2); const xx = x + R(4, bw - 4); g.beginPath(); g.moveTo(xx, 0); g.bezierCurveTo(xx + R(-4, 4), s * 0.3, xx + R(-4, 4), s * 0.7, xx + R(-2, 2), s); g.stroke(); }
      g.fillStyle = "#1b120b"; g.fillRect(x + bw - 7, 0, 7, s); h.fillStyle = "#c8c8c8"; h.fillRect(x, 0, bw - 7, s); h.fillStyle = "#202020"; h.fillRect(x + bw - 7, 0, 7, s);
    }
  },
  deck(g, h, s) {
    const bh = 42; for (let y = 0; y < s; y += bh) {
      g.fillStyle = `hsl(${R(22, 28)}, ${R(35, 45)}%, ${R(38, 47)}%)`; g.fillRect(0, y, s, bh);
      for (let k = 0; k < 16; k++) { g.strokeStyle = `rgba(50,25,8,${R(0.05, 0.14)})`; g.beginPath(); const yy = y + R(3, bh - 4); g.moveTo(0, yy); g.bezierCurveTo(s * 0.3, yy + R(-3, 3), s * 0.6, yy + R(-3, 3), s, yy); g.stroke(); }
      g.fillStyle = "#24170d"; g.fillRect(0, y + bh - 4, s, 4); h.fillStyle = "#c0c0c0"; h.fillRect(0, y, s, bh - 4); h.fillStyle = "#303030"; h.fillRect(0, y + bh - 4, s, 4);
    }
  },
  stone(g, h, s) {
    g.fillStyle = "#6d665d"; g.fillRect(0, 0, s, s); h.fillStyle = "#202020"; h.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 40) { let x = -R(0, 60); while (x < s) { const w = R(50, 120); g.fillStyle = `hsl(${R(28, 40)}, ${R(8, 18)}%, ${R(48, 68)}%)`; g.fillRect(x + 3, y + 3, w - 6, 34); h.fillStyle = "#d0d0d0"; h.fillRect(x + 3, y + 3, w - 6, 34); x += w; } }
    speckle(g, s, 7000, ["rgba(0,0,0,.08)", "rgba(255,255,255,.07)"], 3);
  },
  paving(g, h, s) {
    const t = 128; for (let y = 0; y < s; y += t) for (let x = 0; x < s; x += t) { g.fillStyle = `hsl(35, 8%, ${R(66, 76)}%)`; g.fillRect(x, y, t, t); h.fillStyle = "#c0c0c0"; h.fillRect(x + 3, y + 3, t - 6, t - 6); }
    g.strokeStyle = "rgba(60,55,50,.6)"; g.lineWidth = 4; for (let i = 0; i <= s; i += t) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.moveTo(0, i); g.lineTo(s, i); g.stroke(); }
    speckle(g, s, 6000, ["rgba(0,0,0,.06)", "rgba(255,255,255,.08)"]);
  },
  tile(g, h, s, base) {
    g.fillStyle = base; g.fillRect(0, 0, s, s); speckle(g, s, 4000, ["rgba(0,0,0,.04)", "rgba(255,255,255,.06)"]);
    const t = s / 4; g.strokeStyle = "rgba(0,0,0,.25)"; g.lineWidth = 3; for (let i = 0; i <= s; i += t) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.moveTo(0, i); g.lineTo(s, i); g.stroke(); }
    h.fillStyle = "#c0c0c0"; h.fillRect(0, 0, s, s); h.strokeStyle = "#303030"; h.lineWidth = 4; for (let i = 0; i <= s; i += t) { h.beginPath(); h.moveTo(i, 0); h.lineTo(i, s); h.moveTo(0, i); h.lineTo(s, i); h.stroke(); }
  },
  ribs(g, h, s, base) { g.fillStyle = base; g.fillRect(0, 0, s, s); for (let x = 0; x < s; x += s / 8) { g.fillStyle = "rgba(255,255,255,.1)"; g.fillRect(x, 0, s / 50, s); g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(x + s / 50, 0, s / 85, s); h.fillStyle = "#e0e0e0"; h.fillRect(x, 0, s / 40, s); } },
  grass(g, h, s, base) { g.fillStyle = base; g.fillRect(0, 0, s, s); for (let i = 0; i < 26000; i++) { g.strokeStyle = `hsl(${R(78, 105)}, ${R(35, 55)}%, ${R(22, 42)}%)`; g.lineWidth = 1; const x = R(0, s), y = R(0, s); g.beginPath(); g.moveTo(x, y); g.lineTo(x + R(-2, 2), y - R(2, 6)); g.stroke(); } speckle(h, s, 20000, ["#999", "#666"]); },
  pooltile(g, h, s, base) {
    const t = s / 8; for (let y = 0; y < s; y += t) for (let x = 0; x < s; x += t) { g.fillStyle = `hsl(${R(192, 200)}, ${R(48, 62)}%, ${R(44, 56)}%)`; g.fillRect(x, y, t, t); h.fillStyle = "#c0c0c0"; h.fillRect(x + 2, y + 2, t - 4, t - 4); }
    g.strokeStyle = "rgba(230,240,245,.75)"; g.lineWidth = 2.5; for (let i = 0; i <= s; i += t) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.moveTo(0, i); g.lineTo(s, i); g.stroke(); }
  },
  fabric(g, h, s, base) { g.fillStyle = base; g.fillRect(0, 0, s, s); speckle(g, s, 9000, ["rgba(0,0,0,.08)", "rgba(255,255,255,.06)"], 2); speckle(h, s, 9000, ["#777", "#888"], 2); },
  pv(g, h, s) {
    g.fillStyle = "#0d1626"; g.fillRect(0, 0, s, s); const cw = s / 6, ch = s / 10;
    for (let i = 0; i < 6; i++) for (let j = 0; j < 10; j++) { const gr = g.createLinearGradient(0, j * ch, 0, (j + 1) * ch); gr.addColorStop(0, "#1b2e4f"); gr.addColorStop(1, "#0f1c33"); g.fillStyle = gr; g.fillRect(i * cw + 2, j * ch + 2, cw - 4, ch - 4); g.fillStyle = "rgba(190,200,215,.35)"; for (let k = 1; k < 4; k++) g.fillRect(i * cw + 2, j * ch + k * ch / 4, cw - 4, 1); }
    g.strokeStyle = "#b9c0c8"; g.lineWidth = 6; g.strokeRect(0, 0, s, s);
  },
};
/** ลาย + normal map ของวัสดุ (สร้างครั้งเดียว) */
function texSet(p) {
  if (texCache.has(p.key)) return texCache.get(p.key);
  const size = p.tex === "ribs" || p.tex === "tile" ? 256 : 512;
  const c = document.createElement("canvas"), h = document.createElement("canvas"); c.width = c.height = h.width = h.height = size;
  const g = c.getContext("2d"), hg = h.getContext("2d"); hg.fillStyle = "#808080"; hg.fillRect(0, 0, size, size);
  PAINT[p.tex](g, hg, size, p.base);
  const mk = (cv, srgb) => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(1 / (p.tile || 1), 1 / (p.tile || 1)); return t; };
  const set = { map: mk(c, true), normalMap: p.ns ? mk(normalFrom(h, p.ns * 2), false) : null, swatch: c };
  texCache.set(p.key, set); return set;
}
/** ภาพตัวอย่างวัสดุ (dataURL) สำหรับถาดวัสดุ */
export function swatch(key) {
  const p = PALETTE.find((x) => x.key === key); if (!p) return "";
  if (!p.tex) return "";
  return texSet(p).swatch.toDataURL("image/jpeg", 0.7);
}
export function material(key) {
  const p = PALETTE.find((x) => x.key === key) || PALETTE[0];
  if (cache.has(p.key)) return cache.get(p.key);
  let m;
  if (p.glass) m = new THREE.MeshPhysicalMaterial({ color: p.base, roughness: 0.03, metalness: 0.2, transparent: true, opacity: 0.55, envMapIntensity: 1.4 });
  else if (p.water) m = new THREE.MeshPhysicalMaterial({ color: p.base, roughness: 0.03, metalness: 0.05, transparent: true, opacity: 0.86, envMapIntensity: 1.8, clearcoat: 1 });
  else if (p.car) m = new THREE.MeshPhysicalMaterial({ color: p.base, roughness: 0.28, metalness: 0.8, clearcoat: 1, clearcoatRoughness: 0.08 });
  else if (p.leaf) m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  else if (p.lamp) m = new THREE.MeshStandardMaterial({ color: p.base, emissive: 0xffc77a, emissiveIntensity: 0, roughness: 0.4 });
  else if (p.tex) { const t = texSet(p); m = new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughness: p.rough, metalness: p.metal || 0, envMapIntensity: p.env ?? 1 }); }
  else m = new THREE.MeshStandardMaterial({ color: p.base, roughness: p.rough ?? 0.7, metalness: p.metal || 0 });
  m.name = p.th; m.userData.key = p.key;
  cache.set(p.key, m);
  return m;
}
