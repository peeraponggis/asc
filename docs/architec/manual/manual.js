// คู่มือ ASC Architect ทีละเมนู ทีละรายการ (โดย ลุงพี) — อ่าน ../ai/help.json (scripts/build_help.py) ไม่ต้องเขียนหน้าเอง
// #<key> = หน้าของปุ่มนั้น · ค้นในคู่มือ · "ลองทำเลย" = เปิดหน้าจริงแล้วชี้ปุ่ม (?try=) · ดาวน์โหลด PDF = พิมพ์ทั้งเล่ม
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const PAGE_URL = { home: "../", editor: "../editor/", cad: "../cad/" };
const H = await fetch("../ai/help.json?v=0.25.1").then((r) => r.json());
const shots = await fetch("shots/index.json?v=0.25.1").then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
const ORDER = H.toc.flatMap((c) => c.keys);
const CH = Object.fromEntries(H.toc.map((c) => [c.chapter, c]));
$("#mtitle").textContent = `คู่มือ ASC Architect ${H.version}`;
document.title = `คู่มือ ${H.version} · ASC Architect`;

// ---------------------------------------------------------------- สารบัญ
function toc(cur) {
  const ch = H.entries[cur]?.chapter;
  $("#toc").innerHTML = H.toc.map((c) => `<details ${c.chapter === ch || (!ch && c.order < 30) ? "open" : ""}><summary>${esc(c.title)} <span class="cnt">(${c.keys.length})</span></summary>
    ${c.keys.map((k) => `<a href="#${encodeURIComponent(k)}" class="${k === cur ? "on" : ""}">${esc(H.entries[k].title)}${H.entries[k].hot ? ` <span class="cnt">${esc(H.entries[k].hot)}</span>` : ""}</a>`).join("")}</details>`).join("");
  $("#toc a.on")?.scrollIntoView({ block: "nearest" });
}

// ---------------------------------------------------------------- เนื้อหา (โน้ตเป็น markdown แบบง่าย)
function md(t) {
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>");
  const out = []; let list = null;
  for (const line of String(t).split("\n")) {
    const m = line.match(/^\s*[-*]\s+(.*)/);
    if (m) { (list ||= []).push(`<li>${inline(m[1])}</li>`); continue; }
    if (list) { out.push(`<ul>${list.join("")}</ul>`); list = null; }
    if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  if (list) out.push(`<ul>${list.join("")}</ul>`);
  return out.join("");
}
const link = (k) => (H.entries[k] ? `<a href="#${encodeURIComponent(k)}">${esc(H.entries[k].title)}</a>` : "");

function entryHtml(k, e, print) {
  const c = CH[e.chapter] || {}, pg = k.split(":")[0];
  const steps = (e.steps || []).map((s) => `<li>${esc(s)}</li>`).join("");
  const rel = (e.related || []).map(link).filter(Boolean).join(" · ");
  const img = shots[k];                                                    // shots/index.json: key → ไฟล์ภาพ (scripts/shoot_manual.py)
  const tryUrl = PAGE_URL[pg] ? `${PAGE_URL[pg]}?try=${encodeURIComponent(k)}` : "";
  if (e.note) return `${print ? "" : `<span class="crumb">${esc(c.title)}</span>`}<h${print ? 2 : 1}>${esc(e.title)}</h${print ? 2 : 1}><div class="note">${md(e.desc)}</div>`;
  return `${print ? "" : `<span class="crumb">${esc(c.title)} › ${esc(e.title)}</span>`}
    <h${print ? 2 : 1}>${esc(e.title)}${e.hot ? ` · คีย์ลัด <span class="kb">${esc(e.hot)}</span>` : ""}</h${print ? 2 : 1}>
    ${e.where ? `<p class="where">${esc(e.where)}</p>` : ""}
    <div class="cols"><div>
      ${e.desc ? `<p class="lead">${esc(e.desc)}</p>` : ""}
      ${steps ? `<ol class="steps">${steps}</ol>` : ""}
      ${print ? "" : `<div class="acts">${tryUrl ? `<a class="go" href="${tryUrl}" target="_blank" rel="noopener">ลองทำเลย — พาไปที่ปุ่มจริง</a>` : ""}<button type="button" data-ask="${esc(e.title)}">ถาม piBot</button></div>`}
      ${e.needs ? `<div class="box"><b>ต้องมีก่อน:</b> ${esc(e.needs)}</div>` : ""}
      ${e.next ? `<div class="box"><b>ต่อไป:</b> ${esc(e.next)}</div>` : ""}
      ${(e.tips || []).length ? `<div class="box"><b>ปัญหาที่พบบ่อย / ข้อควรรู้</b><br>${e.tips.map(esc).join("<br>")}</div>` : ""}
      ${rel && !print ? `<div class="box"><b>เกี่ยวข้อง:</b> ${rel}</div>` : ""}
      ${e.auto ? `<p class="auto">หัวข้อนี้สร้างอัตโนมัติจากป้ายของปุ่ม — ยังไม่มีคำอธิบายละเอียด</p>` : ""}
    </div>${img ? `<figure><img src="shots/${img}" alt="ภาพหน้าจอ: ${esc(e.title)}" loading="lazy"><figcaption>ภาพจากแบบตัวอย่าง · ถ่ายอัตโนมัติจากโปรแกรมจริง</figcaption></figure>` : ""}</div>`;
}
function show(k) {
  const e = H.entries[k];
  if (!e) return home();
  $("#page").innerHTML = entryHtml(k, e, false);
  $("#mpos").textContent = `หน้า ${ORDER.indexOf(k) + 1} / ${ORDER.length} · อัปเดตอัตโนมัติจากเวอร์ชัน ${H.version}`;
  toc(k); $("#page").focus({ preventScroll: true }); scrollTo(0, 0);
}
function home() {
  const n = Object.values(H.entries), own = n.filter((e) => !e.auto && !e.note).length;
  $("#page").innerHTML = `<h1>คู่มือ ASC Architect ${esc(H.version)}</h1>
    <p class="lead">คู่มือทีละเมนู ทีละปุ่ม ${ORDER.length} หน้า (อธิบายละเอียด ${own} · บทความ ${n.filter((e) => e.note).length} · ปุ่มอื่น ๆ ${n.filter((e) => e.auto).length}) — สร้างจากโปรแกรมจริง เพิ่มปุ่มใหม่ คู่มือตามทันเอง</p>
    <p>ในโปรแกรมกด <span class="kb">F1</span> แล้วชี้ปุ่มไหนก็ได้ · กด <span class="kb">Shift</span> ค้างแล้วชี้ = คำอธิบายสั้น · คลิกขวาที่ปุ่ม = "ปุ่มนี้คืออะไร?"</p>
    <ul class="res">${H.toc.map((c) => `<li><a href="#${encodeURIComponent(c.keys[0])}"><b>${esc(c.title)}</b></a><small>${c.keys.length} หัวข้อ</small></li>`).join("")}</ul>`;
  $("#mpos").textContent = `${ORDER.length} หน้า · อัปเดตอัตโนมัติจากเวอร์ชัน ${H.version}`;
  toc("");
}
function route() { const k = decodeURIComponent(location.hash.slice(1)); k ? show(k) : home(); }

// ---------------------------------------------------------------- ค้นในคู่มือ
function search(q) {
  const ws = q.toLowerCase().split(/\s+/).filter(Boolean);
  const rows = ORDER.map((k) => {
    const e = H.entries[k], t = `${e.title} ${e.hot || ""} ${e.where || ""}`.toLowerCase(), b = `${e.desc || ""} ${(e.steps || []).join(" ")} ${(e.tips || []).join(" ")}`.toLowerCase();
    const s = ws.reduce((a, w) => a + (t.includes(w) ? 3 : 0) + (b.includes(w) ? 1 : 0), 0) + (e.auto ? -0.5 : 0);
    return { k, e, s };
  }).filter((r) => r.s > 0).sort((a, b) => b.s - a.s).slice(0, 40);
  $("#page").innerHTML = `<h1>ผลค้น "${esc(q)}"</h1>${rows.length ? `<ul class="res">${rows.map((r) => `<li>${link(r.k)}<small>${esc(CH[r.e.chapter]?.title)} · ${esc((r.e.desc || "").slice(0, 120))}</small></li>`).join("")}</ul>` : `<p>ไม่พบในคู่มือ — ลองถาม piBot (ปุ่มกลมมุมขวาล่าง)</p>`}`;
}
let qt = 0;
$("#q").addEventListener("input", (e) => { clearTimeout(qt); const q = e.target.value.trim(); qt = setTimeout(() => (q ? search(q) : route()), 200); });
$("#page").addEventListener("click", (e) => {
  const a = e.target.closest("[data-ask]"); if (!a || !window.piBot) return;
  window.piBot.toggle(true); window.piBot.ask(`"${a.dataset.ask}" ใช้ยังไง`);
});

// ---------------------------------------------------------------- ทั้งเล่มสำหรับพิมพ์ / PDF
function printAll() {
  $("#all").innerHTML = `<div class="cover"><img src="../logo.png" alt="" width="96" height="96"><h1>คู่มือ ASC Architect</h1><p>Auto Structure Co-pilot Architect · เวอร์ชัน ${esc(H.version)} · ${esc(H.built)}</p></div>` +
    H.toc.map((c) => `<h1 class="chap">${esc(c.title)}</h1>` + (c.chapter.startsWith("auto-")
      ? `<table class="at">${c.keys.map((k) => `<tr><td>${esc(H.entries[k].title)}</td><td>${esc(H.entries[k].hot || "")}</td><td>${esc(H.entries[k].desc || "")}</td></tr>`).join("")}</table>`
      : c.keys.map((k) => `<section>${entryHtml(k, H.entries[k], true)}</section>`).join(""))).join("");
  $("#all").hidden = false;
  setTimeout(() => print(), 300);
}
$("#pdf").onclick = printAll;
addEventListener("afterprint", () => { $("#all").hidden = true; });
addEventListener("hashchange", route);
if (new URLSearchParams(location.search).has("print")) printAll();
route();
window.ascaAI = { page: () => "home", pageName: () => "คู่มือ" };
