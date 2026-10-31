// ผู้ช่วย AI "piBot" ของ ASC Architect — กล่องแชทลอยทุกหน้า (โดย ลุงพี)
// หลักการเดียวกับ ASC Studio: ค่าเริ่มต้นไม่ใช้ AI (ค้นคลังความรู้ในเครื่อง ไม่ส่งอะไรออก) · เลือกผู้ให้บริการได้หลายเจ้า ล้มเหลวลองเจ้าถัดไป ·
// คีย์อยู่ในเบราว์เซอร์ · AI ไม่คิดตัวเลขเอง (ตัวเลขมาจาก facts ของหน้า) · จะกดปุ่ม/เปลี่ยนค่า ต้องให้คนกดยืนยันการ์ดก่อน ·
// รู้ว่าอยู่หน้าไหน · "ต่อไปทำอะไร" ตอบจากสถานะจริงของหน้า (host.next)
// หน้าเว็บบอกสถานะผ่าน window.ascaAI = { page(), pageName(), facts(), next(), sets } (ดู editor/main.js · cad/app.js · app.js)
import { loadKB } from "./kb.js?v=0.16.0";
import { PROVIDERS, loadCfg, saveCfg, chain, askChain, parseReply } from "./providers.js?v=0.16.0";

const BASE = new URL("./", import.meta.url);
const CLOUD = window.PA_MODE === "cloud";
const LS_CHAT = "asca.ai.chat", LS_POS = "asca.ai.pos", LS_MISS = "asca.ai.unanswered";
const NEXT_RE = /ต่อไป|ขั้นตอนไหน|ขั้นต่อไป|ขาดอะไร|ทำอะไรต่อ|เหลืออะไร|ต้องทำอะไร|เริ่มตรงไหน|next/i;
const HELP_RE = /^(หน้านี้|ใช้ยังไง|ใช้งานยังไง|ช่วยด้วย|help)/i;
const FACT_RE = /สรุป|กี่|เท่าไร|เท่าไหร่|kwp|พื้นที่|ความยาว|จำนวน/i;
const NO_PRESS = new Set(["new", "NEW", "del3d", "cad-close", "plot-close", "plot-go", "ai-draft"]);   // ปุ่มที่ AI ไม่กดแทน (ลบ/ล้าง/ปิด/งานหนัก)
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const host = () => window.ascaAI || {};
const page = () => (host().page ? host().page() : "home");
const pageName = () => (host().pageName ? host().pageName() : document.title);
const facts = () => { try { return host().facts ? host().facts() : {}; } catch (e) { return {}; } };

// ---------------------------------------------------------------- ปุ่มที่ผู้ช่วยกดแทนได้ (หลังผู้ใช้ยืนยัน) — อ่านจากหน้าเว็บจริง
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

/** ตรวจคำสั่งจาก AI/กฎ → คำสั่งที่ทำได้จริง (ทิ้งของที่ไม่อยู่ในรายการ) */
function validate(actions) {
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
function run(a) {
  if (a.tool === "press") {
    const p = pressables().get(a.key); if (!p) return false;
    p.el.click(); return true;
  }
  const el = document.getElementById(a.id); if (!el) return false;
  if (el.type === "checkbox") el.checked = a.value; else el.value = a.value;
  el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

// ---------------------------------------------------------------- piBot: 4 ท่า (ตาเปิด · ตาปิด · นิ้วซ้ายกด · นิ้วขวากด)
function bot(size) { return `<span class="pibot" style="width:${size}px;height:${size}px;background-image:url(${new URL("pibot.webp?v=0.16.0", BASE)})" aria-hidden="true"></span>`; }
let mood = "idle", frame = 0, burst = 0, nextBlink = Date.now() + 2500;
function animate() {
  const now = Date.now();
  let f = 0;
  if (now >= nextBlink) { f = 1; if (now >= nextBlink + 140) nextBlink = now + 2500 + Math.random() * 3000; }
  else if (mood === "thinking") f = 2 + (Math.floor(now / 110) % 2);                        // คิดอยู่ = พิมพ์รัว
  else { if (burst <= 0 && Math.random() < 0.012) burst = 6 + Math.floor(Math.random() * 6); // ว่าง = พิมพ์เป็นช่วง ๆ
    if (burst > 0) { f = 2 + (Math.floor(now / 170) % 2); if (Math.floor(now / 170) !== frame) burst--; } }
  frame = Math.floor(now / 170);
  for (const el of document.querySelectorAll(".pibot")) el.style.backgroundPositionX = `${(f * 100) / 3}%`;
  requestAnimationFrame(animate);
}

// ---------------------------------------------------------------- กล่องแชท
let chat = [], open = false, cfg = loadCfg(), kbP = null, busy = false, seq = 0;
try { chat = JSON.parse(localStorage.getItem(LS_CHAT) || "[]").slice(-40); } catch (e) { /* */ }
const saveChat = () => { try { localStorage.setItem(LS_CHAT, JSON.stringify(chat.slice(-40).map((m) => (m.who === "card" ? { ...m, state: m.state === "open" ? "closed" : m.state } : m)))); } catch (e) { /* */ } };
seq = chat.reduce((m, x) => Math.max(m, x.id || 0), 0);

const fab = document.createElement("button");
fab.className = "aifab"; fab.type = "button"; fab.title = "ผู้ช่วย AI piBot (Ctrl+J)"; fab.innerHTML = bot(60);
const win = document.createElement("section");
win.className = "aiw"; win.hidden = true; win.setAttribute("aria-label", "ผู้ช่วย AI");
document.body.append(fab, win);

function provName() { const p = PROVIDERS.find((x) => x.id === cfg.provider) || PROVIDERS[0]; return cfg.provider === "none" ? "ไม่ใช้ AI · ค้นคู่มือในเครื่อง" : p.name.split(" (")[0]; }
function msgHtml(m) {
  if (m.who === "card") {
    const list = m.actions.map((a) => `<li>${esc(a.tool === "press" ? "กดปุ่ม " + a.label : "ตั้งค่า " + a.label)}</li>`).join("");
    const foot = m.state === "open" ? `<button class="aibtn pri" data-card="do" data-id="${m.id}">✓ ทำเลย</button><button class="aibtn" data-card="no" data-id="${m.id}">ไม่ทำ</button>`
      : `<span class="aist">${m.state === "done" ? "✓ ทำแล้ว (ย้อนได้ด้วย Ctrl+Z)" : m.state === "no" ? "ไม่ทำ" : "หมดอายุ"}</span>`;
    return `<div class="aicard"><div class="aich">${esc(m.title || "ผู้ช่วยเสนอ — กดยืนยันก่อน")}</div><ul>${list}</ul><div class="aicf">${foot}</div></div>`;
  }
  if (m.who === "steps") {
    return `<div class="aimsg ai"><b>➡️ ต่อไปทำอะไร (${esc(m.where)})</b><ol class="aisteps">${m.steps.map((s) => `<li class="${s.done ? "done" : ""}">${s.done ? "✓ " : ""}${esc(s.say)}${!s.done && s.act ? ` <button class="aibtn small" data-step="${m.id}:${m.steps.indexOf(s)}">${esc(s.act.label || "ทำ")}</button>` : ""}</li>`).join("")}</ol></div>`;
  }
  const src = m.src && m.src.length ? `<div class="aisrc">ที่มา: ${m.src.map((s) => esc(s)).join(" · ")}</div>` : "";
  return `<div class="aimsg ${m.who}">${esc(m.text).replace(/\n/g, "<br>")}${src}</div>`;
}
function render() {
  if (!open) return;
  win.innerHTML = `<div class="aih">${bot(32)}<div class="aiht"><b>piBot ผู้ช่วย ASCA</b><span class="aichip">${esc(provName())}</span></div>
    <button class="aihb" data-h="cfg" title="ตั้งค่าผู้ให้บริการ AI">⚙</button><button class="aihb" data-h="clear" title="ล้างแชท">🗑</button><button class="aihb" data-h="close" title="ปิด (Ctrl+J)">✕</button></div>
    <div class="aictx">อยู่ที่ <b>${esc(pageName())}</b></div>
    <div class="aibody">${chat.length ? chat.map(msgHtml).join("") : `<div class="aimsg ai">สวัสดีครับ ผม piBot 🤖 ถามวิธีใช้ ASC Architect ได้เลย เช่น "วาดผนังให้ได้ระยะจริงยังไง" หรือกด ➡️ ต่อไปทำอะไร</div>`}${busy ? `<div class="aimsg ai thinking">กำลังคิด…</div>` : ""}</div>
    <div class="aiq"><button class="aiqc" data-q="next">➡️ ต่อไปทำอะไร</button><button class="aiqc" data-q="help">❓ หน้านี้ใช้ยังไง</button>${host().facts ? '<button class="aiqc" data-q="facts">📊 สรุป</button>' : ""}</div>
    <div class="aiin"><textarea rows="1" class="aita" placeholder="พิมพ์คำถาม แล้ว Enter"></textarea><button class="aibtn pri" data-h="send">ส่ง</button></div>`;
  const b = win.querySelector(".aibody"); b.scrollTop = b.scrollHeight;
  if (!busy) win.querySelector(".aita").focus();
}
function add(m) { m.id = ++seq; chat.push(m); saveChat(); render(); return m; }
function toggle(v) {
  open = v ?? !open; win.hidden = !open; fab.classList.toggle("on", open);
  if (open) { place(); render(); kbP = kbP || loadKB(BASE).catch((e) => { add({ who: "ai", text: "โหลดคลังความรู้ไม่ได้: " + e.message }); return null; }); }
}
function place() {
  let p = null; try { p = JSON.parse(localStorage.getItem(LS_POS) || "null"); } catch (e) { /* */ }
  const w = Math.min(380, innerWidth - 16), h = Math.min(560, innerHeight - 90);
  win.style.width = w + "px"; win.style.height = h + "px";
  const x = p ? Math.min(Math.max(0, p.x), innerWidth - w) : innerWidth - w - 16, y = p ? Math.min(Math.max(0, p.y), innerHeight - h) : innerHeight - h - 84;
  win.style.left = x + "px"; win.style.top = y + "px";
}

// ---------------------------------------------------------------- ตอบ
function nextSteps() {
  const steps = host().next ? host().next() : [];
  if (!steps.length) return null;
  for (const s of steps) if (s.act) { const v = validate([s.act]); s.act = v[0] ? { ...s.act, label: s.act.label || v[0].label } : null; }
  return add({ who: "steps", where: pageName(), steps });
}
function factsText() {
  const f = facts(), keys = Object.keys(f);
  return keys.length ? keys.map((k) => `${k}: ${f[k]}`).join("\n") : "";
}
async function search(q) {
  const kb = await kbP; if (!kb) return [];
  return kb.search(q, { page: page(), k: 4 });
}
function offlineAnswer(q, hits) {
  const top = hits[0];
  if (!top || top.score < 0.22) {
    logMiss(q);
    return add({ who: "ai", text: "ไม่พบในคู่มือครับ — ลองถามด้วยคำอื่น หรือกด ➡️ ต่อไปทำอะไร (คำถามนี้บันทึกไว้เพิ่มในคลังความรู้รุ่นต่อไป)" });
  }
  const c = top.chunk, more = hits.slice(1, 3).filter((h) => h.score > 0.3).map((h) => h.chunk.title);
  add({ who: "ai", text: `${c.title}\n${c.text.slice(0, 700)}` + (more.length ? `\n\nเกี่ยวข้อง: ${more.join(" · ")}` : ""), src: [c.src === "ui" ? `ปุ่มในหน้า ${c.where || c.page}` : c.file || c.id] });
  if (c.src === "ui" && c.key) { const v = validate([{ tool: "press", key: c.key }]); if (v.length) add({ who: "card", title: "ให้กดปุ่มนี้ให้ไหม", actions: v, state: "open" }); }
}
function logMiss(q) { try { const a = JSON.parse(localStorage.getItem(LS_MISS) || "[]"); a.push(`${new Date().toISOString().slice(0, 16)} [${page()}] ${q}`); localStorage.setItem(LS_MISS, JSON.stringify(a.slice(-200))); } catch (e) { /* */ } }

/** ปุ่มที่เกี่ยวกับคำถาม (ปุ่มที่คลังความรู้ชี้ + ป้ายมีคำในคำถาม) ไม่เกิน 20 ปุ่ม — prompt สั้น โมเดลเล็กบน CPU ตอบทัน */
function relevantPress(q, hits) {
  const all = [...pressables().values()], keys = new Set(hits.map((h) => h.chunk.key).filter(Boolean));
  const qn = q.toLowerCase(), score = (p) => (keys.has(p.key) ? 3 : 0) + p.label.toLowerCase().split(/[\s()·:,]+/).filter((w) => w.length > 1 && qn.includes(w)).length;
  return all.map((p) => [score(p), p]).sort((a, b) => b[0] - a[0]).slice(0, 20).map(([, p]) => p);
}

function prompt(q, hits) {
  const P = relevantPress(q, hits).map((p) => `${p.key} = ${p.label}`).join("\n");
  const S = Object.entries(setsList()).map(([id, s]) => {                       // ช่องเลือก: ส่งคู่ รหัส=ป้าย (hip=ปั้นหยา) โมเดลจะได้ไม่เดารหัสผิด
    const el = document.getElementById(id);
    const hint = el && el.tagName === "SELECT" ? [...el.options].map((o) => `${o.value}=${o.textContent.trim()}`).join(", ") : el && el.type === "checkbox" ? "true/false" : s.hint || "";
    return `${id} = ${s.label}${hint ? " (" + hint + ")" : ""}`;
  }).join("\n");
  const know = hits.slice(0, 3).map((h, i) => `[${i + 1}] ${h.chunk.title}\n${h.chunk.text.slice(0, 500)}`).join("\n\n");
  const sys = `คุณคือ piBot ผู้ช่วยของโปรแกรม ASC Architect (ASCA) ตอบภาษาไทยสั้น กระชับ เป็นกันเอง
กฎ: ตอบจาก "ความรู้" ที่ให้เท่านั้น ถ้าไม่มีให้ตอบว่า "ไม่พบในคู่มือ" · ห้ามคิดหรือเดาตัวเลขเอง ตัวเลขใช้ได้เฉพาะจาก "สถานะหน้า" · ห้ามแต่งปุ่มหรือเมนูที่ไม่มีในรายการ
ถ้าควรกดปุ่มหรือตั้งค่าให้ผู้ใช้ ให้เสนอใน actions (ผู้ใช้ต้องกดยืนยันเอง): {"tool":"press","key":"<รหัสปุ่ม>"} หรือ {"tool":"set","id":"<รหัสช่อง>","value":<ค่า>}
คุณทำเองไม่ได้ — ห้ามบอกว่า "ทำแล้ว/เรียบร้อย" ให้บอกว่าเสนอไว้ ให้ผู้ใช้กดยืนยันในการ์ด
ตอบเป็น JSON เท่านั้น: {"answer":"...","actions":[]}`;
  const user = `หน้าปัจจุบัน: ${pageName()}\nสถานะหน้า:\n${factsText() || "-"}\n\nปุ่มที่กดได้:\n${P || "-"}\n\nช่องที่ตั้งค่าได้:\n${S || "-"}\n\nความรู้:\n${know || "-"}\n\nคำถาม: ${q}`;
  return [{ role: "system", content: sys }, { role: "user", content: user }];
}

async function ask(q) {
  q = q.trim(); if (!q || busy) return;
  add({ who: "me", text: q });
  if (NEXT_RE.test(q)) { if (nextSteps()) return; }
  if (FACT_RE.test(q) && cfg.provider === "none" && factsText()) add({ who: "ai", text: `ตัวเลขจากแบบปัจจุบัน (โปรแกรมคำนวณ):\n${factsText()}`, src: ["สถานะหน้า"] });
  const query = HELP_RE.test(q) ? `${pageName()} ใช้ทำอะไร ${q}` : q;
  busy = true; mood = "thinking"; render();
  try {
    const hits = await search(query);
    if (!chain(cfg, CLOUD).length) { if (!(FACT_RE.test(q) && factsText())) offlineAnswer(q, hits); return; }
    try {
      const r = await askChain(cfg, CLOUD, prompt(q, hits), (p) => { win.querySelector(".thinking") && (win.querySelector(".thinking").textContent = `กำลังถาม ${p.name.split(" (")[0]}…`); });
      const { answer, actions } = parseReply(r.text);
      if (/ไม่พบในคู่มือ/.test(answer)) logMiss(q);
      add({ who: "ai", text: answer, src: [r.provider.name.split(" (")[0], ...hits.slice(0, 3).map((h) => h.chunk.title)] });
      const v = validate(actions);
      if (v.length) add({ who: "card", actions: v, state: "open" });
    } catch (e) {
      add({ who: "ai", text: `AI ใช้ไม่ได้ตอนนี้ (${e.message}) — ตอบจากคู่มือในเครื่องแทน` });
      offlineAnswer(q, hits);
    }
  } finally { busy = false; mood = "idle"; render(); }
}

// ---------------------------------------------------------------- ตั้งค่า
function settings() {
  const opts = PROVIDERS.filter((p) => !(p.localOnly && CLOUD)).map((p) => `<option value="${p.id}"${p.id === cfg.provider ? " selected" : ""}>${esc(p.name)}</option>`).join("");
  const rows = PROVIDERS.filter((p) => p.models && !(p.localOnly && CLOUD)).map((p) => `<fieldset><legend>${esc(p.name)}</legend>
    ${p.key ? `<label>คีย์ <input type="password" data-key="${p.id}" value="${esc(cfg.keys[p.id] || "")}" autocomplete="off" placeholder="วางคีย์ที่นี่"></label> ${p.signup ? `<a href="${p.signup}" target="_blank" rel="noopener">สมัคร/สร้างคีย์</a>` : ""}` : ""}
    <label>โมเดล <input data-model="${p.id}" list="aim-${p.id}" value="${esc(cfg.models[p.id] || p.models[0])}"><datalist id="aim-${p.id}">${p.models.map((m) => `<option value="${esc(m)}">`).join("")}</datalist></label></fieldset>`).join("");
  let miss = []; try { miss = JSON.parse(localStorage.getItem(LS_MISS) || "[]"); } catch (e) { /* */ }
  const body = win.querySelector(".aibody");
  body.innerHTML = `<div class="aicfg"><label>ผู้ให้บริการ AI <select id="ai-prov">${opts}</select></label>
    <p class="small">ไม่ใช้ AI = ค้นคลังความรู้ในเครื่อง ไม่ส่งอะไรออก · เจ้าออนไลน์จะได้รับคำถาม + ความรู้ที่เกี่ยวข้อง + สถานะหน้า (ตัวเลข ไม่มีชื่อไฟล์) ·
    ถ้าเจ้าที่เลือกใช้ไม่ได้ จะลองเจ้าอื่นต่อเอง · <b>คีย์เก็บในเบราว์เซอร์นี้เท่านั้น</b> ไม่เข้า git ไม่ขึ้นคลาวด์</p>${rows}
    <p><button class="aibtn pri" data-h="cfg-save">บันทึก</button> <button class="aibtn" data-h="cfg-wipe">ลบคีย์ทั้งหมด</button> <button class="aibtn" data-h="miss" ${miss.length ? "" : "disabled"}>ส่งออกคำถามที่ตอบไม่ได้ (${miss.length})</button></p></div>`;
  if (!CLOUD) fetch("/api/ai/ollama/models").then((r) => r.json()).then((j) => {   // โมเดลที่มีใน Ollama ของเครื่องนี้
    const dl = win.querySelector("#aim-ollama"); if (!dl) return;
    dl.innerHTML = (j.models || []).map((m) => `<option value="${esc(m)}">`).join("");
    if (!j.ok) dl.closest("fieldset").insertAdjacentHTML("beforeend", `<p class="small">${esc(j.error || "ไม่พบ Ollama")}</p>`);
  }).catch(() => {});
}
function saveSettings() {
  cfg.provider = win.querySelector("#ai-prov").value;
  for (const el of win.querySelectorAll("[data-key]")) { const v = el.value.trim(); if (v) cfg.keys[el.dataset.key] = v; else delete cfg.keys[el.dataset.key]; }
  for (const el of win.querySelectorAll("[data-model]")) cfg.models[el.dataset.model] = el.value.trim();
  saveCfg(cfg); add({ who: "ai", text: `ใช้: ${provName()}` + (cfg.provider !== "none" && !chain(cfg, CLOUD).length ? " — ยังไม่มีคีย์ของเจ้านี้ จะตอบจากคู่มือในเครื่อง" : "") });
}

// ---------------------------------------------------------------- เหตุการณ์
fab.onclick = () => toggle();
addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") { e.preventDefault(); toggle(); } });
win.addEventListener("keydown", (e) => {
  e.stopPropagation();                                                            // ไม่ให้คีย์ลัดของหน้า (W, L, Delete…) ทำงานตอนพิมพ์ในแชท
  if (e.key === "Enter" && !e.shiftKey && e.target.classList.contains("aita")) { e.preventDefault(); ask(e.target.value); }
  if (e.key === "Escape") toggle(false);
});
win.addEventListener("click", (e) => {
  const t = e.target.closest("button"); if (!t) return;
  const h = t.dataset.h, q = t.dataset.q;
  if (h === "close") return toggle(false);
  if (h === "clear") { chat = []; saveChat(); return render(); }
  if (h === "send") return ask(win.querySelector(".aita").value);
  if (h === "cfg") return settings();
  if (h === "cfg-save") return saveSettings();
  if (h === "cfg-wipe") { cfg.keys = {}; saveCfg(cfg); return add({ who: "ai", text: "ลบคีย์ทั้งหมดออกจากเบราว์เซอร์แล้ว" }); }
  if (h === "miss") {
    let a = []; try { a = JSON.parse(localStorage.getItem(LS_MISS) || "[]"); } catch (er) { /* */ }
    const u = URL.createObjectURL(new Blob(["﻿" + a.join("\r\n")], { type: "text/plain" })), l = document.createElement("a");
    l.href = u; l.download = "piBot_คำถามที่ตอบไม่ได้.txt"; l.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); return;
  }
  if (q === "next") return ask("ต่อไปทำอะไร");
  if (q === "help") return ask("หน้านี้ใช้ยังไง");
  if (q === "facts") return add({ who: "ai", text: factsText() ? `ตัวเลขจากแบบปัจจุบัน (โปรแกรมคำนวณ):\n${factsText()}` : "หน้านี้ไม่มีตัวเลขสรุป", src: ["สถานะหน้า"] });
  if (t.dataset.card) {
    const m = chat.find((x) => x.id === Number(t.dataset.id)); if (!m || m.state !== "open") return;
    if (t.dataset.card === "do") { const n = m.actions.filter(run).length; m.state = "done"; if (n < m.actions.length) add({ who: "ai", text: "บางคำสั่งทำไม่ได้ (ปุ่มไม่อยู่ในหน้านี้แล้ว)" }); }
    else m.state = "no";
    saveChat(); return render();
  }
  if (t.dataset.step) {
    const [id, i] = t.dataset.step.split(":").map(Number), m = chat.find((x) => x.id === id), s = m && m.steps[i];
    if (s && s.act) { const v = validate([s.act]); if (v.length) add({ who: "card", title: "ยืนยันขั้นนี้", actions: v, state: "open" }); }
  }
});
let drag = null;                                                                    // ลากหัวหน้าต่าง
win.addEventListener("pointerdown", (e) => { if (!e.target.closest(".aih") || e.target.closest("button")) return; drag = { dx: e.clientX - win.offsetLeft, dy: e.clientY - win.offsetTop }; win.setPointerCapture(e.pointerId); });
win.addEventListener("pointermove", (e) => { if (!drag) return; win.style.left = Math.min(Math.max(0, e.clientX - drag.dx), innerWidth - win.offsetWidth) + "px"; win.style.top = Math.min(Math.max(0, e.clientY - drag.dy), innerHeight - 40) + "px"; });
win.addEventListener("pointerup", () => { if (!drag) return; drag = null; try { localStorage.setItem(LS_POS, JSON.stringify({ x: win.offsetLeft, y: win.offsetTop })); } catch (e) { /* */ } });
requestAnimationFrame(animate);

export const piBot = { toggle, ask, isOpen: () => open };
window.piBot = piBot;
