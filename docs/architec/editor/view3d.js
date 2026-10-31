// มุมมอง 3D + push-pull + render ภาพนิ่ง (three.js ในเครื่อง) ของตัวเขียนแบบ ASC Architect (โดย ลุงพี)
// พิกัด three: x = x แบบ (ม.) · y = ความสูง (ม.) · z = −y แบบ (ม.) → มองจากใต้ขึ้นเหนือเหมือนแบบ
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as M from "./model.js?v=0.16.0";
import { material } from "./materials.js?v=0.16.0";

const MM = 0.001;

/** ท้องฟ้าไล่สี (ฟ้าเข้มด้านบน → ขาวอมฟ้าที่ขอบฟ้า) — ไม่ต้องโหลดภาพ HDRI */
function skyTexture() {
  const c = document.createElement("canvas"); c.width = 2; c.height = 256;
  const g = c.getContext("2d"), grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, "#5f9ad6"); grd.addColorStop(0.55, "#a9cdee"); grd.addColorStop(1, "#e4eef6");
  g.fillStyle = grd; g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const v3 = (p, z = 0) => new THREE.Vector3(p[0] * MM, z * MM, -p[1] * MM);

export class View3D {
  constructor(canvas, host) {
    this.canvas = canvas; this.host = host;          // host: { hist, onChange(), status(msg) }
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.95;
    r.outputColorSpace = THREE.SRGBColorSpace;
    const sc = (this.scene = new THREE.Scene());
    sc.background = skyTexture();
    sc.fog = new THREE.Fog(0xc6dcef, 160, 420);
    const pm = new THREE.PMREMGenerator(r);
    sc.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    sc.environmentIntensity = 0.45;
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
    this.camera.position.set(18, 14, 22);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    sc.add(new THREE.HemisphereLight(0xdfeeff, 0x6f8a55, 0.45));
    const sun = (this.sun = new THREE.DirectionalLight(0xfff1dc, 3.2));
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
    sc.add(sun, sun.target);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(300, 64), new THREE.MeshStandardMaterial({ color: 0x6f9a4c, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.002; ground.receiveShadow = true; ground.name = "พื้นดิน";
    sc.add(ground);
    this.model = new THREE.Group(); this.model.name = "แบบ"; sc.add(this.model);
    this.asc = new THREE.Group(); this.asc.name = "โมเดล ASC Studio"; sc.add(this.asc);
    this.backdrop = null;
    this.cadGroup = new THREE.Group(); this.cadGroup.name = "เส้น CAD"; sc.add(this.cadGroup);
    this.mats = {
      wall: new THREE.MeshStandardMaterial({ color: 0xece6dc, roughness: 0.85 }),
      wallSel: new THREE.MeshStandardMaterial({ color: 0xf2b36b, roughness: 0.7 }),
      slab: new THREE.MeshStandardMaterial({ color: 0xa9a59c, roughness: 0.9 }),
      roof: new THREE.MeshStandardMaterial({ color: 0x8c96a3, roughness: 0.45, metalness: 0.55, side: THREE.DoubleSide }),
      gable: new THREE.MeshStandardMaterial({ color: 0xe2dbcf, roughness: 0.85, side: THREE.DoubleSide }),
      glass: new THREE.MeshPhysicalMaterial({ color: 0xbfd9ee, roughness: 0.05, metalness: 0, transmission: 0.6, transparent: true, opacity: 0.45 }),
      door: new THREE.MeshStandardMaterial({ color: 0x7a4e2d, roughness: 0.6 }),
      frame: new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.4 }),
      mass: new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.8 }),
      pv: new THREE.MeshStandardMaterial({ color: 0x0f2244, roughness: 0.18, metalness: 0.4 }),
      pvFrame: new THREE.MeshStandardMaterial({ color: 0xc9ccd1, roughness: 0.3, metalness: 0.9 }),
    };
    this.setSun(135, 50);
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    const loop = () => { this.controls.update(); this.renderer.render(this.scene, this.camera); this._raf = requestAnimationFrame(loop); };
    loop();
  }

  get doc() { return this.host.hist.doc; }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  /** ดวงอาทิตย์: azimuth (0=เหนือ ตามเข็ม) · มุมเงย */
  setSun(az, el) {
    this.sunAz = az; this.sunEl = el;
    const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180;
    // ทิศเหนือของแบบ = −z ใน three; ตะวันออก = +x
    this.sunDir = new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
    this._fitShadow();
  }

  bounds() {
    const b = new THREE.Box3().setFromObject(this.model);
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
    g.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    g.clear();
    const add = (mesh, name, data) => { mesh.castShadow = mesh.receiveShadow = true; mesh.name = name; mesh.userData = data || {}; g.add(mesh); return mesh; };
    // พื้น
    const wb = M.wallBounds(d);
    if (wb) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry((wb.x1 - wb.x0) * MM, 0.1, (wb.y1 - wb.y0) * MM), this.mats.slab);
      slab.position.set(((wb.x0 + wb.x1) / 2) * MM, -0.05, (-(wb.y0 + wb.y1) / 2) * MM);
      add(slab, "พื้น");
    }
    // ผนัง (ตัดช่องเปิด)
    const sel = this.host.selection && this.host.selection();
    for (const w of d.walls) {
      const L = M.wallLength(w); if (L < 1) continue;
      const u = M.norm(M.sub(w.b, w.a)), ang = Math.atan2(u[1], u[0]);
      for (const p of M.wallPieces(d, w)) {
        const geo = new THREE.BoxGeometry((p.s1 - p.s0) * MM, (p.z1 - p.z0) * MM, w.thick * MM);
        const m = new THREE.Mesh(geo, sel && sel.type === "walls" && sel.id === w.id ? this.mats.wallSel : w.mat ? material(w.mat) : this.mats.wall);
        const c = M.add(w.a, M.mul(u, (p.s0 + p.s1) / 2));
        m.position.copy(v3(c, (p.z0 + p.z1) / 2));
        m.rotation.y = ang;
        add(m, "ผนัง", { type: "walls", id: w.id });
      }
      for (const { o, s0, s1 } of M.openingSpans(d, w)) {
        const c = M.add(w.a, M.mul(u, (s0 + s1) / 2)), W = (s1 - s0) * MM, H = o.height * MM;
        if (o.kind === "window") {
          const gl = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.02), this.mats.glass);
          gl.position.copy(v3(c, o.sill + o.height / 2)); gl.rotation.y = ang; gl.castShadow = false; g.add(gl);
          const fr = new THREE.Mesh(new THREE.BoxGeometry(W, 0.05, w.thick * MM * 1.05), this.mats.frame);
          fr.position.copy(v3(c, o.sill)); fr.rotation.y = ang; add(fr, "ขอบหน้าต่าง");
        } else {
          const leaf = new THREE.Mesh(new THREE.BoxGeometry(W * 0.98, H, 0.04), this.mats.door);
          leaf.position.copy(v3(c, o.sill + o.height / 2)); leaf.rotation.y = ang; add(leaf, "ประตู", { type: "openings", id: o.id });
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
      add(mesh, "กล่อง", { type: "masses", id: m.id });
    }
    // หลังคา + แผง
    const rf = M.roofFaces(d);
    for (const f of rf.faces) {
      const pts = f.pts3.map((p) => v3(p, p[2]));
      const geo = new THREE.BufferGeometry();
      const tri = pts.length === 3 ? [0, 1, 2] : [0, 1, 2, 0, 2, 3];
      geo.setFromPoints(tri.map((i) => pts[i]));
      geo.computeVertexNormals();
      add(new THREE.Mesh(geo, f.gable ? this.mats.gable : d.roof.mat ? material(d.roof.mat) : this.mats.roof), f.gable ? "หน้าจั่ว" : "หลังคา " + f.key, { type: "roof", id: f.key });
    }
    this.pv = M.pvLayout(d, M.bestRoofFace(rf.faces));
    if (this.pv.count) {
      const n = this.pv.normal, nn = new THREE.Vector3(n[0], n[2], -n[1]).normalize();
      for (const p of this.pv.panels) {
        const c = p.c3.map((q) => v3(q, q[2]).addScaledVector(nn, 0.09));
        const geo = new THREE.BufferGeometry().setFromPoints([c[0], c[1], c[2], c[0], c[2], c[3]]);
        geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, this.mats.pv); mesh.castShadow = true; mesh.name = "แผงโซลาร์"; g.add(mesh);
        const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xc9ccd1 }));
        g.add(edge);
      }
    }
    this._fitShadow();
    if (this.onBuilt) this.onBuilt();
    return this.pv;
  }

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

  /** ตัดหน้า (section) แนวนอนที่ความสูง mm · null = ปิด */
  setSection(mm) {
    this.renderer.clippingPlanes = mm == null ? [] : [new THREE.Plane(new THREE.Vector3(0, -1, 0), mm * MM)];
  }

  // ---------------------------------------------------------------- render + ส่งออก
  /** ภาพนิ่งความละเอียดสูง (เงานุ่ม · tone mapping) → dataURL PNG */
  renderStill(width = 1920, height = 1080, fit = true) {
    const r = this.renderer, oldSize = r.getSize(new THREE.Vector2()), oldPR = r.getPixelRatio();
    const oldMap = this.sun.shadow.mapSize.clone();
    this.sun.shadow.mapSize.set(4096, 4096); this.sun.shadow.map && this.sun.shadow.map.dispose(); this.sun.shadow.map = null;
    r.setPixelRatio(1); r.setSize(width, height, false);
    const keepPos = this.camera.position.clone(), keepTgt = this.controls.target.clone();
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
    if (fit) { const dir = keepPos.clone().sub(keepTgt).normalize(); this.fit(width / height); const dist = this.camera.position.distanceTo(this.controls.target); this.camera.position.copy(this.controls.target).addScaledVector(dir, dist); this.camera.lookAt(this.controls.target); }
    this.scene.fog.near *= 3; this.scene.fog.far *= 3;
    r.render(this.scene, this.camera);
    this.scene.fog.near /= 3; this.scene.fog.far /= 3;
    this.camera.position.copy(keepPos); this.controls.target.copy(keepTgt); this.controls.update();
    const url = this.canvas.toDataURL("image/png");
    this.sun.shadow.mapSize.copy(oldMap); this.sun.shadow.map && this.sun.shadow.map.dispose(); this.sun.shadow.map = null;
    r.setPixelRatio(oldPR); r.setSize(oldSize.x, oldSize.y, false);
    this.resize();
    return url;
  }

  exportGLB() {
    const parts = [this.model, ...(this.asc.children.length ? [this.asc] : [])];
    return new Promise((res, rej) => new GLTFExporter().parse(parts, (b) => res(new Blob([b], { type: "model/gltf-binary" })), rej, { binary: true }));
  }

  /** นำเข้าโมเดล 3D ของ ASC Studio (3d.glb) ทั้งก้อน — หน่วยเมตร แกนเดียวกับฉากนี้ จึงไม่ต้องแปลง
   *  เป็นส่วนหนึ่งของ render / ส่งออก GLB · แก้ในตัวเขียนแบบไม่ได้ (แก้ที่ ASC Studio แล้วนำเข้าใหม่) */
  loadASC(url) {
    this.asc.clear();
    if (!url) return Promise.resolve(null);
    return new Promise((res, rej) => new GLTFLoader().load(url, (g) => {
      let n = 0;
      g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; n++; } });
      this.asc.add(g.scene); this._fitShadow(); res({ meshes: n });
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
      m.receiveShadow = true; m.name = "ภาพดาวเทียม";
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
    const hide = [this.model, this.backdrop, ...this.scene.children.filter((o) => o.name === "พื้นดิน")].filter(Boolean);
    hide.forEach((o) => (o.visible = false));
    const bg = this.scene.background, fog = this.scene.fog; this.scene.background = null; this.scene.fog = null;
    r.render(this.scene, cam);
    const url = r.domElement.toDataURL("image/png");
    this.scene.background = bg; this.scene.fog = fog; hide.forEach((o) => (o.visible = true));
    r.dispose();
    return { url, x: Math.round(b.min.x * 1000), y: Math.round(-b.min.z * 1000), w: Math.round(w * 1000), h: Math.round(d * 1000) };
  }
}
