// ตัวเขียนแบบ ASC Architect — เชื่อมผัง 2D · 3D · แผงคุณสมบัติ · บันทึก/ส่งออก (โดย ลุงพี)
import * as M from "./model.js?v=0.31.5";
import { Plan2D } from "./plan2d.js?v=0.31.5";
import { View3D } from "./view3d.js?v=0.31.5";
import { toDXF } from "./dxf.js?v=0.31.5";
import { plotFormHTML, wirePlotForm, readPlotForm } from "../plotform.js?v=0.31.5";
import * as CAD from "./cadlayer.js?v=0.31.5";
import { Sketch3D } from "./sketch3d.js?v=0.31.5";
import { PALETTE } from "./materials.js?v=0.31.5";
import { sunPosition } from "./sun.js?v=0.31.5";
import { initSkUI } from "./skui.js?v=0.31.5";
import { readDXF, decodeDXF } from "./dxfread.js?v=0.31.5";
import * as LS from "./localstore.js?v=0.31.5";
import * as ST from "./struct.js?v=0.31.5";
import { openStruct } from "./structui.js?v=0.31.5";
import { openSolar } from "./solarui.js?v=0.31.5";
import * as WF from "./workflowui.js?v=0.31.5";
import { analyze as wfAnalyze } from "./workflow.js?v=0.31.5";
import { openStandards, printStandards } from "./standardsui.js?v=0.31.5";

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
  onSelect(sel, obj, live) {                          // เลือกในผัง 2D → เลือกชิ้นเดียวกันใน 3D + ข้อมูลวัตถุ
    if (live) return;
    if (sk) { sk.S.clear(); if (sel) sk.S.add(`${sel.type}:${sel.id}`); sk.redeco(); }
    showProps(sel, obj);
  },
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
    `พื้นที่ตามกรอบผนัง ${s.footprintM2.toLocaleString()} ตร.ม. · ${s.levels} ชั้น<br>` + (s.struct ? `โครงสร้าง ${s.struct} ชิ้น (ดู 🏗 โครงสร้าง)<br>` : "") +
    (pv && pv.count ? `<b>แผงโซลาร์ ${pv.count} แผง = ${s.pvKwp.toLocaleString()} kWp</b><br>เอียง ${s.pvTilt}° · หัน ${Math.round(s.pvAzimuth)}°` : "") +
    (hist.doc.imported ? ascSummary(hist.doc.imported) : pv && pv.count ? "" : "ไม่มีแผงโซลาร์ (ต้องมีผนังและหลังคา)");
  $("#doc-name").value = hist.doc.name; $("#doc-name").title = hist.doc.name + " — คลิกเพื่อแก้ชื่อแบบ";
  syncRoofInputs();
  if (plan.level && !ST.levels(hist.doc).some((l) => l.id === plan.level.id)) plan.level = null;
  if ($("#levelSel").options.length !== ST.levels(hist.doc).length + (ST.levels(hist.doc).length > 1 ? 1 : 0)) syncLevels();
  try { WF.badge(hist.doc); } catch (e) { console.warn("ตรวจลำดับงาน:", e); }
}
/** ปุ่มในหน้าต่าง ตรวจลำดับงาน → เปิดหน้าต่าง/เลือกวัตถุที่ต้องแก้ */
function wfRun(a) {
  if (a.startsWith("select:")) {
    const k = a.slice(7), t = k.slice(0, k.indexOf(":")), id = k.slice(k.indexOf(":") + 1), o = (hist.doc[t] || []).find((x) => x.id === id);
    if (o && plan.level && !ST.onLevel(hist.doc, plan.level, t, o)) { plan.level = null; syncLevels(); }   // วัตถุอยู่ชั้นอื่น → แสดงทุกชั้น
    plan.sel = { type: t, id }; if (sk) { sk.S.clear(); sk.S.add(k); sk.redeco(); } plan.render(); showProps(); status("เลือกแล้ว — แก้ค่าได้ที่ถาด ข้อมูลวัตถุ"); return;
  }
  if (a.startsWith("info:")) return ui && ui.modelInfo(a.slice(5));
  return act(a);
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

/** ข้อมูลวัตถุอยู่ในถาดขวา (แผงเดียวกันทั้ง 2D และ 3D — entity.js) */
function showProps() { if (ui) { ui.openPanel("entity", true); } }
/** เลือกใน 3D → ผัง 2D ไฮไลต์ชิ้นเดียวกัน (ชนิดที่มีในผัง) */
function onSelect3D(keys) {
  const k = keys.find((x) => /^(walls|openings|masses|lines|texts|dims|syms|struct):/.test(x));
  plan.sel = k ? { type: k.slice(0, k.indexOf(":")), id: k.slice(k.indexOf(":") + 1) } : null;
  plan.render();
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
$("#views").addEventListener("click", (e) => { const b = e.target.closest("button[data-view]"); if (b) setMode(b.dataset.view); });
/** โหมด 2D / 2D+3D / 3D: แสดงเฉพาะปุ่ม แถบ เมนู และแผงของโหมดนั้น (2D+3D = ทุกปุ่ม) */
function setMode(m) {
  $$("#views button").forEach((x) => x.classList.toggle("on", x.dataset.view === m));
  $("#viewarea").className = "views " + ({ "2d": "v2d", "3d": "v3d", split: "split" }[m]);
  document.body.dataset.view = m;
  try { localStorage.setItem("ascaEditor.mode", m); } catch (e) { /* */ }
  if (ui) ui.applyMode(m);
  setTimeout(() => { plan.resize(); view.resize(); }, 30);
}
// ชั้นอาคาร (ผัง 2D แสดง/วาดทีละชั้น)
function syncLevels() {
  const L = ST.levels(hist.doc), sel = $("#levelSel"), cur = plan.level && L.find((l) => l.id === plan.level.id);
  sel.innerHTML = (L.length > 1 ? '<option value="">ทุกชั้น</option>' : "") + L.map((l) => `<option value="${l.id}">${esc(l.name)} (${(l.z / 1000).toFixed(2)})</option>`).join("");
  plan.level = cur || (L.length > 1 ? L[0] : null); sel.value = plan.level ? plan.level.id : "";
  $("#plabel").textContent = plan.level ? `ผังพื้น${plan.level.name} · ระดับ ${(plan.level.z / 1000).toFixed(2)} ม.` : L.length > 1 ? "ผังรวมทุกชั้น" : "ผังพื้น";
}
$("#levelSel").addEventListener("change", (e) => { plan.level = ST.levels(hist.doc).find((l) => l.id === e.target.value) || null; syncLevels(); plan.render(); });
// เมนูส่งออก
$("#exportBtn").addEventListener("click", (e) => { e.stopPropagation(); $("#exportMenu").hidden = !$("#exportMenu").hidden; });
addEventListener("click", () => { $("#exportMenu").hidden = true; });
let ui = null;
const KEYS = { v: "select", h: "pan", w: "wall", r: "room", d: "door", n: "window", b: "box", l: "line", m: "dim", t: "text", s: "symbol", e: "erase", k: "calib", c: "column", g: "beam", f: "footing" };
document.addEventListener("keydown", (e) => {
  const inField = !!(e.target.matches && e.target.matches("input, select, textarea")) && e.target.id !== "vcb";
  const in3d = over3d || document.body.dataset.view === "3d";   // โหมด 3D อย่างเดียว: คีย์ลัดเป็นของ 3D เสมอ ไม่ว่าเมาส์อยู่ตรงไหน
  if (e.key === "F1" && e.shiftKey && ui) { e.preventDefault(); ui.keysDlg(); return; }   // F1 เฉย ๆ = โหมดช่วยเหลือ (ai/help.js)
  if ((e.ctrlKey || e.metaKey) && !inField) {
    const k = e.key.toLowerCase();
    if (in3d && ui) {
      if (k === "c") { e.preventDefault(); ui.ext.copy(false); return; }
      if (k === "x") { e.preventDefault(); ui.ext.copy(true); return; }
      if (k === "v") { e.preventDefault(); ui.ext.paste(); return; }
      if (k === "a") { e.preventDefault(); ui.selectAll(); return; }
    }
    if (k === "n") { e.preventDefault(); act("new"); return; }
    if (k === "o") { e.preventDefault(); $("#open-file").click(); return; }
    if (k === "p") { e.preventDefault(); act("plot"); return; }
    if (k === "z") { e.preventDefault(); act(e.shiftKey ? "redo" : "undo"); return; }
    if (k === "y") { e.preventDefault(); act("redo"); return; }
    if (k === "s") { e.preventDefault(); act("save"); return; }
  }
  if (inField) return;
  // ระหว่างวาด: ตัวเลข/จุลภาคไปที่ช่องระยะ (แบบ SketchUp)
  if (plan.draft && /^[0-9.,x*]$/.test(e.key) && e.target.id !== "vcb") { $("#vcb").focus(); return; }
  if ((e.key === "Delete" || e.key === "Backspace") && sk && sk.S.size && !plan.draft) { e.preventDefault(); ui.ext.removeSel(); plan.select(null); return; }   // ลบที่เลือก (2D หรือ 3D) ทุกชนิด
  if ((!in3d || plan.draft || !/^(Escape|Enter)$/.test(e.key)) && plan.key(e)) { e.preventDefault(); return; }   // Esc/Enter ในภาพ 3D เป็นของเครื่องมือ 3D (เดิมผัง 2D กินไปก่อน)
  if (e.target.id === "vcb") return;
  if (in3d && /^[0-9.,x*s-]$/i.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey && (/^[0-9.,-]$/.test(e.key) || ui.ext.busy() || $("#vcb").value)) { vcb3d = true; $("#vcb").focus(); return; }   // พิมพ์ระยะ/มุมได้ทันทีแบบ SketchUp
  if (in3d && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (e.key === "Escape") { if (!ui.ext.cancel()) { if (sk.tool === "select" && sk.S.size) { sk.S.clear(); ui.ext.selChanged(); } else setTool3d("select"); } return; }
    if (e.key === "Enter") { if (ui.ext.busy()) { e.preventDefault(); ui.ext.finish(); } return; }
    if (e.key === "Z" && e.shiftKey) { e.preventDefault(); view.fit(); return; }
    if (sk.tool === "walk" && /^(w|a|s|d|arrow\w+)$/i.test(e.key)) return;
    const k3 = { o: "orbit", " ": "select", p: "pushpull", r: "rect", m: "move", q: "rotate", b: "paint", t: "tape", h: "pan", z: "zoom", l: "line", c: "circle", a: "arc", e: "eraser", s: "scale", f: "offset" }[e.key.toLowerCase()];
    if (k3) { e.preventDefault(); setTool3d(k3); return; }
    if (e.key === "Delete") { ui.ext.removeSel(); return; }
  }
  if (sk && sk.tool === "walk" && /^(w|a|s|d)$/i.test(e.key)) return;     // กำลังเดินใน 3D: W/A/S/D ไม่สลับเครื่องมือผัง 2D (แม้เมาส์อยู่นอกช่อง 3D)
  if (document.body.dataset.view === "3d") return;                     // 3D อย่างเดียว: ไม่สลับไปเครื่องมือผัง 2D (เดิม F = ฐานราก แทน Offset)
  if (!e.ctrlKey && !e.metaKey && !e.altKey && KEYS[e.key.toLowerCase()]) setTool(KEYS[e.key.toLowerCase()]);
});
document.addEventListener("keyup", (e) => plan.key(e));
let over3d = false, vcb3d = false;
$("#pane2d").addEventListener("pointerenter", () => (vcb3d = false)); $("#pane3d").addEventListener("pointerenter", () => (over3d = true)); $("#pane3d").addEventListener("pointerleave", (e) => { if (!e.relatedTarget || e.relatedTarget.id !== "vcb") over3d = false; });
$("#vcb").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && ui && (over3d || vcb3d || ui.ext.busy() || document.body.dataset.view === "3d") && ui.ext.typed($("#vcb").value)) { e.preventDefault(); $("#vcb").value = ""; $("#vcb").blur(); vcb3d = false; return; }
  if (e.key === "Escape") vcb3d = false;
  if (e.key === "Enter") { e.preventDefault(); plan.key(e); $("#vcb").blur(); }
  if (e.key === "Escape") { $("#vcb").value = ""; $("#vcb").blur(); plan.key(e); }
});
$("#ortho").addEventListener("change", (e) => (plan.ortho = e.target.checked));
$("#showStruct").addEventListener("change", (e) => { plan.showStruct = e.target.checked; plan.render(); });
$("#snap").addEventListener("change", (e) => (plan.snapOn = e.target.checked));
$("#grid").addEventListener("change", (e) => { plan.grid = Number(e.target.value); plan.render(); });
// ---------------------------------------------------------------- เครื่องมือ 3D (SketchUp)
let sk;
function setTool3d(t) { $$("#tools3d [data-t3]").forEach((b) => b.classList.toggle("on", b.dataset.t3 === t)); sk.setTool(t); if (ui) ui.refresh(); }
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
  if (a === "struct") return openStruct({ hist, onChange: host.onChange, status, output, levelsChanged: () => { syncLevels(); plan.render(); }, select: (k) => { sk.S.clear(); sk.S.add(k); ui.ext.selChanged(); $("#struct-dlg").hidden = true; } });
  if (a === "struct-close") { $("#struct-dlg").hidden = true; return; }
  if (a === "solar") return openSolar({ hist, status, CLOUD, onChange: host.onChange });
  if (a === "solar-close") { $("#solar-dlg").hidden = true; return; }
  if (a === "level-add") {
    const L = ST.levels(d), l = L[L.length - 1], z = Number(prompt(`ระดับพื้นชั้น ${L.length + 1} (มม. จาก ±0.00)`, String(l.z + (l.h || 3000))));
    if (!isFinite(z)) return;
    hist.commit((dd) => { dd.levels = JSON.parse(JSON.stringify(L)); dd.levels.push({ id: M.uid("L"), name: `ชั้น ${L.length + 1}`, z, h: 3000 }); });
    plan.level = ST.levels(hist.doc)[L.length]; host.onChange(); syncLevels(); status(`เพิ่ม${plan.level.name} ที่ระดับ ${z.toLocaleString()} มม. — ผนัง/เสา/คานที่วาดต่อจากนี้อยู่ชั้นนี้`); return;
  }
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
  if (a === "workflow") return WF.openWorkflow({ hist, onChange: host.onChange, run: wfRun });
  if (a === "wf-close") { $("#wf-dlg").hidden = true; return; }
  if (a === "standards") { $("#wf-dlg").hidden = true; return openStandards({ hist, select: (k) => wfRun("select:" + k) }); }
  if (a === "std-close") { $("#std-dlg").hidden = true; return; }
  if (a === "std-print") return printStandards(hist.doc);
  if (a === "drawset") return drawsetDialog();
  if (a === "set-go") { if (!WF.guard(hist.doc, "สร้างชุดแบบ")) return; return makeDrawset(); }
  if (a === "set-close") { $("#set-dlg").hidden = true; return; }
  if (a === "set-open") return openDrawset();
  if (a === "plot-go") { if (!WF.guard(hist.doc, "Plot PDF")) return; return doPlot(); }
  if (a === "dxf") return output(safe(d.name) + (plan.level ? "_" + plan.level.name : "") + ".dxf", new Blob([toDXF(d, { level: plan.level })], { type: "application/dxf" }), "plan.dxf");
  if (a === "glb") return output(safe(d.name) + ".glb", await view.exportGLB(), "model.glb");
  if (a === "render") return ui.renderDlg();
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
      body: JSON.stringify({ ...o, area: null, dxf: toDXF(hist.doc, { level: plan.level }), name: hist.doc.name + (plan.level ? " " + plan.level.name : "") }) });
    const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status);
    const a = document.createElement("a");                // ลิงก์ให้กดเอง (เบราว์เซอร์บล็อกการเปิดแท็บอัตโนมัติ)
    a.href = j.url; a.target = "_blank"; a.rel = "noopener"; a.textContent = "📄 เปิด PDF";
    $("#plot-msg").textContent = `เสร็จ ${j.scale} · ${j.pdf}` + (j.clipped ? " · ⚠ ผังใหญ่กว่ากระดาษ ส่วนเกินถูกตัด" : "") + " · ";
    $("#plot-msg").append(a);
    hist.commit((dd) => { dd.plotRec = { at: new Date().toISOString().slice(0, 16), pdf: j.pdf }; }); host.onChange();   // ตรวจลำดับงาน: ขั้น 5
  } catch (e) { $("#plot-msg").textContent = "Plot ไม่สำเร็จ: " + e.message; }
}

// ชุดแบบก่อสร้าง (Phase 8): แบบนี้ → ConstructCAD (โปรแกรมแยกในเครื่อง) → PDF A3 เล่มเดียว + IFC · กรอบชื่อใช้ฟอร์มเดียวกับ Plot
let lastSet = null;
async function drawsetDialog() {
  if (CLOUD) return toast("ชุดแบบก่อสร้างต้องใช้รุ่นในเครื่อง (ASC Architect ในเครื่อง + ConstructCAD)");
  $("#set-body").innerHTML = `<div id="set-form">${plotFormHTML(null, { DWG_TITLE: hist.doc.name, PROJECT1: hist.doc.name })}</div><div id="set-res"></div>`;
  wirePlotForm($("#set-form"));
  for (const id of ["#pl-paper", "#pl-scale", "#pl-custom", "#pl-mono"]) { const el = $("#set-form " + id); if (el) el.closest("label").hidden = true; }   // ชุดแบบ = A3 มาตราส่วนอัตโนมัติ
  $("#set-dlg").hidden = false; $("#set-msg").textContent = "ตรวจ ConstructCAD…";
  const st = await (await fetch("/api/drawset/status")).json().catch(() => ({ ok: false, message: "ต่อ server ไม่ได้" }));
  $("[data-act=set-go]").disabled = !st.ok;
  $("#set-msg").textContent = st.ok ? `พร้อม · ${st.version}` : st.message;
}
async function makeDrawset() {
  const o = readPlotForm($("#set-form")), status = $("#set-form #pl-status")?.value || "";
  $("#set-msg").textContent = "กำลังสร้างชุดแบบ… (ประมาณ 5–20 วินาที)"; $("[data-act=set-go]").disabled = true;
  try {
    const r = await fetch("/api/drawset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ doc: serialize(hist.doc), fields: o.fields, status }) });
    const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status);
    lastSet = j;
    $("#set-res").innerHTML = `<p><b>✓ ชุดแบบ ${j.sheets.length} แผ่น</b> · มาตราส่วน 1:${j.scale} · ${j.seconds} วินาที · ${esc(j.engine || "")}</p>
      <p><a class="btn accent" href="${j.pdf}" target="_blank" rel="noopener">📄 เปิด PDF</a> ${j.ifc ? `<a class="btn" href="${j.ifc}" download>⬇ IFC</a>` : ""}
      <button data-act="set-open" title="เปิดโปรเจกต์ .ccad ใน ConstructCAD เพื่อแก้ต่อแบบ BIM">🏗 เปิดใน ConstructCAD</button></p>
      <ol class="small">${j.sheets.map(([no, t]) => `<li>${esc(no)} ${esc(t)}</li>`).join("")}</ol>` +
      (j.warnings.length ? `<p class="small">⚠ ${j.warnings.map(esc).join("<br>⚠ ")}</p>` : "");
    $("#set-msg").textContent = "เก็บที่ out\\drawsets\\" + j.folder;
  } catch (e) { $("#set-msg").textContent = "สร้างชุดแบบไม่สำเร็จ: " + e.message; }
  finally { $("[data-act=set-go]").disabled = false; }
}
async function openDrawset() {
  if (!lastSet) return;
  const r = await fetch("/api/drawset/open", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folder: lastSet.folder }) });
  const j = await r.json(); toast(r.ok ? "เปิด ConstructCAD แล้ว (หน้าต่างใหม่บนเครื่องนี้)" : j.error);
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
function draft() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(serialize(hist.doc)));
    localStorage.setItem("pa.editor.last", JSON.stringify({ key: DRAFT_KEY, project: PROJECT || "", name: hist.doc.name, at: new Date().toISOString() }));   // หน้าแรก: งานที่เปิดล่าสุด
  } catch (e) { /* ไม่มี storage ก็ข้าม */ }
}
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
    else toast(`ไม่พบภาพลอกแบบ ${d.backdrop.name || ""} ในเบราว์เซอร์นี้ — นำเข้าภาพใหม่ที่เมนู ไฟล์ → ภาพลอกแบบ…`);
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
  const START = params.get("start");                   // ?start=demo · ?start=new · ?start=draft (หน้าแรก: ทำงานล่าสุดต่อ ไม่ต้องถาม)
  if (!doc && START === "new") doc = M.newDoc("แบบใหม่");
  if (!doc && START === "draft" && saved && saved.app === "pee_architec-drawing") doc = saved;
  if (!doc && START !== "demo" && saved && saved.app === "pee_architec-drawing" && confirm("มีแบบที่ยังไม่ได้บันทึกจากครั้งก่อน — เปิดต่อหรือไม่?")) doc = saved;
  let firstScene = false;
  if (!doc) { doc = demoDoc(); firstScene = true; }
  hist.doc = M.normalize(doc);
  if (hist.doc.imported) hist.doc.imported = Object.assign({ outlines: [] }, hist.doc.imported);
  refresh(); plan.fit(); view.fit();
  attachImported();
  renderScenes(); sunNow();
  ui = initSkUI({ view, sk, hist, M, status, sunNow, act, setTool3d, setTool2d: (t) => setTool(t), onChange: host.onChange, onSelect3D,      // หน้าตาแบบ SketchUp ของมุมมอง 3D (ตามหน้าตัวอย่าง 0.23.0)
    demo: openDemo, saveImage: (blob, suffix) => output(safe(hist.doc.name) + suffix, blob, "render_editor.png") });
  if (firstScene && hist.doc.scenes && hist.doc.scenes[0]) { const s0 = hist.doc.scenes[0]; view.camera.position.fromArray(s0.pos); view.controls.target.fromArray(s0.target); view.controls.update(); $("#sun-date").value = s0.sun.date; $("#sun-time").value = s0.sun.time; sunNow(); }
  for (const ref of hist.doc.cads) loadCad(ref, false);
  syncLevels();
  let m0 = "split"; try { m0 = localStorage.getItem("ascaEditor.mode") || "split"; } catch (e) { /* */ }
  if (["2d", "split", "3d"].includes(params.get("view"))) m0 = params.get("view");   // หน้าแรก: ขั้นงาน → เปิดโหมดที่ตรงขั้น
  setMode(m0);
  setTool("select"); setTool3d("select");
  loadSymbols();
  const A0 = params.get("act");                        // หน้าแรก/เมนูออกแบบโซลาร์: เปิดหน้าต่างของขั้นนั้นทันที
  if (["struct", "solar", "drawset", "plot", "workflow", "standards"].includes(A0)) setTimeout(() => act(A0), 300);
  if (A0 === "import3d") setTimeout(() => { $('[data-menu="ไฟล์"] > button')?.click(); $('#ddm [data-menu^="ไฟล์/นำเข้า 3D"]')?.click(); }, 300);   // = เมนู ไฟล์ → นำเข้า 3D SketchUp
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
  if (!k || !k.sketch) return toast("นำเข้าภาพก่อน — เมนู ไฟล์ → ภาพลอกแบบ… แล้วเลือก ร่างกล่องอาคารด้วย AI ที่เมนู ส่วนเสริม");
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
    try { w = new Worker(new URL("./dxfworker.js?v=0.31.5", import.meta.url), { type: "module" }); } catch (err) { w = null; }
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

/** แบบตัวอย่างหลัก (เปิดครั้งแรก): บ้านพักอาศัย 2 ชั้น 8 × 10 ม. โครงสร้าง คสล. ครบ (ฐานรากเข็ม เสา คานคอดิน คานชั้น 2 คานหลังคา พื้น บันได)
 *  + หลังคาปั้นหยา + แผงโซลาร์บนหลังคา (ใช้สร้าง Single Line Diagram ได้จริง) + โรงจอดรถ ทางเข้า ต้นไม้ · พิกัดขอนแก่น (มีแคชอากาศ) */
function demoDoc() {
  const d = M.newDoc("บ้านพักอาศัย 2 ชั้น คสล. + โซลาร์รูฟท็อป (ตัวอย่าง)"), rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const uid = M.uid, X = [0, 4000, 8000], Y = [0, 3500, 7000, 10000], Z2 = 3200, ZR = 6200;
  Object.assign(d.site, { lat: 16.47, lon: 102.84, north: 0 });
  d.levels = [{ id: "L1", name: "ชั้น 1", z: 0, h: 3200 }, { id: "L2", name: "ชั้น 2", z: Z2, h: 3000 }];
  const wall = (a, b, thick, base, height, mat) => { const w = { id: uid("w"), a, b, thick, height, mat }; if (base) w.base = base; d.walls.push(w); return w; };
  const ring = (base, height) => [[0, 0], [8000, 0], [8000, 10000], [0, 10000]].map((a, i, c) => wall(a, c[(i + 1) % 4], 200, base, height, i === 0 ? "white" : i === 3 && !base ? "stone" : "white"));
  const op = (w, kind, t, width, height, sill, mark) => d.openings.push({ id: uid("o"), wall: w.id, kind, t, width, height, sill, mark });
  // ชั้น 1: นั่งเล่น + รับประทานอาหาร (หน้า) · ครัว + บันได (หลัง) · ห้องน้ำ
  const g = ring(0, 3200);
  const p1 = wall([4000, 0], [4000, 7000], 120, 0, 3200, "interior"), p2 = wall([0, 7000], [8000, 7000], 120, 0, 3200, "interior");
  op(g[0], "door", 0.22, 1000, 2200, 0, "D1"); op(g[0], "window", 0.7, 2400, 2100, 300, "W1"); op(g[1], "window", 0.25, 1200, 1200, 900, "W2"); op(g[1], "window", 0.82, 1200, 1200, 900, "W2");
  op(g[2], "window", 0.3, 1500, 1100, 1000, "W3"); op(g[2], "door", 0.85, 900, 2100, 0, "D2"); op(g[3], "window", 0.55, 1500, 1200, 900, "W2"); op(p1, "door", 0.75, 900, 2100, 0, "D3"); op(p2, "door", 0.82, 900, 2100, 0, "D3");
  // ชั้น 2: ห้องนอน 2 ห้อง + ห้องน้ำ + โถงบันได
  const u = ring(Z2, 3000);
  const q1 = wall([4000, 0], [4000, 7000], 120, Z2, 3000, "interior"), q2 = wall([5300, 7000], [8000, 7000], 120, Z2, 3000, "interior");
  op(u[0], "window", 0.25, 1500, 1500, 800, "W4"); op(u[0], "window", 0.75, 1500, 1500, 800, "W4"); op(u[1], "window", 0.3, 1200, 1200, 900, "W2"); op(u[1], "window", 0.85, 600, 600, 1600, "W5");
  op(u[2], "window", 0.7, 1200, 1100, 1000, "W3"); op(u[3], "window", 0.3, 1200, 1200, 900, "W2"); op(q1, "door", 0.85, 900, 2100, 0, "D3"); op(q2, "door", 0.5, 800, 2100, 0, "D4");
  Object.assign(d.roof, { type: "gable", ridge: "short", pitch: 20, overhang: 800, mat: "metal" });   // สันตามด้านสั้น → หน้าหลังคาหันใต้ วางแผงได้เต็มผืน
  Object.assign(d.pv, { enabled: true, watt: 550, edge: 400 });
  // โครงสร้าง คสล. (fc' 240 · SD40): ฐานรากเข็ม · เสา · คานคอดิน GB1 · คานชั้น 2 B1 · คานหลังคา RB1 · พื้น S0/S1 · บันได ST1
  const S = d.struct, inner = (x, y) => x === 4000 && y > 0 && y < 10000;
  for (const x of X) for (const y of Y) {
    const big = inner(x, y);
    S.push({ id: uid("c"), kind: "footing", p: [x, y], w: big ? 1500 : 1200, l: big ? 1500 : 1200, t: big ? 400 : 350, z: -1200, mark: big ? "F2" : "F1", pile: big ? "เข็มตอก I-0.22 ยาว 8 ม. 3 ต้น รับ 20 ตัน/ต้น" : "เข็มตอก I-0.18 ยาว 6 ม. 2 ต้น รับ 15 ตัน/ต้น" });
    S.push({ id: uid("c"), kind: "column", p: [x, y], w: big ? 250 : 200, l: big ? 250 : 200, base: -1200, top: ZR, mark: big ? "C2" : "C1", rebar: big ? "8-DB16 · ปลอก RB6@0.15" : "4-DB16 · ปลอก RB6@0.15" });
  }
  const beams = (z, mark, w, dep, rebar, only) => {
    for (const x of X) for (let i = 0; i < Y.length - 1; i++) if (!only || only(x, null)) S.push({ id: uid("c"), kind: "beam", a: [x, Y[i]], b: [x, Y[i + 1]], w, d: dep, z, mark, rebar });
    for (const y of Y) for (let i = 0; i < X.length - 1; i++) if (!only || only(null, y)) S.push({ id: uid("c"), kind: "beam", a: [X[i], y], b: [X[i + 1], y], w, d: dep, z, mark, rebar });
  };
  beams(0, "GB1", 200, 500, "บน 2-DB12 · ล่าง 3-DB16 · ปลอก RB6@0.15");
  beams(Z2, "B1", 200, 500, "บน 2-DB16 · ล่าง 3-DB16 · ปลอก RB6@0.15");
  beams(ZR, "RB1", 200, 400, "บน 2-DB12 · ล่าง 2-DB12 · ปลอก RB6@0.20", (x, y) => x === 0 || x === 8000 || y === 0 || y === 10000);
  S.push({ id: uid("c"), kind: "slab", pts: rect(0, 0, 8000, 10000), t: 100, z: 0, mark: "S0" });
  S.push({ id: uid("c"), kind: "slab", pts: rect(0, 0, 8000, 10000), holes: [rect(400, 7300, 5100, 8700)], t: 120, z: Z2, mark: "S1" });
  S.push({ id: uid("c"), kind: "stair", p: [500, 8000], rot: 0, w: 1200, n: 18, run: 250, base: 0, rise: Z2, mark: "ST1" });
  // ภายนอก: ลานหน้าบ้าน ทางเข้า โรงจอดรถ รั้ว ต้นไม้
  const mass = (name, pts, height, mat, tag, base = 0) => d.masses.push({ id: uid("m"), name, pts, base, height, mat, tag });
  const item = (kind, x, y, rot = 0, sc = 1, z = 0) => d.items3d.push({ id: uid("i"), kind, p: [x, y], z, rot, s: sc });
  mass("ลานหน้าบ้าน (หินแกรนิต)", rect(-800, -2600, 8800, 0), 100, "granite", "land");
  mass("ทางเข้า คอนกรีต", rect(9200, -9000, 13600, 6500), 80, "concrete", "land");
  for (const [x, y] of [[9400, 200], [13400, 200], [9400, 6200], [13400, 6200]]) mass("เสาโรงจอดรถ (เหล็ก)", rect(x - 75, y - 75, x + 75, y + 75), 2650, "alu", "masses", 80);
  mass("หลังคาโรงจอดรถ", rect(9100, -100, 13700, 6500), 150, "white2", "masses", 2730);
  mass("รั้วหลัง", rect(-4000, 13500, 16000, 13700), 1800, "white", "land"); mass("รั้วข้าง", rect(-4000, -9000, -3800, 13500), 1800, "white", "land"); mass("รั้วข้าง", rect(15800, -9000, 16000, 13500), 1800, "white", "land");
  item("car", 11400, 3200, 90);
  for (const [x, y, sc] of [[-2200, 11000, 1.1], [-2400, -6500, 1.2], [6500, 12200, 0.9], [14800, 10800, 1]]) item("tree", x, y, (((x + y) % 360) + 360) % 360, sc);
  for (let i = 0; i < 6; i++) item("shrub", 300 + i * 1500, -3200, i * 50, 0.85);
  item("lamp", 8900, -2500);
  d.dims.push({ id: uid("d"), a: [0, 0], b: [4000, 0], offset: -3800 }, { id: uid("d"), a: [4000, 0], b: [8000, 0], offset: -3800 }, { id: uid("d"), a: [0, 0], b: [8000, 0], offset: -4800 },
    { id: uid("d"), a: [8000, 0], b: [8000, 3500], offset: -1600 }, { id: uid("d"), a: [8000, 3500], b: [8000, 7000], offset: -1600 }, { id: uid("d"), a: [8000, 7000], b: [8000, 10000], offset: -1600 });
  d.texts.push({ id: uid("t"), p: [1300, 3500], s: "นั่งเล่น", h: 300 }, { id: uid("t"), p: [5300, 3500], s: "รับประทานอาหาร", h: 300 }, { id: uid("t"), p: [6000, 8800], s: "ครัว", h: 300 });
  const yr = new Date().getFullYear(), sc = (name, pos, target, time) => ({ name, pos, target, sun: { date: `${yr}-04-15`, time } });
  d.scenes = [sc("มุมสูงหน้าบ้าน", [21, 13, 20], [4.5, 2.6, -4], "09:30"), sc("หน้าบ้าน ระดับสายตา", [5, 1.65, 13], [4, 3, -4], "16:00"), sc("พลบค่ำ", [-12, 4, 17], [4, 3, -5], "18:15")];
  return d;
}
/** แบบตัวอย่างภาพนำเสนอ: บ้าน 12×8 ม. + ลานหิน สระว่ายน้ำ โรงจอดรถ รถ ต้นไม้ (เดิม 0.23.0) */
function demoPool() {
  const d = M.newDoc("บ้านตัวอย่างพร้อมสระ 12×8 ม."), rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const mass = (name, pts, height, mat, tag, base = 0) => d.masses.push({ id: M.uid("m"), name, pts, base, height, mat, tag });
  const item = (kind, x, y, rot = 0, s = 1, z = 0) => d.items3d.push({ id: M.uid("i"), kind, p: [x, y], z, rot, s });
  d.walls = M.rectWalls([0, 0], [12000, 8000], 200, 3200);
  ["white", "stone", "white", "wood"].forEach((m, i) => (d.walls[i].mat = m));
  d.walls.push({ id: M.uid("w"), a: [6000, 0], b: [6000, 8000], thick: 120, height: 3200, mat: "interior" });
  const op = (w, kind, t, width, height, sill) => d.openings.push({ id: M.uid("o"), wall: d.walls[w].id, kind, t, width, height, sill });
  op(0, "door", 0.12, 1000, 2400, 0); op(0, "window", 0.38, 3600, 2500, 200); op(0, "window", 0.78, 3000, 2500, 200);
  op(1, "window", 0.5, 1800, 1400, 900); op(2, "window", 0.3, 1500, 1200, 1000); op(2, "window", 0.75, 1500, 1200, 1000); op(3, "door", 0.6, 900, 2200, 0); op(4, "door", 0.5, 900, 2200, 0);
  Object.assign(d.roof, { type: "hip", pitch: 22, overhang: 900, mat: "metal" });
  d.dims.push({ id: M.uid("d"), a: [0, 0], b: [12000, 0], offset: -1500 }, { id: M.uid("d"), a: [12000, 0], b: [12000, 8000], offset: -1500 });
  d.texts.push({ id: M.uid("t"), p: [3000, 4000], s: "ห้องนั่งเล่น", h: 300 }, { id: M.uid("t"), p: [9000, 4000], s: "ห้องนอน", h: 300 });
  mass("ลานหินแกรนิต", rect(-1000, -4200, 13000, 0), 120, "granite", "land");
  mass("ทางเข้าคอนกรีต", rect(13600, -14000, 18600, 6500), 100, "concrete", "land");
  for (const [x, y] of [[13900, 300], [18100, 300], [13900, 6000], [18100, 6000]]) mass("เสาโรงจอดรถ", rect(x - 80, y - 80, x + 80, y + 80), 2800, "alu", "masses", 100);
  mass("หลังคาโรงจอดรถ", rect(13600, 0, 18600, 6400), 200, "white2", "masses", 2900);
  mass("ขอบสระ", rect(-1000, -12000, 11000, -11400), 300, "granite", "pool"); mass("ขอบสระ", rect(-1000, -6100, 11000, -5500), 300, "granite", "pool");
  mass("ขอบสระ", rect(-1000, -11400, -400, -6100), 300, "granite", "pool"); mass("ขอบสระ", rect(10400, -11400, 11000, -6100), 300, "granite", "pool");
  mass("พื้นสระ", rect(-400, -11400, 10400, -6100), 20, "pooltile", "pool"); mass("น้ำในสระ", rect(-400, -11400, 10400, -6100), 230, "water", "pool");
  mass("พื้นไม้รอบสระ", rect(11000, -12000, 13200, -5500), 120, "deck", "pool");
  mass("รั้วหินด้านหลัง", rect(-7000, 14000, 23000, 14350), 1800, "stone", "land"); mass("รั้วหินด้านข้าง", rect(-7000, -15000, -6650, 14000), 1800, "stone", "land");
  item("car", 16100, 3100, 90);
  for (const [x, y, s] of [[-4200, 10500, 1.15], [-4800, -2500, 1.3], [21000, 10500, 1.2], [21000, -8500, 1], [-4000, -13800, 0.95], [8000, 11500, 0.9]]) item("tree", x, y, (x * 7 + y) % 360, s);
  item("palm", 12300, -4900, 0, 1); item("palm", -2200, -5000, 40, 0.9);
  for (let i = 0; i < 8; i++) item("shrub", 200 + i * 1550, -4600, i * 40, 0.9 + (i % 3) * 0.1);
  for (let i = 0; i < 5; i++) item("shrub", 12900, 1000 + i * 1300, i * 70, 0.8);
  item("lounger", 11600, -9400, 0, 1, 120); item("lounger", 12500, -9400, 0, 1, 120); item("table", 9000, -2200, 0, 1, 120); item("lamp", 13300, -1000); item("lamp", 13300, -6800);
  d.texts3d.push({ id: M.uid("x"), kind: "label", s: "สระว่ายน้ำ 10.8 × 5.3 ม.", p: [5000, -8750], z: 230, at: [5600, -8750], atz: 1400, h: 250 });
  d.dims3d.push({ id: M.uid("n"), a: [-400, -11400, 300], b: [10400, -11400, 300], off: 400, h: 250 });
  const y = new Date().getFullYear(), sc = (name, pos, target, time) => ({ name, pos, target, sun: { date: `${y}-04-15`, time } });
  d.scenes = [sc("มุมสูงหน้าบ้าน", [26, 11, 27], [6, 1.2, 3], "09:30"), sc("ริมสระว่ายน้ำ", [-5.5, 2.2, 16], [7, 1.6, 4], "15:30"), sc("พลบค่ำ", [21, 3.2, 19], [6, 2, 1], "18:15")];
  return d;
}
function openDemo(which) {
  if (dirty && !confirm("แบบปัจจุบันยังไม่บันทึก — เปิดแบบตัวอย่าง?")) return;
  hist.replace(which === "pool" ? demoPool() : demoDoc()); plan.level = null; plan.select(null); host.onChange(); syncLevels(); renderScenes(); plan.fit();
  const s = hist.doc.scenes[0]; view.camera.position.fromArray(s.pos); view.controls.target.fromArray(s.target); view.controls.update();
  $("#sun-date").value = s.sun.date; $("#sun-time").value = s.sun.time; sunNow(); view.setStyle("render"); ui.refresh();
  status(which === "pool" ? "แบบตัวอย่าง: บ้านพร้อมสระ · ลองคลิกฉากในถาด ฉาก หรือ 📷 Render ภาพนำเสนอ" : "แบบตัวอย่าง: บ้าน 2 ชั้น คสล. — ลองเปลี่ยน ชั้น ที่แถบผัง 2D · 🏗 โครงสร้าง = ตรวจขนาด + ตาราง · ⚡ โซลาร์ + SLD = แบบไฟฟ้าจริง");
}

// ---------------------------------------------------------------- ผู้ช่วย AI piBot: คำสั่งที่ทำได้จริง (ai/actions.js ตรวจชนิด/ช่วงค่าก่อน · ผู้ใช้กดยืนยันการ์ดก่อนทุกครั้ง)
// ทุกฟังก์ชันคืน { ok, msg, keys } — ตัวเลขใน msg มาจากโค้ดของโปรแกรม (M.summary · ST.check · ST.quantities · workflow) ไม่ใช่จาก AI
const aiKey = (o) => "struct:" + o.id;
function aiRun(name, p = {}) {
  const d = hist.doc, lv = plan.level || ST.levels(d)[0], z = lv.z || 0;
  const done = (msg, keys) => ({ ok: true, msg, keys: keys || [] }), fail = (msg) => ({ ok: false, msg });
  const sameMark = (o, kind) => o.kind === kind && String(o.mark || "").toUpperCase() === String(p.mark).toUpperCase();
  switch (name) {
    case "wall.draw":
      if (document.body.dataset.view === "3d") setMode("split");
      setTool(p.tool === "room" ? "room" : "wall");
      return done(p.tool === "room" ? "เลือกเครื่องมือห้องแล้ว — คลิก 2 มุมในผัง 2D หรือคลิกมุมแรกแล้วพิมพ์ 4000,3000 Enter" : "เลือกเครื่องมือผนังแล้ว — คลิกจุดในผัง 2D หรือพิมพ์ระยะแล้ว Enter");
    case "room.add": {
      const W = p.w * 1000, D = p.d * 1000, cfg = host.defaults(), ws = d.walls.filter((w) => ST.onLevel(d, plan.level, "walls", w));
      let x0 = 0, y0 = 0;
      if (p.x != null || p.y != null) { x0 = (p.x || 0) * 1000; y0 = (p.y || 0) * 1000; }
      else if (ws.length) { x0 = Math.max(...ws.flatMap((w) => [w.a[0], w.b[0]])); y0 = Math.min(...ws.flatMap((w) => [w.a[1], w.b[1]])); }   // ต่อจากผนังเดิมทางขวา
      const onOld = (pt) => ws.some((w) => M.projectOnSegment(pt, w.a, w.b).d < 1);
      const nw = M.rectWalls([x0, y0], [x0 + W, y0 + D], cfg.wallThick, cfg.wallHeight).map((w) => (z ? { ...w, base: z } : w)).filter((w) => !(onOld(w.a) && onOld(w.b)));   // ผนังที่ทับผนังเดิม ไม่ซ้ำ
      hist.commit((dd) => dd.walls.push(...nw)); host.onChange(); if (plan.w > 200 && plan.h > 200) plan.fit();   // ผัง 2D ซ่อน/เล็กมาก = ไม่ซูม
      return done(`เพิ่มห้อง ${p.w} × ${p.d} ม. = ผนัง ${nw.length} ช่วง (หนา ${cfg.wallThick} มม. สูง ${cfg.wallHeight} มม.)${ST.levels(d).length > 1 ? " ที่" + lv.name : ""}`, nw.map((w) => "walls:" + w.id));
    }
    case "struct.autoframe": {
      if (!d.walls.length) return fail("ยังไม่มีผนัง — วาดผนัง/ห้องก่อน");
      const S = ST.autoFrame(d), n = (k) => S.filter((o) => o.kind === k).length;
      if (!S.length) return fail("ไม่พบผนังรอบนอกหนา ≥ 150 มม. ที่ชั้น 1 — สร้างโครงจากผนังไม่ได้");
      hist.commit((dd) => { dd.struct = (dd.struct || []).filter((o) => o.kind === "slab" || o.kind === "stair").concat(S); }); host.onChange();
      return done(`สร้างโครงจากผนัง: เสา ${n("column")} ต้น · ฐานราก ${n("footing")} · คาน ${n("beam")} ช่วง — กด ✅ ตรวจงาน เพื่อดูผลตรวจขนาด`, S.filter((o) => o.kind === "column").map(aiKey));
    }
    case "struct.check": { const c = aiChecks(); return done(c.structText, c.failKeys); }
    case "workflow.check": { const c = aiChecks(); return done(c.wfText, c.wfKeys); }
    case "bom.summary": return done(aiBom());
    case "struct.open": act("struct"); return done("เปิดหน้าต่าง 🏗 โครงสร้างแล้ว");
    case "beam.resize": case "column.resize": {
      const kind = name === "beam.resize" ? "beam" : "column", hit = (d.struct || []).filter((o) => sameMark(o, kind));
      if (!hit.length) return fail(`ไม่พบ${ST.KINDS[kind]}รหัส ${p.mark} ในแบบ`);
      hist.commit((dd) => { for (const o of dd.struct) if (sameMark(o, kind)) { if (p.w != null) o.w = p.w; if (kind === "beam" && p.d != null) o.d = p.d; if (kind === "column" && p.l != null) o.l = p.l; } });
      host.onChange();
      const o = hist.doc.struct.find((x) => sameMark(x, kind));
      return done(`${ST.KINDS[kind]} ${p.mark} ${hit.length} ชิ้น → ${kind === "beam" ? `${o.w}×${o.d}` : `${o.w}×${o.l || o.w}`} มม. — กด ✅ ตรวจงาน เพื่อตรวจใหม่`, hit.map(aiKey));
    }
    case "level.add": {
      const L = ST.levels(d), l = L[L.length - 1], zz = p.z != null ? p.z : l.z + (l.h || 3000), h = p.h || 3000;
      if (L.some((x) => Math.abs(x.z - zz) < 1)) return fail(`มีชั้นที่ระดับ ${zz.toLocaleString()} มม. อยู่แล้ว`);
      hist.commit((dd) => { dd.levels = JSON.parse(JSON.stringify(L)); dd.levels.push({ id: M.uid("L"), name: `ชั้น ${L.length + 1}`, z: zz, h }); });
      plan.level = ST.levels(hist.doc)[L.length]; host.onChange(); syncLevels();
      return done(`เพิ่มชั้น ${L.length + 1} ที่ระดับ ${zz.toLocaleString()} มม. สูง ${h.toLocaleString()} มม. — ผนัง/เสา/คานที่วาดต่อจากนี้อยู่ชั้นนี้`);
    }
    case "roof.set":
      hist.commit((dd) => { if (p.type) dd.roof.type = p.type; if (p.pitch != null) dd.roof.pitch = p.pitch; if (p.overhang != null) dd.roof.overhang = p.overhang; }); host.onChange();
      return done(`หลังคา${hist.doc.roof.type === "none" ? ": ไม่มี" : ROOF_TH[hist.doc.roof.type] || hist.doc.roof.type} · ชัน ${hist.doc.roof.pitch}° · ชายคา ${hist.doc.roof.overhang} มม.${d.walls.length ? "" : " (ยังไม่มีผนัง หลังคาจะขึ้นเมื่อวาดผนัง)"}`);
    case "pv.set": {
      hist.commit((dd) => { if (p.on != null) dd.pv.enabled = p.on; if (p.watt != null) dd.pv.watt = p.watt; }); host.onChange();
      const s = M.summary(hist.doc);
      return done(`แผงโซลาร์อัตโนมัติ: ${hist.doc.pv.enabled ? "เปิด" : "ปิด"} · แผง ${hist.doc.pv.watt} W · ตอนนี้วางได้ ${s.pvCount} แผง = ${s.pvKwp} kWp (โปรแกรมคำนวณ)`);
    }
    case "solar.sld": act("solar"); return done("เปิดหน้าต่าง ⚡ โซลาร์ + SLD แล้ว — กด 📐 สร้าง Single Line Diagram ในหน้าต่าง (ขนาดสาย ฟิวส์ เบรกเกอร์ โปรแกรมคำนวณ)");
    case "plot.open": act("plot"); return done("เปิดหน้าต่าง 🖨 Plot PDF แล้ว");
    case "drawset.open": act("drawset"); return done("เปิดหน้าต่าง 📑 ชุดแบบก่อสร้างแล้ว");
    case "view.set": setMode(p.mode); return done(`มุมมอง ${{ "2d": "2D", split: "2D+3D", "3d": "3D" }[p.mode]}`);
    case "undo": if (!hist.past.length) return fail("ไม่มีขั้นให้ย้อน"); act("undo"); return done("ย้อน 1 ขั้นแล้ว");
  }
  return fail(`หน้านี้ทำคำสั่ง ${name} ไม่ได้`);
}
/** ดูบนผัง: เลือก + ไฮไลต์วัตถุ ("walls:<id>" · "struct:<id>" · [หลายชิ้น] · { kind, mark }) · ไม่มีวัตถุ = false */
function aiFocus(t) {
  const d = hist.doc;
  let keys = Array.isArray(t) ? t : typeof t === "string" ? [t] : t && t.mark ? (d.struct || []).filter((o) => (!t.kind || o.kind === t.kind) && String(o.mark || "").toUpperCase() === String(t.mark).toUpperCase()).map(aiKey) : [];
  keys = keys.filter((k) => { const i = k.indexOf(":"); return i > 0 && (d[k.slice(0, i)] || []).some((x) => x.id === k.slice(i + 1)); });
  if (!keys.length) return false;
  if (document.body.dataset.view === "3d") setMode("split");
  wfRun("select:" + keys[0]);                                                     // เปลี่ยนชั้นให้ถ้าวัตถุอยู่ชั้นอื่น + ข้อมูลวัตถุ
  if (sk && keys.length > 1) { for (const k of keys) sk.S.add(k); sk.redeco(); }
  return true;
}
/** ผลตรวจจริง: โครงสร้าง (ST.check) + ลำดับงาน (workflow.analyze) → ข้อความ + ตัวย่อสำหรับ prompt + วัตถุที่ต้องแก้ */
function aiChecks() {
  const d = hist.doc, S = d.struct || [], wf = wfAnalyze(d), f1 = (v) => (v / 1000).toFixed(1), pct = (a, b) => Math.round((a / Math.max(1, b)) * 100);
  const LV = { hi: "สำคัญ", md: "ควรแก้", lo: "แนะนำ" };
  const out = { failKeys: [], wfKeys: [], fails: 0, items: [] };
  if (S.length) {
    const c = ST.check(d), m = (r) => r.o.mark || "-";
    const rows = [
      ...c.beams.map((r) => ({ r, key: aiKey(r.o), u: pct(r.M, r.Mc), t: `คาน ${m(r)} ${r.o.w}×${r.o.d} ช่วง ${r.L.toFixed(2)} ม.: น้ำหนัก ${r.w.toLocaleString()} กก./ม. → M ${r.M.toLocaleString()} / Mc ${r.Mc.toLocaleString()} กก.-ม. (ใช้ ${pct(r.M, r.Mc)}%) · V ${r.V.toLocaleString()} กก. · เหล็กล่าง ${r.bars}` })),
      ...c.columns.map((r) => ({ r, key: aiKey(r.o), u: pct(r.P, r.Pa), t: `เสา ${m(r)} ${r.o.w}×${r.o.l || r.o.w}: P ${f1(r.P)} / รับได้ ${f1(r.Pa)} ตัน (ใช้ ${pct(r.P, r.Pa)}%)` })),
      ...c.footings.map((r) => ({ r, key: aiKey(r.o), u: pct(r.P, r.cap), t: `ฐานราก ${m(r)} ${r.o.w}×${r.o.l}: P ${f1(r.P)} / รับได้ ${f1(r.cap)} ตัน (ใช้ ${pct(r.P, r.cap)}%)` })),
      ...c.slabs.map((r) => ({ r, key: aiKey(r.o), u: pct(r.tmin, r.o.t), t: `พื้น ${m(r)} หนา ${r.o.t} มม. ช่อง ${r.span}: ต้องหนาอย่างน้อย ${r.tmin} มม.` })),
    ];
    const bad = rows.filter((x) => !x.r.ok), top = rows.filter((x) => x.r.ok).sort((a, b) => b.u - a.u)[0];
    const grp = new Map(); for (const x of bad) { const g = grp.get(x.t + x.r.msg); if (g) g.n++; else grp.set(x.t + x.r.msg, { ...x, n: 1 }); }   // ชิ้นเหมือนกัน (รหัส ขนาด ช่วง ผลเท่ากัน) รวมเป็น ×n
    const G = [...grp.values()].map((x) => ({ ...x, t: x.n > 1 ? `${x.t} ×${x.n} ชิ้น` : x.t }));
    out.fails = bad.length; out.failKeys = bad.map((x) => x.key); out.items = G;
    out.structText = `ตรวจโครงสร้างเบื้องต้น (WSD · ตัวเลขจากโปรแกรม): คาน ${c.beams.length} · เสา ${c.columns.length} · ฐานราก ${c.footings.length} · พื้น ${c.slabs.length} → ` +
      (bad.length ? `ไม่ผ่าน ${bad.length} ชิ้น\n` + G.slice(0, 6).map((x) => `• ${x.t} → ${x.r.msg}`).join("\n") + (G.length > 6 ? `\n• … อีก ${G.length - 6} รายการ (ดูตารางใน 🏗 โครงสร้าง)` : "")
        : `ผ่านทุกชิ้น${top ? `\nชิ้นที่รับแรงมากสุด: ${top.t}` : ""}`);
    out.structShort = `โครงสร้าง: คาน ${c.beams.length} เสา ${c.columns.length} ฐานราก ${c.footings.length} พื้น ${c.slabs.length} · ไม่ผ่าน ${bad.length}` + G.slice(0, 4).map((x) => ` | ${x.t} → ${x.r.msg}`).join("");
  } else {
    out.structText = "ยังไม่มีโครงสร้าง (เสา คาน ฐานราก) — สั่ง “สร้างเสา คาน” หรือเปิด 🏗 โครงสร้าง กด ⚙ สร้างโครงจากผนัง";
    out.structShort = "โครงสร้าง: ยังไม่มี";
  }
  for (const w of wf.warns) for (const a of w.actions) if (a.act.startsWith("select:")) out.wfKeys.push(a.act.slice(7));
  out.wfText = `ตรวจลำดับงาน: ${wf.steps.map((s, i) => `${s.state === "done" ? "✓" : i + 1} ${s.name}`).join(" → ")}\n` +
    (wf.warns.length ? `ข้อเตือน ${wf.warns.length} ข้อ (สำคัญ ${wf.hi})\n` + wf.warns.slice(0, 6).map((w) => `• [${LV[w.level]}] ${w.title} — ${w.detail}`).join("\n") : "ไม่มีข้อเตือน — ลำดับงานและข้อมูลในแบบตรงกัน");
  out.wfShort = `ลำดับงาน: ${wf.steps.map((s) => `${s.name}=${s.state}`).join(", ")} · เตือน ${wf.warns.length} (สำคัญ ${wf.hi})` + wf.warns.slice(0, 4).map((w) => ` | ${w.title}`).join("");
  out.wf = wf;
  return out;
}
/** อธิบายผลตรวจ: ทีละข้อ ตัวเลขจริง + สาเหตุ + วิธีแก้ (ข้อความวิธีแก้มาจากตัวตรวจของโปรแกรม) */
function aiExplain() {
  const c = aiChecks(), lines = [];
  if (!(hist.doc.struct || []).length && !c.wf.warns.length) return { text: "ยังไม่มีผลตรวจให้อธิบาย — วาดผนัง แล้วสร้างโครงสร้าง จากนั้นกด ✅ ตรวจงาน", keys: [] };
  if (c.fails) {
    lines.push(`โครงสร้างไม่ผ่าน ${c.fails} ชิ้น:`);
    for (const x of c.items.slice(0, 4)) {
      const k = x.r.o.kind;
      const why = k === "beam" ? "แรงดัดจากน้ำหนักพื้น + ผนัง + น้ำหนักคาน (M = wL²/8) มากกว่ากำลังที่หน้าตัดรับได้ (Mc)" : k === "column" ? "น้ำหนักจากปลายคานทุกชั้นที่ลงเสามากกว่าที่หน้าตัดเสารับได้" : k === "footing" ? "น้ำหนักจากเสามากกว่าที่ดิน/เข็มใต้ฐานรับได้" : "พื้นบางกว่าความหนาต่ำสุดตาม ว.ส.ท.";
      lines.push(`• ${x.t}\n  สาเหตุ: ${why}\n  วิธีแก้: ${x.r.msg}`);
    }
  } else if ((hist.doc.struct || []).length) lines.push("โครงสร้างผ่านการตรวจเบื้องต้นทุกชิ้น (ยังต้องให้วิศวกรตรวจรับรองก่อนก่อสร้าง)");
  if (c.wf.warns.length) {
    lines.push(`ลำดับงานมีข้อเตือน ${c.wf.warns.length} ข้อ:`);
    for (const w of c.wf.warns.slice(0, 4)) lines.push(`• ${w.title}: ${w.detail}${w.actions.length ? ` → ${w.actions.map((a) => a.label).join(" / ")}` : ""}`);
  }
  return { text: lines.join("\n"), keys: [...c.failKeys, ...c.wfKeys] };
}
/** สรุปวัสดุ/ปริมาณงาน (ST.quantities + M.summary — ค่าประมาณเพื่อประเมินราคา ไม่ใช่ BBS) */
function aiBom() {
  const d = hist.doc, s = M.summary(d), q = ST.quantities(d);
  const wallA = d.walls.reduce((a, w) => a + M.wallLength(w) * (w.height || 0), 0) / 1e6, openA = d.openings.reduce((a, o) => a + (o.width || 0) * (o.height || 0), 0) / 1e6;
  const f = (v, n = 2) => Number(v).toLocaleString(undefined, { maximumFractionDigits: n, minimumFractionDigits: n });
  const L = [`สรุปวัสดุ (โปรแกรมคำนวณจากแบบ · ค่าประมาณ ไม่ใช่ BBS):`,
    `• ผนัง ${s.walls} ช่วง ยาวรวม ${f(s.wallLengthM)} ม. · พื้นที่ผนังประมาณ ${f(Math.max(0, wallA - openA), 1)} ตร.ม. (หักช่องเปิด ${f(openA, 1)} ตร.ม.)`,
    `• ประตู ${s.doors} · หน้าต่าง ${s.windows} · พื้นที่ตามกรอบผนัง ${f(s.footprintM2)} ตร.ม. · ${s.levels} ชั้น`];
  if (q.rows.length) {
    L.push(`• คอนกรีตโครงสร้าง ${f(q.concrete)} ลบ.ม. · เหล็กเสริมประมาณ ${Math.round(q.steel).toLocaleString()} กก. · ไม้แบบประมาณ ${f(q.formwork, 1)} ตร.ม.`);
    for (const r of q.rows.slice(0, 8)) L.push(`  – ${ST.KINDS[r.kind]} ${r.mark} ${r.size} ×${r.n} = ${f(r.v)} ลบ.ม.`);
    if (q.rows.length > 8) L.push(`  – … อีก ${q.rows.length - 8} รายการ (ตารางเต็ม: 🏗 โครงสร้าง → ⬇ CSV)`);
  } else L.push("• ยังไม่มีโครงสร้าง — ปริมาณคอนกรีต/เหล็กยังคิดไม่ได้");
  L.push(s.pvCount ? `• แผงโซลาร์ ${s.pvCount} แผง × ${d.pv.watt} W = ${s.pvKwp} kWp` : "• ไม่มีแผงโซลาร์");
  return L.join("\n");
}
/** ออกแบบอัตโนมัติ 5 ขั้น (ตามขั้นของตรวจลำดับงาน) — แต่ละขั้นเสนอคำสั่งจากสถานะจริงของแบบ ผู้ใช้กด ทำ/ข้าม/หยุด เอง */
function aiAutoPlan() {
  const d = hist.doc, wf = wfAnalyze(d), s = M.summary(d), S = d.struct || [], walls = d.walls.length > 0;
  const fails = wf.warns.some((w) => w.id === "struct-fail"), need = "ต้องมีผนังก่อน — วาดห้องในผัง (หรือพิมพ์ เช่น “วาดห้อง 4x5”) แล้วกด ทำขั้นต่อไป";
  const plan5 = [
    walls ? { say: `มีผนังแล้ว ${d.walls.length} ช่วง (${s.wallLengthM} ม.) — วาดเพิ่มได้ หรือข้ามไปขั้นต่อไป`, actions: [] }
      : { say: "ยังไม่มีผนัง — เลือกเครื่องมือห้อง แล้วคลิก 2 มุมในผัง (หรือพิมพ์ในแชท เช่น “วาดห้อง 4x5”)", actions: [{ name: "wall.draw", params: { tool: "room" } }] },
    !walls ? { say: need, actions: [] } : d.roof.type === "none" ? { say: `ใส่หลังคาจั่ว (ความชันตามค่าในแบบ ${d.roof.pitch}°) แล้วเปิดมุมมอง 2D+3D`, actions: [{ name: "roof.set", params: { type: "gable" } }, { name: "view.set", params: { mode: "split" } }] }
      : { say: `มีหลังคา${ROOF_TH[d.roof.type] || ""} ${d.roof.pitch}° แล้ว — เปิดมุมมอง 2D+3D ดูโมเดล`, actions: [{ name: "view.set", params: { mode: "split" } }] },
    !walls ? { say: need, actions: [] } : !S.length ? { say: "สร้างเสา คาน ฐานรากจากผนัง แล้วตรวจขนาดเบื้องต้น", actions: [{ name: "struct.autoframe", params: {} }, { name: "struct.check", params: {} }] }
      : fails ? { say: "ตรวจโครงสร้างไม่ผ่าน — เปิดหน้าต่างโครงสร้างดูตาราง แล้วแก้ขนาดชิ้นที่ไม่ผ่าน (หรือพิมพ์ เช่น “คาน B1 20x50”)", actions: [{ name: "struct.check", params: {} }, { name: "struct.open", params: {} }] }
        : { say: "มีโครงสร้างแล้ว — ตรวจขนาดอีกครั้ง", actions: [{ name: "struct.check", params: {} }] },
    !walls ? { say: need, actions: [] } : !d.pv.enabled ? { say: "เปิดวางแผงโซลาร์อัตโนมัติบนหลังคา แล้วเปิดหน้าต่าง โซลาร์ + SLD (กดสร้าง SLD ในหน้าต่าง)", actions: [{ name: "pv.set", params: { on: true } }, { name: "solar.sld", params: {} }] }
      : { say: `แผง ${s.pvCount} แผง (${s.pvKwp} kWp) — เปิดหน้าต่าง โซลาร์ + SLD แล้วกด 📐 สร้าง SLD`, actions: [{ name: "solar.sld", params: {} }] },
    !walls ? { say: need, actions: [] } : { say: CLOUD ? "Plot PDF / ส่งออกแบบ" : "สร้างชุดแบบก่อสร้าง A3 (ผังพื้น รูปด้าน รูปตัด ตาราง) หรือ Plot PDF", actions: [{ name: CLOUD ? "plot.open" : "drawset.open", params: {} }] },
  ];
  return wf.steps.map((st, i) => ({ n: i + 1, total: wf.steps.length, name: st.name, state: st.state, info: st.info, warn: st.warn, ...plan5[i] }));
}

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
      ...(s.walls && !CLOUD ? [{ done: false, say: "สร้างชุดแบบก่อสร้าง A3: ผังพื้น รูปด้าน รูปตัด 3D ตาราง + IFC (ConstructCAD)", act: { tool: "press", key: "drawset", label: "📑 ชุดแบบ" } }] : []),
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
  // ผู้ช่วยสั่งงานจริง (ai/assistant.js เรียกหลังผู้ใช้กด ทำเลย) · เลิกทำ = คืนสภาพแบบก่อนกด ทำเลย
  run: (name, p) => aiRun(name, p),
  snapshot: () => JSON.stringify(hist.doc),
  restore(s) { hist.replace(JSON.parse(s)); plan.select(null); host.onChange(); syncLevels(); status("piBot: เลิกทำแล้ว — แบบกลับเป็นเหมือนก่อนกด ทำเลย"); },
  focus: (t) => aiFocus(t),
  checks: () => aiChecks(),
  explain: () => aiExplain(),
  bom: () => aiBom(),
  autoPlan: () => aiAutoPlan(),
};

start();
