/* ============================================================================
 *  ASC · เอกสารข้อเสนอสำหรับลูกค้า  (Customer Proposal)
 *
 *  ทำไมอยู่ในไฟล์เดียวกับ asc_report แทนที่จะแยกเป็นโปรแกรมใหม่
 *  ------------------------------------------------------------
 *  ข้อเสนอใช้ตัวเลขชุดเดียวกับรายงานทั้งหมด ทั้งผลผลิตพลังงาน การเงิน และอุปกรณ์
 *  ถ้าแยกไฟล์จะต้องนำเข้า DB2/DB3 ซ้ำและคำนวณใหม่ทั้งชุด ซึ่งเสี่ยงที่ตัวเลข
 *  สองเอกสารจะไม่ตรงกันเมื่อแก้สูตรที่เดียวแล้วลืมอีกที่
 *  อยู่ในหน้าเดียวกันจึงอ่าน AppState ได้ตรง ๆ และดึงกราฟจาก canvas ที่วาดไว้แล้ว
 *
 *  ต่างจากรายงานอย่างไร
 *  ------------------------------------------------------------
 *  รายงาน 25 หน้า เป็นเอกสารทางเทคนิค สำหรับวิศวกรและการยื่นแบบ
 *  ข้อเสนอ 6 หน้า เป็นเอกสารทางการค้า สำหรับผู้บริหารที่ตัดสินใจซื้อ
 *  จึงตัดรายละเอียดวิศวกรรมออกหมด เหลือเฉพาะผลลัพธ์ เงิน และสิ่งที่จะได้รับ
 *
 *  สองภาษา
 *  ------------------------------------------------------------
 *  ใช้พจนานุกรมกลาง T.th / T.en ไม่ทำ HTML สองชุด เพราะสองชุดจะค่อย ๆ
 *  ต่างกันจนคุมไม่อยู่ ข้อความไทยกับอังกฤษเขียนแยกกันจริง ไม่ได้แปลตรงตัว
 *  เพราะผู้อ่านไทยคาดหวังคำอธิบาย ส่วนอังกฤษธุรกิจนิยมกระชับ
 * ==========================================================================*/

(function (global) {
    'use strict';

    /* ── พจนานุกรม ────────────────────────────────────────────────────────── */
    const T = {
        th: {
            docTitle: 'ข้อเสนอโครงการ',
            eyebrow: 'ข้อเสนอโครงการ',
            preparedFor: 'จัดทำเพื่อ',
            docNo: 'เลขที่', issued: 'วันที่', validUntil: 'ยืนราคาถึง', preparedBy: 'ผู้จัดทำ',
            coverTitle: (kwp) => `ระบบผลิตไฟฟ้าพลังงานแสงอาทิตย์<br>บนหลังคา ขนาด ${kwp} กิโลวัตต์`,
            coverLede: 'ลดค่าไฟฟ้าของอาคารด้วยพลังงานสะอาดที่ผลิตใช้เอง พร้อมการออกแบบตามมาตรฐาน วสท. และการรับประกันผลผลิตพลังงานตลอดอายุโครงการ',

            p2: 'บทสรุปสำหรับผู้บริหาร',
            kSave: 'ประหยัดค่าไฟต่อปี', kPayback: 'ระยะเวลาคืนทุน',
            kIrr: 'ผลตอบแทนภายใน (IRR)', kCo2: 'ลด CO₂ ต่อปี',
            yrs: 'ปี', tonnes: 'ตัน', baht: 'บาท', mBaht: 'ล้านบาท',

            p3: 'สภาพการใช้ไฟฟ้าปัจจุบัน',
            kUse: 'ใช้ไฟฟ้าต่อปี', kBill: 'ค่าไฟต่อปี', kTariff: 'ค่าไฟเฉลี่ยต่อหน่วย', kCover: 'สัดส่วนที่ทดแทนได้',

            p4: 'ระบบที่นำเสนอ',
            thItem: 'รายการ', thSpec: 'รุ่นและมาตรฐาน', thQty: 'จำนวน',
            eqPv: 'แผงโซลาร์เซลล์', eqInv: 'อินเวอร์เตอร์', eqOpt: 'ออปติไมเซอร์',
            eqBat: 'ระบบกักเก็บพลังงาน', eqProt: 'ระบบป้องกันและเชื่อมต่อ',
            protSpec: 'เบรกเกอร์ DC/AC · กันฟ้าผ่า · ระบบกันไฟย้อน ตามข้อกำหนดการเชื่อมต่อของการไฟฟ้า',
            uPanel: 'แผง', uUnit: 'เครื่อง', uPcs: 'ตัว', uSet: 'ชุด',
            kCap: 'กำลังติดตั้งรวม', kArea: 'พื้นที่หลังคาที่ใช้',

            p5: 'ผลผลิตพลังงานที่คาดการณ์',
            kYield: 'ผลิตได้ต่อปี', kSpecific: 'ผลผลิตจำเพาะ', kPr: 'ประสิทธิภาพรวม (PR)',
            p5lede: 'คำนวณจากข้อมูลรังสีอาทิตย์ของพื้นที่จริง ทิศทางและความลาดเอียงของหลังคา รวมถึงผลกระทบจากอุณหภูมิ ฝุ่น และเงาบังตลอดทั้งปี',

            p6: 'ผลตอบแทนการลงทุน',
            kCapex: 'เงินลงทุนเริ่มต้น', kSave1: 'ประหยัดค่าไฟปีแรก',
            kNet25: 'ประหยัดสะสมตลอด 25 ปี',
            assume: 'สมมติฐาน: ค่าไฟปรับขึ้นเฉลี่ยปีละ 2.5% · แผงเสื่อมสภาพปีละ 0.5%',
            noData: 'ยังไม่มีข้อมูล กรุณานำเข้าไฟล์ DB2/DB3 และกดประมวลผลก่อน'
        },
        en: {
            docTitle: 'Project Proposal',
            eyebrow: 'Project Proposal',
            preparedFor: 'Prepared for',
            docNo: 'Doc. No.', issued: 'Issued', validUntil: 'Valid until', preparedBy: 'Prepared by',
            coverTitle: (kwp) => `${kwp} kWp Rooftop<br>Solar Power System`,
            coverLede: "Reduce your building's electricity cost with clean power generated on site — engineered to EIT standards and backed by a lifetime energy yield guarantee.",

            p2: 'Executive Summary',
            kSave: 'Annual savings', kPayback: 'Payback period',
            kIrr: 'Internal rate of return', kCo2: 'CO₂ avoided per year',
            yrs: 'yrs', tonnes: 't', baht: 'THB', mBaht: 'M THB',

            p3: 'Your Current Electricity Use',
            kUse: 'Annual consumption', kBill: 'Annual electricity cost',
            kTariff: 'Average tariff per kWh', kCover: 'Share met by solar',

            p4: 'Proposed System',
            thItem: 'Item', thSpec: 'Model & standard', thQty: 'Qty',
            eqPv: 'Solar modules', eqInv: 'Inverters', eqOpt: 'Power optimisers',
            eqBat: 'Battery storage', eqProt: 'Protection & interconnection',
            protSpec: 'DC/AC breakers · surge protection · anti-islanding, per utility interconnection requirements',
            uPanel: 'pcs', uUnit: 'units', uPcs: 'pcs', uSet: 'set',
            kCap: 'Installed capacity', kArea: 'Roof area used',

            p5: 'Expected Energy Yield',
            kYield: 'Annual generation', kSpecific: 'Specific yield', kPr: 'Performance ratio',
            p5lede: 'Modelled from site-specific irradiance data, the actual roof orientation and tilt, and year-round temperature, soiling and shading effects.',

            p6: 'Investment Return',
            kCapex: 'Initial investment', kSave1: 'First-year savings',
            kNet25: 'Cumulative savings over 25 years',
            assume: 'Assumptions: 2.5% annual tariff escalation · 0.5% annual module degradation',
            noData: 'No data yet. Please import a DB2/DB3 file and run the simulation first.'
        }
    };

    let LANG = 'th';

    /* ── ตัวช่วย ─────────────────────────────────────────────────────────── */
    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const num = (v, d) => {
        const n = Number(v);
        if (!isFinite(n)) return '-';
        return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    };

    /* วันที่แบบไทยใช้ พ.ศ. อังกฤษใช้ ค.ศ. ตัวเลขใช้อารบิกทั้งคู่ */
    function fmtDate(d, lang) {
        const th = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
        const en = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return lang === 'th'
            ? `${d.getDate()} ${th[d.getMonth()]} ${d.getFullYear() + 543}`
            : `${d.getDate()} ${en[d.getMonth()]} ${d.getFullYear()}`;
    }

    /* ── รวบรวมตัวเลขจากรายงาน ────────────────────────────────────────────
       อ่านจาก AppState ชุดเดียวกับที่รายงานใช้ จึงไม่มีทางที่สองเอกสารจะไม่ตรงกัน */
    function collect() {
        // AppState ประกาศด้วย const ในไฟล์หลัก จึงอยู่ใน global lexical scope ไม่ใช่บน window
        // อ้างชื่อตรง ๆ ได้ แต่ window.AppState จะเป็น undefined เสมอ
        const A  = (typeof AppState !== 'undefined') ? AppState : {};
        const r  = A.results || {};
        const eq = A.equipData || {};
        const c  = eq.counts || {};
        const fin = A.financials || [];

        const gv = (id, fb) => {
            const el = document.getElementById(id);
            if (!el) return fb;
            const v = parseFloat(String(el.value).replace(/,/g, ''));
            return isFinite(v) ? v : fb;
        };
        const gs = (id, fb) => {
            const el = document.getElementById(id);
            return (el && String(el.value).trim()) ? el.value.trim() : fb;
        };

        const kwp    = Number(r.pnom) || 0;
        const yieldY = Number(r.totalEGrid) || 0;
        const tariff = gv('fin-tariff', 4.5);
        const capex  = gv('fin-capex', 0) + gv('fin-capex-bat', 0);
        const save1  = yieldY * tariff;

        // ดึงจากตารางการเงินที่รายงานคำนวณไว้แล้ว ถ้าไม่มีค่อยประมาณเอง
        let payback = null, irr = null, net25 = null;
        if (fin.length) {
            const last = fin[fin.length - 1];
            net25 = Number(last.cumulative ?? last.cum ?? last.cumulativeCashFlow);
            for (let i = 0; i < fin.length; i++) {
                const cum = Number(fin[i].cumulative ?? fin[i].cum ?? fin[i].cumulativeCashFlow);
                if (isFinite(cum) && cum >= 0) { payback = fin[i].year ?? (i + 1); break; }
            }
        }
        if (payback == null && save1 > 0 && capex > 0) payback = capex / save1;

        const txtIrr = document.getElementById('txt-irr');
        if (txtIrr) { const v = parseFloat(txtIrr.innerText); if (isFinite(v)) irr = v; }

        // ค่าไฟทั้งปีของอาคาร จากข้อมูล DB0 ถ้ามี
        const db0 = A.db0Data || {};
        let usage = Number(db0.annualUsage_kWh) || Number(db0.totalKwhPerYear) || 0;
        if (!usage && yieldY && r.pctSelfConsumption) usage = yieldY / (r.pctSelfConsumption / 100);
        const bill = usage * tariff;

        return {
            proj    : gs('inp-proj', '-'),
            loc     : gs('inp-loc', '-'),
            kwp, yieldY, tariff, capex, save1, payback, irr,
            net25   : isFinite(net25) ? net25 : null,
            usage, bill,
            coverage: (usage > 0) ? (yieldY / usage * 100) : null,
            specific: kwp > 0 ? yieldY / kwp : 0,
            // effPR ในรายงานเก็บเป็นสัดส่วน (0.837) ไม่ใช่ร้อยละ
            // แต่บางเส้นทางอาจเก็บมาเป็นร้อยละแล้ว จึงเดาจากขนาดของค่า
            pr      : (function () {
                const v = Number(r.effPR) || 0;
                return (v > 0 && v <= 1.5) ? v * 100 : v;
            })(),
            co2     : yieldY * 0.475 / 1000,
            area    : (A.sysPolygons || []).reduce((s, p) => s + (Number(p.area) || 0), 0),
            monthly : (A.monthlyBalances || []).map(m => Number(m.eGrid) || 0),
            pvModel : (eq.pv && (eq.pv.model || eq.pv.Model_Name)) || '-',
            invModel: (eq.inv1 && (eq.inv1.model || eq.inv1.Model_Name)) || '-',
            optModel: (eq.opt && (eq.opt.model || eq.opt.Model_Name)) || '-',
            batModel: (eq.bat && (eq.bat.model || eq.bat.Model_Name)) || '-',
            nPv : c.totalPanels || 0,
            nInv: (c.inv1Qty || 0) + (c.inv2Qty || 0),
            nOpt: c.optQty || 0,
            nBat: c.batQty || 0
        };
    }

    /* ── ดึงกราฟจากรายงานมาเป็นรูป ────────────────────────────────────────
       Chart.js และ ApexCharts วาดลง canvas อยู่แล้ว จึงแปลงเป็น PNG ได้ตรง ๆ
       ไม่ต้องวาดกราฟใหม่ ทำให้กราฟในข้อเสนอตรงกับในรายงานเสมอ */
    function chartPng(id) {
        const el = document.getElementById(id);
        if (!el) return null;

        // Chart.js วาดลง canvas แต่ถ้าส่วนนั้นถูกซ่อนตามชุดสำเร็จรูป
        // canvas จะกว้าง 0 จับภาพไม่ได้ กรณีนั้นให้คืน null แล้วไปใช้กราฟที่วาดเอง
        const cv = (el.tagName === 'CANVAS') ? el : el.querySelector('canvas');
        if (cv && cv.width > 10) {
            try { return cv.toDataURL('image/png'); } catch (e) { /* ไปลองทางอื่น */ }
        }
        return null;
    }

    /* ── สร้างหน้าเอกสาร ─────────────────────────────────────────────────── */
    function fig(v, unit, label) {
        return `<div class="pp-fig"><div class="pp-v">${v}${unit ? `<em>${unit}</em>` : ''}</div>
                <div class="pp-k">${esc(label)}</div></div>`;
    }

    function render() {
        const t = T[LANG];
        const d = collect();
        const co = (typeof global.ascCompany === 'function') ? global.ascCompany() : {};
        const host = document.getElementById('pp-pages');
        if (!host) return;

        if (!d.kwp) { host.innerHTML = `<div class="pp-empty">${esc(t.noData)}</div>`; return; }

        const now = new Date();
        const validDays = Number((co.profile || {}).validityDays) || 30;
        const until = new Date(now.getTime() + validDays * 86400000);
        const docNo = 'PIV-' + (now.getFullYear() + (LANG === 'th' ? 543 : 0)) + '-' +
                      String(Math.abs(hash(d.proj)) % 10000).padStart(4, '0');

        const pages = [];

        /* ── หน้า 1 · ปก ─────────────────────────────────────────────── */
        pages.push(`
        <section class="pp-sheet">
          <div class="pp-pad">
            ${co.logo || co.name ? `<div class="pp-brand">
              ${co.logo ? `<img src="${esc(co.logo)}" alt="">` : ''}
              <div>${co.name ? `<div class="pp-bn">${esc(co.name)}</div>` : ''}
                   ${co.website ? `<div class="pp-bs">${esc(co.website)}</div>` : ''}</div>
            </div>` : ''}
            <div class="pp-rule"></div>
            <p class="pp-eyebrow">${esc(t.eyebrow)}</p>
            <h2 class="pp-title">${t.coverTitle(num(d.kwp, 2))}</h2>
            <p class="pp-lede">${esc(t.coverLede)}</p>
            <div class="pp-client">
              <span class="pp-lbl">${esc(t.preparedFor)}</span>
              <div class="pp-who">${esc(d.proj)}</div>
              <div class="pp-where">${esc(d.loc)}</div>
            </div>
          </div>
          <dl class="pp-tb">
            <div><dt>${esc(t.docNo)}</dt><dd>${docNo}</dd></div>
            <div><dt>${esc(t.issued)}</dt><dd>${fmtDate(now, LANG)}</dd></div>
            <div><dt>${esc(t.validUntil)}</dt><dd>${fmtDate(until, LANG)}</dd></div>
            <div><dt>${esc(t.preparedBy)}</dt><dd>${esc(co.signer || '-')}</dd></div>
          </dl>
        </section>`);

        /* ── หน้า 2 · บทสรุปผู้บริหาร ─────────────────────────────────── */
        pages.push(`
        <section class="pp-sheet">
          <div class="pp-pad">
            ${head(t.p2, 2)}
            <div class="pp-figs">
              ${fig(num(d.save1, 0), '฿', t.kSave)}
              ${fig(d.payback ? num(d.payback, 1) : '-', t.yrs, t.kPayback)}
              ${fig(d.irr != null ? num(d.irr, 1) : '-', '%', t.kIrr)}
              ${fig(num(d.co2, 1), t.tonnes, t.kCo2)}
            </div>
            <div class="pp-body pp-cols">${execText(t, d)}</div>
          </div>
          ${foot(d, docNo)}
        </section>`);

        /* ── หน้า 3 · การใช้ไฟปัจจุบัน ────────────────────────────────── */
        pages.push(`
        <section class="pp-sheet">
          <div class="pp-pad">
            ${head(t.p3, 3)}
            <div class="pp-figs">
              ${fig(num(d.usage, 0), 'kWh', t.kUse)}
              ${fig(num(d.bill / 1e6, 2), LANG === 'th' ? 'ล้าน฿' : 'M THB', t.kBill)}
              ${fig(num(d.tariff, 2), '฿', t.kTariff)}
              ${fig(d.coverage != null ? num(d.coverage, 0) : '-', '%', t.kCover)}
            </div>
            <div class="pp-body">${usageText(t, d)}</div>
          </div>
          ${foot(d, docNo)}
        </section>`);

        /* ── หน้า 4 · ระบบที่นำเสนอ ───────────────────────────────────── */
        const rows = [];
        rows.push(eqRow(t.eqPv, d.pvModel, d.nPv, t.uPanel));
        rows.push(eqRow(t.eqInv, d.invModel, d.nInv, t.uUnit));
        if (d.nOpt > 0) rows.push(eqRow(t.eqOpt, d.optModel, d.nOpt, t.uPcs));
        if (d.nBat > 0) rows.push(eqRow(t.eqBat, d.batModel, d.nBat, t.uSet));
        rows.push(eqRow(t.eqProt, t.protSpec, 1, t.uSet));

        pages.push(`
        <section class="pp-sheet">
          <div class="pp-pad">
            ${head(t.p4, 4)}
            <table class="pp-tbl">
              <thead><tr><th>${esc(t.thItem)}</th><th>${esc(t.thSpec)}</th><th class="n">${esc(t.thQty)}</th></tr></thead>
              <tbody>${rows.join('')}</tbody>
            </table>
            <div class="pp-figs" style="margin-top:4.4cqw">
              ${fig(num(d.kwp, 2), 'kWp', t.kCap)}
              ${d.area > 0 ? fig(num(d.area, 0), 'm²', t.kArea) : ''}
            </div>
          </div>
          ${foot(d, docNo)}
        </section>`);

        /* ── หน้า 5 · ผลผลิตพลังงาน ───────────────────────────────────── */
        pages.push(`
        <section class="pp-sheet">
          <div class="pp-pad">
            ${head(t.p5, 5)}
            <p class="pp-leadin">${esc(t.p5lede)}</p>
            ${monthlyBars(d) || imgBlock('chart-monthly-chartjs')}
            <div class="pp-figs" style="margin-top:4cqw">
              ${fig(num(d.yieldY, 0), 'kWh', t.kYield)}
              ${fig(num(d.specific, 0), 'kWh/kWp', t.kSpecific)}
              ${fig(num(d.pr, 1), '%', t.kPr)}
            </div>
          </div>
          ${foot(d, docNo)}
        </section>`);

        /* ── หน้า 6 · ผลตอบแทนการลงทุน ───────────────────────────────── */
        pages.push(`
        <section class="pp-sheet">
          <div class="pp-pad">
            ${head(t.p6, 6)}
            ${cashChart(d) || imgBlock('chart-cashflow-apex')}
            <table class="pp-tbl" style="margin-top:3cqw">
              <tbody>
                <tr><td class="it">${esc(t.kCapex)}</td><td class="n">${num(d.capex, 0)} ${esc(t.baht)}</td></tr>
                <tr><td class="it">${esc(t.kSave1)}</td><td class="n">${num(d.save1, 0)} ${esc(t.baht)}</td></tr>
                <tr><td class="it">${esc(t.kPayback)}</td><td class="n">${d.payback ? num(d.payback, 1) : '-'} ${esc(t.yrs)}</td></tr>
                ${d.irr != null ? `<tr><td class="it">${esc(t.kIrr)}</td><td class="n">${num(d.irr, 1)} %</td></tr>` : ''}
                ${d.net25 != null ? `<tr><td class="it hi">${esc(t.kNet25)}</td><td class="n hi">${num(d.net25, 0)} ${esc(t.baht)}</td></tr>` : ''}
              </tbody>
            </table>
            <p class="pp-note">${esc(t.assume)}</p>
          </div>
          ${foot(d, docNo)}
        </section>`);

        host.innerHTML = pages.join('');

        function head(title, n) {
            return `<div class="pp-hd"><h3>${esc(title)}</h3>
                    <span class="pp-pg">${LANG === 'th' ? 'หน้า ' + n : 'Page ' + n}</span></div>`;
        }
        function foot(dd, no) {
            return `<div class="pp-foot"><span>${esc(dd.proj)}</span><span>${no}</span></div>`;
        }
        function imgBlock(id) {
            const src = chartPng(id);
            return src ? `<div class="pp-chart"><img src="${src}" alt=""></div>` : '';
        }
    }

    function eqRow(name, spec, qty, unit) {
        return `<tr><td class="it">${esc(name)}</td><td>${esc(spec)}</td>
                <td class="n">${Number(qty).toLocaleString('en-US')} ${esc(unit)}</td></tr>`;
    }

    function execText(t, d) {
        if (LANG === 'th') {
            return `<p>ระบบที่นำเสนอมีกำลังติดตั้ง <strong>${num(d.kwp, 2)} กิโลวัตต์</strong>
                    ประกอบด้วยแผงโซลาร์ ${num(d.nPv, 0)} แผง คาดว่าจะผลิตไฟฟ้าได้
                    <strong>${num(d.yieldY, 0)} หน่วยต่อปี</strong></p>
                    ${d.coverage != null ? `<p>ปริมาณดังกล่าวคิดเป็นราว <strong>${num(d.coverage, 0)}%</strong>
                    ของการใช้ไฟฟ้าทั้งหมดของอาคาร โดยผลิตในช่วงกลางวันซึ่งตรงกับช่วงที่มีการใช้งานสูงสุดพอดี
                    ทำให้ไฟฟ้าที่ผลิตได้ถูกใช้เองเกือบทั้งหมด</p>` : ''}
                    <p>ระบบออกแบบให้มีประสิทธิภาพรวมที่ <strong>${num(d.pr, 1)}%</strong>
                    โดยคำนวณผลกระทบจากอุณหภูมิ ฝุ่น และเงาบังไว้แล้ว</p>
                    <p>เงินลงทุนรวม <strong>${num(d.capex, 0)} บาท</strong>
                    ${d.payback ? `คืนทุนภายใน ${num(d.payback, 1)} ปี` : ''}
                    ${d.net25 != null ? ` และประหยัดค่าไฟสะสมตลอดอายุโครงการ 25 ปี ราว <strong>${num(d.net25 / 1e6, 1)} ล้านบาท</strong>` : ''}</p>`;
        }
        return `<p>The proposed system has an installed capacity of <strong>${num(d.kwp, 2)} kWp</strong>,
                comprising ${num(d.nPv, 0)} modules, with expected generation of
                <strong>${num(d.yieldY, 0)} kWh per year</strong>.</p>
                ${d.coverage != null ? `<p>This covers approximately <strong>${num(d.coverage, 0)}%</strong>
                of total consumption. Because generation peaks during daytime hours — precisely when demand
                is highest — nearly all output is consumed on site.</p>` : ''}
                <p>The system is designed to achieve a <strong>${num(d.pr, 1)}%</strong> performance ratio,
                with temperature, soiling and shading losses already accounted for.</p>
                <p>Total investment is <strong>THB ${num(d.capex, 0)}</strong>
                ${d.payback ? `, recovered within ${num(d.payback, 1)} years` : ''}
                ${d.net25 != null ? `, with cumulative savings of approximately <strong>THB ${num(d.net25 / 1e6, 1)} million</strong> over the 25-year life` : ''}.</p>`;
    }

    function usageText(t, d) {
        if (LANG === 'th') {
            return `<p>จากข้อมูลการใช้ไฟฟ้า อาคารของท่านใช้ไฟ ${num(d.usage, 0)} หน่วยต่อปี
                    คิดเป็นค่าไฟ ${num(d.bill, 0)} บาท และการใช้งานกระจุกตัวในเวลากลางวัน
                    ซึ่งเป็นเงื่อนไขที่เหมาะกับระบบโซลาร์มากที่สุด
                    <strong>ไฟที่ผลิตได้จะถูกใช้ทันทีในอาคาร ไม่ต้องขายคืนในราคาต่ำ</strong></p>`;
        }
        return `<p>Your building consumes ${num(d.usage, 0)} kWh per year at a cost of
                THB ${num(d.bill, 0)}. Demand is concentrated during daylight hours — the condition under
                which solar performs best. <strong>Energy produced is consumed on site immediately,
                rather than exported at a lower rate.</strong></p>`;
    }

    /* กราฟรายเดือนสำรอง ใช้เมื่อดึงจาก canvas ของรายงานไม่ได้ */
    function monthlyBars(d) {
        if (!d.monthly.length) return '';
        const mx = Math.max.apply(null, d.monthly) || 1;
        const th = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
        const en = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const lbl = LANG === 'th' ? th : en;
        const bars = d.monthly.map((v, i) =>
            `<div class="pp-b"><b>${num(v / 1000, 1)}</b><i style="height:${(v / mx * 100).toFixed(1)}%"></i></div>`).join('');
        return `<div class="pp-bars">${bars}</div>
                <div class="pp-months">${lbl.map(m => `<span>${m}</span>`).join('')}</div>`;
    }

    /* กราฟกระแสเงินสดสะสม วาดเองจาก AppState.financials
       ใช้โทนสีของเอกสารข้อเสนอ ไม่ใช่สีของแดชบอร์ด และทำงานได้เสมอ
       ไม่ขึ้นกับว่าส่วนนั้นในรายงานถูกซ่อนอยู่หรือไม่ */
    function cashChart(d) {
        const A = (typeof AppState !== 'undefined') ? AppState : {};
        const fin = A.financials || [];
        if (fin.length < 2) return '';

        const pts = fin.map(function (row, i) {
            const cum = Number(row.cumulative != null ? row.cumulative
                        : (row.cum != null ? row.cum : row.cumulativeCashFlow));
            return { y: isFinite(cum) ? cum : 0, x: Number(row.year != null ? row.year : i + 1) };
        });
        const W = 700, H = 250, L = 62, Rr = 14, Tp = 18, B = 42;
        const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
        const x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
        const y0 = Math.min(0, Math.min.apply(null, ys)), y1 = Math.max.apply(null, ys);
        const px = (x) => L + (x - x0) / Math.max(1e-9, x1 - x0) * (W - L - Rr);
        const py = (y) => Tp + (y1 - y) / Math.max(1e-9, y1 - y0) * (H - Tp - B);

        const line = pts.map((p, i) => (i ? 'L' : 'M') + px(p.x).toFixed(1) + ' ' + py(p.y).toFixed(1)).join(' ');
        const area = line + ' L' + px(x1).toFixed(1) + ' ' + py(0).toFixed(1) +
                     ' L' + px(x0).toFixed(1) + ' ' + py(0).toFixed(1) + ' Z';

        // จุดคืนทุน คือปีแรกที่ยอดสะสมเป็นบวก
        let bp = null;
        for (let i = 0; i < pts.length; i++) if (pts[i].y >= 0) { bp = pts[i]; break; }

        const mBaht = (v) => (v / 1e6).toFixed(1);
        const lbl = LANG === 'th' ? 'ปีที่' : 'Year';
        const bpTxt = bp ? (LANG === 'th' ? 'คืนทุน ปีที่ ' + bp.x : 'Break-even · year ' + bp.x) : '';

        return '<div class="pp-chart pp-cash"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img">' +
            '<line class="g" x1="' + L + '" y1="' + py(y1).toFixed(1) + '" x2="' + (W - Rr) + '" y2="' + py(y1).toFixed(1) + '"/>' +
            '<path class="a" d="' + area + '"/>' +
            '<path class="l" d="' + line + '"/>' +
            '<line class="z" x1="' + L + '" y1="' + py(0).toFixed(1) + '" x2="' + (W - Rr) + '" y2="' + py(0).toFixed(1) + '"/>' +
            (bp ? '<circle class="p" cx="' + px(bp.x).toFixed(1) + '" cy="' + py(0).toFixed(1) + '" r="4"/>' +
                  '<text x="' + (px(bp.x) + 8).toFixed(1) + '" y="' + (py(0) - 8).toFixed(1) + '">' + esc(bpTxt) + '</text>' : '') +
            '<text x="6" y="' + (py(y1) + 4).toFixed(1) + '">+' + mBaht(y1) + 'M</text>' +
            '<text x="6" y="' + (py(0) + 4).toFixed(1) + '">0</text>' +
            (y0 < 0 ? '<text x="6" y="' + (py(y0)).toFixed(1) + '">' + mBaht(y0) + 'M</text>' : '') +
            '<text x="' + (L - 6) + '" y="' + (H - 16) + '">' + x0 + '</text>' +
            '<text x="' + (W - Rr - 10) + '" y="' + (H - 16) + '">' + x1 + '</text>' +
            '<text x="' + (W / 2 - 14) + '" y="' + (H - 3) + '">' + esc(lbl) + '</text>' +
            '</svg></div>';
    }

    function hash(s) {
        let h = 0;
        for (let i = 0; i < String(s).length; i++) h = ((h << 5) - h + String(s).charCodeAt(i)) | 0;
        return h;
    }

    /* ── ส่งออก ─────────────────────────────────────────────────────────── */
    function exportPDF() {
        render();
        document.body.classList.add('pp-printing');
        const title = document.title;
        const d = collect();
        document.title = (typeof global.ascFileStamp === 'function')
            ? global.ascFileStamp(d.proj, 'proposal_' + LANG.toUpperCase())
            : 'proposal';
        setTimeout(function () {
            global.print();
            document.body.classList.remove('pp-printing');
            document.title = title;
        }, 500);
    }

    global.AscProposal = {
        setLang(l) { LANG = (l === 'en') ? 'en' : 'th'; render(); return LANG; },
        getLang()  { return LANG; },
        render, collect, exportPDF, chartPng,
        _T: T
    };

})(window);
