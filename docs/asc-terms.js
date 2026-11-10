/* ============================================================================
   asc-terms.js — แท็บ "คำศัพท์ ASCS" ในหน้า Settings (ASC Enterprise 4.8.0 · ลุงพีสั่ง 10 พ.ย. 2569)
   ----------------------------------------------------------------------------
   ผู้ดูแลระบบแก้ข้อความ 3 ภาษา (ไทย · ลาว · อังกฤษ) ของ ASC Studio ทุกคีย์
     ค่าเริ่ม  : studio/terms-default.json (ASC Studio build ให้ · scripts/build-cloud.mjs)
     คำที่แก้ : ตาราง public.ascs_terms (supabase/ascs-terms.sql) — เก็บเฉพาะคีย์ที่แก้ · คืนค่าเดิม = ลบแถว
     ASC Studio ดึงคำที่แก้ไปทับตอนเปิดโปรแกรม (design-auto src/cloud/terms.ts)
   window.AscTerms   = ฟังก์ชันล้วน (ทดสอบด้วย node tests/terms.mjs)
   window.AscTermsUI = ส่วนวาดตาราง (เรียก open() เมื่อเปิดแท็บ)
   ============================================================================ */
(function (root) {
    'use strict';
    const LANGS = ['th', 'lo', 'en'];

    /* ── ฟังก์ชันล้วน ───────────────────────────────────────────────────── */

    const prefixOf = k => String(k).split('.')[0];

    function groupCounts(keys) {
        const out = {};
        keys.forEach(k => { const p = prefixOf(k); out[p] = (out[p] || 0) + 1; });
        return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
    }

    /* ข้อความที่ ASC Studio จะแสดงจริง = ช่องที่แก้ (ไม่ว่าง) ไม่งั้นค่าเริ่ม */
    function effective(def, src) {
        return LANGS.map((l, i) => (src && typeof src[l] === 'string' && src[l].trim()) ? src[l] : (def ? def[i] : ''));
    }

    /* แถวที่ต้องเก็บใน ascs_terms (เฉพาะช่องที่ต่างจากค่าเริ่ม) · เท่าค่าเริ่มทุกช่อง = null (ลบแถว) */
    function overrideFor(def, eff) {
        if (!def) return null;
        const row = {}; let diff = false;
        LANGS.forEach((l, i) => { const v = eff[i] ?? ''; if (v.trim() && v !== def[i]) { row[l] = v; diff = true; } else row[l] = ''; });
        return diff ? row : null;
    }

    const isEdited = (def, ovr) => !!(def && ovr) && effective(def, ovr).some((v, i) => v !== def[i]);

    /* ── CSV (UTF-8 มี BOM ให้ Excel อ่านไทย/ลาวถูก) ── */
    const csvCell = v => { v = String(v ?? ''); return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    function csvStringify(rows) { return '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n'; }
    function csvParse(text) {
        text = String(text || '').replace(/^﻿/, '');
        const out = []; let row = [], f = '', q = false;
        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
            else if (c === '"') q = true;
            else if (c === ',') { row.push(f); f = ''; }
            else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); out.push(row); row = []; f = ''; }
            else f += c;
        }
        if (f !== '' || row.length) { row.push(f); out.push(row); }
        return out.filter(r => r.some(x => x !== ''));
    }

    const CSV_HEAD = ['key', 'th', 'lo', 'en', 'default_th', 'default_lo', 'default_en', 'edited'];
    function exportRows(keys, defs, ovrs) {
        return [CSV_HEAD].concat(keys.map(k => [k, ...effective(defs[k], ovrs[k]), ...defs[k], isEdited(defs[k], ovrs[k]) ? 'yes' : '']));
    }

    /* แผนนำเข้า CSV: upsert = คำที่ต่างจากที่บันทึกไว้และต่างจากค่าเริ่ม · del = กลับเป็นค่าเริ่ม (มีแถวอยู่)
       unknown = คีย์ที่โปรแกรมรุ่นนี้ไม่มี (ข้าม) · same = ไม่เปลี่ยน · ช่องว่างใน CSV = ใช้ค่าเริ่มของช่องนั้น */
    function planImport(rows, defs, ovrs) {
        const plan = { upsert: [], del: [], unknown: [], same: 0, error: '' };
        const head = (rows[0] || []).map(h => String(h).trim().toLowerCase());
        const ix = n => head.indexOf(n);
        if (ix('key') < 0) { plan.error = 'ไฟล์ไม่มีคอลัมน์ key (ใช้ไฟล์ที่ส่งออกจากหน้านี้เป็นแบบ)'; return plan; }
        const seen = new Set();
        rows.slice(1).forEach(r => {
            const k = String(r[ix('key')] || '').trim();
            if (!k || seen.has(k)) return; seen.add(k);
            const def = defs[k];
            if (!def) { plan.unknown.push(k); return; }
            const src = Object.fromEntries(LANGS.map(l => [l, ix(l) >= 0 ? String(r[ix(l)] ?? '') : '']));
            const eff = effective(def, src), now = effective(def, ovrs[k]);
            if (eff.every((v, i) => v === now[i])) { plan.same++; return; }
            const o = overrideFor(def, eff);
            if (o) plan.upsert.push({ key: k, ...o }); else plan.del.push(k);
        });
        return plan;
    }

    /* แถวสำหรับตาราง: ทุกคีย์ของค่าเริ่ม + คำที่แก้ไว้แต่โปรแกรมรุ่นนี้ไม่มีคีย์แล้ว (stale) */
    function allRows(defs, ovrs) {
        const rows = Object.keys(defs).sort().map(key => ({ key, stale: false }));
        Object.keys(ovrs).filter(k => !defs[k]).sort().forEach(key => rows.push({ key, stale: true }));
        return rows;
    }

    function filterRows(rows, defs, ovrs, f) {
        const q = String(f.q || '').trim().toLowerCase(), pf = f.prefix || '';
        return rows.filter(r => {
            if (pf === '__stale') { if (!r.stale) return false; }
            else if (pf && prefixOf(r.key) !== pf) return false;
            if (f.editedOnly && !(r.stale || isEdited(defs[r.key], ovrs[r.key]))) return false;
            if (!q) return true;
            if (r.key.toLowerCase().includes(q)) return true;
            const vals = r.stale ? LANGS.map(l => ovrs[r.key][l]) : effective(defs[r.key], (f.dirty && f.dirty[r.key]) || ovrs[r.key]).concat(defs[r.key]);
            return vals.some(v => String(v || '').toLowerCase().includes(q));
        });
    }

    const AscTerms = { LANGS, prefixOf, groupCounts, effective, overrideFor, isEdited, csvStringify, csvParse, exportRows, planImport, allRows, filterRows };
    root.AscTerms = AscTerms;

    /* ── ส่วนวาด ─────────────────────────────────────────────────────────── */

    const PAGE = 50;
    const S = { loaded: false, loading: false, defs: {}, ovrs: {}, dirty: {}, version: '', counts: {}, page: 1, syncedAt: null, plan: null, error: '' };
    const $ = id => document.getElementById(id);
    const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    const cloud = () => root.AscCloud;

    function msg(text, kind) {
        const m = $('t-msg'); if (!m) return;
        m.className = 'px-6 py-2 text-xs border-b border-slate-100 ' + (kind === 'err' ? 'text-red-700 bg-red-50' : kind === 'warn' ? 'text-amber-800 bg-amber-50' : 'text-emerald-700 bg-emerald-50');
        m.innerHTML = text;
        clearTimeout(msg.t);
        if (kind !== 'err' && kind !== 'warn') msg.t = setTimeout(() => m.classList.add('hidden'), 5000);
    }

    async function load(force) {
        if (S.loading) return;
        S.loading = true; S.error = '';
        $('t-body').innerHTML = '<tr><td colspan="5" class="px-6 py-10 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>กำลังโหลดคำศัพท์…</td></tr>';
        try {
            if (force || !S.loaded) {
                const r = await fetch('studio/terms-default.json', { cache: 'no-cache' });
                if (!r.ok) throw new Error('ยังไม่มีไฟล์ค่าเริ่ม studio/terms-default.json — ต้องปล่อย ASC Studio รุ่นเว็บ 0.170.0 ขึ้นไปก่อน');
                const j = await r.json();
                S.defs = j.keys || {}; S.version = j.version || '';
                S.counts = groupCounts(Object.keys(S.defs));
                fillPrefix();
            }
            try {
                const rows = await cloud().listTerms();
                S.ovrs = Object.fromEntries(rows.map(r => [r.key, r]));
            } catch (e) {
                S.ovrs = {};
                const m = String(e && e.message || e);
                S.error = /ascs_terms|does not exist|relation|schema cache/i.test(m)
                    ? 'ยังไม่ได้รัน supabase/ascs-terms.sql ใน Supabase — แสดงค่าเริ่มของโปรแกรมได้ แต่ยังบันทึกไม่ได้'
                    : 'โหลดคำที่แก้ไม่สำเร็จ: ' + esc(m);
            }
            S.loaded = true; S.syncedAt = new Date(); S.dirty = {};
        } catch (e) {
            S.error = esc(e.message || e);
        } finally { S.loading = false; }
        render();
        if (S.error) msg('<i class="fa-solid fa-triangle-exclamation mr-1"></i> ' + S.error, 'warn');
    }

    function fillPrefix() {
        const sel = $('t-prefix'), cur = sel.value;
        const n = Object.keys(S.defs).length;
        sel.innerHTML = ['<option value="">ทุกหมวด (' + n.toLocaleString() + ')</option>']
            .concat(Object.entries(S.counts).map(([p, c]) => `<option value="${esc(p)}">${esc(p)} · ${c}</option>`))
            .concat(['<option value="__stale">— คีย์ที่โปรแกรมไม่มีแล้ว</option>']).join('');
        sel.value = cur;
    }

    const filters = () => ({ q: $('t-q').value, prefix: $('t-prefix').value, editedOnly: $('t-edited-only').checked, dirty: S.dirty });

    function rowState(k, stale) {
        const ed = isEdited(S.defs[k], S.ovrs[k]), dirty = !!S.dirty[k];
        const cls = stale ? 'stale' : dirty ? 'dirty' : ed ? 'edited' : '';
        const badge = stale ? '<span class="text-[10px] bg-slate-300 text-slate-700 px-1.5 py-0.5 rounded">โปรแกรมไม่มีแล้ว</span>'
            : dirty ? '<span class="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">ยังไม่บันทึก</span>'
            : ed ? '<span class="text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded">แก้แล้ว</span>' : '';
        const btns = stale
            ? `<button data-act="del" data-k="${esc(k)}" class="w-8 h-8 rounded-md text-red-600 hover:bg-red-50" title="ลบคำนี้ออกจากคลาวด์"><i class="fa-solid fa-trash-can"></i></button>`
            : (dirty ? `<button data-act="save" data-k="${esc(k)}" class="w-8 h-8 rounded-md text-white bg-blue-600 hover:bg-blue-700" title="บันทึกแถวนี้"><i class="fa-solid fa-floppy-disk"></i></button>` : '')
              + ((ed || dirty) ? `<button data-act="reset" data-k="${esc(k)}" class="w-8 h-8 rounded-md text-slate-600 hover:bg-slate-100" title="คืนค่าเดิมของโปรแกรม"><i class="fa-solid fa-rotate-left"></i></button>` : '');
        return { cls, badge, btns };
    }

    function cell(k, i, cur, def, stale) {
        const v = cur[i] ?? '', changed = !stale && def && v !== def[i];
        return `<td class="px-2 py-1.5 align-top ${i === 1 ? 'term-lo' : ''}">
            <textarea rows="1" data-k="${esc(k)}" data-i="${i}" class="term-ta w-full border ${changed ? 'border-amber-400' : 'border-slate-200'} rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" ${stale ? 'readonly' : ''}>${esc(v)}</textarea>
            ${changed ? `<div class="text-[10.5px] text-slate-400 mt-0.5 leading-snug" title="ค่าเริ่มของโปรแกรม">เดิม: ${esc(def[i])}</div>` : ''}</td>`;
    }

    const grow = ta => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };

    function render() {
        const keys = Object.keys(S.defs);
        const nEdited = keys.filter(k => isEdited(S.defs[k], S.ovrs[k])).length;
        const nStale = Object.keys(S.ovrs).filter(k => !S.defs[k]).length;
        $('t-total').textContent = keys.length.toLocaleString();
        $('t-ver').textContent = S.version || '-';
        $('t-edited').textContent = nEdited;
        $('t-stale').textContent = nStale;
        $('t-groups').textContent = Object.keys(S.counts).length;
        $('t-synced').textContent = S.syncedAt ? S.syncedAt.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
        const rows = filterRows(allRows(S.defs, S.ovrs), S.defs, S.ovrs, filters());
        const pages = Math.max(1, Math.ceil(rows.length / PAGE));
        S.page = Math.min(Math.max(1, S.page), pages);
        const slice = rows.slice((S.page - 1) * PAGE, S.page * PAGE);
        $('t-body').innerHTML = slice.length ? slice.map(r => {
            const k = r.key, def = S.defs[k];
            const cur = r.stale ? LANGS.map(l => S.ovrs[k][l]) : effective(def, S.dirty[k] || S.ovrs[k]);
            const st = rowState(k, r.stale);
            return `<tr class="${st.cls} border-t border-slate-100">
                <td class="pl-6 pr-2 py-2 align-top"><div class="font-mono text-[12px] text-slate-700 break-all">${esc(k)}</div><div class="t-badge mt-1 flex gap-1 flex-wrap">${st.badge}</div></td>
                ${[0, 1, 2].map(i => cell(k, i, cur, def, r.stale)).join('')}
                <td class="t-btns px-2 py-1.5 align-top whitespace-nowrap">${st.btns}</td></tr>`;
        }).join('') : `<tr><td colspan="5" class="px-6 py-10 text-center text-slate-400">${keys.length ? 'ไม่พบคำที่ค้นหา' : 'ยังไม่มีค่าเริ่มของโปรแกรม'}</td></tr>`;
        $('t-body').querySelectorAll('textarea').forEach(grow);
        const from = rows.length ? (S.page - 1) * PAGE + 1 : 0, to = Math.min(S.page * PAGE, rows.length);
        $('t-range').textContent = `แสดง ${from.toLocaleString()}–${to.toLocaleString()} จาก ${rows.length.toLocaleString()} คีย์ · หน้าละ ${PAGE}`;
        pager(pages);
        const nd = Object.keys(S.dirty).length;
        $('t-dirty-n').textContent = nd;
        $('t-save-all').classList.toggle('hidden', !nd);
        document.querySelectorAll('.t-n-all').forEach(e => e.textContent = keys.length.toLocaleString());
        document.querySelectorAll('.t-n-view').forEach(e => e.textContent = rows.filter(r => !r.stale).length.toLocaleString());
        document.querySelectorAll('.t-n-edited').forEach(e => e.textContent = nEdited);
    }

    function pager(pages) {
        const b = (p, label, on) => `<button data-p="${p}" class="min-w-[2rem] px-2 py-1 rounded-md border ${on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-300 hover:bg-slate-50'}">${label}</button>`;
        const out = [b(Math.max(1, S.page - 1), '‹', false)];
        const show = [...new Set([1, pages, S.page - 1, S.page, S.page + 1].filter(p => p >= 1 && p <= pages))].sort((a, c) => a - c);
        let last = 0;
        show.forEach(p => { if (p - last > 1) out.push('<span class="px-1">…</span>'); out.push(b(p, p, p === S.page)); last = p; });
        out.push(b(Math.min(pages, S.page + 1), '›', false));
        $('t-pager').innerHTML = out.join('');
    }

    /* บันทึกแถว: ต่างจากค่าเริ่ม = upsert · เท่าค่าเริ่ม = ลบแถว */
    async function commit(keys) {
        const up = [], del = [];
        keys.forEach(k => {
            const o = overrideFor(S.defs[k], effective(S.defs[k], S.dirty[k]));
            if (o) up.push({ key: k, ...o }); else if (S.ovrs[k]) del.push(k);
        });
        if (up.length) await cloud().upsertTerms(up);
        if (del.length) await cloud().deleteTerms(del);
        const now = new Date().toISOString();
        up.forEach(r => { S.ovrs[r.key] = { ...r, updated_at: now }; });
        del.forEach(k => delete S.ovrs[k]);
        keys.forEach(k => delete S.dirty[k]);
        return { up: up.length, del: del.length };
    }

    async function guarded(btn, fn) {
        if (btn) btn.disabled = true;
        try { await fn(); } catch (e) { msg('<i class="fa-solid fa-circle-xmark mr-1"></i> ' + esc(e.message || e), 'err'); }
        finally { if (btn) btn.disabled = false; render(); }
    }

    function exportCsv(kind) {
        $('t-export-menu').classList.add('hidden');
        const keys = kind === 'edited' ? Object.keys(S.defs).sort().filter(k => isEdited(S.defs[k], S.ovrs[k]))
            : kind === 'view' ? filterRows(allRows(S.defs, S.ovrs), S.defs, S.ovrs, filters()).filter(r => !r.stale).map(r => r.key)
            : Object.keys(S.defs).sort();
        const blob = new Blob([csvStringify(exportRows(keys, S.defs, S.ovrs))], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `ascs-terms-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        msg(`ส่งออก ${keys.length.toLocaleString()} คีย์แล้ว · เปิดด้วย Excel ได้ (UTF-8) · แก้คอลัมน์ th/lo/en แล้วนำเข้ากลับ`);
    }

    async function importFile(f) {
        const plan = planImport(csvParse(await f.text()), S.defs, S.ovrs);
        if (plan.error) { msg(plan.error, 'err'); return; }
        S.plan = plan;
        $('t-imp-file').textContent = f.name;
        $('t-imp-up').textContent = plan.upsert.length;
        $('t-imp-del').textContent = plan.del.length;
        $('t-imp-unk').textContent = plan.unknown.length;
        $('t-imp-same').textContent = plan.same;
        $('t-imp-list').innerHTML = plan.upsert.slice(0, 30).map(x => `<tr class="border-t"><td class="py-1 font-mono pr-2 align-top">${esc(x.key)}</td><td class="py-1">${esc(effective(S.defs[x.key], x).join(' · '))}</td></tr>`).join('')
            + plan.del.slice(0, 10).map(k => `<tr class="border-t text-emerald-700"><td class="py-1 font-mono pr-2">${esc(k)}</td><td>คืนค่าเดิม</td></tr>`).join('')
            + plan.unknown.slice(0, 10).map(k => `<tr class="border-t text-slate-400"><td class="py-1 font-mono pr-2">${esc(k)}</td><td>ไม่รู้จัก — ข้าม</td></tr>`).join('');
        $('t-imp-ok').disabled = !(plan.upsert.length || plan.del.length);
        $('t-imp-modal').classList.remove('hidden');
    }

    let bound = false;
    function bind() {
        if (bound) return; bound = true;
        const body = $('t-body');
        body.addEventListener('input', e => {
            const ta = e.target.closest('textarea'); if (!ta) return;
            grow(ta);
            const k = ta.dataset.k, i = +ta.dataset.i;
            const base = S.dirty[k] || Object.fromEntries(LANGS.map((l, j) => [l, effective(S.defs[k], S.ovrs[k])[j]]));
            base[LANGS[i]] = ta.value;
            S.dirty[k] = base;
            const tr = ta.closest('tr'), st = rowState(k, false);
            tr.className = st.cls + ' border-t border-slate-100';
            tr.querySelector('.t-badge').innerHTML = st.badge;
            tr.querySelector('.t-btns').innerHTML = st.btns;
            $('t-dirty-n').textContent = Object.keys(S.dirty).length;
            $('t-save-all').classList.remove('hidden');
        });
        body.addEventListener('click', e => {
            const b = e.target.closest('[data-act]'); if (!b) return;
            const k = b.dataset.k;
            if (b.dataset.act === 'save') guarded(b, async () => { const r = await commit([k]); msg(r.del ? `คืนค่าเดิมของ <b>${esc(k)}</b> แล้ว (เท่าค่าเริ่ม)` : `บันทึก <b>${esc(k)}</b> แล้ว · ASC Studio เห็นตอนเปิดครั้งถัดไป`); });
            if (b.dataset.act === 'reset') guarded(b, async () => {
                delete S.dirty[k];
                if (S.ovrs[k]) { await cloud().deleteTerms([k]); delete S.ovrs[k]; }
                msg(`คืนค่าเดิมของ <b>${esc(k)}</b> แล้ว`);
            });
            if (b.dataset.act === 'del') guarded(b, async () => {
                if (!confirm(`ลบคำที่แก้ของคีย์ ${k} ออกจากคลาวด์?\n(โปรแกรมรุ่นนี้ไม่มีคีย์นี้แล้ว)`)) return;
                await cloud().deleteTerms([k]); delete S.ovrs[k]; msg(`ลบ <b>${esc(k)}</b> แล้ว`);
            });
        });
        $('t-save-all').addEventListener('click', e => guarded(e.currentTarget, async () => {
            const r = await commit(Object.keys(S.dirty));
            msg(`บันทึก ${r.up} รายการ · คืนค่าเดิม ${r.del} รายการ · ASC Studio เห็นตอนเปิดครั้งถัดไป`);
        }));
        $('t-pager').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (!b) return; S.page = +b.dataset.p; render(); $('t-table-top').scrollIntoView({ block: 'nearest' }); });
        let qT;
        $('t-q').addEventListener('input', () => { clearTimeout(qT); qT = setTimeout(() => { S.page = 1; render(); }, 150); });
        $('t-prefix').addEventListener('change', () => { S.page = 1; render(); });
        $('t-edited-only').addEventListener('change', () => { S.page = 1; render(); });
        $('t-card-edited').addEventListener('click', () => { $('t-prefix').value = ''; $('t-edited-only').checked = true; S.page = 1; render(); });
        $('t-card-stale').addEventListener('click', () => { $('t-prefix').value = '__stale'; $('t-edited-only').checked = false; S.page = 1; render(); });
        $('t-refresh').addEventListener('click', () => {
            if (Object.keys(S.dirty).length && !confirm('มีคำที่พิมพ์แล้วยังไม่บันทึก ดึงใหม่จะทิ้งคำเหล่านั้น ต่อไหม?')) return;
            load(true).then(() => { if (!S.error) msg('ดึงคำศัพท์จากคลาวด์ใหม่แล้ว'); });
        });
        $('t-export').addEventListener('click', e => { e.stopPropagation(); $('t-export-menu').classList.toggle('hidden'); });
        $('t-export-menu').addEventListener('click', e => { const b = e.target.closest('[data-exp]'); if (b) exportCsv(b.dataset.exp); });
        document.addEventListener('click', () => $('t-export-menu').classList.add('hidden'));
        $('t-import').addEventListener('click', () => $('t-import-file').click());
        $('t-import-file').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importFile(f); });
        const closeImp = () => { $('t-imp-modal').classList.add('hidden'); S.plan = null; };
        $('t-imp-x').addEventListener('click', closeImp);
        $('t-imp-cancel').addEventListener('click', closeImp);
        $('t-imp-ok').addEventListener('click', e => guarded(e.currentTarget, async () => {
            const p = S.plan; if (!p) return;
            if (p.upsert.length) await cloud().upsertTerms(p.upsert);
            if (p.del.length) await cloud().deleteTerms(p.del);
            const now = new Date().toISOString();
            p.upsert.forEach(r => { S.ovrs[r.key] = { ...r, updated_at: now }; delete S.dirty[r.key]; });
            p.del.forEach(k => { delete S.ovrs[k]; delete S.dirty[k]; });
            closeImp();
            msg(`นำเข้าแล้ว: บันทึก ${p.upsert.length} · คืนค่าเดิม ${p.del.length} · ข้าม ${p.unknown.length + p.same}`);
        }));
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => body.querySelectorAll('textarea').forEach(grow));
        window.addEventListener('resize', () => body.querySelectorAll('textarea').forEach(grow));
        window.addEventListener('beforeunload', e => { if (Object.keys(S.dirty).length) { e.preventDefault(); e.returnValue = ''; } });
    }

    /* เปิดแท็บ: โหลดครั้งแรกเท่านั้น (ปุ่มรีเฟรช = โหลดใหม่) */
    function open() {
        bind();
        if (!S.loaded) load(false); else render();
    }

    root.AscTermsUI = { open, reload: () => load(true), _state: S };
})(typeof window !== 'undefined' ? window : globalThis);
