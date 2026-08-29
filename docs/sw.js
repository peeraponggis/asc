/* ==========================================================================
   Service Worker — ProInventive Mobi
   --------------------------------------------------------------------------
   mobi.html ไม่มีสคริปต์หรือ CSS ภายนอกเลยแม้แต่ไฟล์เดียว
   แคชแค่ตัวหน้าเว็บกับไอคอนก็ทำงานออฟไลน์ได้สมบูรณ์ ไม่ต้องพึ่งอินเทอร์เน็ต

   กลยุทธ์: stale-while-revalidate
     ส่งไฟล์จากแคชทันที (เปิดเร็วและใช้ได้แม้ไม่มีสัญญาณที่ไซต์งาน)
     พร้อมกันนั้นดึงตัวใหม่มาเก็บไว้เงียบ ๆ ผู้ใช้จะได้รุ่นใหม่ตอนเปิดครั้งถัดไป

   ⚠️ เมื่อแก้ไฟล์ใด ๆ ในรายการ ต้องเพิ่มเลข VERSION ด้วย
      ไม่งั้นเครื่องที่ติดตั้งไว้แล้วจะยังใช้ของเก่าต่อไป
   ========================================================================== */

const VERSION = 'mobi-v8';
/* แคชเฉพาะไฟล์ของแอปมือถือ
   หน้ารากตอนนี้เป็นหน้าล็อกอินของ ASC ซึ่งเป็นคนละโปรแกรมและไม่ต้องใช้ออฟไลน์ */
const SHELL = [
  './mobi.html',
  './manifest.json',
  './img/icon-192.png',
  './img/icon-512.png',
  './img/icon-maskable-192.png',
  './img/icon-maskable-512.png',
  './img/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      /* ใส่ทีละไฟล์แทน addAll เพื่อไม่ให้ไฟล์เดียวพลาดแล้วล้มทั้งชุด */
      .then(c => Promise.all(SHELL.map(u =>
        c.add(new Request(u, { cache: 'reload' })).catch(() => null)
      )))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ขอบเขตของ service worker ครอบทั้งโฟลเดอร์ ซึ่งมีโปรแกรม ASC อยู่ด้วย
   ถ้าดักทุกคำขอ หน้าของ ASC จะถูกแคชไปด้วยและผู้ใช้จะได้เวอร์ชันเก่าค้างอยู่
   จึงดักเฉพาะไฟล์ของแอปมือถือที่ระบุไว้เท่านั้น คำขออื่นปล่อยผ่านตามปกติ */
const SHELL_PATHS = SHELL.map(p => new URL(p, self.location.href).pathname);

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // ไม่ยุ่งกับปลายทางภายนอก
  if (SHELL_PATHS.indexOf(url.pathname) < 0) return; // ไม่ใช่ไฟล์ของแอปมือถือ ปล่อยผ่าน

  e.respondWith(
    caches.open(VERSION).then(cache =>
      cache.match(req, { ignoreSearch: true }).then(hit => {
        const net = fetch(req).then(res => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => null);

        /* มีในแคชก็ส่งทันที ไม่ต้องรอเน็ต — ถ้าไม่มีค่อยรอผลจากเครือข่าย */
        return hit || net;
      })
    )
  );
});

/* ให้หน้าเว็บสั่งข้ามคิวรออัปเดตได้ทันทีเมื่อผู้ใช้กดปุ่มโหลดรุ่นใหม่ */
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
  /* บอกเลขรุ่นกลับไป หน้าเว็บจะได้จำว่าผู้ใช้กด "ไว้ก่อน" กับรุ่นไหน
     แล้วไม่ต้องขึ้นแถบซ้ำทุกครั้งที่เปิดแอป */
  if (e.data === 'version' && e.ports && e.ports[0]) e.ports[0].postMessage(VERSION);
});
