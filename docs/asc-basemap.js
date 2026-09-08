/* ============================================================================
 *  ASC · แผนที่ฐาน (Basemap)
 *
 *  ทำไมต้องมีไฟล์นี้
 *  ----------------------------------------------------------------------
 *  เดิมหน้าออกแบบดึงไทล์จากปลายทางภายในของ Google (โดเมน mt1 ที่ไม่ใช่ API
 *  สาธารณะ) และตั้งเป็นค่าเริ่มต้นด้วย ผู้ใช้ทุกคนจึงยิงไปที่นั่นทุกครั้งที่
 *  เปิดโปรแกรม
 *
 *  ปรับนโยบายเมื่อ 8 ก.ย. 2569 ตามที่ผู้ใช้สั่ง
 *  ----------------------------------------------------------------------
 *  เดิมไฟล์นี้ตั้งใจไม่เขียนโดเมนของปลายทางเดิมไว้เลย เพื่อให้ค้นสตริงใน docs/
 *  แล้วได้ศูนย์ ใช้เป็นตัวกันพลาด **ตัวกันนั้นถูกยกเลิกแล้ว** เพราะผู้ใช้ยืนยันว่า
 *  ปลายทางนั้นยังเรียกได้อยู่จริง และต้องการใช้ต่อจนกว่าจะถูกตัด
 *
 *  ความเสี่ยงยังเหมือนเดิมทุกอย่าง ปลายทาง mt0-mt3 ไม่ใช่ API สาธารณะ
 *  วันที่ Google ปิดหรือบล็อกการเรียกจากเว็บอื่น แผนที่จะดับทันที
 *  จึงไม่ปล่อยให้ดับเงียบ ๆ — ผู้เรียกต้องเฝ้าเหตุการณ์ tileerror แล้วสลับไป Esri
 *  ให้อัตโนมัติ พร้อมเปิดกล่องใส่คีย์ให้เห็น ตรงตามเงื่อนไขที่ผู้ใช้กำหนดไว้ว่า
 *  "เมื่อใดที่ตัดสิทธิ์ จึงค่อยแสดงภาพดาวเทียมละเอียดสูงขึ้นมา"
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
        /* ปลายทางภายในของ Google ไม่ใช่ API สาธารณะ และไม่มีสัญญาถึงความพร้อมใช้งาน
           วางไว้เป็นค่าเริ่มต้นตามที่ผู้ใช้สั่ง เพราะให้ภาพลึกกว่า Esri หนึ่งระดับซูม
           ซึ่งเป็นระดับที่ใช้วางแผงบนหลังคาจริง
           unofficial:true คือธงให้ผู้เรียกรู้ว่าต้องเฝ้าความล้มเหลวของไทล์ไว้ */
        {
            id: 'google-satellite-free',
            name: 'Google ดาวเทียม',
            url: 'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
            attribution: 'Imagery &copy; Google',
            maxNativeZoom: 20,
            keyLabel: '',
            unofficial: true,
            note: 'ภาพลึกถึงซูม 20 · ไม่ใช่ API สาธารณะ ถ้าถูกตัดจะสลับไป Esri ให้เอง'
        },
        {
            id: 'google-hybrid-free',
            name: 'Google ดาวเทียม + ชื่อถนน',
            url: 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
            attribution: 'Imagery &copy; Google',
            maxNativeZoom: 20,
            keyLabel: '',
            unofficial: true,
            note: 'มีชื่อถนนกำกับ ช่วยหาที่ตั้งได้เร็วกว่า'
        },
        {
            id: 'esri-imagery',
            name: 'Esri World Imagery (สำรอง)',
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            attribution: 'Tiles &copy; Esri',
            maxNativeZoom: 19,
            keyLabel: '',
            note: 'เรียกได้อย่างถูกต้อง ใช้เป็นตัวสำรองเมื่อ Google ถูกตัด'
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
        /* ผู้ให้บริการที่กระจายโหลดหลายโดเมนต้องส่ง subdomains ไปด้วย
           ไม่งั้น Leaflet จะแทน {s} ด้วย a/b/c ตามค่าปริยาย แล้วโดเมนไม่มีจริง */
        if (prov.subdomains) opts.subdomains = prov.subdomains;
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
        /* ค่าเริ่มต้นคือ Google ตามที่ผู้ใช้สั่ง ส่วน FALLBACK_ID คือชั้นที่ต้อง
           สลับไปให้อัตโนมัติเมื่อค่าเริ่มต้นเรียกไม่ได้ */
        DEFAULT_ID      : 'google-satellite-free',
        FALLBACK_ID     : 'esri-imagery'
    };

})(window);
