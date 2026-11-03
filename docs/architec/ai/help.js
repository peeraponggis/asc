// ช่วยเหลือตามตำแหน่ง (Help ?) ทุกหน้าของ ASC Architect (โดย ลุงพี)
// เรียกได้ 3 แบบ: F1 / ปุ่ม "ช่วยเหลือ" = โหมดช่วยเหลือ (ชี้หรือคลิกปุ่มไหนก็ได้ ไม่มีอะไรถูกกดจริง) ·
// Shift ค้างแล้วชี้ปุ่ม = กล่องเล็กทันที · คลิกขวาที่ปุ่ม = "ปุ่มนี้คืออะไร?"
// เนื้อหามาจาก web/ai/help.json (สร้างจาก knowledge/help/*.json ด้วย scripts/build_help.py) — ไม่มีรายการ = ใช้ป้าย/คำอธิบายของปุ่มเอง
// ?try=<key> ในลิงก์ = ชี้ปุ่มจริงให้ (ปุ่ม "ลองทำเลย" ในคู่มือ) · ไม่ส่งข้อมูลออกนอกเครื่อง
const BASE = new URL("./", import.meta.url);
const PAGE = /\/editor\//.test(location.pathname) ? "editor" : /\/cad\//.test(location.pathname) ? "cad" : "home";
const ATTRS = [["menu", "menu"], ["act", "act"], ["tool", "tool"], ["cmd", "cmd"], ["t3", "t3"], ["a3", "a3"], ["tab", "tab"], ["view", "view"],
  ["sol", "sol"], ["s", "s"], ["d", "d"], ["g", "g"],                      // ปุ่ม/ช่องในหน้าต่างโซลาร์ (data-sol · data-g) และโครงสร้าง (data-s · data-d)
  ["ui", "ui"], ["style", "style"], ["view3", "view3"], ["tbb", "tbb"], ["sym", "sym"], ["cat", "cat"], ["st", "st"]];
const HIT = ATTRS.map(([a]) => `[data-${a}]`).join(",") + ",button,select,input:not([type=hidden]),textarea,a[href]";   // สิ่งที่กด/กรอกได้
const SEL = HIT + ",[id]";                                                // + กล่องที่มี id (แผง/ตาราง) ที่มีคำอธิบาย
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const OWN = ".hlp-pop,.hlp-bar,.hlp-tip,.hlp-ctx,.hlp-btn,.aiw,.aifab";

let help = null, helpP = null, on = false, pop = null, tip = null, badges = null, timer = 0, shift = false;
const load = () => (helpP ||= fetch(new URL("help.json?v=0.30.1", BASE)).then((r) => (r.ok ? r.json() : { entries: {} })).catch(() => ({ entries: {} })).then((h) => (help = h)));

/** ปุ่ม/ช่องที่ใกล้ที่สุด → { el, key } · key = <หน้า>:<ชนิด>:<ค่า> (ดู knowledge/help/README.md) */
const own = (el) => { for (const [a, t] of ATTRS) if (el.dataset[a]) return `${PAGE}:${t}:${el.dataset[a]}`; return el.id ? `${PAGE}:id:${el.id}` : ""; };
export function keyOf(node) {
  const el = node?.closest?.(SEL);
  if (!el || el.closest(OWN) || el === document.body || el.matches("main,section,header,nav,body,html,canvas")) return null;
  const keys = [];                                                       // ตัวมันเอง แล้วกลุ่มที่ครอบ (ปุ่มย่อยที่ไม่มีคำอธิบายของตัวเอง เช่น ปุ่มรูปแบบใน #skStyles)
  for (let x = el, i = 0; x && x !== document.body && i < 6; x = x.parentElement, i++) { const k = own(x); if (k && !keys.includes(k)) keys.push(k); }
  const key = keys.find((k) => help?.entries?.[k]) || keys[0] || `${PAGE}:label:${label(el)}`;
  return { el, key, keys };
}
function label(el) {
  const t = el.getAttribute("aria-label") || el.title || el.textContent || "";
  return t.replace(/\s+/g, " ").trim().slice(0, 80);
}
/** รายการช่วยเหลือของปุ่ม — จาก help.json · ไม่มี = สร้างจากป้าย/คำอธิบายของปุ่ม */
export function entryOf(key, el) {
  const e = help?.entries?.[key];
  if (e) return e;
  const tt = (el?.title || "").replace(/\s+/g, " ").trim(), lb = label(el || document.body);
  const m = tt.match(/^(.*?)\s*\(([^()]{1,12})\)\s*$/);                     // "ผนัง (W)" → ชื่อ + คีย์ลัด
  return { title: m ? m[1] : lb || key, hot: m ? m[2] : "", desc: tt && tt !== lb ? tt : "", auto: true };
}
const kbd = (k) => (k ? `<kbd class="hlp-k">${esc(k)}</kbd>` : "");
function bodyHtml(key, e, mini) {
  const row = (lab, v) => (v ? `<div class="hlp-row"><span>${lab}</span><div>${v}</div></div>` : "");
  const steps = (e.steps || []).map((s, i) => `${i + 1}) ${esc(s)}`).join(" · ");
  const head = `<div class="hlp-h"><b>${esc(e.title)}</b>${e.hot ? ` <span class="hlp-hot">คีย์ลัด ${kbd(e.hot)}</span>` : ""}${e.where && !mini ? `<small>${esc(e.where)}</small>` : ""}</div>`;
  const desc = e.desc ? `<p>${esc(e.desc)}</p>` : e.auto ? `<p class="hlp-muted">ยังไม่มีคำอธิบายละเอียดของปุ่มนี้ในคู่มือ — ถาม piBot ได้</p>` : "";
  if (mini) return head + desc;
  return head + desc + row("ขั้นตอน", esc(steps)) + row("ต้องมีก่อน", esc(e.needs)) + row("ต่อไป", esc(e.next)) + row("ข้อควรรู้", (e.tips || []).map(esc).join("<br>")) +
    `<div class="hlp-acts"><button type="button" data-h="manual">เปิดคู่มือหน้านี้</button><button type="button" data-h="ask" class="hlp-go">ถาม piBot เรื่องนี้</button></div>` +
    `<small class="hlp-src">ที่มา: คู่มือในเครื่อง (${esc(key)}${(e.related || []).filter((r) => r.startsWith("kb:")).map((r) => " · " + esc(r.slice(3))).join("")}) · ไม่ส่งข้อมูลออก</small>`;
}
function place(box, r) {
  const w = box.offsetWidth, h = box.offsetHeight, m = 8;
  let x = r.right + 10, y = r.top;
  if (x + w > innerWidth - m) x = Math.max(m, r.left - w - 10);
  if (x < m) { x = Math.min(Math.max(m, r.left), innerWidth - w - m); y = r.bottom + 8; }
  y = Math.min(Math.max(m, y), innerHeight - h - m);
  box.style.left = x + "px"; box.style.top = y + "px";
}
/** กล่องคำอธิบายเต็มข้างปุ่ม */
export async function show(el, key, keys) {
  await load(); hideTip(); closePop();
  key = (keys || [key]).find((k) => help.entries?.[k]) || key;
  const e = entryOf(key, el);
  pop = document.createElement("div"); pop.className = "hlp-pop"; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", "คำอธิบาย " + e.title);
  pop.innerHTML = bodyHtml(key, e, false) + `<button type="button" class="hlp-x" data-h="close" aria-label="ปิด">×</button>`;
  document.body.append(pop); place(pop, el.getBoundingClientRect());
  ring(el);
  pop.onclick = (ev) => {
    const h = ev.target.closest("[data-h]")?.dataset.h; if (!h) return;
    if (h === "close") closePop();
    if (h === "manual") open(new URL(`../manual/#${encodeURIComponent(key)}`, BASE), "_blank");
    if (h === "ask" && window.piBot) { closePop(); window.piBot.toggle(true); window.piBot.ask(`ปุ่ม "${e.title}" ใช้ยังไง`); }
  };
}
function closePop() { pop?.remove(); pop = null; document.querySelector(".hlp-ring")?.remove(); }
function ring(el) {
  document.querySelector(".hlp-ring")?.remove();
  const r = el.getBoundingClientRect(), d = document.createElement("div"); d.className = "hlp-ring";
  Object.assign(d.style, { left: r.left - 4 + "px", top: r.top - 4 + "px", width: r.width + 8 + "px", height: r.height + 8 + "px" });
  document.body.append(d);
}
async function showTip(el, key, keys) {
  await load(); if (!shift) return;
  key = (keys || [key]).find((k) => help.entries?.[k]) || key;
  const e = entryOf(key, el);
  if (!tip) { tip = document.createElement("div"); tip.className = "hlp-tip"; document.body.append(tip); }
  tip.innerHTML = bodyHtml(key, e, true); place(tip, el.getBoundingClientRect());
}
function hideTip() { tip?.remove(); tip = null; }

// ---------------------------------------------------------------- โหมดช่วยเหลือ
function visibleKeyed() {
  const out = [];
  for (const el of document.querySelectorAll(HIT)) {
    if (out.length > 500 || el.closest(OWN) || el.matches("input[type=hidden]")) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
    if (getComputedStyle(el).visibility === "hidden") continue;
    out.push(r);
  }
  return out;
}
function drawBadges() {
  if (!on) return;
  badges.innerHTML = visibleKeyed().map((r) => `<span style="left:${r.right - 9}px;top:${r.top - 7}px">?</span>`).join("");
}
export function setMode(v) {
  on = v ?? !on; document.body.classList.toggle("hlp-on", on);
  document.querySelector(".hlp-btn")?.classList.toggle("on", on);
  if (on) {
    load();
    const bar = document.createElement("div"); bar.className = "hlp-bar";
    bar.innerHTML = `โหมดช่วยเหลือ: ชี้หรือคลิกปุ่มไหนก็ได้เพื่อดูว่าทำอะไร · ไม่มีอะไรถูกกดจริง · กด Esc หรือ F1 อีกครั้งเพื่อออก <button type="button" data-h="off">ออก</button>`;
    bar.onclick = (e) => { if (e.target.closest("[data-h=off]")) setMode(false); };
    document.body.append(bar);
    badges = document.createElement("div"); badges.className = "hlp-badges"; document.body.append(badges);
    drawBadges(); timer = setInterval(drawBadges, 700);
  } else {
    clearInterval(timer); document.querySelector(".hlp-bar")?.remove(); badges?.remove(); badges = null; closePop();
  }
}
const block = (e) => {                                                   // โหมดช่วยเหลือ: ไม่ให้ปุ่มทำงานจริง
  if (!on || e.target.closest?.(OWN)) return;
  const k = keyOf(e.target);
  e.preventDefault(); e.stopImmediatePropagation();                      // พื้นที่วาดก็ไม่รับคลิกระหว่างโหมดช่วยเหลือ
  if (!k) return;
  if (e.type === "click") show(k.el, k.key, k.keys);
};
for (const t of ["pointerdown", "mousedown", "click", "dblclick"]) addEventListener(t, block, true);
addEventListener("keydown", (e) => {
  if (e.key === "F1" && !e.shiftKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); e.stopImmediatePropagation(); setMode(); return; }
  if (e.key === "Escape" && (on || pop)) { e.stopImmediatePropagation(); if (pop) closePop(); else setMode(false); return; }
  if (e.key === "Shift") shift = true;
}, true);
addEventListener("keyup", (e) => { if (e.key === "Shift") { shift = false; hideTip(); } }, true);
addEventListener("blur", () => { shift = false; hideTip(); });
addEventListener("pointerover", (e) => {
  if (!e.shiftKey || on) return;
  shift = true;
  const k = e.target.closest?.(HIT) ? keyOf(e.target) : null; if (k) showTip(k.el, k.key, k.keys); else hideTip();
}, true);
addEventListener("contextmenu", (e) => {                                 // คลิกขวาที่ปุ่ม (ไม่ใช่พื้นที่วาด) → ปุ่มนี้คืออะไร?
  const k = e.target.closest?.(HIT) ? keyOf(e.target) : null; if (!k || e.target.closest("canvas,svg:not(button svg)")) return;
  e.preventDefault(); document.querySelector(".hlp-ctx")?.remove();
  const m = document.createElement("div"); m.className = "hlp-ctx";
  m.innerHTML = `<button type="button">ปุ่มนี้คืออะไร?</button>`;
  m.style.left = Math.min(e.clientX, innerWidth - 180) + "px"; m.style.top = Math.min(e.clientY, innerHeight - 50) + "px";
  m.firstChild.onclick = () => { m.remove(); show(k.el, k.key, k.keys); };
  document.body.append(m);
  setTimeout(() => addEventListener("pointerdown", (ev) => { if (!m.contains(ev.target)) m.remove(); }, { once: true, capture: true }), 0);
}, true);
addEventListener("pointerdown", (e) => { if (pop && !on && !e.target.closest(".hlp-pop")) closePop(); }, true);

// ---------------------------------------------------------------- ปุ่ม ช่วยเหลือ (F1) ที่แถบบน + ?try=<key> จากคู่มือ
function addButton() {
  const at = document.querySelector("header.bar .acts") || document.querySelector("header.top") || document.querySelector("header.qat");
  if (!at || document.querySelector(".hlp-btn")) return;
  const b = document.createElement("button"); b.type = "button"; b.className = "hlp-btn"; b.title = "โหมดช่วยเหลือ: ชี้ปุ่มไหนก็ได้เพื่อดูว่าทำอะไร (F1)";
  b.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg> ช่วยเหลือ <kbd>F1</kbd>`;
  b.onclick = () => setMode();
  if (at.matches("header.top")) at.insertBefore(b, at.querySelector("#mode")); else at.append(b);
}
/** หาปุ่มจาก key (ใช้กับ ?try= และคู่มือ) */
export function findByKey(key) {
  const [pg, t, ...rest] = key.split(":"), v = rest.join(":");
  if (pg !== PAGE) return null;
  const css = (s) => (window.CSS && CSS.escape ? CSS.escape(s) : s);
  if (t === "id") return document.getElementById(v);
  const a = ATTRS.find(([, tt]) => tt === t)?.[0];
  const vis = (s) => [...document.querySelectorAll(`[data-${a}="${css(s)}"]`)].find((x) => x.getClientRects().length) || null;
  return a ? vis(v) || (t === "menu" ? vis(v.split("/")[0]) : null) : null;          // รายการในเมนู → ชี้หัวเมนู
}
async function tryParam() {
  const key = new URLSearchParams(location.search).get("try"); if (!key) return;
  for (let i = 0; i < 40; i++) {
    const el = findByKey(key);
    if (el) { el.scrollIntoView({ block: "nearest", inline: "nearest" }); await new Promise((r) => setTimeout(r, 300)); show(el, key); el.classList.add("hlp-pulse"); setTimeout(() => el.classList.remove("hlp-pulse"), 6000); return; }
    await new Promise((r) => setTimeout(r, 250));
  }
  await load();
  const e = entryOf(key, null), n = document.createElement("div"); n.className = "hlp-bar";
  n.innerHTML = `ไม่เห็นปุ่ม "${esc(e.title)}" บนจอตอนนี้ — อาจอยู่ในโหมด 3D / ผัง 2D หรือในเมนูอื่น${e.where ? ` (${esc(e.where)})` : ""} <button type="button">ปิด</button>`;
  n.querySelector("button").onclick = () => n.remove(); document.body.append(n);
}
if (document.readyState === "loading") addEventListener("DOMContentLoaded", () => { addButton(); tryParam(); }); else { addButton(); tryParam(); }
setTimeout(addButton, 1500);                                             // หน้าแรกสร้างแถบบนเสร็จช้ากว่า
window.ascaHelp = { setMode, show, keyOf, entryOf, findByKey, page: PAGE };
