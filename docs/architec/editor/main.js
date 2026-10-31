// ตัวเขียนแบบ ASC Architect — เชื่อมผัง 2D · 3D · แผงคุณสมบัติ · บันทึก/ส่งออก (โดย ลุงพี)
import * as M from "./model.js?v=0.15.0";
import { Plan2D } from "./plan2d.js?v=0.15.0";
import { View3D } from "./view3d.js?v=0.15.0";
import { toDXF } from "./dxf.js?v=0.15.0";
import { plotFormHTML, wirePlotForm, readPlotForm } from "../plotform.js?v=0.15.0";
import * as CAD from "./cadlayer.js?v=0.15.0";
import { Sketch3D } from "./sketch3d.js?v=0.15.0";
import { PALETTE } from "./materials.js?v=0.15.0";
import { sunPosition } from "./sun.js?v=0.15.0";
import { readDXF, decodeDXF } from "./dxfread.js?v=0.15.0";
import * as LS from "./localstore.js?v=0.15.0";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const CLOUD = window.PA_MODE === "cloud";
const params = new URLSearchParams(location.search);
const PROJECT = params.get("project");
const DRAFT_KEY = "pa.editor.draft" + (PROJECT ? "." + PROJECT : "");

const hist = new M.History(M.newDoc());
const cadStore = new Map();              // id → { data, built } (เส้นของไฟล์ CAD ไม่เก็บในไฟล์แบบ — อ่านจากไฟล์ต้นฉบับทุกครั้ง)
let plan, view, dirty = false;

function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => (t.hidden = true), 3200); }
const status = (m) => { $("#status").textContent = m; };
const num = (v, d) => { const n = Number(v); return v === "" || isNaN(n) ? d : n; };

const host = {
  hist,
  status,
  vcb(v) { if (v === undefined) return $("#vcb").value.trim(); $("#vcb").value = v; return v; },
  defaults() {
    return { wallThick: num($("#d-thick").value, 200), wallHeight: num($("#d-height").value, 3000), massHeight: num($("#d-mass").value, 3000),
             door: { width: num($("#d-door").value, 900) }, window: { width: num($("#d-win").value, 1200) } };
  },
  selection: () => plan && plan.sel,
  backdropChanged: () => view.setBackdrop(hist.doc.backdrop),
  cads: () => hist.doc.cads.map((ref) => ({ ref, built: (cadStore.get(ref.id) || {}).built })),
  cadSnap(p, tol) {                                   // จุดยอดของเส้น CAD ใกล้เมาส์ (ช่วยวาดทับแบบ)
    const out = [];
    for (const ref of hist.doc.cads) {
      const st = cadStore.get(ref.id); if (!st || ref.off) continue;
      const k = ref.toMM, x = (p[0] - ref.dx) / k, y = (p[1] - ref.dy) / k, t = tol / k;
      for (const [ln, , , f] of st.data.polys) {
        if (ref.hidden && ref.hidden[ln]) continue;
        for (let i = 0; i < f.length; i += 2) if (Math.abs(f[i] - x) < t && Math.abs(f[i + 1] - y) < t) out.push([ref.dx + f[i] * k, ref.dy + f[i + 1] * k]);
        if (out.length > 50) return out;
      }
    }
    return out;
  },
  onChange() { dirty = true; $("#saved").textContent = "ยังไม่บันทึก"; refresh(); draft(); },
  onSelect(sel, obj, live) { showProps(sel, obj, live); if (!live && view) view.build(); },
};

function ascSummary(im) {
  const s = im.summary || {};
  return `<br><b>โมเดลจาก ASC Studio</b><br>${(im.outlines || []).map((o) => `${o.name}: หลังคา${ROOF_TH[o.roofType] || o.roofType || ""} สูงชายคา ${o.eave ?? "?"} ม.` + (o.rise ? ` · โค้งสูง ${o.rise} ม.` : "")).join("<br>")}` +
    (s.modules ? `<br>แผง ${s.modules} แผง = ${Number(s.kwp).toLocaleString()} kWp` : "") +
    `<br><span class="muted">หลังคา/แผงแก้ที่ ASC Studio แล้วนำเข้าใหม่ · วาดเพิ่มในแบบนี้ได้</span>`;
}
const ROOF_TH = { curved: "โค้ง", gable: "จั่ว", hip: "ปั้นหยา", flat: "เรียบ", shed: "เพิง" };

function refresh() {
  plan.render();
  const pv = view.build();
  renderCadPanel();
  const s = M.summary(hist.doc);
  $("#summary").innerHTML =
    `<b>สรุปแบบ</b><br>ผนัง ${s.walls} ช่วง · ยาวรวม ${s.wallLengthM.toLocaleString()} ม.<br>ประตู ${s.doors} · หน้าต่าง ${s.windows}<br>` +
    `พื้นที่ตามกรอบผนัง ${s.footprintM2.toLocaleString()} ตร.ม.<br>` +
    (pv && pv.count ? `<b>แผงโซลาร์ ${pv.count} แผง = ${s.pvKwp.toLocaleString()} kWp</b><br>เอียง ${s.pvTilt}° · หัน ${Math.round(s.pvAzimuth)}°` : "") +
    (hist.doc.imported ? ascSummary(hist.doc.imported) : pv && pv.count ? "" : "ไม่มีแผงโซลาร์ (ต้องมีผนังและหลังคา)");
  $("#doc-name").value = hist.doc.name;
  syncRoofInputs();
}

// ---------------------------------------------------------------- แผงคุณสมบัติของสิ่งที่เลือก
const FIELDS = {
  walls: [["thick", "หนา (มม.)"], ["height", "สูง (มม.)"], ["len", "ยาว (มม.)"]],
  openings: [["kind", "ชนิด", ["door", "window"]], ["width", "กว้าง"], ["height", "สูง"], ["sill", "สูงจากพื้น"]],
  masses: [["name", "ชื่อ", "text"], ["height", "สูง (push-pull)"], ["base", "ยกจากพื้น"]],
  texts: [["s", "ข้อความ", "text"], ["h", "ขนาดตัวอักษร (มม.)"]],
  dims: [["offset", "ระยะเส้นมิติจากวัตถุ"]],
  syms: [["scale", "ขนาด (เท่า)"], ["rot", "หมุน (°)"]],
  lines: [],
};
const NAMES = { walls: "ผนัง", openings: "ช่องเปิด", masses: "กล่อง", texts: "ข้อความ", dims: "มิติ", syms: "สัญลักษณ์", lines: "เส้น" };

function showProps(sel, obj, live) {
  const box = $("#sel-box");
  if (!sel || !obj) { box.innerHTML = '<p class="muted">คลิกเลือกวัตถุเพื่อแก้ค่า · ค่าที่พิมพ์ใช้ตามนั้นทุกตัว</p>'; return; }
  if (live && box.dataset.id === sel.id) return;          // ระหว่างลาก ไม่สร้างฟอร์มใหม่ (ไม่ให้ช่องที่พิมพ์อยู่หาย)
  box.dataset.id = sel.id;
  const rows = FIELDS[sel.type].map(([k, label, kind]) => {
    const v = k === "len" ? Math.round(M.wallLength(obj)) : obj[k] ?? "";
    if (Array.isArray(kind)) return `<label>${label}<select data-k="${k}">${kind.map((o) => `<option value="${o}" ${o === v ? "selected" : ""}>${o === "door" ? "ประตู" : "หน้าต่าง"}</option>`).join("")}</select></label>`;
    return `<label>${label}<input data-k="${k}" ${kind === "text" ? "" : 'type="number" step="any"'} value="${String(v).replace(/"/g, "&quot;")}"></label>`;
  }).join("");
  box.innerHTML = `<h3>${NAMES[sel.type]}</h3><div class="form">${rows}</div><button id="del-sel">ลบ</button>`;
  box.querySelectorAll("[data-k]").forEach((inp) => inp.addEventListener("change", () => {
    const k = inp.dataset.k, val = inp.type === "number" ? Number(inp.value) : inp.value;
    if (inp.type === "number" && (isNaN(val) || (val <= 0 && !["base", "sill", "rot", "offset"].includes(k)))) { toast("ค่าไม่ถูกต้อง — ไม่ได้เปลี่ยน"); return; }
    hist.commit((d) => {
      const o = d[sel.type].find((x) => x.id === sel.id); if (!o) return;
      if (k === "len") { const u = M.norm(M.sub(o.b, o.a)); o.b = M.add(o.a, M.mul(u, val)).map((x) => Math.round(x * 1000) / 1000); }
      else o[k] = val;
      if (sel.type === "openings") {                     // เตือนแทนการบีบค่า (ค่าที่พิมพ์คงไว้)
        const w = d.walls.find((x) => x.id === o.wall);
        if (w && o.width > M.wallLength(w)) toast("ช่องเปิดกว้างกว่าผนัง — ตรวจค่าอีกครั้ง");
        if (w && o.sill + o.height > w.height) toast("ช่องเปิดสูงเกินผนัง — ตรวจค่าอีกครั้ง");
      }
    });
    host.onChange();
  }));
  $("#del-sel").onclick = () => plan.deleteSelected();
}

// ---------------------------------------------------------------- หลังคา/แผง/ค่าไซต์
function syncRoofInputs() {
  const r = hist.doc.roof, p = hist.doc.pv;
  $("#roof-type").value = r.type; $("#roof-pitch").value = r.pitch; $("#roof-over").value = r.overhang;
  $("#roof-ridge").value = r.ridge === "short" || r.ridge === "y" ? "short" : "auto";
  $("#roof-rise").value = r.rise || 0; $("#roof-facets").value = r.facets || 6;
  $("#pv-on").checked = !!p.enabled; $("#pv-watt").value = p.watt; $("#pv-edge").value = p.edge; $("#north").value = hist.doc.site.north || 0;
}
for (const [id, set] of [
  ["#roof-type", (d, v) => (d.roof.type = v)], ["#roof-pitch", (d, v) => (d.roof.pitch = Number(v))], ["#roof-over", (d, v) => (d.roof.overhang = Number(v))],
  ["#roof-ridge", (d, v) => (d.roof.ridge = v)], ["#roof-rise", (d, v) => (d.roof.rise = Number(v))], ["#roof-facets", (d, v) => (d.roof.facets = Number(v))], ["#pv-watt", (d, v) => (d.pv.watt = Number(v))], ["#pv-edge", (d, v) => (d.pv.edge = Number(v))],
  ["#north", (d, v) => (d.site.north = Number(v))],
]) $(id).addEventListener("change", (e) => { hist.commit((d) => set(d, e.target.value)); host.onChange(); });
$("#pv-on").addEventListener("change", (e) => { hist.commit((d) => (d.pv.enabled = e.target.checked)); host.onChange(); });
$("#doc-name").addEventListener("change", (e) => { hist.commit((d) => (d.name = e.target.value || "แบบใหม่")); host.onChange(); });

// ---------------------------------------------------------------- เครื่องมือ/มุมมอง/คีย์ลัด
$("#tools").addEventListener("click", (e) => { const b = e.target.closest("button[data-tool]"); if (b) setTool(b.dataset.tool); });
function setTool(t) { $$("#tools button").forEach((b) => b.classList.toggle("on", b.dataset.tool === t)); plan.setTool(t); if (t === "symbol") $("#sym-q").closest("details").open = true; }
$("#views").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-view]"); if (!b) return;
  $$("#views button").forEach((x) => x.classList.toggle("on", x === b));
  $("#viewarea").className = "views " + ({ "2d": "v2d", "3d": "v3d", split: "split" }[b.dataset.view]);
  setTimeout(() => { plan.resize(); view.resize(); }, 30);
});
const KEYS = { v: "select", h: "pan", w: "wall", r: "room", d: "door", n: "window", b: "box", l: "line", m: "dim", t: "text", s: "symbol", e: "erase", k: "calib" };
document.addEventListener("keydown", (e) => {
  const inField = e.target.matches("input, select, textarea") && e.target.id !== "vcb";
  if ((e.ctrlKey || e.metaKey) && !inField) {
    const k = e.key.toLowerCase();
    if (k === "z") { e.preventDefault(); act(e.shiftKey ? "redo" : "undo"); return; }
    if (k === "y") { e.preventDefault(); act("redo"); return; }
    if (k === "s") { e.preventDefault(); act("save"); return; }
  }
  if (inField) return;
  // ระหว่างวาด: ตัวเลข/จุลภาคไปที่ช่องระยะ (แบบ SketchUp)
  if (plan.draft && /^[0-9.,x*]$/.test(e.key) && e.target.id !== "vcb") { $("#vcb").focus(); return; }
  if (plan.key(e)) { e.preventDefault(); return; }
  if (e.target.id === "vcb") return;
  if (over3d && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const k3 = { o: "orbit", " ": "select", p: "pushpull", r: "rect", m: "move", q: "rotate", b: "paint", t: "tape" }[e.key.toLowerCase()];
    if (k3) { e.preventDefault(); setTool3d(k3); return; }
    if (e.key === "Delete") { sk.remove(); return; }
  }
  if (!e.ctrlKey && !e.metaKey && !e.altKey && KEYS[e.key.toLowerCase()]) setTool(KEYS[e.key.toLowerCase()]);
});
document.addEventListener("keyup", (e) => plan.key(e));
let over3d = false;
$("#pane3d").addEventListener("pointerenter", () => (over3d = true)); $("#pane3d").addEventListener("pointerleave", () => (over3d = false));
$("#vcb").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); plan.key(e); $("#vcb").blur(); }
  if (e.key === "Escape") { $("#vcb").value = ""; $("#vcb").blur(); plan.key(e); }
});
$("#ortho").addEventListener("change", (e) => (plan.ortho = e.target.checked));
$("#snap").addEventListener("change", (e) => (plan.snapOn = e.target.checked));
$("#grid").addEventListener("change", (e) => { plan.grid = Number(e.target.value); plan.render(); });
// ---------------------------------------------------------------- เครื่องมือ 3D (SketchUp)
let sk;
function setTool3d(t) { $$("#tools3d [data-t3]").forEach((b) => b.classList.toggle("on", b.dataset.t3 === t)); sk.setTool(t); }
$("#tools3d").addEventListener("click", (e) => { const b = e.target.closest("[data-t3]"); if (b) setTool3d(b.dataset.t3); });
$("#mat3d").innerHTML = PALETTE.map((p) => `<option value="${p.key}">${p.th}</option>`).join("");
$("#mat3d").addEventListener("change", (e) => { sk.mat = e.target.value; setTool3d("paint"); });
function sunNow() {
  const d = $("#sun-date").value, t = $("#sun-time").value || "10:00";
  if (!d) return;
  const [y, mo, da] = d.split("-").map(Number), [hh, mi] = t.split(":").map(Number);
  const s = hist.doc.site, lat = s.lat ?? 13.75, lon = s.lon ?? 100.52;
  const p = sunPosition(lat, lon, new Date(y, mo - 1, da, hh, mi));
  // แบบอาจหมุนทิศเหนือ: ดวงอาทิตย์ในพิกัดแบบ = ทิศจริง − ทิศเหนือของแบบ
  view.setSun((p.az - (s.north || 0) + 360) % 360, Math.max(p.el, 1));
  status(`ดวงอาทิตย์ ${d} ${t}: ทิศ ${p.az}° · มุมเงย ${p.el}°` + (p.el <= 0 ? " (ใต้ขอบฟ้า)" : "") + (s.lat == null ? " · ใช้พิกัดกรุงเทพฯ (ยังไม่ระบุพิกัดโครงการ)" : ""));
}
$("#sun-date").value = new Date().toISOString().slice(0, 10);
$("#sun-date").addEventListener("change", sunNow); $("#sun-time").addEventListener("input", sunNow);
$("#section").addEventListener("input", (e) => { const v = Number(e.target.value); view.setSection(v >= 12000 ? null : v); status(v >= 12000 ? "ปิดตัดหน้า" : `ตัดหน้าที่ระดับ ${v.toLocaleString()} มม.`); });
function renderScenes() {
  const sc = hist.doc.scenes || [];
  $("#scenes").innerHTML = '<option value="">มุมกล้อง…</option>' + sc.map((x, i) => `<option value="${i}">${x.name}</option>`).join("");
}
$("#scenes").addEventListener("change", (e) => {
  const x = (hist.doc.scenes || [])[Number(e.target.value)]; if (!x) return;
  view.camera.position.fromArray(x.pos); view.controls.target.fromArray(x.target); view.controls.update();
  if (x.sun) { $("#sun-date").value = x.sun.date; $("#sun-time").value = x.sun.time; sunNow(); }
});

// ---------------------------------------------------------------- คำสั่ง
document.body.addEventListener("click", (e) => { const b = e.target.closest("[data-act]"); if (b) act(b.dataset.act); });
async function act(a) {
  const d = hist.doc;
  if (a === "undo") { if (hist.undo()) { plan.select(null); host.onChange(); } return; }
  if (a === "redo") { if (hist.redo()) { plan.select(null); host.onChange(); } return; }
  if (a === "fit2d") return plan.fit();
  if (a === "fit3d") return view.fit();
  if (a === "group3d") return sk.group();
  if (a === "ungroup3d") return sk.ungroup();
  if (a === "del3d") return sk.remove();
  if (a === "scene-add") {
    const name = prompt("ชื่อมุมกล้อง", `มุม ${(hist.doc.scenes || []).length + 1}`); if (!name) return;
    hist.commit((dd) => { dd.scenes = dd.scenes || []; dd.scenes.push({ name, pos: view.camera.position.toArray(), target: view.controls.target.toArray(), sun: { date: $("#sun-date").value, time: $("#sun-time").value } }); });
    renderScenes(); host.onChange(); return;
  }
  if (a === "new") { if (dirty && !confirm("แบบปัจจุบันยังไม่บันทึก — เริ่มแบบใหม่?")) return; hist.replace(M.newDoc()); plan.select(null); host.onChange(); plan.fit(); return; }
  if (a === "save") return save();
  if (a === "ai-draft") return aiDraft();
  if (a === "cad") return openCadDialog();
  if (a === "cad-close") { $("#cad-dlg").hidden = true; return; }
  if (a === "plot") return plotDialog();
  if (a === "plot-close") { $("#plot-dlg").hidden = true; return; }
  if (a === "plot-go") return doPlot();
  if (a === "dxf") return output(safe(d.name) + ".dxf", new Blob([toDXF(d)], { type: "application/dxf" }), "plan.dxf");
  if (a === "glb") return output(safe(d.name) + ".glb", await view.exportGLB(), "model.glb");
  if (a === "render") {
    status("กำลัง render…");
    const url = view.renderStill(1920, 1080);
    const blob = await (await fetch(url)).blob();
    await output(safe(d.name) + "_render.png", blob, "render_editor.png");
    return status("render เสร็จ 1920×1080");
  }
  if (a === "yield") {
    const s = M.summary(d), asc = d.imported && d.imported.summary;
    let kwp = s.pvKwp, tilt = s.pvTilt, az = s.pvAzimuth;
    if (!s.pvCount && asc && asc.kwp) { kwp = asc.kwp; tilt = asc.tilt ?? 10; az = asc.azimuth ?? 180; }
    else if (!s.pvCount) return toast("ยังไม่มีแผงโซลาร์บนหลังคา");
    const q = new URLSearchParams({ tab: "yield", kwp, tilt, azimuth: Math.round(az), name: d.name });
    if (PROJECT) q.set("project", PROJECT);
    if (d.site.lat != null) { q.set("lat", d.site.lat); q.set("lon", d.site.lon); }
    location.href = "../?" + q.toString();
  }
}
// ---------------------------------------------------------------- Plot PDF (ขั้นที่ 4): ผัง 2D ลงกระดาษ + กรอบชื่อ
function plotDialog() {
  if (CLOUD) return toast("Plot PDF ต้องใช้รุ่นในเครื่อง (ASC Architect ในเครื่อง) — รุ่นออนไลน์ส่งออก DXF แล้วพิมพ์จากโปรแกรม CAD");
  $("#plot-form").innerHTML = plotFormHTML(null, { DWG_TITLE: hist.doc.name, PROJECT1: hist.doc.name });
  wirePlotForm($("#plot-form"));
  $("#plot-msg").textContent = ""; $("#plot-dlg").hidden = false;
}
async function doPlot() {
  const o = readPlotForm($("#plot-form"));
  $("#plot-msg").textContent = "กำลังสร้าง PDF…";
  try {
    const r = await fetch("/api/plot/dxf", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...o, area: null, dxf: toDXF(hist.doc), name: hist.doc.name }) });
    const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status);
    const a = document.createElement("a");                // ลิงก์ให้กดเอง (เบราว์เซอร์บล็อกการเปิดแท็บอัตโนมัติ)
    a.href = j.url; a.target = "_blank"; a.rel = "noopener"; a.textContent = "📄 เปิด PDF";
    $("#plot-msg").textContent = `เสร็จ ${j.scale} · ${j.pdf}` + (j.clipped ? " · ⚠ ผังใหญ่กว่ากระดาษ ส่วนเกินถูกตัด" : "") + " · ";
    $("#plot-msg").append(a);
  } catch (e) { $("#plot-msg").textContent = "Plot ไม่สำเร็จ: " + e.message; }
}

const safe = (s) => String(s || "แบบ").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 60);

async function output(name, blob, projectName) {
  if (PROJECT && !CLOUD) {
    const r = await fetch(`/api/projects/${encodeURIComponent(PROJECT)}/files/${encodeURIComponent(projectName)}`, { method: "POST", body: blob });
    if (r.ok) { toast(`บันทึก ${projectName} ลงโครงการแล้ว`); return; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}

async function save() {
  const json = JSON.stringify(serialize(hist.doc), null, 1);
  if (PROJECT && !CLOUD) {
    const r = await fetch(`/api/projects/${encodeURIComponent(PROJECT)}/files/drawing.json`, { method: "POST", body: json });
    if (!r.ok) { toast("บันทึกไม่สำเร็จ: " + ((await r.json().catch(() => ({}))).error || r.status)); return; }
    await fetch(`/api/projects/${encodeURIComponent(PROJECT)}/files/plan.dxf`, { method: "POST", body: toDXF(hist.doc) });
    toast("บันทึกลงโครงการแล้ว (drawing.json + plan.dxf)");
  } else await output(safe(hist.doc.name) + ".json", new Blob([json], { type: "application/json" }));
  dirty = false; $("#saved").textContent = "บันทึกแล้ว " + new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ไม่มี storage */ }
}
function draft() { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(serialize(hist.doc))); } catch (e) { /* ไม่มี storage ก็ข้าม */ } }
/** ตัดของที่สร้างขณะเปิดออกก่อนบันทึก: ภาพมุมบน (dataURL) · url ของไฟล์โครงการ (เก็บแค่ชื่อไฟล์) */
function serialize(doc) {
  const d = JSON.parse(JSON.stringify(doc));
  if (d.imported) delete d.imported.top;
  if (d.backdrop) delete d.backdrop.url;
  return d;
}
const fileUrl = (name) => `/api/projects/${encodeURIComponent(PROJECT)}/files/${encodeURIComponent(name)}`;

/** โหลดชั้นนำเข้า: ภาพดาวเทียม + โมเดล 3D ของ ASC Studio + ภาพมุมบน */
async function attachImported() {
  const d = hist.doc;
  if (d.backdrop && d.backdrop.file && PROJECT && !CLOUD) { d.backdrop.url = fileUrl(d.backdrop.file); view.setBackdrop(d.backdrop); }
  if (d.backdrop && d.backdrop.sketch && !CLOUD) { d.backdrop.url = "/api/sketch/" + encodeURIComponent(d.backdrop.sketch); view.setBackdrop(d.backdrop); }
  if (d.backdrop && d.backdrop.img) {                                        // ภาพลอกแบบของรุ่นออนไลน์ (เก็บในเบราว์เซอร์)
    const blob = await LS.get("img:" + d.backdrop.img);
    if (blob) { d.backdrop.url = URL.createObjectURL(blob); view.setBackdrop(d.backdrop); }
    else toast(`ไม่พบภาพลอกแบบ ${d.backdrop.name || ""} ในเบราว์เซอร์นี้ — นำเข้าภาพใหม่ด้วยปุ่ม 🖼 ภาพลอกแบบ`);
  }
  if (d.imported && d.imported.glb && PROJECT && !CLOUD) {
    status("กำลังโหลดโมเดล 3D จาก ASC Studio…");
    try {
      const r = await view.loadASC(fileUrl(d.imported.glb));
      d.imported.top = view.topView(2048);
      status(`นำเข้าโมเดล ASC Studio แล้ว (${r.meshes} ชิ้น) — วาดเพิ่มได้ · หลังคา/แผงแก้ที่ ASC Studio`);
    } catch (e) { toast("โหลด 3d.glb ไม่ได้: " + e.message); }
  }
  plan.render(); plan.fit(); view.fit(); refresh();
}

/** โครงการที่นำเข้าจาก ASC Studio แต่ยังไม่เคยเปิดในตัวเขียนแบบ → สร้างแบบนำเข้า (ไม่วาดใหม่) */
async function importFromASC(p) {
  const da = await (await fetch(fileUrl("design-auto.json"))).json();
  let pgw = null, image = null;
  const map = ["map.png", "map.jpg"].find((f) => p.files.includes(f));   // map.jpg = ภาพที่ฝังใน design-auto.json (ไม่มี map.png)
  if (p.files.includes("map.pgw") && map) {
    pgw = await (await fetch(fileUrl("map.pgw"))).text();
    image = await new Promise((res) => { const im = new Image(); im.onload = () => res({ url: fileUrl(map), width: im.naturalWidth, height: im.naturalHeight }); im.onerror = () => res(null); im.src = fileUrl(map); });
  }
  const doc = M.importDesignAuto(da, { exportName: (p.source && p.source.designAuto) || "", glb: p.files.includes("3d.glb") ? "3d.glb" : null, pgw, image,
    summary: { kwp: p.kwp, modules: p.modules, tilt: p.tilt, azimuth: p.azimuth } });
  if (doc.backdrop) doc.backdrop.file = map;
  return doc;
}

$("#open-file").addEventListener("change", async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try { const doc = JSON.parse(await f.text()); if (doc.app !== "pee_architec-drawing") throw new Error("ไม่ใช่ไฟล์แบบของ ASC Architect");
    hist.replace(M.normalize(doc)); plan.select(null); cadStore.clear(); view.setBackdrop(null);
    host.onChange(); plan.fit(); view.fit(); toast("เปิด " + f.name);
    attachImported();                                                          // ภาพลอกแบบ/ภาพพื้นหลัง + ไฟล์ CAD ที่แบบอ้างถึง
    for (const ref of hist.doc.cads) loadCad(ref, false);
    updateCad3D(); renderCadPanel(); }
  catch (er) { toast("เปิดไม่ได้: " + er.message); }
  e.target.value = "";
});
window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

// ---------------------------------------------------------------- สัญลักษณ์จากคลัง
let catalog = [];
async function loadSymbols() {
  try {
    const c = await (await fetch("../library/catalog.json")).json();
    catalog = c.symbols.filter((s) => ["สถาปัตย์", "โซลาร์", "โครงสร้าง", "หลังคา"].includes(s.group));
    renderSymbols();
  } catch (e) { $("#sym-list").textContent = "ไม่พบคลังสัญลักษณ์"; }
}
function renderSymbols() {
  const q = $("#sym-q").value.trim().toLowerCase();
  $("#sym-list").innerHTML = catalog.filter((s) => !q || (s.name + s.th).toLowerCase().includes(q)).slice(0, 60)
    .map((s) => `<button data-sym="${s.name}" title="${s.th}"><img src="../${s.svg}" alt="">${s.name.slice(0, 14)}</button>`).join("");
}
$("#sym-q").addEventListener("input", renderSymbols);
$("#sym-list").addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-sym]"); if (!b) return;
  const s = catalog.find((x) => x.name === b.dataset.sym);
  // ขนาดจริงจาก viewBox ของ SVG (หน่วย มม.)
  const txt = await (await fetch("../" + s.svg)).text();
  const vb = (txt.match(/viewBox="([^"]+)"/) || [])[1];
  const size = vb ? Math.max(...vb.split(/\s+/).slice(2).map(Number)) : 1000;
  plan.symbol = { name: s.name, svg: s.svg, size };
  $$("#sym-list button").forEach((x) => x.classList.toggle("on", x === b));
  setTool("symbol");
  status(`วาง ${s.th} — คลิกในผัง`);
});

// ---------------------------------------------------------------- เริ่ม
async function start() {
  plan = new Plan2D($("#plan"), host);
  view = new View3D($("#c3d"), host);
  sk = new Sketch3D(view, host);
  window.__pa = { plan, view, hist, sk };             // สำหรับตรวจปัญหาใน DevTools
  let doc = null;
  if (PROJECT && !CLOUD) {
    const r = await fetch(`/api/projects/${encodeURIComponent(PROJECT)}/files/drawing.json`);
    if (r.ok) doc = await r.json();
    const p = await (await fetch(`/api/projects/${encodeURIComponent(PROJECT)}`)).json().catch(() => null);
    if (p && !doc && p.files.includes("design-auto.json")) { doc = await importFromASC(p); toast("นำเข้างาน ASC Studio: " + doc.name); }
    if (p && !doc) { doc = M.newDoc(p.name); doc.site.lat = p.lat ?? null; doc.site.lon = p.lon ?? null; }
  }
  let saved = null; try { saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch (e) { /* */ }
  if (saved && saved.app === "pee_architec-drawing" && confirm("มีแบบที่ยังไม่ได้บันทึกจากครั้งก่อน — เปิดต่อหรือไม่?")) doc = saved;
  if (!doc) doc = demoDoc();
  hist.doc = M.normalize(doc);
  if (hist.doc.imported) hist.doc.imported = Object.assign({ outlines: [] }, hist.doc.imported);
  refresh(); plan.fit(); view.fit(); showProps(null);
  attachImported();
  renderScenes(); sunNow();
  for (const ref of hist.doc.cads) loadCad(ref, false);
  setTool("select");
  loadSymbols();
}

// ---------------------------------------------------------------- นำเข้าไฟล์ CAD
async function openCadDialog() {
  $("#cad-dlg").hidden = false;
  if (CLOUD) {                                    // รุ่นออนไลน์: อ่าน DXF ในเบราว์เซอร์ (ไม่ส่งไฟล์ขึ้นเน็ต) · DWG/PDF ต้องใช้รุ่นในเครื่อง
    $("#cad-upload").accept = ".dxf";
    $("#cad-upload").parentElement.firstChild.textContent = "เลือกไฟล์ .dxf จากเครื่อง";
    $("#cad-showlib").parentElement.hidden = true;
    $("#cad-conv").textContent = "รุ่นออนไลน์: เปิดไฟล์ .dxf ได้ — อ่านในเบราว์เซอร์นี้ ไม่ส่งไฟล์ขึ้นเน็ต · .dwg / PDF ต้องใช้ ASC Architect ในเครื่อง (หรือ Save As เป็น DXF จากโปรแกรม CAD ก่อน)";
    $("#cad-files").innerHTML = "";
    $("#cad-msg").textContent = "";
    return;
  }
  $("#cad-msg").textContent = "กำลังค้นไฟล์…";
  try {
    const r = await (await fetch("/api/cad/files")).json();
    const conv = Object.keys(r.converters);
    $("#cad-conv").textContent = `ไฟล์ .dxf / .dwg ใน ${r.root} · ` + (conv.length ? `แปลง DWG ด้วย ${conv.join(", ")}` : "ยังไม่มีตัวแปลง DWG (ODA File Converter / LibreDWG) — เปิดได้เฉพาะ DXF");
    const show = () => {
      const lib = $("#cad-showlib").checked;
      const files = r.files.filter((f) => lib || !f.library);
      $("#cad-files").innerHTML = files.map((f) => `<button data-path="${esc(f.path)}"><span>${f.kind === "dwg" ? "📐" : "📄"} ${esc(f.path)}</span><small>${(f.size / 1048576).toFixed(1)} MB${f.kind === "dwg" && !conv.length ? " · ต้องมีตัวแปลง" : ""}</small></button>`).join("")
        || '<p class="muted">ไม่พบไฟล์ — วางไฟล์ไว้ในโฟลเดอร์ของ ASC Architect หรือกด "เลือกไฟล์จากเครื่อง"</p>';
    };
    $("#cad-showlib").onchange = show; show();
    $("#cad-msg").textContent = "";
  } catch (e) { $("#cad-msg").textContent = "อ่านรายการไฟล์ไม่ได้: " + e.message; }
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
$("#cad-files").addEventListener("click", (e) => { const b = e.target.closest("button[data-path]"); if (b) importCad(b.dataset.path); });
// AI ร่างแบบ: ภาพลอกแบบ → AI ในเครื่อง (Ollama) → กล่องอาคาร วางขวาภาพ ให้ปรับต่อ (เครื่อง CPU ใช้หลายนาที)
async function aiDraft() {
  if (CLOUD) return toast("AI ร่างแบบต้องใช้รุ่นในเครื่อง (ASC Architect ในเครื่อง)");
  const k = hist.doc.backdrop;
  if (!k || !k.sketch) return toast("นำเข้าภาพก่อน — ปุ่ม 🖼 ภาพลอกแบบ แล้วกด 🤖 ร่างด้วย AI");
  if (aiDraft.busy) return toast("AI กำลังร่างอยู่ — รอสักครู่");
  const st = await (await fetch("/api/sketch/ai")).json();
  if (!st.ok) return toast(st.message);
  const r = await fetch("/api/sketch/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sketch: k.sketch }) });
  let job = await r.json();
  if (!r.ok) return toast(job.error || "เริ่ม AI ไม่ได้");
  aiDraft.busy = true;
  const t0 = Date.now();
  try {
    while (job.state === "running") {
      status(`🤖 AI (${st.model}) กำลังอ่านภาพ… ${Math.round((Date.now() - t0) / 1000)} วินาที (อาจใช้หลายนาที — ขึ้นกับการ์ดจอ/RAM ของเครื่องที่รัน AI)`);
      await new Promise((res) => setTimeout(res, 3000));
      job = await (await fetch("/api/jobs/" + job.id)).json();
    }
  } finally { aiDraft.busy = false; }
  if (job.state !== "done") return toast("AI ร่างไม่สำเร็จ: " + (job.log || job.error || "ไม่ทราบสาเหตุ"));
  const ox = Math.round(k.x + k.w + 2000), oy = Math.round(k.y - k.h);       // วางขวาภาพ ห่าง 2 ม. (ไม่ทับภาพ)
  if (job.masses.length) hist.commit((d) => { for (const m of job.masses) d.masses.push({ id: M.uid("m"), name: m.name, pts: m.pts.map(([x, y]) => [x + ox, y + oy]), base: m.base, height: m.height }); });
  host.onChange(); plan.fit(); view.fit();
  const dims = (job.dims || []).map((x) => x.text).slice(0, 8).join(", ");
  status(`🤖 AI ร่าง ${job.masses.length} กล่อง (${Math.round((Date.now() - t0) / 1000)} วินาที · ภาพแบบ ${job.view || "?"})` + (dims ? ` · อ่านระยะได้: ${dims}` : " · ไม่พบระยะในภาพ — ขนาดเป็นค่าประมาณ")
    + (job.warn && job.warn.length ? " · " + job.warn.join(" · ") : "") + " — ตรวจและปรับขนาดก่อนใช้");
  if (job.notes) toast("AI: " + job.notes);
}

// ภาพลอกแบบ: ภาพร่าง/ภาพถ่าย/PDF สแกน วางใต้ผัง (เริ่มที่ 10 มม./พิกเซล) → 📏 ตั้งระยะ → วาดทับ
$("#trace-file").addEventListener("change", async (e) => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  if (hist.doc.backdrop && !hist.doc.backdrop.sketch && !hist.doc.backdrop.img && !confirm("แบบนี้มีภาพพื้นหลัง (ภาพดาวเทียม) อยู่แล้ว — แทนที่ด้วยภาพลอกแบบ?")) return;
  if (CLOUD) return traceLocal(f);
  status(`กำลังส่ง ${f.name}…`);
  const r = await fetch("/api/sketch/upload?" + new URLSearchParams({ name: f.name }), { method: "POST", body: f });
  const j = await r.json();
  if (!r.ok) return toast(j.error || "นำเข้าภาพไม่ได้");
  const px = 10, w = j.width * px, h = j.height * px;
  hist.commit((d) => { d.backdrop = { sketch: j.name, url: j.url, x: 0, y: h, w, h, opacity: 0.55 }; });
  view.setBackdrop(hist.doc.backdrop); host.onChange(); plan.fit(); setTool("calib");
  status(`วางภาพแล้ว (${j.width}×${j.height} พิกเซล${j.pages > 1 ? ` · PDF หน้า 1 จาก ${j.pages}` : ""}) — 📏 คลิก 2 จุดบนเส้นที่รู้ระยะ แล้วพิมพ์ระยะจริง`);
});

/** รุ่นออนไลน์: ภาพลอกแบบเก็บในเบราว์เซอร์ (ย่อด้านยาวไม่เกิน 3000 พิกเซล เหมือนรุ่นในเครื่อง) */
async function traceLocal(f) {
  if (!/^image\//.test(f.type)) return toast("รุ่นออนไลน์รับภาพ (JPG / PNG / WebP) — PDF ต้องใช้รุ่นในเครื่อง หรือส่งออกหน้า PDF เป็นภาพก่อน");
  status(`กำลังเปิด ${f.name}…`);
  let bmp;
  try { bmp = await createImageBitmap(f); } catch (err) { return toast("เปิดภาพไม่ได้: " + f.name); }
  const k = Math.min(1, 3000 / Math.max(bmp.width, bmp.height)), W = Math.round(bmp.width * k), H = Math.round(bmp.height * k);
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); g.drawImage(bmp, 0, 0, W, H);
  const blob = await new Promise((res) => cv.toBlob(res, "image/jpeg", 0.9));
  const id = M.uid("img");
  try { await LS.put("img:" + id, blob); } catch (err) { toast("เก็บภาพในเบราว์เซอร์ไม่ได้ — ภาพจะหายเมื่อปิดหน้า"); }
  const px = 10, w = W * px, h = H * px;
  hist.commit((d) => { d.backdrop = { img: id, name: f.name, url: URL.createObjectURL(blob), x: 0, y: h, w, h, opacity: 0.55 }; });
  view.setBackdrop(hist.doc.backdrop); host.onChange(); plan.fit(); setTool("calib");
  status(`วางภาพแล้ว (${W}×${H} พิกเซล · เก็บในเบราว์เซอร์นี้) — 📏 คลิก 2 จุดบนเส้นที่รู้ระยะ แล้วพิมพ์ระยะจริง`);
}

/** รุ่นออนไลน์: อ่าน DXF ใน Web Worker (หน้าไม่ค้าง) — ไม่มี Worker ก็อ่านในหน้าเลย */
function parseDxfLocal(buf, name) {
  return new Promise((res, rej) => {
    let w;
    try { w = new Worker(new URL("./dxfworker.js?v=0.15.0", import.meta.url), { type: "module" }); } catch (err) { w = null; }
    if (!w) { try { res(readDXF(decodeDXF(buf), name)); } catch (err) { rej(err); } return; }
    w.onmessage = (ev) => { w.terminate(); ev.data.error ? rej(new Error(ev.data.error)) : res(ev.data.data); };
    w.onerror = (ev) => { w.terminate(); try { res(readDXF(decodeDXF(buf), name)); } catch (err) { rej(err); } ev.preventDefault(); };
    w.postMessage({ buf, name }, [buf]);
  });
}

async function importLocalDxf(f) {
  if (!/\.dxf$/i.test(f.name)) { $("#cad-msg").textContent = "รุ่นออนไลน์เปิดได้เฉพาะ .dxf — DWG/PDF ใช้ ASC Architect ในเครื่อง หรือ Save As เป็น DXF ก่อน"; return; }
  const mb = f.size / 1048576;
  if (mb > 80 && !confirm(`ไฟล์ใหญ่ ${mb.toFixed(0)} MB — เบราว์เซอร์อาจช้า/ใช้หน่วยความจำมาก (ไฟล์ใหญ่แนะนำรุ่นในเครื่อง) อ่านต่อหรือไม่?`)) return;
  $("#cad-msg").textContent = `กำลังอ่าน ${f.name} (${mb.toFixed(1)} MB) ในเบราว์เซอร์…`;
  const t0 = Date.now();
  let data;
  try { data = await parseDxfLocal(await f.arrayBuffer(), f.name); } catch (err) { $("#cad-msg").textContent = "อ่านไฟล์ไม่ได้: " + err.message; return; }
  const ref = addCad("local:" + f.name, data, { local: true });
  try { await LS.put("cad:" + ref.id, data); } catch (err) { toast("เก็บเส้นในเบราว์เซอร์ไม่ได้ — เปิดแบบใหม่ต้องเลือกไฟล์ DXF อีกครั้ง"); }
  status(`อ่าน ${f.name} ในเบราว์เซอร์ ${((Date.now() - t0) / 1000).toFixed(1)} วินาที` + (Object.keys(data.skipped).length ? ` · ข้าม: ${Object.entries(data.skipped).map(([k, v]) => `${k} ${v}`).join(", ")}` : ""));
}

$("#cad-upload").addEventListener("change", async (e) => {
  const f = e.target.files[0]; if (!f) return;
  if (CLOUD) { e.target.value = ""; return importLocalDxf(f); }
  $("#cad-msg").textContent = `กำลังส่ง ${f.name} (${(f.size / 1048576).toFixed(1)} MB)…`;
  const q = new URLSearchParams({ name: f.name }); if (PROJECT) q.set("project", PROJECT);
  const r = await fetch("/api/cad/upload?" + q, { method: "POST", body: f });
  const j = await r.json(); e.target.value = "";
  if (!r.ok) { $("#cad-msg").textContent = j.error || "ส่งไฟล์ไม่สำเร็จ"; return; }
  importCad(j.path);
});

async function fetchCad(path) {
  const r = await fetch("/api/cad/load", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path }) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "อ่านไฟล์ไม่ได้");
  return j;
}

async function importCad(path) {
  $("#cad-msg").textContent = `กำลังอ่าน ${path}… (ไฟล์ใหญ่ / DWG อาจใช้เวลาหลายนาที)`;
  let data;
  try { data = await fetchCad(path); } catch (e) { $("#cad-msg").textContent = e.message; return; }
  addCad(path, data);
}

/** เส้นที่อ่านแล้ว → ชั้นไฟล์ CAD ในแบบ (ใช้ทั้งรุ่นในเครื่องและออนไลน์) */
function addCad(path, data, extra = {}) {
  const toMM = data.insunits ? data.toMM : data.guessToMM || 1;
  const ref = { id: M.uid("cad"), file: path, name: data.name, toMM, dx: 0, dy: 0, bbox: data.bbox, hidden: {}, units: data.units, ...extra };
  // แบบอยู่ไกลจุดกำเนิดมาก (พิกัดแผนที่) → ย้ายมุมล่างซ้ายมาที่ 0,0 (ตั้งค่าเลื่อนได้ภายหลัง)
  if (Math.max(Math.abs(data.bbox[0]), Math.abs(data.bbox[1])) * toMM > 1e6) { ref.dx = -Math.round(data.bbox[0] * toMM); ref.dy = -Math.round(data.bbox[1] * toMM); }
  for (const L of data.layers) if (!L.on) ref.hidden[L.name] = true;
  cadStore.set(ref.id, { data, built: CAD.build(data) });
  hist.commit((d) => d.cads.push(ref));
  $("#cad-dlg").hidden = true;
  host.onChange(); plan.fit(); updateCad3D();
  toast(`นำเข้า ${data.name}: ${data.polys.length.toLocaleString()} เส้น · ${data.texts.length.toLocaleString()} ข้อความ · ${data.layers.length} layer · หน่วย ${data.units}` + (data.insunits ? "" : " (เดาหน่วย — ตรวจในแผงขวา)"));
  return hist.doc.cads.find((r) => r.id === ref.id) || ref;
}

async function loadCad(ref, fit) {
  try {
    const data = ref.local ? await LS.get("cad:" + ref.id) : await fetchCad(ref.file);
    if (!data) { toast(`ไม่พบเส้นของ ${ref.name} ในเบราว์เซอร์นี้ (เปิดจากเครื่องอื่น/ล้างข้อมูลเบราว์เซอร์) — เอาออกแล้วนำเข้าไฟล์ DXF ใหม่`); return; }
    cadStore.set(ref.id, { data, built: CAD.build(data) });
    plan.render(); updateCad3D(); renderCadPanel();
    if (fit) plan.fit();
  } catch (e) { toast(`เปิด ${ref.file} ไม่ได้: ${e.message}`); }
}

function updateCad3D() {
  view.setCadLines(hist.doc.cads.filter((r) => !r.off && cadStore.has(r.id)).map((r) => CAD.segments3D(r, cadStore.get(r.id).data)));
}

const UNITS = [["1", "มม."], ["10", "ซม."], ["1000", "ม."], ["25.4", "นิ้ว"], ["304.8", "ฟุต"]];
function renderCadPanel() {
  const box = $("#cad-box"), cads = hist.doc.cads;
  box.hidden = !cads.length;
  if (!cads.length) return;
  const ink = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim();
  $("#cad-list").innerHTML = cads.map((r) => {
    const st = cadStore.get(r.id), layers = st ? st.data.layers : [];
    return `<div class="cadref" data-id="${r.id}"><b>${esc(r.name)}</b>${st ? "" : ' <span class="muted">กำลังโหลด…</span>'}
      <div class="row"><label><input type="checkbox" data-k="on" ${r.off ? "" : "checked"}> แสดง</label>
        หน่วย <select data-k="toMM">${UNITS.map(([v, n]) => `<option value="${v}" ${Number(v) === r.toMM ? "selected" : ""}>${n}</option>`).join("")}</select></div>
      <div class="row">เลื่อน x <input type="number" step="any" data-k="dx" value="${r.dx}"> y <input type="number" step="any" data-k="dy" value="${r.dy}"></div>
      <div class="row"><button data-op="origin">ย้ายมาจุด 0,0</button><button data-op="remove">เอาออก</button></div>
      <div class="lyrs">${layers.map((L) => `<div class="lyr"><input type="checkbox" data-layer="${esc(L.name)}" ${r.hidden && r.hidden[L.name] ? "" : "checked"}>
        <i style="background:${CAD.aciColor(L.color, ink)}"></i><span title="${L.count} ชิ้น">${esc(L.name)}</span>
        <span class="acts"><button data-op="lines" data-l="${esc(L.name)}" title="คัดลอกเป็นเส้นที่แก้ไขได้">เส้น</button><button data-op="walls" data-l="${esc(L.name)}" title="แต่ละเส้นเป็นผนัง">ผนัง</button><button data-op="masses" data-l="${esc(L.name)}" title="รูปปิดเป็นกล่อง 3D (push-pull)">กล่อง</button></span></div>`).join("")}</div></div>`;
  }).join("");
}
$("#cad-list").addEventListener("change", (e) => {
  const box = e.target.closest(".cadref"); if (!box) return;
  const id = box.dataset.id, k = e.target.dataset.k, layer = e.target.dataset.layer;
  hist.commit((d) => {
    const r = d.cads.find((x) => x.id === id); if (!r) return;
    if (layer !== undefined) { r.hidden = r.hidden || {}; if (e.target.checked) delete r.hidden[layer]; else r.hidden[layer] = true; }
    else if (k === "on") r.off = !e.target.checked;
    else if (k === "toMM") r.toMM = Number(e.target.value);
    else if (k === "dx" || k === "dy") r[k] = Number(e.target.value) || 0;
  });
  host.onChange(); updateCad3D();
});
$("#cad-list").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-op]"); if (!b) return;
  const id = b.closest(".cadref").dataset.id, ref = hist.doc.cads.find((x) => x.id === id), st = cadStore.get(id), op = b.dataset.op, L = b.dataset.l;
  if (!ref) return;
  if (op === "remove") { hist.commit((d) => (d.cads = d.cads.filter((x) => x.id !== id))); cadStore.delete(id); host.onChange(); updateCad3D(); return; }
  if (op === "origin") { hist.commit((d) => { const r = d.cads.find((x) => x.id === id); r.dx = -Math.round(r.bbox[0] * r.toMM); r.dy = -Math.round(r.bbox[1] * r.toMM); }); host.onChange(); updateCad3D(); plan.fit(); return; }
  if (!st) return;
  const cfg = host.defaults();
  let add = [], key = "";
  if (op === "lines") { add = CAD.toLines(ref, st.data, L); key = "lines"; }
  if (op === "walls") { add = CAD.toWalls(ref, st.data, L, cfg.wallThick, cfg.wallHeight); key = "walls"; }
  if (op === "masses") {
    const h = Number(prompt("ความสูงกล่อง (มม.)", String(cfg.massHeight)));
    if (!h || h <= 0) return;
    add = CAD.toMasses(ref, st.data, L, h); key = "masses";
  }
  if (!add.length) return toast(op === "masses" ? `ชั้น ${L} ไม่มีรูปปิดที่ใหญ่พอ` : `ชั้น ${L} ไม่มีเส้นที่ใช้ได้`);
  if (add.length > 5000 && !confirm(`จะสร้าง ${add.length.toLocaleString()} ชิ้น — อาจทำให้ช้า ทำต่อหรือไม่?`)) return;
  hist.commit((d) => d[key].push(...add));
  host.onChange();
  toast(`สร้าง${{ lines: "เส้น", walls: "ผนัง", masses: "กล่อง" }[key]} ${add.length.toLocaleString()} ชิ้นจากชั้น ${L} — แก้ไข/ลบได้ · Ctrl+Z ย้อนได้`);
});

/** แบบตัวอย่างตอนเปิดครั้งแรก: บ้านชั้นเดียว 10 × 8 ม. — ลบได้ด้วยปุ่ม "ใหม่" */
function demoDoc() {
  const d = M.newDoc("บ้านตัวอย่าง 10×8 ม.");
  d.walls = M.rectWalls([0, 0], [10000, 8000], 200, 3000);
  d.walls.push({ id: M.uid("w"), a: [5000, 0], b: [5000, 8000], thick: 120, height: 3000 });
  d.openings.push({ id: M.uid("o"), wall: d.walls[0].id, kind: "door", t: 0.25, width: 900, height: 2100, sill: 0 });
  d.openings.push({ id: M.uid("o"), wall: d.walls[0].id, kind: "window", t: 0.72, width: 1800, height: 1200, sill: 900 });
  d.openings.push({ id: M.uid("o"), wall: d.walls[1].id, kind: "window", t: 0.5, width: 1200, height: 1100, sill: 900 });
  d.openings.push({ id: M.uid("o"), wall: d.walls[4].id, kind: "door", t: 0.5, width: 800, height: 2100, sill: 0 });
  d.dims.push({ id: M.uid("d"), a: [0, 0], b: [10000, 0], offset: -1200 });
  d.dims.push({ id: M.uid("d"), a: [10000, 0], b: [10000, 8000], offset: -1200 });
  d.texts.push({ id: M.uid("t"), p: [1500, 4000], s: "ห้องนั่งเล่น", h: 300 }, { id: M.uid("t"), p: [6600, 4000], s: "ห้องนอน", h: 300 });
  d.masses.push({ id: M.uid("m"), name: "โรงจอดรถ", pts: [[11000, 0], [14000, 0], [14000, 5500], [11000, 5500]], base: 0, height: 2600 });
  return d;
}

// ---------------------------------------------------------------- ผู้ช่วย AI piBot: สถานะหน้า (ตัวเลขจากโค้ด) + ต่อไปทำอะไร + ช่องที่ผู้ช่วยตั้งค่าได้ (หลังผู้ใช้ยืนยัน)
window.ascaAI = {
  page: () => "editor",
  pageName: () => "ตัวเขียนแบบ 2D/3D",
  facts() {
    const d = hist.doc, s = M.summary(d);
    return { "ผนัง (ช่วง)": s.walls, "ผนังยาวรวม (ม.)": s.wallLengthM, "ประตู": s.doors, "หน้าต่าง": s.windows, "พื้นที่ตามกรอบผนัง (ตร.ม.)": s.footprintM2,
      "กล่อง 3D": d.masses.length, "ทรงหลังคา": d.roof.type === "none" ? "ไม่มี" : ROOF_TH[d.roof.type] || d.roof.type, "ความชันหลังคา (°)": d.roof.pitch,
      "แผงโซลาร์ (แผง)": s.pvCount, "kWp": s.pvKwp, "ไฟล์ CAD ที่นำเข้า": d.cads.length, "ภาพลอกแบบ": d.backdrop && (d.backdrop.sketch || d.backdrop.img) ? "มี" : "ไม่มี",
      "บันทึกแล้ว": dirty ? "ยังไม่บันทึก" : "บันทึกแล้ว" };
  },
  next() {
    const d = hist.doc, s = M.summary(d), trace = d.backdrop && (d.backdrop.sketch || d.backdrop.img);
    const drawn = s.walls > 0 || d.masses.length > 0;
    const steps = [
      { done: drawn || d.cads.length > 0 || !!trace, say: "เริ่มแบบ: วาดผนัง (W) ด้วยระยะจริง หรือนำเข้า CAD / ภาพลอกแบบ", act: { tool: "press", key: "wall", label: "วาดผนัง" } },
      ...(trace && !drawn ? [{ done: false, say: "ตั้งระยะภาพลอกแบบ (K): คลิก 2 จุดบนเส้นที่รู้ระยะ แล้ววาดผนังทับภาพ", act: { tool: "press", key: "calib", label: "ตั้งระยะ" } }] : []),
      ...(d.cads.length && !drawn ? [{ done: false, say: "แปลง layer ของไฟล์ CAD เป็นผนังหรือกล่อง — แผงขวา “ไฟล์ CAD” ปุ่ม ผนัง/กล่อง ข้าง layer" }] : []),
      { done: s.doors + s.windows > 0 || (!s.walls && drawn), say: "ใส่ประตู (D) และหน้าต่าง (N) บนผนัง", act: { tool: "press", key: "door", label: "ใส่ประตู" } },
      { done: d.roof.type !== "none" || !s.walls, say: "เลือกทรงหลังคา (แผงขวา หลังคา + แผงโซลาร์)", act: { tool: "set", id: "roof-type", value: "gable", label: "หลังคาจั่ว" } },
      ...(s.pvCount ? [{ done: false, say: `ส่งแผง ${s.pvCount} แผง (${s.pvKwp} kWp) ไปคำนวณผลผลิตไฟฟ้า`, act: { tool: "press", key: "yield", label: "⚡ ผลผลิต" } }] : []),
      { done: !dirty, say: "บันทึกแบบ (Ctrl+S)", act: { tool: "press", key: "save", label: "บันทึก" } },
      { done: false, say: "ส่งออกงาน: 📷 Render ภาพ · 🖨 Plot PDF · DXF · GLB", act: { tool: "press", key: "render", label: "📷 Render" } },
    ];
    const todo = steps.filter((x) => !x.done);
    return [...steps.filter((x) => x.done).slice(-2), ...todo.slice(0, 3)];
  },
  sets: {
    "roof-type": { label: "ทรงหลังคา", hint: "none flat shed gable hip curved" }, "roof-pitch": { label: "ความชันหลังคา (°)" }, "roof-over": { label: "ชายคายื่น (มม.)" },
    "roof-ridge": { label: "แนวสัน", hint: "auto short" }, "pv-on": { label: "วางแผงโซลาร์อัตโนมัติ", hint: "true/false" }, "pv-watt": { label: "แผง W" },
    "pv-edge": { label: "ระยะห่างขอบแผง (มม.)" }, "north": { label: "ทิศเหนือของแบบ (°)" }, "d-thick": { label: "ผนังหนา (มม.) ค่าเริ่มต้น" },
    "d-height": { label: "ผนังสูง (มม.) ค่าเริ่มต้น" }, "d-door": { label: "ประตูกว้าง (มม.)" }, "d-win": { label: "หน้าต่างกว้าง (มม.)" }, "d-mass": { label: "กล่องสูง (มม.)" },
  },
};

start();
