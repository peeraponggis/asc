// ที่เก็บในเบราว์เซอร์ (IndexedDB) สำหรับรุ่นออนไลน์ — เส้นของไฟล์ DXF และภาพลอกแบบที่ผู้ใช้เปิดจากเครื่อง (โดย ลุงพี)
// ไม่ส่งไฟล์ขึ้นเน็ต · อยู่ในเบราว์เซอร์เครื่องนั้นเท่านั้น (ล้างข้อมูลเบราว์เซอร์ = หาย → ต้องเปิดไฟล์ใหม่)
const DB = "asca-editor", STORE = "files";
let dbp = null;

function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}

async function tx(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(STORE, mode), q = fn(t.objectStore(STORE));
    t.oncomplete = () => res(q && q.result);
    t.onerror = t.onabort = () => rej(t.error);
  });
}

export const put = (key, value) => tx("readwrite", (s) => s.put(value, key));
export const get = (key) => tx("readonly", (s) => s.get(key)).catch(() => undefined);
export const del = (key) => tx("readwrite", (s) => s.delete(key)).catch(() => undefined);
