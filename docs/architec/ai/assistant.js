// ผู้ช่วย AI "piBot" ของ ASC Architect — กล่องแชทลอยทุกหน้า (โดย ลุงพี)
// หลักการเดียวกับ ASC Studio (หลักการผู้ช่วยAI.md): ค่าเริ่มต้นไม่ใช้ AI (ค้นคลังความรู้ + ตัวแปลงคำสั่งในเครื่อง ไม่ส่งอะไรออก) ·
// เลือกผู้ให้บริการได้หลายเจ้า ล้มเหลวลองเจ้าถัดไป · คีย์อยู่ในเบราว์เซอร์ · AI ไม่คิดตัวเลขเอง (ตัวเลขมาจากโค้ดของหน้า) ·
// จะเปลี่ยนแบบ ต้องให้คนกด "ทำเลย" บนการ์ดก่อน (ดูบนผัง · ไม่ทำ · หลังทำมี เลิกทำ) · ห้ามบอกว่า "ทำแล้ว" เอง ·
// ป้ายที่มาคิดจากสิ่งที่ใช้จริง: 📚 คลัง · 🗂️ ข้อมูลในงาน · 🌐 ความรู้ทั่วไป · ➡️ ต่อไปทำอะไร จากสถานะจริงของหน้า
// หน้าเว็บบอกสถานะผ่าน window.ascaAI = { page(), pageName(), facts(), next(), sets, run(name, params), snapshot(), restore(s), focus(t),
//   checks(), explain(), bom(), autoPlan(), commands() } (ดู editor/main.js · cad/app.js · app.js) · คำสั่ง/ตัวตรวจค่าอยู่ที่ ai/actions.js
import { loadKB } from "./kb.js?v=0.31.0";
import { providers, byId, loadCfg, saveCfg, chain, askChain, parseReply, reachable, testProvider, PRESETS, prettyModel, okBase, setProxy, listModels, chatUrl } from "./providers.js?v=0.31.0";
import * as A from "./actions.js?v=0.31.0";
import "./help.js?v=0.31.0";                                                     // ช่วยเหลือตามตำแหน่ง F1 · Shift ชี้ · คลิกขวา

const BASE = new URL("./", import.meta.url);
const CLOUD = window.PA_MODE === "cloud";
setProxy(CLOUD ? null : "/api/ai/proxy");                                         // ผู้ให้บริการที่บล็อกการเรียกจากหน้าเว็บ → ส่งผ่าน server ในเครื่อง (0.31.0)
const LS_CHAT = "asca.ai.chat", LS_POS = "asca.ai.pos", LS_MISS = "asca.ai.unanswered", LS_FAB = "asca.ai.fab", LS_WIN = "asca.ai.win";
const NEXT_RE = /ต่อไป|ขั้นตอนไหน|ขั้นต่อไป|ขาดอะไร|ทำอะไรต่อ|เหลืออะไร|ต้องทำอะไร|เริ่มตรงไหน|next/i;
const HELP_RE = /^(หน้านี้|ใช้ยังไง|ใช้งานยังไง|ช่วยด้วย|help)/i;
const FACT_RE = /สรุป|กี่|เท่าไร|เท่าไหร่|kwp|พื้นที่|ความยาว|จำนวน/i;
const CHECK_RE = /ไม่ผ่าน|ผลตรวจ|ตรวจแล้ว|เตือน|ทำไม.{0,12}(คาน|เสา|ฐานราก|พื้น)/;
const NO_PRESS = new Set(["new", "NEW", "del3d", "cad-close", "plot-close", "plot-go", "ai-draft"]);   // ปุ่มที่ AI ไม่กดแทน (ลบ/ล้าง/ปิด/งานหนัก)
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;                                // พิมพ์ด้วยเสียง (ไม่มี = ซ่อนปุ่มไมค์)
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const br = (s) => esc(s).replace(/\n/g, "<br>");

const host = () => window.ascaAI || {};
const page = () => (host().page ? host().page() : "home");
const pageName = () => (host().pageName ? host().pageName() : document.title);
const facts = () => { try { return host().facts ? host().facts() : {}; } catch (e) { return {}; } };
const vctx = () => ({ page: page(), enums: { commands: host().commands ? host().commands() : [] } });
const kindOf = (a) => (a.tool ? "ui" : (A.spec(a.name) || {}).kind || "ui");

// ---------------------------------------------------------------- ปุ่ม/ช่องในหน้า (การ์ดแบบเดิม: กดปุ่มที่มีจริง · ตั้งค่าช่องที่อนุญาต)
const PRESS_SEL = "[data-act],[data-tool],[data-cmd],[data-tab],[data-view],[data-t3]";
function pressables() {
  const out = new Map();
  for (const el of document.querySelectorAll(PRESS_SEL)) {
    if (el.closest(".aiw")) continue;
    const key = el.dataset.act || el.dataset.tool || el.dataset.cmd || el.dataset.tab || el.dataset.view || el.dataset.t3;
    if (!key || NO_PRESS.has(key) || out.has(key)) continue;
    const label = (el.title || el.textContent || key).replace(/\s+/g, " ").trim().slice(0, 60);
    out.set(key, { key, label, el });
  }
  for (const id of ["trace-file", "open-file", "cad-upload"]) {                  // ปุ่มเลือกไฟล์ (label + input)
    const el = document.getElementById(id);
    if (el && el.closest("label")) out.set(id, { key: id, label: el.closest("label").textContent.trim().slice(0, 40), el });
  }
  return out;
}
function setsList() { return host().sets || {}; }
/** ตรวจคำสั่งแบบเดิม (press/set) → ทำได้จริงเท่านั้น */
function validateLegacy(actions) {
  const P = pressables(), S = setsList(), ok = [];
  for (const a of actions || []) {
    if (!a || typeof a !== "object") continue;
    if (a.tool === "press" && P.has(a.key)) ok.push({ tool: "press", key: a.key, label: P.get(a.key).label });
    else if (a.tool === "set" && S[a.id]) {
      const el = document.getElementById(a.id); if (!el) continue;
      let v = a.value;
      if (el.type === "checkbox") v = v === true || v === "true" || v === 1;
      else if (el.tagName === "SELECT") {                                       // รับทั้งรหัส (hip) และป้ายที่เห็น (ปั้นหยา)
        const s = String(v).trim().toLowerCase(), o = [...el.options].find((x) => x.value.toLowerCase() === s) || [...el.options].find((x) => x.textContent.trim().toLowerCase().startsWith(s));
        if (!o || !s) continue; v = o.value;
      }
      else { v = Number(v); if (!Number.isFinite(v) || (el.min !== "" && v < Number(el.min)) || (el.max !== "" && v > Number(el.max))) continue; }
      ok.push({ tool: "set", id: a.id, value: v, label: `${S[a.id].label} = ${el.tagName === "SELECT" ? [...el.options].find((o) => o.value === String(v)).textContent : v}` });
    }
  }
  return ok;
}
function runLegacy(a) {
  if (a.tool === "press") { const p = pressables().get(a.key); if (!p) return false; p.el.click(); return true; }
  const el = document.getElementById(a.id); if (!el) return false;
  if (el.type === "checkbox") el.checked = a.value; else el.value = a.value;
  el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}
/** ชี้ปุ่ม/ช่องบนจอ (กล่องคำอธิบายของ help.js) — ไม่กดอะไร */
function pointAt(el, key) {
  if (!el) return false;
  el.scrollIntoView({ block: "nearest", inline: "nearest" });
  const H = window.ascaHelp, k = H && !key && H.keyOf ? H.keyOf(el) : null;
  if (H) H.show(k ? k.el : el, key || (k ? k.key : `${H.page}:label:${el.textContent.trim().slice(0, 40)}`), k ? k.keys : undefined);
  el.classList.add("hlp-pulse"); setTimeout(() => el.classList.remove("hlp-pulse"), 5000);
  return true;
}
function helpOpen(key) {
  const el = window.ascaHelp && window.ascaHelp.findByKey(key);
  if (el) { pointAt(el, key); return { ok: true, msg: "ชี้ปุ่มบนจอแล้ว (กล่องคำอธิบายข้างปุ่ม)" }; }
  open(new URL(`../manual/#${encodeURIComponent(key)}`, BASE), "_blank");
  return { ok: true, msg: "ไม่เห็นปุ่มบนจอตอนนี้ — เปิดคู่มือหัวข้อนั้นในแท็บใหม่" };
}
/** ทำคำสั่งหนึ่งข้อ → { ok, msg, keys } (เรียกหลังผู้ใช้กด ทำเลย / ทำ เท่านั้น ยกเว้นคำสั่งอ่านผล) */
async function runAction(a) {
  if (a.tool) { const ok = runLegacy(a); return { ok, msg: ok ? A.describe(a) : "ปุ่ม/ช่องนี้ไม่อยู่ในหน้านี้แล้ว" }; }
  if (a.name === "help.open") return helpOpen(a.params.key);
  if (a.name === "auto.design") { autoStart(); return { ok: true, msg: "" }; }
  if (!host().run) return { ok: false, msg: "หน้านี้ยังสั่งงานผ่านผู้ช่วยไม่ได้" };
  try { return (await host().run(a.name, a.params || {})) || { ok: false, msg: "" }; } catch (e) { return { ok: false, msg: "ทำไม่สำเร็จ: " + e.message }; }
}

// ---------------------------------------------------------------- piBot: 4 ท่า (ตาเปิด · ตาปิด · นิ้วซ้ายกด · นิ้วขวากด)
function bot(size) { return `<span class="pibot" style="width:${size}px;height:${size}px;background-image:url(${new URL("pibot.webp?v=0.31.0", BASE)})" aria-hidden="true"></span>`; }
let mood = "idle", frame = 0, burst = 0, nextBlink = Date.now() + 2500;
function animate() {
  const now = Date.now();
  let f = 0;
  if (now >= nextBlink) { f = 1; if (now >= nextBlink + 140) nextBlink = now + 2500 + Math.random() * 3000; }
  else if (mood === "thinking" || mood === "listening") f = 2 + (Math.floor(now / 110) % 2);  // คิดอยู่/ฟังอยู่ = พิมพ์รัว
  else { if (burst <= 0 && Math.random() < 0.012) burst = 6 + Math.floor(Math.random() * 6); // ว่าง = พิมพ์เป็นช่วง ๆ
    if (burst > 0) { f = 2 + (Math.floor(now / 170) % 2); if (Math.floor(now / 170) !== frame) burst--; } }
  frame = Math.floor(now / 170);
  for (const el of document.querySelectorAll(".pibot")) el.style.backgroundPositionX = `${(f * 100) / 3}%`;
  requestAnimationFrame(animate);
}

// ---------------------------------------------------------------- กล่องแชท
let chat = [], open = false, cfg = loadCfg(), kbP = null, busy = false, seq = 0, unread = false, setOpen = false, listening = false, rec = null;
let model = { ok: true, text: "" };
const snaps = new Map();                                                          // การ์ดที่ทำแล้ว → สภาพแบบก่อนกด ทำเลย (เลิกทำ)
try { chat = JSON.parse(localStorage.getItem(LS_CHAT) || "[]").slice(-50); } catch (e) { /* */ }
for (const m of chat) if ((m.who === "card" || m.who === "auto") && m.state === "open") m.state = "closed";   // รอบก่อนโหลดหน้าใหม่ = หมดอายุ
const saveChat = () => { try { localStorage.setItem(LS_CHAT, JSON.stringify(chat.slice(-50).map((m) => ((m.who === "card" || m.who === "auto") && m.state === "open" ? { ...m, state: "closed" } : m)))); } catch (e) { /* */ } };
seq = chat.reduce((m, x) => Math.max(m, x.id || 0), 0);
let ws = {};                                                                      // หน้าต่าง: ย่อ · ขยายเต็มจอ · ขนาดที่ลากปรับเอง
try { ws = JSON.parse(localStorage.getItem(LS_WIN) || "{}") || {}; } catch (e) { /* */ }
const saveWin = () => { try { localStorage.setItem(LS_WIN, JSON.stringify(ws)); } catch (e) { /* */ } };

const fab = document.createElement("button");
fab.className = "aifab"; fab.type = "button"; fab.title = "ผู้ช่วย AI piBot (Ctrl+J) · ลากเพื่อย้ายไม่ให้บังตัวอักษร"; fab.innerHTML = bot(60);
const win = document.createElement("section");
win.className = "aiw"; win.hidden = true; win.setAttribute("aria-label", "ผู้ช่วย AI");
document.body.append(fab, win);

function provName() { const p = byId(cfg, cfg.provider) || providers(cfg)[0]; return cfg.provider === "none" ? "ไม่ใช้ AI · ค้นคู่มือในเครื่อง" : p.name.split(" (")[0]; }
/** สถานะโมเดล (จุดเขียว/แดง): ไม่ใช้ AI = เขียวเสมอ · ไม่มีคีย์/ติดต่อไม่ได้ = แดง */
async function refreshStatus() {
  if (cfg.provider === "none") model = { ok: true, text: provName() };
  else {
    const ch = chain(cfg, CLOUD), p = ch[0], sel = byId(cfg, cfg.provider);
    if (!p) model = { ok: false, text: `${provName()} · ⚠ ยังไม่มีคีย์ — ตอบจากคู่มือในเครื่อง` };
    else {
      model = { ok: true, text: `${provName()} · กำลังตรวจ…` }; paintStatus();
      const ok = await reachable(p, cfg, CLOUD), mdl = (cfg.models[p.id] || p.models[0] || "").split("/").pop();
      model = { ok, text: `${p.anthropic ? prettyModel(cfg.models[p.id] || p.models[0]) : `${p.name.split(" (")[0]} · ${mdl}`}${!sel || p.id !== sel.id ? " (สำรอง)" : ""}${ok ? "" : " · ⚠ ติดต่อไม่ได้"}` };
    }
  }
  paintStatus();
}
function paintStatus() { const c = win.querySelector(".aichip"); if (c) c.innerHTML = `<span class="aidot ${model.ok ? "on" : "off"}"></span>${esc(model.text || provName())}`; }

function badgeHtml(m) {
  const b = (m.badges || []).map((k) => A.BADGE[k]).filter(Boolean), s = (m.src || []).filter(Boolean);
  if (!b.length && !s.length) return "";
  return `<div class="aisrc">${b.map((x) => `<span class="aibadge">${esc(x)}</span>`).join("")}${s.length ? `<span>ที่มา: ${s.map(esc).join(" · ")}</span>` : ""}</div>`;
}
function msgHtml(m) {
  if (m.who === "card") {
    const list = m.actions.map((a) => `<li>${esc(A.describe(a))}</li>`).join("");
    const foot = m.state === "open"
      ? `<button class="aibtn pri" data-card="do" data-id="${m.id}">✓ ทำเลย</button><button class="aibtn" data-card="view" data-id="${m.id}">ดูบนผัง</button><button class="aibtn" data-card="no" data-id="${m.id}">ไม่ทำ</button>`
      : m.state === "done" ? `<span class="aist ok">${m.bad ? "⚠ ทำได้บางข้อ" : "✓ กดทำแล้ว"}</span>${snaps.has(m.id) ? `<button class="aibtn" data-card="undo" data-id="${m.id}" title="คืนแบบเป็นเหมือนก่อนกด ทำเลย">↶ เลิกทำ</button>` : ""}${(m.keys || []).length ? `<button class="aibtn" data-card="view" data-id="${m.id}">ดูบนผัง</button>` : ""}`
        : `<span class="aist">${m.state === "undone" ? "↶ เลิกทำแล้ว — แบบกลับเป็นเหมือนก่อนกด ทำเลย" : m.state === "no" ? "ไม่ทำ" : "หมดอายุ (โหลดหน้าใหม่แล้ว)"}</span>`;
    return `<div class="aicard"><div class="aich">${esc(m.title || "ผู้ช่วยเสนอ — กดยืนยันก่อน")}</div>${m.say ? `<p class="aicp">${br(m.say)}</p>` : ""}<ul>${list}</ul>${m.result ? `<p class="aicr">${br(m.result)}</p>` : ""}<div class="aicf">${foot}</div></div>`;
  }
  if (m.who === "auto") {
    const B = (c, t, pri) => `<button class="aibtn${pri ? " pri" : ""}" data-auto="${c}" data-id="${m.id}">${t}</button>`;
    const foot = m.state === "open" ? (m.actions.length ? B("do", "▶ ทำ", true) : "") + B("skip", "ข้าม") + B("stop", "หยุด")
      : `<span class="aist">${m.state === "done" ? (m.bad ? "⚠ ทำได้บางข้อ" : "✓ กดทำแล้ว") : m.state === "skip" ? "ข้ามขั้นนี้" : m.state === "stop" ? "หยุดแล้ว" : m.state === "undone" ? "↶ เลิกทำแล้ว" : "หมดอายุ"}</span>${m.state === "done" && snaps.has(m.id) ? B("undo", "↶ เลิกทำ") : ""}`;
    return `<div class="aicard auto"><div class="aich">🤖 ออกแบบอัตโนมัติ · ขั้น ${m.n}/${m.total} ${esc(m.name)}${m.st === "done" ? " ✓" : ""}</div><p class="aicp">${br(m.say)}${m.info ? `<br><small>สถานะ: ${esc(m.info)}</small>` : ""}</p>${m.actions.length ? `<ul>${m.actions.map((a) => `<li>${esc(A.describe(a))}</li>`).join("")}</ul>` : ""}${m.result ? `<p class="aicr">${br(m.result)}</p>` : ""}<div class="aicf">${foot}</div></div>`;
  }
  if (m.who === "steps") {
    return `<div class="aimsg ai"><b>➡️ ต่อไปทำอะไร (${esc(m.where)})</b><ol class="aisteps">${m.steps.map((s, i) => `<li class="${s.done ? "done" : ""}">${s.done ? "✓ " : ""}${esc(s.say)}${!s.done && s.act ? ` <button class="aibtn small" data-step="${m.id}:${i}">${esc(s.act.label || "ทำ")}</button>` : ""}</li>`).join("")}</ol></div>`;
  }
  const extra = (m.focus && m.focus.length ? `<button class="aibtn small" data-focus="${m.id}">ดูบนผัง</button>` : "") + (m.point ? `<button class="aibtn small" data-point="${m.id}">ชี้ปุ่มนี้บนจอ</button>` : "");
  return `<div class="aimsg ${m.who}">${br(m.text)}${m.dropped && m.dropped.length ? `<div class="aidrop">ไม่เสนอ (ค่าไม่ผ่านการตรวจ): ${esc(m.dropped.join(" · "))}</div>` : ""}${extra ? `<div class="aiext">${extra}</div>` : ""}${badgeHtml(m)}</div>`;
}
function autoBar() {
  if (!host().autoPlan) return "";
  let plan; try { plan = host().autoPlan(); } catch (e) { return ""; }
  const cur = plan.find((s) => s.state !== "done");
  return cur ? `<div class="ainext"><span>ขั้น ${cur.n}/${cur.total} · <b>${esc(cur.name)}</b></span><button class="aibtn pri" data-h="autonext">ทำขั้นต่อไป</button></div>`
    : `<div class="ainext"><span>ครบ ${plan.length} ขั้นแล้ว ✓</span><button class="aibtn" data-q="check">✅ ตรวจซ้ำ</button></div>`;
}
const HB = (h, t, g) => `<button class="aihb" data-h="${h}" title="${t}" aria-label="${t}">${g}</button>`;
function render() {
  if (!open) return;
  const H = host(), quick = [["next", "➡️ ต่อไปทำอะไร"], ["help", "❓ หน้านี้ใช้ยังไง"], ...(H.facts ? [["facts", "📊 สรุป"]] : []),
    ...(H.checks ? [["check", "✅ ตรวจงาน"], ["explain", "💡 อธิบายผลตรวจ"]] : []), ...(H.bom ? [["bom", "🧱 สรุปวัสดุ"]] : []), ...(H.autoPlan ? [["auto", "🤖 ออกแบบอัตโนมัติ"]] : [])];
  win.classList.toggle("min", !!ws.min); win.classList.toggle("max", !!ws.max && !ws.min);
  win.innerHTML = `<div class="aih" title="ลากเพื่อย้าย · ดับเบิลคลิก = ขยาย/คืนขนาด">${bot(32)}<div class="aiht"><b>piBot ผู้ช่วย ASCA</b><span class="aichip"></span></div>
    ${HB("cfg", "ตั้งค่าผู้ให้บริการ AI", "⚙")}${HB("clear", "ล้างแชท", "🗑")}${HB("min", ws.min ? "คืนขนาด" : "ย่อ", ws.min ? "▴" : "▁")}${HB("max", ws.max ? "คืนขนาด" : "ขยายเต็มจอ", ws.max ? "❐" : "□")}${HB("close", "ปิด (Ctrl+J)", "✕")}</div>
    <div class="aictx">อยู่ที่ <b>${esc(pageName())}</b></div>
    <div class="aibody">${chat.length ? chat.map(msgHtml).join("") : `<div class="aimsg ai">สวัสดีครับ ผม piBot 🤖 ถามวิธีใช้ ASC Architect ได้เลย เช่น "วาดผนังให้ได้ระยะจริงยังไง" หรือสั่ง เช่น "วาดห้อง 4x5" · "หลังคาจั่ว 25 องศา" · "ตรวจโครงสร้าง" — ทุกคำสั่งต้องกด ทำเลย ก่อน</div>`}${busy ? `<div class="aimsg ai thinking">กำลังคิด…</div>` : ""}${listening ? `<div class="aimsg ai thinking">🎙 กำลังฟัง… พูดได้เลย</div>` : ""}</div>
    <div class="aiq">${quick.map(([q, t]) => `<button class="aiqc" data-q="${q}">${t}</button>`).join("")}</div>
    ${autoBar()}
    <div class="aiin">${SR ? `<button class="aihb aimic${listening ? " rec" : ""}" data-h="mic" title="พูดคำถาม/คำสั่ง (ภาษาไทย) — ใช้ระบบรู้จำเสียงของเบราว์เซอร์ บางเบราว์เซอร์ส่งเสียงไปแปลงที่เซิร์ฟเวอร์ของผู้ผลิตเบราว์เซอร์" aria-label="พูด">🎙</button>` : ""}<textarea rows="1" class="aita" placeholder="พิมพ์คำถามหรือคำสั่ง แล้ว Enter"></textarea><button class="aibtn pri" data-h="send">ส่ง</button></div>`;
  paintStatus();
  if (setOpen) settings();
  const b = win.querySelector(".aibody"); if (!setOpen) b.scrollTop = b.scrollHeight;
  if (!busy && !setOpen && !ws.min) win.querySelector(".aita").focus();
}
function add(m) {
  m.id = ++seq; chat.push(m); saveChat();
  if (!open && m.who !== "me") { unread = true; fab.classList.add("unread"); }
  render(); return m;
}
function toggle(v) {
  open = v ?? !open; win.hidden = !open; fab.classList.toggle("on", open);
  if (open) {
    unread = false; fab.classList.remove("unread");
    if (ws.min) { ws.min = false; saveWin(); }
    place(); render(); refreshStatus();
    kbP = kbP || loadKB(BASE).catch((e) => { add({ who: "ai", text: "โหลดคลังความรู้ไม่ได้: " + e.message }); return null; });
  }
}
function place() {
  let p = null; try { p = JSON.parse(localStorage.getItem(LS_POS) || "null"); } catch (e) { /* */ }
  if (ws.max && !ws.min) {
    Object.assign(win.style, { left: "8px", top: "8px", width: innerWidth - 16 + "px", height: innerHeight - 16 + "px" });
    return;
  }
  const w = Math.min(Math.max(300, ws.w || 380), innerWidth - 16), h = Math.min(Math.max(240, ws.h || 560), innerHeight - 24);
  win.style.width = w + "px"; win.style.height = ws.min ? "" : h + "px";
  const hh = ws.min ? 52 : h;
  const x = p ? Math.min(Math.max(0, p.x), innerWidth - w) : innerWidth - w - 16, y = p ? Math.min(Math.max(0, p.y), innerHeight - hh) : innerHeight - hh - 84;
  win.style.left = x + "px"; win.style.top = Math.max(0, y) + "px";
}
function setWin(p) { ws = { ...ws, ...p }; saveWin(); place(); render(); }
// ลากมุมขวาล่างปรับขนาด (CSS resize) → จำขนาด · ไม่จำตอนย่อ/ขยายเต็มจอ
if (window.ResizeObserver) new ResizeObserver(() => {
  if (!open || ws.min || ws.max) return;
  const w = Math.round(win.offsetWidth), h = Math.round(win.offsetHeight);
  if (w < 100 || h < 100 || (Math.abs(w - (ws.w || 0)) < 3 && Math.abs(h - (ws.h || 0)) < 3)) return;
  ws.w = w; ws.h = h; saveWin();
}).observe(win);

// ---------------------------------------------------------------- เสนอคำสั่ง → การ์ด (อ่านผลอย่างเดียว = ทำทันที)
async function propose(acts, opt = {}) {
  const read = acts.filter((a) => kindOf(a) === "read"), rest = acts.filter((a) => kindOf(a) !== "read");
  for (const a of read) { const r = await runAction(a); if (r.msg) add({ who: "ai", text: r.msg, badges: ["data"], focus: r.keys }); }
  if (rest.some((a) => a.name === "auto.design")) return autoStart();
  if (rest.length) add({ who: "card", title: opt.title, say: opt.say, actions: rest, state: "open" });
}
async function doCard(m) {
  const H = host(), snap = H.snapshot ? H.snapshot() : null, res = [];
  let bad = false, keys = [];
  busy = true; mood = "thinking"; render();
  try {
    for (const a of m.actions) { const r = await runAction(a); if (!r.ok) bad = true; if (r.msg) res.push((r.ok ? "" : "✗ ") + r.msg); keys = keys.concat(r.keys || []); }
  } finally { busy = false; mood = "idle"; }
  m.state = "done"; m.bad = bad; m.result = res.join("\n"); m.keys = keys;
  if (snap != null && H.snapshot() !== snap) snaps.set(m.id, snap);
  saveChat(); render();
}
function undoCard(m) {
  if (!snaps.has(m.id) || !host().restore) return;
  host().restore(snaps.get(m.id)); snaps.delete(m.id); m.state = "undone"; saveChat(); render();
}
function viewCard(m) {
  const H = host();
  if (m.keys && m.keys.length && H.focus && H.focus(m.keys)) return;
  for (const a of m.actions) {
    if (a.tool === "press") { const p = pressables().get(a.key); if (p && pointAt(p.el)) return; }
    if (a.tool === "set") { const el = document.getElementById(a.id); if (el && pointAt(el)) return; }
    if ((a.name === "beam.resize" || a.name === "column.resize") && H.focus && H.focus({ kind: a.name === "beam.resize" ? "beam" : "column", mark: a.params.mark })) return;
    if (a.name === "help.open") { helpOpen(a.params.key); return; }
  }
  add({ who: "ai", text: "ยังไม่มีวัตถุให้ชี้บนผัง — คำสั่งนี้สร้าง/เปิดสิ่งใหม่ กด ทำเลย ก่อน แล้วกด ดูบนผัง บนการ์ดอีกครั้ง" });
}

// ---------------------------------------------------------------- ออกแบบอัตโนมัติทีละขั้น (ผัง → 3D → โครงสร้าง → โซลาร์ → ชุดแบบ) · แต่ละขั้นผู้ใช้กด ทำ/ข้าม/หยุด
function autoStart(from) {
  const H = host(); if (!H.autoPlan) return add({ who: "ai", text: "ออกแบบอัตโนมัติใช้ได้ที่ ✏️ ตัวเขียนแบบ 2D/3D" });
  const plan = H.autoPlan();
  for (const m of chat) if (m.who === "auto" && m.state === "open") m.state = "stop";
  let i = from;
  if (i == null) {
    i = plan.findIndex((s) => s.state !== "done");
    if (i < 0) return add({ who: "ai", text: `ครบทั้ง ${plan.length} ขั้นแล้ว ✓ — กด ✅ ตรวจงาน เพื่อตรวจซ้ำ`, badges: ["data"] });
    add({ who: "ai", text: `ออกแบบอัตโนมัติ ${plan.length} ขั้น: ${plan.map((s) => s.name).join(" → ")}\nเริ่มที่ขั้น ${i + 1} (ขั้นแรกที่ยังไม่เสร็จ) · ทุกขั้นกด ▶ ทำ / ข้าม / หยุด เอง · ทำแล้วเลิกทำได้`, badges: ["data"] });
  }
  autoPost(i, plan);
}
function autoPost(i, plan = host().autoPlan()) {
  if (i >= plan.length) return add({ who: "ai", text: `ออกแบบอัตโนมัติครบ ${plan.length} ขั้นแล้ว — ดูผลจริงด้วย ✅ ตรวจงาน · ผลตรวจโครงสร้างเป็นการตรวจเบื้องต้น ต้องให้วิศวกรรับรองก่อนก่อสร้าง`, badges: ["data"] });
  const s = plan[i];
  add({ who: "auto", i, n: s.n, total: s.total, name: s.name, st: s.state, info: s.info, say: s.say, actions: s.actions || [], state: "open" });
}
async function autoCmd(c, m) {
  if (m.state !== "open" && c !== "undo") return;
  if (c === "undo") { if (snaps.has(m.id) && host().restore) { host().restore(snaps.get(m.id)); snaps.delete(m.id); m.state = "undone"; saveChat(); render(); } return; }
  if (c === "stop") { m.state = "stop"; saveChat(); return add({ who: "ai", text: "หยุดออกแบบอัตโนมัติแล้ว — ทำต่อได้ด้วยปุ่ม ทำขั้นต่อไป ที่แถบล่าง" }); }
  if (c === "skip") { m.state = "skip"; saveChat(); return autoPost(m.i + 1); }
  await doCard(m);                                                                 // ทำ = ผู้ใช้ยืนยันขั้นนี้ (สแนปช็อตก่อนทำ → เลิกทำได้)
  autoPost(m.i + 1);
}

// ---------------------------------------------------------------- ถามเร็ว: ตรวจงาน · อธิบายผลตรวจ · สรุปวัสดุ (ตัวเลขจากโค้ดของหน้าเท่านั้น)
async function quick(q) {
  const H = host();
  if (q === "next") return ask("ต่อไปทำอะไร");
  if (q === "help") return ask("หน้านี้ใช้ยังไง");
  if (q === "facts") { add({ who: "me", text: "📊 สรุป" }); return add({ who: "ai", text: factsText() ? `ตัวเลขจากแบบปัจจุบัน (โปรแกรมคำนวณ):\n${factsText()}` : "หน้านี้ไม่มีตัวเลขสรุป", badges: ["data"] }); }
  if (q === "check" && H.run) { add({ who: "me", text: "✅ ตรวจงาน" }); return propose([{ name: "struct.check", params: {} }, { name: "workflow.check", params: {} }]); }
  if (q === "explain" && H.explain) { add({ who: "me", text: "💡 อธิบายผลตรวจ" }); const e = H.explain(); return add({ who: "ai", text: e.text, badges: ["data"], focus: e.keys }); }
  if (q === "bom" && H.bom) { add({ who: "me", text: "🧱 สรุปวัสดุ" }); return add({ who: "ai", text: H.bom(), badges: ["data"] }); }
  if (q === "auto") { add({ who: "me", text: "🤖 ออกแบบอัตโนมัติ" }); return autoStart(); }
}

// ---------------------------------------------------------------- ตอบ
function nextSteps() {
  const steps = host().next ? host().next() : [];
  if (!steps.length) return null;
  for (const s of steps) if (s.act) { const v = validateLegacy([s.act]); s.act = v[0] ? { ...s.act, label: s.act.label || v[0].label } : null; }
  return add({ who: "steps", where: pageName(), steps });
}
function factsText() {
  const f = facts(), keys = Object.keys(f);
  return keys.length ? keys.map((k) => `${k}: ${f[k]}`).join("\n") : "";
}
function checksText() {
  if (!host().checks) return "";
  try { const c = host().checks(); return [c.structShort, c.wfShort].filter(Boolean).join("\n"); } catch (e) { return ""; }
}
async function search(q) {
  const kb = await kbP; if (!kb) return [];
  return kb.search(q, { page: page(), k: 4 });
}
const LANG_NOTE = { lo: "ຄູ່ມືເປັນພາສາໄທ — ເລືອກຜູ້ໃຫ້ບໍລິການ AI ທີ່ ⚙ ເພື່ອໃຫ້ແປເປັນພາສາລາວ", en: "The manual is in Thai — choose an AI provider at ⚙ to get answers in English." };
function offlineAnswer(q, hits, lang, info) {
  const top = hits[0], note = lang !== "th" ? LANG_NOTE[lang] + "\n\n" : "";
  if (!top || top.score < 0.22) {
    logMiss(q);
    return add({ who: "ai", text: note + "ไม่พบในคู่มือครับ — ลองถามด้วยคำอื่น หรือกด ➡️ ต่อไปทำอะไร (คำถามนี้บันทึกไว้เพิ่มในคลังความรู้รุ่นต่อไป)" });
  }
  const c = top.chunk, more = hits.slice(1, 3).filter((h) => h.score > 0.3).map((h) => h.chunk.title);
  const point = c.src === "ui" && c.key && pressables().has(c.key) ? c.key : null;
  add({ who: "ai", text: note + `${c.title}\n${c.text.slice(0, 700)}` + (more.length ? `\n\nเกี่ยวข้อง: ${more.join(" · ")}` : ""), badges: ["kb"], src: [c.src === "ui" ? `ปุ่มในหน้า ${c.where || c.page}` : c.file || c.id], point });
  // คำสั่ง (ไม่ใช่คำถามขอข้อมูล) ที่ตรงกับปุ่ม → เสนอกดปุ่มให้ (ต้องยืนยัน) · คำถาม "ยังไง/ทำไม" ไม่เสนอการ์ด มีแค่ ชี้ปุ่มนี้บนจอ
  if (point && !info) { const v = validateLegacy([{ tool: "press", key: c.key }]); if (v.length) add({ who: "card", title: "ให้กดปุ่มนี้ให้ไหม", actions: v, state: "open" }); }
}
function logMiss(q) { try { const a = JSON.parse(localStorage.getItem(LS_MISS) || "[]"); a.push(`${new Date().toISOString().slice(0, 16)} [${page()}] ${q}`); localStorage.setItem(LS_MISS, JSON.stringify(a.slice(-200))); } catch (e) { /* */ } }

/** ปุ่มที่เกี่ยวกับคำถาม (ปุ่มที่คลังความรู้ชี้ + ป้ายมีคำในคำถาม) ไม่เกิน 15 ปุ่ม — prompt สั้น โมเดลเล็กบน CPU ตอบทัน */
function relevantPress(q, hits) {
  const all = [...pressables().values()], keys = new Set(hits.map((h) => h.chunk.key).filter(Boolean));
  const qn = q.toLowerCase(), score = (p) => (keys.has(p.key) ? 3 : 0) + p.label.toLowerCase().split(/[\s()·:,]+/).filter((w) => w.length > 1 && qn.includes(w)).length;
  return all.map((p) => [score(p), p]).filter(([n]) => n > 0).sort((a, b) => b[0] - a[0]).slice(0, 15).map(([, p]) => p);
}
function prompt(q, hits, lang) {
  const P = relevantPress(q, hits).map((p) => `${p.key} = ${p.label}`).join("\n");
  const S = Object.entries(setsList()).map(([id, s]) => {                       // ช่องเลือก: ส่งคู่ รหัส=ป้าย (hip=ปั้นหยา) โมเดลจะได้ไม่เดารหัสผิด
    const el = document.getElementById(id);
    const hint = el && el.tagName === "SELECT" ? [...el.options].map((o) => `${o.value}=${o.textContent.trim()}`).join(", ") : el && el.type === "checkbox" ? "true/false" : s.hint || "";
    return `${id} = ${s.label}${hint ? " (" + hint + ")" : ""}`;
  }).join("\n");
  const know = hits.slice(0, 3).map((h) => `[${h.chunk.id}] ${h.chunk.title}\n${h.chunk.text.slice(0, 500)}`).join("\n\n");
  const sys = `คุณคือ piBot ผู้ช่วยของโปรแกรม ASC Architect (ASCA) ตอบสั้น กระชับ เป็นกันเอง
กติกา
1. เรื่องโปรแกรม (ปุ่ม เมนู วิธีใช้ ขั้นตอน): ตอบจาก "ความรู้" ที่ให้เท่านั้น ใส่รหัสในวงเล็บ [ ] ของชิ้นที่ใช้ใน sources · ความรู้ไม่มีคำตอบ = answer "ไม่พบในคู่มือ"
2. ตัวเลขของงานนี้ (ขนาด จำนวน ผลตรวจ): ใช้เฉพาะตัวเลขใน "สถานะหน้า" และ "ผลตรวจ" ห้ามคิด เดา หรือคำนวณตัวเลขเอง
3. ผู้ใช้สั่งให้ทำ: ใส่ actions จาก "คำสั่งที่ใช้ได้" เป็น {"name":"ชื่อคำสั่ง","params":{...}} (หรือ {"tool":"press","key":"รหัสปุ่ม"} / {"tool":"set","id":"รหัสช่อง","value":ค่า}) · ใช้ตัวเลขที่ผู้ใช้พูดเท่านั้น · ผู้ใช้แค่ถาม (ทำไม ยังไง คืออะไร) = actions ว่าง
4. คุณทำเองไม่ได้ — ห้ามบอกว่า "ทำแล้ว/เรียบร้อย" ให้บอกว่าเสนอไว้ ผู้ใช้ต้องกด ทำเลย บนการ์ด
5. เรื่องทั่วไปนอกโปรแกรม (ความรู้ก่อสร้าง ไฟฟ้า กฎหมายทั่วไป): ตอบจากความรู้ของคุณได้ sources ว่าง · ห้ามแต่งปุ่ม/เมนูที่ไม่มีในรายการ
6. ${A.LANG_RULE[lang] || A.LANG_RULE.th}
ตอบเป็น JSON เท่านั้น: {"answer":"...","actions":[],"sources":[]}`;
  const cat = A.actionCatalog(A.relevantActions(q, page()));
  const user = `หน้าปัจจุบัน: ${pageName()}\nสถานะหน้า:\n${factsText() || "-"}\n\nผลตรวจ (โปรแกรมคำนวณ):\n${checksText() || "-"}\n\nคำสั่งที่ใช้ได้ (* = ต้องมี):\n${cat || "-"}\n\nปุ่มที่กดได้:\n${P || "-"}\n\nช่องที่ตั้งค่าได้:\n${S || "-"}\n\nความรู้:\n${know || "-"}\n\nคำถาม: ${q}${A.LANG_TAIL[lang] || ""}`;
  return [{ role: "system", content: sys }, { role: "user", content: user }];
}

async function ask(q) {
  q = String(q || "").trim(); if (!q || busy) return;
  const ta = win.querySelector(".aita"); if (ta) ta.value = "";
  const lang = A.detectLang(q), info = A.isInfoQuestion(q);
  add({ who: "me", text: q });
  if (NEXT_RE.test(q) && !/ทำไม|why/i.test(q)) { if (nextSteps()) return; }
  // 1) ตัวแปลงคำสั่งในเครื่อง (ไม่ใช้ AI) — คำถามขอข้อมูลไม่แปลงเป็นคำสั่ง
  if (!info) {
    const r = A.routeLocal(q, page());
    if (r) {
      const v = A.validateActions(r, vctx());
      if (v.ok.length) {
        await propose(v.ok, { title: "piBot เข้าใจว่าให้ทำ — กดยืนยันก่อน" });
        if (v.dropped.length) add({ who: "ai", text: "บางคำสั่งไม่เสนอ เพราะค่าไม่ผ่านการตรวจ", dropped: v.dropped });
        return;
      }
      if (v.dropped.some((x) => !x.startsWith("cad.command"))) return add({ who: "ai", text: "คำสั่งนี้ไม่เสนอ เพราะค่าไม่ผ่านการตรวจ — พิมพ์ใหม่ด้วยค่าในช่วงที่ใช้ได้", dropped: v.dropped });
    }
  }
  const offline = !chain(cfg, CLOUD).length;
  if (offline && FACT_RE.test(q) && factsText()) add({ who: "ai", text: `ตัวเลขจากแบบปัจจุบัน (โปรแกรมคำนวณ):\n${factsText()}`, badges: ["data"] });
  if (offline && CHECK_RE.test(q) && host().explain) { const e = host().explain(); add({ who: "ai", text: e.text, badges: ["data"], focus: e.keys }); return; }
  const query = HELP_RE.test(q) ? `${pageName()} ใช้ทำอะไร ${q}` : q;
  busy = true; mood = "thinking"; render();
  try {
    const hits = await search(query);
    if (offline) { if (!(FACT_RE.test(q) && factsText())) offlineAnswer(q, hits, lang, info); return; }
    try {
      const say = (p) => { const t = win.querySelector(".thinking"); if (t) t.textContent = `กำลังถาม ${p.name.split(" (")[0]}…`; };
      const r = await askChain(cfg, CLOUD, prompt(q, hits, lang), say);
      let { answer, actions, sources } = parseReply(r.text);
      if (A.wrongLang(answer, lang)) {                                         // ตอบผิดภาษา → ขอแปลอีกรอบ (สั้น ไม่ใช้ JSON)
        const to = { th: "Thai (ภาษาไทย)", lo: "Lao (ພາສາລາວ)", en: "English" }[lang];
        try {
          const tr = (await askChain(cfg, CLOUD, [{ role: "system", content: `Translate the user's text into ${to}. Keep numbers, units and symbols as they are. Reply with the translation only.` }, { role: "user", content: answer }])).text.trim();
          if (tr && !A.wrongLang(tr, lang)) answer = tr;
        } catch (e) { /* ใช้คำตอบเดิม */ }
      }
      const cited = hits.filter((h) => sources.includes(h.chunk.id) || (h.chunk.title.length > 6 && answer.includes(h.chunk.title)));
      const notFound = A.saysNotFound(answer);
      if (notFound) logMiss(q);
      const v = info ? { ok: [], dropped: [] } : A.validateActions(actions.filter((a) => a && !a.tool), vctx());
      const leg = info ? [] : validateLegacy(actions.filter((a) => a && a.tool));
      const data = A.usedNumbers(answer, `${factsText()}\n${checksText()}`) || v.ok.length + leg.length > 0;
      add({ who: "ai", text: answer, badges: A.answerSource({ kb: cited.length > 0, data, llm: true, notFound }), src: [r.provider.name.split(" (")[0], ...cited.map((h) => h.chunk.title)], dropped: v.dropped });
      if (v.ok.length || leg.length) await propose([...v.ok, ...leg]);
    } catch (e) {
      add({ who: "ai", text: `AI ใช้ไม่ได้ตอนนี้ (${e.message}) — ตอบจากคู่มือในเครื่องแทน` });
      offlineAnswer(q, hits, lang, info);
    }
  } finally { busy = false; mood = "idle"; render(); }
}

// ---------------------------------------------------------------- พิมพ์ด้วยเสียง (Web Speech API ของเบราว์เซอร์ · th-TH)
function mic() {
  if (!SR) return;
  if (listening && rec) { rec.stop(); return; }
  try {
    rec = new SR(); rec.lang = "th-TH"; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = (e) => { const t = e.results && e.results[0] && e.results[0][0] ? e.results[0][0].transcript : ""; listening = false; mood = "idle"; if (t.trim()) ask(t); else render(); };
    rec.onerror = (e) => { listening = false; mood = "idle"; add({ who: "ai", text: e.error === "not-allowed" ? "เบราว์เซอร์ไม่อนุญาตให้ใช้ไมค์ — กดรูปกุญแจข้างช่องที่อยู่เว็บ แล้วอนุญาต ไมโครโฟน" : `ไมค์ใช้ไม่ได้ (${e.error}) — พิมพ์แทนได้` }); };
    rec.onend = () => { if (listening) { listening = false; mood = "idle"; render(); } };
    listening = true; mood = "listening"; rec.start(); render();
  } catch (e) { listening = false; mood = "idle"; add({ who: "ai", text: "เริ่มฟังเสียงไม่ได้: " + e.message }); }
}

// ---------------------------------------------------------------- ตั้งค่า (ผู้ให้บริการ · เจ้าที่เพิ่มเอง · ทดสอบ)
// 0.31.0 (หน้าตัวอย่างที่ลุงพีอนุมัติ 5 พ.ย. 2569 · หน้าตาเดียวกับ ASC Studio): 2 ช่อง
//   ซ้าย ⚙️ ผู้ให้บริการ AI: รายการปุ่มเลือก (+ Claude ป้าย "ใหม่") · ป้ายสถานะรุ่น · คีย์ · โมเดล · ทดสอบ · ลิงก์ขอคีย์
//   ขวา  ➕ เพิ่ม AI อื่น: เลือกเจ้าที่รู้จัก (กรอก URL ให้) หรือ "อื่น ๆ" · ชื่อ · Base URL · โมเดล + ดึงรายชื่อ · คีย์ · ทดสอบ / บันทึก
let draft = null;                                                                   // ค่าที่แก้ในฟอร์ม (ยังไม่บันทึก) — เปลี่ยนปุ่มเลือกแล้วคีย์ที่พิมพ์ไม่หาย
const hostOf = (u) => { try { return new URL(u).host; } catch (e) { return u; } };
function settings() {
  draft = { ...cfg, keys: { ...cfg.keys }, models: { ...cfg.models }, custom: (cfg.custom || []).map((x) => ({ ...x })) };
  const all = providers(draft).filter((p) => !(p.localOnly && CLOUD));
  const list = all.map((p) => `<label class="aipopt${p.id === draft.provider ? " sel" : ""}"><input type="radio" name="aiprov" value="${esc(p.id)}"${p.id === draft.provider ? " checked" : ""}><span>${esc(p.name)}</span>${p.isNew ? `<em class="aipnew">ใหม่</em>` : ""}</label>`).join("");
  let miss = []; try { miss = JSON.parse(localStorage.getItem(LS_MISS) || "[]"); } catch (e) { /* */ }
  const body = win.querySelector(".aibody");
  body.innerHTML = `<div class="aicfg"><div class="aip2">
    <section class="aipcard"><div class="aiphd"><b>⚙️ ผู้ให้บริการ AI</b><span class="aipchip${model && !model.ok ? " bad" : ""}">● ${esc(model && model.text ? model.text : provName())}</span></div>
    <div class="aiplist">${list}</div><div class="aipdet" id="ai-det"></div>
    <p class="small">ถ้าเจ้าที่เลือกใช้ไม่ได้ จะลองเจ้าอื่นต่อเอง · ไม่ใช้ AI = ค้นคลังความรู้ + แปลงคำสั่งในเครื่อง ไม่ส่งอะไรออก</p>
    <p><button class="aibtn pri" data-h="cfg-save">บันทึก</button> <button class="aibtn" data-h="cfg-close">ปิด</button> <button class="aibtn" data-h="cfg-wipe">ลบคีย์ทั้งหมด</button> <button class="aibtn" data-h="miss" ${miss.length ? "" : "disabled"}>ส่งออกคำถามที่ตอบไม่ได้ (${miss.length})</button></p></section>
    <section class="aipcard"><div class="aiphd"><b>➕ เพิ่ม AI อื่น</b></div>
    <p class="small">เลือกเจ้าที่รู้จัก = กรอก URL ให้เอง · หรือเลือก "อื่น ๆ" แล้วกรอกเอง (ต้องเป็น API แบบ OpenAI)</p>
    <label>ผู้ให้บริการ <select id="ai-ps">${PRESETS.map((x) => `<option value="${x.key}">${esc(x.label)}</option>`).join("")}</select></label>
    <label>ชื่อที่แสดง <input id="ai-cn" maxlength="40"></label>
    <label>Base URL (กรอกให้แล้ว) <input id="ai-cu" placeholder="https://api.example.com/v1" spellcheck="false"></label>
    <label>โมเดล <span class="aiprow"><input id="ai-cm" list="ai-cml" spellcheck="false"><button class="aibtn small" data-h="nfetch">ดึงรายชื่อ</button></span><datalist id="ai-cml"></datalist></label>
    <label>คีย์ API (ถ้ามี) <input type="password" id="ai-ck" autocomplete="off" placeholder="วางคีย์ที่นี่"></label>
    <a id="ai-csu" target="_blank" rel="noopener" hidden></a>
    <p><button class="aibtn" data-h="ntest">ทดสอบ</button> <button class="aibtn pri" data-h="cadd">บันทึก</button> <span class="aitest" id="ai-nout"></span></p>
    <div class="aipwarn">ทุกเจ้าใช้กติกาเดียวกัน: เรื่องโปรแกรมตอบจากคลังความรู้ · ตัวเลขจากงานจริง · ป้ายที่มา 📚🗂️🌐</div>
    <p class="small">หน้าตาเดียวกันทั้ง ASC Studio และ ASC Architect · รุ่นในเครื่องส่งผ่าน server ในเครื่องเมื่อเว็บผู้ให้บริการบล็อกการเรียกจากหน้าเว็บ</p></section>
  </div></div>`;
  det(draft.provider); preset();
}
/** รายละเอียดเจ้าที่เลือก (ช่องซ้ายล่าง) */
function det(id) {
  const p = byId(draft, id) || providers(draft)[0], box = win.querySelector("#ai-det"); if (!box) return;
  const test = `<button class="aibtn small" data-h="test" data-p="${esc(p.id)}">ทดสอบการเชื่อมต่อ</button> ${p.signup ? `<a class="aibtn small" href="${p.signup}" target="_blank" rel="noopener">ขอคีย์ที่ ${esc(hostOf(p.signup))} ↗</a>` : ""} <span class="aitest" data-tp="${esc(p.id)}"></span>`;
  const key = (p.key || p.custom) ? `<label>คีย์ API (เก็บในเครื่องนี้เท่านั้น ไม่ลงไฟล์งาน) <input type="password" data-key="${esc(p.id)}" value="${esc(draft.keys[p.id] || "")}" autocomplete="off" placeholder="วางคีย์ที่นี่"></label>` : "";
  const cur = draft.models[p.id] || (p.custom ? (draft.custom.find((x) => x.id === p.id) || {}).model : p.models && p.models[0]) || "";
  let html = "";
  if (p.id === "none") html = `<p class="small">ไม่ส่งอะไรออกนอกเครื่อง · คำถามค้นจากคลังความรู้ของโปรแกรม</p>`;
  else if (p.custom) {
    const c = draft.custom.find((x) => x.id === p.id) || {};
    html = `<label>ชื่อ <input data-cname="${esc(p.id)}" value="${esc(c.name || "")}"></label><label>ที่อยู่ API (base URL) <input data-curl="${esc(p.id)}" value="${esc(c.url || "")}"></label>
      <label>โมเดล <input data-cmodel="${esc(p.id)}" value="${esc(c.model || "")}"></label>${key}<p>${test} <button class="aibtn small" data-h="cdel" data-p="${esc(p.id)}">ลบเจ้านี้</button></p>`;
  } else {
    const mdl = p.modelNotes
      ? `<label>โมเดล <select data-model="${p.id}">${p.models.map((m) => `<option value="${esc(m)}"${m === cur ? " selected" : ""}>${esc(m)} · ${esc(p.modelNotes[m] || "")}</option>`).join("")}</select></label>`
      : `<label>โมเดล <input data-model="${p.id}" list="aim-${p.id}" value="${esc(cur)}"><datalist id="aim-${p.id}">${(p.models || []).map((m) => `<option value="${esc(m)}">`).join("")}</datalist></label>`;
    html = `${key}${mdl}<p>${test}</p>`;
  }
  const note = p.anthropic ? "คีย์ Claude แยกจากแพ็กเกจ Claude ที่ใช้แชต · คิดเงินตามการใช้ · คำถามจะถูกส่งออกนอกเครื่อง"
    : p.id === "none" ? "" : p.id === "ollama" ? "ใช้ Ollama ในเครื่องนี้ · ข้อมูลไม่ออกนอกเครื่อง"
    : "เจ้าออนไลน์จะได้รับคำถาม + ความรู้ที่เกี่ยวข้อง + สถานะหน้าและผลตรวจ (ตัวเลข ไม่มีชื่อไฟล์)";
  box.innerHTML = html + (note ? `<p class="small">${esc(note)}</p>` : "");
  if (p.id === "ollama" && !CLOUD) fetch("/api/ai/ollama/models").then((r) => r.json()).then((j) => {   // โมเดลที่มีใน Ollama ของเครื่องนี้
    const dl = win.querySelector("#aim-ollama"); if (!dl) return;
    dl.innerHTML = (j.models || []).map((m) => `<option value="${esc(m)}">`).join("");
    if (!j.ok) box.insertAdjacentHTML("beforeend", `<p class="small">${esc(j.error || "ไม่พบ Ollama")}</p>`);
  }).catch(() => {});
}
/** เลือกเจ้าที่รู้จัก (ช่องขวา) → กรอกชื่อ/URL/โมเดล/ลิงก์ขอคีย์ */
function preset() {
  const sel = win.querySelector("#ai-ps"); if (!sel) return;
  const x = PRESETS.find((y) => y.key === sel.value) || PRESETS[0], v = (id) => win.querySelector(id);
  v("#ai-cn").value = x.name; v("#ai-cu").value = x.url; v("#ai-cm").value = x.model; v("#ai-cml").innerHTML = ""; v("#ai-nout").textContent = "";
  const a = v("#ai-csu"); a.hidden = !x.signup; if (x.signup) { a.href = x.signup; a.textContent = `ขอคีย์ที่ ${hostOf(x.signup)} ↗`; }
}
/** ค่าในฟอร์มตั้งค่า (ยังไม่บันทึก) → cfg ชุดใหม่ (เริ่มจาก draft — เจ้าที่ไม่ได้เปิดดูอยู่คงค่าเดิม) */
function readForm(base) {
  const b = base || draft || cfg;
  const c = { ...b, keys: { ...b.keys }, models: { ...b.models }, custom: (b.custom || []).map((x) => ({ ...x })) };
  const sel = win.querySelector('input[name="aiprov"]:checked'); if (sel) c.provider = sel.value;
  for (const el of win.querySelectorAll("#ai-det [data-key]")) { const v = el.value.trim(); if (v) c.keys[el.dataset.key] = v; else delete c.keys[el.dataset.key]; }
  for (const el of win.querySelectorAll("#ai-det [data-model]")) c.models[el.dataset.model] = el.value.trim();
  for (const x of c.custom) {
    const g = (a) => win.querySelector(`[data-${a}="${CSS.escape(x.id)}"]`);
    if (g("cname")) x.name = g("cname").value.trim(); if (g("curl")) x.url = g("curl").value.trim(); if (g("cmodel")) x.model = g("cmodel").value.trim();
  }
  return c;
}
function saveSettings() {
  cfg = readForm(); saveCfg(cfg); setOpen = false; draft = null;
  add({ who: "ai", text: `ใช้: ${provName()}` + (cfg.provider !== "none" && !chain(cfg, CLOUD).length ? " — ยังไม่มีคีย์ของเจ้านี้ จะตอบจากคู่มือในเครื่อง" : "") });
  refreshStatus();
}
/** เจ้าใหม่จากช่องขวา (ยังไม่บันทึก) → { p, c } สำหรับทดสอบ · URL ใช้ไม่ได้ = null */
function newDraft() {
  const v = (id) => win.querySelector(id).value.trim(), base = okBase(v("#ai-cu"));
  if (!base) return null;
  const c = readForm(); c.keys = { ...c.keys, tmp: v("#ai-ck") }; c.models = { ...c.models, tmp: v("#ai-cm") };
  return { p: { id: "tmp", name: v("#ai-cn") || "API แบบ OpenAI", url: chatUrl(base), models: [v("#ai-cm") || "default"], custom: true }, c, base };
}

// ---------------------------------------------------------------- เหตุการณ์
fab.onclick = () => { if (fabMoved) { fabMoved = false; return; } toggle(); };
addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "j") { e.preventDefault(); toggle(); } });
win.addEventListener("keydown", (e) => {
  e.stopPropagation();                                                            // ไม่ให้คีย์ลัดของหน้า (W, L, Delete…) ทำงานตอนพิมพ์ในแชท
  if (e.key === "Enter" && !e.shiftKey && e.target.classList.contains("aita")) { e.preventDefault(); ask(e.target.value); }
  if (e.key === "Escape") toggle(false);
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") { e.preventDefault(); toggle(false); }
});
const byMsg = (id) => chat.find((x) => x.id === Number(id));
win.addEventListener("click", async (e) => {
  const t = e.target.closest("button"); if (!t) return;
  const h = t.dataset.h, q = t.dataset.q;
  if (h === "close") return toggle(false);
  if (h === "min") return setWin({ min: !ws.min, max: false });
  if (h === "max") return setWin({ max: !ws.max, min: false });
  if (h === "clear") { chat = []; snaps.clear(); saveChat(); return render(); }
  if (h === "send") return ask(win.querySelector(".aita").value);
  if (h === "mic") return mic();
  if (h === "autonext") { const plan = host().autoPlan(), i = plan.findIndex((s) => s.state !== "done"); return autoStart(i < 0 ? undefined : i); }
  if (h === "cfg") { setOpen = !setOpen; if (setOpen && ws.min) ws.min = false; return render(); }
  if (h === "cfg-close") { setOpen = false; draft = null; return render(); }
  if (h === "cfg-save") return saveSettings();
  if (h === "cfg-wipe") { cfg.keys = {}; saveCfg(cfg); setOpen = false; refreshStatus(); return add({ who: "ai", text: "ลบคีย์ทั้งหมดออกจากเบราว์เซอร์แล้ว" }); }
  if (h === "nfetch" || h === "ntest" || h === "cadd") {
    const out = win.querySelector("#ai-nout"), d = newDraft(), v = (id) => win.querySelector(id).value.trim();
    if (!d) { out.textContent = "✗ URL ใช้ไม่ได้ — ต้องขึ้นต้นด้วย https:// (หรือ http:// ในเครื่องนี้/วงแลนในบ้าน เช่น 192.168.x.x)"; out.className = "aitest bad"; return; }
    if (h === "nfetch") {
      out.textContent = "กำลังดึงรายชื่อ…"; out.className = "aitest";
      const ms = await listModels(d.base, v("#ai-ck"));
      win.querySelector("#ai-cml").innerHTML = ms.map((m) => `<option value="${esc(m)}">`).join("");
      if (ms.length && !v("#ai-cm")) win.querySelector("#ai-cm").value = ms[0];
      out.textContent = ms.length ? `✓ ได้ ${ms.length} โมเดล — เลือกจากช่องโมเดล` : "✗ ดึงรายชื่อไม่ได้ — พิมพ์ชื่อโมเดลเอง"; out.className = "aitest " + (ms.length ? "ok" : "bad"); return;
    }
    if (h === "ntest") {
      out.textContent = "กำลังทดสอบ…"; out.className = "aitest";
      const r = await testProvider(d.p, d.c);
      out.textContent = r.ok ? `✓ เชื่อมต่อได้ · ${d.p.models[0]} ตอบใน ${(r.ms / 1000).toFixed(1)} วินาที` : `✗ ${r.error || "ตอบว่าง"}`; out.className = "aitest " + (r.ok ? "ok" : "bad"); return;
    }
    if (!v("#ai-cm")) { out.textContent = "✗ ใส่ชื่อโมเดลก่อน (หรือกด ดึงรายชื่อ)"; out.className = "aitest bad"; return; }
    const c = readForm(), id = "c" + Date.now().toString(36);
    c.custom.push({ id, name: v("#ai-cn") || "API แบบ OpenAI", url: d.base, model: v("#ai-cm") });
    if (v("#ai-ck")) c.keys[id] = v("#ai-ck");
    c.provider = id; cfg = c; saveCfg(cfg); settings(); refreshStatus(); return;
  }
  if (h === "cdel") { const c = readForm(); c.custom = c.custom.filter((x) => x.id !== t.dataset.p); delete c.keys[t.dataset.p]; if (c.provider === t.dataset.p) c.provider = "none"; cfg = c; saveCfg(cfg); settings(); refreshStatus(); return; }
  if (h === "test") {
    const c = readForm(), p = byId(c, t.dataset.p), out = win.querySelector(`[data-tp="${CSS.escape(t.dataset.p)}"]`);
    if (!p || !out) return;
    if (p.key && !c.keys[p.id]) { out.textContent = "✗ ยังไม่ใส่คีย์"; out.className = "aitest bad"; return; }
    out.textContent = "กำลังทดสอบ…"; out.className = "aitest";
    const r = await testProvider(p, c);
    out.textContent = r.ok ? `✓ เชื่อมต่อได้ · ${c.models[p.id] || p.models[0]} ตอบใน ${(r.ms / 1000).toFixed(1)} วินาที` : `✗ ${r.error || "ตอบว่าง"}`; out.className = "aitest " + (r.ok ? "ok" : "bad"); return;
  }
  if (h === "miss") {
    let a = []; try { a = JSON.parse(localStorage.getItem(LS_MISS) || "[]"); } catch (er) { /* */ }
    const u = URL.createObjectURL(new Blob(["﻿" + a.join("\r\n")], { type: "text/plain" })), l = document.createElement("a");
    l.href = u; l.download = "piBot_คำถามที่ตอบไม่ได้.txt"; l.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); return;
  }
  if (q) return quick(q);
  if (t.dataset.card) {
    const m = byMsg(t.dataset.id); if (!m) return;
    if (t.dataset.card === "do" && m.state === "open") return doCard(m);
    if (t.dataset.card === "no" && m.state === "open") { m.state = "no"; saveChat(); return render(); }
    if (t.dataset.card === "view") return viewCard(m);
    if (t.dataset.card === "undo") return undoCard(m);
    return;
  }
  if (t.dataset.auto) { const m = byMsg(t.dataset.id); if (m) autoCmd(t.dataset.auto, m); return; }
  if (t.dataset.focus) { const m = byMsg(t.dataset.focus); if (m && !(host().focus && host().focus(m.focus))) add({ who: "ai", text: "วัตถุนั้นไม่อยู่ในแบบแล้ว" }); return; }
  if (t.dataset.point) { const m = byMsg(t.dataset.point), p = m && pressables().get(m.point); if (p) pointAt(p.el); return; }
  if (t.dataset.step) {
    const [id, i] = t.dataset.step.split(":").map(Number), m = byMsg(id), s = m && m.steps[i];
    if (s && s.act) { const v = validateLegacy([s.act]); if (v.length) add({ who: "card", title: "ยืนยันขั้นนี้", actions: v, state: "open" }); }
  }
});
win.addEventListener("change", (e) => {
  const t = e.target;
  if (t.name === "aiprov") { draft = readForm(draft); draft.provider = t.value; win.querySelectorAll(".aipopt").forEach((l) => l.classList.toggle("sel", l.querySelector("input").checked)); det(t.value); return; }
  if (t.id === "ai-ps") preset();
});
win.addEventListener("dblclick", (e) => { if (e.target.closest(".aih") && !e.target.closest("button")) setWin({ max: !ws.max, min: false }); });
let drag = null;                                                                    // ลากหัวหน้าต่าง
win.addEventListener("pointerdown", (e) => { if (!e.target.closest(".aih") || e.target.closest("button") || ws.max) return; drag = { dx: e.clientX - win.offsetLeft, dy: e.clientY - win.offsetTop }; win.setPointerCapture(e.pointerId); });
win.addEventListener("pointermove", (e) => { if (!drag) return; win.style.left = Math.min(Math.max(0, e.clientX - drag.dx), innerWidth - win.offsetWidth) + "px"; win.style.top = Math.min(Math.max(0, e.clientY - drag.dy), innerHeight - 40) + "px"; });
win.addEventListener("pointerup", () => { if (!drag) return; drag = null; try { localStorage.setItem(LS_POS, JSON.stringify({ x: win.offsetLeft, y: win.offsetTop })); } catch (e) { /* */ } });
// ลากปุ่มกลม piBot ไปวางที่อื่นได้ (กันบังตัวอักษรในหน้า) · ขยับเกิน 5px = ลาก ไม่นับเป็นคลิก · จำตำแหน่งไว้ · ไม่ให้หลุดขอบจอ
let fabDrag = null, fabMoved = false;
function placeFab(p) {
  if (!p) return;
  const x = Math.min(Math.max(0, p.x), innerWidth - fab.offsetWidth), y = Math.min(Math.max(0, p.y), innerHeight - fab.offsetHeight);
  fab.style.left = x + "px"; fab.style.top = y + "px"; fab.style.right = "auto"; fab.style.bottom = "auto";
}
try { placeFab(JSON.parse(localStorage.getItem(LS_FAB) || "null")); } catch (e) { /* */ }
fab.addEventListener("pointerdown", (e) => { if (e.button !== 0) return; fabDrag = { sx: e.clientX, sy: e.clientY, dx: e.clientX - fab.offsetLeft, dy: e.clientY - fab.offsetTop, on: false }; fab.setPointerCapture(e.pointerId); });
fab.addEventListener("pointermove", (e) => {
  if (!fabDrag) return;
  if (!fabDrag.on && Math.hypot(e.clientX - fabDrag.sx, e.clientY - fabDrag.sy) < 5) return;
  fabDrag.on = true; fab.classList.add("drag"); placeFab({ x: e.clientX - fabDrag.dx, y: e.clientY - fabDrag.dy });
});
fab.addEventListener("pointerup", () => {
  if (!fabDrag) return;
  if (fabDrag.on) { fabMoved = true; fab.classList.remove("drag"); try { localStorage.setItem(LS_FAB, JSON.stringify({ x: fab.offsetLeft, y: fab.offsetTop })); } catch (e) { /* */ } }
  fabDrag = null;
});
fab.addEventListener("pointercancel", () => { fabDrag = null; fab.classList.remove("drag"); });
addEventListener("resize", () => { if (fab.style.left) placeFab({ x: fab.offsetLeft, y: fab.offsetTop }); if (open) place(); });
requestAnimationFrame(animate);

export const piBot = { toggle, ask, quick: (q) => { if (!open) toggle(true); return quick(q); }, isOpen: () => open };
window.piBot = piBot;
