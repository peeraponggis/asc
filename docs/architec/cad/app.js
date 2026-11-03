// CAD 2D ของ ASC Architect — เปิด/แก้/บันทึก DWG·DXF แบบ AutoCAD (โดย ลุงพี)
// เอกสารจริงอยู่ฝั่ง server (ezdxf) · หน้านี้ถือสำเนาวัตถุใน model space + จดสิ่งที่เปลี่ยน แล้วส่งไปตอนบันทึก
import * as G from "./geom.js?v=0.25.1";
import * as H from "./geom2.js?v=0.25.1";
import * as SY from "./symbols.js?v=0.25.1";
import * as UI from "./ribbon.js?v=0.25.1";
import { aciColor } from "../editor/cadlayer.js?v=0.25.1";
import { plotFormHTML, wirePlotForm, readPlotForm } from "../plotform.js?v=0.25.1";

const $ = (s) => document.querySelector(s);
const CLOUD = window.PA_MODE === "cloud";
const cv = $("#cv"), ctx = cv.getContext("2d");

// ---------------------------------------------------------------- สถานะ
const S = {
  doc: null, ents: new Map(), order: [], layers: new Map(), clayer: "0",
  sel: new Set(), undo: [], redo: [], touched: new Set(), layerCh: new Map(), dirty: false,
  view: { s: 1, ox: 0, oy: 0, dpr: 1, w: 0, h: 0 }, cursor: [0, 0], snap: null,
  osnap: true, ortho: false, seq: 0, cache: null, index: null, cmd: null, req: null, lastCmd: null, preview: null, win: null,
  grid: !!UI.store.get("grid", false), gsnap: !!UI.store.get("gsnap", false), gridMM: Number(UI.store.get("gridMM", 500)) || 500,
  anno: Number(UI.store.get("anno", 50)) || 50, symKey: null, dropPt: null, clip: null, clickSnap: null,
};
const isTemp = (h) => h.startsWith("~");
const RO_MSG = "ไฟล์ใหญ่เปิดแบบดูก่อน — กด ✂ แก้บางส่วน แล้วเลือก layer/พื้นที่ที่จะแก้";
const ink = () => getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#e6e9ed";

function toast(m) { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => (t.hidden = true), 3500); }
function log(m) { const h = $("#history"); h.textContent += (h.textContent ? "\n" : "") + m; h.scrollTop = h.scrollHeight; }
function prompt(m) { $("#prompt").textContent = m; }

// ---------------------------------------------------------------- เปิดเอกสาร
function load(d) {
  S.doc = d; S.ents.clear(); S.order = []; S.sel.clear(); S.undo = []; S.redo = []; S.touched.clear(); S.layerCh.clear();
  S.layers = new Map(d.layers.map((L) => [L.name, L]));
  S.clayer = S.layers.has(d.clayer) ? d.clayer : "0";
  for (const e of d.entities) { e.orig = true; S.ents.set(e.h, e); S.order.push(e.h); }
  S.dirty = false; S.cache = null; S.index = null; S.fitted = false; S.ro = !!d.readonly;
  $("#docname").textContent = d.name + (d.source === "dwg" ? " (DWG)" : "") + (S.ro ? " · ดูก่อน (ไฟล์ใหญ่)" : "") + (d.partial ? " · แก้บางส่วน" : "") + (d.asc ? " · ASC Studio" : "");
  $("#b-partial").hidden = !d.partial_ok;
  document.title = d.name + " · CAD 2D";
  $("#units").textContent = ({ 0: "หน่วย: ไม่ระบุ", 1: "นิ้ว", 2: "ฟุต", 4: "มม.", 5: "ซม.", 6: "ม." })[d.insunits] || `หน่วย ${d.insunits}`;
  $("#info").innerHTML = `ไฟล์: ${esc(d.file || "(ยังไม่บันทึก)")}<br>รุ่น DXF: ${d.version}<br>วัตถุใน model space: ${d.entities.length.toLocaleString()}<br>block: ${d.blocks.length}<br>` +
    `ตรวจไฟล์: แก้ ${d.audit.fixes} · ผิดพลาด ${d.audit.errors}<br>เปิดใช้เวลา ${d.seconds} วินาที` +
    (d.objects ? `<br>วัตถุทั้งไฟล์: ${d.objects.toLocaleString()}` : "") + (d.partial ? `<br>โหลดมาแก้: ${d.partial.count.toLocaleString()} วัตถุ (RAM ~${d.partial.ram_mb} MB)` : "") +
    (d.asc ? "<br>ไฟล์ของ ASC Studio — บันทึกเป็นสำเนาใน out/asc_studio/ (ไม่แก้ต้นฉบับ)" : "") + (d.note ? `<br><b>${esc(d.note)}</b>` : "");
  savedLabel(); renderLayers(); renderProps(); zoomExtents();
  log(`เปิด ${d.name}: ${d.entities.length.toLocaleString()} ${S.ro ? "กลุ่มเส้น" : "วัตถุ"} · ${d.layers.length} layer` + (d.cached ? " (จากแคช)" : ""));
  if (d.note) { log(d.note); if (S.ro) toast(d.note); }
  if (d.bin) fillView(d);
}

// ไฟล์ใหญ่: พิกัดเส้นมาเป็นไฟล์ไบนารี (float32) ถอดใน worker → ใส่ให้กลุ่มเส้นแต่ละกลุ่มตามลำดับ (subarray ไม่คัดลอก)
function viewBin(url) {
  return new Promise((res, rej) => {
    const w = new Worker("./viewbin.worker.js?v=0.25.1");
    w.onmessage = (m) => { w.terminate(); m.data.error ? rej(new Error(m.data.error)) : res(m.data); };
    w.onerror = (e) => { w.terminate(); rej(new Error(e.message || "โหลดเส้นไม่ได้")); };
    w.postMessage({ url });
  });
}
async function fillView(d) {
  const t0 = performance.now();
  prompt("กำลังโหลดเส้น…");
  try {
    const { counts, flags, xy, bytes } = await viewBin(d.bin);
    if (S.doc !== d) return;                                // เปิดไฟล์อื่นไปแล้ว
    let p = 0, o = 0;
    for (const e of d.entities) {
      if (e.n == null) continue;
      const arr = new Array(e.n);
      for (let k = 0; k < e.n; k++, p++) { const c = counts[p]; arr[k] = [xy.subarray(o, o + c), flags[p], e.c]; o += c; }
      e.d = arr; e.bb = null;
    }
    S.cache = null; S.index = null; S.loaded = performance.now() - t0; draw();
    log(`โหลดเส้น ${p.toLocaleString()} เส้น (${(bytes / 1048576).toFixed(1)} MB) ใน ${((performance.now() - t0) / 1000).toFixed(1)} วินาที`);
  } catch (e) { toast(e.message); log(e.message); }
  if (!S.cmd) prompt("คำสั่ง:");
}
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function savedLabel() { $("#saved").textContent = S.dirty ? "● ยังไม่บันทึก" : S.doc && S.doc.file ? "บันทึกแล้ว" : ""; }

async function api(path, body) {
  const r = await fetch(path, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

async function openPath(path) {
  dlgMsg(`กำลังเปิด ${path}… (DWG/ไฟล์ใหญ่ใช้เวลาหลายนาที)`);
  try { const d = await api("/api/cad/open", { path }); closeDlg(); load(d); history.replaceState(null, "", "?file=" + encodeURIComponent(path)); }
  catch (e) { dlgMsg("เปิดไม่ได้: " + e.message); log("เปิดไม่ได้: " + e.message); }
}

async function openDialog() {
  if (CLOUD) return toast("CAD 2D ต้องใช้รุ่นในเครื่อง (ASC Architect ในเครื่อง)");
  showDlg("เปิดไฟล์ CAD", "ไฟล์ .dwg / .dxf / .pdf (แบบจาก CAD) ใน ASC Architect (รวมโครงการ) และทุกโฟลเดอร์ของ ASC Studio · หรือเลือกจากเครื่อง");
  const body = $("#dlg-body");
  body.innerHTML = '<label class="row"><button id="up-btn">เลือกไฟล์จากเครื่อง…</button><input type="file" id="up" accept=".dwg,.dxf,.pdf" hidden></label><div class="muted small">กำลังค้นไฟล์…</div>';
  $("#up-btn").onclick = () => $("#up").click();
  $("#up").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    dlgMsg(`กำลังส่ง ${f.name}…`);
    const r = await fetch("/api/cad/upload?name=" + encodeURIComponent(f.name), { method: "POST", body: f });
    const j = await r.json(); if (!r.ok) return dlgMsg(j.error || "ส่งไม่สำเร็จ");
    openPath(j.path);
  };
  try {
    const r = await api("/api/cad/files");
    const conv = Object.keys(r.converters);
    $("#dlg-note").textContent = conv.length ? `ตัวแปลง DWG: ${conv.join(", ")}` : "ยังไม่มีตัวแปลง DWG — เปิดได้เฉพาะ DXF (ดู INSTALL-APPS.md)";
    const big = r.edit_limit || 50 * 1048576;
    const btn = (f, label) => `<button data-path="${esc(f.path)}" data-q="${esc(f.path.toLowerCase())}"><span>${f.kind === "dwg" ? "📐" : "📄"} ${esc(label)}` +
      `${f.dxf ? ' <small class="muted">(มี DXF ที่แปลงไว้)</small>' : ""}</span><small class="muted">${(f.size / 1048576).toFixed(1)} MB${f.kind === "dxf" && f.size > big ? " · ไฟล์ใหญ่: ดูก่อน แก้บางส่วนได้" : ""}</small></button>`;
    const own = r.files.filter((f) => !f.library && !f.asc), groups = new Map();
    for (const f of r.files.filter((x) => x.asc)) { if (!groups.has(f.asc)) groups.set(f.asc, []); groups.get(f.asc).push(f); }
    body.lastElementChild.outerHTML = '<input id="dlg-q" type="search" placeholder="ค้นชื่อไฟล์…" style="width:100%;margin:6px 0">' +
      `<details open><summary><b>ASC Architect</b> (${own.length})</summary>${own.map((f) => btn(f, f.path)).join("") || '<p class="muted">ไม่มี</p>'}</details>` +
      [...groups].map(([g, fs]) => `<details><summary><b>ASC Studio · ${esc(g)}</b> (${fs.length})</summary>${fs.map((f) => btn(f, f.path.slice(4 + g.length + 1) || f.name)).join("")}</details>`).join("");
    body.querySelectorAll("button[data-path]").forEach((b) => (b.onclick = () => openPath(b.dataset.path)));
    $("#dlg-q").oninput = (e) => { const q = e.target.value.trim().toLowerCase();
      body.querySelectorAll("button[data-path]").forEach((b) => (b.hidden = q && !b.dataset.q.includes(q)));
      body.querySelectorAll("details").forEach((d) => { if (q) d.open = [...d.querySelectorAll("button[data-path]")].some((b) => !b.hidden); }); };
  } catch (e) { dlgMsg(e.message); }
}

function showDlg(title, note) { $("#dlg-title").textContent = title; $("#dlg-note").textContent = note || ""; $("#dlg-msg").textContent = ""; $("#dlg").hidden = false; }
function closeDlg() { $("#dlg").hidden = true; }
function dlgMsg(m) { $("#dlg-msg").textContent = m; }
$("#dlg-close").onclick = closeDlg;

// ---------------------------------------------------------------- บันทึก
function buildChanges() {
  const ch = { layers: [...S.layerCh.values()], clayer: S.clayer, deleted: [], modified: [], copies: [], added: [] }, temps = { added: [], copies: [] }, defs = new Map();
  for (const h of S.touched) {
    const e = S.ents.get(h);
    if (isTemp(h)) {
      if (!e) continue;
      if (e.mk) { ch.makeblocks = ch.makeblocks || []; ch.makeblocks.push({ ...e.mk, l: e.l }); continue; }
      if (e.from) { ch.copies.push({ from: e.from, m: e.m, l: e.l, c: e.c, ...(attrsOf(e) ? { attrs: attrsOf(e) } : {}) }); temps.copies.push(h); }
      else {
        ch.added.push({ t: e.t, l: e.l, c: e.c, g: e.g, ...(e.attrs ? { attrs: e.attrs } : {}) }); temps.added.push(h);
        if (e.def) defs.set(e.def.name, e.def);                 // สัญลักษณ์จากคลัง: สร้าง block ครั้งเดียวต่อไฟล์
      }
    } else if (!e) ch.deleted.push(h);
    else {
      const m = { h, l: e.l, c: e.c };
      if (e.explode) m.explode = true;
      if (e.g && e.t !== "INSERT") m.g = e.g;
      if (e.m && (!e.g || e.t === "INSERT")) m.m = e.m;
      if (e.attrs) m.attrs = e.attrs;
      ch.modified.push(m);
    }
  }
  if (defs.size) ch.blockdefs = [...defs.values()];
  return { ch, temps };
}

async function save(asNew) {
  if (!S.doc) return;
  if (S.ro) return toast(RO_MSG);
  let target = null, fmt = null;
  if (asNew || !S.doc.file) {
    const def = (S.doc.file || "out/แบบใหม่.dwg").replace(/^asc\//, "out/asc_studio/").replace(/\.(dwg|dxf)$/i, "");
    showDlg("บันทึกเป็น", "ที่อยู่ภายในโฟลเดอร์ของ ASC Architect · เลือกรูปแบบไฟล์");
    $("#dlg-body").innerHTML = `<div class="row"><input type="text" id="sv-name" value="${esc(def)}"><select id="sv-fmt"><option value="dwg">.dwg</option><option value="dxf">.dxf</option></select><button id="sv-go">บันทึก</button></div>`;
    $("#sv-fmt").value = (S.doc.file || "").toLowerCase().endsWith(".dxf") ? "dxf" : "dwg";
    await new Promise((res) => ($("#sv-go").onclick = res));
    fmt = $("#sv-fmt").value; target = $("#sv-name").value.trim() + "." + fmt;
  }
  const { ch, temps } = buildChanges();
  const dwg = (fmt || (S.doc.file || "").split(".").pop().toLowerCase()) === "dwg";
  const slow = dwg && S.doc.partial ? " (DWG ของไฟล์ใหญ่ใช้หลายนาที — แปลงแล้วตรวจซ้ำ เช่น 190 MB ~4 นาที)" : "";
  dlgMsg("กำลังบันทึก…" + slow); log("กำลังบันทึก…" + slow);
  try {
    const r = await api("/api/cad/save", { id: S.doc.id, changes: ch, target, format: fmt });
    await synced(r, temps);
    S.dirty = false;
    S.doc.file = r.saved; S.doc.name = r.saved.split("/").pop();
    $("#docname").textContent = S.doc.name; closeDlg(); savedLabel(); S.cache = null; draw();
    log(`บันทึก ${r.saved} (${r.via})` + (r.backup ? ` · สำรองไฟล์เดิมไว้ที่ ${r.backup}` : ""));
    toast(`บันทึก ${r.saved} แล้ว (${r.via})`);
    if (r.warn) { log("⚠ " + r.warn); toast("⚠ " + r.warn); }
    history.replaceState(null, "", "?file=" + encodeURIComponent(r.saved));
  } catch (e) { dlgMsg("บันทึกไม่สำเร็จ: " + e.message); log("บันทึกไม่สำเร็จ: " + e.message); if ($("#dlg").hidden) toast("บันทึกไม่สำเร็จ: " + e.message); }
}

// server ใช้ส่วนที่แก้กับเอกสารแล้ว (บันทึก / Plot) → วัตถุใหม่ได้ handle จริง · ล้างเมทริกซ์ที่ส่งไปแล้ว
async function synced(r, temps) {
  const remap = new Map();
  temps.added.forEach((h, i) => r.added[i] && remap.set(h, r.added[i]));
  temps.copies.forEach((h, i) => r.copies[i] && remap.set(h, r.copies[i]));
  for (const [tmp, real] of remap) { const e = S.ents.get(tmp); S.ents.delete(tmp); e.h = real; e.orig = true; delete e.from; S.ents.set(real, e); }
  S.order = S.order.map((h) => remap.get(h) || h);
  S.sel = new Set([...S.sel].map((h) => remap.get(h) || h));
  for (const e of S.ents.values()) { if (e.m) e.m = null; if (e.def) delete e.def; }
  S.touched.clear(); S.layerCh.clear(); S.undo = []; S.redo = [];
  if (S.clip && S.clip.cut && !S.clip.used) { S.clip = null; log("ล้างคลิปบอร์ดที่ตัดไว้ (บันทึกแล้ว)"); }
  if (r.refresh) {                                       // แตก block / สร้าง block → อ่านรายการวัตถุจาก server ใหม่ (คงมุมมองเดิม)
    const v = { ...S.view }, lst = await api("/api/cad/listing", { id: S.doc.id });
    const faint = S.order.map((h) => S.ents.get(h)).filter((e) => e && e.ro);   // แก้บางส่วน: ส่วนจางไม่ได้อยู่ในเอกสารฝั่ง server
    S.ents.clear(); S.order = []; S.sel.clear();
    for (const e of [...faint, ...lst.entities]) { e.orig = true; S.ents.set(e.h, e); S.order.push(e.h); }
    S.doc.blocks = lst.blocks; S.view = v; S.index = null;
  }
}

// ---------------------------------------------------------------- Plot PDF (ขั้นที่ 4)
function plotDialog() {
  if (S.ro || S.doc.partial) { toast("ไฟล์ใหญ่ (ดูก่อน/แก้บางส่วน) — plot ทั้งแบบไม่ได้ (พิมพ์จาก AutoCAD/ZWCAD)"); return Promise.resolve(null); }
  showDlg("🖨 Plot เป็น PDF", "กระดาษแนวนอน + กรอบแบบ/กรอบชื่อ กฟน./กฟภ. · แบบอยู่ในพื้นที่ซ้ายของคอลัมน์กรอบชื่อ · PDF เวกเตอร์เก็บที่ out\\plots");
  const title = (S.doc.name || "แบบใหม่").replace(/\.(dwg|dxf)$/i, "");
  $("#dlg-body").innerHTML = plotFormHTML([["all", "ทั้งแบบ (extents)"], ["view", "เท่าที่เห็นบนจอ"], ["window", "เลือกกรอบ 2 จุด…"]], { DWG_TITLE: title })
    + '<button id="pl-go" class="go">🖨 สร้าง PDF</button>';
  wirePlotForm($("#dlg-body"));
  return new Promise((res) => {
    const close = $("#dlg-close"), prev = close.onclick;
    $("#pl-go").onclick = () => { close.onclick = prev; res(readPlotForm($("#dlg-body"))); };
    close.onclick = () => { close.onclick = prev; closeDlg(); res(null); };
  });
}
async function doPlot(o) {
  const { ch, temps } = buildChanges();
  dlgMsg("กำลังสร้าง PDF…"); log(`กำลัง plot ${o.paper}…`);
  const r = await api("/api/cad/plot", { id: S.doc.id, changes: ch, ...o });
  await synced(r, temps);                                // เอกสารฝั่ง server มีส่วนที่แก้แล้ว (ยังไม่ได้บันทึกลงไฟล์)
  S.cache = null; draw();
  const warn = r.clipped ? "⚠ แบบใหญ่กว่ากระดาษที่มาตราส่วนนี้ — ส่วนเกินถูกตัด (ลองมาตราส่วนเล็กลงหรือกระดาษใหญ่ขึ้น)" : "";
  log(`Plot ${r.paper} มาตราส่วน ${r.scale} → ${r.pdf}` + (warn ? " · " + warn : ""));
  showDlg("🖨 Plot เสร็จ", `${r.paper} · มาตราส่วน ${r.scale} · ไฟล์ ${r.pdf}`);   // ลิงก์ให้กดเอง (เบราว์เซอร์บล็อกการเปิดแท็บอัตโนมัติ)
  $("#dlg-body").innerHTML = `<a class="go btnlink" href="${esc(r.url)}" target="_blank" rel="noopener">📄 เปิด PDF</a>` + (warn ? `<p class="small">${warn}</p>` : "");
  return r;
}

// ---------------------------------------------------------------- แก้เอกสาร (ทุกการแก้ผ่านที่นี่ → undo ได้)
function commit(label, changes, layerChange) {
  if (S.ro) { toast(RO_MSG); return; }
  changes = changes.filter(([h]) => !(S.ents.get(h) || {}).ro);     // ส่วนจาง (ไม่ได้โหลดมาแก้) แก้/ลบไม่ได้เด็ดขาด
  if (!changes.length && !layerChange) return;
  const before = new Map(), after = new Map();
  for (const [h, e] of changes) { if (!before.has(h)) before.set(h, S.ents.get(h) || null); after.set(h, e); }
  apply(after);
  S.undo.push({ label, before, after, layers: layerChange || null }); S.redo = [];
  if (S.undo.length > 300) S.undo.shift();
  touched(); log(label);
}
function apply(map) {
  for (const [h, e] of map) {
    if (e) { if (!S.ents.has(h)) S.order.push(h); S.ents.set(h, e); } else { S.ents.delete(h); S.sel.delete(h); }
    S.touched.add(h);
  }
}
function touched() { S.dirty = true; S.cache = null; S.index = null; savedLabel(); renderProps(); draw(); }
function undo() { const op = S.undo.pop(); if (!op) return log("ไม่มีอะไรให้ย้อน"); apply(op.before); if (op.layers) restoreLayers(op.layers.before); S.redo.push(op); touched(); log("ย้อน: " + op.label); }
function redo() { const op = S.redo.pop(); if (!op) return; apply(op.after); if (op.layers) restoreLayers(op.layers.after); S.undo.push(op); touched(); log("ทำซ้ำ: " + op.label); }
const tempH = () => "~" + ++S.seq;

function newEntity(t, g) {
  const L = S.layers.get(S.clayer) || { color: 7 };
  const disp = G.displayOf(t, g, S.doc.tol || 0.01, 256) || { d: [], x: [] };   // มิติ/hatch: ผู้เรียกใส่เส้นแสดงผลเอง
  return { h: tempH(), t, l: S.clayer, c: 256, g, d: disp.d, x: disp.x, orig: false, layerColor: L.color };
}
function transformSel(m, copy, label) {
  const ch = [];
  for (const h of S.sel) {
    const e = S.ents.get(h); if (!e) continue;
    const n = G.transformEntity(e, m);
    if (copy) { n.h = tempH(); n.orig = false; if ((!e.g || e.t === "INSERT")) n.from = e.orig ? e.h : e.from; if (n.g && e.t !== "INSERT") delete n.from; }
    ch.push([n.h, n]);
  }
  if (!ch.length) return;
  commit(`${label} ${ch.length} วัตถุ`, ch);
  if (copy) S.sel = new Set(ch.map(([h]) => h));
}

// ---------------------------------------------------------------- วาด
function colorOf(e) {
  let c = e.c;
  if (c === 256 || c == null) c = (S.layers.get(e.l) || {}).color ?? 7;
  if (c === 0) c = 7;
  return aciColor(Math.abs(c), ink());
}
function visible(e) { const L = S.layers.get(e.l); return !L || (L.on !== false && !L.frozen); }

// ภาพในแบบ (วัตถุ IMAGE เช่น ภาพจาก PDF) — โหลดครั้งเดียว วาดใต้เส้นทั้งหมด
const IMGS = new Map();
function imgOf(url) {
  let im = IMGS.get(url);
  if (!im) { im = new Image(); im.onload = draw; im.src = url; IMGS.set(url, im); }
  return im.complete && im.naturalWidth ? im : null;
}
function paintImage(e) {
  const im = e.img && imgOf(e.img), f = e.d[0] && e.d[0][0]; if (!im || !f || f.length < 8) return;
  const W = im.naturalWidth, H = im.naturalHeight;          // กรอบ: ล่างซ้าย ล่างขวา บนขวา บนซ้าย → แกนภาพ x = บนซ้าย→บนขวา · y (ลง) = บนซ้าย→ล่างซ้าย
  ctx.save(); ctx.transform((f[4] - f[6]) / W, (f[5] - f[7]) / W, (f[0] - f[6]) / H, (f[1] - f[7]) / H, f[6], f[7]);
  ctx.drawImage(im, 0, 0); ctx.restore();
}

function buildCache() {
  const solid = new Map(), faint = new Map(), texts = [], images = [];
  S.fills = new Map();
  for (const h of S.order) {
    const e = S.ents.get(h); if (!e || !visible(e)) continue;
    if (e.img) images.push(e);
    const col = colorOf(e), groups = e.ro ? faint : solid;          // ro = ส่วนที่ไม่ได้โหลดมาแก้ (วาดจาง)
    let p = groups.get(col); if (!p) { p = new Path2D(); groups.set(col, p); }
    for (const [f, cl, sc, fill] of e.d) {
      if (fill) { let fp = S.fills.get(col); if (!fp) S.fills.set(col, (fp = new Path2D())); fp.moveTo(f[0], f[1]); for (let i = 2; i < f.length; i += 2) fp.lineTo(f[i], f[i + 1]); fp.closePath(); continue; }
      const pp = sc && sc !== 256 && sc !== 0 && sc !== e.c ? subPath(groups, aciColor(Math.abs(sc), ink())) : p;
      pp.moveTo(f[0], f[1]); for (let i = 2; i < f.length; i += 2) pp.lineTo(f[i], f[i + 1]); if (cl) pp.closePath();
    }
    for (const t of e.x || []) texts.push([t, col, h, e.ro]);
  }
  S.cache = { groups: solid, faint, texts, images };
}
function subPath(groups, col) { let p = groups.get(col); if (!p) { p = new Path2D(); groups.set(col, p); } return p; }

function buildIndex() {
  const ex = extents(); const size = Math.max(ex[2] - ex[0], ex[3] - ex[1], 1) / 256;
  const cells = new Map(), big = [];
  for (const [h, e] of S.ents) {
    if (!visible(e)) continue;
    const b = (e.bb = G.bboxOf(e));
    const i0 = Math.floor(b[0] / size), i1 = Math.floor(b[2] / size), j0 = Math.floor(b[1] / size), j1 = Math.floor(b[3] / size);
    if ((i1 - i0 + 1) * (j1 - j0 + 1) > 64) { big.push(h); continue; }
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = i + "," + j; let a = cells.get(k); if (!a) cells.set(k, (a = [])); a.push(h); }
  }
  S.index = { size, cells, big };
}
function near(p, r) {
  if (!S.index) buildIndex();
  const { size, cells, big } = S.index, out = new Set(big);
  const i0 = Math.floor((p[0] - r) / size), i1 = Math.floor((p[0] + r) / size), j0 = Math.floor((p[1] - r) / size), j1 = Math.floor((p[1] + r) / size);
  if ((i1 - i0 + 1) * (j1 - j0 + 1) > 400) return [...S.ents.keys()];
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (const h of cells.get(i + "," + j) || []) out.add(h);
  return [...out];
}

function extents() {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const e of S.ents.values()) { if (!visible(e)) continue; const b = e.bb || (e.bb = G.bboxOf(e));
    if (b[0] < x0) x0 = b[0]; if (b[1] < y0) y0 = b[1]; if (b[2] > x1) x1 = b[2]; if (b[3] > y1) y1 = b[3]; }
  if (isFinite(x0)) return [x0, y0, x1, y1];
  const k = S.anno * SY.unitFactor(S.doc && S.doc.insunits);          // แบบว่าง: ดูพื้นที่เท่ากระดาษ A3 ตามมาตราส่วนสัญลักษณ์
  return [0, 0, 420 * k, 297 * k];
}

function resize() {
  const r = cv.getBoundingClientRect(), v = S.view;
  v.dpr = window.devicePixelRatio || 1; v.w = r.width; v.h = r.height;
  cv.width = Math.round(r.width * v.dpr); cv.height = Math.round(r.height * v.dpr);
  if (S.doc && !S.fitted && r.width > 0) { zoomExtents(); return; }   // เปิดไฟล์ตอนหน้าต่างยังไม่มีขนาด → จัดมุมมองเมื่อมีขนาดแล้ว
  draw();
}
function zoomExtents() {
  // ครั้งแรกที่เปิด: ใช้กรอบหลักจาก server (ไม่ให้เส้นหลงทางไกล ๆ ทำให้แบบเล็กจนมองไม่เห็น) · ZOOM E ภายหลัง = ทั้งหมด
  const [x0, y0, x1, y1] = !S.fitted && S.doc && S.doc.view ? S.doc.view : extents(), v = S.view, pad = 30;
  if (!(v.w > 0)) return;
  S.fitted = true;
  const s = Math.min((v.w - 2 * pad) / Math.max(x1 - x0, 1e-6), (v.h - 2 * pad) / Math.max(y1 - y0, 1e-6));
  v.s = isFinite(s) && s > 0 ? s : 1;
  v.ox = (v.w - (x1 - x0) * v.s) / 2 - x0 * v.s; v.oy = (v.h + (y1 - y0) * v.s) / 2 + y0 * v.s;
  draw();
}
const toW = (x, y) => [(x - S.view.ox) / S.view.s, (S.view.oy - y) / S.view.s];
const toS = (p) => [S.view.ox + p[0] * S.view.s, S.view.oy - p[1] * S.view.s];

let raf = 0;
function draw() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint(); }); }
function paint() {
  const v = S.view;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
  if (!S.doc) return;
  if (!S.cache) buildCache();
  if (S.grid) drawGrid();
  ctx.setTransform(v.s * v.dpr, 0, 0, -v.s * v.dpr, v.ox * v.dpr, v.oy * v.dpr);
  ctx.lineWidth = 1 / v.s; ctx.lineJoin = ctx.lineCap = "round";
  for (const e of S.cache.images) paintImage(e);
  for (const [col, p] of S.fills || []) { ctx.fillStyle = col; ctx.globalAlpha = 0.85; ctx.fill(p, "evenodd"); ctx.globalAlpha = 1; }
  ctx.globalAlpha = 0.3;
  for (const [col, p] of S.cache.faint) { ctx.strokeStyle = col; ctx.stroke(p); }
  ctx.globalAlpha = 1;
  for (const [col, p] of S.cache.groups) { ctx.strokeStyle = col; ctx.stroke(p); }
  for (const [[x, y, h, rot, s], col, , ro] of S.cache.texts) {
    if (h * v.s < 2.5) continue;
    ctx.save(); ctx.translate(x, y); ctx.rotate((rot * Math.PI) / 180); ctx.scale(1, -1);
    ctx.globalAlpha = ro ? 0.3 : 1; ctx.fillStyle = col; ctx.font = `${h * 1.35}px Tahoma, sans-serif`;
    s.split("\n").forEach((line, i) => ctx.fillText(line, 0, i * h * 1.6));
    ctx.restore();
  }
  // ที่เลือก
  if (S.sel.size) {
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--sel").trim(); ctx.lineWidth = 2.5 / v.s; ctx.setLineDash([6 / v.s, 4 / v.s]);
    for (const h of S.sel) { const e = S.ents.get(h); if (!e) continue; strokeEnt(e); }
    ctx.setLineDash([]);
  }
  // ตัวอย่างระหว่างสั่งคำสั่ง
  if (S.preview) {
    ctx.strokeStyle = "#e8892b"; ctx.lineWidth = 1.5 / v.s;
    for (const e of S.preview) strokeEnt(e);
  }
  ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
  if (S.win) { // กรอบเลือก: ซ้าย→ขวา = เต็มกรอบ (ฟ้า) · ขวา→ซ้าย = แตะกรอบ (เขียว ประ)
    const [a, b] = S.win, cross = b[0] < a[0];
    ctx.fillStyle = cross ? "rgba(60,180,90,.15)" : "rgba(60,120,220,.15)"; ctx.strokeStyle = cross ? "#3cb45a" : "#3c78dc";
    ctx.setLineDash(cross ? [5, 4] : []); ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); ctx.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); ctx.setLineDash([]);
  }
  if (!S.req) for (const gp of grips()) { const [x, y] = toS(gp.p); ctx.fillStyle = S.grip && S.grip.key === gp.key ? "#e8392b" : "#3d8bfd"; ctx.fillRect(x - 4, y - 4, 8, 8); }
  if (S.snap) { const [x, y] = toS(S.snap.p); ctx.strokeStyle = "#ffcc00"; ctx.lineWidth = 2;
    ctx.beginPath();
    if (S.snap.kind === "end") ctx.rect(x - 6, y - 6, 12, 12);
    else if (S.snap.kind === "mid") { ctx.moveTo(x, y - 7); ctx.lineTo(x + 7, y + 6); ctx.lineTo(x - 7, y + 6); ctx.closePath(); }
    else if (S.snap.kind === "center") ctx.arc(x, y, 7, 0, 7);
    else if (S.snap.kind === "int") { ctx.moveTo(x - 7, y - 7); ctx.lineTo(x + 7, y + 7); ctx.moveTo(x + 7, y - 7); ctx.lineTo(x - 7, y + 7); }
    else if (S.snap.kind === "perp") { ctx.moveTo(x - 7, y + 7); ctx.lineTo(x + 7, y + 7); ctx.moveTo(x - 4, y + 7); ctx.lineTo(x - 4, y - 7); ctx.moveTo(x - 4, y); ctx.lineTo(x + 3, y); ctx.lineTo(x + 3, y + 7); }
    else if (S.snap.kind === "near") { ctx.moveTo(x - 7, y - 7); ctx.lineTo(x + 7, y - 7); ctx.lineTo(x - 7, y + 7); ctx.lineTo(x + 7, y + 7); ctx.closePath(); }
    else { ctx.moveTo(x - 7, y); ctx.lineTo(x, y - 7); ctx.lineTo(x + 7, y); ctx.lineTo(x, y + 7); ctx.closePath(); }
    ctx.stroke(); }
  if (S.hover) { const [cx, cy] = toS(S.cursor); UI.drawCursor(ctx, cx, cy, v.w, v.h, ink(), !S.req || S.req.kind === "select" || S.req.kind === "pick"); }
}
/** กริดบนจอ (F7) — ระยะตามช่องกริดที่แถบล่าง (มม. × หน่วยแบบ) · ถี่เกินจะขยายทีละ ×5 */
function drawGrid() {
  const v = S.view; let step = S.gridMM * SY.unitFactor(S.doc && S.doc.insunits); if (!(step > 0) || !(v.s > 0)) return;
  while (step * v.s < 10) step *= 5;
  const a = toW(0, v.h), b = toW(v.w, 0), css = getComputedStyle(document.documentElement);
  ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0); ctx.lineWidth = 1;
  for (const [st, al] of [[step, 0.07], [step * 5, 0.14]]) {
    ctx.strokeStyle = ink(); ctx.globalAlpha = al; ctx.beginPath();
    for (let x = Math.floor(a[0] / st) * st; x <= b[0]; x += st) { const sx = Math.round(toS([x, 0])[0]) + 0.5; ctx.moveTo(sx, 0); ctx.lineTo(sx, v.h); }
    for (let y = Math.floor(a[1] / st) * st; y <= b[1]; y += st) { const sy = Math.round(toS([0, y])[1]) + 0.5; ctx.moveTo(0, sy); ctx.lineTo(v.w, sy); }
    ctx.stroke();
  }
  ctx.globalAlpha = 1; void css;
}
function strokeEnt(e) {
  for (const [f, cl] of e.d) { ctx.beginPath(); ctx.moveTo(f[0], f[1]); for (let i = 2; i < f.length; i += 2) ctx.lineTo(f[i], f[i + 1]); if (cl) ctx.closePath(); ctx.stroke(); }
  for (const [x, y, h, , s] of e.x || []) { const w = (s.length || 1) * h * 0.7; ctx.strokeRect(x, y, w, h); }
}

// ---------------------------------------------------------------- จับจุด + เลือก
function osnapAt(p, skip) {
  if (!S.osnap) return null;
  const tol = 12 / S.view.s; let best = null;
  const consider = (q, kind, rank) => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < tol && (!best || rank < best.rank || (rank === best.rank && d < best.d))) best = { p: q, kind, d, rank }; };
  const ents = near(p, tol).map((h) => S.ents.get(h)).filter((e) => e && visible(e) && e.h !== skip).slice(0, 60);
  for (const e of ents) { for (const sp of G.snapPoints(e)) consider(sp.p, sp.kind, sp.kind === "end" ? 0 : sp.kind === "mid" || sp.kind === "center" ? 1 : 2); for (const q of pinsOf(e)) consider(q, "pin", -1); }
  if (!best || best.rank > 0) for (let i = 0; i < ents.length; i++) for (const q of H.intersections(ents[i], ents.slice(i + 1, i + 12))) consider(q, "int", 0.5);
  const R = S.req;
  if (!best && R && R.base) for (const e of ents) for (const q of H.perpendicular(e, R.base)) consider(q, "perp", 3);
  if (!best) for (const e of ents) { const q = H.nearest(e, p); if (q) consider(q, "near", 4); }
  return best;
}
function pick(p) {
  const tol = 6 / S.view.s; let best = null;
  for (const h of near(p, tol)) { const e = S.ents.get(h); if (!e || locked(e)) continue; const d = G.distTo(e, p); if (d <= tol && (!best || d < best.d)) best = { h, d }; }
  return best && best.h;
}
const locked = (e) => e.ro || (S.layers.get(e.l) || {}).locked;
function windowSelect(a, b) {
  const [x0, x1] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])], [y0, y1] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])], cross = b[0] < a[0];
  const out = [];
  for (const [h, e] of S.ents) {
    if (!visible(e) || locked(e)) continue;
    const bb = e.bb || (e.bb = G.bboxOf(e));
    const inside = bb[0] >= x0 && bb[2] <= x1 && bb[1] >= y0 && bb[3] <= y1;
    const touch = !(bb[2] < x0 || bb[0] > x1 || bb[3] < y0 || bb[1] > y1);
    if (inside || (cross && touch)) out.push(h);
  }
  return out;
}

// ---------------------------------------------------------------- คำสั่ง (generator: yield คำขอ → ได้คำตอบ)
const ask = {
  point: (msg, base, preview) => ({ kind: "point", msg, base, preview }),
  select: (msg) => ({ kind: "select", msg }),
  num: (msg, def, base, preview) => ({ kind: "num", msg, def, base, preview }),
  text: (msg, def) => ({ kind: "text", msg, def }),
  pick: (msg) => ({ kind: "pick", msg }),
  wait: (promise, msg) => ({ kind: "wait", msg, promise }),
};
const ln = (a, b) => ({ d: [[[...a, ...b], 0]], x: [] });
const ALIAS = { L: "LINE", PL: "PLINE", REC: "RECTANG", C: "CIRCLE", A: "ARC", T: "TEXT", DT: "TEXT", M: "MOVE", CO: "COPY", CP: "COPY", RO: "ROTATE",
  SC: "SCALE", CAL: "CAL", MI: "MIRROR", E: "ERASE", ZE: "ZE", Z: "ZE", U: "U", OPEN: "OPEN", NEW: "NEW", SAVE: "SAVE", SAVEAS: "SAVEAS", REDO: "REDO", LA: "LAYER",
  PARTIALOPEN: "PARTIAL", PARTIALLOAD: "PARTIAL" };

const CMDS = {
  *LINE() {
    let p0 = yield ask.point("LINE จุดแรก:"); if (!p0) return;
    const first = p0; let n = 0;
    for (;;) {
      const p1 = yield ask.point(`จุดถัดไป [C=ปิด · U=ย้อน · Enter=จบ]:`, p0, (c) => [ln(p0, c)]);
      if (p1 === "C" && n > 1) { commit("LINE", [[tempH(), newEntity("LINE", { a: p0, b: first })]]); return; }
      if (p1 === "U") { undo(); continue; }
      if (!p1 || typeof p1 === "string") return;
      const e = newEntity("LINE", { a: p0, b: p1 }); commit("LINE", [[e.h, e]]); p0 = p1; n++;
    }
  },
  *PLINE() {
    const pts = []; let p = yield ask.point("PLINE จุดแรก:"); if (!p) return; pts.push(p);
    for (;;) {
      const q = yield ask.point(`จุดถัดไป [C=ปิด · Enter=จบ]:`, pts[pts.length - 1], (c) => [{ d: [[[...pts.flat(), ...c], 0]], x: [] }]);
      if (q === "C") { if (pts.length > 2) addPline(pts, true); return; }
      if (!q || typeof q === "string") { if (pts.length > 1) addPline(pts, false); return; }
      pts.push(q);
    }
  },
  *RECTANG() {
    const a = yield ask.point("RECTANG มุมแรก:"); if (!a) return;
    const b = yield ask.point("มุมตรงข้าม (หรือ @กว้าง,สูง):", a, (c) => [rectDisp(a, c)]); if (!b || typeof b === "string") return;
    addPline([a, [b[0], a[1]], b, [a[0], b[1]]], true);
  },
  *CIRCLE() {
    const c = yield ask.point("CIRCLE จุดศูนย์กลาง:"); if (!c) return;
    const r = yield ask.num("รัศมี (หรือคลิกจุดบนวง):", null, c, (q) => [G.displayOf("CIRCLE", { c, r: Math.hypot(q[0] - c[0], q[1] - c[1]) }, tol())]);
    if (!(r > 0)) return;
    const e = newEntity("CIRCLE", { c, r }); commit("CIRCLE", [[e.h, e]]);
  },
  *ARC() {
    const a = yield ask.point("ARC จุดเริ่ม:"); if (!a) return;
    const b = yield ask.point("จุดที่สอง (บนโค้ง):", a, (c) => [ln(a, c)]); if (!b || typeof b === "string") return;
    const c = yield ask.point("จุดปลาย:", b, (q) => { const g = arc3(a, b, q); return g ? [G.displayOf("ARC", g, tol())] : [ln(b, q)]; });
    if (!c || typeof c === "string") return;
    const g = arc3(a, b, c); if (!g) return log("3 จุดอยู่แนวเดียวกัน");
    const e = newEntity("ARC", g); commit("ARC", [[e.h, e]]);
  },
  *TEXT() {
    const p = yield ask.point("TEXT จุดเริ่มข้อความ:"); if (!p) return;
    const h = yield ask.num("ความสูงตัวอักษร:", lastTextH(), p); if (!(h > 0)) return;
    const rot = yield ask.num("มุม (องศา):", 0, p); const s = yield ask.text("ข้อความ:"); if (!s) return;
    S.textH = h;
    const e = newEntity("TEXT", { p, h, rot: rot || 0, s, ha: 0, va: 0 }); commit("TEXT", [[e.h, e]]);
  },
  *ERASE() {
    if (!S.sel.size) { const ok = yield ask.select("ERASE เลือกวัตถุ แล้ว Enter:"); if (!ok) return; }
    const n = S.sel.size; commit(`ลบ ${n} วัตถุ`, [...S.sel].map((h) => [h, null])); S.sel.clear();
  },
  *MOVE() { yield* xform("MOVE", false); },
  *COPY() { yield* xform("COPY", true); },
  *ROTATE() {
    if (!S.sel.size) { const ok = yield ask.select("ROTATE เลือกวัตถุ แล้ว Enter:"); if (!ok) return; }
    const base = yield ask.point("จุดหมุน:"); if (!base) return;
    const a = yield ask.num("มุมหมุน (องศา ทวนเข็ม · หรือคลิก):", null, base, (q) => selPreview(G.rotateAt(angle(base, q), base)), true);
    if (a == null || isNaN(a)) return;
    transformSel(G.rotateAt(a, base), false, `หมุน ${a}°`);
  },
  *SCALE() {
    if (!S.sel.size) { const ok = yield ask.select("SCALE เลือกวัตถุ แล้ว Enter:"); if (!ok) return; }
    const base = yield ask.point("จุดฐาน:"); if (!base) return;
    const k = yield ask.num("ตัวคูณ:", null, base, null); if (!(k > 0)) return;
    transformSel(G.scaleAt(k, base), false, `ย่อขยาย ×${k}`);
  },
  *MIRROR() {
    if (!S.sel.size) { const ok = yield ask.select("MIRROR เลือกวัตถุ แล้ว Enter:"); if (!ok) return; }
    const a = yield ask.point("จุดแรกของแนวสะท้อน:"); if (!a) return;
    const b = yield ask.point("จุดที่สอง:", a, (q) => [ln(a, q), ...selPreview(G.mirror(a, q))]); if (!b || typeof b === "string") return;
    const keep = yield ask.text("ลบวัตถุต้นฉบับ? [Y/N] <N>:", "N");
    const m = G.mirror(a, b);
    if (String(keep).toUpperCase().startsWith("Y")) transformSel(m, false, "สะท้อน"); else transformSel(m, true, "สะท้อน (คัดลอก)");
  },
  *LAYER() { const n = yield ask.text("ชื่อ layer ใหม่:"); if (n) addLayer(n); },
  // ไฟล์ใหญ่: เลือก layer และ/หรือพื้นที่ → โหลดเฉพาะส่วนนั้นมาแก้ (แบบ Partial Open ของ AutoCAD) · ส่วนอื่นจางและล็อก
  *PARTIAL() {
    if (!S.doc || !S.doc.partial_ok) { log(S.doc && S.doc.partial ? "อยู่ในโหมดแก้บางส่วนแล้ว — เลือกส่วนใหม่: บันทึก แล้วเปิดไฟล์อีกครั้ง" : "แก้บางส่วนใช้กับไฟล์ใหญ่ (DWG/DXF) ที่เปิดดูอยู่"); return; }
    const pick = yield ask.wait(partialDialog(), "เลือก layer และ/หรือพื้นที่ในกล่องข้อความ…");
    if (!pick) return;
    let area = null;
    if (pick.area) {
      const a = yield ask.point("มุมแรกของพื้นที่ที่จะแก้:"); if (!a || typeof a === "string") return;
      const b = yield ask.point("มุมตรงข้าม:", a, (c) => [rectDisp(a, c)]); if (!b || typeof b === "string") return;
      area = [a[0], a[1], b[0], b[1]];
    }
    let r = yield ask.wait(partialLoad(pick.layers, area, false), "กำลังโหลดส่วนที่เลือกมาแก้…");
    if (r && r.tooBig) {
      if (!confirm(r.tooBig.error + "\n\nโหลดต่อ?")) return log("ยกเลิกแก้บางส่วน");
      r = yield ask.wait(partialLoad(pick.layers, area, true), "กำลังโหลดส่วนที่เลือกมาแก้…");
    }
    if (!r || !r.id) return;
    const v = { ...S.view };
    load(r); S.view = v; S.fitted = true; draw();
    toast(`แก้บางส่วน: ${r.partial.count.toLocaleString()} วัตถุ — ส่วนอื่นจางและล็อก`);
  },
};
async function partialLoad(layers, area, force) {
  const r = await fetch("/api/cad/partial", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: S.doc.id, layers, area, force }) });
  const j = await r.json().catch(() => ({}));
  if (r.status === 409 && j.too_big) return { tooBig: j };
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}
function partialDialog() {
  showDlg("✂ แก้บางส่วน", "เลือก layer ที่จะแก้ แล้วโหลดทั้ง layer หรือลากกรอบพื้นที่บนแบบ (ไม่เลือก layer + ลากกรอบ = ทุก layer ในกรอบ) · ส่วนที่ไม่ได้เลือกแสดงจางและล็อก · บันทึกแล้วส่วนอื่นคงเดิมทุกไบต์");
  const lays = [...S.layers.values()].filter((L) => L.n).sort((a, b) => a.name.localeCompare(b.name));
  $("#dlg-body").innerHTML = '<input id="pa-q" type="search" placeholder="ค้นชื่อ layer…" style="width:100%;margin:6px 0">' +
    `<div id="pa-list" style="max-height:45vh;overflow:auto">${lays.map((L) => `<label class="row small" data-q="${esc(L.name.toLowerCase())}"><input type="checkbox" value="${esc(L.name)}"> ` +
      `<i style="display:inline-block;width:10px;height:10px;background:${aciColor(L.color, ink())}"></i> ${esc(L.name)} <span class="muted">(${L.n.toLocaleString()})</span></label>`).join("")}</div>` +
    '<p class="small muted" id="pa-sum">ยังไม่ได้เลือก layer</p><div class="row"><button id="pa-area">▭ ลากกรอบพื้นที่บนแบบ…</button><button id="pa-go" class="go">โหลด layer ที่เลือกมาแก้</button></div>';
  const chosen = () => [...$("#dlg-body").querySelectorAll("#pa-list input:checked")].map((c) => c.value);
  $("#pa-q").oninput = (e) => { const q = e.target.value.trim().toLowerCase(); $("#dlg-body").querySelectorAll("#pa-list label").forEach((l) => (l.hidden = q && !l.dataset.q.includes(q))); };
  $("#pa-list").onchange = () => { const c = chosen(), n = c.reduce((t, x) => t + ((S.layers.get(x) || {}).n || 0), 0);
    $("#pa-sum").textContent = c.length ? `เลือก ${c.length} layer · ${n.toLocaleString()} วัตถุ` : "ยังไม่ได้เลือก layer (ลากกรอบ = ทุก layer ในกรอบ)"; };
  return new Promise((res) => {
    const close = $("#dlg-close"), prev = close.onclick, done = (v) => { close.onclick = prev; closeDlg(); res(v); };
    $("#pa-area").onclick = () => done({ layers: chosen(), area: true });
    $("#pa-go").onclick = () => { const c = chosen(); if (!c.length) return dlgMsg("เลือก layer อย่างน้อย 1 อัน หรือกด ลากกรอบพื้นที่"); done({ layers: c, area: false }); };
    close.onclick = () => done(null);
  });
}
function* xform(name, copy) {
  if (!S.sel.size) { const ok = yield ask.select(`${name} เลือกวัตถุ แล้ว Enter:`); if (!ok) return; }
  const base = yield ask.point("จุดฐาน:"); if (!base) return;
  for (;;) {
    const to = yield ask.point(copy ? "จุดวาง [Enter=จบ]:" : "จุดปลายทาง (หรือ @dx,dy):", base, (q) => [ln(base, q), ...selPreview(G.translate(q[0] - base[0], q[1] - base[1]))]);
    if (!to || typeof to === "string") return;
    const m = G.translate(to[0] - base[0], to[1] - base[1]);
    if (copy) { const keep = new Set(S.sel); transformSel(m, true, "คัดลอก"); S.sel = keep; draw(); } else { transformSel(m, false, "ย้าย"); return; }
  }
}
const tol = () => Math.max((S.doc && S.doc.tol) || 0.01, 1 / S.view.s);
const angle = (a, b) => (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
const lastTextH = () => S.textH || Math.max(2.5 / S.view.s * 4, 0.001);
function selPreview(m) { const out = []; let n = 0; for (const h of S.sel) { if (n++ > 400) break; const e = S.ents.get(h); if (e) out.push(G.transformEntity(e, m)); } return out; }
function rectDisp(a, c) { return { d: [[[a[0], a[1], c[0], a[1], c[0], c[1], a[0], c[1]], 1]], x: [] }; }
function addPline(pts, closed) { const e = newEntity("LWPOLYLINE", { pts: pts.map((p) => [p[0], p[1], 0]), closed, w: 0 }); commit("PLINE", [[e.h, e]]); }
function arc3(a, b, c) {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1])); if (Math.abs(d) < 1e-12) return null;
  const ux = ((a[0] ** 2 + a[1] ** 2) * (b[1] - c[1]) + (b[0] ** 2 + b[1] ** 2) * (c[1] - a[1]) + (c[0] ** 2 + c[1] ** 2) * (a[1] - b[1])) / d;
  const uy = ((a[0] ** 2 + a[1] ** 2) * (c[0] - b[0]) + (b[0] ** 2 + b[1] ** 2) * (a[0] - c[0]) + (c[0] ** 2 + c[1] ** 2) * (b[0] - a[0])) / d;
  const r = Math.hypot(a[0] - ux, a[1] - uy), ang = (p) => ((Math.atan2(p[1] - uy, p[0] - ux) * 180) / Math.PI + 360) % 360;
  let a0 = ang(a), a1 = ang(c); const ccw = d > 0;
  if (!ccw) [a0, a1] = [a1, a0];
  return { c: [ux, uy], r, a0, a1 };
}


// ================================================================ ขั้นที่ 2: คำสั่งแก้ไข · มิติ · HATCH · BLOCK · วัด
const lastNum = (k, d) => (S[k] != null ? S[k] : d);
const pickE = (r) => (r && r.h ? S.ents.get(r.h) : null);
function replaceWith(label, e, parts) {
  const ch = [[e.h, null]];
  for (const p of parts) { const n = newEntity(p.t, p.g); n.l = e.l; n.c = e.c; ch.push([n.h, n]); }
  commit(label, ch);
}
function nearbyEnts(e, grow) {
  const b = e.bb || (e.bb = G.bboxOf(e)), c = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], r = Math.max(b[2] - b[0], b[3] - b[1]) * (grow || 1) + 1e-6;
  return near(c, r).map((h) => S.ents.get(h)).filter((x) => x && visible(x) && x !== e);
}
Object.assign(ALIAS, { O: "OFFSET", TR: "TRIM", EX: "EXTEND", F: "FILLET", AR: "ARRAY", X: "EXPLODE", DLI: "DIMLINEAR", DAL: "DIMALIGNED",
  DIM: "DIMLINEAR", H: "HATCH", B: "BLOCK", I: "INSERT", DI: "DIST", AA: "AREA", ID: "ID", MA: "MATCHPROP", PRINT: "PLOT" });
Object.assign(CMDS, {
  *PLOT() {
    if (CLOUD) return toast("Plot PDF ต้องใช้รุ่นในเครื่อง (ASC Architect ในเครื่อง)");
    const o = yield ask.wait(plotDialog(), "PLOT ตั้งค่าในหน้าต่าง…"); if (!o) return;
    if (o.area === "window") {
      closeDlg();
      const a = yield ask.point("PLOT มุมแรกของพื้นที่:"); if (!a || typeof a === "string") return;
      const b = yield ask.point("มุมตรงข้าม:", a, (c) => [{ d: [[[a[0], a[1], c[0], a[1], c[0], c[1], a[0], c[1], a[0], a[1]], 0]], x: [] }]);
      if (!b || typeof b === "string") return;
      o.area = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
      showDlg("🖨 Plot เป็น PDF", "");
    } else if (o.area === "view") {
      const r = cv.getBoundingClientRect(), p = toW(0, 0), q = toW(r.width, r.height);
      o.area = [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[0], q[0]), Math.max(p[1], q[1])];
    } else o.area = null;
    yield ask.wait(doPlot(o).catch((e) => { dlgMsg("Plot ไม่สำเร็จ: " + e.message); throw e; }), "กำลังสร้าง PDF…");
  },
  *OFFSET() {
    const d = yield ask.num("OFFSET ระยะ:", lastNum("offD", null)); if (!(d > 0)) return; S.offD = d;
    for (;;) {
      const r = yield ask.pick("เลือกวัตถุที่จะเลื่อนขนาน [Enter=จบ]:"); const e = pickE(r); if (!e) return;
      const side = yield ask.point("คลิกด้านที่จะสร้าง:", null, (q) => { const o = H.offset(e, d, q); return o ? [G.displayOf(o.t, o.g, tol())] : []; });
      if (!side || typeof side === "string") return;
      const o = H.offset(e, d, side); if (!o) { log("OFFSET ใช้กับเส้น · โพลีไลน์ · วงกลม · โค้ง"); continue; }
      const n = newEntity(o.t, o.g); n.l = e.l; n.c = e.c; commit("OFFSET", [[n.h, n]]);
    }
  },
  *TRIM() {
    log("TRIM: ทุกเส้นเป็นขอบตัด · คลิกส่วนที่จะตัดทิ้ง");
    for (;;) {
      const r = yield ask.pick("คลิกส่วนที่จะตัดทิ้ง [Enter=จบ]:"); const e = pickE(r); if (!e) return;
      const out = H.trim(e, r.p, nearbyEnts(e, 1.2));
      if (!out) { log("ไม่มีเส้นตัดผ่านส่วนนี้ (หรือวัตถุชนิดนี้ยังตัดไม่ได้)"); continue; }
      replaceWith("TRIM", e, out);
    }
  },
  *EXTEND() {
    for (;;) {
      const r = yield ask.pick("คลิกปลายเส้น/โค้งที่จะยืด [Enter=จบ]:"); const e = pickE(r); if (!e) return;
      const bounds = S.ents.size < 30000 ? [...S.ents.values()].filter((x) => x !== e && visible(x)) : nearbyEnts(e, 20);
      const n = H.extend(e, r.p, bounds);
      if (!n) { log("ไม่พบขอบให้ยืดไปชน"); continue; }
      const ne = { ...e, g: n.g, ...G.displayOf(n.t, n.g, tol(), 256) }; commit("EXTEND", [[e.h, ne]]);
    }
  },
  *FILLET() {
    let R = lastNum("filR", 0);
    let r1 = yield ask.pick(`FILLET เลือกเส้นแรก [R=รัศมี ${R}]:`);
    if (r1 === "R") { R = yield ask.num("รัศมี:", R); if (!(R >= 0)) return; S.filR = R; r1 = yield ask.pick("เลือกเส้นแรก:"); }
    const e1 = pickE(r1); if (!e1) return;
    const r2 = yield ask.pick("เลือกเส้นที่สอง:"); const e2 = pickE(r2); if (!e2) return;
    const f = H.fillet(e1, r1.p, e2, r2.p, R);
    if (!f) return log("FILLET ใช้กับเส้นตรง 2 เส้นที่ไม่ขนานกัน (รัศมีต้องไม่ยาวกว่าเส้น)");
    const ch = [[e1.h, { ...e1, g: f.e1.g, ...G.displayOf("LINE", f.e1.g, tol(), 256) }], [e2.h, { ...e2, g: f.e2.g, ...G.displayOf("LINE", f.e2.g, tol(), 256) }]];
    if (f.arc) { const a = newEntity("ARC", f.arc.g); a.l = e1.l; ch.push([a.h, a]); }
    commit(`FILLET R${R}`, ch);
  },
  *ARRAY() {
    if (!S.sel.size) { const ok = yield ask.select("ARRAY เลือกวัตถุ แล้ว Enter:"); if (!ok) return; }
    const kind = String((yield ask.text("แบบ [R=แถว-คอลัมน์ / P=รอบจุด] <R>:", "R")) || "R").toUpperCase();
    let mats = [];
    if (kind.startsWith("P")) {
      const c = yield ask.point("จุดศูนย์กลาง:"); if (!c) return;
      const n = yield ask.num("จำนวนทั้งหมด:", 6); if (!(n >= 2)) return;
      const a = yield ask.num("มุมรวม (องศา):", 360); mats = H.polarArray(Math.round(n), c, a || 360);
    } else {
      const rows = yield ask.num("จำนวนแถว:", 2); const cols = yield ask.num("จำนวนคอลัมน์:", 3);
      const dy = yield ask.num("ระยะระหว่างแถว:", lastNum("arDy", 1000)); const dx = yield ask.num("ระยะระหว่างคอลัมน์:", lastNum("arDx", 1000));
      if (!(rows >= 1 && cols >= 1)) return; S.arDy = dy; S.arDx = dx; mats = H.rectArray(Math.round(rows), Math.round(cols), dx, dy);
    }
    const src = [...S.sel], ch = [];
    for (const m of mats) for (const h of src) {
      const e = S.ents.get(h); if (!e) continue;
      const n = G.transformEntity(e, m); n.h = tempH(); n.orig = false;
      if (!e.g || e.t === "INSERT") n.from = e.orig ? e.h : e.from;
      if (n.g && e.t !== "INSERT") delete n.from;
      ch.push([n.h, n]);
    }
    if (ch.length > 20000 && !confirm(`จะสร้าง ${ch.length.toLocaleString()} ชิ้น ทำต่อ?`)) return;
    commit(`ARRAY ${mats.length + 1} ชุด`, ch);
  },
  *EXPLODE() {
    if (!S.sel.size) { const ok = yield ask.select("EXPLODE เลือกวัตถุ แล้ว Enter:"); if (!ok) return; }
    const ch = []; let later = 0;
    for (const h of [...S.sel]) {
      const e = S.ents.get(h); if (!e) continue;
      if (e.t === "LWPOLYLINE") { ch.push([h, null]); for (const p of H.explode(e)) { const n = newEntity(p.t, p.g); n.l = e.l; n.c = e.c; ch.push([n.h, n]); } }
      else if (e.orig && ["INSERT", "DIMENSION", "POLYLINE", "MLINE", "LEADER", "MULTILEADER", "MLEADER"].includes(e.t)) { ch.push([h, { ...e, explode: true }]); later++; }
      else if (!e.orig && e.t === "INSERT") { ch.push([h, null]); for (const p of H.explode(e)) { const n = newEntity(p.t, p.g); n.l = e.l; ch.push([n.h, n]); } }
    }
    if (!ch.length) return log("วัตถุที่เลือกแตกไม่ได้");
    commit("EXPLODE", ch);
    if (later) log(`block/มิติ ${later} ชิ้น จะแตกจริงตอนบันทึก (รักษารายละเอียดเดิมครบ) — แล้วแก้ทีละชิ้นได้`);
  },
  *DIMLINEAR() { yield* dimCmd(false); },
  *DIMALIGNED() { yield* dimCmd(true); },
  *HATCH() {
    const pat = String((yield ask.text("ลาย [A=เส้นเฉียง ANSI31 / S=ทึบ] <A>:", "A")) || "A").toUpperCase().startsWith("S") ? "SOLID" : "ANSI31";
    const sp = pat === "SOLID" ? 0 : yield ask.num("ระยะห่างลาย:", lastNum("hatchSp", Math.round(drawingSize() / 120) || 1));
    if (pat !== "SOLID") { if (!(sp > 0)) return; S.hatchSp = sp; }
    for (;;) {
      const r = yield ask.pick("เลือกรูปปิด (โพลีไลน์ปิด/วงกลม) [Enter=จบ]:"); const e = pickE(r); if (!e) return;
      const b = H.closedBoundary(e, tol()); if (!b) { log("ต้องเป็นโพลีไลน์ปิดหรือวงกลม"); continue; }
      const g = { pts: b.map((p) => [Math.round(p[0] * 1e4) / 1e4, Math.round(p[1] * 1e4) / 1e4]), pattern: pat, scale: pat === "SOLID" ? 1 : sp / 3.175, angle: 0 };
      const n = newEntity("HATCH", g); n.d = hatchDisplay(g, sp); commit("HATCH " + pat, [[n.h, n]]);
    }
  },
  *BLOCK() {
    if (!S.sel.size) { const ok = yield ask.select("BLOCK เลือกวัตถุ แล้ว Enter:"); if (!ok) return; }
    const name = (yield ask.text("ชื่อ block:")) || ""; if (!name.trim()) return;
    if ((S.doc.blocks || []).includes(name) || [...S.ents.values()].some((e) => e.mk && e.mk.name === name)) return log(`มี block ชื่อ "${name}" แล้ว`);
    const base = yield ask.point("จุดฐานของ block:"); if (!base) return;
    const members = [...S.sel].map((h) => S.ents.get(h)).filter(Boolean);
    const ins = { h: tempH(), t: "INSERT", l: S.clayer, c: 256, orig: false, g: { name: name.trim(), p: base, sx: 1, sy: 1, rot: 0 },
      d: members.flatMap((e) => e.d), x: members.flatMap((e) => e.x || []),
      mk: { name: name.trim(), base, members: members.filter((e) => e.orig).map((e) => e.h),
            newMembers: members.filter((e) => !e.orig && e.g && e.t !== "INSERT").map((e) => ({ t: e.t, l: e.l, c: e.c, g: e.g })) } };
    commit(`BLOCK "${ins.g.name}" (${members.length} ชิ้น)`, [...members.map((e) => [e.h, null]), [ins.h, ins]]);
    S.sel = new Set([ins.h]);
  },
  *INSERT() {
    const names = S.doc.blocks || [];
    if (!names.length) return log("ไฟล์นี้ยังไม่มี block (สร้างด้วย BLOCK แล้วบันทึกก่อน)");
    log("block ที่มี: " + names.slice(0, 40).join(", ") + (names.length > 40 ? " …" : ""));
    const name = yield ask.text("ชื่อ block:"); if (!name || !names.includes(name)) return log("ไม่พบ block นี้");
    let geo; try { geo = await_(api("/api/cad/block", { id: S.doc.id, name })); } catch (e) { return log(e.message); }
    const res = yield ask.wait(geo, "กำลังโหลด block…"); if (!res) return;
    const proto = { t: "INSERT", g: { name, p: [0, 0], sx: 1, sy: 1, rot: 0 }, d: res.d, x: res.x };
    const p = yield ask.point("จุดวาง:", null, (q) => [G.transformEntity(proto, G.translate(q[0], q[1]))]); if (!p || typeof p === "string") return;
    const k = yield ask.num("ตัวคูณ:", 1, p); const a = yield ask.num("มุม:", 0, p);
    let m = G.translate(p[0], p[1]); if (k && k !== 1) m = G.mul(m, G.scaleAt(k, [0, 0])); if (a) m = G.mul(G.rotateAt(a, p), m);
    const n = G.transformEntity(proto, m); n.h = tempH(); n.orig = false; n.l = S.clayer; n.c = 256; delete n.m;
    commit(`INSERT ${name}`, [[n.h, n]]);
  },
  /** ตั้งระยะ: 2 จุดบนระยะที่รู้ + ระยะจริง → ย่อขยายทั้งแบบ (หรือเฉพาะที่เลือก) รอบจุดแรก · ใช้กับ PDF/ภาพที่ไม่รู้มาตราส่วน */
  *CAL() {
    const a = yield ask.point("ตั้งระยะ: คลิกจุดแรกของระยะที่รู้ (เช่น ปลายเส้นบอกระยะ · เส้นกริด):"); if (!a || typeof a === "string") return;
    const b = yield ask.point("จุดที่สอง:", a, (q) => [ln(a, q)]); if (!b || typeof b === "string") return;
    const now = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!(now > 0)) return;
    const real = yield ask.num(`ระยะจริง (มม.) — ตอนนี้ ${fmt(now)}:`, null, null, null); if (!(real > 0)) return;
    const all = !S.sel.size; if (all) for (const h of S.order) S.sel.add(h);
    transformSel(G.scaleAt(real / now, a), false, `ตั้งระยะ ×${fmt(real / now)}${all ? " (ทั้งแบบ)" : ""}`);
    if (all) S.sel.clear();
    S.cache = null; draw();
  },
  *DIST() {
    const a = yield ask.point("DIST จุดแรก:"); if (!a) return;
    const b = yield ask.point("จุดที่สอง:", a, (q) => [ln(a, q)]); if (!b || typeof b === "string") return;
    log(`ระยะ = ${fmt(Math.hypot(b[0] - a[0], b[1] - a[1]))} · ΔX = ${fmt(b[0] - a[0])} · ΔY = ${fmt(b[1] - a[1])} · มุม ${fmt(angle(a, b))}°`);
  },
  *AREA() {
    const first = yield ask.point("AREA จุดแรก [O=เลือกรูปปิด]:");
    if (first === "O") {
      const r = yield ask.pick("เลือกรูปปิด:"); const e = pickE(r); if (!e) return;
      const b = H.closedBoundary(e, tol()); if (!b) return log("ต้องเป็นโพลีไลน์ปิดหรือวงกลม");
      return logArea(b);
    }
    if (!first || typeof first === "string") return;
    const pts = [first];
    for (;;) {
      const p = yield ask.point("จุดถัดไป [Enter=คำนวณ]:", pts[pts.length - 1], (q) => [{ d: [[[...pts.flat(), ...q], 1]], x: [] }]);
      if (!p || typeof p === "string") break; pts.push(p);
    }
    if (pts.length > 2) logArea(pts);
  },
  *ID() { const p = yield ask.point("ID จุด:"); if (p) log(`X = ${fmt(p[0])} · Y = ${fmt(p[1])}`); },
  *MATCHPROP() {
    const r = yield ask.pick("MATCHPROP เลือกวัตถุต้นแบบ:"); const src = pickE(r); if (!src) return;
    for (;;) {
      const r2 = yield ask.pick(`คลิกวัตถุที่จะใช้ layer "${src.l}" + สีเดียวกัน [Enter=จบ]:`); const e = pickE(r2); if (!e) return;
      commit("MATCHPROP", [[e.h, { ...e, l: src.l, c: src.c }]]);
    }
  },
});
// ---------------------------------------------------------------- คลังสัญลักษณ์ · สายไฟ · คลิปบอร์ด (0.21.0)
Object.assign(ALIAS, { WI: "WIRE", SYM: "SYM", PASTECLIP: "PASTE" });
function ensureLayer(name) {
  if (S.layers.has(name)) return;
  const L = { name, color: SY.LAYER_COLORS[name] || 7, on: true, frozen: false, locked: false };
  S.layers.set(name, L); S.layerCh.set(name, { ...L }); renderLayers(); log(`เพิ่ม layer ${name}`);
}
/** ตัวคูณขนาดสัญลักษณ์: แผนผัง = มาตราส่วน × หน่วยแบบ · ขนาดจริง = หน่วยแบบ */
function symScale(en) { const f = SY.unitFactor(S.doc && S.doc.insunits); return (en.sym ? (en.real ? 1 : S.anno) : en.paper ? S.anno : 1) * f; }
const libCache = new Map();
function libGeom(en) { if (!libCache.has(en.key)) libCache.set(en.key, api("/api/cad/libblock", { lib: en.lib, name: en.name }).catch((e) => { libCache.delete(en.key); throw e; })); return libCache.get(en.key); }
const attrsOf = (e) => e.attrs || (e.g && e.g.attrs) || null;
function nextTag(pre) {
  if (!pre) return ""; let n = 0;
  for (const e of S.ents.values()) { const t = (attrsOf(e) || {}).TAG; if (t && t.startsWith(pre)) { const m = t.slice(pre.length).match(/^-?(\d+)$/); if (m) n = Math.max(n, +m[1]); } }
  return pre + (n + 1);
}
/** ขั้วต่อของสัญลักษณ์ ASCA_* ในแบบ (พิกัดจริง) — ใช้จับจุดตอนลากสาย */
function pinsOf(e) {
  if (e.t !== "INSERT" || !e.g || !e.g.name || !e.g.name.startsWith("ASCA_")) return [];
  const s = SY.SYMS[e.g.name.slice(5)]; if (!s) return [];
  const g = e.g, r = (g.rot * Math.PI) / 180, c = Math.cos(r), sn = Math.sin(r);
  return s.pins.map(([x, y]) => { const lx = x * g.sx, ly = y * g.sy; return [g.p[0] + lx * c - ly * sn, g.p[1] + lx * sn + ly * c]; });
}
Object.assign(CMDS, {
  /** วางสัญลักษณ์จากคลัง (S.symKey) — คลิกได้หลายครั้ง · R หมุน · F กลับด้าน · สัญลักษณ์มีขั้ว: จุดจับ = ขั้วแรก */
  *SYM() {
    const en = UI.ENTRIES.get(S.symKey); if (!en) return log("ไม่พบสัญลักษณ์");
    let proto;
    if (en.sym) proto = SY.symDisplay(en.sym, en.sym.tag ? "\u0000TAG" : "");
    else { const g = yield ask.wait(libGeom(en), "กำลังโหลดสัญลักษณ์จากคลัง…"); if (!g) return; proto = { d: g.d, x: g.x }; }
    const k = symScale(en), anchor = en.sym && !en.sym.real && en.sym.pins.length ? en.sym.pins[0] : [0, 0];
    const name = en.sym ? SY.blockName(en.sym) : en.name, pre = en.sym ? en.sym.tag : "";
    let rot = 0, flip = false;
    const make = (p, tag) => {
      const local = G.mul(G.rotateAt(rot, [0, 0]), [flip ? -k : k, 0, 0, k, 0, 0]), a = G.ap(local, anchor);
      const x = proto.x.map((t) => (t[4] === "\u0000TAG" ? [...t.slice(0, 4), tag || "", ...t.slice(5)] : t)).filter((t) => t[4] !== "");
      const n = G.transformEntity({ t: "INSERT", g: { name, p: [0, 0], sx: 1, sy: 1, rot: 0 }, d: proto.d, x }, G.mul(G.translate(p[0] - a[0], p[1] - a[1]), local));
      delete n.m; return n;
    };
    const place = (p) => {
      const tag = nextTag(pre), n = make(p, tag), L = en.layer || "0";
      ensureLayer(L);
      Object.assign(n, { h: tempH(), l: L, c: 256, orig: false, layerColor: (S.layers.get(L) || {}).color, def: en.sym ? SY.blockDef(en.sym) : { name: en.name, lib: en.lib } });
      if (tag) n.attrs = { TAG: tag }; else if (en.attrs && en.attrs.length) n.attrs = {};
      commit(`วาง ${en.short}${tag ? " " + tag : ""}`, [[n.h, n]]); UI.noteRecent(en.key);
    };
    if (S.dropPt) { const p = S.dropPt; S.dropPt = null; place(p); return; }
    if (S.pendingPt) { place(S.pendingPt); S.pendingPt = null; }
    for (;;) {
      const tg = nextTag(pre), req = ask.point(`วาง ${en.th} · R หมุน 90° · F กลับด้าน · Enter จบ:`, null, (q) => [make(q, tg)]);
      req.keys = (key) => { if (key === "r") { rot = (rot + 90) % 360; return true; } if (key === "f") { flip = !flip; return true; } return false; };
      const p = yield req;
      if (p === "R") { rot = (rot + 90) % 360; continue; }
      if (p === "F") { flip = !flip; continue; }
      if (!p || typeof p === "string") return;
      place(p);
    }
  },
  /** วางจากคลิปบอร์ด (Ctrl+V) — ตัด (Ctrl+X) แล้ววางครั้งแรก = ย้ายของเดิม */
  *PASTE() {
    const C = S.clip; if (!C) return log("คลิปบอร์ดว่าง — เลือกวัตถุแล้วกด Ctrl+C หรือ Ctrl+X ก่อน");
    const mv = (q) => G.translate(q[0] - C.base[0], q[1] - C.base[1]);
    const p = yield ask.point(`วาง ${C.ents.length} วัตถุ — คลิกตำแหน่ง:`, C.base, (q) => C.ents.slice(0, 400).map((e) => G.transformEntity(e, mv(q))));
    if (!p || typeof p === "string") return;
    const m = mv(p), ch = [];
    for (const e of C.ents) {
      const n = G.transformEntity(e, m);
      if (!(C.cut && !C.used)) { n.h = tempH(); n.orig = false; if (!e.g || e.t === "INSERT") n.from = e.orig ? e.h : e.from; if (n.g && e.t !== "INSERT") delete n.from; }
      ch.push([n.h, n]);
    }
    const restore = C.cut && !C.used; C.used = true;
    commit(`วาง ${ch.length} วัตถุ`, ch); S.sel = new Set(ch.map(([h]) => h));
    if (restore) C.ents = ch.map(([, n]) => ({ ...n }));              // วางครั้งต่อไป = คัดลอกจากชิ้นที่วางแล้ว
    renderProps(); draw();
  },
});
// ---------------------------------------------------------------- เครื่องมือวาดตามหน้าตัวอย่าง (0.22.1): ผนัง · ห้อง · หลายเหลี่ยม · สาย/บัส/จุดต่อ · ท่อตามชนิด · ท่อลม · TAG · เรียงเลข · ตาราง
Object.assign(CMDS, {
  /** ป้ายชี้ (Leader): ปลายลูกศร → จุดวางข้อความ → พิมพ์ข้อความ · ลูกศรทึบ + เส้นชี้ + MTEXT บน G-ANNO */
  *LEADER() {
    const tip = yield ask.point("LEADER ป้ายชี้ — คลิกปลายลูกศร:"); if (!tip || typeof tip === "string") return;
    const at = yield ask.point("คลิกตำแหน่งข้อความ:", tip, (q) => [newEntity("LINE", { a: tip, b: q })]); if (!at || typeof at === "string") return;
    const s = yield ask.text("ข้อความ:"); if (!s) return;
    const k = annoK(), h = 2.5 * k, dir = at[0] >= tip[0] ? 1 : -1, land = [at[0] + dir * 3 * k, at[1]];
    ensureLayer("G-ANNO");
    const ln = newEntity("LWPOLYLINE", { pts: [[...tip, 0], [...at, 0], [...land, 0]], closed: false, w: 0 }); ln.l = "G-ANNO";
    const a = (Math.atan2(at[1] - tip[1], at[0] - tip[0])), L = 3 * k, W = 0.9 * k, b = [tip[0] + L * Math.cos(a), tip[1] + L * Math.sin(a)];
    const g = { pts: [tip, [b[0] - W * Math.sin(a), b[1] + W * Math.cos(a)], [b[0] + W * Math.sin(a), b[1] - W * Math.cos(a)]], pattern: "SOLID", scale: 1, angle: 0 }, hd = newEntity("HATCH", g); hd.d = hatchDisplay(g, 0); hd.l = "G-ANNO";
    const tp = [land[0] + dir * 1 * k, land[1]], tx = newEntity("MTEXT", { p: dir > 0 ? tp : [tp[0] - s.length * h * 0.75, tp[1]], h, rot: 0, s, ap: 4 }); tx.l = "G-ANNO";
    tx.x = [[tx.g.p[0], tx.g.p[1] - h * 0.45, h, 0, s, 256]];
    commit(`ป้ายชี้: ${s}`, [[ln.h, ln], [hd.h, hd], [tx.h, tx]]);
  },
});
Object.assign(ALIAS, { LE: "LEADER", LEADER: "LEADER", QLEADER: "LEADER", TB: "BOM", TABLE: "BOM", ZI: "ZIN", ZO: "ZOUT" });
Object.assign(ALIAS, { WA: "WALL", WALL: "WALL", RM: "ROOM", POL: "POLYGON", BUS: "BUS", JD: "DOT", DOT: "DOT", PP: "PIPE", DU: "DUCT", TAG: "TAG", AN: "AUTONUM",
  BOM: "BOM", SENS: "SENSLIST", PCW: "PCW", PHW: "PHW", PS: "PS", PW: "PW", PV: "PV", PRD: "PRD", PSIG: "PSIG", PWL: "PWL" });
/** ตัวคูณ: มม. บนกระดาษ × มาตราส่วนสัญลักษณ์ → หน่วยของแบบ */
const annoK = () => S.anno * SY.unitFactor(S.doc && S.doc.insunits);
const mmK = () => SY.unitFactor(S.doc && S.doc.insunits);
const LT = { DASHED: [12.7, -6.35], HIDDEN: [6.35, -3.175], DASHDOT: [12.7, -6.35, 0, -6.35], DOT: [0, -6.35], CENTER: [31.75, -6.35, 6.35, -6.35], PHANTOM: [31.75, -6.35, 6.35, -6.35, 6.35, -6.35] };
const ROUTES = {
  WIRE: { th: "สายไฟ", layer: "E-WIRE", dots: true },
  BUS: { th: "บัสบาร์", layer: "E-POWR", w: 0.8, dots: true },
  PIPE: { th: "ท่อ (P&ID)", layer: "P-PIPE" },
  PCW: { th: "ท่อน้ำดี (น้ำเย็น)", lab: "CW", layer: "P-DOMW", lt: "DASHED" },
  PHW: { th: "ท่อน้ำร้อน", lab: "HW", layer: "P-HOTW", lt: "DASHDOT" },
  PS: { th: "ท่อโสโครก (จากส้วม)", lab: "S", layer: "P-SANR", w: 0.5 },
  PW: { th: "ท่อน้ำทิ้ง", lab: "W", layer: "P-SANR" },
  PV: { th: "ท่ออากาศ", lab: "V", layer: "P-VENT", lt: "HIDDEN" },
  PRD: { th: "ท่อน้ำฝน", lab: "RD", layer: "P-STRM", lt: "PHANTOM" },
  PSIG: { th: "สายสัญญาณ", layer: "I-SENS", lt: "DASHED" },
  PWL: { th: "สัญญาณไร้สาย", layer: "I-SENS", lt: "DOT" },
};
/** เส้นประสำหรับแสดงผล (ไฟล์จริงใช้ linetype ของ DXF) */
function dashDisp(pts, pat, k) {
  const P = pat.map((v) => v * k), out = []; let i = 0, rem = Math.abs(P[0]) || 0.4 * k, on = P[0] >= 0;
  for (let s = 1; s < pts.length; s++) {
    const a = pts[s - 1], b = pts[s], L = Math.hypot(b[0] - a[0], b[1] - a[1]); let t = 0;
    while (t < L - 1e-9 && out.length < 5000) {
      const st = Math.min(rem, L - t);
      if (on) { const f0 = t / L, f1 = (t + st) / L; out.push([[a[0] + (b[0] - a[0]) * f0, a[1] + (b[1] - a[1]) * f0, a[0] + (b[0] - a[0]) * f1, a[1] + (b[1] - a[1]) * f1], 0, 256]); }
      t += st; rem -= st;
      if (rem <= 1e-9) { i = (i + 1) % P.length; rem = Math.abs(P[i]) || 0.4 * k; on = P[i] >= 0; }
    }
  }
  return out;
}
/** แถบหนา (บัส/ท่อโสโครก) แสดงเป็นสี่เหลี่ยมทึบต่อช่วง */
function bandDisp(pts, w) {
  const out = [];
  for (let s = 1; s < pts.length; s++) {
    const a = pts[s - 1], b = pts[s], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, n = [(-(b[1] - a[1]) / L) * w / 2, ((b[0] - a[0]) / L) * w / 2];
    out.push([[a[0] + n[0], a[1] + n[1], b[0] + n[0], b[1] + n[1], b[0] - n[0], b[1] - n[1], a[0] - n[0], a[1] - n[1]], 1, 256, 1]);
  }
  return out;
}
function routeEntity(R, pts) {
  const g = { pts: pts.map((p) => [p[0], p[1], 0]), closed: false, w: R.w ? R.w * annoK() : 0, ...(R.lt ? { lt: R.lt, lts: annoK() } : {}) };
  const e = newEntity("LWPOLYLINE", g); e.l = R.layer;
  if (R.lt) e.d = dashDisp(pts, LT[R.lt], annoK());
  else if (R.w) e.d = bandDisp(pts, g.w);
  return e;
}
/** ป้ายชนิดท่อกลางช่วงที่ยาวที่สุด (MTEXT มีพื้นหลัง → เส้นขาดตรงป้ายใน AutoCAD) */
function routeLabel(R, pts) {
  let bi = 1, bl = 0; for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (l > bl) { bl = l; bi = i; } }
  const h = 2.2 * annoK(); if (bl < h * 5) return null;
  const a = pts[bi - 1], b = pts[bi]; let rot = angle(a, b); if (rot > 90.01 || rot <= -90) rot += 180;
  const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const e = newEntity("MTEXT", { p: m, h, rot, s: R.lab, ap: 5, bg: true }); e.l = R.layer;
  const w = R.lab.length * h * 0.75; e.x = [[m[0] - (w / 2) * Math.cos((rot * Math.PI) / 180), m[1] - (w / 2) * Math.sin((rot * Math.PI) / 180) - h * 0.45, h, rot, R.lab, 256]];
  return e;
}
/** จุดต่อสาย (วงกลมทึบ) */
function dotEntity(p, layer) {
  const r = 0.7 * annoK(), pts = []; for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; pts.push([p[0] + r * Math.cos(a), p[1] + r * Math.sin(a)]); }
  const g = { pts, pattern: "SOLID", scale: 1, angle: 0 }, e = newEntity("HATCH", g); e.d = hatchDisplay(g, 0); e.l = layer; return e;
}
/** ปลายสายที่ไปชนกลางสาย/บัสเส้นอื่น → ต้องมีจุดต่อ */
function needDot(p, layers) {
  const tolD = 1 / S.view.s;
  for (const e of S.ents.values()) {
    if (e.t !== "LWPOLYLINE" || !layers.includes(e.l) || !e.g) continue;
    const ps = e.g.pts;
    for (let i = 1; i < ps.length; i++) {
      const a = ps[i - 1], b = ps[i], ab = [b[0] - a[0], b[1] - a[1]], L2 = ab[0] ** 2 + ab[1] ** 2 || 1, t = ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / L2;
      if (t <= 0.001 || t >= 0.999) continue;
      if (Math.hypot(a[0] + ab[0] * t - p[0], a[1] + ab[1] * t - p[1]) < tolD * 2) return true;
    }
  }
  return false;
}
function* routeCmd(key) {
  const R = ROUTES[key];
  const p0 = yield ask.point(`${R.th} — คลิกจุดเริ่ม (ขั้วอุปกรณ์ ◇ หรือปลายเส้น):`); if (!p0 || typeof p0 === "string") return;
  const pts = [p0]; let vfirst = false;
  const route = (a, b) => (Math.abs(a[0] - b[0]) < 1e-9 || Math.abs(a[1] - b[1]) < 1e-9 ? [b] : vfirst ? [[a[0], b[1]], b] : [[b[0], a[1]], b]);
  for (;;) {
    const last = pts[pts.length - 1];
    const req = ask.point("จุดถัดไป (หักมุมฉากเอง · Tab สลับแนว · คลิกขั้ว ◇ = จบ) [U=ย้อน · Enter=จบ]:", last, (c) => [{ d: [[[...pts.flat(), ...route(last, c).flat()], 0]], x: [] }]);
    req.keys = (k) => { if (k === "Tab") { vfirst = !vfirst; return true; } return false; };
    const q = yield req;
    if (q === "U") { if (pts.length > 1) pts.pop(); continue; }
    if (!q || typeof q === "string") break;
    pts.push(...route(last, q));
    if (S.clickSnap && S.clickSnap.kind === "pin") break;
  }
  if (pts.length < 2) return;
  ensureLayer(R.layer);
  const ch = [], e = routeEntity(R, pts); ch.push([e.h, e]);
  if (R.lab) { const lb = routeLabel(R, pts); if (lb) ch.push([lb.h, lb]); }
  if (R.dots) for (const p of [pts[0], pts[pts.length - 1]]) if (needDot(p, ["E-WIRE", "E-POWR"])) { const d = dotEntity(p, R.layer); ch.push([d.h, d]); }
  commit(`${R.th} ${pts.length - 1} ช่วง`, ch);
}
/** เส้นขอบผนัง/ท่อลม: offset ทางเดิน ± ครึ่งความหนา (มุมต่อแบบ miter) */
function offsetPath(pts, d, closed) {
  const n = pts.length, out = [], nrm = (a, b) => { const v = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(...v) || 1; return [-v[1] / l, v[0] / l]; };
  for (let i = 0; i < n; i++) {
    const prev = i > 0 ? pts[i - 1] : closed ? pts[n - 1] : null, next = i < n - 1 ? pts[i + 1] : closed ? pts[0] : null;
    if (!prev) { const m = nrm(pts[i], next); out.push([pts[i][0] + m[0] * d, pts[i][1] + m[1] * d]); continue; }
    if (!next) { const m = nrm(prev, pts[i]); out.push([pts[i][0] + m[0] * d, pts[i][1] + m[1] * d]); continue; }
    const n1 = nrm(prev, pts[i]), n2 = nrm(pts[i], next), m = [n1[0] + n2[0], n1[1] + n2[1]], ml = Math.hypot(...m);
    if (ml < 1e-6) { out.push([pts[i][0] + n1[0] * d, pts[i][1] + n1[1] * d]); continue; }
    const u = [m[0] / ml, m[1] / ml], k = d / Math.max(0.2, u[0] * n1[0] + u[1] * n1[1]);
    out.push([pts[i][0] + u[0] * k, pts[i][1] + u[1] * k]);
  }
  return out;
}
function* bandCmd(kind) {
  const isWall = kind === "WALL", key = isWall ? "wallTh" : "ductW";
  const th = yield ask.num(isWall ? "WALL ความหนาผนัง:" : "DUCT ความกว้างท่อลม:", lastNum(key, (isWall ? 200 : 400) * mmK())); if (!(th > 0)) return; S[key] = th;
  const pts = []; const p0 = yield ask.point(isWall ? "จุดเริ่มแนวผนัง (แนวกึ่งกลาง):" : "จุดเริ่มแนวท่อลม:"); if (!p0 || typeof p0 === "string") return; pts.push(p0);
  let closed = false;
  const shape = (ps, cl) => { const L = offsetPath(ps, th / 2, cl), Rr = offsetPath(ps, -th / 2, cl); return cl ? [L, Rr] : [[...L, ...Rr.reverse()]]; };
  for (;;) {
    const req = ask.point(`จุดถัดไป (พิมพ์ระยะได้) [C=ปิดรอบ · U=ย้อน · Enter=จบ]:`, pts[pts.length - 1], (c) => shape([...pts, c], false).map((r) => ({ d: [[r.flat(), 1]], x: [] })));
    const q = yield req;
    if (q === "U") { if (pts.length > 1) pts.pop(); continue; }
    if (q === "C") { if (pts.length > 2) closed = true; break; }
    if (!q || typeof q === "string") break;
    pts.push(q);
  }
  if (pts.length < 2) return;
  const layer = isWall ? "A-WALL" : "M-HVAC"; ensureLayer(layer);
  const ch = shape(pts, closed).map((r) => { const e = newEntity("LWPOLYLINE", { pts: r.map((p) => [p[0], p[1], 0]), closed: true, w: 0 }); e.l = layer; return [e.h, e]; });
  if (!isWall) { const c = newEntity("LWPOLYLINE", { pts: (closed ? [...pts, pts[0]] : pts).map((p) => [p[0], p[1], 0]), closed: false, w: 0, lt: "CENTER", lts: annoK() }); c.l = layer; c.d = dashDisp(closed ? [...pts, pts[0]] : pts, LT.CENTER, annoK()); ch.push([c.h, c]); }
  commit(`${isWall ? "ผนัง" : "ท่อลม"} หนา ${fmt(th)} · ${pts.length - (closed ? 0 : 1)} ช่วง`, ch);
}
function pointIn(p, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { if ((poly[i][1] > p[1]) !== (poly[j][1] > p[1]) && p[0] < ((poly[j][0] - poly[i][0]) * (p[1] - poly[i][1])) / (poly[j][1] - poly[i][1]) + poly[i][0]) c = !c; } return c; }
function textEnt(p, s, h, layer) { const e = newEntity("TEXT", { p, h, rot: 0, s, ha: 0, va: 0 }); e.l = layer; return e; }
/** ตาราง (เส้น + ข้อความ) วางที่มุมซ้ายบน p */
function placeTable(p, head, rows, cols, label) {
  const k = annoK(), h = 2.5 * k, rh = 6 * k, cw = cols.map((c) => c * k), W = cw.reduce((a, b) => a + b, 0), n = rows.length + 1, ch = [];
  ensureLayer("G-ANNO");
  const ln = (a, b) => { const e = newEntity("LINE", { a, b }); e.l = "G-ANNO"; ch.push([e.h, e]); };
  for (let i = 0; i <= n; i++) ln([p[0], p[1] - i * rh], [p[0] + W, p[1] - i * rh]);
  let x = p[0]; for (let j = 0; j <= cw.length; j++) { ln([x, p[1]], [x, p[1] - n * rh]); x += cw[j] || 0; }
  const cell = (i, j, s) => { const x0 = p[0] + cw.slice(0, j).reduce((a, b) => a + b, 0); const t = textEnt([x0 + 1.5 * k, p[1] - i * rh - rh / 2 - h * 0.4], String(s), h, "G-ANNO"); ch.push([t.h, t]); };
  head.forEach((s, j) => cell(0, j, s)); rows.forEach((r, i) => r.forEach((s, j) => cell(i + 1, j, s)));
  commit(`${label} ${rows.length} แถว`, ch);
}
function tableDialog(title, head, rows, note) {
  showDlg(title, note || "");
  $("#dlg-body").innerHTML = `<div style="max-height:52vh;overflow:auto"><table class="k"><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table></div>
    <div class="row"><button id="tbl-put" class="go">วางตารางลงแบบ</button><button id="tbl-csv">คัดลอกเป็น CSV (วางใน Excel)</button></div>`;
  return new Promise((res) => {
    const close = $("#dlg-close"), prev = close.onclick, done = (v) => { close.onclick = prev; closeDlg(); res(v); };
    $("#tbl-put").onclick = () => done(true); close.onclick = () => done(null);
    $("#tbl-csv").onclick = () => { const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n"); navigator.clipboard.writeText(csv).then(() => dlgMsg("คัดลอกแล้ว — วางใน Excel ได้เลย"), () => dlgMsg("คัดลอกไม่ได้ในเบราว์เซอร์นี้")); };
  });
}
const symName = (n) => (n.startsWith("ASCA_") && SY.SYMS[n.slice(5)] ? SY.SYMS[n.slice(5)].th : (UI.ENTRIES.get("L:" + n) || {}).th || n);
Object.assign(CMDS, {
  *WIRE() { yield* routeCmd("WIRE"); }, *BUS() { yield* routeCmd("BUS"); }, *PIPE() { yield* routeCmd("PIPE"); },
  *PCW() { yield* routeCmd("PCW"); }, *PHW() { yield* routeCmd("PHW"); }, *PS() { yield* routeCmd("PS"); }, *PW() { yield* routeCmd("PW"); },
  *PV() { yield* routeCmd("PV"); }, *PRD() { yield* routeCmd("PRD"); }, *PSIG() { yield* routeCmd("PSIG"); }, *PWL() { yield* routeCmd("PWL"); },
  *WALL() { yield* bandCmd("WALL"); }, *DUCT() { yield* bandCmd("DUCT"); },
  *DOT() {
    for (;;) { const p = yield ask.point("DOT จุดต่อสาย — คลิกจุด [Enter=จบ]:"); if (!p || typeof p === "string") return; ensureLayer("E-WIRE"); const d = dotEntity(p, "E-WIRE"); commit("จุดต่อสาย", [[d.h, d]]); }
  },
  *POLYGON() {
    const n = Math.round(yield ask.num("POLYGON จำนวนด้าน:", lastNum("polyN", 6))); if (!(n >= 3 && n <= 128)) return; S.polyN = n;
    const c = yield ask.point("จุดศูนย์กลาง:"); if (!c || typeof c === "string") return;
    const mk = (q) => { const r = Math.hypot(q[0] - c[0], q[1] - c[1]), a0 = Math.atan2(q[1] - c[1], q[0] - c[0]); return Array.from({ length: n }, (_, i) => [c[0] + r * Math.cos(a0 + (i * 2 * Math.PI) / n), c[1] + r * Math.sin(a0 + (i * 2 * Math.PI) / n)]); };
    const q = yield ask.point("จุดยอด (หรือพิมพ์รัศมี):", c, (p) => [{ d: [[mk(p).flat(), 1]], x: [] }]); if (!q || typeof q === "string") return;
    addPline(mk(q), true);
  },
  *ROOM() {
    const p = yield ask.point("ROOM คลิกในห้อง (ในรูปปิด/ผนังรอบห้อง):"); if (!p || typeof p === "string") return;
    let best = null;
    for (const e of S.ents.values()) { if (!visible(e) || !(e.t === "LWPOLYLINE" || e.t === "CIRCLE")) continue; const b = H.closedBoundary(e, tol()); if (!b || !pointIn(p, b)) continue; const a = Math.abs(H.polyArea(b)); if (!best || a < best.a) best = { a, b }; }
    const name = yield ask.text("ชื่อห้อง:", "ห้อง"); if (!name) return;
    const k = annoK(), f = mmK(), ch = [];
    const t1 = textEnt([p[0], p[1]], name, 3 * k, "G-ANNO"); ch.push([t1.h, t1]);
    const t2 = textEnt([p[0], p[1] - 4.5 * k], best ? `${(best.a / (f * f) / 1e6).toFixed(2)} ตร.ม.` : "— ตร.ม.", 2.2 * k, "G-ANNO"); ch.push([t2.h, t2]);
    ensureLayer("G-ANNO"); commit(`ป้ายห้อง ${name}`, ch);
    if (!best) log("ไม่พบรูปปิดรอบจุดที่คลิก — พื้นที่ใส่ไม่ได้ (วาดผนัง/โพลีไลน์ปิดรอบห้องก่อน)");
  },
  *TAG() {
    for (;;) {
      const r = yield ask.pick("TAG คลิกสัญลักษณ์ที่จะตั้งชื่ออุปกรณ์ [Enter=จบ]:"); const e = pickE(r); if (!e) return;
      const at = attrsOf(e); if (e.t !== "INSERT" || !at || !("TAG" in at)) { log("สัญลักษณ์นี้ไม่มีช่องชื่ออุปกรณ์ (TAG)"); continue; }
      const v = yield ask.text(`ชื่ออุปกรณ์ใหม่ (ตอนนี้ ${at.TAG}):`, at.TAG); if (v == null) return;
      const x = (e.x || []).map((t) => (t[4] === at.TAG ? [...t.slice(0, 4), v, ...t.slice(5)] : t));
      commit(`TAG ${at.TAG} → ${v}`, [[e.h, { ...e, attrs: { ...at, TAG: v }, x }]]);
    }
  },
  *AUTONUM() {
    const groups = new Map();
    for (const e of S.ents.values()) { const at = attrsOf(e); if (e.t !== "INSERT" || !at || !at.TAG || locked(e)) continue; const pre = (at.TAG.match(/^[^\d]*[^\d-]/) || [""])[0]; if (!pre) continue; if (!groups.has(pre)) groups.set(pre, []); groups.get(pre).push(e); }
    const ch = [];
    for (const [pre, arr] of groups) {
      arr.sort((a, b) => (b.g.p[1] - a.g.p[1]) || (a.g.p[0] - b.g.p[0]));
      arr.forEach((e, i) => { const old = attrsOf(e).TAG, v = pre + (i + 1); if (old === v) return; ch.push([e.h, { ...e, attrs: { ...attrsOf(e), TAG: v }, x: (e.x || []).map((t) => (t[4] === old ? [...t.slice(0, 4), v, ...t.slice(5)] : t)) }]); });
    }
    if (!ch.length) return log("ชื่ออุปกรณ์เรียงเลขอยู่แล้ว (บน→ล่าง ซ้าย→ขวา)");
    commit(`เรียงเลขอุปกรณ์ใหม่ ${ch.length} ตัว (บน→ล่าง ซ้าย→ขวา)`, ch);
  },
  *BOM() {
    const m = new Map();
    for (const e of S.ents.values()) { if (e.t !== "INSERT" || !e.g || !visible(e)) continue; const r = m.get(e.g.name) || { n: 0, tags: [] }; r.n++; const t = (attrsOf(e) || {}).TAG; if (t) r.tags.push(t); m.set(e.g.name, r); }
    const rows = [...m.entries()].sort((a, b) => b[1].n - a[1].n).map(([n, r]) => [symName(n), r.n, r.tags.slice(0, 6).join(", ") + (r.tags.length > 6 ? " …" : "")]);
    if (!rows.length) return log("ยังไม่มีสัญลักษณ์ (Block) ในแบบ");
    const go = yield ask.wait(tableDialog("ตารางสรุปอุปกรณ์ (BOM)", ["อุปกรณ์", "จำนวน", "ชื่อในแบบ"], rows, "นับจาก Block ในแบบโดยตรง"), "ตาราง BOM ในหน้าต่าง…"); if (!go) return;
    const p = yield ask.point("มุมซ้ายบนของตาราง:"); if (!p || typeof p === "string") return;
    placeTable(p, ["อุปกรณ์", "จำนวน", "ชื่อในแบบ"], rows, [70, 18, 60], "ตาราง BOM");
  },
  *SENSLIST() {
    const rows = [];
    for (const e of S.ents.values()) {
      if (e.t !== "INSERT" || !e.g || !e.g.name.startsWith("ASCA_S_")) continue; const s = SY.SYMS[e.g.name.slice(5)]; if (!s) continue;
      const lab = s.prims.filter((q) => q[0] === "T").map((q) => q[4]);
      rows.push([(attrsOf(e) || {}).TAG || "-", s.th, lab[1] || "", SY.CATS[s.cat].t.replace("เซนเซอร์", ""), `${fmt(e.g.p[0])}, ${fmt(e.g.p[1])}`]);
    }
    rows.sort((a, b) => a[0].localeCompare(b[0], "en", { numeric: true }));
    if (!rows.length) return log("ยังไม่มีเซนเซอร์ในแบบ — วางจากแท็บ เซนเซอร์");
    const head = ["TAG", "จุดวัด", "ค่าที่วัด", "กลุ่ม", "X, Y"];
    const go = yield ask.wait(tableDialog("ตารางจุดตรวจวัด (เซนเซอร์)", head, rows, `${rows.length} จุด · ใช้เป็นรายการติดตั้ง/จุดต่อ Dashboard`), "ตารางจุดวัดในหน้าต่าง…"); if (!go) return;
    const p = yield ask.point("มุมซ้ายบนของตาราง:"); if (!p || typeof p === "string") return;
    placeTable(p, head, rows, [20, 62, 20, 22, 40], "ตารางจุดวัด");
  },
});
function clipCopy(cut) {
  const ents = [...S.sel].map((h) => S.ents.get(h)).filter((e) => e && !locked(e));
  if (!ents.length) return log("เลือกวัตถุก่อน แล้วกด Ctrl+C / Ctrl+X");
  const b = ents.map((e) => e.bb || (e.bb = G.bboxOf(e))).reduce((a, c) => [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[2], c[2]), Math.max(a[3], c[3])]);
  S.clip = { ents: ents.map((e) => ({ ...e })), base: [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], cut, used: false };
  if (cut) { commit(`ตัด ${ents.length} วัตถุ`, ents.map((e) => [e.h, null])); S.sel.clear(); renderProps(); }
  else log(`คัดลอก ${ents.length} วัตถุ (Ctrl+V วาง)`);
}
function* dimCmd(aligned) {
  const a = yield ask.point(`${aligned ? "DIMALIGNED" : "DIMLINEAR"} จุดแรก:`); if (!a) return;
  const b = yield ask.point("จุดที่สอง:", a, (q) => [ln(a, q)]); if (!b || typeof b === "string") return;
  const th = lastNum("dimTH", Math.max(Math.round(drawingSize() / 150 * 100) / 100, 0.001));
  const mk = (loc) => { const dg = H.dimGeom(a, b, loc, aligned ? "al" : "auto"); return { dg, disp: H.dimDisplay(dg, th) }; };
  const loc = yield ask.point("ตำแหน่งเส้นมิติ:", b, (q) => [mk(q).disp]); if (!loc || typeof loc === "string") return;
  const { dg, disp } = mk(loc);
  const n = newEntity("DIMENSION", { p1: dg.p1, p2: dg.p2, loc: dg.loc, angle: dg.angle, aligned, th });
  n.d = disp.d; n.x = disp.x; n.l = S.layers.has("A-DIMS") ? "A-DIMS" : S.clayer;
  commit(`มิติ ${H.fmtDim(dg.value)}`, [[n.h, n]]);
}
function hatchDisplay(g, sp) {
  const bd = [g.pts.flat(), 1, 256];
  if (g.pattern === "SOLID") return [[g.pts.flat(), 1, 256, 1]];
  return [bd, ...H.hatchLines(g.pts, sp, 45).map((f) => [f, 0, 256])];
}
function logArea(pts) {
  let per = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; per += Math.hypot(q[0] - p[0], q[1] - p[1]); }
  log(`พื้นที่ = ${fmt(Math.abs(H.polyArea(pts)))} · เส้นรอบรูป = ${fmt(per)}`);
}
function drawingSize() { const e = extents(); return Math.max(e[2] - e[0], e[3] - e[1], 1); }
function await_(promise) { return promise; }

/** ซูมเข้า/ออกรอบกลางจอ (k > 1 = เข้า) */
function zoomBy(k) { const v = S.view, cx = v.w / 2, cy = v.h / 2; v.ox = cx - (cx - v.ox) * k; v.oy = cy - (cy - v.oy) * k; v.s *= k; draw(); }
function runCommand(name) {
  name = ALIAS[name.toUpperCase()] || name.toUpperCase();
  if (name === "U") return undo();
  if (name === "REDO") return redo();
  if (name === "CUTCLIP" || name === "COPYCLIP") { if (!S.sel.size) return log("เลือกวัตถุก่อน"); return clipCopy(name === "CUTCLIP"); }   // ปุ่ม Ribbon ตัด/คัดลอก (เดิมขึ้น "ไม่รู้จักคำสั่ง")
  if (name === "SELALL") { S.sel = new Set([...S.ents.keys()].filter((h) => visible(S.ents.get(h)) && !locked(S.ents.get(h)))); renderProps(); return draw(); }
  if (name === "ZE") return zoomExtents();
  if (name === "ZIN") return zoomBy(1.4);
  if (name === "ZOUT") return zoomBy(1 / 1.4);
  if (name === "OPEN") return openDialog();
  if (name === "NEW") return newDoc();
  if (name === "SAVE") return save(false);
  if (name === "SAVEAS") return save(true);
  if (!CMDS[name]) return log(`ไม่รู้จักคำสั่ง "${name}"`);
  if (!S.doc) return toast("เปิดไฟล์หรือสร้างแบบใหม่ก่อน");
  cancel(true); S.pendingPt = null;
  S.lastCmd = name; S.cmd = CMDS[name](); log("คำสั่ง: " + (name === "SYM" ? "วางสัญลักษณ์" : name));
  UI.setActive(name === "SYM" ? "SYM:" + S.symKey : name);
  step(undefined);
}
function step(value) {
  if (!S.cmd) return;
  const r = S.cmd.next(value);
  if (r.done) { S.cmd = null; S.req = null; S.preview = null; prompt("คำสั่ง:"); UI.setActive(null); $("#dyn").hidden = true; draw(); return; }
  S.req = r.value; prompt(r.value.msg + (r.value.def != null ? ` <${r.value.def}>` : ""));
  S.preview = null; draw();
  if (r.value.kind === "wait") { const pr = r.value.promise; pr.then((v) => { if (S.req === r.value) step(v); }, (e) => { log(e.message); if (S.req === r.value) step(null); }); }
}
function cancel(silent) { if (S.cmd) { S.cmd.return(); S.cmd = null; S.req = null; S.preview = null; prompt("คำสั่ง:"); UI.setActive(null); $("#dyn").hidden = true; if (!silent) log("*ยกเลิก*"); draw(); } }

function feedText(txt) {
  const t = txt.trim(), R = S.req;
  if (!R) { if (!t) { if (S.lastCmd) runCommand(S.lastCmd); return; } return runCommand(t); }
  if (R.kind === "select") return step(S.sel.size > 0);
  if (R.kind === "pick") return step(t ? t.toUpperCase() : null);
  if (R.kind === "wait") return;
  if (!t) return step(R.def != null ? (R.kind === "num" ? Number(R.def) : R.def) : null);
  if (R.kind === "point") { const p = G.parsePoint(t, R.base, S.cursor); return step(p || t.toUpperCase()); }
  if (R.kind === "num") { const n = Number(t); if (!isNaN(n)) return step(n); const p = G.parsePoint(t, R.base, S.cursor); return step(p && R.base ? numFromPoint(R, p) : NaN); }
  return step(t);
}
function numFromPoint(R, p) { return R.msg.startsWith("มุม") ? angle(R.base, p) : Math.hypot(p[0] - R.base[0], p[1] - R.base[1]); }

// ---------------------------------------------------------------- เมาส์ + คีย์บอร์ด
let drag = null;
function inputPoint(raw) {
  let p = S.snap ? S.snap.p.slice() : raw;
  const R = S.req;
  if (S.ortho && R && R.base && !S.snap) { const dx = p[0] - R.base[0], dy = p[1] - R.base[1]; p = Math.abs(dx) > Math.abs(dy) ? [p[0], R.base[1]] : [R.base[0], p[1]]; }
  if (S.gsnap && !S.snap) { const st = S.gridMM * SY.unitFactor(S.doc && S.doc.insunits); p = [Math.round(p[0] / st) * st, Math.round(p[1] / st) * st]; }   // จับกริด (F9)
  return p;
}
cv.addEventListener("pointerdown", (e) => {
  cv.setPointerCapture(e.pointerId);
  const r = cv.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
  if (e.button === 1 || e.button === 2) { drag = { pan: true, x: sx, y: sy, ox: S.view.ox, oy: S.view.oy }; return; }
  const w = toW(sx, sy), R = S.req;
  S.clickSnap = S.snap;
  if (R && R.kind === "wait") { S.pendingPt = inputPoint(w); return; }        // คลิกระหว่างรอโหลด (เช่น สัญลักษณ์จากคลังเดิม) → ใช้เป็นจุดวางแรก
  if (R && (R.kind === "point" || R.kind === "num")) { const p = inputPoint(w); return step(R.kind === "num" ? numFromPoint(R, p) : p); }
  if (R && R.kind === "pick") { const hh = pick(w); if (hh) step({ h: hh, p: w }); else log("ไม่โดนวัตถุ"); return; }
  if (!R && gripDown(w)) return;
  const h = pick(w);
  if (h) { if (e.shiftKey) S.sel.delete(h); else S.sel.add(h); renderProps(); draw(); return; }
  drag = { win: true, a: [sx, sy] };
});
cv.addEventListener("pointermove", (e) => {
  const r = cv.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
  if (drag && drag.pan) { S.view.ox = drag.ox + sx - drag.x; S.view.oy = drag.oy + sy - drag.y; draw(); return; }
  S.cursor = toW(sx, sy);
  S.snap = (S.req && (S.req.kind === "point" || S.req.kind === "num")) || S.grip ? osnapAt(S.cursor, S.grip ? S.grip.h : null) : null;
  if (S.grip) { gripMove(S.snap ? S.snap.p : S.cursor); draw(); return; }
  const p = S.req ? inputPoint(S.cursor) : S.cursor;
  $("#coords").textContent = `${fmt(p[0])}, ${fmt(p[1])}` + (S.req && S.req.base ? `   ระยะ ${fmt(Math.hypot(p[0] - S.req.base[0], p[1] - S.req.base[1]))}  มุม ${fmt(angle(S.req.base, p))}°` : "");
  S.hover = true;
  const dyn = $("#dyn"), showDyn = UI.CURSOR.dyn && S.req && S.req.base && (S.req.kind === "point" || S.req.kind === "num");
  dyn.hidden = !showDyn;
  if (showDyn) { dyn.textContent = `ยาว ${fmt(Math.hypot(p[0] - S.req.base[0], p[1] - S.req.base[1]))} · ${fmt(((angle(S.req.base, p) % 360) + 360) % 360)}°`; dyn.style.left = sx + 18 + "px"; dyn.style.top = sy + 16 + "px"; }
  if (drag && drag.win) S.win = [drag.a, [sx, sy]];
  S.preview = S.req && S.req.preview ? S.req.preview(p) : null;
  draw();
});
cv.addEventListener("pointerup", (e) => {
  if (S.grip) { gripUp(); return; }
  if (drag && drag.win && S.win) {
    const [a, b] = S.win;
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 4) {
      const hs = windowSelect(toW(...a), toW(...b));
      for (const h of hs) e.shiftKey ? S.sel.delete(h) : S.sel.add(h);
      log(`เลือก ${hs.length} วัตถุ (รวม ${S.sel.size})`);
    } else if (!e.shiftKey && !S.req) S.sel.clear();
    renderProps();
  }
  drag = null; S.win = null; draw();
});
cv.addEventListener("wheel", (e) => {
  e.preventDefault();
  const r = cv.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top, w = toW(sx, sy);
  S.view.s *= Math.exp(-e.deltaY * 0.0015);
  S.view.ox = sx - w[0] * S.view.s; S.view.oy = sy + w[1] * S.view.s; draw();
}, { passive: false });
cv.addEventListener("auxclick", (e) => { if (e.button === 1 && e.detail === 2) zoomExtents(); });   // ดับเบิลคลิกล้อ = ดูทั้งหมด (dblclick ไม่เกิดกับปุ่มกลาง)
cv.addEventListener("pointerleave", () => { S.hover = false; $("#dyn").hidden = true; draw(); });
cv.addEventListener("contextmenu", (e) => e.preventDefault());
new ResizeObserver(resize).observe(cv);
const fmt = (v) => (Math.round(v * 1000) / 1000).toLocaleString("en-US", { maximumFractionDigits: 3 });

const cmd = $("#cmd");
cmd.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || (e.key === " " && !(S.req && S.req.kind === "text"))) { e.preventDefault(); const v = cmd.value; cmd.value = ""; feedText(v); }
  else if (e.key === "Escape") { cmd.value = ""; if (!S.cmd && UI.closeWins()) return; cancel(); S.sel.clear(); renderProps(); draw(); }
});
document.addEventListener("keydown", (e) => {
  if (e.target !== cmd && e.target.matches("input, select, textarea")) return;
  if (e.ctrlKey || e.metaKey) {
    const k = e.key.toLowerCase();
    if (e.key === "F1") { e.preventDefault(); UI.uiAction("UI:RIBBON"); }
    else if (k === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); } else if (k === "y") { e.preventDefault(); redo(); }
    else if (k === "s") { e.preventDefault(); save(false); } else if (k === "o") { e.preventDefault(); openDialog(); }
    else if (k === "n") { e.preventDefault(); newDoc(); }
    else if (k === "p") { e.preventDefault(); runCommand("PLOT"); }
    else if (k === "a") { e.preventDefault(); S.sel = new Set([...S.ents.keys()].filter((h) => visible(S.ents.get(h)) && !locked(S.ents.get(h)))); renderProps(); draw(); }
    else if (e.target === cmd && cmd.value && (k === "c" || k === "x" || k === "v")) return;   // คัดลอก/วางข้อความในบรรทัดคำสั่งตามปกติ
    else if (k === "c") { e.preventDefault(); clipCopy(false); }
    else if (k === "x") { e.preventDefault(); clipCopy(true); }
    else if (k === "v") { e.preventDefault(); runCommand("PASTE"); }
    else if (k === "d") { e.preventDefault(); if (!S.sel.size) return log("เลือกวัตถุก่อน แล้วกด Ctrl+D"); clipCopy(false); runCommand("PASTE"); }
    return;
  }
  if (e.key === "F1" && e.shiftKey) { e.preventDefault(); UI.showKeys(); return; }   // F1 เฉย ๆ = โหมดช่วยเหลือ (ai/help.js)
  if (e.key === "F3") { e.preventDefault(); toggle("osnap"); return; }
  if (e.key === "F7") { e.preventDefault(); toggle("grid"); return; }
  if (e.key === "F9") { e.preventDefault(); toggle("gsnap"); return; }
  if (e.key === "F8") { e.preventDefault(); toggle("ortho"); return; }
  if (S.req && S.req.keys && !e.altKey && !(e.target === cmd && cmd.value)) {   // ปุ่มเฉพาะคำสั่ง เช่น R/F ตอนวางสัญลักษณ์ · Tab ตอนลากสาย
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (S.req.keys(key)) { e.preventDefault(); S.preview = S.req.preview ? S.req.preview(inputPoint(S.cursor)) : null; draw(); return; }
  }
  if (e.target === cmd) return;
  if (e.key === "Delete" && S.sel.size && !S.cmd) { runCommand("ERASE"); return; }
  if (e.key === "Escape") { if (!S.cmd && UI.closeWins()) return; cancel(); S.sel.clear(); renderProps(); draw(); return; }
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); feedText(""); return; }
  if (e.key.length === 1 && !e.altKey) { cmd.focus(); }      // พิมพ์ที่ไหนก็ได้ → ไปที่บรรทัดคำสั่ง (แบบ AutoCAD)
});
const TOG = { osnap: "OSNAP", ortho: "ORTHO", grid: "GRID", gsnap: "SNAP" };
function toggle(k) { S[k] = !S[k]; $("#t-" + k).classList.toggle("on", S[k]); log(`${TOG[k]} ${S[k] ? "เปิด" : "ปิด"}`); if (k === "grid" || k === "gsnap") UI.store.set(k, S[k]); UI.refresh(); draw(); }
for (const k of Object.keys(TOG)) { $("#t-" + k).onclick = () => toggle(k); $("#t-" + k).classList.toggle("on", !!S[k]); }
$("#grid-mm").value = String(S.gridMM); $("#grid-mm").onchange = (e) => { S.gridMM = Number(e.target.value); UI.store.set("gridMM", S.gridMM); draw(); };
/** Layer ปัจจุบัน (แถบล่าง + Ribbon หน้าแรก): มีวัตถุที่เลือก = ย้ายวัตถุไป layer นั้นด้วย (แบบ AutoCAD) */
function setLayer(n) {
  if (!S.layers.has(n)) return;
  const sel = [...S.sel].map((h) => S.ents.get(h)).filter((e) => e && !locked(e));
  if (sel.length) commit(`ย้าย ${sel.length} วัตถุไป layer ${n}`, sel.map((e) => [e.h, { ...e, l: n }]));
  S.clayer = n; S.dirty = true; savedLabel(); renderLayers(); syncLayerSel();
}
function syncLayerSel() {
  const html = [...S.layers.keys()].sort((a, b) => a.localeCompare(b)).map((n) => `<option ${n === S.clayer ? "selected" : ""}>${esc(n)}</option>`).join("");
  for (const id of ["#layer-sel", "#layer-rib"]) { const el = $(id); if (el && el.innerHTML !== html) el.innerHTML = html; if (el) el.value = S.clayer; }
}
$("#layer-sel").onchange = (e) => setLayer(e.target.value);
document.addEventListener("change", (e) => { if (e.target.id === "layer-rib") setLayer(e.target.value); });
document.body.addEventListener("click", (e) => { const b = e.target.closest("button[data-cmd]"); if (b) { runCommand(b.dataset.cmd); cmd.focus(); } });


// ---------------------------------------------------------------- grip: ลากจุดสีฟ้าของวัตถุที่เลือกเพื่อแก้ (แบบ AutoCAD)
function grips() {
  if (S.sel.size === 0 || S.sel.size > 40) return [];
  const out = [];
  for (const h of S.sel) {
    const e = S.ents.get(h); if (!e || !e.g || locked(e)) continue;
    const g = e.g;
    if (e.t === "LINE") out.push({ h, key: h + ":a", k: "a", p: g.a }, { h, key: h + ":b", k: "b", p: g.b }, { h, key: h + ":m", k: "move", p: [(g.a[0] + g.b[0]) / 2, (g.a[1] + g.b[1]) / 2] });
    else if (e.t === "LWPOLYLINE") g.pts.forEach((p, i) => out.push({ h, key: h + ":" + i, k: "v", i, p: [p[0], p[1]] }));
    else if (e.t === "CIRCLE") out.push({ h, key: h + ":c", k: "move", p: g.c }, { h, key: h + ":r", k: "r", p: [g.c[0] + g.r, g.c[1]] });
    else if (e.t === "ARC") out.push({ h, key: h + ":c", k: "move", p: g.c });
    else if (g.p) out.push({ h, key: h + ":p", k: "move", p: g.p });
  }
  return out;
}
function gripDown(w) {
  const tol = 6 / S.view.s;
  const gp = grips().find((q) => Math.abs(q.p[0] - w[0]) < tol && Math.abs(q.p[1] - w[1]) < tol);
  if (!gp) return false;
  S.grip = { ...gp, orig: S.ents.get(gp.h) }; prompt("ลาก grip ไปตำแหน่งใหม่ (OSNAP ใช้ได้)"); return true;
}
function gripEdit(e, gp, p) {
  const g = e.g;
  if (gp.k === "move") return G.transformEntity(e, G.translate(p[0] - gp.p[0], p[1] - gp.p[1]));
  let ng = null;
  if (gp.k === "a" || gp.k === "b") ng = { ...g, [gp.k]: [p[0], p[1]] };
  else if (gp.k === "v") ng = { ...g, pts: g.pts.map((q, i) => (i === gp.i ? [p[0], p[1], q[2] || 0] : q)) };
  else if (gp.k === "r") ng = { ...g, r: Math.max(1e-6, Math.hypot(p[0] - g.c[0], p[1] - g.c[1])) };
  if (!ng) return e;
  return { ...e, g: ng, ...G.displayOf(e.t, ng, tol(), 256) };
}
function gripMove(p) { const gp = S.grip; S.preview = [gripEdit(gp.orig, gp, p)]; }
function gripUp() {
  const gp = S.grip; S.grip = null; S.preview = null; prompt("คำสั่ง:");
  const p = S.snap ? S.snap.p : S.cursor;
  if (Math.hypot(p[0] - gp.p[0], p[1] - gp.p[1]) * S.view.s < 1) { draw(); return; }
  const n = gripEdit(gp.orig, gp, p); commit("แก้ด้วย grip", [[gp.h, n]]);
}

// ---------------------------------------------------------------- แผงคุณสมบัติ
const GFIELDS = {
  LINE: [["a", "จุดเริ่ม x,y", "pt"], ["b", "จุดปลาย x,y", "pt"]],
  CIRCLE: [["c", "ศูนย์กลาง x,y", "pt"], ["r", "รัศมี", "n"]],
  ARC: [["c", "ศูนย์กลาง x,y", "pt"], ["r", "รัศมี", "n"], ["a0", "มุมเริ่ม", "n"], ["a1", "มุมจบ", "n"]],
  TEXT: [["s", "ข้อความ", "s"], ["h", "ความสูง", "n"], ["rot", "มุม", "n"], ["p", "ตำแหน่ง x,y", "pt"]],
  MTEXT: [["s", "ข้อความ", "ml"], ["h", "ความสูง", "n"], ["rot", "มุม", "n"], ["p", "ตำแหน่ง x,y", "pt"]],
  LWPOLYLINE: [["closed", "ปิดรูป", "b"], ["w", "ความกว้างเส้น", "n"]],
  POINT: [["p", "ตำแหน่ง x,y", "pt"]],
};
function renderProps() {
  const box = $("#props"), sel = [...S.sel].map((h) => S.ents.get(h)).filter(Boolean);
  $("#count").textContent = S.doc ? `${S.ents.size.toLocaleString()} วัตถุ` + (sel.length ? ` · เลือก ${sel.length}` : "") : "";
  if (!sel.length) { box.innerHTML = '<p class="muted small">คลิกเลือกวัตถุ · ลากกรอบ ซ้าย→ขวา = เต็มกรอบ · ขวา→ซ้าย = แตะกรอบ · Shift = เอาออก · Ctrl+A ทั้งหมด</p>'; return; }
  const types = [...new Set(sel.map((e) => e.t))], one = sel.length === 1 ? sel[0] : null;
  const lay = [...S.layers.keys()].sort((a, b) => a.localeCompare(b));
  const same = (k) => sel.every((e) => e[k] === sel[0][k]) ? sel[0][k] : "";
  let html = `<label>ชนิด<span>${types.join(", ")}${sel.length > 1 ? ` (${sel.length})` : ""}</span></label>
    <label>Layer<select data-k="l">${same("l") === "" ? '<option value="">(หลายค่า)</option>' : ""}${lay.map((n) => `<option ${n === same("l") ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
    <label>สี<input data-k="c" value="${same("c") === 256 ? "ByLayer" : same("c") === 0 ? "ByBlock" : same("c")}" title="ByLayer หรือเลข ACI 1–255"></label>`;
  if (one && one.g && GFIELDS[one.t]) html += GFIELDS[one.t].map(([k, lab, kind]) => {
    const v = one.g[k];
    if (kind === "ml") return `<label>${lab}<textarea data-g="${k}">${esc(v)}</textarea></label>`;
    if (kind === "b") return `<label>${lab}<input type="checkbox" data-g="${k}" data-kind="b" ${v ? "checked" : ""}></label>`;
    return `<label>${lab}<input data-g="${k}" data-kind="${kind}" value="${esc(kind === "pt" ? v.map(fmt).join(", ") : kind === "n" ? fmt(v) : v)}"></label>`;
  }).join("");
  if (one && !one.g) html += '<p class="muted small">วัตถุนี้แก้ค่าโดยตรงยังไม่ได้ (ย้าย/หมุน/ย่อ/สะท้อน/ลบ/เปลี่ยน layer ได้) — ส่วนอื่นคงเดิมตอนบันทึก</p>';
  if (one && one.t === "INSERT") {
    const sym = one.g.name.startsWith("ASCA_") && SY.SYMS[one.g.name.slice(5)], at = attrsOf(one) || {};
    html += `<label>Block<span>${esc(one.g.name)}${sym ? " · " + esc(sym.th) : ""}</span></label>` +
      Object.entries(at).map(([k, v]) => `<label>${k === "TAG" ? "ชื่ออุปกรณ์ (TAG)" : esc(k)}<input data-attr="${esc(k)}" value="${esc(v)}"></label>`).join("");
  }
  box.innerHTML = html;
  box.querySelectorAll("[data-attr]").forEach((inp) => inp.addEventListener("change", () => {
    const k = inp.dataset.attr, old = (attrsOf(one) || {})[k], v = inp.value;
    const x = (one.x || []).map((t) => (t[4] === old ? [...t.slice(0, 4), v, ...t.slice(5)] : t));
    commit(`แก้ ${k} = ${v}`, [[one.h, { ...one, attrs: { ...(attrsOf(one) || {}), [k]: v }, x }]]);
  }));
  box.querySelectorAll("[data-k]").forEach((inp) => inp.addEventListener("change", () => {
    const k = inp.dataset.k; let v = inp.value;
    if (k === "c") { v = /^bylayer$/i.test(v) ? 256 : /^byblock$/i.test(v) ? 0 : Number(v); if (!(v >= 0 && v <= 256)) return toast("สี: ByLayer หรือ 1–255"); }
    if (k === "l" && !v) return;
    commit(`เปลี่ยน${k === "l" ? " layer" : "สี"} ${sel.length} วัตถุ`, sel.map((e) => [e.h, { ...e, [k]: v }]));
  }));
  box.querySelectorAll("[data-g]").forEach((inp) => inp.addEventListener("change", () => {
    const k = inp.dataset.g, kind = inp.dataset.kind; let v;
    if (kind === "pt") { v = inp.value.split(/[ ,]+/).map(Number); if (v.length !== 2 || v.some(isNaN)) return toast("พิมพ์เป็น x, y"); }
    else if (kind === "n") { v = Number(inp.value); if (isNaN(v)) return toast("ต้องเป็นตัวเลข"); }
    else if (kind === "b") v = inp.checked; else v = inp.value;
    const g = { ...one.g, [k]: v }, disp = G.displayOf(one.t, g, tol(), 256);
    commit(`แก้ ${one.t}`, [[one.h, { ...one, g, ...(disp ? { d: disp.d, x: disp.x } : {}) }]]);
  }));
}

// ---------------------------------------------------------------- Layer
function renderLayers() {
  setTimeout(syncLayerSel, 0);
  const q = $("#layer-q").value.trim().toLowerCase();
  const list = [...S.layers.values()].filter((L) => !q || L.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
  $("#layers").innerHTML = list.map((L) => `<div class="layer ${L.name === S.clayer ? "cur" : ""}" data-n="${esc(L.name)}">
    <span class="ic" data-a="on" title="เปิด/ปิด">${L.on !== false && !L.frozen ? "💡" : "⚫"}</span><span class="ic" data-a="lock" title="ล็อก">${L.locked ? "🔒" : "🔓"}</span>
    <i style="background:${aciColor(L.color, ink())}" data-a="color" title="สี ${L.color}"></i><span title="ดับเบิลคลิก = layer ปัจจุบัน">${esc(L.name)}</span></div>`).join("");
}
$("#layer-q").addEventListener("input", renderLayers);
$("#layers").addEventListener("click", (e) => {
  const row = e.target.closest(".layer"); if (!row) return;
  const L = S.layers.get(row.dataset.n), a = e.target.dataset.a; if (!L) return;
  if (a === "on") changeLayer(L, { on: !(L.on !== false && !L.frozen), frozen: false });
  else if (a === "lock") changeLayer(L, { locked: !L.locked });
  else if (a === "color") { const c = Number(prompt_("สี ACI (1–255)", L.color)); if (c >= 1 && c <= 255) changeLayer(L, { color: c }); }
});
$("#layers").addEventListener("dblclick", (e) => { const row = e.target.closest(".layer"); if (row) { S.clayer = row.dataset.n; S.dirty = true; savedLabel(); renderLayers(); log("layer ปัจจุบัน: " + S.clayer); } });
const prompt_ = (m, d) => window.prompt(m, d);
function changeLayer(L, patch) {
  const before = { ...L }, after = { ...L, ...patch };
  S.layers.set(L.name, after); S.layerCh.set(L.name, { name: L.name, color: after.color, on: after.on !== false, frozen: !!after.frozen, locked: !!after.locked });
  S.undo.push({ label: "layer " + L.name, before: new Map(), after: new Map(), layers: { before: [before], after: [after] } }); S.redo = [];
  touched(); renderLayers();
}
function restoreLayers(list) { for (const L of list) { S.layers.set(L.name, { ...L }); S.layerCh.set(L.name, { name: L.name, color: L.color, on: L.on !== false, frozen: !!L.frozen, locked: !!L.locked }); } renderLayers(); }
function addLayer(name) {
  if (S.layers.has(name)) return toast("มี layer นี้แล้ว");
  const L = { name, color: 7, on: true, frozen: false, locked: false };
  S.layers.set(name, L); S.layerCh.set(name, { name, color: 7, on: true, frozen: false, locked: false }); S.clayer = name;
  S.dirty = true; savedLabel(); renderLayers(); log("เพิ่ม layer " + name + " (เป็น layer ปัจจุบัน)");
}
$("#layer-add").onclick = (e) => { e.preventDefault(); const n = prompt_("ชื่อ layer ใหม่", ""); if (n) addLayer(n.trim()); };

// ---------------------------------------------------------------- เริ่ม
async function newDoc() { if (S.dirty && !confirm("แบบปัจจุบันยังไม่บันทึก — สร้างแบบใหม่?")) return; try { load(await api("/api/cad/new", {})); } catch (e) { toast(e.message); } }
window.addEventListener("beforeunload", (e) => { if (S.dirty) { e.preventDefault(); e.returnValue = ""; } });
window.__cad = S;
window.__cadDbg = { grips, gripDown, pick };
// ผู้ช่วย AI piBot: สถานะหน้า (ตัวเลขจากโค้ด) + ต่อไปทำอะไร
window.ascaAI = {
  page: () => "cad",
  pageName: () => "CAD 2D",
  facts: () => ({ "ไฟล์": S.doc ? (S.doc.file ? "เปิดไฟล์อยู่" : "แบบใหม่ ยังไม่บันทึก") : "ยังไม่เปิด", "วัตถุ": S.ents.size, "layer": S.layers.size,
    "หน่วย": $("#units").textContent, "โหมด": S.ro ? "ดูก่อน (ไฟล์ใหญ่ — แก้บางส่วนได้)" : S.doc && S.doc.partial ? `แก้บางส่วน ${S.doc.partial.count} วัตถุ` : "แก้ได้ทั้งไฟล์", "แก้แล้วยังไม่บันทึก": S.dirty ? "ใช่" : "ไม่", "OSNAP": S.osnap ? "เปิด" : "ปิด", "ORTHO": S.ortho ? "เปิด" : "ปิด",
    "มาตราส่วนสัญลักษณ์": "1:" + S.anno, "สัญลักษณ์ในคลัง": UI.ENTRIES.size }),
  next() {
    const opened = !!(S.doc && (S.doc.file || S.ents.size)), unitless = S.doc && !S.doc.insunits;
    const steps = [
      { done: opened, say: "เปิดไฟล์ DWG / DXF / PDF จาก CAD (หรือวาดใหม่ด้วย L, PL, REC)", act: { tool: "press", key: "OPEN", label: "เปิด" } },
      ...(opened && unitless ? [{ done: false, say: "ไฟล์ไม่ระบุหน่วย — ตรวจขนาดด้วย DI (วัดระยะ) ถ้าไม่ตรงใช้ CAL ตั้งระยะจากเส้นที่รู้ระยะ", act: { tool: "press", key: "CAL", label: "ตั้งระยะ" } }] : []),
      ...(S.ro && S.doc.partial_ok ? [{ done: false, say: "ไฟล์ใหญ่เปิดแบบดูก่อน — กด ✂ แก้บางส่วน เลือก layer หรือลากกรอบพื้นที่ที่จะแก้", act: { tool: "press", key: "PARTIAL", label: "✂ แก้บางส่วน" } }] : []),
      { done: !S.dirty && opened && !S.ro, say: S.ro ? "ไฟล์ใหญ่: แก้บางส่วนก่อน แล้วจึงบันทึก" : "แก้แบบแล้วบันทึก (Ctrl+S) หรือ บันทึกเป็น… DWG/DXF", act: S.ro ? null : { tool: "press", key: "SAVE", label: "บันทึก" } },
      { done: false, say: "Plot เป็น PDF พร้อมกรอบชื่อ (Ctrl+P)", act: { tool: "press", key: "PLOT", label: "🖨 Plot PDF" } },
    ];
    return [...steps.filter((x) => x.done).slice(-1), ...steps.filter((x) => !x.done).slice(0, 3)];
  },
  sets: {},
  // ผู้ช่วยสั่งงาน (ai/actions.js ตรวจชื่อคำสั่งกับรายการนี้ก่อน · ผู้ใช้กด ทำเลย บนการ์ดก่อนทุกครั้ง) · NEW ไม่ให้ผู้ช่วยสั่ง
  commands: () => [...new Set([...Object.keys(CMDS), ...Object.keys(ALIAS), "OPEN", "SAVE", "SAVEAS", "U", "REDO", "ZE", "ZIN", "ZOUT"])].filter((c) => c !== "NEW"),
  run(name, p = {}) {
    if (name === "file.open") { runCommand("OPEN"); return { ok: true, msg: "เปิดหน้าต่างเลือกไฟล์แล้ว" }; }
    if (name === "cad.command") { runCommand(p.name); return { ok: true, msg: `เริ่มคำสั่ง ${String(p.name).toUpperCase()} — ทำต่อที่บรรทัดคำสั่ง หรือคลิกในแบบ` }; }
    return { ok: false, msg: `หน้านี้ทำคำสั่ง ${name} ไม่ได้` };
  },
};

// เมนู Ribbon + แถบลอย + คลังสัญลักษณ์
UI.initUI({
  place: (key) => { S.symKey = key; runCommand("SYM"); },
  state: (k) => S[{ OSNAP: "osnap", ORTHO: "ortho", GRID: "grid", SNAP: "gsnap" }[k] || k.toLowerCase()],
  toggle,
  redraw: draw,
  log,
  layersChanged: syncLayerSel,
  select: () => { cancel(); S.sel.clear(); renderProps(); draw(); log("โหมดเลือก: คลิกวัตถุ หรือลากกรอบ"); },
  dropAt: (key, clientX, clientY) => {
    const r = cv.getBoundingClientRect(); let p = toW(clientX - r.left, clientY - r.top);
    const sn = osnapAt(p); if (sn) p = sn.p;
    S.dropPt = p; S.symKey = key; runCommand("SYM");
  },
});
const annoSel = $("#anno");
annoSel.value = String(S.anno); if (annoSel.value !== String(S.anno)) annoSel.value = "50";
annoSel.onchange = () => { S.anno = Number(annoSel.value); UI.store.set("anno", S.anno); log(`มาตราส่วนสัญลักษณ์ 1:${S.anno} (ใช้กับชิ้นที่วางต่อจากนี้)`); };
Object.assign(window.__cadDbg, { clipCopy, pinsOf, buildChanges, nextTag });

const qf = new URLSearchParams(location.search).get("file");
resize();
if (CLOUD) { prompt("รุ่นออนไลน์: CAD 2D ต้องใช้รุ่นในเครื่อง"); }
else if (qf) openPath(qf); else { newDoc(); log("พิมพ์ OPEN หรือกดปุ่ม เปิด เพื่อเปิดไฟล์ DWG/DXF"); }
