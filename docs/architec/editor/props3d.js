// ชิ้นส่วน 3D (Components) สำหรับฉากนำเสนอ: ต้นไม้ ไม้พุ่ม รถยนต์ แผงโซลาร์ตั้งพื้น เตียงอาบแดด โซฟา โต๊ะ เสาไฟสวน (โดย ลุงพี)
// เก็บในแบบเป็น doc.items3d = [{ id, kind, p:[x,y] มม., z มม., rot องศา, s ขนาดเท่า }] · รูปทรงสุ่มจาก id (สร้างใหม่กี่ครั้งก็เหมือนเดิม)
import * as THREE from "three";
import { material } from "./materials.js?v=0.25.1";

export const KINDS = [
  { k: "tree", th: "ต้นไม้", size: "สูง ~4.5 ม." }, { k: "palm", th: "ต้นปาล์ม", size: "สูง ~6 ม." }, { k: "shrub", th: "ไม้พุ่ม", size: "Ø ~1.4 ม." },
  { k: "car", th: "รถยนต์", size: "1.85 × 4.6 ม." }, { k: "pv", th: "แผงโซลาร์ตั้งพื้น", size: "1.13 × 2.28 ม." }, { k: "lounger", th: "เตียงอาบแดด", size: "0.7 × 1.9 ม." },
  { k: "sofa", th: "โซฟา", size: "3.2 × 1.0 ม." }, { k: "table", th: "โต๊ะ + เก้าอี้", size: "1.6 × 0.9 ม." }, { k: "lamp", th: "เสาไฟสวน", size: "สูง 2.8 ม." },
];
/** ตัวสุ่มที่ได้ค่าเดิมทุกครั้งจาก id */
function rng(seed) { let h = 2166136261; for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function mesh(g, geo, mat, x, y, z, name) { const m = new THREE.Mesh(geo, material(mat)); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; m.name = name; m.userData.matKey = mat; g.add(m); return m; }
function box(g, name, mat, w, h, d, x, y, z) { const geo = new THREE.BoxGeometry(w, h, d), uv = geo.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]); } return mesh(g, geo, mat, x, y + h / 2, z, name); }
function cyl(g, name, mat, r1, r2, h, x, y, z, seg = 18) { return mesh(g, new THREE.CylinderGeometry(r1, r2, h, seg), mat, x, y + h / 2, z, name); }
function blob(g, name, r, sx, sy, x, y, z, R, hue, light) {
  const geo = new THREE.IcosahedronGeometry(r, 3), p = geo.attributes.position, cols = [], col = new THREE.Color(), v = new THREE.Vector3();
  for (let k = 0; k < p.count; k++) { v.fromBufferAttribute(p, k).multiplyScalar(1 + (R() - 0.5) * 0.24); p.setXYZ(k, v.x * sx, Math.max(v.y, -r * 0.35) * sy, v.z * sx); col.setHSL(hue + (R() - 0.5) * 0.07, 0.42 + R() * 0.18, light + R() * 0.1 + (v.y / r) * 0.05); cols.push(col.r, col.g, col.b); }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3)); geo.computeVertexNormals();
  const m = mesh(g, geo, "leaf", x, y, z, name); m.userData.edgeAngle = 70; return m;
}

const BUILD = {
  tree(g, R, s) {
    cyl(g, "ลำต้น", "trunk", 0.12 * s, 0.2 * s, 2.6 * s, 0, 0, 0, 10);
    const n = 3 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) blob(g, "พุ่มใบ", (1.1 + R() * 0.6) * s, 1, 0.85, (R() - 0.5) * 1.8 * s, (3 + R() * 1.2) * s, (R() - 0.5) * 1.8 * s, R, 0.28, 0.12);
  },
  palm(g, R, s) {
    const h = (5.2 + R() * 1.2) * s; cyl(g, "ลำต้นปาล์ม", "trunk", 0.16 * s, 0.22 * s, h, 0, 0, 0, 10);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + R() * 0.3, L = (2.2 + R() * 0.6) * s;
      const geo = new THREE.BoxGeometry(L, 0.04 * s, 0.5 * s); geo.translate(L / 2, 0, 0);
      const cols = []; const col = new THREE.Color(); for (let k = 0; k < geo.attributes.position.count; k++) { col.setHSL(0.27 + R() * 0.04, 0.5, 0.18 + R() * 0.08); cols.push(col.r, col.g, col.b); }
      geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
      const m = mesh(g, geo, "leaf", 0, h, 0, "ใบปาล์ม"); m.rotation.set(0, a, -0.35 - R() * 0.3); m.userData.edgeAngle = 70;
    }
  },
  shrub(g, R, s) { blob(g, "ไม้พุ่ม", 0.55 * s, 1.3, 0.8, 0, 0.35 * s, 0, R, 0.29, 0.1); },
  car(g, R, s) {
    box(g, "ตัวรถ", "carpaint", 1.85, 0.75, 4.6, 0, 0.32, 0);
    box(g, "ห้องโดยสาร", "carpaint", 1.6, 0.62, 2.4, 0, 1.07, -0.2);
    box(g, "กระจกรถ", "glass", 1.62, 0.5, 2.3, 0, 1.12, -0.2);
    for (const [wx, wz] of [[-0.85, 1.4], [0.85, 1.4], [-0.85, -1.45], [0.85, -1.45]]) { const w = cyl(g, "ล้อ", "alu", 0.34, 0.34, 0.26, wx, 0, wz, 18); w.rotation.z = Math.PI / 2; w.position.y = 0.34; }
    box(g, "ไฟหน้า", "white2", 1.5, 0.12, 0.04, 0, 0.75, 2.3);
  },
  pv(g) {
    const p = box(g, "แผงโซลาร์ 550 W", "pv", 1.13, 0.04, 2.28, 0, 0.9, 0); p.rotation.x = -0.26;
    const uv = p.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.13, uv.getY(i) / 2.28);
    box(g, "ขาตั้งหน้า", "alu", 0.06, 0.62, 0.06, -0.5, 0, 0.9); box(g, "ขาตั้งหน้า", "alu", 0.06, 0.62, 0.06, 0.5, 0, 0.9);
    box(g, "ขาตั้งหลัง", "alu", 0.06, 1.2, 0.06, -0.5, 0, -0.9); box(g, "ขาตั้งหลัง", "alu", 0.06, 1.2, 0.06, 0.5, 0, -0.9);
  },
  lounger(g) { box(g, "เตียงอาบแดด", "white2", 0.7, 0.3, 1.9, 0, 0.1, 0); const b = box(g, "พนักเตียง", "white2", 0.7, 0.06, 0.7, 0, 0.55, -0.75); b.rotation.x = 0.7; box(g, "ขาเตียง", "alu", 0.66, 0.1, 0.06, 0, 0, 0.85); box(g, "ขาเตียง", "alu", 0.66, 0.1, 0.06, 0, 0, -0.85); },
  sofa(g) { box(g, "เบาะโซฟา", "fabric", 3.2, 0.45, 1, 0, 0, 0); box(g, "พนักโซฟา", "fabric", 3.2, 0.5, 0.25, 0, 0.45, -0.38); box(g, "ท้าวแขน", "fabric", 0.22, 0.25, 1, -1.5, 0.45, 0); box(g, "ท้าวแขน", "fabric", 0.22, 0.25, 1, 1.5, 0.45, 0); },
  table(g) {
    box(g, "หน้าโต๊ะ", "wood", 1.6, 0.05, 0.9, 0, 0.72, 0); for (const [x, z] of [[-0.72, -0.38], [0.72, -0.38], [-0.72, 0.38], [0.72, 0.38]]) box(g, "ขาโต๊ะ", "alu", 0.05, 0.72, 0.05, x, 0, z);
    for (const [x, z] of [[-0.45, -0.75], [0.45, -0.75], [-0.45, 0.75], [0.45, 0.75]]) { box(g, "เก้าอี้", "wood", 0.45, 0.04, 0.45, x, 0.44, z); box(g, "ขาเก้าอี้", "alu", 0.4, 0.44, 0.04, x, 0, z); box(g, "พนักเก้าอี้", "wood", 0.45, 0.45, 0.04, x, 0.48, z + (z > 0 ? 0.2 : -0.2)); }
  },
  lamp(g) { cyl(g, "เสาไฟ", "alu", 0.05, 0.06, 2.6, 0, 0, 0, 10); const l = cyl(g, "โคมไฟ", "lamp", 0.18, 0.14, 0.28, 0, 2.55, 0, 16); l.castShadow = false; l.userData.lamp = true; },
};

/** สร้างกลุ่ม 3D ของชิ้นส่วน (หน่วยเมตร · จุดฐานอยู่ที่ 0,0,0) */
export function buildItem(it) {
  const g = new THREE.Group(), f = BUILD[it.kind] || BUILD.shrub;
  f(g, rng(it.id), it.s || 1);
  g.name = (KINDS.find((x) => x.k === it.kind) || { th: it.kind }).th;
  return g;
}
export const kindTh = (k) => (k === "model" ? "โมเดล 3D" : (KINDS.find((x) => x.k === k) || { th: k }).th);
