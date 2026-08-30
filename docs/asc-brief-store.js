/* ============================================================================
 *  ASC · ที่เก็บรูปหน้างานของใบสั่งงานช่าง
 *
 *  ทำไมต้องเป็น IndexedDB ไม่ใช่ localStorage
 *  ----------------------------------------------------------------------
 *  master_shell กันงบรูปไว้ 2 MB จากโควตา localStorage ราว 5 MB และถ้าเกิน
 *  จะ "ทิ้งรูปทั้งหมด" ไม่ใช่แค่ตัดบางรูป (ดู dataForStorage ใน master_shell)
 *  บรีฟหนึ่งงานมีรูปเป็นสิบ ถ้าเดินทางไปกับก้อนโครงการ จะทำให้ทั้งโครงการ
 *  บันทึกไม่ได้ ไม่ใช่แค่รูปหาย
 *
 *  IndexedDB มีโควตาระดับหลายร้อยเมกะไบต์ เก็บ Blob/สตริงยาวได้สบาย
 *  และแยกขาดจากก้อนข้อมูลโครงการ รูปจึงพังไม่ถึงงานวิศวกรรม
 *
 *  ขอบเขต
 *  ----------------------------------------------------------------------
 *  โมดูลนี้เก็บในเครื่องอย่างเดียว การซิงก์ขึ้นคลาวด์ยังทำไม่ได้ เพราะ
 *  uploadImages/downloadImages ใน asc-cloud.js เป็นฟังก์ชันภายในโมดูล
 *  ไม่ได้เปิดไว้บน window.AscCloud และผูกกับจังหวะบันทึกโครงการ
 *  ต้องเปิด API ใหม่ก่อนถึงจะต่อได้
 * ==========================================================================*/

(function (global) {
    'use strict';

    const DB_NAME = 'asc_brief';
    const DB_VER  = 1;
    const STORE   = 'brief_photos';

    let _db = null;

    /* เปิดฐานข้อมูลครั้งเดียวแล้วใช้ซ้ำ การเปิดซ้ำทุกครั้งช้าและกินหน่วยความจำเปล่า */
    function open() {
        if (_db) return Promise.resolve(_db);
        return new Promise((res, rej) => {
            if (!global.indexedDB) { rej(new Error('เบราว์เซอร์นี้ไม่รองรับ IndexedDB')); return; }
            const rq = global.indexedDB.open(DB_NAME, DB_VER);
            rq.onupgradeneeded = () => {
                const db = rq.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    const st = db.createObjectStore(STORE, { keyPath: 'key' });
                    // ค้นรูปทั้งหมดของโครงการเดียวได้โดยไม่ต้องกวาดทั้งฐาน
                    st.createIndex('projectId', 'projectId', { unique: false });
                }
            };
            rq.onsuccess = () => { _db = rq.result; res(_db); };
            rq.onerror   = () => rej(rq.error || new Error('เปิดฐานข้อมูลรูปไม่สำเร็จ'));
        });
    }

    function tx(mode) {
        return open().then(db => db.transaction(STORE, mode).objectStore(STORE));
    }
    function wrap(rq) {
        return new Promise((res, rej) => {
            rq.onsuccess = () => res(rq.result);
            rq.onerror   = () => rej(rq.error);
        });
    }

    const keyOf = (projectId, photoId) => String(projectId || 'local') + '/' + String(photoId);

    /* รหัสรูป — ต้องไม่ซ้ำและเรียงตามเวลาที่เพิ่มได้ด้วยตัวมันเอง
       ใช้เวลาเป็นฐานเลข 36 ต่อด้วยตัวนับ กันชนกรณีเพิ่มหลายรูปในมิลลิวินาทีเดียว */
    let _seq = 0;
    function newId() {
        _seq = (_seq + 1) % 1000;
        return Date.now().toString(36) + '-' + String(_seq).padStart(3, '0');
    }

    /* ══════════════════════════════════════════════════════════════════
       ย่อภาพก่อนเก็บ

       ภาพจากมือถือสมัยนี้ด้านยาว 4000 พิกเซลขึ้นไป แต่บรีฟพิมพ์ลง A4
       แนวนอนซึ่งกว้างราว 3500 พิกเซลที่ 300 dpi และรูปกินพื้นที่แค่ครึ่งหน้า
       เก็บที่ 1600 พิกเซลจึงคมพอสำหรับทั้งบนจอและบนกระดาษ
       ยกวิธีมาจาก downscaleImage() ใน device_location.html
       ══════════════════════════════════════════════════════════════════ */
    function downscale(file, maxPx, quality) {
        return new Promise((res, rej) => {
            const fr = new FileReader();
            fr.onload = () => {
                const im = new Image();
                im.onload = () => {
                    const k = Math.min(1, (maxPx || 1600) / Math.max(im.naturalWidth, im.naturalHeight));
                    const w = Math.max(1, Math.round(im.naturalWidth  * k));
                    const h = Math.max(1, Math.round(im.naturalHeight * k));
                    const c = document.createElement('canvas');
                    c.width = w; c.height = h;
                    c.getContext('2d').drawImage(im, 0, 0, w, h);
                    res({ dataUrl: c.toDataURL('image/jpeg', quality || 0.82), w: w, h: h });
                };
                im.onerror = () => rej(new Error('ไฟล์ภาพไม่ถูกต้อง'));
                im.src = fr.result;
            };
            fr.onerror = () => rej(new Error('อ่านไฟล์ไม่สำเร็จ'));
            fr.readAsDataURL(file);
        });
    }

    const AscBriefStore = {

        /* เพิ่มรูปใหม่จากไฟล์ที่ผู้ใช้เลือก คืนระเบียนที่เก็บแล้ว */
        async addFile(projectId, slot, file, opts) {
            const o = opts || {};
            const img = await downscale(file, o.maxPx, o.quality);
            const rec = {
                key: '', projectId: String(projectId || 'local'), photoId: newId(),
                slot: String(slot || 'other'),
                dataUrl: img.dataUrl, w: img.w, h: img.h,
                annotations: [], caption: o.caption || '',
                addedAt: Date.now()
            };
            rec.key = keyOf(rec.projectId, rec.photoId);
            const st = await tx('readwrite');
            await wrap(st.put(rec));
            return rec;
        },

        /* บันทึกทับระเบียนเดิม ใช้ตอนแก้ป้ายกำกับหรือเปลี่ยนคำบรรยาย */
        async put(rec) {
            if (!rec || !rec.photoId) throw new Error('ระเบียนรูปไม่ถูกต้อง');
            rec.projectId = String(rec.projectId || 'local');
            rec.key = keyOf(rec.projectId, rec.photoId);
            const st = await tx('readwrite');
            await wrap(st.put(rec));
            return rec;
        },

        async get(projectId, photoId) {
            const st = await tx('readonly');
            return await wrap(st.get(keyOf(projectId, photoId))) || null;
        },

        /* รูปทั้งหมดของโครงการ เรียงตามช่องแล้วตามเวลาที่เพิ่ม
           ลำดับต้องคงที่ ไม่งั้นรูปในบรีฟจะสลับที่กันเองทุกครั้งที่เปิด */
        async list(projectId) {
            const st = await tx('readonly');
            const rows = await wrap(st.index('projectId').getAll(String(projectId || 'local')));
            return (rows || []).sort((a, b) =>
                a.slot === b.slot ? (a.addedAt - b.addedAt) : (a.slot < b.slot ? -1 : 1));
        },

        /* จัดกลุ่มตามช่องในสไลด์ ให้หน้าบรีฟหยิบไปวางได้ตรง ๆ */
        async bySlot(projectId) {
            const rows = await this.list(projectId);
            const map = {};
            rows.forEach(r => { (map[r.slot] = map[r.slot] || []).push(r); });
            return map;
        },

        async del(projectId, photoId) {
            const st = await tx('readwrite');
            await wrap(st.delete(keyOf(projectId, photoId)));
        },

        async clear(projectId) {
            const rows = await this.list(projectId);
            const st = await tx('readwrite');
            await Promise.all(rows.map(r => wrap(st.delete(r.key))));
            return rows.length;
        },

        /* ขนาดที่ใช้ไปจริง เอาไว้เตือนก่อนพื้นที่เต็ม
           ตัวเลขจากเบราว์เซอร์เป็นของทั้งโดเมน ไม่ได้แยกเฉพาะรูปบรีฟ */
        async usage() {
            if (!navigator.storage || !navigator.storage.estimate) return null;
            try {
                const e = await navigator.storage.estimate();
                return { usedMB: (e.usage || 0) / 1048576, quotaMB: (e.quota || 0) / 1048576 };
            } catch (err) { return null; }
        },

        downscale: downscale,
        newId: newId
    };

    global.AscBriefStore = AscBriefStore;
})(window);
