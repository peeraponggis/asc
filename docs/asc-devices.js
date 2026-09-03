/* ============================================================================
 *  ASC · คลังสเปกอุปกรณ์ (Device Specifications Database)
 *
 *  ปัญหาเดิม
 *  ----------------------------------------------------------------------
 *  ทุกโครงการ วิศวกรต้องเปิดหาไฟล์ดาต้าชีต .txt ในเครื่องมาอัปโหลดใหม่
 *  ทีละชิ้น ทั้ง PV / INV1 / INV2 / BAT / OPT / EV รวมหกครั้งต่องาน
 *  ไฟล์ชุดเดียวกันแท้ ๆ แต่ต้องหาซ้ำทุกครั้ง และถ้าใครถือไฟล์คนละรุ่น
 *  ตัวเลขที่ออกไปหาลูกค้าก็จะไม่ตรงกันโดยไม่มีใครรู้
 *
 *  วิธีแก้
 *  ----------------------------------------------------------------------
 *  ต้นฉบับอยู่ที่ตาราง devices บน Supabase ผู้ดูแลระบบเพิ่มได้จากหน้า Settings
 *  หน้าออกแบบเลือกเป็น ยี่ห้อ > รุ่น แทนการเปิดหาไฟล์
 *
 *  ทำไมยังต้องแคชลง IndexedDB อีกชั้น
 *  ----------------------------------------------------------------------
 *  ASC ออกแบบมาให้เปิดจากไฟล์ตรง ๆ และทำงานหน้างานที่เน็ตไม่ดีได้
 *  ถ้าคลังอยู่บนคลาวด์อย่างเดียว ช่างที่อยู่บนหลังคาจะเลือกอุปกรณ์ไม่ได้เลย
 *  ซึ่งแย่กว่าเดิมที่อย่างน้อยยังมีไฟล์อยู่ในเครื่อง
 *
 *  จึงซิงก์ทั้งคลังลง IndexedDB ครั้งแรกที่ออนไลน์ แล้วเช็คแค่ "ตราประทับ"
 *  (จำนวนรายการ + เวลาที่แก้ล่าสุด) ว่าต่างจากที่แคชไว้ไหม ถ้าไม่ต่างก็ไม่ต้อง
 *  ดึงอะไรเลย เปิดครั้งถัดไปจึงใช้ได้ทันทีแม้ออฟไลน์
 *
 *  โมดูลนี้ไม่แตะ state ของหน้าออกแบบ และไม่แยกไฟล์ดาต้าชีตเอง
 *  หน้าที่แยกไฟล์เป็นของ parseEquipmentText() ในหน้าออกแบบตัวเดียว
 *  ที่นี่เก็บแต่ผลที่แยกไว้แล้ว จะได้ไม่มีตัวแยกไฟล์สองชุดที่เพี้ยนออกจากกัน
 * ==========================================================================*/

(function (global) {
    'use strict';

    const DB_NAME = 'asc_devices';
    const DB_VER  = 1;
    const STORE   = 'devices';
    const META    = 'meta';

    /* ป้ายหมวดที่คนอ่านรู้เรื่อง ใช้ทั้งในตัวเลือกและหน้าผู้ดูแลระบบ */
    const CAT_LABEL = {
        PV : 'แผงโซลาร์เซลล์',
        INV: 'อินเวอร์เตอร์',
        ESS: 'แบตเตอรี่',
        OPT: 'ออปติไมเซอร์',
        EV : 'เครื่องชาร์จรถไฟฟ้า'
    };

    /* สถานะล่าสุด ให้หน้าจอเอาไปบอกผู้ใช้ได้ว่าข้อมูลมาจากไหน */
    let _state = { source: 'none', n: 0, syncedAt: null, error: '', loading: false };
    let _rows  = [];          // แคชในหน่วยความจำ ใช้ตอบคำถามยิบย่อยโดยไม่แตะ IndexedDB
    let _db    = null;
    let _ready = null;

    /* ── IndexedDB ─────────────────────────────────────────────────────── */

    function open() {
        if (_db) return Promise.resolve(_db);
        return new Promise((res, rej) => {
            if (!global.indexedDB) { rej(new Error('เบราว์เซอร์นี้ไม่รองรับ IndexedDB')); return; }
            const rq = global.indexedDB.open(DB_NAME, DB_VER);
            rq.onupgradeneeded = () => {
                const db = rq.result;
                if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
                if (!db.objectStoreNames.contains(META))  db.createObjectStore(META,  { keyPath: 'k'  });
            };
            rq.onsuccess = () => { _db = rq.result; res(_db); };
            rq.onerror   = () => rej(rq.error || new Error('เปิด IndexedDB ไม่สำเร็จ'));
        });
    }

    /* ห่อ transaction ให้เขียนสั้น ๆ ได้ และรอจน transaction ปิดจริงก่อนคืนค่า
       ถ้าคืนตั้งแต่ onsuccess ของ request ข้อมูลอาจยังไม่ถูกเขียนลงดิสก์ */
    function tx(store, mode, fn) {
        return open().then(db => new Promise((res, rej) => {
            const t = db.transaction(store, mode);
            const s = t.objectStore(store);
            let rq;
            try { rq = fn(s); } catch (e) { rej(e); return; }
            t.oncomplete = () => res(rq && 'result' in rq ? rq.result : undefined);
            t.onerror    = () => rej(t.error);
            t.onabort    = () => rej(t.error);
        }));
    }

    const metaGet = k => tx(META, 'readonly',  s => s.get(k)).then(r => (r && r.v) || null).catch(() => null);
    const metaSet = (k, v) => tx(META, 'readwrite', s => s.put({ k: k, v: v })).catch(() => null);

    function cacheRead() {
        return tx(STORE, 'readonly', s => s.getAll()).then(r => r || []).catch(() => []);
    }

    /* เขียนทับทั้งคลัง ไม่ใช่ทยอยอัปเดตทีละแถว
       เพราะรุ่นที่ผู้ดูแลระบบลบทิ้งต้องหายจากแคชด้วย ไม่งั้นจะค้างให้เลือกตลอดไป */
    function cacheWrite(rows) {
        return tx(STORE, 'readwrite', s => { s.clear(); (rows || []).forEach(r => s.put(r)); })
            .catch(e => { console.warn('เขียนแคชคลังอุปกรณ์ไม่สำเร็จ', e); });
    }

    /* ── ข้อความสรุปย่อของแต่ละรุ่น ใช้ต่อท้ายในรายการให้เลือก ────────────
       ช่วยให้เลือกถูกรุ่นโดยไม่ต้องเปิดดาต้าชีตดู
       ค่าที่ไม่มีให้ข้ามไป ไม่ใส่ขีดหรือศูนย์ เพราะจะดูเหมือนมีค่าจริง */
    function summarize(cat, sp) {
        const s = sp || {};
        const num = v => { const n = parseFloat(v); return isFinite(n) && n !== 0 ? n : null; };
        const bits = [];
        const push = (v, unit, digits) => {
            if (v !== null && v !== undefined) bits.push(Number(v).toFixed(digits === undefined ? 0 : digits) + ' ' + unit);
        };
        const txt = v => (v && v !== '-' ? String(v) : null);

        if (cat === 'PV') {
            push(num(s.Pmax_Wp), 'W');
            push(num(s.Voc_V), 'V Voc', 1);
            push(num(s.Module_Efficiency_Pct), '%', 1);
        } else if (cat === 'INV') {
            push(num(s.Rated_AC_Output_Power_kW), 'kW', 1);
            const m = num(s.Number_of_MPPTs);
            if (m !== null) bits.push(m + ' MPPT');
            if (txt(s.Phase_Type)) bits.push(txt(s.Phase_Type));
        } else if (cat === 'ESS') {
            push(num(s.Nominal_Capacity_kWh) || num(s.Usable_Capacity_kWh) || num(s.Module_Capacity_kWh), 'kWh', 1);
            if (txt(s.Battery_Chemistry)) bits.push(txt(s.Battery_Chemistry));
        } else if (cat === 'OPT') {
            push(num(s.Max_Input_Power_W), 'W');
            const r = num(s.Modules_Per_Optimizer);
            if (r !== null) bits.push(r + ' แผง/ตัว');
        } else if (cat === 'EV') {
            push(num(s.Max_Output_Power_kW), 'kW', 1);
            if (txt(s.Connector_Standard)) bits.push(txt(s.Connector_Standard));
        }
        return bits.join(' · ');
    }

    /* แปลงแถวจากฐานข้อมูลให้อยู่ในรูปที่หน้าจอใช้ได้ทันที

       missing = ฟิลด์บังคับที่ดาต้าชีตยังไม่มีค่า ต้องรู้ตั้งแต่ตอนเลือก ไม่ใช่รู้ตอนกดคำนวณ
       ตัวอย่างจริง อินเวอร์เตอร์ Sigenergy ตระกูล TP 29 รุ่นมี Number_of_MPPTs = 0
       เพราะตารางในดาต้าชีตเป็นเซลล์ควบรวม ตอนสกัดจึงไม่เดาแล้วติดแท็ก UNCERTAIN ไว้
       ของแบบนี้ต้องขึ้นธงให้เห็นในรายการ ไม่ใช่ปล่อยให้เลือกไปแล้วค่อยเจอ */
    function shape(r) {
        const cat = String(r.category || '').toUpperCase();
        const sub = String(r.subtype || '');
        const spec = r.spec || {};
        const ds = global.AscDatasheet;
        const missing = ds && ds.missingRequired ? ds.missingRequired(cat, spec) : [];
        return {
            id      : r.id,
            category: cat,
            brand   : r.brand || '',
            model   : r.model || '',
            subtype : sub,
            label   : (r.model || '') + (sub ? ' (' + sub + ')' : ''),
            summary : summarize(cat, spec),
            missing : missing,
            spec    : spec,
            source  : r.source_file || '',
            updated : r.updated_at || null
        };
    }

    /* ── ซิงก์ ─────────────────────────────────────────────────────────── */

    async function sync(force) {
        _state.loading = true;
        _state.error = '';

        // ยกแคชขึ้นมาก่อนเสมอ ต่อให้คลาวด์ล่มก็ยังมีของให้เลือก
        if (!_rows.length) {
            const cached = await cacheRead();
            if (cached.length) {
                _rows = cached.map(shape);
                _state.source   = 'cache';
                _state.n        = _rows.length;
                _state.syncedAt = await metaGet('syncedAt');
            }
        }

        const cloud = global.AscCloud;
        if (!cloud || !cloud.enabled) {
            _state.loading = false;
            if (!_rows.length) {
                _state.source = 'none';
                _state.error  = (cloud && cloud.disabledReason) || 'ยังไม่ได้เชื่อมต่อคลาวด์';
            }
            return _state;
        }

        /* ต้องมีเซสชันก่อนถึงจะอ่านคลังได้ เพราะ RLS เปิดให้เฉพาะผู้ที่ล็อกอิน

           ข้อนี้สำคัญกว่าที่เห็น ถ้าไม่เช็ค ผู้ที่ยังไม่ล็อกอินจะได้ผลลัพธ์
           "สำเร็จ 0 รายการ" ซึ่งแยกไม่ออกจาก "คลังว่างจริง ๆ" หน้าจอจะบอกว่า
           ข้อมูลล่าสุดจากคลาวด์ทั้งที่จริงมีของอยู่ 155 รายการแต่มองไม่เห็น
           และที่แย่กว่านั้นคือแคชที่ซิงก์ไว้แล้วจะถูกเขียนทับด้วยของว่าง */
        let signedIn = false;
        try {
            const s = await cloud.client.auth.getSession();
            signedIn = !!(s && s.data && s.data.session);
        } catch (e) { signedIn = false; }

        if (!signedIn) {
            _state.loading = false;
            _state.error = 'ยังไม่ได้เข้าสู่ระบบ จึงยังอ่านคลังจากคลาวด์ไม่ได้';
            _state.source = _rows.length ? 'cache' : 'none';
            return _state;
        }

        try {
            /* ถามตราประทับก่อน ถ้าเท่าเดิมก็ไม่ต้องดึงอะไรเลย
               คลัง 155 รายการราวหนึ่งเมกะไบต์ ไม่ควรโหลดใหม่ทุกครั้งที่เปิดหน้า */
            const stamp = await cloud.devicesStamp();
            const key   = stamp.n + '@' + (stamp.updatedAt || '');
            const seen  = await metaGet('stamp');

            if (!force && seen === key && _rows.length) {
                _state.source  = 'cache';
                _state.n       = _rows.length;
                _state.loading = false;
                return _state;
            }

            const rows = await cloud.listDevices();

            /* กันการล้างแคชที่ใช้ได้อยู่ทิ้งไปเปล่า ๆ
               ถ้าคลาวด์ตอบว่าไม่มีของสักชิ้นทั้งที่ในเครื่องมีอยู่ มักไม่ใช่ว่า
               ผู้ดูแลระบบลบคลังทั้งก้อนจริง แต่เป็นสิทธิ์หรือเซสชันมีปัญหา
               กรณีแบบนี้เก็บของเดิมไว้แล้วบอกให้รู้ ดีกว่าทำให้เลือกอุปกรณ์ไม่ได้เลย */
            if (!rows.length && _rows.length) {
                _state.source = 'cache';
                _state.error  = 'คลาวด์ตอบว่าไม่มีรายการเลย ทั้งที่ในเครื่องมี ' + _rows.length +
                                ' รายการ จึงใช้ของในเครื่องต่อ ให้ตรวจสิทธิ์การเข้าถึงคลัง';
                _state.loading = false;
                return _state;
            }

            _rows = rows.map(shape);
            await cacheWrite(rows);
            const now = new Date().toISOString();
            await metaSet('stamp', key);
            await metaSet('syncedAt', now);
            _state.source   = 'cloud';
            _state.n        = _rows.length;
            _state.syncedAt = now;
        } catch (e) {
            /* ดึงไม่สำเร็จไม่ใช่เรื่องคอขาดบาดตาย ถ้ามีแคชก็ใช้ต่อได้
               แต่ต้องบอกผู้ใช้ว่ากำลังดูของเก่า ไม่ใช่ปล่อยให้เข้าใจว่าเป็นของล่าสุด */
            _state.error  = (e && e.message) || String(e);
            _state.source = _rows.length ? 'cache' : 'none';
            console.warn('ซิงก์คลังอุปกรณ์ไม่สำเร็จ ใช้ข้อมูลที่แคชไว้แทน', e);
        }

        _state.loading = false;
        return _state;
    }

    /* ── ส่วนที่หน้าจอเรียกใช้ ─────────────────────────────────────────── */

    const AscDevices = {
        CAT_LABEL: CAT_LABEL,

        /* เรียกได้บ่อยเท่าไรก็ได้ ซิงก์จริงครั้งเดียว */
        ready() {
            if (!_ready) _ready = sync(false);
            return _ready;
        },

        /* บังคับดึงใหม่ ใช้หลังผู้ดูแลระบบเพิ่มของเข้าคลัง */
        refresh() { _ready = sync(true); return _ready; },

        status() { return Object.assign({}, _state); },

        /* จำนวนรายการต่อหมวด ใช้ตัดสินว่าจะโชว์ตัวเลือกหมวดนั้นไหม */
        count(category) {
            return category ? _rows.filter(r => r.category === category).length : _rows.length;
        },

        /* รายชื่อยี่ห้อในหมวด เรียงตามตัวอักษร พร้อมจำนวนรุ่น */
        brands(category) {
            const map = new Map();
            _rows.filter(r => r.category === category).forEach(r => {
                map.set(r.brand, (map.get(r.brand) || 0) + 1);
            });
            return Array.from(map, entry => ({ brand: entry[0], n: entry[1] }))
                        .sort((a, b) => a.brand.localeCompare(b.brand, 'en'));
        },

        /* รุ่นทั้งหมดของยี่ห้อนั้น เรียงแบบเข้าใจตัวเลขในชื่อรุ่น
           ('SUN2000-10K' ต้องมาหลัง 'SUN2000-5K' ไม่ใช่ก่อน) */
        models(category, brand) {
            return _rows.filter(r => r.category === category && r.brand === brand)
                        .sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }));
        },

        /* อ็อบเจกต์สเปกของรุ่นที่เลือก รูปแบบเดียวกับที่ parseEquipmentText คืนมา
           จึงส่งเข้า applyEquipmentData ได้ตรง ๆ */
        spec(id) {
            const r = _rows.find(x => x.id === id);
            return r ? r.spec : null;
        },

        get(id) { return _rows.find(x => x.id === id) || null; },

        all() { return _rows.slice(); },

        /* ล้างแคชในเครื่อง เผื่อข้อมูลเพี้ยนแล้วอยากเริ่มใหม่ */
        async clearCache() {
            _rows = [];
            await tx(STORE, 'readwrite', s => s.clear()).catch(() => null);
            await metaSet('stamp', null);
            _ready = null;
            _state = { source: 'none', n: 0, syncedAt: null, error: '', loading: false };
        }
    };

    global.AscDevices = AscDevices;

})(window);
