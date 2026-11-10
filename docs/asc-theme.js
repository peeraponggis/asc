/* ============================================================================
   asc-theme.js — ธีมของ ASC Enterprise = ธีมเดียวกับ ASC Studio (ลุงพีสั่ง 10 พ.ย. 2569 · 4.9.0)
   ----------------------------------------------------------------------------
   ธีม E+ 3 แบบ: Classic (ค่าเริ่ม) · Carbon (มืด) · Drafting — ค่าสีคัดลอกจาก design-auto src/ui/style.css
   ธีมที่เลือกเก็บใน localStorage 'design-auto.prefs' (คีย์เดียวกับ ASC Studio บนโดเมนเดียวกัน)
     → เลือกที่ Dashboard แล้ว studio/ ใช้ตาม และกลับกัน
   วิธีทำ: หน้าเว็บใช้คลาส Tailwind (slate/blue/emerald/amber/red/…) — ไฟล์นี้ผูกสีเหล่านั้นเข้ากับตัวแปร CSS ของธีม
     ไม่ต้องไล่แก้คลาสในหน้า · ส่วนที่เป็นพื้นเข้ม (แถบเมนูซ้าย · ภาพหน้าเข้าสู่ระบบ) กลับด้านสีในบล็อกของตัวเอง
   โหลดหลัง cdn.tailwindcss.com และก่อน <style> ของหน้า
   ============================================================================ */
(function () {
    'use strict';
    const KEY = 'design-auto.prefs';
    const THEMES = ['classic', 'carbon', 'drafting'];
    const NAMES = { classic: 'Classic', carbon: 'Carbon', drafting: 'Drafting' };

    /* ค่าสีของแต่ละธีม (ตรงกับ ASC Studio) */
    const P = {
        classic: { bg: '#f0f0f0', panel: '#ffffff', panel2: '#f7f7f7', line: '#cbcbcb', edge: '#a0a0a0', head: '#e9e9e9', ink: '#1a1a1a', ink2: '#555555', ink3: '#8a8a8a',
                   accent: '#0063b1', accent2: '#1a77c4', accentFg: '#ffffff', hover: '#cce4f7', sel: '#cce4f7',
                   ok: '#1b7a3e', okbg: '#e1f1e6', warn: '#975800', warnbg: '#fbefd9', fail: '#b42318', failbg: '#fbe3e1', vio: '#6b4fa0', viobg: '#ece6f6',
                   radius: '3px', shadow: '2px 3px 6px rgba(0,0,0,.22)', dark: false },
        carbon:  { bg: '#202124', panel: '#2b2c2f', panel2: '#2f3033', line: '#3c4043', edge: '#55595e', head: '#2f3033', ink: '#e8eaed', ink2: '#aaafb5', ink3: '#80868b',
                   accent: '#8ab4f8', accent2: '#a6c6fa', accentFg: '#202124', hover: '#394457', sel: '#394457',
                   ok: '#81c995', okbg: '#1e3a28', warn: '#fdd663', warnbg: '#3d3218', fail: '#f28b82', failbg: '#3f1e1c', vio: '#c3a6f5', viobg: '#352c48',
                   radius: '3px', shadow: '2px 3px 8px rgba(0,0,0,.5)', dark: true },
        drafting:{ bg: '#e4eae3', panel: '#f7faf6', panel2: '#edf2ec', line: '#bfc9bd', edge: '#97a595', head: '#e2e9e1', ink: '#1c251d', ink2: '#4b584c', ink3: '#7d8a7e',
                   accent: '#2f6b3a', accent2: '#3d8049', accentFg: '#ffffff', hover: '#d3e3d0', sel: '#cfe0cc',
                   ok: '#2f6b3a', okbg: '#dcebd8', warn: '#8a5300', warnbg: '#f6ecd6', fail: '#a3271c', failbg: '#f7e1de', vio: '#5d4a8a', viobg: '#e7e2f0',
                   radius: '3px', shadow: '2px 3px 6px rgba(20,40,20,.2)', dark: false },
    };

    const hex = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
    const mix = (a, b, t) => { const x = hex(a), y = hex(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
    const trip = h => hex(h).join(' ');

    /* ธีมของ ASC Studio ที่ไม่ใช่ E+ (ธีมเดิม 5 แบบ) → ใกล้เคียงที่สุด */
    const LEGACY = { night: 'carbon', forest: 'drafting', ocean: 'classic', sand: 'classic', lavender: 'classic' };
    /* หน้าเก่าที่สีส่วนใหญ่อยู่ในสคริปต์ (ผัง canvas · ตารางที่สร้างจากโค้ด) ใส่ data-light-only
       → ธีมมืดแสดงเป็น Classic ในหน้านั้น (ไม่มีส่วนที่อ่านไม่ออก) · ไม่เปลี่ยนค่าที่ผู้ใช้เลือก */
    const LIGHT_ONLY = !!(document.currentScript && document.currentScript.hasAttribute('data-light-only'));
    function readPrefs() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
    function current() {
        // ?theme=carbon ใน URL = ใช้ชั่วคราว ไม่บันทึก (หน้าที่ฝังใน iframe / ภาพตัวอย่าง · แบบ asc-tokens.css ของ ASCS)
        const q = (location.search.match(/[?&]theme=(\w+)/) || [])[1];
        const t0 = readPrefs().theme;
        const t = THEMES.includes(q) ? q : THEMES.includes(t0) ? t0 : (LEGACY[t0] || 'classic');
        return LIGHT_ONLY && P[t].dark ? 'classic' : t;
    }

    /* สีของ Tailwind ทุกเฉด → ตัวแปร (--c-<สี>-<เฉด>) ที่ตั้งค่าตามธีม */
    function scale(p) {
        const s = {};
        // slate/gray: พื้นอ่อน → เส้น → ตัวอักษร
        const sl = { 50: p.panel2, 100: p.head, 200: p.line, 300: p.edge, 400: p.ink3, 500: p.ink2, 600: p.ink2, 700: p.ink, 800: p.ink, 900: p.ink, 950: p.ink };
        const ramp = (soft, strong, strong2) => ({ 50: soft, 100: soft, 200: mix(soft, strong, .35), 300: mix(soft, strong, .6), 400: strong2 || strong, 500: strong, 600: strong, 700: strong2 || strong, 800: strong, 900: strong });
        s.slate = sl; s.gray = sl;
        s.blue = { ...ramp(p.hover, p.accent, p.accent2), 100: p.sel };
        s.ok = ramp(p.okbg, p.ok); s.warn = ramp(p.warnbg, p.warn); s.fail = ramp(p.failbg, p.fail); s.vio = ramp(p.viobg, p.vio);
        s.white = p.panel; s.black = p.dark ? '#000000' : p.ink;
        return s;
    }
    function vars(p) {
        const s = scale(p), out = [];
        ['slate', 'blue', 'ok', 'warn', 'fail', 'vio'].forEach(n => Object.entries(s[n]).forEach(([k, v]) => out.push(`--c-${n}-${k}: ${trip(v)}`)));
        out.push(`--c-white: ${trip(s.white)}`, `--c-black: ${trip(s.black)}`);
        ['bg', 'panel', 'panel2', 'line', 'edge', 'head', 'ink', 'ink2', 'ink3', 'accent', 'accent2', 'accentFg', 'hover', 'sel', 'ok', 'okbg', 'warn', 'warnbg', 'fail', 'failbg']
            .forEach(k => out.push(`--${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}: ${p[k]}`));
        out.push(`--radius: ${p.radius}`, `--mshadow: ${p.shadow}`);
        // ชื่อตัวแปรเดิมของหน้า ASC รุ่นเก่า (asc_design · asc_3d · device_location · pi-monitor) → สีของธีม
        out.push(`--text: ${p.ink}`, `--dim: ${p.ink2}`, `--danger: ${p.fail}`, `--surface: ${p.panel}`, `--border: ${p.line}`, `--border-strong: ${p.edge}`,
            `--primary: ${p.accent}`, `--ink-900: ${p.ink}`, `--ink-700: ${p.ink}`, `--ink-500: ${p.ink2}`, `--stage: ${p.bg}`,
            `--radius-sm: ${p.radius}`, `--radius-md: ${p.radius}`, `--radius-lg: calc(${p.radius} + 1px)`,
            `--shadow-sm: none`, `--shadow-md: 0 1px 3px rgba(0,0,0,.1)`, `--focus-ring: 0 0 0 2px ${p.accent}`,
            `--g: ${p.ok}`, `--y: ${p.warn}`, `--k: ${p.ink2}`);
        return out.join('; ');
    }
    /* พื้นเข้มกลับด้าน (แถบเมนูซ้ายเดิมเป็นพื้นเข้ม): ตัวอักษรขาว → ink · พื้น slate-900 → panel */
    function invertedVars(p) {
        const inv = { 50: p.ink, 100: p.ink, 200: p.ink, 300: p.ink, 400: p.ink2, 500: p.ink3, 600: p.ink3, 700: p.line, 800: p.hover, 900: p.panel, 950: p.panel };
        return Object.entries(inv).map(([k, v]) => `--c-slate-${k}: ${trip(v)}`).concat([`--c-white: ${trip(p.ink)}`, `--c-blue-400: ${trip(p.accent)}`, `--c-blue-500: ${trip(p.accent)}`]).join('; ');
    }

    const css = () => THEMES.map(t => {
        const p = P[t];
        return `:root[data-theme="${t}"] { ${vars(p)}; color-scheme: ${p.dark ? 'dark' : 'light'}; }
:root[data-theme="${t}"] .asc-invert { ${invertedVars(p)}; }
:root[data-theme="${t}"] .asc-art { ${vars(P.carbon)}; --c-white: ${trip(P.carbon.ink)}; }`;
    }).join('\n') + `
html[data-theme] body { font-family: 'Sarabun', 'Noto Sans Lao', 'Leelawadee UI', 'Segoe UI', sans-serif; }`;

    /* Tailwind: ทุกสีอ่านจากตัวแปร (รองรับ /10 ความโปร่ง) · ฟอนต์ Sarabun · มุมตามธีม · เงาบาง */
    const c = (n, k) => `rgb(var(--c-${n}-${k}) / <alpha-value>)`;
    const fam = n => Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map(k => [k, c(n, k)]));
    const colors = {
        transparent: 'transparent', current: 'currentColor', inherit: 'inherit',
        white: 'rgb(var(--c-white) / <alpha-value>)', black: 'rgb(var(--c-black) / <alpha-value>)',
        slate: fam('slate'), gray: fam('slate'), zinc: fam('slate'), neutral: fam('slate'),
        blue: fam('blue'), sky: fam('blue'), indigo: fam('blue'), cyan: fam('blue'),
        emerald: fam('ok'), green: fam('ok'), teal: fam('ok'),
        amber: fam('warn'), yellow: fam('warn'), orange: fam('warn'),
        red: fam('fail'), rose: fam('fail'),
        purple: fam('vio'), violet: fam('vio'), pink: fam('vio'),
    };
    const R = 'var(--radius)';
    window.tailwind = window.tailwind || {};
    window.tailwind.config = {
        theme: {
            colors,
            extend: {
                fontFamily: { sans: ['Sarabun', 'Noto Sans Lao', 'Leelawadee UI', 'Segoe UI', 'sans-serif'] },
                borderRadius: { DEFAULT: R, sm: R, md: R, lg: R, xl: `calc(${R} + 1px)`, '2xl': `calc(${R} + 2px)`, '3xl': `calc(${R} + 3px)` },
                boxShadow: { sm: 'none', DEFAULT: '0 1px 2px rgba(0,0,0,.06)', md: '0 1px 3px rgba(0,0,0,.1)', lg: 'var(--mshadow)', xl: 'var(--mshadow)', '2xl': 'var(--mshadow)' },
            },
        },
    };

    function apply(t) {
        const r = document.documentElement;
        r.dataset.theme = t;
        document.querySelectorAll('[data-asc-theme]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.ascTheme === t)));
        // ตราคำ PROINVENTIVE บนแถบที่กลับด้านสี (พื้นสว่างในธีมสว่าง) ใช้แบบ on-light
        document.querySelectorAll('.asc-invert .brand-3d').forEach(e => e.classList.toggle('on-light', !P[t].dark));
        const m = document.querySelector('meta[name=theme-color]');
        if (m) m.setAttribute('content', P[t].panel);
        document.dispatchEvent(new CustomEvent('asc-theme', { detail: t }));
    }

    /* เลือกธีม: เขียนคีย์เดียวกับ ASC Studio (คงค่าอื่นของ studio ไว้) */
    function set(t) {
        if (!THEMES.includes(t)) return;
        try { localStorage.setItem(KEY, JSON.stringify({ ...readPrefs(), theme: t })); } catch (e) { /* */ }
        apply(t);
    }

    /* สีของธีมปัจจุบัน (ใช้กับกราฟ Chart.js) */
    const color = (k, a) => { const p = P[current()], v = p[k] || k; return a == null ? v : `rgba(${hex(v).join(',')},${a})`; };

    const st = document.createElement('style');
    st.id = 'asc-theme-vars';
    st.textContent = css();
    document.head.appendChild(st);
    document.documentElement.dataset.theme = current();
    // เปลี่ยนธีมใน studio/ แท็บอื่น = Dashboard เปลี่ยนตาม
    window.addEventListener('storage', e => { if (e.key === KEY) apply(current()); });
    document.addEventListener('DOMContentLoaded', () => {
        apply(current());
        document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-asc-theme]'); if (b) set(b.dataset.ascTheme); });
    });

    window.AscTheme = { THEMES, NAMES, current, set, color, palette: () => P[current()], _P: P };
})();
