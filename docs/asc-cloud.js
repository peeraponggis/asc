/* ============================================================================
 *  Auto Solar Co-pilot Studio (ASC Studio / ASCS)
 *  Copyright (C) 2024-2569 ProInventive. All rights reserved.
 *
 *  PROPRIETARY AND CONFIDENTIAL
 *  This software is the exclusive property of ProInventive.
 *  Unauthorized copying, reverse engineering, decompilation, or distribution
 *  of this file, in whole or in part, is strictly prohibited.
 *
 *  License : Proprietary -- see EULA at https://proinventive.co.th/asc-eula
 *  Author  : Peerapong (Lungpee) -- ProInventive -- giskku@gmail.com
 * ========================================================================== */
/* ============================================================================
 *  ASC Cloud — ชั้นเชื่อมต่อ Supabase
 *  ----------------------------------------------------------------------------
 *  รวมทุกอย่างที่ต้องคุยกับเซิร์ฟเวอร์ไว้ที่เดียว หน้าอื่นเรียกผ่าน window.AscCloud
 *  ไม่ต้องรู้จัก Supabase เลย ถ้าวันหนึ่งย้ายไปใช้อย่างอื่นก็แก้แค่ไฟล์นี้
 *
 *  ถ้ายังไม่ได้ตั้งค่าใน supabase-config.js  AscCloud.enabled จะเป็น false
 *  หน้าเรียกใช้ต้องถอยไปใช้โหมดเก็บในเครื่องแบบเดิม ระบบจะได้ไม่พังระหว่างติดตั้ง
 *
 *  ต้องโหลดหลัง supabase-config.js และหลังไลบรารีของ Supabase
 *    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *    <script src="supabase-config.js"></script>
 *    <script src="asc-cloud.js"></script>
 * ========================================================================== */
(function () {
    'use strict';

    const URL_    = (window.SUPABASE_URL      || '').trim();
    const ANONKEY = (window.SUPABASE_ANON_KEY || '').trim();
    const BUCKET  = 'project-images';

    const lib     = window.supabase;                       // ไลบรารีจาก CDN
    const enabled = !!(URL_ && ANONKEY && lib && lib.createClient);

    /* เหตุผลที่ยังใช้ไม่ได้ เอาไว้บอกผู้ใช้ให้ตรงจุด ไม่ใช่แค่ "เชื่อมต่อไม่ได้" */
    let disabledReason = '';
    if (!URL_ || !ANONKEY)               disabledReason = 'ยังไม่ได้ใส่ค่าใน supabase-config.js';
    else if (!lib || !lib.createClient)  disabledReason = 'โหลดไลบรารี supabase-js ไม่สำเร็จ (ตรวจอินเทอร์เน็ตหรือตัวบล็อกโฆษณา)';

    /* ── ที่เก็บเซสชัน ────────────────────────────────────────────────────────
   ให้ช่อง "จำการเข้าสู่ระบบไว้ในเครื่องนี้" ที่หน้าล็อกอินคุมได้จริง

   ติ๊กไว้   เก็บใน localStorage  ปิดเบราว์เซอร์แล้วเปิดใหม่ยังอยู่ในระบบ
   ไม่ติ๊ก   เก็บใน sessionStorage  ปิดแท็บแล้วต้องเข้าสู่ระบบใหม่

   เดิมตั้ง persistSession เป็น true ตายตัว ทำให้ทุกคนถูกจำไว้เสมอ
   ไม่ว่าจะติ๊กหรือไม่ ซึ่งไม่ตรงกับที่ช่องนั้นบอก และบนเครื่องที่ใช้ร่วมกัน
   คนถัดไปที่เปิดเว็บจะเข้าถึงบัญชีของคนก่อนหน้าได้ทันที                      */
    const REMEMBER_FLAG = 'asc_remember_session';

    const ascAuthStorage = {
        getItem(k) {
            // ถ้าไม่มีธง แปลว่าผู้ใช้ไม่ได้สั่งให้จำ จึงต้องมองไม่เห็นเซสชันใน localStorage
            //
            // ข้อนี้สำคัญกับเครื่องที่เคยล็อกอินไว้ก่อนมีการแก้นี้ เซสชันเก่ายังค้างอยู่
            // ถ้าอ่านเจอก็จะกู้คืนแล้วพาเข้าระบบทันทีเหมือนเดิม ผู้ใช้จะต้องกดออกจากระบบ
            // ด้วยตัวเองก่อนถึงจะหาย ซึ่งไม่มีใครรู้ว่าต้องทำ
            if (localStorage.getItem(REMEMBER_FLAG) === '1') {
                const v = localStorage.getItem(k);
                if (v !== null) return v;
            }
            return sessionStorage.getItem(k);
        },
        setItem(k, v) {
            if (localStorage.getItem(REMEMBER_FLAG) === '1') {
                sessionStorage.removeItem(k);
                localStorage.setItem(k, v);
            } else {
                localStorage.removeItem(k);
                sessionStorage.setItem(k, v);
            }
        },
        removeItem(k) {
            localStorage.removeItem(k);
            sessionStorage.removeItem(k);
        }
    };

    const sb = enabled ? lib.createClient(URL_, ANONKEY, {
        auth: {
            persistSession: true, autoRefreshToken: true,
            storageKey: 'asc_supabase_auth', storage: ascAuthStorage
        }
    }) : null;


    /* ── เครื่องมือช่วย ─────────────────────────────────────────────────── */

    function need() {
        if (!enabled) throw new Error('ยังไม่ได้เชื่อมต่อคลาวด์ : ' + disabledReason);
    }

    /* แปลงข้อความผิดพลาดของ Supabase เป็นภาษาที่ผู้ใช้เข้าใจ */
    function humanError(e) {
        // ข้อความผิดพลาดของ Supabase มาได้หลายรูปแบบ message / error_description / msg / error
        // ถ้าไม่ไล่ให้ครบ จะกลายเป็น [object Object] โผล่ให้ผู้ใช้เห็นแทนสาเหตุจริง
        const m = String(
            (e && (e.message || e.error_description || e.msg || e.error_code || e.error)) ||
            (typeof e === 'string' ? e : '') || ''
        );
        if (/Invalid login credentials/i.test(m))       return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
        if (/Email not confirmed/i.test(m))             return 'ยังไม่ได้ยืนยันอีเมล กรุณาเปิดลิงก์ในอีเมลที่ส่งไปให้ก่อน';
        // แยกให้ชัดจากการกดถี่ทั่วไป เพราะกรณีนี้รอไปก็ไม่หาย ต้องไปตั้งค่า SMTP เอง
        // บริการอีเมลที่ Supabase แถมมาจำกัดไว้เพียงไม่กี่ฉบับต่อชั่วโมง ใช้งานจริงไม่ได้
        if (/email_send_rate_limit|email rate limit/i.test(m))
            return 'ส่งอีเมลไม่ได้ เพราะยังไม่ได้ตั้งค่าบริการอีเมล (SMTP) ของโปรเจกต์\n\n' +
                   'บริการที่ Supabase แถมมาจำกัดไว้เพียงไม่กี่ฉบับต่อชั่วโมงและตอนนี้เต็มแล้ว\n' +
                   'ให้ผู้ดูแลระบบตั้งค่า SMTP ก่อน (ดูขั้นที่ 4 ใน supabase/README.md)\n' +
                   'ระหว่างนี้ให้ติดต่อผู้ดูแลระบบเพื่อขอรหัสผ่านโดยตรง';
        // Supabase กันการกดซ้ำถี่ ๆ ด้วยข้อความ "For security purposes, you can only request this after N seconds"
        const cool = m.match(/only request this after (\d+) seconds?/i);
        if (cool) return 'กดถี่เกินไป กรุณารออีก ' + cool[1] + ' วินาทีแล้วลองใหม่';
        if (/rate limit|too many|over_request_rate/i.test(m))
            return 'ลองบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่';
        if (/Failed to fetch|NetworkError|network/i.test(m))
            return 'ติดต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจการเชื่อมต่ออินเทอร์เน็ต';
        if (/row-level security|violates row-level/i.test(m))
            return 'ไม่มีสิทธิ์ทำรายการนี้ (ถ้าเปิดหน้าค้างไว้นาน ให้ออกจากระบบแล้วเข้าใหม่ก่อน)';
        // PostgREST ตอบแบบนี้ทั้งกรณีไม่มีแถวจริง และกรณี RLS กรองออกจนไม่เหลือแถว
        // ผู้ใช้แยกสองกรณีนี้ไม่ออกอยู่แล้ว จึงบอกรวมเป็นข้อความเดียวที่เข้าใจได้
        if (/multiple \(or no\) rows|no rows|Results contain 0 rows|Cannot coerce the result|PGRST116/i.test(m))
            return 'ไม่พบโครงการนี้ หรือคุณไม่มีสิทธิ์เข้าถึง';
        if (/duplicate key|already exists/i.test(m))    return 'มีรายการนี้อยู่แล้ว';
        // ทริกเกอร์ enforce_invite_only โยนข้อความไทยออกมา แต่ GoTrue ห่อทับด้วยข้อความกลาง ๆ
        if (/ไม่อยู่ในรายชื่อที่ได้รับเชิญ/.test(m))
            return 'อีเมลนี้ยังไม่ได้รับอนุมัติให้ใช้งาน กรุณาติดต่อผู้ดูแลระบบเพื่อขอเพิ่มรายชื่อก่อน';
        if (/Database error saving new user|unexpected_failure/i.test(m))
            return 'สมัครไม่สำเร็จ อีเมลนี้อาจยังไม่ได้รับอนุมัติให้ใช้งาน กรุณาติดต่อผู้ดูแลระบบ';
        // Supabase ปฏิเสธโดเมนที่ไม่ใช่โดเมนจริง เช่น .local .test .invalid
        if (/Email address .* is invalid|email_address_invalid/i.test(m))
            return 'อีเมลนี้ใช้ไม่ได้ ระบบรับเฉพาะอีเมลที่ใช้งานได้จริง เช่น @gmail.com';
        if (/Password should be at least|weak.?password/i.test(m))
            return 'รหัสผ่านสั้นหรือคาดเดาง่ายเกินไป กรุณาตั้งใหม่ให้ยาวขึ้น';
        if (/Signups not allowed|signup_disabled/i.test(m))
            return 'ระบบปิดการสมัครใช้งานอยู่ กรุณาติดต่อผู้ดูแลระบบ';
        if (/JWT expired|session/i.test(m))             return 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่';
        // สองกรณีนี้ข้อความของ PostgREST มีคำว่า schema cache เหมือนกัน แต่คนละสาเหตุ
        // ต้องแยกให้ออก ไม่งั้นจะไล่ผิดทางว่ายังไม่ได้สร้างตารางทั้งที่สร้างไปแล้ว
        if (/Could not find a relationship|PGRST200/i.test(m))
            return 'โครงสร้างฐานข้อมูลไม่ตรงกับที่โปรแกรมต้องการ ให้รันไฟล์ supabase/schema.sql รุ่นล่าสุดอีกครั้ง';
        if (/schema cache|does not exist|PGRST205/i.test(m))
            return 'ยังไม่ได้สร้างตารางบนเซิร์ฟเวอร์ ให้รันไฟล์ supabase/schema.sql ใน SQL Editor ของ Supabase ก่อน';
        return m || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
    }

    function fail(e) { const err = new Error(humanError(e)); err.original = e; return err; }

    /* ── เซสชันหมดอายุระหว่างเปิดหน้าค้าง (1 พ.ย. 2569) ──
       เบราว์เซอร์พักแท็บที่เปิดทิ้งไว้ ตัวต่ออายุอัตโนมัติของ supabase-js จึงไม่ได้ทำงาน
       หน้าจอยังโชว์ผู้ดูแลระบบ แต่คำขอถูกส่งแบบไม่มีบัญชี → RLS ปฏิเสธ ขึ้น "ไม่มีสิทธิ์" ทั้งที่มีสิทธิ์
       ทางแก้: ต่ออายุก่อนเขียน · ถูกปฏิเสธแล้วต่ออายุแล้วลองซ้ำอีกครั้ง · ต่อไม่ได้ = บอกให้เข้าระบบใหม่ */
    const SESSION_EXPIRED = 'หมดเวลาเข้าสู่ระบบ กรุณาออกจากระบบแล้วเข้าใหม่ แล้วลองอีกครั้ง';
    const isRlsDenied = (e) => !!e && /row-level security|violates row-level|JWT expired|PGRST301|PGRST303/i.test(String(e.message || e.code || ''));

    async function freshSession(force) {
        try {
            const { data } = await sb.auth.getSession();
            const s = data && data.session;
            if (!s) return false;
            // เหลือไม่ถึง 1 นาที (หรือถูกปฏิเสธมาแล้ว) = ต่ออายุเดี๋ยวนี้
            if (force || !s.expires_at || s.expires_at * 1000 - Date.now() < 60000) {
                const r = await sb.auth.refreshSession();
                return !r.error && !!(r.data && r.data.session);
            }
            return true;
        } catch (e) { console.warn('ต่ออายุเซสชันไม่สำเร็จ', e); return false; }
    }

    /* เขียนข้อมูลแบบทนเซสชันหมดอายุ · run() คืน { data, error } ของ supabase
       denied(r) = ถือว่าถูกปฏิเสธเพราะสิทธิ์ (ค่าเริ่ม: ข้อความ RLS) */
    async function withSession(run, denied) {
        const isDenied = denied || ((r) => isRlsDenied(r.error));
        if (!(await freshSession(false))) throw new Error(SESSION_EXPIRED);
        let r = await run();
        if (isDenied(r)) {
            if (!(await freshSession(true))) throw new Error(SESSION_EXPIRED);
            r = await run();
        }
        if (r.error) throw fail(r.error);
        return r;
    }

    /* data URL ⇄ Blob : รูปในระบบเดิมเป็น data URL ทั้งหมด
       ตอนอัปโหลดต้องแปลงเป็นไฟล์จริง ตอนอ่านกลับต้องแปลงคืน
       เพราะ asc_report และ asc_3d ตรวจว่าขึ้นต้นด้วย 'data:image' */
    function dataUrlToBlob(dataUrl) {
        const i = String(dataUrl).indexOf(',');
        if (i < 0) return null;
        const head = dataUrl.slice(0, i);
        const mime = (head.match(/data:([^;]+)/) || [, 'image/jpeg'])[1];
        if (!/;base64/i.test(head)) return null;
        const bin = atob(dataUrl.slice(i + 1));
        const buf = new Uint8Array(bin.length);
        for (let k = 0; k < bin.length; k++) buf[k] = bin.charCodeAt(k);
        return new Blob([buf], { type: mime });
    }

    function blobToDataUrl(blob) {
        return new Promise((res, rej) => {
            const r = new FileReader();
            r.onload  = () => res(r.result);
            r.onerror = () => rej(r.error);
            r.readAsDataURL(blob);
        });
    }

    function extOf(mime) {
        if (/png/i.test(mime))  return 'png';
        if (/webp/i.test(mime)) return 'webp';
        return 'jpg';
    }


    /* ── รูปภาพ ─────────────────────────────────────────────────────────── */

    /* ดึงรูปออกจากก้อนข้อมูลก่อนส่งขึ้นเซิร์ฟเวอร์
       คืน { data: ก้อนที่ไม่มีรูป, images: [dataUrl...] } โดยไม่แตะของเดิม */
    function splitImages(data) {
        const st   = data && data.db3 && data.db3.app_state;
        const imgs = st && st.projectImagesBase64;
        if (!Array.isArray(imgs) || imgs.length === 0) return { data: data, images: [] };

        return {
            images: imgs.slice(),
            data: Object.assign({}, data, {
                db3: Object.assign({}, data.db3, {
                    app_state: Object.assign({}, st, {
                        projectImagesBase64: [],
                        _imageCount: imgs.length
                    })
                })
            })
        };
    }

    async function uploadImages(projectId, images) {
        // ลบของเก่าออกก่อน กันรูปที่ถูกถอดออกแล้วค้างกินพื้นที่
        try {
            const { data: olds } = await sb.storage.from(BUCKET).list(projectId, { limit: 100 });
            if (olds && olds.length) {
                await sb.storage.from(BUCKET).remove(olds.map(o => projectId + '/' + o.name));
            }
        } catch (e) { console.warn('ล้างรูปเก่าไม่สำเร็จ', e); }

        const uploaded = [];
        for (let i = 0; i < images.length; i++) {
            const blob = dataUrlToBlob(images[i]);
            if (!blob) continue;
            const path = projectId + '/img_' + String(i).padStart(2, '0') + '.' + extOf(blob.type);
            const { error } = await sb.storage.from(BUCKET)
                .upload(path, blob, { upsert: true, contentType: blob.type });
            if (error) throw fail(error);
            uploaded.push(path);
        }
        return uploaded;
    }

    async function downloadImages(projectId) {
        const { data: files, error } = await sb.storage.from(BUCKET).list(projectId, { limit: 100 });
        if (error || !files || !files.length) return [];
        files.sort((a, b) => a.name.localeCompare(b.name));

        const out = [];
        for (const f of files) {
            const { data: blob, error: e2 } = await sb.storage.from(BUCKET).download(projectId + '/' + f.name);
            if (e2 || !blob) { console.warn('โหลดรูปไม่สำเร็จ ' + f.name, e2); continue; }
            out.push(await blobToDataUrl(blob));
        }
        return out;
    }

    async function deleteImages(projectId) {
        try {
            const { data: files } = await sb.storage.from(BUCKET).list(projectId, { limit: 100 });
            if (files && files.length) {
                await sb.storage.from(BUCKET).remove(files.map(f => projectId + '/' + f.name));
            }
        } catch (e) { console.warn('ลบรูปไม่สำเร็จ', e); }
    }


    /* แปลงแถวจากมุมมอง project_list ให้เป็นรูปเดิมที่หน้าแรกใช้อยู่ { id, meta, data }
       ทำแบบนี้เพื่อให้โค้ดวาดการ์ด กราฟ และการแจ้งเตือนทั้งหมดใช้ต่อได้โดยไม่ต้องแก้
       data ที่ใส่กลับไปมีแค่ค่าที่หน้าแรกอ่านจริง ไม่ใช่ข้อมูลทั้งก้อน */
    function toLegacyShape(row) {
        return {
            id  : row.id,
            meta: {
                name        : row.name,
                location    : row.location || '',
                note        : row.note || '',
                owner       : row.owner_email || row.owner,
                ownerName   : row.owner_name || row.owner_email || '',
                createdAt   : row.created_at,
                lastModified: row.updated_at
            },
            data: {
                db0: row.has_load   ? {} : null,
                db1: row.has_design ? { step4_validation_results: { totalDcCapacity_kWp: Number(row.kwp) || 0 } } : null,
                db2: row.has_params ? {} : null,
                db3: row.has_report ? {} : null
            },
            cloud: {
                isMine     : !!row.is_mine,
                myRole     : row.my_role || (row.is_mine ? 'owner' : null),
                memberCount: row.member_count || 0,
                bytes      : row.data_bytes || 0
            }
        };
    }


    /* ── บัญชีผู้ใช้ ─────────────────────────────────────────────────────── */

    let _profile = null;     // แคชโปรไฟล์ของคนที่ล็อกอินอยู่

    async function loadProfile(user) {
        if (!user) { _profile = null; return null; }
        const { data, error } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
        if (error) console.warn('อ่านโปรไฟล์ไม่สำเร็จ', error);
        // สิทธิ์เมนูแอปเสริม (supabase/menu-access.sql) · ยังไม่รัน SQL = ไม่มีเมนูเพิ่ม ไม่ล้ม
        let menus = [];
        try {
            const { data: um } = await sb.from('user_menus').select('menus').eq('user_id', user.id).maybeSingle();
            menus = (um && Array.isArray(um.menus)) ? um.menus : [];
        } catch (e) { console.warn('อ่านสิทธิ์เมนูไม่สำเร็จ', e); }
        _profile = {
            id       : user.id,
            email    : user.email,
            username : user.email,                                   // ให้เข้ากับโค้ดเดิมที่ใช้ชื่อผู้ใช้
            display  : (data && data.display_name) || (user.email || '').split('@')[0],
            isAdmin  : !!(data && data.is_admin),
            menus    : menus,
            loginAt  : Date.now()
        };
        await maintenanceGate(_profile, !!error);   // อ่านโปรไฟล์ไม่สำเร็จ = ไม่บล็อก (กันล็อกผู้ดูแลทิ้งเพราะอ่านสิทธิ์ไม่ได้)
        if (!error) { _profile.access = await fetchAccess(); accessGate(_profile.access); accessWatch(); }
        return _profile;
    }

    /* ── โหมดปรับปรุง (ลุงพีสั่ง 8 พ.ย. 2569) ─────────────────────────────
       ไฟล์ maintenance.json (โฟลเดอร์เดียวกับไฟล์นี้ = รากของ ASC Enterprise) เปิดสวิตช์ "on": true
       → ทุกคนยกเว้นผู้ดูแลระบบ (profiles.is_admin) และอีเมลโดเมนใน exemptDomains ที่ล็อกอินแล้ว เห็นหน้าจอ "กำลังปรับปรุง" เต็มจอ
       ทุกหน้าที่โหลดไฟล์นี้ (หน้าหลัก · ASCS · ASCA · Project Plan ฯลฯ) · เลิกใช้: แก้ "on": false แล้ว push
       ล้มเหลวอ่านไฟล์ไม่ได้ = ไม่บล็อก (ไม่ให้ระบบปิดตัวเองเพราะเน็ตสะดุด) · เป็นด่านฝั่งหน้าจอชั่วคราว ไม่ใช่การปิดสิทธิ์ที่ฐานข้อมูล */
    const MAINT_URL = (function () {
        try { return new URL('maintenance.json', (document.currentScript && document.currentScript.src) || location.href).href; }
        catch (e) { return 'maintenance.json'; }
    })();
    let _maint = null;
    function maintConfig() {
        if (!_maint) {
            _maint = fetch(MAINT_URL + '?t=' + Date.now(), { cache: 'no-store' })
                .then(r => (r.ok ? r.json() : null)).catch(() => null);
        }
        return _maint;
    }
    function maintExempt(cfg, p) {
        if (!p) return false;
        if (p.isAdmin) return true;
        const mail = String(p.email || '').toLowerCase();
        return (cfg.exemptDomains || []).some(d => mail.endsWith('@' + String(d).toLowerCase()));
    }
    function maintShow(cfg, signedOut) {
        if (window.__ascMaint) return;
        window.__ascMaint = true;
        const lang = (document.documentElement.lang || navigator.language || 'th').slice(0, 2).toLowerCase();
        const msg = cfg.message || {};
        const text = msg[lang] || msg.th || 'ระบบกำลังปรับปรุง';
        const title = (cfg.title || {})[lang] || (cfg.title || {}).th || 'กำลังปรับปรุงระบบ';
        const btn = { th: 'ออกจากระบบ', lo: 'ອອກຈາກລະບົບ', en: 'Sign out' }[lang] || 'ออกจากระบบ';
        const box = document.createElement('div');
        box.id = 'asc-maint';
        box.setAttribute('role', 'alertdialog');
        box.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:24px;'
            + 'background:linear-gradient(160deg,#0b1f33,#12324f);color:#fff;font-family:Sarabun,Kanit,Tahoma,sans-serif;text-align:center';
        box.innerHTML = '<div style="max-width:520px"><div style="font-size:56px">🛠️</div>'
            + '<h1 style="font-size:26px;margin:10px 0 8px;font-weight:700"></h1>'
            + '<p style="font-size:16px;line-height:1.7;opacity:.92;margin:0 0 18px"></p>'
            + '<button type="button" style="font:inherit;padding:9px 22px;border-radius:10px;border:1px solid #7fb3d9;background:transparent;color:#fff;cursor:pointer"></button></div>';
        box.querySelector('h1').textContent = title;
        box.querySelector('p').textContent = text;
        const b = box.querySelector('button');
        b.textContent = btn;
        if (signedOut) b.style.display = 'none';   // ยังไม่ได้ล็อกอิน = ไม่มีให้ออกจากระบบ
        b.onclick = async () => { try { await sb.auth.signOut(); } catch (e) { /* ออกไม่ได้ก็รีโหลด */ } location.reload(); };
        const put = () => { if (!document.getElementById('asc-maint')) (document.body || document.documentElement).appendChild(box); document.documentElement.style.overflow = 'hidden'; };
        put();
        // กันลบกล่องด้วยเครื่องมือนักพัฒนา (ชั่วคราว): วางกลับทุก 1 วินาที
        setInterval(put, 1000);
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', put);
    }
    /* หน้าที่ไม่มีหน้าล็อกอินของตัวเอง (เช่น Project Plan): strict = true → ไม่ได้ล็อกอินก็ถูกบล็อกตอนปรับปรุง */
    async function maintenanceGuard(strict) {
        if (!enabled) return;
        await AscCloud.ready();
        const cfg = await maintConfig();
        if (!cfg || !cfg.on) return;
        if (_profile) { if (!maintExempt(cfg, _profile)) maintShow(cfg); }
        else if (strict) maintShow(cfg, true);
    }

    /* ── สิทธิ์การใช้งาน · แพ็กเกจ · นับเครื่องพร้อมกัน (supabase/access-control.sql · 8 พ.ย. 2569) ─────
       หลังล็อกอินเรียก my_access() (ทุก 60 วินาที) → state: exempt (ผู้ดูแล/โดเมนบริษัท) · active · grace (บัญชีเดิม 1 เดือน)
       · trial · expired · suspended · busy (ใช้เกินจำนวนเครื่องของแพ็กเกจ) — expired/suspended/busy = หน้าจอกั้นเต็มจอ + ปุ่มขอเปิดสิทธิ์
       ยังไม่ได้รัน SQL (ไม่มีฟังก์ชัน) หรือเรียกไม่สำเร็จ = ไม่บังคับ (ใช้ได้ตามเดิม) */
    function accessInstance() {
        try {
            let v = localStorage.getItem('asc_instance');
            if (!v) {
                v = 'w' + String((window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/-/g, '').slice(0, 30);
                localStorage.setItem('asc_instance', v);
            }
            return v;
        } catch (e) { return 'w' + presenceSid(); }
    }
    async function fetchAccess() {
        try {
            const { data, error } = await sb.rpc('my_access', {
                p_instance: accessInstance(), p_label: String(navigator.platform || '').slice(0, 40), p_app: presence.app || 'WEB'
            });
            if (error || !data || data.ok === false) return null;
            return data;
        } catch (e) { return null; }
    }
    const ACCESS_TXT = {
        suspended: { th: ['บัญชีนี้ถูกพักสิทธิ์ใช้งาน', 'ไม่ได้ใช้งานเกิน 30 วันหรือผู้ดูแลระบบพักสิทธิ์ไว้ งานและข้อมูลของคุณยังอยู่ครบ กด "ขอเปิดสิทธิ์" เพื่อแจ้งผู้ดูแลระบบ'],
                     lo: ['ບັນຊີນີ້ຖືກພັກສິດການໃຊ້ງານ', 'ບໍ່ໄດ້ໃຊ້ງານເກີນ 30 ວັນ ຫຼື ຜູ້ດູແລລະບົບພັກສິດໄວ້ ງານ ແລະ ຂໍ້ມູນຂອງທ່ານຍັງຢູ່ຄົບ ກົດ "ຂໍເປີດສິດ" ເພື່ອແຈ້ງຜູ້ດູແລລະບົບ'],
                     en: ['This account is suspended', 'Unused for over 30 days or suspended by an administrator. Your work and data are safe. Press "Request access" to notify the administrator.'] },
        expired:   { th: ['สิทธิ์การใช้งานหมดแล้ว', 'ช่วงทดลองหรือแพ็กเกจหมดอายุ เลือกแพ็กเกจเพื่อใช้งานต่อ กด "ขอเปิดสิทธิ์" เพื่อแจ้งผู้ดูแลระบบ'],
                     lo: ['ສິດການໃຊ້ງານໝົດແລ້ວ', 'ຊ່ວງທົດລອງ ຫຼື ແພັກເກດໝົດອາຍຸ ເລືອກແພັກເກດເພື່ອໃຊ້ງານຕໍ່ ກົດ "ຂໍເປີດສິດ" ເພື່ອແຈ້ງຜູ້ດູແລລະບົບ'],
                     en: ['Your access has ended', 'The trial or package has expired. Choose a package to continue. Press "Request access" to notify the administrator.'] },
        busy:      { th: ['บัญชีนี้กำลังใช้งานบนเครื่องอื่น', 'แพ็กเกจนี้ใช้พร้อมกันได้จำกัดจำนวนเครื่อง ออกจากเครื่องอื่นก่อน หรือรอ 3 นาทีแล้วลองอีกครั้ง'],
                     lo: ['ບັນຊີນີ້ກຳລັງໃຊ້ງານຢູ່ເຄື່ອງອື່ນ', 'ແພັກເກດນີ້ໃຊ້ພ້ອມກັນໄດ້ຈຳກັດຈຳນວນເຄື່ອງ ອອກຈາກເຄື່ອງອື່ນກ່ອນ ຫຼື ລໍຖ້າ 3 ນາທີແລ້ວລອງໃໝ່'],
                     en: ['This account is in use on another computer', 'This package allows a limited number of computers at once. Sign out elsewhere first, or wait 3 minutes and try again.'] }
    };
    const ACCESS_BTN = { req: { th: 'ขอเปิดสิทธิ์', lo: 'ຂໍເປີດສິດ', en: 'Request access' }, sent: { th: 'ส่งคำขอแล้ว', lo: 'ສົ່ງຄຳຂໍແລ້ວ', en: 'Request sent' },
                         retry: { th: 'ลองอีกครั้ง', lo: 'ລອງອີກຄັ້ງ', en: 'Try again' }, out: { th: 'ออกจากระบบ', lo: 'ອອກຈາກລະບົບ', en: 'Sign out' } };
    function accessHide() {
        const e = document.getElementById('asc-access');
        if (e) e.remove();
        if (!window.__ascMaint) document.documentElement.style.overflow = '';
    }
    function accessShow(acc) {
        if (document.getElementById('asc-access')) return;
        const lang = ((document.documentElement.lang || navigator.language || 'th').slice(0, 2).toLowerCase());
        const L = ['th', 'lo', 'en'].includes(lang) ? lang : 'th';
        const t = (ACCESS_TXT[acc.state] || ACCESS_TXT.expired)[L];
        const box = document.createElement('div');
        box.id = 'asc-access';
        box.setAttribute('role', 'alertdialog');
        box.style.cssText = 'position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:24px;'
            + 'background:linear-gradient(160deg,#16213a,#2a3a5e);color:#fff;font-family:Sarabun,Kanit,Tahoma,sans-serif;text-align:center';
        box.innerHTML = '<div style="max-width:540px"><div style="font-size:52px">' + (acc.state === 'busy' ? '🖥️' : '⏸️') + '</div>'
            + '<h1 style="font-size:24px;margin:10px 0 8px;font-weight:700"></h1><p style="font-size:15px;line-height:1.7;opacity:.92;margin:0 0 18px"></p>'
            + '<div data-r="1" style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"></div></div>';
        box.querySelector('h1').textContent = t[0];
        box.querySelector('p').textContent = t[1];
        const row = box.querySelector('[data-r]');
        const mk = (label, fn, primary) => {
            const b = document.createElement('button');
            b.type = 'button'; b.textContent = label;
            b.style.cssText = 'font:inherit;padding:9px 22px;border-radius:10px;cursor:pointer;border:1px solid #8fb0e0;color:#fff;background:' + (primary ? '#2f6fd1' : 'transparent');
            b.onclick = () => fn(b); row.appendChild(b);
        };
        if (acc.state === 'busy') mk(ACCESS_BTN.retry[L], () => location.reload(), true);
        else mk(ACCESS_BTN.req[L], async (b) => { try { await sb.rpc('access_request', { p_note: acc.state }); b.textContent = ACCESS_BTN.sent[L]; b.disabled = true; } catch (e) { /* ส่งไม่ได้ = ลองใหม่ */ } }, true);
        mk(ACCESS_BTN.out[L], async () => { try { await sb.auth.signOut(); } catch (e) { /* รีโหลดต่อ */ } location.reload(); });
        const put = () => { if (!document.getElementById('asc-access') && window.__ascAccessBlocked) (document.body || document.documentElement).appendChild(box); if (window.__ascAccessBlocked) document.documentElement.style.overflow = 'hidden'; };
        window.__ascAccessBlocked = true;
        put();
        window.__ascAccessTimer = window.__ascAccessTimer || setInterval(put, 1000);
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', put);
    }
    function accessGate(acc) {
        if (acc && ['suspended', 'expired', 'busy'].includes(acc.state)) accessShow(acc);
        else { window.__ascAccessBlocked = false; accessHide(); }
    }
    let _accessTimer = null;
    function accessWatch() {
        if (_accessTimer) return;
        _accessTimer = setInterval(async () => {
            if (!_profile || window.__ascMaint) return;
            const a = await fetchAccess();
            if (a) { _profile.access = a; accessGate(a); }
        }, 60000);
    }

    async function maintenanceGate(p, profileFailed) {
        if (!p || profileFailed) return;
        const cfg = await maintConfig();
        if (cfg && cfg.on && !maintExempt(cfg, p)) maintShow(cfg);
    }

    /* ── สถานะการใช้งาน (Pi monitor ขั้น 1 · supabase/presence.sql) ─────────
       ลุงพีสั่ง 1 พ.ย. 2569: รายงานว่าใคร (@proinventive.co.th) ใช้ ASCS/ASCA อยู่ หน้า/เมนูไหน
       ส่ง presence_ping ทุก 60 วินาที + ทันทีที่เปลี่ยนหน้า/เมนู · ฐานข้อมูลเติมอีเมลเอง และข้ามอีเมลนอกโดเมน
       "หน้า/เมนู" = ชื่อหน้า + หัวข้อหน้าต่างที่เปิด หรือแท็บที่เลือก (เป็นป้ายของโปรแกรม ไม่ใช่ข้อมูลลูกค้า)
       ไม่เก็บที่ตั้ง/IP · ยังไม่ได้รัน SQL = ฟังก์ชันไม่มี → หยุดส่งเงียบ ๆ ไม่รบกวนผู้ใช้                       */
    const PRESENCE_MS = 60 * 1000;
    const presence = { app: '', platform: 'web', version: '', base: '', page: '', detail: null, sid: '', sent: '', lastInput: Date.now(), started: false, off: false };

    /* ทะเบียนโปรแกรมอื่นของลุงพีบนโดเมนเดียวกัน (peeraponggis.github.io) ที่โหลดไฟล์นี้เพื่อรายงาน Pi monitor
       เพิ่มโปรแกรม = หนึ่งบรรทัดที่นี่ + หนึ่งบรรทัดใน supabase/presence-apps.sql (ลุงพีสั่ง 2 พ.ย. 2569) */
    const PRESENCE_APPS = [
        { path: '/aisolar2/project_plan', app: 'PLAN', base: 'Project Plan' }
    ];

    /* โปรแกรม + ชื่อหน้า จากที่อยู่หน้าเว็บ (หน้าที่ต้องการละเอียดกว่านี้เรียก AscCloud.presence()/presencePage()) */
    function presenceDefaults(path) {
        const p = String(path || '').toLowerCase();
        const reg = PRESENCE_APPS.find(a => p.includes(a.path));
        if (reg) return { app: reg.app, base: reg.base };
        if (p.includes('/architec/'))       return { app: 'ASCA', base: 'ASCA' };
        if (p.includes('/studio/report'))   return { app: 'ASCS', base: 'ASCS · รายงาน' };
        if (p.includes('/studio/'))         return { app: 'ASCS', base: 'ASCS · ออกแบบ' };
        if (p.includes('asc_design'))       return { app: 'ASCS', base: 'ASC · ออกแบบ (ASC เดิม)' };
        if (p.includes('master_shell'))     return { app: 'ASCS', base: 'ASC · เมนูหลัก' };
        if (p.includes('mobi'))             return { app: 'ASCS', base: 'ASC · มือถือ' };
        if (p.includes('pi-monitor'))       return { app: 'ASCS', base: 'ASC Enterprise · Pi monitor' };
        const file = p.split('/').pop() || '';
        if (!file || file === 'index.html') return { app: 'ASCS', base: 'ASC Enterprise · Dashboard' };
        return { app: 'ASCS', base: 'ASC · ' + file.replace(/\.html?$/, '') };
    }

    function presencePlatform(w) {
        if (w && w.Capacitor) return 'mobile';
        return /Android|iPhone|iPad|Mobile/i.test((w && w.navigator && w.navigator.userAgent) || '') ? 'mobile' : 'web';
    }

    /* ป้ายสั้นอ่านง่าย: ยุบช่องว่าง · ตัดเหลือ 40 ตัวอักษร */
    function presenceLabel(s) {
        const t = String(s || '').replace(/\s+/g, ' ').trim();
        return t.length > 40 ? t.slice(0, 39) + '…' : t;
    }

    /* เมนูที่เปิดอยู่: หัวข้อหน้าต่าง (dialog) ที่เปิด ก่อน · ไม่มีก็แท็บที่เลือก */
    function presenceDetail(doc) {
        if (!doc || !doc.querySelector) return '';
        const h = doc.querySelector('dialog[open] h2, dialog[open] h3, [role="dialog"]:not([hidden]) h2');
        if (h && h.textContent) return presenceLabel(h.textContent);
        const tab = doc.querySelector('#tabs button.on, [role="tab"][aria-selected="true"]');
        return tab && tab.textContent ? presenceLabel(tab.textContent) : '';
    }

    function presencePageNow() {
        let own = '';
        if (presence.detail) { try { own = presenceLabel(presence.detail()); } catch (e) { /* หน้าเปลี่ยนโครงสร้าง = ใช้วิธีปกติ */ } }
        const d = presence.page || own || presenceDetail(document);
        return d ? presence.base + ' · ' + d : presence.base;
    }

    function presenceSid() {
        const fresh = () => String((window.crypto && crypto.randomUUID) ? crypto.randomUUID()
            : Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/-/g, '').slice(0, 32);
        try {
            let s = sessionStorage.getItem('asc_presence_sid');
            if (!s) { s = fresh(); sessionStorage.setItem('asc_presence_sid', s); }
            return s;
        } catch (e) { return fresh(); }
    }

    async function presenceSend(closed) {
        if (presence.off || window.__ascMaint || !enabled || !_profile || !presence.app) return;
        const page = presencePageNow();
        const active = !document.hidden && (Date.now() - presence.lastInput) < PRESENCE_MS + 5000;
        try {
            const { error } = await sb.rpc('presence_ping', {
                p_session: presence.sid, p_app: presence.app, p_platform: presence.platform,
                p_version: presence.version, p_page: page, p_active: active, p_closed: !!closed
            });
            if (error) {
                // ยังไม่ได้รัน presence.sql = หยุดส่ง (ไม่ยิงซ้ำทุกนาที)
                if (/presence_ping|function|schema cache|not exist/i.test(error.message || '')) presence.off = true;
                return;
            }
            presence.sent = page;
        } catch (e) { /* เน็ตหลุด = รอบหน้าค่อยส่ง */ }
    }

    function presenceStart() {
        if (presence.started || !enabled) return;
        presence.started = true;
        presence.sid = presenceSid();
        const mark = () => { presence.lastInput = Date.now(); };
        ['pointerdown', 'keydown', 'wheel', 'mousemove', 'touchstart'].forEach(ev =>
            window.addEventListener(ev, mark, { passive: true, capture: true }));
        setInterval(() => presenceSend(false), PRESENCE_MS);
        // เปลี่ยนหน้า/เมนู → ส่งทันที (ตรวจทุก 5 วินาที เบากว่าเฝ้าทุกการเปลี่ยนแปลงของหน้า)
        setInterval(() => { if (_profile && presencePageNow() !== presence.sent) presenceSend(false); }, 5000);
        document.addEventListener('visibilitychange', () => presenceSend(false));
        window.addEventListener('pagehide', () => presenceSend(true));
    }

    const AscCloud = {
        enabled        : enabled,
        disabledReason : disabledReason,
        client         : sb,

        /* ตั้งโปรแกรม/เวอร์ชัน/หน้า ให้ละเอียดกว่าค่าจากที่อยู่หน้าเว็บ · { app:'ASCS'|'ASCA'|'PLAN', platform, version, base, page, detail }
           detail = ฟังก์ชันคืนชื่อเมนู/แท็บที่เปิดอยู่ (เรียกทุก 5 วินาที) — สำหรับหน้าที่ไม่ได้ใช้แท็บแบบ ASC */
        presence(opts) {
            Object.keys(opts || {}).forEach(k => {
                if (['app', 'platform', 'version', 'base', 'page'].includes(k) && opts[k] != null) presence[k] = String(opts[k]);
            });
            if (opts && typeof opts.detail === 'function') presence.detail = opts.detail;
            presenceStart();
            presenceSend(false);
        },
        /* หน้า/เมนูที่เปิดอยู่ (ป้ายของโปรแกรม ห้ามใส่ชื่อลูกค้า) · '' = กลับไปดูหน้าต่าง/แท็บเอง */
        presencePage(label) {
            presence.page = presenceLabel(label);
            if (presencePageNow() !== presence.sent) presenceSend(false);
        },
        /* แอดมิน: สถานะทุกแท็บ · ผู้ใช้ทั่วไป: ของตัวเอง (มุมมอง presence_status) */
        async presenceList() {
            need();
            const { data, error } = await sb.from('presence_status').select('*').order('last_seen', { ascending: false });
            if (error) throw fail(error);
            return data || [];
        },
        _presenceUtil: { defaults: presenceDefaults, platform: presencePlatform, label: presenceLabel, detail: presenceDetail },

        /* รอให้กู้เซสชันเดิมเสร็จก่อน ต้องเรียกก่อนใช้งานอย่างอื่นเสมอ */
        async ready() {
            if (!enabled) return null;
            const { data } = await sb.auth.getSession();
            const user = data && data.session && data.session.user;
            return user ? await loadProfile(user) : null;
        },

        currentUser() { return _profile; },

        onAuthChange(cb) {
            if (!enabled) return () => {};
            const { data } = sb.auth.onAuthStateChange(async (_evt, session) => {
                const u = session && session.user;
                cb(u ? await loadProfile(u) : null);
            });
            return () => { try { data.subscription.unsubscribe(); } catch (e) {} };
        },

        /* remember : true = จำไว้ข้ามการปิดเบราว์เซอร์ · false = อยู่แค่แท็บนี้
           ต้องตั้งธงก่อนเรียกเข้าสู่ระบบ เพราะ supabase-js จะเขียนเซสชันทันที
           ที่ล็อกอินสำเร็จ ถ้าตั้งทีหลังจะไปเขียนผิดที่แล้ว */
        setRemember(remember) {
            if (remember) localStorage.setItem(REMEMBER_FLAG, '1');
            else localStorage.removeItem(REMEMBER_FLAG);
        },

        async signIn(email, password, remember) {
            need();
            if (remember !== undefined) this.setRemember(remember);
            const { data, error } = await sb.auth.signInWithPassword({
                email: String(email || '').trim().toLowerCase(),
                password: String(password || '')
            });
            if (error) throw fail(error);
            return await loadProfile(data.user);
        },

        async signOut() {
            if (!enabled) return;
            await presenceSend(true);                       // แจ้งออกจากระบบก่อนเซสชันหาย (ส่งหลังจากนี้ไม่ได้แล้ว)
            await sb.auth.signOut();
            _profile = null;
            // ล้างธงด้วย ไม่งั้นครั้งถัดไปที่ล็อกอินโดยไม่ติ๊ก จะยังถูกจำไว้จากธงเก่า
            localStorage.removeItem(REMEMBER_FLAG);
            localStorage.removeItem('asc_supabase_auth');
            sessionStorage.removeItem('asc_supabase_auth');
        },

        /* ที่อยู่ที่ให้ผู้ใช้กลับมาหลังกดลิงก์ในอีเมล

           เดิมใช้ location.pathname ตรงๆ ซึ่งเปลี่ยนไปตามว่าผู้ใช้เปิดหน้าไหน
           เปิด /asc/ ได้อย่างหนึ่ง เปิด /asc/index.html ได้อีกอย่างหนึ่ง
           Supabase อนุญาตเฉพาะที่อยู่ที่อยู่ในรายการ Redirect URLs เท่านั้น
           ถ้าไม่ตรงสักอันจะเงียบๆ พาไปที่ Site URL แทน ซึ่งถ้ายังเป็น localhost
           อยู่ ผู้ใช้จะเจอหน้าเปิดไม่ได้ทั้งที่ตัวลิงก์ถูกต้อง

           ตัดชื่อไฟล์ท้ายทิ้งให้เหลือแต่โฟลเดอร์เสมอ จะได้มีที่อยู่เดียวให้ไป
           ใส่ในรายการอนุญาต ไม่ต้องไล่ใส่หลายแบบ */
        authRedirectUrl() {
            return location.origin + location.pathname.replace(/[^/]*$/, '');
        },

        /* ส่งลิงก์ตั้งรหัสผ่านใหม่ ใช้ทั้งตอนลืมรหัส และตอนเชิญผู้ใช้เข้าระบบครั้งแรก */
        async sendPasswordReset(email, redirectTo) {
            need();
            const { error } = await sb.auth.resetPasswordForEmail(
                String(email || '').trim().toLowerCase(),
                { redirectTo: redirectTo || this.authRedirectUrl() }
            );
            if (error) throw fail(error);
            return true;
        },

        /* ส่งอีเมลยืนยันการสมัครใหม่ ใช้เมื่อลิงก์เดิมหมดอายุหรือถูกใช้ไปแล้ว
           ลิงก์ยืนยันใช้ได้ครั้งเดียวและมีอายุจำกัด บางครั้งตัวสแกนลิงก์ของผู้ให้
           บริการอีเมลกดเปิดไปก่อนผู้ใช้ด้วยซ้ำ จึงต้องมีทางขอใหม่โดยไม่ต้องสมัครซ้ำ */
        async resendConfirmation(email, redirectTo) {
            need();
            const { error } = await sb.auth.resend({
                type: 'signup',
                email: String(email || '').trim().toLowerCase(),
                options: { emailRedirectTo: redirectTo || this.authRedirectUrl() }
            });
            if (error) throw fail(error);
            return true;
        },

        /* ตั้งรหัสผ่านใหม่ เรียกหลังผู้ใช้กลับมาจากลิงก์ในอีเมล */
        async setPassword(newPassword) {
            need();
            const { error } = await sb.auth.updateUser({ password: String(newPassword || '') });
            if (error) throw fail(error);
            return true;
        },

        async updateDisplayName(name) {
            need();
            const u = _profile;
            if (!u) throw new Error('ยังไม่ได้เข้าสู่ระบบ');
            const { error } = await sb.from('profiles')
                .update({ display_name: String(name || '').trim() }).eq('id', u.id);
            if (error) throw fail(error);
            _profile.display = String(name || '').trim();
            return true;
        },


        /* ── ข้อมูลบริษัทผู้เสนอ ─────────────────────────────────────────
           เก็บในโปรไฟล์ผู้ใช้ กรอกครั้งเดียวใช้ได้ทุกโครงการ
           ใช้ทั้งในหัวรายงาน asc_report และในเอกสารข้อเสนอ */

        // ชื่อคอลัมน์ที่เกี่ยวกับบริษัท รวมไว้ที่เดียวกันเผื่อเพิ่มภายหลัง
        get companyFields() {
            return ['company_name', 'company_address', 'company_tax_id', 'company_phone',
                    'company_email', 'company_website', 'company_logo_url',
                    'signer_name', 'signer_title', 'company_profile'];
        },

        async getCompany() {
            need();
            const u = _profile;
            if (!u) throw new Error('ยังไม่ได้เข้าสู่ระบบ');
            const { data, error } = await sb.from('profiles')
                .select(this.companyFields.join(',')).eq('id', u.id).single();
            if (error) throw fail(error);
            return data || {};
        },

        async saveCompany(info) {
            need();
            const u = _profile;
            if (!u) throw new Error('ยังไม่ได้เข้าสู่ระบบ');
            const patch = {};
            this.companyFields.forEach(k => {
                if (info[k] === undefined) return;
                patch[k] = (k === 'company_profile') ? (info[k] || {}) : String(info[k] || '').trim();
            });
            if (Object.keys(patch).length === 0) return true;

            // ขอแถวกลับมาด้วย เพื่อไม่ให้เกิดกรณี "บันทึกสำเร็จ" ทั้งที่ถูกกรองทิ้ง
            const { data: rows, error } = await sb.from('profiles')
                .update(patch).eq('id', u.id).select('id');
            if (error) throw fail(error);
            if (!rows || rows.length === 0) throw new Error('บันทึกไม่สำเร็จ กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง');
            return true;
        },

        /* อัปโหลดโลโก้ไปยัง bucket company-logos โฟลเดอร์ตามรหัสผู้ใช้
           bucket ตั้งเป็น public จึงได้ URL ที่ใส่ใน <img src> ได้ตรง ๆ
           ไม่ต้องขอลิงก์ลงนามใหม่ทุกครั้งที่เปิดรายงาน */
        async uploadLogo(file) {
            need();
            const u = _profile;
            if (!u) throw new Error('ยังไม่ได้เข้าสู่ระบบ');
            if (!file) throw new Error('ยังไม่ได้เลือกไฟล์');
            if (!/^image\//.test(file.type)) throw new Error('ต้องเป็นไฟล์รูปภาพเท่านั้น');
            if (file.size > 2 * 1024 * 1024) throw new Error('ไฟล์ใหญ่เกิน 2 MB กรุณาย่อขนาดก่อน');

            const ext  = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
            const path = u.id + '/logo.' + (ext || 'png');

            const { error } = await sb.storage.from('company-logos')
                .upload(path, file, { upsert: true, contentType: file.type });
            if (error) throw fail(error);

            const { data } = sb.storage.from('company-logos').getPublicUrl(path);
            // ต่อเวลาไว้ท้าย URL เพื่อให้เบราว์เซอร์ไม่หยิบรูปเก่าจากแคชมาแสดง
            const url = data.publicUrl + '?v=' + Date.now();
            await this.saveCompany({ company_logo_url: url });
            return url;
        },


        /* ── สมัครใช้งานเอง ─────────────────────────────────────────────
           เปิดให้สมัครได้ แต่ด่านจริงคือทริกเกอร์ enforce_invite_only ในฐานข้อมูล
           อีเมลที่ไม่อยู่ในรายชื่ออนุมัติจะถูกปฏิเสธตั้งแต่ตอนเขียนแถว */

        /* ถามล่วงหน้าว่าอีเมลนี้อนุมัติไว้หรือยัง จะได้บอกสาเหตุก่อนกดสมัคร
           ไม่งั้นผู้ใช้จะเจอแต่ "Database error saving new user" ซึ่งไม่สื่ออะไร
           ฟังก์ชันนี้ตอบแค่ใช่หรือไม่ใช่ ไม่เปิดให้ดึงรายชื่อทั้งหมดออกไป */
        async isEmailAllowed(email) {
            need();
            const { data, error } = await sb.rpc('is_email_allowed', { p_email: String(email || '').trim().toLowerCase() });
            if (error) throw fail(error);
            return data === true;
        },

        async signUp(email, password, displayName, redirectTo) {
            need();
            const mail = String(email || '').trim().toLowerCase();

            // ตรวจก่อนเรียกสมัคร เพื่อให้ข้อความที่ผู้ใช้เห็นตรงกับสาเหตุจริง
            let allowed = true;
            try { allowed = await this.isEmailAllowed(mail); } catch (e) { /* ถามไม่ได้ก็ปล่อยให้ด่านจริงตัดสิน */ }
            if (!allowed) {
                throw new Error('อีเมลนี้ยังไม่ได้รับอนุมัติให้ใช้งาน กรุณาติดต่อผู้ดูแลระบบเพื่อขอเพิ่มรายชื่อก่อน');
            }

            const { data, error } = await sb.auth.signUp({
                email: mail,
                password: String(password || ''),
                options: {
                    data: { display_name: String(displayName || '').trim() || mail.split('@')[0] },
                    emailRedirectTo: redirectTo || this.authRedirectUrl()
                }
            });
            if (error) throw fail(error);

            // ถ้าโปรเจกต์ตั้งให้ต้องยืนยันอีเมล จะยังไม่มี session กลับมา
            return {
                user           : data.user,
                needConfirm    : !data.session,
                alreadyExisted : !!(data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0)
            };
        },


        /* ── รายชื่ออีเมลที่อนุมัติ (เฉพาะผู้ดูแลระบบ) ──────────────────── */

        async listAllowedEmails() {
            need();
            const { data, error } = await sb.from('allowed_emails')
                .select('email, note, created_at').order('email');
            if (error) throw fail(error);

            // เทียบกับโปรไฟล์ เพื่อบอกว่าใครสมัครแล้วใครยัง
            let signed = {};
            try {
                const { data: pr } = await sb.from('profiles').select('id, email, display_name, is_admin');
                (pr || []).forEach(p => { signed[String(p.email).toLowerCase()] = p; });
            } catch (e) { console.warn('อ่านโปรไฟล์เพื่อเทียบสถานะไม่สำเร็จ', e); }

            // สิทธิ์เมนูของทุกคน · menusReady = false เมื่อยังไม่ได้รัน menu-access.sql
            let menusBy = {}, menusReady = true;
            {
                const { data: um, error: ue } = await sb.from('user_menus').select('user_id, menus');
                if (ue) { menusReady = false; console.warn('อ่านสิทธิ์เมนูไม่สำเร็จ', ue); }
                (um || []).forEach(m => { menusBy[m.user_id] = m.menus || []; });
            }

            return (data || []).map(r => {
                const p = signed[String(r.email).toLowerCase()];
                return {
                    email     : r.email,
                    note      : r.note || '',
                    createdAt : r.created_at,
                    registered: !!p,
                    display   : p ? p.display_name : '',
                    isAdmin   : !!(p && p.is_admin),
                    userId    : p ? p.id : null,
                    menus     : (p && menusBy[p.id]) || [],
                    menusReady: menusReady
                };
            });
        },

        /* ── สิทธิ์เมนูแอปเสริม (เฉพาะผู้ดูแลระบบ · บังคับที่ RLS/ฟังก์ชัน) ── */

        async setUserMenus(userId, menus) {
            need();
            await withSession(() => sb.from('user_menus').upsert({
                user_id   : userId,
                menus     : [...new Set(menus || [])],
                updated_at: new Date().toISOString(),
                updated_by: _profile ? _profile.id : null
            }, { onConflict: 'user_id' }));
            return true;
        },

        async setUserAdmin(userId, on) {
            need();
            // ฟังก์ชันโยน 42501 "เฉพาะผู้ดูแลระบบ…" เมื่อ auth.uid() ว่าง (เซสชันหมด) — ลองต่ออายุก่อนเชื่อข้อความนั้น
            await withSession(() => sb.rpc('admin_set_admin', { p_user: userId, p_on: !!on }),
                (r) => isRlsDenied(r.error) || !!(r.error && r.error.code === '42501'));
            return true;
        },

        async addAllowedEmail(email, note) {
            need();
            const mail = String(email || '').trim().toLowerCase();
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) throw new Error('รูปแบบอีเมลไม่ถูกต้อง');
            await withSession(() => sb.from('allowed_emails')
                .upsert({ email: mail, note: String(note || '').trim() }, { onConflict: 'email' }));
            return mail;
        },


        /* ── สิทธิ์การใช้งาน · แพ็กเกจ (supabase/access-control.sql) ───────── */
        myAccess() { return _profile ? (_profile.access || null) : null; },

        async accessAdminList() {
            need();
            const r = await withSession(() => sb.rpc('access_admin_list'));
            return r.data || [];
        },
        async accessPackages() {
            need();
            const r = await withSession(() => sb.from('access_packages').select('*').order('sort'));
            return r.data || [];
        },
        async accessSavePackage(row) {
            need();
            const clean = {
                code: String(row.code), name: String(row.name || row.code), sort: Number(row.sort) || 0,
                price_baht: row.price_baht === '' || row.price_baht == null ? null : Number(row.price_baht),
                duration_days: Math.max(1, Number(row.duration_days) || 30),
                max_kwp: row.max_kwp === '' || row.max_kwp == null ? null : Number(row.max_kwp),
                max_devices: Math.max(1, Number(row.max_devices) || 1),
                features: row.features || {}, note: String(row.note || ''), updated_at: new Date().toISOString()
            };
            await withSession(() => sb.from('access_packages').upsert(clean, { onConflict: 'code' }));
            return true;
        },
        async accessSet(a) {
            need();
            await withSession(() => sb.rpc('access_set', {
                p_email: a.email, p_use_package: a.usePackage ?? null, p_package: a.package ?? null,
                p_valid_from: a.validFrom || null, p_valid_to: a.validTo || null, p_source: a.source ?? null,
                p_exempt: a.exempt ?? null, p_dev_override: a.devOverride ?? null, p_kwp_override: a.kwpOverride ?? null,
                p_clear_dates: !!a.clearDates
            }));
            return true;
        },
        async accessSuspend(email, on, reason) {
            need();
            await withSession(() => sb.rpc('access_suspend', { p_email: email, p_on: !!on, p_reason: reason || 'manual' }));
            return true;
        },
        async accessApproveLegacy(months) {
            need();
            const r = await withSession(() => sb.rpc('access_approve_legacy', { p_months: months || 1 }));
            return r.data;
        },
        async accessAutoSuspend(days) {
            need();
            const r = await withSession(() => sb.rpc('access_auto_suspend', { p_days: days || 30 }));
            return r.data;
        },

        async removeAllowedEmail(email) {
            need();
            const mail = String(email || '').trim().toLowerCase();
            // RLS ไม่โยน error ตอนลบ แค่ลบได้ 0 แถว — เซสชันหมดก็ได้ผลแบบนี้ จึงต่ออายุแล้วลองซ้ำก่อน
            const { data: rows } = await withSession(() => sb.from('allowed_emails')
                .delete().eq('email', mail).select('email'), (r) => isRlsDenied(r.error) || !(r.data && r.data.length));
            if (!rows || rows.length === 0) {
                throw new Error('ลบไม่สำเร็จ เฉพาะผู้ดูแลระบบเท่านั้นที่แก้รายชื่อได้');
            }
            return true;
        },


        /* ── คลังสเปกอุปกรณ์ (devices) ──────────────────────────────────
           อ่านได้ทุกคนที่ล็อกอิน เขียนได้เฉพาะผู้ดูแลระบบ (บังคับที่ RLS)
           ฝั่งเรียกใช้คือ asc-devices.js ซึ่งจะแคชผลลงเครื่องอีกชั้น
           เพื่อให้หน้าออกแบบยังเลือกอุปกรณ์ได้ตอนเน็ตหลุด */

        /* ตราประทับของคลัง ใช้ถามสั้น ๆ ว่าแคชในเครื่องเก่าหรือยัง
           ถูกกว่าการดึงทั้งคลังมานับเองมาก จึงเรียกได้ทุกครั้งที่เปิดหน้า */
        async devicesStamp() {
            need();
            const { data, error } = await sb.rpc('devices_stamp');
            if (error) throw fail(error);
            return { n: (data && data.n) || 0, updatedAt: (data && data.updated_at) || null };
        },

        /* ดึงทั้งคลัง แบ่งหน้าเพราะ Supabase จำกัดผลลัพธ์ต่อคำขอไว้ 1,000 แถว
           คลังตอนนี้ 155 รายการก็จริง แต่ถ้าโตเกินพันแล้วไม่แบ่งหน้า
           รายการที่เกินจะหายไปเงียบ ๆ โดยไม่มี error ให้เห็น */
        async listDevices() {
            need();
            const PAGE = 1000;
            let out = [], from = 0;
            for (;;) {
                const { data, error } = await sb.from('devices')
                    .select('id, category, brand, model, subtype, spec, source_file, updated_at')
                    .order('category').order('brand').order('model')
                    .range(from, from + PAGE - 1);
                if (error) throw fail(error);
                const rows = data || [];
                out = out.concat(rows);
                if (rows.length < PAGE) break;
                from += PAGE;
            }
            return out;
        },

        /* เพิ่มหรือทับรายการ ชนกันที่ (category, brand, model, subtype)
           นำเข้าไฟล์เดิมซ้ำจึงเป็นการอัปเดต ไม่ใช่สร้างรุ่นซ้ำ */
        async upsertDevices(rows) {
            need();
            const list = (rows || []).filter(Boolean);
            if (!list.length) return 0;
            const uid = _profile && _profile.id;
            const payload = list.map(r => ({
                category   : String(r.category || '').toUpperCase(),
                brand      : String(r.brand || '').trim(),
                model      : String(r.model || '').trim(),
                subtype    : String(r.subtype || '').trim(),
                spec       : r.spec || {},
                source_file: String(r.sourceFile || r.source_file || '').trim(),
                updated_at : new Date().toISOString(),
                updated_by : uid || null
            }));
            const { data, error } = await sb.from('devices')
                .upsert(payload, { onConflict: 'category,brand,model,subtype' })
                .select('id');
            if (error) throw fail(error);
            return (data || []).length;
        },

        async deleteDevice(id) {
            need();
            const { data, error } = await sb.from('devices').delete().eq('id', id).select('id');
            if (error) throw fail(error);
            if (!data || !data.length) throw new Error('ลบไม่สำเร็จ เฉพาะผู้ดูแลระบบเท่านั้นที่แก้คลังอุปกรณ์ได้');
            return true;
        },


        /* ── โครงการ ─────────────────────────────────────────────────── */

        /* รายการโครงการ ไม่ดึง data มาด้วยเพราะหน้าแรกใช้แค่ชื่อกับวันที่
           มุมมอง project_list คำนวณ kwp กับสถานะความคืบหน้ามาให้แล้วฝั่งเซิร์ฟเวอร์ */
        async listProjects() {
            need();
            const { data, error } = await sb.from('project_list')
                .select('*').order('updated_at', { ascending: false });
            if (error) throw fail(error);
            return (data || []).map(toLegacyShape);
        },

        /* ดึงโครงการเต็ม พร้อมต่อรูปกลับเข้าไปให้เหมือนตอนเก็บ */
        async getProject(id) {
            need();
            const { data, error } = await sb.from('projects').select('*').eq('id', id).single();
            if (error) throw fail(error);

            const d  = data.data || { db0: null, db1: null, db2: null, db3: null };
            const st = d.db3 && d.db3.app_state;
            if (st && st._imageCount) {
                st.projectImagesBase64 = await downloadImages(id);
                delete st._imageCount;
            }
            return { id: data.id, name: data.name, location: data.location || '', note: data.note || '',
                     owner: data.owner, createdAt: data.created_at, updatedAt: data.updated_at, data: d };
        },

        async createProject(name, location, note) {
            need();
            const u = _profile;
            if (!u) throw new Error('ยังไม่ได้เข้าสู่ระบบ');
            const { data, error } = await sb.from('projects').insert({
                name    : String(name || 'New Solar Project').trim(),
                location: String(location || '').trim(),
                note    : String(note || '').trim(),
                owner   : u.id
            }).select().single();
            if (error) throw fail(error);
            return data.id;
        },

        /* บันทึกโครงการ แยกรูปขึ้น Storage ให้อัตโนมัติ
           opts.skipImages = true เมื่อรู้ว่ารูปไม่ได้เปลี่ยน จะได้ไม่อัปโหลดซ้ำทุกครั้ง */
        async saveProject(id, payload, opts) {
            need();
            opts = opts || {};
            const split = splitImages(payload.data || {});

            if (!opts.skipImages && split.images.length) {
                await uploadImages(id, split.images);
            }

            const patch = { data: split.data };
            if (payload.name != null) patch.name = String(payload.name).trim();

            // ต้องขอแถวที่ถูกแก้กลับมาด้วย เพื่อรู้ว่าเขียนสำเร็จจริงหรือไม่
            //
            // ⚠ ถ้าสิทธิ์ไม่ถึง ฐานข้อมูลจะกรองแถวออกเงียบ ๆ ไม่ถือเป็นข้อผิดพลาด
            //   คำสั่งจะสำเร็จโดยแก้ศูนย์แถว ถ้าไม่ตรวจตรงนี้ โปรแกรมจะขึ้นว่า
            //   "บันทึกขึ้นคลาวด์แล้ว" ทั้งที่ไม่มีอะไรถูกเขียนเลย แล้วผู้ใช้จะปิดหน้าไปโดยงานหาย
            const { data: rows, error } = await sb.from('projects').update(patch).eq('id', id).select('id');
            if (error) throw fail(error);
            if (!rows || rows.length === 0) {
                throw new Error('บันทึกไม่สำเร็จ คุณไม่มีสิทธิ์แก้ไขโครงการนี้ หรือโครงการถูกลบไปแล้ว');
            }
            return true;
        },

        async renameProject(id, name) {
            need();
            const { data: rows, error } = await sb.from('projects')
                .update({ name: String(name || '').trim() }).eq('id', id).select('id');
            if (error) throw fail(error);
            if (!rows || rows.length === 0) throw new Error('เปลี่ยนชื่อไม่สำเร็จ คุณไม่มีสิทธิ์แก้ไขโครงการนี้');
            return true;
        },

        /* ต้องยืนยันสิทธิ์ลบให้ได้ก่อนแตะรูป
           นโยบายของ Storage ให้สิทธิ์ลบไฟล์ตาม "สิทธิ์แก้ไข" แต่การลบโครงการสงวนไว้ให้เจ้าของ
           ถ้าลบรูปก่อนโดยไม่ตรวจ คนที่ถูกเชิญมาแก้ไขจะกดลบแล้วทำลายรูปทิ้งได้ทั้งชุด
           ทั้งที่คำสั่งลบโครงการถูกปฏิเสธ — โครงการยังอยู่แต่รูปหายถาวร
           และจะสลับไปลบแถวก่อนก็ไม่ได้ เพราะพอแถวหาย นโยบายจะตรวจสิทธิ์ไม่ได้ ไฟล์จะค้างเป็นขยะ */
        async deleteProject(id) {
            need();
            const { data: row, error: e0 } = await sb.from('projects').select('owner').eq('id', id).single();
            if (e0) throw fail(e0);

            const u = _profile;
            if (!u || (row.owner !== u.id && !u.isAdmin)) {
                throw new Error('ลบไม่ได้ เฉพาะเจ้าของโครงการเท่านั้นที่ลบได้');
            }

            await deleteImages(id);
            const { error } = await sb.from('projects').delete().eq('id', id);
            if (error) throw fail(error);
            return true;
        },


        /* ── การแชร์ ─────────────────────────────────────────────────── */

        async listMembers(projectId) {
            need();
            const { data, error } = await sb.from('project_members')
                .select('user_id, role, created_at, profiles:user_id (email, display_name)')
                .eq('project_id', projectId);
            if (error) throw fail(error);
            return (data || []).map(m => ({
                userId : m.user_id,
                role   : m.role,
                email  : m.profiles ? m.profiles.email : '',
                display: m.profiles ? m.profiles.display_name : '',
                since  : m.created_at
            }));
        },

        /* รายชื่อผู้ใช้ทั้งหมด ใช้ในช่องเลือกคนที่จะเชิญ */
        async listUsers() {
            need();
            const { data, error } = await sb.from('profiles')
                .select('id, email, display_name').order('email');
            if (error) throw fail(error);
            return data || [];
        },

        async addMember(projectId, email, role) {
            need();
            const target = String(email || '').trim().toLowerCase();
            const { data: prof, error: e1 } = await sb.from('profiles')
                .select('id, email').eq('email', target).maybeSingle();
            if (e1) throw fail(e1);
            if (!prof) throw new Error('ไม่พบผู้ใช้อีเมลนี้ในระบบ ต้องให้เขาสมัครและเข้าสู่ระบบอย่างน้อยหนึ่งครั้งก่อน');

            const u = _profile;
            const { error } = await sb.from('project_members').upsert({
                project_id: projectId,
                user_id   : prof.id,
                role      : (role === 'editor' ? 'editor' : 'viewer'),
                invited_by: u ? u.id : null
            }, { onConflict: 'project_id,user_id' });
            if (error) throw fail(error);
            return true;
        },

        /* สองฟังก์ชันนี้ก็ต้องขอแถวกลับมาเช่นกัน ด้วยเหตุผลเดียวกับ saveProject
           ไม่งั้นจะขึ้นว่าเปลี่ยนสิทธิ์หรือถอดคนออกสำเร็จ ทั้งที่ถูกกรองทิ้งไปแล้ว */
        async setMemberRole(projectId, userId, role) {
            need();
            const { data: rows, error } = await sb.from('project_members')
                .update({ role: (role === 'editor' ? 'editor' : 'viewer') })
                .eq('project_id', projectId).eq('user_id', userId).select('user_id');
            if (error) throw fail(error);
            if (!rows || rows.length === 0) throw new Error('เปลี่ยนสิทธิ์ไม่สำเร็จ เฉพาะเจ้าของโครงการเท่านั้นที่ทำได้');
            return true;
        },

        async removeMember(projectId, userId) {
            need();
            const { data: rows, error } = await sb.from('project_members')
                .delete().eq('project_id', projectId).eq('user_id', userId).select('user_id');
            if (error) throw fail(error);
            if (!rows || rows.length === 0) throw new Error('ถอดออกไม่สำเร็จ เฉพาะเจ้าของโครงการเท่านั้นที่ทำได้');
            return true;
        },


        /* ── ย้ายข้อมูลเดิมขึ้นคลาวด์ ────────────────────────────────────
           อ่านจาก localStorage ก้อนเดิมแล้วสร้างเป็นโครงการใหม่บนเซิร์ฟเวอร์
           ไม่ลบของเดิมทิ้ง ผู้ใช้จะได้ตรวจก่อนแล้วค่อยลบเอง             */

        readLocalProjects() {
            let db = null;
            try { db = JSON.parse(localStorage.getItem('proinventive_enterprise_db')); } catch (e) { db = null; }
            if (!db || !db.projects) return [];

            return Object.keys(db.projects).map(id => {
                const p    = db.projects[id] || {};
                const data = p.data || {};
                // รูปถูกแยกไปคีย์ต่างหากตั้งแต่การปรับปรุงครั้งก่อน ต้องต่อกลับก่อนส่งขึ้น
                const st = data.db3 && data.db3.app_state;
                if (st && st._imagesStashed) {
                    try { st.projectImagesBase64 = JSON.parse(localStorage.getItem('proinventive_images_' + id)) || []; }
                    catch (e) { st.projectImagesBase64 = []; }
                    delete st._imagesStashed;
                }
                const raw = JSON.stringify(data);
                return {
                    localId : id,
                    name    : (p.meta && p.meta.name) || 'โครงการไม่มีชื่อ',
                    location: (p.meta && p.meta.location) || '',
                    note    : (p.meta && p.meta.note) || '',
                    modified: (p.meta && p.meta.lastModified) || null,
                    images  : (st && st.projectImagesBase64 && st.projectImagesBase64.length) || 0,
                    bytes   : raw.length,
                    data    : data
                };
            });
        },

        /* onProgress(ลำดับที่, ทั้งหมด, ชื่อ, ผลลัพธ์) เรียกทีละโครงการ */
        async migrateLocalProjects(list, onProgress) {
            need();
            const items = list || this.readLocalProjects();
            const done  = [];
            for (let i = 0; i < items.length; i++) {
                const it = items[i];
                try {
                    const id = await this.createProject(it.name, it.location, it.note);
                    await this.saveProject(id, { name: it.name, data: it.data });
                    done.push({ localId: it.localId, cloudId: id, name: it.name, ok: true });
                    if (onProgress) onProgress(i + 1, items.length, it.name, null);
                } catch (e) {
                    done.push({ localId: it.localId, name: it.name, ok: false, error: e.message });
                    if (onProgress) onProgress(i + 1, items.length, it.name, e);
                }
            }
            return done;
        }
    };

    AscCloud.maintenanceGuard = maintenanceGuard;
    AscCloud._access = { gate: accessGate };   // ใช้ทดสอบ
    AscCloud._maint = { gate: maintenanceGate, exempt: maintExempt };   // ใช้ทดสอบ
    window.AscCloud = AscCloud;

    // เริ่มนับสถานะทุกหน้าที่โหลดไฟล์นี้ · ส่งจริงเมื่อมีผู้ใช้ล็อกอิน (ready/signIn/onAuthChange ตั้ง _profile)
    if (enabled) {
        const d = presenceDefaults(location.pathname);
        presence.app = d.app; presence.base = d.base; presence.platform = presencePlatform(window);
        presenceStart();
    }

    if (!enabled) {
        console.info('ASC Cloud ยังไม่พร้อมใช้งาน : ' + disabledReason + ' — ระบบจะทำงานแบบเก็บในเครื่องต่อไป');
    }
})();
