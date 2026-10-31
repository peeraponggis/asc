// ค้นคลังความรู้ผู้ช่วย AI (RAG) ในเบราว์เซอร์ — ไม่ส่งอะไรออกนอกเครื่อง (โดย ลุงพี)
// คะแนน = cosine เวกเตอร์ TF-IDF n-gram ตัวอักษร (ฐานข้อมูลเวกเตอร์จาก scripts/build_kb.py) + BM25 ของคำ (ตัดคำไทยด้วย Intl.Segmenter)
// + เพิ่มน้ำหนักชิ้นของหน้าที่เปิดอยู่ · normalize/ngrams ต้องตรงกับ build_kb.py ทุกตัวอักษร
export function normalize(s) {
  return String(s).normalize("NFC").toLowerCase().replace(/[^\p{L}\p{M}\p{N}_฀-๿]+/gu, " ").replace(/\s+/g, " ").trim();
}

export function ngrams(s) {
  const out = [];
  for (const tok of normalize(s).split(" ")) {
    if (!tok) continue;
    const t = Array.from(" " + tok + " ");
    for (const n of [2, 3]) for (let i = 0; i + n <= t.length; i++) out.push(t.slice(i, i + n).join(""));
  }
  return out;
}

const SEG = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter("th", { granularity: "word" }) : null;
const STOP = new Set(["ที่", "และ", "หรือ", "ของ", "ใน", "ได้", "ให้", "เป็น", "มี", "จะ", "ไป", "มา", "การ", "ความ", "ว่า", "ก็", "แล้ว", "ไหม", "อย่างไร", "ยังไง", "ครับ", "ค่ะ", "คะ", "นะ", "หน่อย", "the", "a", "to", "of"]);
export function words(s) {
  const n = normalize(s);
  const raw = SEG ? Array.from(SEG.segment(n), (x) => (x.isWordLike ? x.segment : "")) : n.split(" ");
  return raw.map((w) => w.trim()).filter((w) => w && !STOP.has(w));
}

/** คลังความรู้ (kb.json) → ตัวค้น */
export function makeIndex(kb) {
  const docs = kb.chunks.map((c) => words(`${c.title} ${c.tags} ${c.text}`));
  const df = new Map();
  for (const d of docs) for (const w of new Set(d)) df.set(w, (df.get(w) || 0) + 1);
  const N = docs.length, avg = docs.reduce((s, d) => s + d.length, 0) / Math.max(N, 1);
  const tf = docs.map((d) => { const m = new Map(); for (const w of d) m.set(w, (m.get(w) || 0) + 1); return m; });

  function vec(q) {
    const c = new Map();
    for (const g of ngrams(q)) if (kb.idf[g] !== undefined) c.set(g, (c.get(g) || 0) + 1);
    let norm = 0;
    for (const [g, n] of c) { const w = (1 + Math.log(n)) * kb.idf[g]; c.set(g, w); norm += w * w; }
    norm = Math.sqrt(norm) || 1;
    for (const [g, w] of c) c.set(g, w / norm);
    return c;
  }
  function bm25(qw, i) {
    let s = 0; const k1 = 1.2, b = 0.75, len = docs[i].length;
    for (const w of qw) {
      const f = tf[i].get(w); if (!f) continue;
      const idf = Math.log(1 + (N - df.get(w) + 0.5) / (df.get(w) + 0.5));
      s += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + (b * len) / avg));
    }
    return s;
  }

  /** ค้น → [{chunk, score, cos, bm}] เรียงมาก→น้อย · page = หน้าที่เปิดอยู่ (เพิ่มน้ำหนัก) */
  function search(q, { page = "", k = 5, src = null } = {}) {
    const qv = vec(q), qw = [...new Set(words(q))];
    const rows = kb.chunks.map((c, i) => {
      if (src && c.src !== src) return null;
      let cos = 0; for (const [g, w] of qv) if (c.v[g]) cos += w * c.v[g];
      return { chunk: c, cos, bm: bm25(qw, i) };
    }).filter(Boolean);
    const maxBm = Math.max(...rows.map((r) => r.bm), 1e-9);
    for (const r of rows) {
      const pages = r.chunk.page.split(" "), here = page && pages.includes(page);           // page ของโน้ตเป็นได้หลายหน้า (คั่นด้วยเว้นวรรค)
      // โน้ตความรู้ (อธิบายวิธีทำ) มาก่อนป้ายปุ่มสั้น ๆ ที่คำซ้ำกัน · ป้ายที่ไม่มีคำอธิบาย (ช่องกรอก) น้ำหนักน้อยสุด
      const kind = r.chunk.src === "knowledge" ? 0.1 : r.chunk.text.includes(" — ") ? 0.02 : 0;
      r.score = 0.6 * r.cos + 0.4 * (r.bm / maxBm) + (here ? 0.08 : pages.includes("all") ? 0.03 : 0) + kind;
    }
    return rows.filter((r) => r.cos > 0.05 || r.bm > 0).sort((a, b) => b.score - a.score).slice(0, k);
  }
  return { search, size: N, version: kb.version };
}

let _kb = null;
/** โหลด kb.json ครั้งเดียว (base = ที่อยู่โฟลเดอร์ web/ai/) */
export async function loadKB(base) {
  if (!_kb) _kb = fetch(new URL("kb.json", base)).then((r) => { if (!r.ok) throw new Error("โหลดคลังความรู้ไม่ได้"); return r.json(); }).then(makeIndex);
  return _kb;
}
