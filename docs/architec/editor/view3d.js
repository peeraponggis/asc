// มุมมอง 3D + push-pull + render ภาพนิ่ง (three.js ในเครื่อง) ของตัวเขียนแบบ ASC Architect (โดย ลุงพี)
// พิกัด three: x = x แบบ (ม.) · y = ความสูง (ม.) · z = −y แบบ (ม.) → มองจากใต้ขึ้นเหนือเหมือนแบบ
// ภาพนำเสนอ (0.22.0): วัสดุ PBR + ท้องฟ้าจริงตามดวงอาทิตย์ (Sky) + แสงสะท้อนจากฟ้า (PMREM) + เงานุ่ม + AO (GTAO) + ลบรอยหยัก (SMAA)
// รูปแบบแสดงผลแบบ SketchUp: X-ray · เส้นด้านหลัง · โครงเส้น · เส้นซ่อน · สีพื้น · สีพื้น+ลาย · สีเดียว
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Sky } from "three/addons/objects/Sky.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import * as M from "./model.js?v=0.30.1";
import { material } from "./materials.js?v=0.30.1";
import { buildItem, kindTh } from "./props3d.js?v=0.30.1";
import { modelItem } from "./import3d.js?v=0.30.1";
import * as ST from "./struct.js?v=0.30.1";
import * as SOL from "./mesh.js?v=0.30.1";

const MM = 0.001;
const v3 = (p, z = 0) => new THREE.Vector3(p[0] * MM, z * MM, -p[1] * MM);
export const STYLES = [
  { k: "render", th: "ภาพนำเสนอ", en: "Presentation" }, { k: "xray", th: "X-ray", en: "X-ray" }, { k: "back", th: "เส้นด้านหลัง", en: "Back Edges" },
  { k: "wire", th: "โครงเส้น", en: "Wireframe" }, { k: "hidden", th: "เส้นซ่อน", en: "Hidden Line" }, { k: "shaded", th: "สีพื้น", en: "Shaded" },
  { k: "tex", th: "สีพื้น + ลายวัสดุ", en: "Shaded With Textures" }, { k: "mono", th: "สีเดียว", en: "Monochrome" },
];
export const TAGS = [
  { k: "walls", th: "ผนัง" }, { k: "openings", th: "ประตู หน้าต่าง" }, { k: "roof", th: "หลังคา" }, { k: "pv", th: "แผงโซลาร์" }, { k: "struct", th: "โครงสร้าง เสา คาน ฐานราก" },
  { k: "masses", th: "กล่อง push-pull" }, { k: "slab", th: "พื้น" }, { k: "land", th: "ภูมิทัศน์ ลาน รั้ว" }, { k: "pool", th: "สระว่ายน้ำ" },
  { k: "items", th: "ต้นไม้ รถ ของตกแต่ง" }, { k: "notes", th: "เส้น ข้อความ มิติ 3D" }, { k: "asc", th: "โมเดล ASC Studio" }, { k: "site", th: "พื้นดิน / ภาพดาวเทียม" },
];
/** ป้ายข้อความเป็นภาพ (canvas) — ใช้กับข้อความชี้ มิติ 3D และข้อความ 3D */
function textCanvas(s, px = 64, color = "#1d2733", bg = "rgba(255,255,255,.92)") {
  const c = document.createElement("canvas"), g = c.getContext("2d"), font = `${px}px Tahoma, "Noto Sans Thai", sans-serif`;
  g.font = font; const w = Math.ceil(g.measureText(s).width) + px * 0.6, h = Math.ceil(px * 1.45);
  c.width = w; c.height = h; g.font = font; if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = "rgba(0,0,0,.35)"; g.strokeRect(1, 1, w - 2, h - 2); }
  g.fillStyle = color; g.textBaseline = "middle"; g.fillText(s, px * 0.3, h / 2); return c;
}
function sprite(s, hM, color, bg) {
  const c = textCanvas(s, 64, color, bg), t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  sp.scale.set((hM * c.width) / c.height, hM, 1); sp.renderOrder = 6; sp.center.set(0.5, 0); return sp;
}

/** UV เป็นเมตรบนกล่อง (ลายวัสดุไม่ยืดตามขนาดผนัง) */
function boxUV(geo, w, h, d) {
  const uv = geo.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]); }
  return geo;
}
/** UV เป็นเมตรบนระนาบเอียง (หลังคา) — u ตามแนวนอนของหน้า · v ตามแนวลาด */
function planarUV(geo) {
  const p = geo.attributes.position, n = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  a.fromBufferAttribute(p, 0); b.fromBufferAttribute(p, 1); c.fromBufferAttribute(p, 2);
  n.subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)).normalize();
  let u = new THREE.Vector3(0, 1, 0).cross(n); if (u.lengthSq() < 1e-6) u.set(1, 0, 0); u.normalize();
  const v = new THREE.Vector3().crossVectors(n, u).normalize(), uv = [], q = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { q.fromBufferAttribute(p, i); uv.push(q.dot(u), q.dot(v)); }
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return geo;
}

export class View3D {
  constructor(canvas, host) {
    this.canvas = canvas; this.host = host;          // host: { hist, onChange(), status(msg) }
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.72;
    r.outputColorSpace = THREE.SRGBColorSpace;
    const sc = (this.scene = new THREE.Scene());
    sc.fog = new THREE.Fog(0xc9dbea, 180, 900);
    // ท้องฟ้าจริง (สีตามตำแหน่งดวงอาทิตย์) + แสงสะท้อนจากฟ้าชุดเดียวกัน
    this.sky = new Sky(); this.sky.scale.setScalar(4000); this.sky.name = "ท้องฟ้า"; sc.add(this.sky);
    this.envSky = new Sky(); this.envSky.scale.setScalar(1000); this.envScene = new THREE.Scene(); this.envScene.add(this.envSky);
    for (const s of [this.sky, this.envSky]) Object.assign(s.material.uniforms, { turbidity: { value: 3.2 }, rayleigh: { value: 1.4 }, mieCoefficient: { value: 0.004 }, mieDirectionalG: { value: 0.82 } });
    this.pmrem = new THREE.PMREMGenerator(r); this.envRT = null;
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 6000);
    this.camera.position.set(18, 14, 22);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN };   // ล้อ = ซูม · ปุ่มกลาง = หมุนรอบ (แบบ SketchUp)
    this.controls.maxPolarAngle = Math.PI * 0.497;
    this.hemi = new THREE.HemisphereLight(0xcfe3ff, 0x5b6b45, 0.3); sc.add(this.hemi);
    const sun = (this.sun = new THREE.DirectionalLight(0xfff0d8, 2.7));
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.025;
    sc.add(sun, sun.target);
    const gg = new THREE.PlaneGeometry(1200, 1200); gg.attributes.uv.array.forEach((v, i, a) => (a[i] = v * 1200));
    const ground = (this.ground = new THREE.Mesh(gg, material("grass")));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true;   // 0.26: ต่ำกว่าพื้นอาคาร 20 มม. (เดิม 3 มม. กะพริบเมื่อมองไกล) ground.name = "พื้นดิน"; ground.userData.tag = "site";
    sc.add(ground);
    this.model = new THREE.Group(); this.model.name = "แบบ"; sc.add(this.model);
    this.asc = new THREE.Group(); this.asc.name = "โมเดล ASC Studio"; sc.add(this.asc);
    this.backdrop = null;
    this.cadGroup = new THREE.Group(); this.cadGroup.name = "เส้น CAD"; sc.add(this.cadGroup);
    this.mats = {
      wall: material("white"),
      wallSel: new THREE.MeshStandardMaterial({ color: 0xf2b36b, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
      slab: material("concrete"),
      roof: material("metal"),
      gable: material("white"),
      glass: material("glass"),
      door: material("wood"),
      frame: material("alu"),
      mass: material("white"),
      pv: material("pv"),
      pvFrame: new THREE.MeshStandardMaterial({ color: 0xc9ccd1, roughness: 0.3, metalness: 0.9 }),
    };
    // รูปแบบแสดงผล
    this.style = "render"; this.edgeAngle = 25; this.hiddenTags = new Set(); this.shadowsOn = true; this.aoOn = true; this.light = 1; this.fogOn = true; this.fog = sc.fog;
    this.notes = new THREE.Group(); this.notes.name = "เส้น ข้อความ มิติ 3D"; this.notesScene = new THREE.Scene(); this.notesScene.add(this.notes);   // ชั้นบน: วาดหลังภาพผ่าน AO (ป้ายไม่เป็นเงาดำ)
    this.axes = new THREE.AxesHelper(3); this.axes.name = "แกน"; this.axes.renderOrder = 4; this.axes.material.depthTest = false; sc.add(this.axes);
    this.secPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xe8892b, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
    this.secPlane.rotation.x = -Math.PI / 2; this.secPlane.visible = false; this.secPlane.userData.helper = true; sc.add(this.secPlane);
    this.fmtLen = (m) => `${Math.round(m * 1000).toLocaleString()} มม.`;
    this.edgeMat = new THREE.LineBasicMaterial({ color: 0x1b1d20 });
    this.backMat = new THREE.LineDashedMaterial({ color: 0x1b1d20, dashSize: 0.18, gapSize: 0.12, transparent: true, opacity: 0.55, depthFunc: THREE.GreaterDepth });
    this.xray = new THREE.MeshLambertMaterial({ color: 0xdfe6ee, transparent: true, opacity: 0.35, depthWrite: false });
    this.hidden = new THREE.MeshBasicMaterial({ color: 0xffffff, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    this.mono = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    this.flat = new Map();
    // ภาพหลังผ่านขั้นตอนเพิ่มคุณภาพ: เงาซอกมุม (AO) + ลบรอยหยัก + tone mapping
    const cp = (this.composer = new EffectComposer(r));
    cp.addPass(new RenderPass(sc, this.camera));
    this.gtao = new GTAOPass(sc, this.camera, 1, 1);
    this.gtao.updateGtaoMaterial({ radius: 0.8, distanceExponent: 1.5, thickness: 2, scale: 1.2, samples: 16 });
    this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    this.gtao.blendIntensity = 1;
    cp.addPass(this.gtao);
    this.smaa = new SMAAPass(1, 1); cp.addPass(this.smaa);
    cp.addPass(new OutputPass());
    this.setSun(135, 50);
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    // วาดเฉพาะเมื่อมีอะไรเปลี่ยน: ระหว่างหมุน/ลาก = ภาพเร็ว (ไม่มี AO/ลบรอยหยัก) · หยุดนิ่ง 0.25 วินาที = ภาพสวยเต็มที่ 1 ครั้ง
    // (เดิมวาดภาพเต็มทุกเฟรม → เครื่องการ์ดจอในตัวได้ ~1.5 ภาพ/วินาที คลิกแล้วเหมือนไม่ตอบสนอง)
    this.dirty = true; this.lastChange = performance.now(); this.hqDone = false;
    const wake = () => this.invalidate();
    for (const ev of ["pointerdown", "pointermove", "pointerup", "wheel"]) canvas.addEventListener(ev, wake, { passive: true });
    for (const ev of ["click", "input", "change", "keydown", "keyup", "pointerup"]) document.addEventListener(ev, wake, { passive: true, capture: true });
    this.controls.addEventListener("change", wake);
    // 0.26 แก้กะพริบ: เดิมเลื่อนเมาส์/หมุนล้อทีละครั้ง = สลับภาพเร็ว (ไม่มีเงาซอกมุม) ↔ ภาพเต็มหลัง 250 มส. → เงาโผล่-หายเป็นจังหวะ
    //   ใหม่: ภาพเต็มทุกครั้งที่กล้องนิ่ง · ภาพเร็วเฉพาะตอนกล้องกำลังเคลื่อน/ลากอยู่ · เครื่องแรง (ภาพเต็ม < 25 มส.) ใช้ภาพเต็มตลอด
    this.navUntil = 0; this.hqMs = 999; this.pressed = false;
    canvas.addEventListener("pointerdown", () => (this.pressed = true), { passive: true });
    addEventListener("pointerup", () => { this.pressed = false; this.invalidate(); }, { passive: true });
    canvas.addEventListener("wheel", () => (this.navUntil = performance.now() + 400), { passive: true });
    const hq = () => { const t = performance.now(); this.composer.render(); this.overlay(); this.hqMs = this.hqMs * 0.7 + (performance.now() - t) * 0.3; this.hqDone = true; };
    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      const moved = this.controls.update(), now = performance.now();
      if (this.anim) { this.anim(now); this.invalidate(); }
      if (moved) { this.invalidate(); this.navUntil = now + 400; }
      this.fitDepth();
      const nav = now < this.navUntil || (this.pressed && moved);
      if (this.dirty) {
        this.dirty = false;
        if (!nav || this.hqMs < 25) { hq(); return; }
        this.renderer.render(this.scene, this.camera); this.overlay(); this.hqDone = false; return;
      }
      if (!this.hqDone && !nav) hq();
    };
    loop();
  }

  get doc() { return this.host.hist.doc; }
  /** ขอให้วาดภาพใหม่ (เรียกได้บ่อย ไม่เปลือง) */
  invalidate() { this.dirty = true; this.lastChange = performance.now(); }
  /** 0.26 แก้กะพริบ: ระยะใกล้/ไกลของกล้องตามระยะที่มองจริง (เดิมตายตัว 0.1–6,000 ม. → ความละเอียดความลึกไม่พอเมื่อมองไกล) */
  fitDepth() {
    const c = this.camera; if (!c.isPerspectiveCamera) return;
    const d0 = c.position.distanceTo(this.controls.target); if (!isFinite(d0) || d0 <= 0) return;   // กล้องยังไม่พร้อม (ช่องภาพสูง 0 ฯลฯ)
    const d = d0, near = Math.min(5, Math.max(0.02, d * 0.004)), far = Math.max(1500, d * 40);
    if (Math.abs(near - c.near) / c.near > 0.15 || Math.abs(far - c.far) / c.far > 0.15) { c.near = near; c.far = far; c.updateProjectionMatrix(); }
  }
  /** เส้น ป้ายข้อความ มิติ 3D วาดทับภาพสุดท้าย */
  overlay() { const r = this.renderer; r.autoClear = false; r.render(this.notesScene, this.camera); r.autoClear = true; }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false); this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.invalidate && this.invalidate();
  }

  /** ดวงอาทิตย์: azimuth (0=เหนือ ตามเข็ม) · มุมเงย — ท้องฟ้า แสง ความสว่างภาพ และไฟในอาคารตอนพลบค่ำ ตามไปด้วย */
  setSun(az, el) {
    this.sunAz = az; this.sunEl = el;
    const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180;
    // ทิศเหนือของแบบ = −z ใน three; ตะวันออก = +x
    this.sunDir = new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
    const day = THREE.MathUtils.clamp(el / 20, 0, 1), dusk = 1 - THREE.MathUtils.clamp((el - 1) / 14, 0, 1);
    this.sun.intensity = 2.7 * THREE.MathUtils.clamp(el / 14, 0.15, 1) * this.light;
    this.sun.color.setHSL(0.09, 0.85, 0.62 + 0.3 * day);
    this.hemi.intensity = 0.12 + 0.18 * day;
    this.scene.environmentIntensity = 0.35 + 0.25 * day;
    this.renderer.toneMappingExposure = 0.72 + 0.5 * dusk;
    this.scene.fog.color.setHSL(0.58, 0.35, 0.5 + 0.28 * day);
    this.sky.material.uniforms.sunPosition.value.copy(this.sunDir); this.envSky.material.uniforms.sunPosition.value.copy(this.sunDir);
    const glow = dusk > 0.5 ? 0.5 : 0;                                  // พลบค่ำ: กระจกเรืองแสงอุ่น = ไฟในอาคารติด
    for (const g of [this.mats.glass]) { g.emissive = g.emissive || new THREE.Color(); g.emissive.setHex(0xffb35c); g.emissiveIntensity = glow; }
    material("lamp").emissiveIntensity = glow ? 3 : 0;
    clearTimeout(this._envT); this._envT = setTimeout(() => this.updateEnv(), 80);
    this._fitShadow();
  }
  updateEnv() { const old = this.envRT; this.envRT = this.pmrem.fromScene(this.envScene, 0, 1, 1000); this.scene.environment = this.envRT.texture; if (old) old.dispose(); this.invalidate(); }

  bounds() {
    const b = new THREE.Box3(); for (const o of this.model.children) if (!o.userData.helper) b.expandByObject(o);
    if (this.asc.children.length) b.union(new THREE.Box3().setFromObject(this.asc));
    return b;
  }

  _fitShadow() {
    const b = this.bounds();
    const size = b.isEmpty() ? 20 : b.getSize(new THREE.Vector3()).length() * 0.7 + 4;
    const c = b.isEmpty() ? new THREE.Vector3() : b.getCenter(new THREE.Vector3());
    const cam = this.sun.shadow.camera;
    cam.left = cam.bottom = -size; cam.right = cam.top = size; cam.near = 0.5; cam.far = size * 4 + 60;
    cam.updateProjectionMatrix();
    this.sun.target.position.copy(c);
    this.sun.position.copy(c).addScaledVector(this.sunDir, size * 2 + 30);
  }

  // ---------------------------------------------------------------- สร้างโมเดลจากแบบ
  build() {
    const g = this.model, d = this.doc;
    g.traverse((o) => { if (o.geometry && !o.userData.shared) o.geometry.dispose(); });   // shared = โมเดลนำเข้าที่จำไว้ (ใช้ซ้ำทุกครั้งที่วาดฉาก)
    g.clear();
    const add = (mesh, name, data, tag) => { mesh.castShadow = mesh.receiveShadow = true; mesh.name = name; mesh.userData = { ...(data || {}), tag: tag || (data && data.type) }; g.add(mesh); return mesh; };
    // พื้น
    const g1 = d.walls.filter((w) => (w.base || 0) <= 100), wb = g1.length && !(d.struct || []).some((o) => o.kind === "slab" && Math.abs(o.z ?? 0) < 200) ? M.wallBounds({ walls: g1 }) : null;
    if (wb) {
      const W = (wb.x1 - wb.x0) * MM, D = (wb.y1 - wb.y0) * MM;
      const slab = new THREE.Mesh(boxUV(new THREE.BoxGeometry(W, 0.1, D), W, 0.1, D), this.mats.slab);
      slab.position.set(((wb.x0 + wb.x1) / 2) * MM, -0.05, (-(wb.y0 + wb.y1) / 2) * MM);
      add(slab, "พื้น", null, "slab");
    }
    // ผนัง (ตัดช่องเปิด)
    for (const w of d.walls) {
      const L = M.wallLength(w); if (L < 1) continue;
      const u = M.norm(M.sub(w.b, w.a)), ang = Math.atan2(u[1], u[0]);
      for (const p of M.wallPieces(d, w)) {
        const W = (p.s1 - p.s0) * MM, Hh = (p.z1 - p.z0) * MM, T = w.thick * MM;
        const geo = boxUV(new THREE.BoxGeometry(W, Hh, T), W, Hh, T);
        const m = new THREE.Mesh(geo, w.mat ? material(w.mat) : this.mats.wall);
        const c = M.add(w.a, M.mul(u, (p.s0 + p.s1) / 2));
        m.position.copy(v3(c, (w.base || 0) + (p.z0 + p.z1) / 2));
        m.rotation.y = ang;
        add(m, "ผนัง", { type: "walls", id: w.id });
      }
      const zb = w.base || 0;
      for (const { o, s0, s1 } of M.openingSpans(d, w)) {
        const c = M.add(w.a, M.mul(u, (s0 + s1) / 2)), W = (s1 - s0) * MM, H = o.height * MM;
        if (o.kind === "window") {
          const gl = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.02), this.mats.glass);
          gl.position.copy(v3(c, zb + o.sill + o.height / 2)); gl.rotation.y = ang; gl.castShadow = false; gl.name = "กระจก"; gl.userData = { type: "openings", id: o.id, tag: "openings" }; g.add(gl);
          const T = w.thick * MM * 1.05, fr = new THREE.Mesh(boxUV(new THREE.BoxGeometry(W, 0.05, T), W, 0.05, T), this.mats.frame);
          fr.position.copy(v3(c, zb + o.sill)); fr.rotation.y = ang; add(fr, "ขอบหน้าต่าง", { type: "openings", id: o.id }, "openings");
        } else {
          const leaf = new THREE.Mesh(boxUV(new THREE.BoxGeometry(W * 0.98, H, 0.04), W * 0.98, H, 0.04), this.mats.door);
          leaf.position.copy(v3(c, zb + o.sill + o.height / 2)); leaf.rotation.y = ang; add(leaf, "ประตู", { type: "openings", id: o.id });
        }
      }
    }
    // กล่อง push-pull
    for (const m of d.masses) {
      const shape = new THREE.Shape(m.pts.map((p) => new THREE.Vector2(p[0] * MM, p[1] * MM)));
      const geo = new THREE.ExtrudeGeometry(shape, { depth: Math.max(1, m.height) * MM, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);                      // extrude ตาม +z ของ shape → ขึ้นแกน y
      const mesh = new THREE.Mesh(geo, m.mat ? material(m.mat) : this.mats.mass);
      mesh.position.y = (m.base || 0) * MM;
      add(mesh, m.name || "กล่อง", { type: "masses", id: m.id }, m.tag || "masses");
      if (m.mat === "water") mesh.castShadow = false;
    }
    // ผิว + เส้น (0.26 · mesh.js): ก้อนละ 1 เมช · กลุ่มวัสดุต่อหน้า · ตารางสามเหลี่ยม → หน้า (เลือกหน้าได้) · เส้นขอบแยก (เลือกเส้นได้)
    for (const s of d.solids || []) if (!s.off) this._solid(s, add);
    // โครงสร้าง: ฐานราก เสา คาน พื้น บันได (คอนกรีตเสริมเหล็ก)
    for (const o of d.struct || []) {
      const mt = material(o.mat || (o.kind === "slab" ? "concrete" : o.kind === "stair" ? "granite" : "concrete")), data = { type: "struct", id: o.id }, nm = `${ST.KINDS[o.kind] || "โครงสร้าง"} ${o.mark || ""}`;
      if (o.kind === "column" || o.kind === "footing") {
        const w = o.w, l = o.kind === "footing" ? o.l : o.l || o.w, z0 = o.kind === "footing" ? (o.z ?? -1200) - o.t : o.base ?? 0, z1 = o.kind === "footing" ? o.z ?? -1200 : o.top ?? 3000;
        if (z1 - z0 < 1) continue;
        const m = new THREE.Mesh(boxUV(new THREE.BoxGeometry(w * MM, (z1 - z0) * MM, l * MM), w * MM, (z1 - z0) * MM, l * MM), mt);
        m.position.copy(v3(o.p, (z0 + z1) / 2)); m.rotation.y = ((o.rot || 0) * Math.PI) / 180; add(m, nm, data, "struct");
      } else if (o.kind === "beam") {
        const Lb = M.dist(o.a, o.b); if (Lb < 1) continue;
        const m = new THREE.Mesh(boxUV(new THREE.BoxGeometry(Lb * MM, o.d * MM, o.w * MM), Lb * MM, o.d * MM, o.w * MM), mt);
        m.position.copy(v3(M.mul(M.add(o.a, o.b), 0.5), (o.z ?? 0) - o.d / 2)); m.rotation.y = Math.atan2(o.b[1] - o.a[1], o.b[0] - o.a[0]); add(m, nm, data, "struct");
      } else if (o.kind === "slab") {
        const sh = new THREE.Shape(o.pts.map((q) => new THREE.Vector2(q[0] * MM, q[1] * MM)));
        for (const hl of o.holes || []) sh.holes.push(new THREE.Path(hl.map((q) => new THREE.Vector2(q[0] * MM, q[1] * MM))));
        const geo = new THREE.ExtrudeGeometry(sh, { depth: o.t * MM, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
        const m = new THREE.Mesh(geo, mt); m.position.y = ((o.z ?? 0) - o.t) * MM; add(m, nm, data, "struct");
      } else if (o.kind === "stair") {
        const n = Math.max(2, o.n | 0), r = (o.rise || 3000) / n, ang = ((o.rot || 0) * Math.PI) / 180, u = [Math.cos(ang), Math.sin(ang)];
        const geos = [];
        for (let i = 0; i < n; i++) {
          const h = (i + 1) * r, c = M.add(o.p, M.mul(u, (i + 0.5) * o.run)), gb = new THREE.BoxGeometry(o.run * MM, Math.min(h, r * 3) * MM, o.w * MM);
          gb.translate(0, ((o.base ?? 0) + h - Math.min(h, r * 3) / 2) * MM, 0); gb.rotateY(ang); gb.translate(c[0] * MM, 0, -c[1] * MM); geos.push(gb);
        }
        for (const gb of geos) { const m = new THREE.Mesh(gb, mt); add(m, nm, data, "struct"); }
      }
    }
    // ชิ้นส่วน (ต้นไม้ รถ ของตกแต่ง)
    const mlabels = [];
    for (const it of d.items3d || []) {
      const grp = it.kind === "model" ? modelItem(it, () => this.build()) : buildItem(it); grp.position.copy(v3(it.p, it.z || 0)); grp.rotation.y = ((it.rot || 0) * Math.PI) / 180;
      grp.userData = { type: "items", id: it.id, tag: it.tag || "items" };
      grp.traverse((o) => { if (o.isMesh) o.userData = { ...o.userData, type: "items", id: it.id, tag: it.tag || "items", name: kindTh(it.kind) }; });
      g.add(grp);
      if (grp.label) { grp.label.position.add(grp.position); mlabels.push(grp.label); }   // ป้ายชื่อ + ขนาดของโมเดลนำเข้า → ชั้นบน (หลัง buildNotes)
    }
    // กวาดหน้าตัดตามเส้น (Follow Me): กล่องต่อกันทีละช่วง
    for (const sw of d.sweeps || []) {
      const P = sw.pts, n = P.length - (sw.closed ? 0 : 1), W = sw.w * MM, H = sw.h * MM;
      for (let i = 0; i < n; i++) {
        const a = P[i], b = P[(i + 1) % P.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]) * MM; if (L < 0.001) continue;
        const mesh = new THREE.Mesh(boxUV(new THREE.BoxGeometry(L + W, H, W), L + W, H, W), material(sw.mat || "concrete"));
        mesh.position.copy(v3([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], (sw.z || 0) + sw.h / 2)); mesh.rotation.y = Math.atan2(b[1] - a[1], b[0] - a[0]);
        add(mesh, "หน้าตัดกวาดตามเส้น", { type: "sweeps", id: sw.id }, sw.tag || "land");
      }
    }
    this._mlabels = mlabels; this.buildNotes();
    // หลังคา + แผง
    const rf = M.roofFaces(d);
    for (const f of rf.faces) {
      const pts = f.pts3.map((p) => v3(p, p[2]));
      const geo = new THREE.BufferGeometry();
      const tri = pts.length === 3 ? [0, 1, 2] : [0, 1, 2, 0, 2, 3];
      geo.setFromPoints(tri.map((i) => pts[i]));
      geo.computeVertexNormals(); planarUV(geo);
      add(new THREE.Mesh(geo, f.gable ? this.mats.gable : d.roof.mat ? material(d.roof.mat) : this.mats.roof), f.gable ? "หน้าจั่ว" : "หลังคา " + f.key, { type: "roof", id: f.key });
    }
    this.pv = M.pvLayout(d, M.bestRoofFace(rf.faces));
    if (this.pv.count) {
      const n = this.pv.normal, nn = new THREE.Vector3(n[0], n[2], -n[1]).normalize();
      for (const p of this.pv.panels) {
        const c = p.c3.map((q) => v3(q, q[2]).addScaledVector(nn, 0.09));
        const geo = new THREE.BufferGeometry().setFromPoints([c[0], c[1], c[2], c[0], c[2], c[3]]);
        geo.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
        geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, this.mats.pv); mesh.castShadow = true; mesh.name = "แผงโซลาร์"; mesh.userData = { tag: "pv" }; g.add(mesh);
      }
    }
    this._fitShadow();
    this.applyStyle();
    if (this.onBuilt) this.onBuilt();
    this.invalidate();
    return this.pv;
  }

  // ---------------------------------------------------------------- รูปแบบแสดงผล (Styles) · Tags · เส้นขอบ
  meshes() { const out = []; for (const root of [this.model, this.asc]) root.traverse((o) => { if (o.isMesh && !o.userData.helper) out.push(o); }); return out; }
  _flat(src) {
    if (Array.isArray(src)) return src.map((s) => this._flat(s));
    if (this.flat.has(src.uuid)) return this.flat.get(src.uuid);
    let col = src.color ? src.color.clone() : new THREE.Color(0xdddddd);
    const img = src.map && src.map.image;
    if (img && img.getContext) { const d = img.getContext("2d").getImageData(0, 0, img.width, img.height).data; let r = 0, g = 0, b = 0, n = 0; for (let i = 0; i < d.length; i += 4 * 97) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; } col = new THREE.Color().setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace); }
    const m = new THREE.MeshLambertMaterial({ color: col, transparent: src.transparent, opacity: src.opacity, side: src.side, depthWrite: !src.transparent, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    this.flat.set(src.uuid, m); return m;
  }
  /** เส้น ข้อความชี้ มิติ 3D ข้อความ 3D (doc.lines · doc.texts3d · doc.dims3d) */
  buildNotes() {
    const g = this.notes, d = this.doc, fmt = this.fmtLen;
    g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map) o.material.map.dispose(); });
    g.clear();
    for (const o of [...this.model.children]) if (o.userData.type === "texts3d") { o.geometry.dispose(); o.material.map && o.material.map.dispose(); o.removeFromParent(); }
    const lm = new THREE.LineBasicMaterial({ color: 0x1d2733 }), dm = new THREE.LineBasicMaterial({ color: 0xb5522b, depthTest: false });
    for (const l of d.lines) {
      const pts = l.pts.map((p) => v3(p, (l.z || 0) + 4)); if (l.closed) pts.push(pts[0]);
      const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lm); ln.userData = { type: "lines", id: l.id, tag: "notes" }; g.add(ln);
    }
    for (const t of d.texts3d || []) {
      if (t.kind === "3d") {
        const c = textCanvas(t.s, 128, t.color || "#2b2f36", null), tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
        const H = (t.h || 600) * MM, W = (H * c.width) / c.height;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.5 }));
        m.position.copy(v3(t.p, (t.z || 0) + (t.h || 600) / 2)); m.rotation.y = ((t.rot || 0) * Math.PI) / 180; m.castShadow = true;
        m.userData = { type: "texts3d", id: t.id, tag: "notes", helper: true }; m.visible = !this.hiddenTags.has("notes"); this.model.add(m); continue;
      }
      const a = v3(t.p, t.z || 0), lp = t.at ? v3(t.at, t.atz ?? t.z ?? 0) : a.clone().add(new THREE.Vector3(0.6, 0.9, 0));
      const sp = sprite(t.s, (t.h || 250) * MM * 1.6, t.color || "#1d2733"); sp.position.copy(lp); sp.userData = { type: "texts3d", id: t.id, tag: "notes" }; g.add(sp);
      const ld = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, lp]), dm); ld.userData = sp.userData; g.add(ld);
    }
    for (const m of d.dims3d || []) {
      const a = v3(m.a, m.a[2]), b = v3(m.b, m.b[2]), dir = b.clone().sub(a), L = dir.length(); if (L < 1e-4) continue;
      const up = Math.abs(dir.clone().normalize().y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0), off = up.multiplyScalar((m.off ?? 400) * MM);
      const a2 = a.clone().add(off), b2 = b.clone().add(off), tick = dir.clone().normalize().cross(new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(0.08);
      if (tick.lengthSq() < 1e-6) tick.set(0.08, 0, 0);
      const seg = [a, a2, b, b2, a2, b2, a2.clone().add(tick), a2.clone().sub(tick), b2.clone().add(tick), b2.clone().sub(tick)];
      const ls = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seg), dm); ls.renderOrder = 6; ls.userData = { type: "dims3d", id: m.id, tag: "notes" }; g.add(ls);
      const sp = sprite(fmt(L), (m.h || this.dimText || 250) * MM * 1.4, "#b5522b"); sp.position.copy(a2.clone().add(b2).multiplyScalar(0.5)); sp.userData = ls.userData; g.add(sp);
    }
    for (const s of this._mlabels || []) g.add(s);                   // ป้ายโมเดลนำเข้า (import3d.js)
    const ax = d.axes3d; this.axes.position.copy(ax ? v3(ax.o, ax.o[2] || 0) : new THREE.Vector3()); this.axes.rotation.y = ax ? ((ax.rot || 0) * Math.PI) / 180 : 0;
    g.visible = !this.hiddenTags.has("notes");
  }
  _solid(s, add) {
    const pos = [], groups = [], faceOfTri = [], mats = [], matIdx = new Map();
    // ก้อนเปิด (หน้าแบนเดี่ยว · ลบหน้าแล้ว) เห็นได้ทั้งสองด้านแบบ SketchUp (และคลิกโดนจากด้านหลัง)
    const open = !SOL.isClosed(s), two = (m) => { if (!open) return m; this._two = this._two || new Map(); if (!this._two.has(m.uuid)) { const c = m.clone(); c.side = THREE.DoubleSide; this._two.set(m.uuid, c); } return this._two.get(m.uuid); };
    const matOf = (k) => { const key = k || s.mat || ""; if (!matIdx.has(key)) { matIdx.set(key, mats.length); mats.push(two(key ? material(key) : this.mats.mass)); } return matIdx.get(key); };
    s.faces.forEach((F, fi) => {
      let tris; try { tris = SOL.triangulate(s, fi); } catch (e) { tris = []; }
      const start = pos.length / 3;
      for (const t of tris) { for (const i of t) { const p = s.verts[i]; pos.push(p[0] * MM, p[2] * MM, -p[1] * MM); } faceOfTri.push(fi); }
      if (tris.length) groups.push([start, tris.length * 3, matOf(F.mat)]);
    });
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    for (const [a, n, m] of groups) geo.addGroup(a, n, m);
    geo.computeVertexNormals();
    const uv = new Float32Array((pos.length / 3) * 2);                  // UV ตามระนาบของหน้า (ลายวัสดุไม่ยืด)
    for (let k = 0, t = 0; k < pos.length; k += 9, t++) {
      const n = SOL.normal(s, faceOfTri[t]), b = SOL.basis(n);
      for (let j = 0; j < 3; j++) { const p = [pos[k + j * 3] / MM, -pos[k + j * 3 + 2] / MM, pos[k + j * 3 + 1] / MM]; uv[(k / 3 + j) * 2] = SOL.V.dot(p, b.u) * MM; uv[(k / 3 + j) * 2 + 1] = SOL.V.dot(p, b.v) * MM; }
    }
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); geo.userData.faceOfTri = faceOfTri;
    const mesh = new THREE.Mesh(geo, mats.length > 1 ? mats : mats[0] || this.mats.mass);
    add(mesh, s.name || "ก้อน", { type: "solids", id: s.id }, s.tag || "masses");
    if (mats.some((m) => m.transparent)) mesh.castShadow = false;
    // เส้นขอบ: ทุกเส้นของผิว (ไม่ใช่มุมจากการแบ่งสามเหลี่ยม) · เก็บ key ต่อช่วงไว้เลือกเส้น
    const E = [...SOL.edges(s).entries()].filter(([, e]) => !(s.soft || []).includes(SOL.ekey(e.a, e.b)) && !(s.hidden || []).includes(SOL.ekey(e.a, e.b)));
    const lp = new Float32Array(E.length * 6);
    E.forEach(([, e], k) => { [e.a, e.b].forEach((i, j) => { const p = s.verts[i]; lp.set([p[0] * MM, p[2] * MM, -p[1] * MM], k * 6 + j * 3); }); });
    const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.BufferAttribute(lp, 3));
    const ls = new THREE.LineSegments(lg, this.solidEdgeMat || (this.solidEdgeMat = new THREE.LineBasicMaterial({ color: 0x1b1d20 })));
    ls.userData = { helper: true, solidEdges: true, id: s.id, keys: E.map(([k]) => k) }; ls.raycast = () => {};
    mesh.add(ls); mesh.userData.solidEdges = ls; mesh.userData.edges = null;
  }
  _edges(m) {
    if (m.userData.solidEdges) return;                                // ผิว+เส้นมีเส้นขอบของตัวเอง
    if (m.userData.edges) return;
    const eg = new THREE.EdgesGeometry(m.geometry, m.userData.edgeAngle || this.edgeAngle);
    const e = new THREE.LineSegments(eg, this.edgeMat), b = new THREE.LineSegments(eg, this.backMat);
    b.computeLineDistances(); e.raycast = b.raycast = () => {}; e.userData.helper = b.userData.helper = true;
    m.add(e, b); m.userData.edges = [e, b];
  }
  setStyle(k) { this.style = k; this.applyStyle(); }
  applyStyle() {
    const k = this.style, edges = k !== "render", full = k === "render" || k === "tex";
    for (const m of this.meshes()) {
      if (m.userData.mat0 === undefined) m.userData.mat0 = m.material;
      const m0 = m.userData.mat0, sel = m0 === this.mats.wallSel;
      m.material = sel || full ? m0 : k === "shaded" || k === "back" ? this._flat(m0) : k === "xray" ? this.xray : k === "mono" ? this.mono : this.hidden;
      if (edges) this._edges(m);
      if (m.userData.edges) { m.userData.edges[0].visible = edges; m.userData.edges[1].visible = k === "back"; }
      if (m.userData.solidEdges) m.userData.solidEdges.visible = k !== "render" || !!this.solidEdgesInRender;   // ผิว+เส้น: เส้นขอบแบบ SketchUp (ภาพนำเสนอซ่อน)
      m.visible = !this.hiddenTags.has(m.userData.tag);
    }
    if (this.asc.children.length) this.asc.visible = !this.hiddenTags.has("asc");
    this.hidden.colorWrite = k !== "wire"; this.hidden.depthWrite = k !== "wire";
    this.ground.material = full ? material("grass") : k === "shaded" || k === "back" ? this._flat(material("grass")) : k === "mono" ? this.mono : this.hidden;
    this.ground.visible = !this.hiddenTags.has("site"); if (this.backdrop) this.backdrop.visible = this.ground.visible;
    this.notes.visible = !this.hiddenTags.has("notes"); this.scene.fog = this.fogOn ? this.fog : null;
    this.sky.visible = full || k === "shaded";
    this.scene.background = this.sky.visible ? null : new THREE.Color(k === "mono" ? 0xffffff : 0xf4f5f7);
    this.gtao.enabled = k === "render" && this.aoOn;
    this.sun.castShadow = this.shadowsOn && k !== "wire" && k !== "hidden" && k !== "xray";
  }
  setEdgeAngle(a) { this.edgeAngle = a; for (const m of this.meshes()) if (m.userData.edges) { m.userData.edges.forEach((e) => { e.removeFromParent(); }); m.userData.edges[0].geometry.dispose(); m.userData.edges = null; } this.applyStyle(); }
  setTagVisible(tag, on) { on ? this.hiddenTags.delete(tag) : this.hiddenTags.add(tag); this.applyStyle(); }
  setShadows(on) { this.shadowsOn = on; this.applyStyle(); }
  setFog(on) { this.fogOn = on; this.applyStyle(); }
  setLight(k) { this.light = k; this.setSun(this.sunAz, this.sunEl); }

  // ---------------------------------------------------------------- กล้อง
  fit(aspect) {
    const b = this.bounds();
    if (b.isEmpty()) return;
    const c = b.getCenter(new THREE.Vector3()), r = b.getSize(new THREE.Vector3()).length() / 2;
    const a = aspect || this.camera.aspect, vfov = (this.camera.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * a);
    const dist = (r / Math.sin(Math.min(vfov, hfov) / 2)) * 0.82;
    const dir = new THREE.Vector3(0.75, 0.55, 1).normalize();
    this.camera.position.copy(c.clone().addScaledVector(dir, dist));
    this.controls.target.copy(c); this.controls.update();
  }
  /** บินกล้องไปตำแหน่งใหม่ (นุ่ม 0.7 วินาที) */
  flyTo(pos, tgt, ms = 700) {
    this.prevView = [this.camera.position.clone(), this.controls.target.clone()];
    const p0 = this.camera.position.clone(), t0 = this.controls.target.clone(), s = performance.now();
    this.anim = (now) => { const k = Math.min(1, (now - s) / ms), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; this.camera.position.lerpVectors(p0, pos, e); this.controls.target.lerpVectors(t0, tgt, e); if (k >= 1) this.anim = null; };
  }
  /** มุมมองมาตรฐานแบบ SketchUp: iso · top · front · right · back · left (หน้า = ทิศใต้ของแบบ) */
  setView(name) {
    const b = this.bounds();
    if (b.isEmpty()) b.set(new THREE.Vector3(-10, 0, -10), new THREE.Vector3(10, 3, 10));   // แบบว่าง: มองพื้นที่ 20×20 ม. รอบจุดกำเนิด (เดิมกดแล้วไม่ขยับ)
    const c = b.getCenter(new THREE.Vector3()), r = Math.max(b.getSize(new THREE.Vector3()).length() / 2, 3);
    const d = (r / Math.sin(((this.camera.fov * Math.PI) / 180) / 2)) * 0.9;
    const dir = { iso: [0.75, 0.6, 1], top: [0, 1, 0.0001], front: [0, 0.08, 1], right: [1, 0.08, 0], back: [0, 0.08, -1], left: [-1, 0.08, 0] }[name];
    this.flyTo(c.clone().addScaledVector(new THREE.Vector3(...dir).normalize(), d), c);
  }
  previous() { if (this.prevView) this.flyTo(this.prevView[0].clone(), this.prevView[1].clone()); }

  /** ตัดหน้า (section) แนวนอนที่ความสูง mm · null = ปิด */
  setSection(mm) {
    this.renderer.clippingPlanes = mm == null ? [] : [new THREE.Plane(new THREE.Vector3(0, -1, 0), mm * MM)];
    this.section = mm;
    const b = this.bounds(); this.secPlane.visible = mm != null && !b.isEmpty();
    if (this.secPlane.visible) { const s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3()); this.secPlane.scale.set(s.x + 2, s.z + 2, 1); this.secPlane.position.set(c.x, mm * MM - 0.002, c.z); }
  }

  // ---------------------------------------------------------------- render + ส่งออก
  /** ภาพนิ่งความละเอียดสูง (ภาพนำเสนอ: AO 32 ตัวอย่าง · เงา 4096) → dataURL PNG */
  renderStill(width = 1920, height = 1080, fit = true) {
    const r = this.renderer, oldSize = r.getSize(new THREE.Vector2()), oldPR = r.getPixelRatio();
    const oldMap = this.sun.shadow.mapSize.clone();
    this.sun.shadow.mapSize.set(4096, 4096); this.sun.shadow.map && this.sun.shadow.map.dispose(); this.sun.shadow.map = null;
    r.setPixelRatio(1); r.setSize(width, height, false); this.composer.setPixelRatio(1); this.composer.setSize(width, height);
    const keepPos = this.camera.position.clone(), keepTgt = this.controls.target.clone();
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
    if (fit) { const dir = keepPos.clone().sub(keepTgt).normalize(); this.fit(width / height); const dist = this.camera.position.distanceTo(this.controls.target); this.camera.position.copy(this.controls.target).addScaledVector(dir, dist); this.camera.lookAt(this.controls.target); }
    this.gtao.updateGtaoMaterial({ samples: 32 });
    this.composer.render(); this.overlay();
    this.gtao.updateGtaoMaterial({ samples: 16 });
    const url = this.canvas.toDataURL("image/png");
    this.camera.position.copy(keepPos); this.controls.target.copy(keepTgt); this.controls.update();
    this.sun.shadow.mapSize.copy(oldMap); this.sun.shadow.map && this.sun.shadow.map.dispose(); this.sun.shadow.map = null;
    r.setPixelRatio(oldPR); r.setSize(oldSize.x, oldSize.y, false);
    this.resize();
    return url;
  }
  /** ภาพย่อของมุมกล้อง (ถาด ฉาก) */
  thumbnail(pos, target, w = 320, h = 200) {
    const keepPos = this.camera.position.clone(), keepTgt = this.controls.target.clone();
    this.camera.position.fromArray(pos); this.camera.lookAt(new THREE.Vector3().fromArray(target));
    const r = this.renderer, oldSize = r.getSize(new THREE.Vector2()), oldPR = r.getPixelRatio();
    r.setPixelRatio(1); r.setSize(w, h, false); this.composer.setPixelRatio(1); this.composer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.composer.render(); this.overlay(); const url = this.canvas.toDataURL("image/jpeg", 0.7);
    r.setPixelRatio(oldPR); r.setSize(oldSize.x, oldSize.y, false); this.resize();
    this.camera.position.copy(keepPos); this.controls.target.copy(keepTgt); this.controls.update();
    return url;
  }

  exportGLB() {
    const parts = [this.model, ...(this.asc.children.length ? [this.asc] : [])];
    this.secPlane.visible = false;
    const edges = []; for (const p of parts) p.traverse((o) => { if (o.userData.helper) edges.push(o); });
    edges.forEach((e) => (e.visible = false));
    const meshes = this.meshes(), cur = meshes.map((m) => m.material);
    meshes.forEach((m) => { if (m.userData.mat0) m.material = m.userData.mat0; });   // ส่งออกวัสดุจริงเสมอ (ไม่ใช่สีของรูปแบบเส้น)
    return new Promise((res, rej) => new GLTFExporter().parse(parts, (b) => res(new Blob([b], { type: "model/gltf-binary" })), rej, { binary: true, onlyVisible: true }))
      .finally(() => { meshes.forEach((m, i) => (m.material = cur[i])); this.applyStyle(); });
  }

  /** นำเข้าโมเดล 3D ของ ASC Studio (3d.glb) ทั้งก้อน — หน่วยเมตร แกนเดียวกับฉากนี้ จึงไม่ต้องแปลง
   *  เป็นส่วนหนึ่งของ render / ส่งออก GLB · แก้ในตัวเขียนแบบไม่ได้ (แก้ที่ ASC Studio แล้วนำเข้าใหม่) */
  loadASC(url) {
    this.asc.clear();
    if (!url) return Promise.resolve(null);
    return new Promise((res, rej) => new GLTFLoader().load(url, (g) => {
      let n = 0;
      g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; o.userData.tag = "asc"; n++; } });
      this.asc.add(g.scene); this._fitShadow(); this.applyStyle(); res({ meshes: n });
    }, undefined, rej));
  }

  /** เส้นไฟล์ CAD ที่ระดับพื้น (อ้างอิง ไม่ส่งออก/ไม่ render เงา) */
  setCadLines(list) {
    this.cadGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.cadGroup.clear();
    for (const { positions, colors } of list) {
      if (!positions.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      this.cadGroup.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true })));
    }
  }

  /** ภาพดาวเทียมเป็นพื้นในฉาก 3D (ตำแหน่ง/ขนาดจาก world file · มม.) */
  setBackdrop(b) {
    if (this.backdrop) { this.scene.remove(this.backdrop); this.backdrop.geometry.dispose(); this.backdrop = null; }
    if (!b || !b.url) return;
    new THREE.TextureLoader().load(b.url, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(b.w * MM, b.h * MM), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
      m.rotation.x = -Math.PI / 2;
      m.position.set((b.x + b.w / 2) * MM, 0.002, -(b.y - b.h / 2) * MM);
      m.receiveShadow = true; m.name = "ภาพดาวเทียม"; m.visible = !this.hiddenTags.has("site");
      this.backdrop = m; this.scene.add(m);
    });
  }

  /** ภาพมุมบน (orthographic) ของโมเดล ASC Studio → {url, x, y, w, h} มม. สำหรับผัง 2D */
  topView(px = 2048) {
    if (!this.asc.children.length) return null;
    const b = new THREE.Box3().setFromObject(this.asc), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    const w = s.x, d = s.z, W = px, H = Math.max(64, Math.round((px * d) / w));
    const cam = new THREE.OrthographicCamera(-w / 2, w / 2, d / 2, -d / 2, 0.1, s.y + 200);
    cam.position.set(c.x, b.max.y + 100, c.z); cam.up.set(0, 0, -1); cam.lookAt(c.x, b.min.y, c.z);
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setSize(W, H); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping;
    const hide = [this.model, this.backdrop, this.ground, this.sky].filter(Boolean), vis = hide.map((o) => o.visible);
    hide.forEach((o) => (o.visible = false));
    const bg = this.scene.background, fog = this.scene.fog; this.scene.background = null; this.scene.fog = null;
    r.render(this.scene, cam);
    const url = r.domElement.toDataURL("image/png");
    this.scene.background = bg; this.scene.fog = fog; hide.forEach((o, i) => (o.visible = vis[i]));
    r.dispose();
    return { url, x: Math.round(b.min.x * 1000), y: Math.round(-b.min.z * 1000), w: Math.round(w * 1000), h: Math.round(d * 1000) };
  }
}
