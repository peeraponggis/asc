/* ============================================================================
 *  ASC · แผนที่ฐาน (Basemap)
 *
 *  ทำไมต้องมีไฟล์นี้
 *  ----------------------------------------------------------------------
 *  เดิมหน้าออกแบบดึงไทล์จากปลายทางภายในของ Google (โดเมน mt1 ที่ไม่ใช่ API
 *  สาธารณะ) และตั้งเป็นค่าเริ่มต้นด้วย ผู้ใช้ทุกคนจึงยิงไปที่นั่นทุกครั้งที่
 *  เปิดโปรแกรม
 *
 *  หมายเหตุ ตั้งใจไม่เขียนโดเมนกับพารามิเตอร์ของ URL เดิมไว้ที่ไหนเลยในโปรเจกต์
 *  เพื่อให้การค้นหาสตริงเหล่านั้นใน docs/ ใช้เป็นตัวกันพลาดได้จริง
 *  ถ้าเจอแม้บรรทัดเดียว แปลว่ามีใครเผลอเอาปลายทางเดิมกลับมาใช้
 *
 *  ความเสี่ยงที่แท้จริงไม่ใช่แค่เรื่องเงื่อนไขการใช้งาน แต่คือวันที่ Google ปิด
 *  ปลายทางนั้นหรือบล็อกการเรียกจากเว็บอื่น แผนที่จะดับทั้งระบบทันทีโดยไม่มี
 *  สัญญาณเตือนล่วงหน้า และงานวาดหลังคาทำต่อไม่ได้เลย
 *
 *  ไฟล์นี้จึงย้ายไปใช้ผู้ให้บริการที่เรียกได้อย่างถูกต้อง
 *    · Esri World Imagery  ใช้ได้ทันทีโดยไม่ต้องมีคีย์  ← ค่าเริ่มต้น
 *    · Google / Mapbox / MapTiler  ใช้คีย์ของผู้ใช้เอง ได้ความละเอียดลึกกว่า
 *
 *  สิ่งที่ต้องยอมแลก
 *  ----------------------------------------------------------------------
 *  Esri มีภาพจริงถึงระดับซูม 19 ส่วนของเดิมได้ถึง 20 คือ "ลึกน้อยลงหนึ่งระดับ"
 *  ซึ่งเป็นระดับที่ใช้วางแผงบนหลังคาจริง ผู้ใช้จะเห็นความต่างนี้
 *  ชดเชยได้สองทาง — ซูมดิจิทัลถึง 23 ยังทำงานเหมือนเดิม
 *  และเครื่องมือตรึงภาพโดรนด้วย GCP ให้ความละเอียดสูงกว่าไทล์ทุกเจ้าอยู่แล้ว
 *  ใครต้องการภาพจริงลึกกว่านี้ ใส่คีย์ของตัวเองได้
 *
 *  เรื่องคีย์
 *  ----------------------------------------------------------------------
 *  คีย์เก็บใน localStorage ของเครื่องนั้นเครื่องเดียว
 *  ไม่ลงไฟล์โครงการ ไม่ลงคลาวด์ ไม่ติดไปกับ PDF และลบได้จากในหน้าเดียวกัน
 *
 *  ตารางผู้ให้บริการยกมาจาก solar-engine/src/geo/web-mercator.ts
 *  ส่วนการจัดการ session ของ Google ยกมาจาก asc-enterprises/src/basemap/keys.ts
 *  แปลงเป็น JavaScript ธรรมดาเพื่อให้ ASC ยังเป็นไฟล์ static ล้วน ไม่ต้องมี build step
 * ==========================================================================*/

(function (global) {
    'use strict';

    const KEY_STORE  = 'asc_basemap_keys';
    const GSESSION   = 'asc_google_tiles_session';

    /* ── ผู้ให้บริการที่รองรับ ─────────────────────────────────────────────
       maxNativeZoom คือระดับที่ยังเป็นภาพถ่ายจริง เกินจากนั้นเป็นการขยายภาพ
       ตัวเลขพวกนี้มีผลกับความคมตอนวางแผง จึงระบุไว้ให้ผู้ใช้เห็นในชื่อชั้น */
    const PROVIDERS = [
        {
            id: 'esri-imagery',
            name: 'Esri World Imagery (ไม่ต้องใช้คีย์)',
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            attribution: 'Tiles &copy; Esri',
            maxNativeZoom: 19,
            keyLabel: '',
            note: 'ใช้ได้ทันที ไม่ต้องสมัครอะไร'
        },
        {
            id: 'google-satellite',
            name: 'Google ดาวเทียม (ใช้คีย์ของคุณ)',
            /* Map Tiles API ต้องมี session ก่อน จึงประกอบ url ตอนใช้งานจริง */
            url: 'https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session={session}&key={key}',
            attribution: 'Map data &copy;Google',
            maxNativeZoom: 21,
            keyLabel: 'Google Maps API key',
            session: 'google',
            note: 'ต้องเปิด Map Tiles API ใน Google Cloud และมีบัญชีเรียกเก็บเงินของคุณเอง'
        },
        {
            id: 'mapbox-satellite',
            name: 'Mapbox Satellite (ใช้โทเคนของคุณ)',
            url: 'https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg90?access_token={key}',
            attribution: '&copy; Mapbox &copy; Maxar',
            maxNativeZoom: 20,
            keyLabel: 'Mapbox access token',
            note: 'มีโควตาให้ใช้ฟรีต่อเดือนระดับหนึ่ง'
        },
        {
            id: 'maptiler-satellite',
            name: 'MapTiler Satellite (ใช้คีย์ของคุณ)',
            url: 'https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key={key}',
            attribution: '&copy; MapTiler &copy; Esri',
            maxNativeZoom: 20,
            keyLabel: 'MapTiler key',
            note: 'มีโควตาให้ใช้ฟรีต่อเดือนระดับหนึ่ง'
        }
    ];

    /* ── คีย์ของผู้ใช้ ─────────────────────────────────────────────────────
       อ่าน/เขียนแบบกันพังทุกจุด เพราะบางเบราว์เซอร์ปิด localStorage ไว้
       และโหมดส่วนตัวบางตัวโยน error ตั้งแต่ตอนอ่าน */
    function allKeys() {
        try { return JSON.parse(localStorage.getItem(KEY_STORE) || '{}') || {}; }
        catch (e) { return {}; }
    }
    function getKey(id) { return allKeys()[id] || ''; }
    function setKey(id, key) {
        try {
            const all = allKeys();
            if (key) all[id] = key; else delete all[id];
            localStorage.setItem(KEY_STORE, JSON.stringify(all));
        } catch (e) { /* เก็บไม่ได้ก็ยังใช้งานในรอบนี้ได้ */ }
        /* เปลี่ยนคีย์แล้ว session เดิมใช้ไม่ได้ ต้องทิ้ง */
        if (id === 'google-satellite') { try { localStorage.removeItem(GSESSION); } catch (e) {} }
    }

    /* ── session ของ Google Map Tiles API ─────────────────────────────────
       ต้อง POST createSession ก่อนถึงจะขอไทล์ได้ session อยู่ได้ราวสองสัปดาห์
       จึงแคชไว้แล้วต่ออายุก่อนหมดหนึ่งวัน ไม่ใช่เรียกใหม่ทุกครั้งที่ขยับแผนที่
       ซึ่งจะเปลืองโควตาของผู้ใช้เปล่า ๆ */
    async function googleSession(key) {
        try {
            const c = JSON.parse(localStorage.getItem(GSESSION) || 'null');
            if (c && c.key === key && (c.expiry - 86400) > Date.now() / 1000) return c;
        } catch (e) { /* แคชเสีย ขอใหม่ */ }

        const res = await fetch('https://tile.googleapis.com/v1/createSession?key=' + encodeURIComponent(key), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mapType: 'satellite', language: 'th-TH', region: 'TH' })
        });
        if (!res.ok) {
            let msg = 'HTTP ' + res.status;
            try { const j = await res.json(); msg = (j.error && j.error.message) || msg; } catch (e) {}
            throw new Error('ขอ session จาก Google ไม่สำเร็จ : ' + msg);
        }
        const j = await res.json();
        const s = { session: j.session, expiry: Number(j.expiry), key: key };
        try { localStorage.setItem(GSESSION, JSON.stringify(s)); } catch (e) {}
        return s;
    }

    /* เครดิตที่ต้องแสดงตามมุมมองปัจจุบัน — เป็นข้อบังคับของนโยบาย Map Tiles API
       ไม่ใช่ของแถม ถ้าไม่แสดงก็ผิดเงื่อนไขอีกแบบหนึ่ง */
    async function googleAttribution(sess, z, b) {
        try {
            const u = 'https://tile.googleapis.com/tile/v1/viewport' +
                '?session=' + encodeURIComponent(sess.session) +
                '&key=' + encodeURIComponent(sess.key) +
                '&zoom=' + z + '&north=' + b.north + '&south=' + b.south +
                '&east=' + b.east + '&west=' + b.west;
            const res = await fetch(u);
            if (!res.ok) return 'Map data &copy;Google';
            const j = await res.json();
            return j.copyright ? (j.copyright + ' &middot; Google') : 'Map data &copy;Google';
        } catch (e) { return 'Map data &copy;Google'; }
    }

    /* ── สร้างชั้นแผนที่ของ Leaflet ───────────────────────────────────────
       คืน null ถ้าผู้ให้บริการนั้นต้องใช้คีย์แต่ยังไม่มี ผู้เรียกจะได้ข้ามไป
       ไม่ใช่ได้ชั้นที่โหลดไม่ขึ้นแล้วผู้ใช้เห็นแผนที่ว่างโดยไม่รู้สาเหตุ */
    async function makeLayer(prov) {
        const opts = {
            maxNativeZoom: prov.maxNativeZoom,
            maxZoom: 23,
            zoomSnap: 0.25,
            zoomDelta: 0.25,
            crossOrigin: true,
            attribution: prov.attribution
        };
        if (!prov.keyLabel) return L.tileLayer(prov.url, opts);

        const key = getKey(prov.id);
        if (!key) return null;

        let url = prov.url.replace('{key}', encodeURIComponent(key));
        if (prov.session === 'google') {
            const s = await googleSession(key);        // โยน error ขึ้นไปให้ผู้เรียกจัดการ
            url = url.replace('{session}', encodeURIComponent(s.session));
            const layer = L.tileLayer(url, opts);
            layer._ascGoogleSession = s;
            return layer;
        }
        return L.tileLayer(url, opts);
    }

    global.AscBasemap = {
        PROVIDERS       : PROVIDERS,
        providers       : () => PROVIDERS.slice(),
        get             : id => PROVIDERS.filter(p => p.id === id)[0] || null,
        getKey          : getKey,
        setKey          : setKey,
        hasKey          : id => !!getKey(id),
        makeLayer       : makeLayer,
        googleAttribution: googleAttribution,
        DEFAULT_ID      : 'esri-imagery'
    };

})(window);
