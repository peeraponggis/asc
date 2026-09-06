/* ============================================================================
 *  ASC · Quick Learning — บทเรียนลัด 6 ขั้น ฝังเป็นแท็บแรกของหน้าคู่มือ
 *
 *  ทำไมต้องมีไฟล์นี้
 *  ----------------------------------------------------------------------
 *  คู่มือฉบับเต็มยาว 250 KB ครบทุกเรื่องก็จริง แต่คนที่เพิ่งเปิดโปรแกรม
 *  ครั้งแรกไม่รู้ว่าต้องเริ่มตรงไหน และไม่รู้ว่าหกเมนูนั้นต่อกันอย่างไร
 *  แท็บนี้เล่าลำดับงานจริงให้จบในหกหน้าจอ แล้วมีปุ่มกระโดดไปเมนูนั้นเลย
 *
 *  เรื่องภาพประกอบ
 *  ----------------------------------------------------------------------
 *  ตั้งใจใช้ไดอะแกรมที่วาดขึ้น ไม่ใช่ภาพจับหน้าจอ
 *  ลองจับภาพหน้าจอจริงด้วย html-to-image แล้วออกมาใช้ไม่ได้ ไทล์ดาวเทียมหาย
 *  ไอคอนกลายเป็นกล่องสี่เหลี่ยม แผงบนหลังคาไม่ถูกวาด ภาพแบบนั้นจะสอนผิด
 *  ไดอะแกรมยังได้เปรียบอีกสามอย่าง คือไม่มีข้อมูลลูกค้าติดไปด้วยตาม PDPA
 *  ไฟล์เล็กกว่ามาก และไม่เก่าแบบเงียบ ๆ เมื่อหน้าจอเปลี่ยนสี
 *  ถ้าวันหนึ่งมีภาพจับหน้าจอที่ดีพอ วางทับได้เลยโดยไม่ต้องแก้โค้ด
 *  เพราะ media ใน steps.*.json รับพาธอะไรก็ได้
 *
 *  เนื้อหาอยู่ในไฟล์ข้อมูล ไม่ได้ฝังในโค้ด
 *  ----------------------------------------------------------------------
 *  learn/steps.th.json และ learn/steps.en.json แก้ถ้อยคำได้โดยไม่ต้องแตะ
 *  ไฟล์นี้เลย และเพิ่มลดจำนวนขั้นได้ตามใจ ตัวหน้าจอนับจากข้อมูลที่โหลดมา
 * ==========================================================================*/

(function (global) {
    'use strict';

    const KEY_STEP = 'asc_learn_step';
    const KEY_SEEN = 'asc_learn_hide';
    const KEY_LANG = 'asc_learn_lang';

    let D = null, idx = 0, lang = 'th';

    const $ = s => document.querySelector(s);
    const esc = s => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    /* เก็บค่าแบบกันพัง เพราะบางเบราว์เซอร์ปิด localStorage ไว้
       และโหมดส่วนตัวบางตัวโยน error ตั้งแต่ตอนอ่าน */
    const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

    const CSS = [
        '#learn-tabs{display:flex;gap:6px;margin-bottom:26px;border-bottom:1px solid #e2e8f0;}',
        '#learn-tabs button{background:none;border:0;border-bottom:2px solid transparent;',
        'padding:10px 16px;cursor:pointer;font:inherit;font-size:14px;font-weight:600;color:#64748b;}',
        '#learn-tabs button.on{color:#2563eb;border-bottom-color:#2563eb;}',
        '#learn-root{display:none;}',
        '#learn-root.on{display:block;}',
        '.lr-bar{height:5px;border-radius:3px;background:#e2e8f0;overflow:hidden;margin:14px 0 22px;}',
        '.lr-bar>i{display:block;height:100%;background:#2563eb;border-radius:3px;transition:width .32s ease;}',
        '.lr-grid{display:grid;grid-template-columns:212px 1fr;gap:26px;align-items:start;}',
        '@media (max-width:760px){.lr-grid{grid-template-columns:1fr;}}',
        '.lr-nav{list-style:none;margin:0;padding:0;font-size:13px;}',
        '.lr-nav li{margin-bottom:2px;}',
        '.lr-nav button{display:flex;gap:9px;align-items:flex-start;width:100%;text-align:left;',
        'background:none;border:0;padding:8px 10px;border-radius:7px;cursor:pointer;font:inherit;',
        'font-size:13px;color:#475569;line-height:1.45;}',
        '.lr-nav button:hover{background:#f1f5f9;}',
        '.lr-nav button.on{background:#eff6ff;color:#1e40af;font-weight:700;}',
        '.lr-dot{flex:0 0 20px;height:20px;border-radius:50%;background:#e2e8f0;color:#64748b;',
        'font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;}',
        '.lr-nav button.on .lr-dot{background:#2563eb;color:#fff;}',
        '.lr-nav button.did .lr-dot{background:#0f766e;color:#fff;}',
        '.lr-media{width:100%;border-radius:12px;border:1px solid #e2e8f0;background:#fff;display:block;}',
        '.lr-cap{color:#475569;line-height:1.7;margin:16px 0 0;}',
        '.lr-list{margin:12px 0 0;padding-left:20px;color:#475569;line-height:1.75;font-size:14px;}',
        '.lr-note{margin-top:14px;background:#fffbeb;border:1px solid #fde68a;border-radius:9px;',
        'padding:12px 14px;color:#78350f;font-size:13.5px;line-height:1.65;}',
        '.lr-foot{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:22px;',
        'padding-top:18px;border-top:1px solid #e2e8f0;}',
        '.lr-btn{border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:8px 15px;',
        'cursor:pointer;font:inherit;font-size:13px;font-weight:600;color:#334155;}',
        '.lr-btn:hover{background:#f8fafc;}',
        '.lr-btn:disabled{opacity:.4;cursor:default;}',
        '.lr-btn.pri{background:#2563eb;border-color:#2563eb;color:#fff;}',
        '.lr-btn.pri:hover{background:#1d4ed8;}',
        '.lr-btn.try{background:#0f766e;border-color:#0f766e;color:#fff;}',
        '.lr-btn.try:hover{background:#115e59;}',
        '.lr-opt{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-top:16px;',
        'font-size:12.5px;color:#64748b;}',
        '.lr-opt label{display:flex;gap:6px;align-items:center;cursor:pointer;}',
        '@media print{#learn-tabs,#learn-root{display:none !important;}}'
    ].join('');

    /* ── วาดหน้าจอของขั้นที่กำลังดู ────────────────────────────────────── */
    function render() {
        const S = D.steps, s = S[idx], U = D.ui;

        $('#lr-bar').style.width = ((idx + 1) / S.length * 100) + '%';
        $('#lr-count').textContent = U.progress.replace('{n}', idx + 1).replace('{t}', S.length);

        $('#lr-nav').innerHTML = S.map((x, i) =>
            '<li><button type="button" data-lr-go="' + i + '"'
            + ' class="' + (i === idx ? 'on' : (i < idx ? 'did' : '')) + '">'
            + '<span class="lr-dot">' + (i < idx ? '✓' : (i + 1)) + '</span>'
            + '<span>' + esc(x.title) + '</span></button></li>').join('');

        $('#lr-main').innerHTML =
            '<img class="lr-media" src="' + esc(s.media[0]) + '" alt="' + esc(s.title) + '">'
          + '<h3 style="font-size:19px;font-weight:700;color:#0f172a;margin:20px 0 0;">'
          + esc(s.title) + '</h3>'
          + '<p class="lr-cap">' + esc(s.caption) + '</p>'
          + (s.bullets && s.bullets.length
              ? '<ul class="lr-list">' + s.bullets.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>'
              : '')
          + (s.note ? '<div class="lr-note">' + esc(s.note) + '</div>' : '')
          + '<div class="lr-foot">'
          +   '<button type="button" class="lr-btn" id="lr-prev"' + (idx ? '' : ' disabled') + '>'
          +     esc(U.prev) + '</button>'
          +   '<button type="button" class="lr-btn pri" id="lr-next">'
          +     esc(idx === S.length - 1 ? U.done : U.next) + '</button>'
          +   (s.tab ? '<button type="button" class="lr-btn try" id="lr-try">'
                     + esc(s.tryLabel || '') + '</button>' : '')
          +   (s.doc ? '<a class="lr-btn" style="text-decoration:none;margin-left:auto" href="'
                     + esc(s.doc) + '" id="lr-doc">' + esc(U.readMore) + '</a>' : '')
          + '</div>';

        set(KEY_STEP, String(idx));
    }

    function go(i) {
        const S = D.steps;
        if (i >= S.length) { finish(); return; }
        idx = Math.max(0, Math.min(S.length - 1, i));
        render();
        const r = $('#learn-root');
        if (r) r.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }

    function finish() {
        const U = D.ui;
        $('#lr-bar').style.width = '100%';
        $('#lr-main').innerHTML =
            '<div style="border:1px solid #99f6e4;background:#f0fdfa;border-radius:12px;padding:26px 24px;">'
          + '<div style="font-size:18px;font-weight:700;color:#0f766e;">' + esc(U.finishTitle) + '</div>'
          + '<p style="color:#475569;line-height:1.7;margin:10px 0 18px;">' + esc(U.finishBody) + '</p>'
          + '<button type="button" class="lr-btn" id="lr-restart">' + esc(U.restart) + '</button>'
          + '</div>';
        /* ดูจบแล้วไม่ต้องเปิดอัตโนมัติอีก ผู้ใช้กลับมาเปิดเองได้จากแท็บด้านบน */
        set(KEY_SEEN, '1');
        const c = $('#lr-hide'); if (c) c.checked = true;
    }

    /* ── สลับแท็บระหว่างบทเรียนลัดกับคู่มือฉบับเต็ม ─────────────────────
       ไม่ได้ย้ายเนื้อหาคู่มือเดิมไปไหน แค่ซ่อนกับแสดง ถ้าไฟล์นี้หายไป
       คู่มือก็ยังอยู่ครบเหมือนเดิม */
    function showTab(which) {
        const learn = which === 'learn';
        $('#learn-root').classList.toggle('on', learn);
        D.__body.style.display = learn ? 'none' : '';
        $('#lr-tab-learn').classList.toggle('on', learn);
        $('#lr-tab-manual').classList.toggle('on', !learn);
        /* สารบัญด้านซ้ายเป็นของคู่มือฉบับเต็ม ไม่เกี่ยวกับบทเรียนลัด
           ต้องซ่อนด้วย display ไม่ใช่ visibility ไม่งั้นจะเหลือช่องว่าง 256 px
           ค้างอยู่ทางซ้ายและเนื้อหาไม่อยู่กลางหน้า */
        const aside = document.querySelector('aside');
        if (aside) aside.style.display = learn ? 'none' : '';
    }

    async function load(l) {
        const res = await fetch('learn/steps.' + l + '.json', { cache: 'no-cache' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
    }

    async function boot() {
        /* เนื้อหาคู่มือเดิมคือกล่องแรกใน main ต้องจับไว้ก่อนเพื่อสลับซ่อน/แสดง */
        const main = document.querySelector('main');
        if (!main) return;
        const body = main.firstElementChild;
        if (!body) return;

        lang = get(KEY_LANG) === 'en' ? 'en' : 'th';
        let data;
        try { data = await load(lang); }
        catch (e) {
            /* เปิดไฟล์คู่มือเดี่ยว ๆ จากดิสก์จะโหลด json ไม่ได้เพราะ CORS
               กรณีนั้นไม่ต้องมีแท็บบทเรียน ให้เห็นคู่มือเต็มไปตามปกติ */
            console.warn('Quick Learning: โหลดไฟล์ขั้นตอนไม่ได้ ข้ามไป', e);
            return;
        }
        D = data; D.__body = body;

        const st = document.createElement('style');
        st.textContent = CSS;
        document.head.appendChild(st);

        const wrap = document.createElement('div');
        wrap.className = 'max-w-3xl mx-auto px-6 sm:px-10 pt-8';
        wrap.innerHTML =
            '<div id="learn-tabs">'
          +   '<button type="button" id="lr-tab-learn">' + esc(D.ui.tabLearn) + '</button>'
          +   '<button type="button" id="lr-tab-manual">' + esc(D.ui.tabManual) + '</button>'
          + '</div>'
          + '<section id="learn-root">'
          +   '<h2 style="font-size:26px;font-weight:600;color:#0f172a;margin:0;">'
          +     esc(D.ui.heading) + '</h2>'
          +   '<p style="color:#64748b;margin:8px 0 0;">' + esc(D.ui.sub) + '</p>'
          +   '<div class="lr-bar"><i id="lr-bar" style="width:0"></i></div>'
          +   '<div class="lr-grid">'
          +     '<div><ul class="lr-nav" id="lr-nav"></ul>'
          +       '<div style="font-size:12px;color:#94a3b8;margin:10px 0 0 10px;" id="lr-count"></div>'
          +     '</div>'
          +     '<div id="lr-main"></div>'
          +   '</div>'
          +   '<div class="lr-opt">'
          +     '<label><input type="checkbox" id="lr-hide"> ' + esc(D.ui.dontShow) + '</label>'
          +     '<span style="margin-left:auto">'
          +       '<button type="button" class="lr-btn" data-lr-lang="th" style="padding:4px 10px">ไทย</button> '
          +       '<button type="button" class="lr-btn" data-lr-lang="en" style="padding:4px 10px">English</button>'
          +     '</span>'
          +   '</div>'
          + '</section>';
        main.insertBefore(wrap, body);

        const saved = parseInt(get(KEY_STEP) || '0', 10);
        idx = (isFinite(saved) && saved >= 0 && saved < D.steps.length) ? saved : 0;
        render();

        $('#lr-hide').checked = get(KEY_SEEN) === '1';
        $('#lr-hide').addEventListener('change', e => set(KEY_SEEN, e.target.checked ? '1' : '0'));

        $('#lr-tab-learn').onclick  = () => showTab('learn');
        $('#lr-tab-manual').onclick = () => showTab('manual');

        wrap.addEventListener('click', async e => {
            const t = e.target.closest ? e.target.closest('button, a') : null;
            if (!t) return;
            if (t.dataset.lrGo   !== undefined) { go(parseInt(t.dataset.lrGo, 10)); return; }
            if (t.id === 'lr-prev')    { go(idx - 1); return; }
            if (t.id === 'lr-next')    { go(idx + 1); return; }
            if (t.id === 'lr-restart') { go(0); return; }
            if (t.id === 'lr-try') {
                /* ใช้กลไกเดิมของคู่มือที่ขอให้หน้าแม่สลับแท็บให้
                   เปิดคู่มือเดี่ยว ๆ นอก shell จะไม่มีหน้าแม่ ก็ไม่เกิดอะไรขึ้น */
                const s = D.steps[idx];
                if (typeof global.jumpTo === 'function') global.jumpTo(s.tab);
                return;
            }
            if (t.id === 'lr-doc') { showTab('manual'); return; }   /* ให้ลิงก์ในคู่มือทำงานต่อเอง */
            if (t.dataset.lrLang) {
                const l = t.dataset.lrLang;
                if (l === lang) return;
                try {
                    const d = await load(l);
                    lang = l; set(KEY_LANG, l);
                    d.__body = D.__body; D = d;
                    $('#lr-tab-learn').textContent  = D.ui.tabLearn;
                    $('#lr-tab-manual').textContent = D.ui.tabManual;
                    render();
                } catch (err) { console.warn('Quick Learning: สลับภาษาไม่สำเร็จ', err); }
            }
        });

        /* ครั้งแรกที่เปิดคู่มือให้เห็นบทเรียนลัดก่อน คนที่ติ๊กไม่ต้องแสดงอีก
           หรือดูจบไปแล้วจะเข้าคู่มือฉบับเต็มตามเดิม */
        showTab(get(KEY_SEEN) === '1' ? 'manual' : 'learn');
    }

    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', boot);
    else boot();

    global.AscLearn = { open: () => showTab('learn'), go: go };

})(window);
