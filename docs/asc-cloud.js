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

    const sb = enabled ? lib.createClient(URL_, ANONKEY, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'asc_supabase_auth' }
    }) : null;


    /* ── เครื่องมือช่วย ─────────────────────────────────────────────────── */

    function need() {
        if (!enabled) throw new Error('ยังไม่ได้เชื่อมต่อคลาวด์ : ' + disabledReason);
    }

    /* แปลงข้อความผิดพลาดของ Supabase เป็นภาษาที่ผู้ใช้เข้าใจ */
    function humanError(e) {
        const m = String((e && (e.message || e.error_description)) || e || '');
        if (/Invalid login credentials/i.test(m))       return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
        if (/Email not confirmed/i.test(m))             return 'ยังไม่ได้ยืนยันอีเมล กรุณาเปิดลิงก์ในอีเมลที่ส่งไปให้ก่อน';
        if (/rate limit|too many/i.test(m))             return 'ลองบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่';
        if (/Failed to fetch|NetworkError|network/i.test(m))
            return 'ติดต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจการเชื่อมต่ออินเทอร์เน็ต';
        if (/row-level security|violates row-level/i.test(m))
            return 'ไม่มีสิทธิ์ทำรายการนี้';
        // PostgREST ตอบแบบนี้ทั้งกรณีไม่มีแถวจริง และกรณี RLS กรองออกจนไม่เหลือแถว
        // ผู้ใช้แยกสองกรณีนี้ไม่ออกอยู่แล้ว จึงบอกรวมเป็นข้อความเดียวที่เข้าใจได้
        if (/multiple \(or no\) rows|no rows|Results contain 0 rows|Cannot coerce the result|PGRST116/i.test(m))
            return 'ไม่พบโครงการนี้ หรือคุณไม่มีสิทธิ์เข้าถึง';
        if (/duplicate key|already exists/i.test(m))    return 'มีรายการนี้อยู่แล้ว';
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
        _profile = {
            id       : user.id,
            email    : user.email,
            username : user.email,                                   // ให้เข้ากับโค้ดเดิมที่ใช้ชื่อผู้ใช้
            display  : (data && data.display_name) || (user.email || '').split('@')[0],
            isAdmin  : !!(data && data.is_admin),
            loginAt  : Date.now()
        };
        return _profile;
    }

    const AscCloud = {
        enabled        : enabled,
        disabledReason : disabledReason,
        client         : sb,

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

        async signIn(email, password) {
            need();
            const { data, error } = await sb.auth.signInWithPassword({
                email: String(email || '').trim().toLowerCase(),
                password: String(password || '')
            });
            if (error) throw fail(error);
            return await loadProfile(data.user);
        },

        async signOut() {
            if (!enabled) return;
            await sb.auth.signOut();
            _profile = null;
        },

        /* ส่งลิงก์ตั้งรหัสผ่านใหม่ ใช้ทั้งตอนลืมรหัส และตอนเชิญผู้ใช้เข้าระบบครั้งแรก */
        async sendPasswordReset(email, redirectTo) {
            need();
            const { error } = await sb.auth.resetPasswordForEmail(
                String(email || '').trim().toLowerCase(),
                { redirectTo: redirectTo || (location.origin + location.pathname) }
            );
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

    window.AscCloud = AscCloud;

    if (!enabled) {
        console.info('ASC Cloud ยังไม่พร้อมใช้งาน : ' + disabledReason + ' — ระบบจะทำงานแบบเก็บในเครื่องต่อไป');
    }
})();
