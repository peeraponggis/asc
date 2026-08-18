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

const VERSION = 'mobi-v2';
const SHELL = [
  './',
  './index.html',
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

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // ไม่ยุ่งกับปลายทางภายนอก

  e.respondWith(
    caches.open(VERSION).then(cache =>
      cache.match(req, { ignoreSearch: true }).then(hit => {
        const net = fetch(req).then(res => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => null);

        /* มีในแคชก็ส่งทันที ไม่ต้องรอเน็ต — ถ้าไม่มีค่อยรอ
           กรณีออฟไลน์และไม่มีในแคช ให้ตกไปที่หน้าแอปเป็นทางสุดท้าย */
        return hit || net.then(r => r || cache.match('./mobi.html'));
      })
    )
  );
});

/* ให้หน้าเว็บสั่งข้ามคิวรออัปเดตได้ทันทีเมื่อผู้ใช้กดปุ่มโหลดรุ่นใหม่ */
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
