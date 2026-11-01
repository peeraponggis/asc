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
 *  Pi monitor ขั้น 5 — ตรรกะหน้า Dashboard ผู้ดูแล (pi-monitor.html · ลุงพีสั่ง 1 พ.ย. 2569)
 *  ----------------------------------------------------------------------------
 *  ฟังก์ชันล้วน (ไม่แตะ DOM / เครือข่าย) ทดสอบด้วย node tests/presence.mjs
 *  แถวมาจากมุมมอง presence_status (supabase/presence.sql) — สถานะคิดที่ฐานข้อมูลแล้ว
 * ========================================================================== */
(function (root) {
    'use strict';

    const APP_LABEL      = { ASCS: 'ASC Studio', ASCA: 'ASC Architect', PI: 'Pi-System' };
    const PLATFORM_LABEL = { web: 'เว็บ', mobile: 'มือถือ', desktop: 'เครื่อง (desktop)' };
    const STATUS_LABEL   = { active: '🟢 ใช้งานอยู่', idle: '🟡 เปิดทิ้งไว้', offline: '⚫ ออฟไลน์' };
    const STATUS_ORDER   = { active: 0, idle: 1, offline: 2 };

    /* นับสรุปบนการ์ด · คนละคนนับครั้งเดียว (หลายแท็บ/หลายโปรแกรม = สถานะดีที่สุดของคนนั้น) */
    function summarize(rows) {
        const best = new Map();
        for (const r of rows || []) {
            const cur = best.get(r.email);
            if (cur === undefined || STATUS_ORDER[r.status] < STATUS_ORDER[cur]) best.set(r.email, r.status);
        }
        const out = { active: 0, idle: 0, offline: 0, people: best.size, sessions: (rows || []).length };
        for (const s of best.values()) out[s] = (out[s] || 0) + 1;
        return out;
    }

    /* กรอง: { app, status, platform, q } · ค่าว่าง = ไม่กรอง · q ค้นในอีเมลและหน้า/เมนู */
    function filterRows(rows, f) {
        const q = String((f && f.q) || '').trim().toLowerCase();
        return (rows || []).filter(r =>
            (!f || !f.app || r.app === f.app) &&
            (!f || !f.status || r.status === f.status) &&
            (!f || !f.platform || r.platform === f.platform) &&
            (!q || String(r.email).toLowerCase().includes(q) || String(r.page || '').toLowerCase().includes(q)));
    }

    /* เรียง: สถานะ (ใช้งาน → เปิดทิ้ง → ออฟไลน์) แล้วล่าสุดก่อน */
    function sortRows(rows) {
        return [...(rows || [])].sort((a, b) =>
            (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) || (Date.parse(b.last_seen) - Date.parse(a.last_seen)));
    }

    /* "3 นาทีที่แล้ว" · "2 ชม. 5 นาทีที่แล้ว" · "เมื่อสักครู่" */
    function ago(iso, now) {
        const ms = (now === undefined ? Date.now() : now) - Date.parse(iso);
        if (!isFinite(ms)) return '—';
        const min = Math.floor(ms / 60000);
        if (min < 1) return 'เมื่อสักครู่';
        if (min < 60) return `${min} นาทีที่แล้ว`;
        const h = Math.floor(min / 60), m = min % 60;
        return m ? `${h} ชม. ${m} นาทีที่แล้ว` : `${h} ชม.ที่แล้ว`;
    }

    /* เวลาไทย HH:MM (ใช้เขตเวลา Asia/Bangkok เสมอ ไม่ขึ้นกับเครื่องที่เปิด) */
    function timeTh(iso) {
        const d = new Date(iso);
        if (isNaN(d)) return '—';
        return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }) + ' น.';
    }

    /* ตรวจค่าตั้งก่อนบันทึก (ช่วงเดียวกับ check ในตาราง monitor_settings) · คืนข้อความผิด หรือ '' */
    function checkSettings(s) {
        const n = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
        if (!n(s.report_minutes, 1, 1440))  return 'สรุปทุกกี่นาที ต้องเป็นจำนวนเต็ม 1–1440';
        if (!n(s.idle_minutes, 1, 240))     return 'ไม่ขยับกี่นาที = เปิดทิ้งไว้ ต้องเป็นจำนวนเต็ม 1–240';
        if (!n(s.offline_minutes, 2, 60))   return 'ไม่มีสัญญาณกี่นาที = ออฟไลน์ ต้องเป็นจำนวนเต็ม 2–60';
        return '';
    }

    const api = { APP_LABEL, PLATFORM_LABEL, STATUS_LABEL, summarize, filterRows, sortRows, ago, timeTh, checkSettings };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.AscPiMonitor = api;
})(typeof window !== 'undefined' ? window : globalThis);
