// ผู้ให้บริการ AI ของผู้ช่วย piBot — เลือกได้หลายเจ้า · ล้มเหลวลองเจ้าถัดไปเอง (โดย ลุงพี)
// คีย์อยู่ใน localStorage ของเบราว์เซอร์ผู้ใช้เท่านั้น (ไม่เข้า git · ไม่ขึ้นคลาวด์) · Ollama ผ่าน server ในเครื่อง (/api/ai/ollama)
export const PROVIDERS = [
  { id: "none", name: "ไม่ใช้ AI — ค้นคู่มือในเครื่อง (ค่าเริ่มต้น)", local: true },
  { id: "pollinations", name: "Pollinations (ฟรี ไม่ต้องมีคีย์)", url: "https://text.pollinations.ai/openai", models: ["openai-fast", "openai"] },
  { id: "groq", name: "Groq (ใส่คีย์ · เร็วมาก)", url: "https://api.groq.com/openai/v1/chat/completions", key: true, models: ["llama-3.3-70b-versatile", "qwen/qwen3-32b"], signup: "https://console.groq.com/keys" },
  { id: "gemini", name: "Google Gemini (ใส่คีย์ · ภาษาไทยดี)", url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", key: true, models: ["gemini-2.5-flash", "gemini-2.5-flash-lite"], signup: "https://aistudio.google.com/apikey" },
  { id: "openrouter", name: "OpenRouter (ใส่คีย์ · มีโมเดลฟรี :free)", url: "https://openrouter.ai/api/v1/chat/completions", key: true, models: ["google/gemma-4-26b-a4b-it:free", "qwen/qwen3.8-27b:free"], signup: "https://openrouter.ai/keys" },
  { id: "ollama", name: "Ollama ในเครื่อง (เฉพาะเปิดโปรแกรมในเครื่อง)", localOnly: true, models: ["scb10x/typhoon2.5-qwen3-4b"] },
];
const CFG = "asca.ai.cfg";

export function loadCfg() {
  let c = {}; try { c = JSON.parse(localStorage.getItem(CFG) || "{}"); } catch (e) { /* */ }
  return { provider: "none", keys: {}, models: {}, ...c };
}
export function saveCfg(c) { try { localStorage.setItem(CFG, JSON.stringify(c)); } catch (e) { /* */ } }

/** ลำดับที่จะลอง: เจ้าที่เลือก → เจ้าอื่นที่ใช้ได้ (Pollinations · เจ้าที่มีคีย์ · Ollama ในเครื่อง) — "none" = ไม่ใช้ AI */
export function chain(cfg, cloud) {
  if (cfg.provider === "none") return [];
  const ok = (p) => p.id !== "none" && (!p.key || cfg.keys[p.id]) && !(p.localOnly && cloud);
  const first = PROVIDERS.find((p) => p.id === cfg.provider);
  return [first, ...PROVIDERS.filter((p) => p !== first)].filter((p) => p && ok(p));
}

async function post(url, body, headers, ms) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal: ac.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) { throw new Error(e.name === "AbortError" ? "หมดเวลารอ" : e.message); } finally { clearTimeout(t); }
}

/** ส่งข้อความถึงเจ้าเดียว → ข้อความตอบ */
export async function ask(p, cfg, messages) {
  const model = cfg.models[p.id] || p.models[0];
  if (p.id === "ollama") {
    const j = await post("/api/ai/ollama", { model, messages }, {}, 300000);
    return j.message ? j.message.content : j.error ? Promise.reject(new Error(j.error)) : "";
  }
  const j = await post(p.url, { model, messages, temperature: 0.2 }, p.key ? { Authorization: "Bearer " + cfg.keys[p.id] } : {}, 60000);
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

/** ข้อความตอบ → { answer, actions } (AI บางเจ้าห่อ JSON ด้วยข้อความ/```) */
export function parseReply(text) {
  const s = String(text).replace(/<think>[\s\S]*?<\/think>/g, "");
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a >= 0 && b > a) { try { const j = JSON.parse(s.slice(a, b + 1)); if (j && typeof j.answer === "string") return { answer: j.answer, actions: Array.isArray(j.actions) ? j.actions : [] }; } catch (e) { /* ไม่ใช่ JSON */ } }
  return { answer: s.replace(/```[a-z]*|```/g, "").trim(), actions: [] };
}
