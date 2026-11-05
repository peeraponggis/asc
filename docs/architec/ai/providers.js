// ผู้ให้บริการ AI ของผู้ช่วย piBot — เลือกได้หลายเจ้า · ล้มเหลวลองเจ้าถัดไปเอง (โดย ลุงพี)
// คีย์อยู่ใน localStorage ของเบราว์เซอร์ผู้ใช้เท่านั้น (ไม่เข้า git · ไม่ขึ้นคลาวด์) · Ollama ผ่าน server ในเครื่อง (/api/ai/ollama)
// เพิ่ม "เจ้าที่ใช้ API แบบ OpenAI" เองได้ (LM Studio · vLLM · เซิร์ฟเวอร์บริษัท ฯลฯ: base URL + โมเดล + คีย์) — เก็บใน localStorage เช่นกัน
// 0.31.0 (ลุงพีอนุมัติหน้าตัวอย่าง 5 พ.ย. 2569 · หน้าตาเดียวกับ ASC Studio): Claude (Anthropic Messages API) · รายชื่อเจ้าที่รู้จักให้เลือก (กรอก URL ให้)
//   รุ่นในเครื่อง: เจ้าที่ไม่ให้หน้าเว็บเรียกตรง (CORS) → ส่งผ่าน server ในเครื่อง /api/ai/proxy อัตโนมัติ
export const PROVIDERS = [
  { id: "none", name: "ไม่ใช้ AI — ค้นคู่มือในเครื่อง (ค่าเริ่มต้น)", local: true },
  { id: "pollinations", name: "Pollinations (ฟรี ไม่ต้องมีคีย์)", url: "https://text.pollinations.ai/openai", models: ["openai-fast", "openai"] },
  { id: "groq", name: "Groq (ใส่คีย์ · เร็วมาก)", url: "https://api.groq.com/openai/v1/chat/completions", key: true, models: ["llama-3.3-70b-versatile", "qwen/qwen3-32b"], signup: "https://console.groq.com/keys" },
  { id: "gemini", name: "Google Gemini (ใส่คีย์ · ภาษาไทยดี)", url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", key: true, models: ["gemini-2.5-flash", "gemini-2.5-flash-lite"], signup: "https://aistudio.google.com/apikey" },
  { id: "openrouter", name: "OpenRouter (ใส่คีย์ · มีโมเดลฟรี :free)", url: "https://openrouter.ai/api/v1/chat/completions", key: true, models: ["google/gemma-4-26b-a4b-it:free", "qwen/qwen3.8-27b:free"], signup: "https://openrouter.ai/keys" },
  { id: "openai", name: "OpenAI (ใส่คีย์ · เสียเงินตามการใช้)", url: "https://api.openai.com/v1/chat/completions", key: true, models: ["gpt-4o-mini", "gpt-4.1-mini"], signup: "https://platform.openai.com/api-keys" },
  { id: "claude", name: "Claude (Anthropic) (ใส่คีย์ · เสียเงินตามการใช้)", url: "https://api.anthropic.com/v1/messages", key: true, anthropic: true, isNew: true,
    models: ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"], modelNotes: { "claude-haiku-5-5": "เร็ว ถูก (แนะนำ)", "claude-sonnet-5-5": "ฉลาดขึ้น", "claude-opus-5-5": "ฉลาดสุด แพงสุด" },
    signup: "https://console.anthropic.com/settings/keys" },
  { id: "ollama", name: "Ollama ในเครื่อง (เฉพาะเปิดโปรแกรมในเครื่อง)", localOnly: true, models: ["scb10x/typhoon2.5-qwen3-4b"] },
];
/** ➕ เพิ่ม AI อื่น: เจ้าที่รู้จัก (แบบ OpenAI) — เลือกแล้วกรอก URL/โมเดลให้ (แก้ได้) · ชุดเดียวกับ ASC Studio src/ai/providers.ts AI_PRESETS */
export const PRESETS = [
  { key: "typhoon", label: "Typhoon (SCB10X · ภาษาไทยเก่ง)", name: "Typhoon", url: "https://api.opentyphoon.ai/v1", model: "typhoon-v2.1-12b-instruct", signup: "https://playground.opentyphoon.ai/api-key" },
  { key: "deepseek", label: "DeepSeek", name: "DeepSeek", url: "https://api.deepseek.com/v1", model: "deepseek-chat", signup: "https://platform.deepseek.com/api_keys" },
  { key: "mistral", label: "Mistral", name: "Mistral", url: "https://api.mistral.ai/v1", model: "mistral-small-latest", signup: "https://console.mistral.ai/api-keys" },
  { key: "xai", label: "xAI Grok", name: "xAI Grok", url: "https://api.x.ai/v1", model: "grok-3-mini", signup: "https://console.x.ai" },
  { key: "together", label: "Together AI", name: "Together AI", url: "https://api.together.xyz/v1", model: "meta-llama/Llama-3.3-70B-Instruct-Turbo", signup: "https://api.together.ai/settings/api-keys" },
  { key: "lan", label: "Ollama / LM Studio เครื่องนี้หรือเครื่องอื่นในบ้าน", name: "Ollama", url: "http://localhost:11434/v1", model: "" },
  { key: "other", label: "อื่น ๆ (กรอกเอง)", name: "", url: "", model: "" },
];
/** ชื่อโมเดลอ่านง่าย: claude-haiku-5-5 → Claude Haiku 5.5 */
export function prettyModel(m) { const c = /^claude-([a-z]+)-(\d+)-(\d+)$/.exec(String(m || "")); return c ? `Claude ${c[1][0].toUpperCase()}${c[1].slice(1)} ${c[2]}.${c[3]}` : m; }
/** base URL ที่ใช้ได้: https:// ทุกเจ้า · http:// เฉพาะเครื่องนี้/วงแลนในบ้าน (คีย์ไม่วิ่งผ่านอินเทอร์เน็ตแบบไม่เข้ารหัส) · ไม่ได้ = null */
export function okBase(raw) {
  const u = String(raw || "").trim().replace(/\/+$/, "").replace(/\/(chat\/completions|models)$/i, "");
  if (!/^https?:\/\/[^\s/]+/i.test(u)) return null;
  if (/^http:\/\//i.test(u) && !/^http:\/\/(localhost|127\.0\.0\.1|\[::1\]|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2}|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])(\.\d{1,3}){2}|[a-z0-9-]+\.local)(:\d+)?(\/|$)/i.test(u)) return null;
  return u;
}
/** รุ่นในเครื่อง: ส่งผ่าน server เมื่อเรียกตรงไม่ได้ (assistant.js ตั้งเมื่อไม่ใช่รุ่นออนไลน์) */
let proxyUrl = null;
export function setProxy(u) { proxyUrl = u; }
async function xfetch(url, init) {
  try { return await fetch(url, init); }
  catch (e) {
    if (!proxyUrl || e.name === "AbortError") throw e;
    const r = await fetch(proxyUrl, { method: "POST", signal: init.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, method: init.method || "GET", headers: init.headers || {}, body: init.body || null }) });
    if (!r.ok) throw e;
    const j = await r.json();
    return new Response(j.body, { status: j.status, headers: { "Content-Type": "application/json" } });
  }
}
const claudeHeaders = (key) => ({ "x-api-key": key || "", "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" });
/** ข้อความแบบ OpenAI → Anthropic: system แยก · บทเดียวกันติดกันรวม · ต้องเริ่มด้วย user */
function toClaude(messages) {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n"), msgs = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    const role = m.role === "assistant" ? "assistant" : "user", last = msgs[msgs.length - 1];
    if (last && last.role === role) last.content += "\n\n" + m.content; else msgs.push({ role, content: String(m.content) });
  }
  if (!msgs.length || msgs[0].role !== "user") msgs.unshift({ role: "user", content: "…" });
  return { system, messages: msgs };
}
const CFG = "asca.ai.cfg";

export function loadCfg() {
  let c = {}; try { c = JSON.parse(localStorage.getItem(CFG) || "{}"); } catch (e) { /* */ }
  return { provider: "none", keys: {}, models: {}, custom: [], ...c };
}
export function saveCfg(c) { try { localStorage.setItem(CFG, JSON.stringify(c)); } catch (e) { /* */ } }

/** URL ของ API แบบ OpenAI: ใส่แค่ base (…/v1) ก็ได้ → เติม /chat/completions ให้ */
export function chatUrl(base) {
  const b = String(base || "").trim().replace(/\/+$/, "");
  return /\/chat\/completions$/.test(b) ? b : b + "/chat/completions";
}
/** ผู้ให้บริการทั้งหมด = ชุดมาตรฐาน + เจ้าที่เพิ่มเอง (cfg.custom: [{id, name, url, model}] · คีย์ไม่บังคับ อยู่ใน cfg.keys[id]) */
export function providers(cfg) {
  const custom = (cfg && Array.isArray(cfg.custom) ? cfg.custom : []).filter((c) => c && c.id && c.url).map((c) => ({
    id: c.id, name: `${c.name || "API แบบ OpenAI"} (เพิ่มเอง)`, url: chatUrl(c.url), models: [c.model || "default"], custom: true,
  }));
  return [...PROVIDERS, ...custom];
}
export const byId = (cfg, id) => providers(cfg).find((p) => p.id === id);

/** ลำดับที่จะลอง: เจ้าที่เลือก → เจ้าอื่นที่ใช้ได้ (Pollinations · เจ้าที่มีคีย์ · เจ้าที่เพิ่มเอง · Ollama ในเครื่อง) — "none" = ไม่ใช้ AI */
export function chain(cfg, cloud) {
  if (cfg.provider === "none") return [];
  const all = providers(cfg);
  const ok = (p) => p.id !== "none" && (!p.key || cfg.keys[p.id]) && !(p.localOnly && cloud);
  const first = all.find((p) => p.id === cfg.provider);
  return [first, ...all.filter((p) => p !== first)].filter((p) => p && ok(p));
}

async function post(url, body, headers, ms) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await xfetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal: ac.signal });
    if (!r.ok) { let m = `HTTP ${r.status}`; try { const j = await r.json(); m = (j.error && (j.error.message || j.error)) || m; } catch (e) { /* */ } throw new Error(String(m).slice(0, 200)); }
    return await r.json();
  } catch (e) { throw new Error(e.name === "AbortError" ? "หมดเวลารอ" : e.message); } finally { clearTimeout(t); }
}

/** ส่งข้อความถึงเจ้าเดียว → ข้อความตอบ (ms = เวลารอสูงสุด) */
export async function ask(p, cfg, messages, ms) {
  const model = (cfg.models && cfg.models[p.id]) || p.models[0];
  if (p.id === "ollama") {
    const j = await post("/api/ai/ollama", { model, messages }, {}, ms || 300000);
    return j.message ? j.message.content : j.error ? Promise.reject(new Error(j.error)) : "";
  }
  const key = cfg.keys && cfg.keys[p.id];
  if (p.anthropic) {
    const c = toClaude(messages);
    const j = await post(p.url, { model, max_tokens: 4096, temperature: 0.2, ...(c.system ? { system: c.system } : {}), messages: c.messages }, claudeHeaders(key), ms || 60000);
    return (j.content || []).filter((x) => x.type === "text").map((x) => x.text || "").join("");
  }
  const j = await post(p.url, { model, messages, temperature: 0.2 }, key ? { Authorization: "Bearer " + key } : {}, ms || 60000);
  return (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "";
}

/** ลองตามลำดับ → { text, provider } · ทุกเจ้าล้มเหลว → throw พร้อมสาเหตุของแต่ละเจ้า */
export async function askChain(cfg, cloud, messages, onTry) {
  const errs = [];
  for (const p of chain(cfg, cloud)) {
    onTry && onTry(p);
    try { const text = await ask(p, cfg, messages); if (text && text.trim()) return { text, provider: p }; errs.push(`${p.id}: ตอบว่าง`); } catch (e) { errs.push(`${p.id}: ${e.message}`); }
  }
  throw new Error(errs.join(" · ") || "ไม่ได้เลือกผู้ให้บริการ AI");
}

/** ข้อความตอบ → { answer, actions, sources } (AI บางเจ้าห่อ JSON ด้วยข้อความ/``` · บางเจ้าใช้ say แทน answer) */
export function parseReply(text) {
  const s = String(text).replace(/<think>[\s\S]*?<\/think>/g, "");
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a >= 0 && b > a) {
    try {
      const j = JSON.parse(s.slice(a, b + 1)), ans = j && (typeof j.answer === "string" ? j.answer : typeof j.say === "string" ? j.say : null);
      if (ans !== null) return { answer: ans, actions: Array.isArray(j.actions) ? j.actions : [], sources: Array.isArray(j.sources) ? j.sources.map(String) : [] };
    } catch (e) { /* ไม่ใช่ JSON */ }
  }
  return { answer: s.replace(/```[a-z]*|```/g, "").trim(), actions: [], sources: [] };
}

/** ติดต่อเจ้านี้ได้ไหม — ไม่ส่งคำถาม (ส่งแค่คีย์ไปที่เจ้าของคีย์) · จำผล 60 วินาที · "ไม่ใช้ AI" = ได้เสมอ */
const reachMemo = new Map();
export async function reachable(p, cfg, cloud) {
  if (!p || p.id === "none") return true;
  if (p.localOnly && cloud) return false;
  const k = p.id + "|" + (p.url || ""), m = reachMemo.get(k);
  if (m && Date.now() - m.at < 60000) return m.ok;
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), 5000);
  let ok = false;
  try {
    if (p.id === "ollama") ok = !!(await (await fetch("/api/ai/ollama/models", { signal: ac.signal })).json()).ok;
    else {
      const url = p.id === "pollinations" ? "https://text.pollinations.ai/models" : p.url.replace(/\/(chat\/completions|messages)$/, "/models");
      const key = cfg.keys && cfg.keys[p.id];
      const r = await xfetch(url, { headers: p.anthropic ? claudeHeaders(key) : key ? { Authorization: "Bearer " + key } : {}, signal: ac.signal });
      ok = r.status < 500;                                                            // 401/404 ก็ถือว่าติดต่อได้ (คีย์/โมเดลตรวจด้วยปุ่ม ทดสอบ)
    }
  } catch (e) { ok = false; } finally { clearTimeout(t); }
  reachMemo.set(k, { at: Date.now(), ok });
  return ok;
}
/** ปุ่ม ทดสอบ: ถามสั้น ๆ หนึ่งครั้ง → { ok, ms, text | error } */
export async function testProvider(p, cfg) {
  const t0 = Date.now();
  try {
    const text = await ask(p, cfg, [{ role: "user", content: "ตอบคำว่า OK คำเดียว" }], 30000);
    return { ok: !!(text && text.trim()), ms: Date.now() - t0, text: String(text || "").trim().slice(0, 60) };
  } catch (e) { return { ok: false, ms: Date.now() - t0, error: e.message }; }
}

/** ปุ่ม "ดึงรายชื่อ": รายชื่อโมเดลจาก {base}/models · ไม่ได้ = [] */
export async function listModels(base, key) {
  try {
    const r = await xfetch(base.replace(/\/+$/, "") + "/models", { headers: key ? { Authorization: "Bearer " + key } : {} });
    if (!r.ok) return [];
    return ((await r.json()).data || []).map((m) => String(m.id || "").replace(/^models\//, "")).filter(Boolean).sort();
  } catch (e) { return []; }
}
