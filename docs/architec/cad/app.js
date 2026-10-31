// CAD 2D ของ ASC Architect — เปิด/แก้/บันทึก DWG·DXF แบบ AutoCAD (โดย ลุงพี)
// เอกสารจริงอยู่ฝั่ง server (ezdxf) · หน้านี้ถือสำเนาวัตถุใน model space + จดสิ่งที่เปลี่ยน แล้วส่งไปตอนบันทึก
import * as G from "./geom.js?v=0.17.0";
import * as H from "./geom2.js?v=0.17.0";
import { aciColor } from "../editor/cadlayer.js?v=0.17.0";
import { plotFormHTML, wirePlotForm, readPlotForm } from "../plotform.js?v=0.17.0";

const $ = (s) => document.querySelector(s);
const CLOUD = window.PA_MODE === "cloud";
const cv = $("#cv"), ctx = cv.getContext("2d");

// ---------------------------------------------------------------- สถานะ
const S = {
  doc: null, ents: new Map(), order: [], layers: new Map(), clayer: "0",
  sel: new Set(), undo: [], redo: [], touched: new Set(), layerCh: new Map(), dirty: false,
  view: { s: 1, ox: 0, oy: 0, dpr: 1, w: 0, h: 0 }, cursor: [0, 0], snap: null,
  osnap: true, ortho: false, seq: 0, cache: null, index: null, cmd: null, req: null, lastCmd: null, preview: null, win: null,
};
const isTemp = (h) => h.startsWith("~");
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
  $("#docname").textContent = d.name + (d.source === "dwg" ? " (DWG)" : "") + (S.ro ? " · ดูอย่างเดียว" : "") + (d.asc ? " · ASC Studio" : "");
  document.title = d.name + " · CAD 2D";
  $("#units").textContent = ({ 0: "หน่วย: ไม่ระบุ", 1: "นิ้ว", 2: "ฟุต", 4: "มม.", 5: "ซม.", 6: "ม." })[d.insunits] || `หน่วย ${d.insunits}`;
  $("#info").innerHTML = `ไฟล์: ${esc(d.file || "(ยังไม่บันทึก)")}<br>รุ่น DXF: ${d.version}<br>วัตถุใน model space: ${d.entities.length.toLocaleString()}<br>block: ${d.blocks.length}<br>` +
    `ตรวจไฟล์: แก้ ${d.audit.fixes} · ผิดพลาด ${d.audit.errors}<br>เปิดใช้เวลา ${d.seconds} วินาที` +
    (d.asc ? "<br>ไฟล์ของ ASC Studio — บันทึกเป็นสำเนาใน out/asc_studio/ (ไม่แก้ต้นฉบับ)" : "") + (d.note ? `<br><b>${esc(d.note)}</b>` : "");
  savedLabel(); renderLayers(); renderProps(); zoomExtents();
  log(`เปิด ${d.name}: ${d.entities.length.toLocaleString()} ${S.ro ? "กลุ่มเส้น" : "วัตถุ"} · ${d.layers.length} layer`);
  if (d.note) { log(d.note); if (S.ro) toast(d.note); }
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
    const big = 50 * 1048576;
    const btn = (f, label) => `<button data-path="${esc(f.path)}" data-q="${esc(f.path.toLowerCase())}"><span>${f.kind === "dwg" ? "📐" : "📄"} ${esc(label)}` +
      `${f.dxf ? ' <small class="muted">(มี DXF ที่แปลงไว้)</small>' : ""}</span><small class="muted">${(f.size / 1048576).toFixed(1)} MB${f.kind === "dxf" && f.size > big ? " · ดูอย่างเดียว" : ""}</small></button>`;
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
  const ch = { layers: [...S.layerCh.values()], clayer: S.clayer, deleted: [], modified: [], copies: [], added: [] }, temps = { added: [], copies: [] };
  for (const h of S.touched) {
    const e = S.ents.get(h);
    if (isTemp(h)) {
      if (!e) continue;
      if (e.mk) { ch.makeblocks = ch.makeblocks || []; ch.makeblocks.push({ ...e.mk, l: e.l }); continue; }
      if (e.from) { ch.copies.push({ from: e.from, m: e.m, l: e.l, c: e.c }); temps.copies.push(h); }
      else { ch.added.push({ t: e.t, l: e.l, c: e.c, g: e.g }); temps.added.push(h); }
    } else if (!e) ch.deleted.push(h);
    else {
      const m = { h, l: e.l, c: e.c };
      if (e.explode) m.explode = true;
      if (e.g && e.t !== "INSERT") m.g = e.g;
      if (e.m && (!e.g || e.t === "INSERT")) m.m = e.m;
      ch.modified.push(m);
    }
  }
  return { ch, temps };
}

async function save(asNew) {
  if (!S.doc) return;
  if (S.ro) return toast("ไฟล์ใหญ่เปิดแบบดูอย่างเดียว — บันทึกไม่ได้");
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
  dlgMsg("กำลังบันทึก…"); log("กำลังบันทึก…");
  try {
    const r = await api("/api/cad/save", { id: S.doc.id, changes: ch, target, format: fmt });
    await synced(r, temps);
    S.dirty = false;
    S.doc.file = r.saved; S.doc.name = r.saved.split("/").pop();
    $("#docname").textContent = S.doc.name; closeDlg(); savedLabel(); S.cache = null; draw();
    log(`บันทึก ${r.saved} (${r.via})` + (r.backup ? ` · สำรองไฟล์เดิมไว้ที่ ${r.backup}` : ""));
    toast(`บันทึก ${r.saved} แล้ว (${r.via})`);
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
  for (const e of S.ents.values()) if (e.m) e.m = null;
  S.touched.clear(); S.layerCh.clear(); S.undo = []; S.redo = [];
  if (r.refresh) {                                       // แตก block / สร้าง block → อ่านรายการวัตถุจาก server ใหม่ (คงมุมมองเดิม)
    const v = { ...S.view }, lst = await api("/api/cad/listing", { id: S.doc.id });
    S.ents.clear(); S.order = []; S.sel.clear();
    for (const e of lst.entities) { e.orig = true; S.ents.set(e.h, e); S.order.push(e.h); }
    S.doc.blocks = lst.blocks; S.view = v; S.index = null;
  }
}

// ---------------------------------------------------------------- Plot PDF (ขั้นที่ 4)
function plotDialog() {
  if (S.ro) { toast("ไฟล์ใหญ่เปิดแบบดูอย่างเดียว — plot ไม่ได้ (พิมพ์จาก AutoCAD/ZWCAD)"); return Promise.resolve(null); }
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
  if (S.ro) { toast("ไฟล์นี้เปิดแบบดูอย่างเดียว (ไฟล์ใหญ่) — แก้ไม่ได้"); return; }
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
  const groups = new Map(), texts = [], images = [];
  S.fills = new Map();
  for (const h of S.order) {
    const e = S.ents.get(h); if (!e || !visible(e)) continue;
    if (e.img) images.push(e);
    const col = colorOf(e);
    let p = groups.get(col); if (!p) { p = new Path2D(); groups.set(col, p); }
    for (const [f, cl, sc, fill] of e.d) {
      if (fill) { let fp = S.fills.get(col); if (!fp) S.fills.set(col, (fp = new Path2D())); fp.moveTo(f[0], f[1]); for (let i = 2; i < f.length; i += 2) fp.lineTo(f[i], f[i + 1]); fp.closePath(); continue; }
      const pp = sc && sc !== 256 && sc !== 0 && sc !== e.c ? subPath(groups, aciColor(Math.abs(sc), ink())) : p;
      pp.moveTo(f[0], f[1]); for (let i = 2; i < f.length; i += 2) pp.lineTo(f[i], f[i + 1]); if (cl) pp.closePath();
    }
    for (const t of e.x || []) texts.push([t, col, h]);
  }
  S.cache = { groups, texts, images };
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
  return isFinite(x0) ? [x0, y0, x1, y1] : [0, 0, 1000, 1000];
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
  ctx.setTransform(v.s * v.dpr, 0, 0, -v.s * v.dpr, v.ox * v.dpr, v.oy * v.dpr);
  ctx.lineWidth = 1 / v.s; ctx.lineJoin = ctx.lineCap = "round";
  for (const e of S.cache.images) paintImage(e);
  for (const [col, p] of S.fills || []) { ctx.fillStyle = col; ctx.globalAlpha = 0.85; ctx.fill(p, "evenodd"); ctx.globalAlpha = 1; }
  for (const [col, p] of S.cache.groups) { ctx.strokeStyle = col; ctx.stroke(p); }
  for (const [[x, y, h, rot, s], col] of S.cache.texts) {
    if (h * v.s < 2.5) continue;
    ctx.save(); ctx.translate(x, y); ctx.rotate((rot * Math.PI) / 180); ctx.scale(1, -1);
    ctx.fillStyle = col; ctx.font = `${h * 1.35}px Tahoma, sans-serif`;
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
  const [cx, cy] = toS(S.cursor); ctx.strokeStyle = ink(); ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx - 14, cy); ctx.lineTo(cx + 14, cy); ctx.moveTo(cx, cy - 14); ctx.lineTo(cx, cy + 14); ctx.stroke(); ctx.globalAlpha = 1;
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
  for (const e of ents) for (const sp of G.snapPoints(e)) consider(sp.p, sp.kind, sp.kind === "end" ? 0 : sp.kind === "mid" || sp.kind === "center" ? 1 : 2);
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
const locked = (e) => (S.layers.get(e.l) || {}).locked;
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
  SC: "SCALE", CAL: "CAL", MI: "MIRROR", E: "ERASE", ZE: "ZE", Z: "ZE", U: "U", OPEN: "OPEN", NEW: "NEW", SAVE: "SAVE", SAVEAS: "SAVEAS", REDO: "REDO", LA: "LAYER" };

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
};
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

function runCommand(name) {
  name = ALIAS[name.toUpperCase()] || name.toUpperCase();
  if (name === "U") return undo();
  if (name === "REDO") return redo();
  if (name === "ZE") return zoomExtents();
  if (name === "OPEN") return openDialog();
  if (name === "NEW") return newDoc();
  if (name === "SAVE") return save(false);
  if (name === "SAVEAS") return save(true);
  if (!CMDS[name]) return log(`ไม่รู้จักคำสั่ง "${name}"`);
  if (!S.doc) return toast("เปิดไฟล์หรือสร้างแบบใหม่ก่อน");
  cancel(true);
  S.lastCmd = name; S.cmd = CMDS[name](); log("คำสั่ง: " + name);
  step(undefined);
}
function step(value) {
  if (!S.cmd) return;
  const r = S.cmd.next(value);
  if (r.done) { S.cmd = null; S.req = null; S.preview = null; prompt("คำสั่ง:"); draw(); return; }
  S.req = r.value; prompt(r.value.msg + (r.value.def != null ? ` <${r.value.def}>` : ""));
  S.preview = null; draw();
  if (r.value.kind === "wait") { const pr = r.value.promise; pr.then((v) => { if (S.req === r.value) step(v); }, (e) => { log(e.message); if (S.req === r.value) step(null); }); }
}
function cancel(silent) { if (S.cmd) { S.cmd.return(); S.cmd = null; S.req = null; S.preview = null; prompt("คำสั่ง:"); if (!silent) log("*ยกเลิก*"); draw(); } }

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
  return p;
}
cv.addEventListener("pointerdown", (e) => {
  cv.setPointerCapture(e.pointerId);
  const r = cv.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
  if (e.button === 1 || e.button === 2) { drag = { pan: true, x: sx, y: sy, ox: S.view.ox, oy: S.view.oy }; return; }
  const w = toW(sx, sy), R = S.req;
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
cv.addEventListener("dblclick", (e) => { if (e.button === 1) zoomExtents(); });
cv.addEventListener("contextmenu", (e) => e.preventDefault());
new ResizeObserver(resize).observe(cv);
const fmt = (v) => (Math.round(v * 1000) / 1000).toLocaleString("en-US", { maximumFractionDigits: 3 });

const cmd = $("#cmd");
cmd.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || (e.key === " " && !(S.req && S.req.kind === "text"))) { e.preventDefault(); const v = cmd.value; cmd.value = ""; feedText(v); }
  else if (e.key === "Escape") { cmd.value = ""; cancel(); S.sel.clear(); renderProps(); draw(); }
});
document.addEventListener("keydown", (e) => {
  if (e.target !== cmd && e.target.matches("input, select, textarea")) return;
  if (e.ctrlKey || e.metaKey) {
    const k = e.key.toLowerCase();
    if (k === "z") { e.preventDefault(); undo(); } else if (k === "y") { e.preventDefault(); redo(); }
    else if (k === "s") { e.preventDefault(); save(false); } else if (k === "o") { e.preventDefault(); openDialog(); }
    else if (k === "p") { e.preventDefault(); runCommand("PLOT"); }
    else if (k === "a") { e.preventDefault(); S.sel = new Set([...S.ents.keys()].filter((h) => visible(S.ents.get(h)))); renderProps(); draw(); }
    return;
  }
  if (e.key === "F3") { e.preventDefault(); toggle("osnap"); return; }
  if (e.key === "F8") { e.preventDefault(); toggle("ortho"); return; }
  if (e.target === cmd) return;
  if (e.key === "Delete" && S.sel.size && !S.cmd) { runCommand("ERASE"); return; }
  if (e.key === "Escape") { cancel(); S.sel.clear(); renderProps(); draw(); return; }
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); feedText(""); return; }
  if (e.key.length === 1 && !e.altKey) { cmd.focus(); }      // พิมพ์ที่ไหนก็ได้ → ไปที่บรรทัดคำสั่ง (แบบ AutoCAD)
});
function toggle(k) { S[k] = !S[k]; $("#t-" + k).classList.toggle("on", S[k]); log(`${k.toUpperCase()} ${S[k] ? "เปิด" : "ปิด"}`); }
$("#t-osnap").onclick = () => toggle("osnap"); $("#t-ortho").onclick = () => toggle("ortho");
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
  if (one && one.t === "INSERT") html += `<label>Block<span>${esc(one.g.name)}</span></label>`;
  box.innerHTML = html;
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
    "หน่วย": $("#units").textContent, "ดูอย่างเดียว": S.ro ? "ใช่ (ไฟล์ใหญ่)" : "ไม่", "แก้แล้วยังไม่บันทึก": S.dirty ? "ใช่" : "ไม่", "OSNAP": S.osnap ? "เปิด" : "ปิด", "ORTHO": S.ortho ? "เปิด" : "ปิด" }),
  next() {
    const opened = !!(S.doc && (S.doc.file || S.ents.size)), unitless = S.doc && !S.doc.insunits;
    const steps = [
      { done: opened, say: "เปิดไฟล์ DWG / DXF / PDF จาก CAD (หรือวาดใหม่ด้วย L, PL, REC)", act: { tool: "press", key: "OPEN", label: "เปิด" } },
      ...(opened && unitless ? [{ done: false, say: "ไฟล์ไม่ระบุหน่วย — ตรวจขนาดด้วย DI (วัดระยะ) ถ้าไม่ตรงใช้ CAL ตั้งระยะจากเส้นที่รู้ระยะ", act: { tool: "press", key: "CAL", label: "ตั้งระยะ" } }] : []),
      { done: !S.dirty && opened, say: S.ro ? "ไฟล์ใหญ่เปิดแบบดูอย่างเดียว — ใช้ Plot หรือเปิดใน AutoCAD/ZWCAD เพื่อแก้" : "แก้แบบแล้วบันทึก (Ctrl+S) หรือ บันทึกเป็น… DWG/DXF", act: S.ro ? null : { tool: "press", key: "SAVE", label: "บันทึก" } },
      { done: false, say: "Plot เป็น PDF พร้อมกรอบชื่อ (Ctrl+P)", act: { tool: "press", key: "PLOT", label: "🖨 Plot PDF" } },
    ];
    return [...steps.filter((x) => x.done).slice(-1), ...steps.filter((x) => !x.done).slice(0, 3)];
  },
  sets: {},
};

const qf = new URLSearchParams(location.search).get("file");
resize();
if (CLOUD) { prompt("รุ่นออนไลน์: CAD 2D ต้องใช้รุ่นในเครื่อง"); }
else if (qf) openPath(qf); else { newDoc(); log("พิมพ์ OPEN หรือกดปุ่ม เปิด เพื่อเปิดไฟล์ DWG/DXF"); }
