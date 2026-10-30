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
 *  Auto Solar Co-pilot Studio (ASC Studio / ASCS)
 *  Copyright © 2024–2569 ProInventive · All rights reserved.
 *
 *  PROPRIETARY AND CONFIDENTIAL
 *  Unauthorized copying, reverse engineering, decompilation, or distribution
 *  of this software, in whole or in part, is strictly prohibited.
 *  License: Proprietary — see EULA at https://proinventive.co.th/asc-eula
 *  Author: ลุงพี (Peerapong) · ProInventive · giskku@gmail.com
 * ============================================================================
 *  asc-pdpa.js — PDPA Consent Modal (ไทย · English · ລາວ)
 *
 *  แสดง modal ขอความยินยอม PDPA ทุกครั้งที่เริ่มเซสชัน (sessionStorage)
 *  ต้องกด "ยอมรับ" ก่อนถึงจะเข้าสู่หน้าล็อกอินได้
 * ========================================================================== */

(function () {
    'use strict';

    const ACCEPT_KEY = 'asc_pdpa_accepted_v1';
    const LAST_VER   = '2569-10-30'; // เปลี่ยนเลขนี้เมื่ออัปเดตข้อความ PDPA เพื่อบังคับรับใหม่

    /* ── เนื้อหา PDPA 3 ภาษา ──────────────────────────────────────────── */
    const CONTENT = {
        th: {
            label: 'ไทย',
            title: 'นโยบายคุ้มครองข้อมูลส่วนบุคคล (PDPA)',
            subtitle: 'พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562',
            body: `
<p class="pdpa-para"><strong>1. ผู้ควบคุมข้อมูลส่วนบุคคล</strong><br>
บริษัท โปรอินเวนทีฟ จำกัด (<strong>ProInventive</strong>) เป็นผู้ควบคุมข้อมูลส่วนบุคคลสำหรับ
<strong>Auto Solar Co-pilot Studio (ASC Studio)</strong> ซึ่งเป็นซอฟต์แวร์ลิขสิทธิ์ของบริษัทฯ
ใช้ภายในองค์กรเพื่อการออกแบบและวิเคราะห์ระบบโซล่าร์เซลล์เชิงวิศวกรรม</p>

<p class="pdpa-para"><strong>2. ข้อมูลที่เก็บรวบรวม</strong><br>
ระบบเก็บข้อมูลเพียงที่จำเป็นสำหรับการทำงาน ได้แก่:<br>
• ชื่อผู้ใช้และอีเมลที่ใช้เข้าสู่ระบบ<br>
• ข้อมูลโครงการ (ชื่อ ที่ตั้ง ขนาดระบบ พิกัดแผงโซล่าร์)<br>
• รูปภาพและไฟล์ที่อัปโหลดประกอบโครงการ<br>
• บันทึกการเข้าใช้งาน (Log) เพื่อความปลอดภัย</p>

<p class="pdpa-para"><strong>3. วัตถุประสงค์การใช้ข้อมูล</strong><br>
• ออกแบบและคำนวณระบบโซล่าร์เซลล์<br>
• จัดทำรายงานและเอกสารข้อเสนอให้แก่ลูกค้า<br>
• บันทึกประวัติการแก้ไขและตรวจสอบความถูกต้องของข้อมูล<br>
• ปรับปรุงและพัฒนาระบบต่อเนื่อง</p>

<p class="pdpa-para"><strong>4. การเปิดเผยข้อมูล</strong><br>
ข้อมูลของท่านจะไม่ถูกเปิดเผยต่อบุคคลภายนอก ยกเว้นตามที่กฎหมายกำหนด
ระบบใช้ <strong>Supabase</strong> (PostgreSQL Cloud) เป็นฐานข้อมูล ซึ่งมีมาตรการ
Row-Level Security (RLS) — ผู้ใช้แต่ละคนเข้าถึงได้เฉพาะข้อมูลของตนเอง</p>

<p class="pdpa-para"><strong>5. ระยะเวลาเก็บรักษาข้อมูล</strong><br>
ข้อมูลจะถูกเก็บรักษาตลอดช่วงเวลาที่ท่านยังเป็นผู้ใช้งานระบบ และจะถูกลบตามคำขอของท่าน
หรือเมื่อบัญชีถูกยกเลิก</p>

<p class="pdpa-para"><strong>6. สิทธิ์ของท่านในฐานะเจ้าของข้อมูล</strong><br>
ท่านมีสิทธิ์ดังต่อไปนี้ภายใต้ พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562:<br>
• <strong>สิทธิ์รับทราบ</strong> — ทราบว่ามีการเก็บข้อมูลอะไรบ้าง<br>
• <strong>สิทธิ์เข้าถึง</strong> — ขอดูข้อมูลของตนเองได้<br>
• <strong>สิทธิ์แก้ไข</strong> — ขอแก้ไขข้อมูลที่ไม่ถูกต้อง<br>
• <strong>สิทธิ์ลบ</strong> — ขอลบข้อมูลส่วนบุคคล<br>
• <strong>สิทธิ์คัดค้าน</strong> — คัดค้านการประมวลผลข้อมูล<br>
• <strong>สิทธิ์ถอนความยินยอม</strong> — ถอนความยินยอมได้ทุกเมื่อ</p>

<p class="pdpa-para"><strong>7. ติดต่อผู้ควบคุมข้อมูล</strong><br>
ProInventive · อีเมล: <a href="mailto:giskku@gmail.com" class="pdpa-link">giskku@gmail.com</a><br>
การใช้งานระบบนี้ถือว่าท่านรับทราบและยินยอมตามนโยบายนี้</p>

<p class="pdpa-para pdpa-note">ซอฟต์แวร์นี้เป็นทรัพย์สินทางปัญญาของ ProInventive ห้ามทำซ้ำ ดัดแปลง เผยแพร่
หรือ reverse engineer โดยไม่ได้รับอนุญาตเป็นลายลักษณ์อักษร</p>`,
            accept: 'ข้าพเจ้าได้อ่านและยอมรับนโยบายนี้',
            btn: 'ยอมรับและเข้าสู่ระบบ'
        },
        en: {
            label: 'English',
            title: 'Personal Data Protection Policy (PDPA)',
            subtitle: 'Thailand PDPA Act B.E. 2562 (2019)',
            body: `
<p class="pdpa-para"><strong>1. Data Controller</strong><br>
<strong>ProInventive Co., Ltd.</strong> is the Data Controller for
<strong>Auto Solar Co-pilot Studio (ASC Studio)</strong>, a proprietary software
for engineering-grade solar system design and analysis used within the organization.</p>

<p class="pdpa-para"><strong>2. Data We Collect</strong><br>
We collect only what is necessary for system operation:<br>
• Username and email for authentication<br>
• Project data (name, location, system size, panel coordinates)<br>
• Images and files uploaded to projects<br>
• Access logs for security purposes</p>

<p class="pdpa-para"><strong>3. Purpose of Processing</strong><br>
• Solar system design and technical calculation<br>
• Generating reports and proposals for clients<br>
• Maintaining revision history and data integrity<br>
• Continuous system improvement</p>

<p class="pdpa-para"><strong>4. Data Disclosure</strong><br>
Your data will not be disclosed to third parties except as required by law.
The system uses <strong>Supabase</strong> (PostgreSQL Cloud) with Row-Level Security (RLS)
— each user can access only their own data.</p>

<p class="pdpa-para"><strong>5. Retention Period</strong><br>
Data is retained for the duration of your active account and deleted upon your request
or account termination.</p>

<p class="pdpa-para"><strong>6. Your Rights as a Data Subject</strong><br>
Under Thailand's PDPA Act B.E. 2562, you have the right to:<br>
• <strong>Be Informed</strong> — know what data is collected<br>
• <strong>Access</strong> — view your personal data<br>
• <strong>Rectification</strong> — correct inaccurate data<br>
• <strong>Erasure</strong> — request deletion of your data<br>
• <strong>Object</strong> — object to data processing<br>
• <strong>Withdraw Consent</strong> — at any time</p>

<p class="pdpa-para"><strong>7. Contact</strong><br>
ProInventive · Email: <a href="mailto:giskku@gmail.com" class="pdpa-link">giskku@gmail.com</a><br>
By using this system you acknowledge and consent to this policy.</p>

<p class="pdpa-para pdpa-note">This software is the intellectual property of ProInventive.
Copying, modification, distribution, or reverse engineering without written authorization is strictly prohibited.</p>`,
            accept: 'I have read and accept this policy',
            btn: 'Accept & Continue'
        },
        lo: {
            label: 'ລາວ',
            title: 'ນະໂຍບາຍຄຸ້ມຄອງຂໍ້ມູນສ່ວນຕົວ (PDPA)',
            subtitle: 'ກົດໝາຍ PDPA ໄທ ປີ ພ.ສ. 2562',
            body: `
<p class="pdpa-para"><strong>1. ຜູ້ຄວບຄຸມຂໍ້ມູນສ່ວນຕົວ</strong><br>
<strong>ProInventive Co., Ltd.</strong> ເປັນຜູ້ຄວບຄຸມຂໍ້ມູນສ່ວນຕົວສຳລັບ
<strong>Auto Solar Co-pilot Studio (ASC Studio)</strong>, ຊອຟແວລ໌ລິຂະສິດ
ສຳລັບການອອກແບບລະບົບໂຊລາເຊລໃນອົງກອນ</p>

<p class="pdpa-para"><strong>2. ຂໍ້ມູນທີ່ເກັບກຳ</strong><br>
ລະບົບເກັບຂໍ້ມູນທີ່ຈຳເປັນເທົ່ານັ້ນ:<br>
• ຊື່ຜູ້ໃຊ້ ແລະ ອີເມລ ສຳລັບການເຂົ້າລະບົບ<br>
• ຂໍ້ມູນໂຄງການ (ຊື່, ສະຖານທີ, ຂະໜາດລະບົບ, ພິກັດແຜງໂຊລາ)<br>
• ຮູບພາບ ແລະ ໄຟລ໌ທີ່ອັບໂຫລດ<br>
• ບັນທຶກການເຂົ້າໃຊ້ (Log) ສຳລັບຄວາມປອດໄພ</p>

<p class="pdpa-para"><strong>3. ຈຸດປະສົງການໃຊ້ຂໍ້ມູນ</strong><br>
• ອອກແບບ ແລະ ຄຳນວນລະບົບໂຊລາເຊລ<br>
• ຈັດທຳລາຍງານ ແລະ ເອກະສານສະເໜີລາຄາ<br>
• ບັນທຶກປະຫວັດການແກ້ໄຂ<br>
• ພັດທະນາລະບົບຢ່າງຕໍ່ເນື່ອງ</p>

<p class="pdpa-para"><strong>4. ການເປີດເຜີຍຂໍ້ມູນ</strong><br>
ຂໍ້ມູນຂອງທ່ານຈະບໍ່ຖືກເປີດເຜີຍຕໍ່ພາຍນອກ ຍົກເວັ້ນຕາມທີ່ກົດໝາຍກຳນົດ
ລະບົບໃຊ້ <strong>Supabase</strong> ທີ່ມີ Row-Level Security (RLS)
— ຜູ້ໃຊ້ແຕ່ລະຄົນເຂົ້າເຖິງໄດ້ສະເພາະຂໍ້ມູນຕົນເອງ</p>

<p class="pdpa-para"><strong>5. ສິດຂອງທ່ານ</strong><br>
• <strong>ສິດຮັບຊາບ</strong> — ຮູ້ວ່າມີການເກັບຂໍ້ມູນຫຍັງ<br>
• <strong>ສິດເຂົ້າເຖິງ</strong> — ຂໍເບິ່ງຂໍ້ມູນຕົນເອງ<br>
• <strong>ສິດແກ້ໄຂ</strong> — ຂໍແກ້ໄຂຂໍ້ມູນທີ່ບໍ່ຖືກຕ້ອງ<br>
• <strong>ສິດລຶບ</strong> — ຂໍລຶບຂໍ້ມູນສ່ວນຕົວ<br>
• <strong>ສິດຄັດຄ້ານ</strong> — ຄັດຄ້ານການປະມວນຜົນ<br>
• <strong>ສິດຖອນຄວາມຍິນຍອມ</strong> — ຖອນໄດ້ທຸກເວລາ</p>

<p class="pdpa-para"><strong>6. ຕິດຕໍ່</strong><br>
ProInventive · ອີເມລ: <a href="mailto:giskku@gmail.com" class="pdpa-link">giskku@gmail.com</a><br>
ການໃຊ້ລະບົບນີ້ຖືວ່າທ່ານຮັບຊາບ ແລະ ຍິນຍອມຕາມນະໂຍບາຍນີ້</p>

<p class="pdpa-para pdpa-note">ຊອຟແວລ໌ນີ້ເປັນຊັບສິນທາງປັນຍາຂອງ ProInventive
ຫ້າມຄັດລອກ, ດັດແປງ, ເຜີຍແຜ່ ຫຼື reverse engineer ໂດຍບໍ່ໄດ້ຮັບອະນຸຍາດ</p>`,
            accept: 'ຂ້າພະເຈົ້າໄດ້ອ່ານ ແລະ ຍອມຮັບນະໂຍບາຍນີ້',
            btn: 'ຍອມຮັບ ແລະ ເຂົ້າລະບົບ'
        }
    };

    /* ── CSS ──────────────────────────────────────────────────────────── */
    const CSS = `
#pdpa-overlay {
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(0,0,0,.72);
    display: flex; align-items: center; justify-content: center;
    padding: 1rem; backdrop-filter: blur(4px);
    font-family: 'Kanit', sans-serif;
}
#pdpa-box {
    background: #fff; border-radius: 16px;
    width: 100%; max-width: 680px;
    max-height: 90vh; display: flex; flex-direction: column;
    box-shadow: 0 24px 64px rgba(0,0,0,.4);
    overflow: hidden;
}
#pdpa-header {
    padding: 1.25rem 1.5rem 0;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
}
#pdpa-header .pdpa-brand {
    display: flex; align-items: center; gap: .5rem; margin-bottom: .75rem;
}
#pdpa-header .pdpa-brand img { height: 28px; width: 28px; object-fit: contain; border-radius: 6px; }
#pdpa-header .pdpa-brand span { font-weight: 700; font-size: .85rem; color: #1e293b; }
#pdpa-title { font-size: 1.15rem; font-weight: 700; color: #1e293b; margin-bottom: .15rem; }
#pdpa-sub   { font-size: .78rem; color: #64748b; margin-bottom: .75rem; }
.pdpa-tabs  { display: flex; gap: .25rem; }
.pdpa-tab {
    padding: .45rem 1rem; border-radius: 8px 8px 0 0; font-size: .82rem;
    font-weight: 600; cursor: pointer; border: none; background: transparent;
    color: #64748b; transition: .15s;
}
.pdpa-tab.active { background: #3b82f6; color: #fff; }
.pdpa-tab:hover:not(.active) { background: #f1f5f9; color: #1e293b; }
#pdpa-body {
    flex: 1; overflow-y: auto; padding: 1.25rem 1.5rem;
    font-size: .875rem; color: #334155; line-height: 1.7;
}
.pdpa-para   { margin-bottom: .9rem; }
.pdpa-link   { color: #3b82f6; text-decoration: underline; }
.pdpa-note   {
    background: #fefce8; border: 1px solid #fde68a;
    border-radius: 8px; padding: .6rem .9rem;
    font-size: .8rem; color: #92400e;
}
#pdpa-footer {
    flex-shrink: 0; padding: 1rem 1.5rem;
    border-top: 1px solid #e2e8f0; background: #f8fafc;
}
#pdpa-check-row {
    display: flex; align-items: flex-start; gap: .6rem;
    margin-bottom: .75rem; cursor: pointer;
}
#pdpa-checkbox { width: 16px; height: 16px; margin-top: 2px; cursor: pointer; flex-shrink: 0; accent-color: #3b82f6; }
#pdpa-check-label { font-size: .84rem; color: #475569; line-height: 1.4; }
#pdpa-accept-btn {
    width: 100%; padding: .7rem 1rem;
    background: #3b82f6; color: #fff; border: none;
    border-radius: 10px; font-family: 'Kanit', sans-serif;
    font-size: .9rem; font-weight: 700; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: .4rem;
    transition: .15s; box-shadow: 0 4px 14px rgba(59,130,246,.35);
}
#pdpa-accept-btn:disabled { background: #cbd5e1; box-shadow: none; cursor: not-allowed; }
#pdpa-accept-btn:not(:disabled):hover { background: #2563eb; }
#pdpa-version { font-size: .68rem; color: #94a3b8; text-align: right; margin-top: .45rem; }
@media (max-width: 480px) {
    #pdpa-box { border-radius: 12px; max-height: 95vh; }
    #pdpa-body { padding: 1rem; }
    .pdpa-tab { padding: .4rem .6rem; font-size: .78rem; }
}`;

    /* ── ฉีด CSS ──────────────────────────────────────────────────────── */
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    /* ── สร้าง DOM ─────────────────────────────────────────────────────── */
    function buildOverlay(lang) {
        const c = CONTENT[lang];
        const tabsHtml = Object.entries(CONTENT).map(([k, v]) =>
            `<button class="pdpa-tab${k === lang ? ' active' : ''}" data-lang="${k}">${v.label}</button>`
        ).join('');

        const el = document.createElement('div');
        el.id = 'pdpa-overlay';
        el.innerHTML = `
<div id="pdpa-box" role="dialog" aria-modal="true" aria-labelledby="pdpa-title">
  <div id="pdpa-header">
    <div class="pdpa-brand">
      <img src="img/pilogo.png" alt="ProInventive"
           onerror="this.style.display='none'">
      <span>Auto Solar Co-pilot Studio</span>
    </div>
    <div id="pdpa-title">${c.title}</div>
    <div id="pdpa-sub">${c.subtitle}</div>
    <div class="pdpa-tabs">${tabsHtml}</div>
  </div>
  <div id="pdpa-body">${c.body}</div>
  <div id="pdpa-footer">
    <label id="pdpa-check-row">
      <input type="checkbox" id="pdpa-checkbox">
      <span id="pdpa-check-label">${c.accept}</span>
    </label>
    <button id="pdpa-accept-btn" disabled>
      <i class="fa-solid fa-shield-check"></i> ${c.btn}
    </button>
    <div id="pdpa-version">ASC Studio · PDPA ${LAST_VER}</div>
  </div>
</div>`;
        return el;
    }

    /* ── เชื่อม events ─────────────────────────────────────────────────── */
    let overlay;

    function switchTab(lang) {
        const c = CONTENT[lang];
        document.getElementById('pdpa-title').textContent   = c.title;
        document.getElementById('pdpa-sub').textContent     = c.subtitle;
        document.getElementById('pdpa-body').innerHTML      = c.body;
        document.getElementById('pdpa-check-label').textContent = c.accept;
        document.getElementById('pdpa-accept-btn').innerHTML =
            `<i class="fa-solid fa-shield-check"></i> ${c.btn}`;
        document.querySelectorAll('.pdpa-tab').forEach(t =>
            t.classList.toggle('active', t.dataset.lang === lang));
        const chk = document.getElementById('pdpa-checkbox');
        chk.checked = false;
        document.getElementById('pdpa-accept-btn').disabled = true;
    }

    function onAccept() {
        try { sessionStorage.setItem(ACCEPT_KEY, LAST_VER); } catch (_) {}
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity .25s';
        setTimeout(() => overlay.remove(), 280);
        /* เปิด login-screen ถ้ามีคลาส asc-booting ค้างอยู่ */
        const ls = document.getElementById('login-screen');
        if (ls) ls.classList.remove('asc-booting');
    }

    /* ── ตรวจว่าเคย accept แล้วหรือยัง ──────────────────────────────── */
    function needsConsent() {
        try { return sessionStorage.getItem(ACCEPT_KEY) !== LAST_VER; } catch (_) { return true; }
    }

    /* ── เข้าสู่ init ─────────────────────────────────────────────────── */
    function init() {
        if (!needsConsent()) return;   // เคย accept ในเซสชันนี้แล้ว

        const defLang = (navigator.language || 'th').startsWith('lo') ? 'lo'
                      : (navigator.language || 'th').startsWith('en') ? 'en' : 'th';

        overlay = buildOverlay(defLang);
        document.body.appendChild(overlay);

        /* tab click */
        overlay.querySelectorAll('.pdpa-tab').forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.lang));
        });

        /* checkbox → enable accept button */
        document.getElementById('pdpa-checkbox').addEventListener('change', function () {
            document.getElementById('pdpa-accept-btn').disabled = !this.checked;
        });

        /* accept button */
        document.getElementById('pdpa-accept-btn').addEventListener('click', onAccept);

        /* ป้องกัน Escape ปิด modal */
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && document.getElementById('pdpa-overlay')) e.preventDefault();
        });
    }

    /* ── รอ DOM โหลด ──────────────────────────────────────────────────── */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    /* ── API สาธารณะ (ใช้ debug ได้) ─────────────────────────────────── */
    window.ASC_PDPA = {
        reset: function () {
            try { sessionStorage.removeItem(ACCEPT_KEY); } catch (_) {}
            location.reload();
        },
        isAccepted: function () { return !needsConsent(); }
    };

})();
