// นำเข้า 3D SketchUp (.skp .dae) + glTF / COLLADA / OBJ / STL / .zip → ชิ้นส่วน items3d ชนิด "model" (โดย ลุงพี)
// ผู้ใช้ดาวน์โหลดไฟล์เอง (เช่น 3D Warehouse ด้วยบัญชีของตัวเอง) — ASCA ไม่มีลิงก์ไปหรือดาวน์โหลดจาก 3D Warehouse
// โมเดลแปลงเป็น GLB (เมตร · ฐานกลางที่ 0,0,0 · รุ่นแสดงผลเบาเมื่อหนัก) เก็บใน IndexedDB ทุกรุ่น + out\models\<ref>.glb (รุ่นในเครื่อง)
// ไฟล์แบบเก็บแค่ { kind:"model", ref, name, ขนาด } ไม่ฝังโมเดล · มุมมอง 3D โหลดตาม ref (server ก่อน แล้ว IndexedDB) + จำไว้ใช้ซ้ำ
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import * as LS from "./localstore.js?v=0.31.0";
import * as I from "./import3d-core.js?v=0.31.0";
import * as ST from "./struct.js?v=0.31.0";
import * as M from "./model.js?v=0.31.0";

const CLOUD = window.PA_MODE === "cloud";
const LIBKEY = "asca.models.lib";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const tris = (g) => (g.index ? g.index.count : g.attributes.position ? g.attributes.position.count : 0) / 3 | 0;

// ================================================================ โหลดตาม ref (ใช้โดย view3d.js)
const CACHE = new Map();               // ref → { state: "loading"|"ok"|"missing", obj, p }
const LABELS = new Map();              // ข้อความป้าย → CanvasTexture (ใช้ซ้ำ ไม่สร้างใหม่ทุกครั้งที่วาดฉาก)
let readyT = 0, readyFn = null;
function ready(fn) { readyFn = fn; clearTimeout(readyT); readyT = setTimeout(() => readyFn && readyFn(), 30); }

async function fetchGLB(ref) {
  if (!CLOUD) {
    try { const r = await fetch("/api/models/" + encodeURIComponent(ref)); if (r.ok) return await r.arrayBuffer(); } catch (e) { /* server ไม่ตอบ → ลอง IndexedDB */ }
  }
  const b = await LS.get("model:" + ref);
  if (!b) return null;
  const buf = b instanceof Blob ? await b.arrayBuffer() : b;
  if (!CLOUD) upload(ref, buf).catch(() => {});        // มีในเบราว์เซอร์แต่ไม่มีที่ server → ส่งเก็บให้ครบสองที่
  return buf;
}
const parseGLB = (buf) => new Promise((res, rej) => new GLTFLoader().parse(buf, "", (g) => res(g.scene), rej));
function prep(obj) {
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; o.userData.shared = true; if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals(); } });
  return obj;
}
function load(ref) {
  let c = CACHE.get(ref);
  if (c) return c;
  c = { state: "loading" };
  c.p = fetchGLB(ref).then((buf) => (buf ? parseGLB(buf) : null)).then((obj) => { if (obj) { c.obj = prep(obj); c.state = "ok"; } else c.state = "missing"; })
    .catch((e) => { console.warn("โหลดโมเดลไม่ได้", ref, e); c.state = "missing"; });
  CACHE.set(ref, c);
  return c;
}
function labelSprite(text, hM, color = "#1d2733", border = "rgba(0,0,0,.35)") {
  const key = text + "|" + color;
  let L = LABELS.get(key);
  if (!L) {
    const c = document.createElement("canvas"), g = c.getContext("2d"), px = 56, font = `${px}px Tahoma, "Noto Sans Thai", sans-serif`;
    g.font = font; const w = Math.ceil(g.measureText(text).width) + px * 0.6, h = Math.ceil(px * 1.45); c.width = w; c.height = h;
    g.font = font; g.fillStyle = "rgba(255,255,255,.92)"; g.fillRect(0, 0, w, h); g.strokeStyle = border; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3);
    g.fillStyle = color; g.textBaseline = "middle"; g.fillText(text, px * 0.3, h / 2);
    L = { c, aspect: w / h };
    if (LABELS.size > 300) LABELS.clear();
    LABELS.set(key, L);
  }
  // ภาพป้ายใหม่ทุกครั้ง (view3d.buildNotes ทิ้งภาพของป้ายเก่าทุกครั้งที่วาดฉาก) — จำไว้แค่ canvas ที่วาดตัวอักษรแล้ว
  const tex = new THREE.CanvasTexture(L.c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.set(hM * L.aspect, hM, 1); sp.center.set(0.5, 0); sp.renderOrder = 6;
  return sp;
}
/** กล่องแทนที่ขนาดจริง (ระหว่างโหลด / ไม่พบไฟล์) */
function placeholder(it, missing) {
  const g = new THREE.Group(), W = (it.w || 800) / 1000, D = (it.d || 800) / 1000, H = (it.h || 800) / 1000;
  const geo = new THREE.BoxGeometry(W, H, D); geo.translate(0, H / 2, 0);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: missing ? 0xd23b3b : 0x8a96a3, transparent: true, opacity: missing ? 0.12 : 0.18, depthWrite: false }));
  m.userData.helper = true; m.castShadow = false; g.add(m);
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: missing ? 0xd23b3b : 0x5f6b78 }));
  g.add(e);
  return g;
}
/** กลุ่ม 3D ของชิ้น model (หน่วยเมตร · ฐานกลางที่ 0,0,0) — มีในหน่วยความจำ = ทันที · ยังไม่มี = กล่องแทนที่ + โหลด แล้วเรียก onReady (วาดฉากใหม่) */
export function modelItem(it, onReady) {
  const grp = new THREE.Group(), s = Number(it.s) || 1, c = load(it.ref);
  grp.name = it.name || "โมเดล 3D";
  const body = new THREE.Group(); body.scale.setScalar(s); grp.add(body);
  if (c.state === "ok") body.add(c.obj.clone());
  else {
    body.add(placeholder(it, c.state === "missing"));
    if (c.state === "loading" && onReady) c.p.then(() => ready(onReady));
  }
  const top = ((it.h || 800) * s) / 1000, hM = THREE.MathUtils.clamp(Math.max(it.w || 0, it.d || 0, it.h || 0) * s / 1000 * 0.07, 0.16, 0.5);
  const text = c.state === "missing" ? `ไม่พบไฟล์โมเดล · ${it.name || it.ref}` : c.state === "loading" ? `กำลังโหลด… ${it.name || ""}` : I.modelLabel(it);
  const sp = labelSprite(text, hM, c.state === "missing" ? "#b42323" : "#1d2733", c.state === "missing" ? "#d23b3b" : "rgba(0,0,0,.35)");
  sp.position.set(0, top + 0.12, 0); sp.userData = { type: "items", id: it.id, tag: "notes" };
  grp.label = sp;                          // view3d.js ย้ายป้ายไปชั้นบน (notes) — ถ้าอยู่ในฉากหลักจะโดนเงาซอกมุม (AO) เป็นแถบดำ
  grp.traverse((o) => { if (o.isLine) o.userData = { ...o.userData, type: "items", id: it.id, tag: it.tag || "items" }; });
  return grp;
}
/** สถานะโมเดลของรหัสนี้ (ใช้ในเทสต์/แผงข้อมูล) */
export const modelState = (ref) => (CACHE.get(ref) || {}).state || "none";

// ================================================================ เก็บโมเดล
async function upload(ref, buf) {
  const r = await fetch("/api/models?id=" + encodeURIComponent(ref), { method: "POST", headers: { "Content-Type": "model/gltf-binary" }, body: buf });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "HTTP " + r.status);
  return r.json();
}
function libGet() { try { return JSON.parse(localStorage.getItem(LIBKEY) || "[]"); } catch (e) { return []; } }
function libSet(L) { try { localStorage.setItem(LIBKEY, JSON.stringify(L)); } catch (e) { /* พื้นที่เต็ม/ปิดไว้ — ไม่มีคลังก็วางได้ */ } }

// ================================================================ อ่านไฟล์ → three
/** ไฟล์ (หรือไฟล์ใน .zip/.kmz) → { root (หน่วยไฟล์ แกน y ขึ้น), ext, name, daeMeter, missingTex, urls } */
async function readModel(file, setMsg) {
  let ext = I.extOf(file.name), inner = file.name, buf = await file.arrayBuffer(), files = null;
  if (ext === "zip" || ext === "kmz") {
    const { unzipSync } = await import("three/addons/libs/fflate.module.js");
    try { files = unzipSync(new Uint8Array(buf)); } catch (e) { throw new Error("แตกไฟล์ ." + ext + " ไม่ได้ — ไฟล์เสียหรือไม่ใช่ zip"); }
    inner = I.pickZipEntry(Object.keys(files));
    if (!inner) throw new Error(`ในไฟล์ .${ext} ไม่พบโมเดล (.dae .skp .obj .glb .gltf .stl)`);
    const u8 = files[inner]; buf = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength); ext = I.extOf(inner);
  }
  // ไฟล์ประกอบ (ภาพลาย .mtl .bin) จาก .zip → blob URL
  const urls = [], byName = new Map();
  if (files) for (const [n, u8] of Object.entries(files)) { if (n === inner || n.endsWith("/")) continue; const u = URL.createObjectURL(new Blob([u8])); urls.push(u); byName.set(n.toLowerCase(), u); byName.set(n.split("/").pop().toLowerCase(), u); }
  let missingTex = 0;
  const mgr = new THREE.LoadingManager();
  mgr.setURLModifier((url) => {
    if (/^(blob:|data:)/.test(url)) return url;
    let key = url; try { key = decodeURIComponent(url); } catch (e) { /* ใช้ตามเดิม */ }
    key = key.replace(/^\.\//, "").replace(/\\/g, "/").toLowerCase();
    return byName.get(key) || byName.get(key.split("/").pop()) || "data:,";
  });
  mgr.onError = () => { missingTex++; };
  let started = false; mgr.onStart = () => { started = true; };
  const done = new Promise((res) => { mgr.onLoad = res; setTimeout(res, 8000); });
  let root, daeMeter = null;
  if (ext === "skp") {
    if (CLOUD) throw new Error("ไฟล์ .skp ใช้ได้ในรุ่นในเครื่องเท่านั้น — เปิดใน SketchUp แล้ว File › Export › 3D Model… เป็น .dae แล้วนำเข้าแทน");
    setMsg("กำลังแปลง .skp ที่เครื่องนี้…");
    const r = await fetch("/api/skp2glb", { method: "POST", body: buf });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "แปลง .skp ไม่ได้ (HTTP " + r.status + ")");
    buf = await r.arrayBuffer();
  }
  if (ext === "glb" || ext === "gltf" || ext === "skp") root = await new Promise((res, rej) => new GLTFLoader(mgr).parse(buf, "", (g) => res(g.scene), rej));
  else if (ext === "dae") {
    const text = new TextDecoder().decode(buf), a = I.daeAsset(text);
    const { ColladaLoader } = await import("three/addons/loaders/ColladaLoader.js");
    const r = new ColladaLoader(mgr).parse(text, ""); if (!r || !r.scene) throw new Error("อ่านไฟล์ .dae ไม่ได้ — ไฟล์เสียหรือไม่ใช่ COLLADA");
    root = r.scene; root.scale.setScalar(1); daeMeter = a.meter;               // กลับเป็นหน่วยในไฟล์ (เลือกหน่วยเองได้ในหน้าต่าง)
  } else if (ext === "obj") {
    const { OBJLoader } = await import("three/addons/loaders/OBJLoader.js"), ol = new OBJLoader(mgr);
    const mtl = files && Object.keys(files).find((n) => I.extOf(n) === "mtl");
    if (mtl) { const { MTLLoader } = await import("three/addons/loaders/MTLLoader.js"); const mc = new MTLLoader(mgr).parse(new TextDecoder().decode(files[mtl]), ""); mc.preload(); ol.setMaterials(mc); }
    root = ol.parse(new TextDecoder().decode(buf));
  } else if (ext === "stl") {
    const { STLLoader } = await import("three/addons/loaders/STLLoader.js");
    const geo = new STLLoader().parse(buf); geo.rotateX(-Math.PI / 2);         // STL ส่วนใหญ่แกน z ขึ้น → y ขึ้น
    if (!geo.attributes.normal) geo.computeVertexNormals();
    root = new THREE.Group(); root.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xcfd4da, roughness: 0.7, vertexColors: !!geo.attributes.color })));
  } else throw new Error(`ยังไม่รองรับไฟล์ .${ext || "?"} — ใช้ .skp .dae .kmz .glb .gltf .obj .stl หรือ .zip`);
  if (started) await done;                                                    // รอภาพลายโหลดเสร็จ (ไม่มีภาพลาย = ไม่ต้องรอ)
  return { root, ext, name: I.baseName(inner === file.name ? file.name : file.name), inner, daeMeter, missingTex, urls };
}

/** ห่อให้ฐานกลางอยู่ที่ 0,0,0 · holder.scale = เมตรต่อหน่วย */
function wrap(root) {
  root.traverse((o) => { if (o.isMesh && o.geometry && !o.geometry.attributes.normal) o.geometry.computeVertexNormals(); });   // ไฟล์ไม่มีเวกเตอร์ปกติ = ภาพดำ
  const norm = new THREE.Group(); norm.add(root); norm.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(norm); if (box.isEmpty()) throw new Error("ไม่พบรูปทรง 3D ในไฟล์");
  const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  norm.position.set(-c.x, -box.min.y, -c.z);
  const holder = new THREE.Group(); holder.name = "โมเดลนำเข้า"; holder.add(norm);
  return { holder, raw: [size.x, size.y, size.z] };
}
function stats(obj) {
  let n = 0, meshes = 0; const mats = new Set();
  obj.traverse((o) => { if (o.isMesh) { meshes++; n += tris(o.geometry); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m && mats.add(m.uuid)); } });
  return { tris: n, meshes, mats: mats.size };
}

/** รุ่นแสดงผลเบา: SimplifyModifier ทีละชิ้น (ชิ้นใหญ่ก่อน) ภายในเวลาที่กำหนด — ทำไม่ได้ = บอกตามจริง */
async function simplify(holder, onProgress) {
  const [{ SimplifyModifier }, BGU] = await Promise.all([import("three/addons/modifiers/SimplifyModifier.js"), import("three/addons/utils/BufferGeometryUtils.js")]);
  const meshes = []; holder.traverse((o) => o.isMesh && meshes.push(o));
  const before = meshes.reduce((s, m) => s + tris(m.geometry), 0), t0 = performance.now();
  const merged = [];
  for (const m of meshes) {                      // รวมจุดซ้ำก่อน (ไม่สนเวกเตอร์ปกติ) = จำนวนจุดยอดจริงที่ลดได้
    const g = m.geometry.clone(); for (const k of Object.keys(g.attributes)) if (!["position", "uv", "color"].includes(k)) g.deleteAttribute(k);
    merged.push(BGU.mergeVertices(g));
    if (performance.now() - t0 > 400) { await new Promise((r) => setTimeout(r, 0)); }
  }
  const info = meshes.map((m, i) => ({ verts: merged[i].attributes.position.count, tris: tris(m.geometry), multi: Array.isArray(m.material) && m.geometry.groups.length > 1 }));
  const plan = I.planSimplify(info), mod = new SimplifyModifier();
  const order = meshes.map((_, i) => i).sort((a, b) => info[b].tris - info[a].tris);
  let timedOut = false, k = 0, skipped = 0;
  for (const i of order) {
    if (!plan[i].remove) { if (plan[i].skip && plan[i].skip !== "เล็กอยู่แล้ว") skipped++; continue; }
    if (info[i].multi) { skipped++; continue; }                                  // หลายวัสดุในชิ้นเดียว — ลดรูปแล้ววัสดุหาย ข้าม
    if (performance.now() - t0 > I.SIMPLIFY_BUDGET_MS) { timedOut = true; break; }
    onProgress(`กำลังทำรุ่นแสดงผลเบา… ชิ้นที่ ${++k}`); await new Promise((r) => setTimeout(r, 0));
    try {
      let g = mod.modify(merged[i], plan[i].remove);
      if (tris(g) > 0 && tris(g) < info[i].tris) { g = g.toNonIndexed(); g.computeVertexNormals(); meshes[i].geometry.dispose(); meshes[i].geometry = g; }
    } catch (e) { console.warn("ลดรูปชิ้นนี้ไม่ได้", e); skipped++; }
  }
  merged.forEach((g) => g.dispose());
  const after = meshes.reduce((s, m) => s + tris(m.geometry), 0);
  return { before, after, timedOut, skipped, note: I.simplifyNote(before, after, I.TRI_LIMIT, timedOut) + (skipped && after > I.TRI_LIMIT ? ` · ข้าม ${skipped} ชิ้น (ใหญ่/หลายวัสดุ)` : "") };
}
/** ภาพลายที่โหลดไม่สำเร็จ → เอาออกก่อนส่งออก GLB (กันตัวส่งออกล้ม) */
function stripBrokenMaps(obj) {
  obj.traverse((o) => { if (!o.isMesh) return; for (const m of Array.isArray(o.material) ? o.material : [o.material]) { if (!m) continue;
    for (const k of ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "bumpMap", "specularMap", "alphaMap", "lightMap"]) {
      const t = m[k]; const im = t && t.image; if (t && (!im || !(im.width > 1 || im.data))) { m[k] = null; m.needsUpdate = true; } } } });
}
const exportGLB = (obj) => new Promise((res, rej) => new GLTFExporter().parse(obj, res, rej, { binary: true }));

// ================================================================ หน้าต่าง
let S = null;          // สถานะของไฟล์ที่กำลังนำเข้า
let pv = null;         // ภาพตัวอย่าง (three ตัวเล็ก ใช้ซ้ำทุกครั้งที่เปิด)
let ctx = null;        // { hist, view, ext, status, setTool3d, onChange }

const CSS = `
#imp3d-dlg{z-index:50}
#imp3d-dlg .dlg-box{width:min(980px,96vw)}
.imp3d-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:14px;overflow:auto;min-height:0}
@media (max-width:760px){.imp3d-cols{grid-template-columns:1fr}}
.imp3d-steps{margin:0;padding:0;list-style:none;display:grid;gap:6px;font-size:13px}
.imp3d-steps li{display:flex;gap:8px;align-items:flex-start}
.imp3d-steps b{flex:none;width:22px;height:22px;border-radius:50%;background:var(--accent);color:#fff;display:grid;place-items:center;font-size:12px}
.imp3d-pick{display:block;text-align:center;margin:10px 0;padding:10px;font-weight:600;cursor:pointer;border:1px solid var(--accent);border-radius:8px;background:color-mix(in srgb,var(--accent) 14%,var(--panel))}
.imp3d-fmt{width:100%;border-collapse:collapse;font-size:12px}
.imp3d-fmt td,.imp3d-fmt th{border-bottom:1px solid var(--line);padding:3px 4px;text-align:left;vertical-align:top}
.imp3d-fmt td.only{color:#b5522b;white-space:nowrap}
.imp3d-lic{font-size:12px;color:var(--muted);border-left:3px solid var(--line);padding-left:8px;margin:8px 0}
.imp3d-lib{font-size:12px}
.imp3d-lib ul{list-style:none;margin:4px 0 0;padding:0;max-height:150px;overflow:auto}
.imp3d-lib li{display:flex;gap:6px;align-items:center;padding:2px 0;border-bottom:1px dashed var(--line)}
.imp3d-lib li span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.imp3d-drop{position:relative;height:260px;border:2px dashed var(--line);border-radius:10px;display:grid;place-items:center;background:var(--paper);overflow:hidden}
.imp3d-drop.over{border-color:var(--accent)}
.imp3d-drop canvas{position:absolute;inset:0;width:100%;height:100%;cursor:grab}
.imp3d-drop span{position:relative;color:var(--muted);font-size:13px;text-align:center;padding:12px;pointer-events:none}
.imp3d-drop.has span{display:none}
.imp3d-info{font-size:12px;color:var(--muted);margin-top:6px;word-break:break-word}
.imp3d-size{font-size:15px;font-weight:600;margin:4px 0}
.imp3d-size small{font-weight:400;color:var(--muted)}
.imp3d-chip{display:inline-block;font-size:12px;padding:2px 8px;border-radius:12px;margin:2px 0;background:color-mix(in srgb,#e8892b 18%,var(--panel));border:1px solid #e8892b}
.imp3d-chip.ok{background:color-mix(in srgb,#2e7d4f 14%,var(--panel));border-color:#2e7d4f}
.imp3d-chip.bad{background:color-mix(in srgb,#d23b3b 14%,var(--panel));border-color:#d23b3b}
.imp3d-form{display:grid;grid-template-columns:1fr 1fr;gap:6px 10px;margin-top:6px}
.imp3d-form label{display:flex;flex-direction:column;font-size:12px;gap:2px}
#imp3d-msg.bad{color:#d23b3b}`;

function html() {
  $("#imp3d-fmt").innerHTML = I.FORMATS.map(([e, d, w]) => `<tr><td><b>${esc(e)}</b><br><small>${esc(d)}</small></td><td class="${w.includes("เท่านั้น") ? "only" : ""}">${esc(w)}${CLOUD && w.includes("เท่านั้น") ? " (รุ่นนี้เป็นรุ่นออนไลน์)" : ""}</td></tr>`).join("");
  $("#imp3d-unit").innerHTML = I.UNITS.map((u) => `<option value="${u.k}">${u.th}</option>`).join("");
  $("#imp3d-file").accept = I.ACCEPT;
}
function msg(s, cls = "") { const m = $("#imp3d-msg"); m.textContent = s; m.className = cls || "muted"; }
function renderLib() {
  const L = libGet();
  $("#imp3d-lib").innerHTML = L.length ? `<ul>${L.map((x) => `<li><span title="${esc(x.src || "")}">${esc(x.name)} · ${esc(I.fmtSize(x.size))}</span><button type="button" class="chipb" data-i3lib="place" data-ref="${esc(x.ref)}" title="วางชิ้นนี้ในแบบอีกครั้ง (ไม่ต้องนำเข้าใหม่)">วาง</button><button type="button" class="chipb" data-i3lib="del" data-ref="${esc(x.ref)}" title="เอาออกจากคลัง (ชิ้นที่วางในแบบแล้วยังอยู่)">×</button></li>`).join("")}</ul>`
    : '<p class="note">ยังว่าง — นำเข้าแล้วเลือก "คลังชิ้นส่วนของฉัน" เพื่อวางซ้ำได้โดยไม่ต้องนำเข้าใหม่</p>';
}
function levelsSel() {
  const L = ST.levels(ctx.hist.doc);
  $("#imp3d-level").innerHTML = L.map((l) => `<option value="${esc(l.id)}">${esc(l.name)} (${(l.z / 1000).toFixed(2)} ม.)</option>`).join("");
}

// ---------------------------------------------------------------- ภาพตัวอย่าง
function pvInit() {
  if (pv) return pv;
  const cv = $("#imp3d-cv"), r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
  r.setPixelRatio(Math.min(devicePixelRatio, 1.5)); r.outputColorSpace = THREE.SRGBColorSpace;
  const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x7a8796, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8); sun.position.set(3, 5, 4); sc.add(sun);
  const cam = new THREE.PerspectiveCamera(35, 1, 0.01, 5000), turn = new THREE.Group(); sc.add(turn);
  pv = { r, sc, cam, turn, cv, yaw: -0.6 };
  let drag = null;
  cv.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, yaw: pv.yaw }; try { cv.setPointerCapture(e.pointerId); } catch (er) { /* */ } });
  cv.addEventListener("pointermove", (e) => { if (!drag) return; pv.yaw = drag.yaw + (e.clientX - drag.x) / 120; pvRender(); });
  cv.addEventListener("pointerup", () => { drag = null; });
  return pv;
}
function pvShow() {
  const p = pvInit(); p.turn.clear();
  if (!S) { p.r.clear(); return; }
  p.turn.add(S.holder);
  const k = I.unitM(S.unit); S.holder.scale.setScalar(k);
  const box = new THREE.Box3().setFromObject(S.holder);
  if (!box.isEmpty()) { const bh = new THREE.Box3Helper(box, 0xe8892b); p.turn.add(bh); }
  p.box = box; pvRender();
}
function pvRender() {
  const p = pv; if (!p || !p.box || p.box.isEmpty()) return;
  const w = p.cv.clientWidth || 400, h = p.cv.clientHeight || 260; p.r.setSize(w, h, false); p.cam.aspect = w / h;
  p.turn.rotation.y = p.yaw;
  const size = p.box.getSize(new THREE.Vector3()), R = Math.max(size.length() / 2, 0.01), c = new THREE.Vector3(0, size.y / 2, 0);
  const d = R / Math.sin(((p.cam.fov * Math.PI) / 180) / 2) * 1.05;
  p.cam.near = d / 100; p.cam.far = d * 10; p.cam.position.copy(c).add(new THREE.Vector3(0, 0.45, 1).normalize().multiplyScalar(d)); p.cam.lookAt(c); p.cam.updateProjectionMatrix();
  p.r.render(p.sc, p.cam);
}

// ---------------------------------------------------------------- ไฟล์ → หน้าต่าง
function clearFile() {
  if (S) { S.urls.forEach((u) => URL.revokeObjectURL(u)); S.holder.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  S = null; if (pv) { pv.turn.clear(); pv.box = null; pv.r.clear(); }
  $("#imp3d-drop").classList.remove("has"); $("#imp3d-info").textContent = ""; $("#imp3d-size").innerHTML = ""; $("#imp3d-warn").innerHTML = "";
  $("#imp3d-go").disabled = true;
}
function showSize() {
  if (!S) return;
  S.size = I.sizeMeters(S.raw, S.unit);
  const w = I.sizeWarning(S.size);
  $("#imp3d-size").innerHTML = `${esc(I.fmtSize(S.size))} <small>กว้าง × ลึก × สูง ม.</small>`;
  $("#imp3d-warn").innerHTML = (w ? `<span class="imp3d-chip bad">${esc(w)}</span> ` : "") +
    (S.heavy ? `<span class="imp3d-chip ${S.simp && S.simp.after <= I.TRI_LIMIT * 1.2 ? "ok" : ""}">⚠ โมเดลหนัก ${S.stats0.tris.toLocaleString()} สามเหลี่ยม (เกิน ~${I.TRI_LIMIT.toLocaleString()})</span> ` : "") +
    (S.simp && S.simp.note ? `<span class="imp3d-chip ${S.simp.after <= I.TRI_LIMIT * 1.2 ? "ok" : "bad"}">${esc(S.simp.note)}</span>` : "") +
    (S.missingTex ? ` <span class="imp3d-chip">ภาพลาย ${S.missingTex} ไฟล์หาไม่พบ — ใช้ .zip ที่รวมโฟลเดอร์ภาพลายมาด้วย</span>` : "");
  pvShow();
}
async function takeFile(file) {
  if (!file) return;
  clearFile(); msg(`กำลังอ่าน ${file.name}…`); $("#imp3d-go").disabled = true;
  try {
    const r = await readModel(file, msg), { holder, raw } = wrap(r.root), st = stats(holder);
    if (!st.tris) throw new Error("ไม่พบรูปทรง 3D (สามเหลี่ยม) ในไฟล์");
    const u = I.detectUnit({ ext: r.ext, daeMeter: r.daeMeter, size: raw });
    S = { ...r, holder, raw, unit: u.unit, unitWhy: u.why, stats0: st, heavy: I.triBudget(st.tris).heavy, src: file.name };
    $("#imp3d-name").value = r.name; $("#imp3d-unit").value = S.unit; $("#imp3d-drop").classList.add("has");
    const info = () => `${file.name}${r.inner !== file.name ? " › " + r.inner : ""} · ${st.meshes.toLocaleString()} ชิ้น · ${(S.simp ? S.simp.after : st.tris).toLocaleString()} สามเหลี่ยม · วัสดุ ${st.mats} ชนิด · หน่วย: ${u.why}`;
    $("#imp3d-info").textContent = info(); showSize();
    if (S.heavy) {
      msg("โมเดลหนัก — กำลังทำรุ่นแสดงผลเบาอัตโนมัติ…");
      const cur = S; await new Promise((res) => setTimeout(res, 30));
      const simp = await simplify(cur.holder, msg); if (S !== cur) return;
      S.simp = simp; $("#imp3d-info").textContent = info(); showSize();
    }
    msg("ตรวจขนาดจริง (กว้าง × ลึก × สูง) ถ้าไม่ตรงให้เปลี่ยน หน่วยในไฟล์ · เลือกชั้น แล้วกด วางในแบบ"); $("#imp3d-go").disabled = false;
  } catch (e) {
    console.warn(e); clearFile(); msg(String(e.message || e), "bad");
    $("#imp3d-warn").innerHTML = `<span class="imp3d-chip bad">${esc(e.message || e)}</span>`;
  }
}

// ---------------------------------------------------------------- วางในแบบ
function startPlace(tpl) {
  const { ext, view, hist, status, setTool3d, onChange } = ctx;
  $("#imp3d-dlg").hidden = true;
  if (document.body.dataset.view === "2d") {                  // ไม่มีภาพ 3D ให้คลิก → วางที่จุดกลางมุมมอง (เลื่อนด้วย ย้าย ในภาพ 3D ภายหลัง)
    const t = view.controls.target, it = I.makeModelItem(tpl, { id: M.uid("i"), p: [t.x * 1000, -t.z * 1000], z: tpl.z });
    hist.commit((d) => d.items3d.push(it)); onChange();
    status(`วาง ${tpl.name} (${I.fmtSize(tpl.size)}) ที่จุดกลางมุมมองแล้ว — เปิดโหมด 2D + 3D เพื่อย้าย/หมุนด้วยเครื่องมือ 3D`);
    return;
  }
  ext.placeTpl = tpl; ext.placing = "model"; setTool3d("place");
  status(`วาง ${tpl.name} (${I.fmtSize(tpl.size)}): คลิกจุดบนพื้น/หน้าบนกล่องในภาพ 3D (วางซ้ำได้หลายครั้ง · Esc จบ)`);
}
async function placeNew() {
  if (!S) return;
  const go = $("#imp3d-go"); go.disabled = true; msg("กำลังเก็บโมเดล…");
  try {
    const name = $("#imp3d-name").value.trim() || S.name, lv = ST.levels(ctx.hist.doc).find((l) => l.id === $("#imp3d-level").value);
    S.holder.removeFromParent(); S.holder.scale.setScalar(I.unitM(S.unit)); S.holder.updateMatrixWorld(true);
    stripBrokenMaps(S.holder);
    const buf = await exportGLB(S.holder), ref = "mdl" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    let where = "เบราว์เซอร์นี้";
    try { await LS.put("model:" + ref, buf); } catch (e) { where = ""; }
    if (!CLOUD) { try { await upload(ref, buf); where = where ? "เบราว์เซอร์นี้ + out\\models" : "out\\models"; } catch (e) { console.warn("ส่งโมเดลไป server ไม่ได้", e); } }
    if (!where) throw new Error("เก็บโมเดลไม่ได้ (พื้นที่เบราว์เซอร์เต็ม/ปิดไว้ และ server ไม่ตอบ)");
    const obj = await parseGLB(buf);                                          // ใช้ GLB ที่เก็บจริง = เหมือนตอนเปิดแบบใหม่ (และตรวจว่าไฟล์ใช้ได้)
    CACHE.set(ref, { state: "ok", obj: prep(obj), p: Promise.resolve() });
    const st = stats(obj), tpl = { ref, name, size: S.size, tris: st.tris, src: S.src, unit: S.unit, z: lv ? lv.z : 0 };
    if ($("#imp3d-keep").value === "lib") libSet(I.libAdd(libGet(), { ref, name, size: S.size, tris: st.tris, src: S.src, unit: S.unit, date: new Date().toISOString().slice(0, 10) }));
    clearFile();                                                              // ตัวที่ใช้แสดงตัวอย่างไม่ใช้แล้ว (ในแบบใช้ตัวจาก GLB)
    msg(`เก็บโมเดลใน${where}แล้ว (${(buf.byteLength / 1048576).toFixed(1)} MB)`);
    startPlace(tpl);
  } catch (e) { console.warn(e); msg("วางไม่ได้: " + (e.message || e), "bad"); go.disabled = false; }
}

/** เปิดหน้าต่าง นำเข้า 3D SketchUp · c = { hist, view, ext, status, setTool3d, onChange } */
export function openImport3d(c) {
  ctx = c;
  const dlg = $("#imp3d-dlg"); if (!dlg) return c.status("ไม่พบหน้าต่างนำเข้า 3D (โหลดหน้าใหม่)");
  if (!dlg.dataset.ready) {
    dlg.dataset.ready = "1";
    const st = document.createElement("style"); st.textContent = CSS; document.head.append(st);
    html();
    $("#imp3d-file").addEventListener("change", (e) => { takeFile(e.target.files[0]); e.target.value = ""; });
    const dz = $("#imp3d-drop");
    dlg.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("over"); });
    dlg.addEventListener("dragleave", (e) => { if (e.target === dz) dz.classList.remove("over"); });
    dlg.addEventListener("drop", (e) => { e.preventDefault(); dz.classList.remove("over"); takeFile(e.dataTransfer.files[0]); });
    $("#imp3d-unit").addEventListener("change", (e) => { if (S) { S.unit = e.target.value; showSize(); } });
    $("#imp3d-go").addEventListener("click", placeNew);
    dlg.addEventListener("click", (e) => {
      if (e.target.closest('[data-i3="cancel"]')) { clearFile(); dlg.hidden = true; return; }
      const b = e.target.closest("[data-i3lib]"); if (!b) return;
      const x = libGet().find((q) => q.ref === b.dataset.ref); if (!x) return renderLib();
      if (b.dataset.i3lib === "del") { libSet(I.libRemove(libGet(), x.ref)); renderLib(); return; }
      const lv = ST.levels(ctx.hist.doc).find((l) => l.id === $("#imp3d-level").value);
      load(x.ref); clearFile(); startPlace({ ...x, z: lv ? lv.z : 0 });
    });
    addEventListener("resize", () => { if (!dlg.hidden) pvRender(); });
  }
  levelsSel(); renderLib(); msg(CLOUD ? "รุ่นออนไลน์: .skp ใช้ได้ในรุ่นในเครื่องเท่านั้น — ไฟล์อื่นอ่านในเบราว์เซอร์นี้ ไม่ส่งขึ้นเน็ต" : "เลือกไฟล์ หรือลากไฟล์มาวางที่กรอบด้านขวา");
  dlg.hidden = false;
  if (S) pvShow();
}
