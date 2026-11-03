// ผู้ให้บริการ AI ของผู้ช่วย piBot — เลือกได้หลายเจ้า · ล้มเหลวลองเจ้าถัดไปเอง (โดย ลุงพี)
// คีย์อยู่ใน localStorage ของเบราว์เซอร์ผู้ใช้เท่านั้น (ไม่เข้า git · ไม่ขึ้นคลาวด์) · Ollama ผ่าน server ในเครื่อง (/api/ai/ollama)
// เพิ่ม "เจ้าที่ใช้ API แบบ OpenAI" เองได้ (LM Studio · vLLM · เซิร์ฟเวอร์บริษัท ฯลฯ: base URL + โมเดล + คีย์) — เก็บใน localStorage เช่นกัน
export const PROVIDERS = [
  { id: "none", name: "ไม่ใช้ AI — ค้นคู่มือในเครื่อง (ค่าเริ่มต้น)", local: true },
  { id: "pollinations", name: "Pollinations (ฟรี ไม่ต้องมีคีย์)", url: "https://text.pollinations.ai/openai", models: ["openai-fast", "openai"] },
  { id: "groq", name: "Groq (ใส่คีย์ · เร็วมาก)", url: "https://api.groq.com/openai/v1/chat/completions", key: true, models: ["llama-3.3-70b-versatile", "qwen/qwen3-32b"], signup: "https://console.groq.com/keys" },
  { id: "gemini", name: "Google Gemini (ใส่คีย์ · ภาษาไทยดี)", url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", key: true, models: ["gemini-2.5-flash", "gemini-2.5-flash-lite"], signup: "https://aistudio.google.com/apikey" },
  { id: "openrouter", name: "OpenRouter (ใส่คีย์ · มีโมเดลฟรี :free)", url: "https://openrouter.ai/api/v1/chat/completions", key: true, models: ["google/gemma-4-26b-a4b-it:free", "qwen/qwen3.8-27b:free"], signup: "https://openrouter.ai/keys" },
  { id: "openai", name: "OpenAI (ใส่คีย์ · เสียเงินตามการใช้)", url: "https://api.openai.com/v1/chat/completions", key: true, models: ["gpt-4o-mini", "gpt-4.1-mini"], signup: "https://platform.openai.com/api-keys" },
  { id: "ollama", name: "Ollama ในเครื่อง (เฉพาะเปิดโปรแกรมในเครื่อง)", localOnly: true, models: ["scb10x/typhoon2.5-qwen3-4b"] },
];
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
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal: ac.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
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
      const url = p.id === "pollinations" ? "https://text.pollinations.ai/models" : p.url.replace(/\/chat\/completions$/, "/models");
      const key = cfg.keys && cfg.keys[p.id];
      const r = await fetch(url, { headers: key ? { Authorization: "Bearer " + key } : {}, signal: ac.signal });
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
