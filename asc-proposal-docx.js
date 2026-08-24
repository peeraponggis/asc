/* ============================================================================
 *  ASC · ส่งออกเอกสารข้อเสนอเป็นไฟล์ Word (.docx)
 *
 *  ทำไมต้องเป็น .docx จริง ไม่ใช่ HTML ที่ตั้งนามสกุลเป็น .doc
 *  ------------------------------------------------------------
 *  วิธี HTML-ตั้งชื่อ-.doc ไม่ต้องใช้ไลบรารีเลยก็จริง แต่ Word มักไม่แสดง
 *  รูปที่ฝังมาเป็น base64 ผลคือได้เอกสารที่ข้อความครบแต่กราฟหายหมด
 *  ซึ่งแย่กว่าไม่มีไฟล์ Word ให้เลย เพราะผู้ใช้จะไม่รู้ว่ารูปหาย
 *
 *  ไฟล์ .docx คือไฟล์ zip ที่มี XML ไม่กี่ไฟล์ จึงประกอบเองได้ด้วย JSZip
 *  ตัวเดียว (~100 KB) ไม่ต้องใช้ไลบรารี docx เต็มตัวที่หนักกว่าสิบเท่า
 *
 *  ข้อจำกัดที่ยอมรับ
 *  ------------------------------------------------------------
 *  ต้องต่ออินเทอร์เน็ตเพื่อโหลด JSZip ถ้าโหลดไม่ได้ ปุ่มจะบอกให้ใช้ PDF แทน
 *  ซึ่ง PDF ไม่พึ่งไลบรารีใดเลย ใช้ window.print() ของเบราว์เซอร์
 * ==========================================================================*/

(function (global) {
    'use strict';

    if (!global.AscProposal) return;

    const P = global.AscProposal;
    const XE = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

    /* หน่วยใน OOXML : ความยาวเป็น twip (1/1440 นิ้ว) รูปเป็น EMU (1/914400 นิ้ว) */
    const EMU = 914400;
    const PAGE_W_TWIP = 11906;          // A4 กว้าง 210 มม.
    const MARGIN_TWIP = 1134;           // ขอบ 20 มม.
    const CONTENT_W_EMU = Math.round((PAGE_W_TWIP - MARGIN_TWIP * 2) / 1440 * EMU);

    let media = [];                     // รูปที่จะฝังลงไฟล์
    let relId = 0;

    function addImage(dataUrl) {
        const m = /^data:image\/(png|jpeg);base64,(.+)$/.exec(dataUrl || '');
        if (!m) return null;
        relId++;
        const name = 'image' + relId + '.' + (m[1] === 'jpeg' ? 'jpg' : 'png');
        media.push({ name: name, b64: m[2], rid: 'rId' + (100 + relId) });
        return media[media.length - 1];
    }

    /* ── ตัวสร้างย่อหน้าและตาราง ─────────────────────────────────────────── */
    function run(text, o) {
        o = o || {};
        const rpr = '<w:rPr>' +
            '<w:rFonts w:ascii="Sarabun" w:hAnsi="Sarabun" w:cs="Sarabun"/>' +
            (o.b ? '<w:b/><w:bCs/>' : '') +
            (o.color ? '<w:color w:val="' + o.color + '"/>' : '') +
            '<w:sz w:val="' + (o.size || 22) + '"/><w:szCs w:val="' + (o.size || 22) + '"/>' +
            (o.caps ? '<w:caps/>' : '') +
            '</w:rPr>';
        return '<w:r>' + rpr + '<w:t xml:space="preserve">' + XE(text) + '</w:t></w:r>';
    }

    function para(runs, o) {
        o = o || {};
        const ppr = '<w:pPr>' +
            (o.align ? '<w:jc w:val="' + o.align + '"/>' : '') +
            '<w:spacing w:before="' + (o.before || 0) + '" w:after="' + (o.after == null ? 120 : o.after) + '" w:line="' + (o.line || 276) + '" w:lineRule="auto"/>' +
            (o.border ? '<w:pBdr><w:bottom w:val="single" w:sz="12" w:color="0B2233"/></w:pBdr>' : '') +
            '</w:pPr>';
        return '<w:p>' + ppr + (Array.isArray(runs) ? runs.join('') : runs) + '</w:p>';
    }

    function heading(text) {
        return para(run(text, { b: true, size: 30, color: '0B2233' }), { after: 80, border: true, before: 200 });
    }

    function imagePara(dataUrl, widthFrac) {
        const im = addImage(dataUrl);
        if (!im) return '';
        const w = Math.round(CONTENT_W_EMU * (widthFrac || 1));
        const h = Math.round(w * 0.52);
        return '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="160"/></w:pPr><w:r><w:drawing>' +
            '<wp:inline distT="0" distB="0" distL="0" distR="0">' +
            '<wp:extent cx="' + w + '" cy="' + h + '"/>' +
            '<wp:docPr id="' + im.rid.slice(3) + '" name="' + im.name + '"/>' +
            '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
            '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
            '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
            '<pic:nvPicPr><pic:cNvPr id="' + im.rid.slice(3) + '" name="' + im.name + '"/><pic:cNvPicPr/></pic:nvPicPr>' +
            '<pic:blipFill><a:blip r:embed="' + im.rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
            '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + w + '" cy="' + h + '"/></a:xfrm>' +
            '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
            '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
    }

    function table(rows, widths) {
        const grid = widths.map(w => '<w:gridCol w:w="' + w + '"/>').join('');
        const body = rows.map(function (r, ri) {
            const cells = r.cells.map(function (c, ci) {
                return '<w:tc><w:tcPr><w:tcW w:w="' + widths[ci] + '" w:type="dxa"/>' +
                    '<w:tcBorders><w:bottom w:val="single" w:sz="4" w:color="D9DFE4"/></w:tcBorders>' +
                    '<w:vAlign w:val="top"/></w:tcPr>' +
                    para(run(c.t, { b: r.head || c.b, size: 20, color: c.color }),
                         { after: 60, align: c.right ? 'right' : null }) +
                    '</w:tc>';
            }).join('');
            return '<w:tr>' + (r.head ? '<w:trPr><w:tblHeader/></w:trPr>' : '') + cells + '</w:tr>';
        }).join('');
        return '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>' +
            '<w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>' + grid + '</w:tblGrid>' + body + '</w:tbl>';
    }

    const pageBreak = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

    /* ── ประกอบเนื้อหาเอกสาร ────────────────────────────────────────────── */
    function buildBody() {
        const lang = P.getLang();
        const t = P._T[lang];
        const d = P.collect();
        const co = (typeof global.ascCompany === 'function') ? global.ascCompany() : {};
        const N = (v, dec) => Number(v).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
        const out = [];

        /* ปก */
        if (co.logo) { const p = imagePara(co.logo, 0.28); if (p) out.push(p); }
        if (co.name) out.push(para(run(co.name, { b: true, size: 26, color: '0B2233' }), { after: 40 }));
        if (co.address) out.push(para(run(co.address, { size: 18, color: '5A6B78' }), { after: 240 }));

        out.push(para(run(t.eyebrow.toUpperCase(), { b: true, size: 18, color: 'B8862F' }), { after: 120 }));
        out.push(para(run(t.coverTitle(N(d.kwp, 2)).replace(/<br>/g, ' '), { b: true, size: 44, color: '0B2233' }), { after: 160 }));
        out.push(para(run(t.coverLede, { size: 22, color: '16394F' }), { after: 320 }));
        out.push(para(run(t.preparedFor.toUpperCase(), { b: true, size: 16, color: '5A6B78' }), { after: 60 }));
        out.push(para(run(d.proj, { b: true, size: 28 }), { after: 40 }));
        out.push(para(run(d.loc, { size: 20, color: '5A6B78' }), { after: 240 }));

        const now = new Date();
        const validDays = Number((co.profile || {}).validityDays) || 30;
        const until = new Date(now.getTime() + validDays * 86400000);
        const fd = (dt) => lang === 'th'
            ? dt.getDate() + '/' + (dt.getMonth() + 1) + '/' + (dt.getFullYear() + 543)
            : dt.getDate() + '/' + (dt.getMonth() + 1) + '/' + dt.getFullYear();
        out.push(table([
            { head: true, cells: [{ t: t.issued }, { t: t.validUntil }, { t: t.preparedBy }] },
            { cells: [{ t: fd(now) }, { t: fd(until) }, { t: co.signer || '-' }] }
        ], [2900, 2900, 3000]));

        /* บทสรุปผู้บริหาร */
        out.push(pageBreak, heading(t.p2));
        out.push(table([
            { head: true, cells: [{ t: t.kSave }, { t: t.kPayback }, { t: t.kIrr }, { t: t.kCo2 }] },
            { cells: [
                { t: N(d.save1, 0) + ' ' + t.baht, b: true },
                { t: (d.payback ? N(d.payback, 1) : '-') + ' ' + t.yrs, b: true },
                { t: (d.irr != null ? N(d.irr, 1) : '-') + ' %', b: true },
                { t: N(d.co2, 1) + ' ' + t.tonnes, b: true }
            ] }
        ], [2200, 2200, 2200, 2200]));
        out.push(para([], { after: 160 }));
        stripHtml(execParas(lang, d, N, t)).forEach(x => out.push(para(run(x, { size: 21, color: '16394F' }))));

        /* การใช้ไฟปัจจุบัน */
        out.push(pageBreak, heading(t.p3));
        out.push(table([
            { head: true, cells: [{ t: t.kUse }, { t: t.kBill }, { t: t.kTariff }, { t: t.kCover }] },
            { cells: [
                { t: N(d.usage, 0) + ' kWh', b: true },
                { t: N(d.bill, 0) + ' ' + t.baht, b: true },
                { t: N(d.tariff, 2) + ' ' + t.baht, b: true },
                { t: (d.coverage != null ? N(d.coverage, 0) : '-') + ' %', b: true }
            ] }
        ], [2200, 2200, 2200, 2200]));
        out.push(para([], { after: 160 }));
        const daily = P.chartPng('chart-daily-chartjs');
        if (daily) out.push(imagePara(daily, 1));

        /* ระบบที่นำเสนอ */
        out.push(pageBreak, heading(t.p4));
        const eqRows = [{ head: true, cells: [{ t: t.thItem }, { t: t.thSpec }, { t: t.thQty, right: true }] }];
        eqRows.push({ cells: [{ t: t.eqPv, b: true }, { t: d.pvModel }, { t: N(d.nPv, 0) + ' ' + t.uPanel, right: true }] });
        eqRows.push({ cells: [{ t: t.eqInv, b: true }, { t: d.invModel }, { t: N(d.nInv, 0) + ' ' + t.uUnit, right: true }] });
        if (d.nOpt > 0) eqRows.push({ cells: [{ t: t.eqOpt, b: true }, { t: d.optModel }, { t: N(d.nOpt, 0) + ' ' + t.uPcs, right: true }] });
        if (d.nBat > 0) eqRows.push({ cells: [{ t: t.eqBat, b: true }, { t: d.batModel }, { t: N(d.nBat, 0) + ' ' + t.uSet, right: true }] });
        eqRows.push({ cells: [{ t: t.eqProt, b: true }, { t: t.protSpec }, { t: '1 ' + t.uSet, right: true }] });
        out.push(table(eqRows, [2400, 4600, 1800]));

        /* ผลผลิตพลังงาน */
        out.push(pageBreak, heading(t.p5));
        out.push(para(run(t.p5lede, { size: 21, color: '16394F' }), { after: 200 }));
        const monthly = P.chartPng('chart-monthly-chartjs');
        if (monthly) out.push(imagePara(monthly, 1));
        out.push(table([
            { head: true, cells: [{ t: t.kYield }, { t: t.kSpecific }, { t: t.kPr }] },
            { cells: [
                { t: N(d.yieldY, 0) + ' kWh', b: true },
                { t: N(d.specific, 0) + ' kWh/kWp', b: true },
                { t: N(d.pr, 1) + ' %', b: true }
            ] }
        ], [2950, 2950, 2950]));

        /* ผลตอบแทน */
        out.push(pageBreak, heading(t.p6));
        const cash = P.chartPng('chart-cashflow-apex');
        if (cash) out.push(imagePara(cash, 1));
        const finRows = [
            { cells: [{ t: t.kCapex, b: true }, { t: N(d.capex, 0) + ' ' + t.baht, right: true }] },
            { cells: [{ t: t.kSave1, b: true }, { t: N(d.save1, 0) + ' ' + t.baht, right: true }] },
            { cells: [{ t: t.kPayback, b: true }, { t: (d.payback ? N(d.payback, 1) : '-') + ' ' + t.yrs, right: true }] }
        ];
        if (d.irr != null) finRows.push({ cells: [{ t: t.kIrr, b: true }, { t: N(d.irr, 1) + ' %', right: true }] });
        if (d.net25 != null) finRows.push({ cells: [{ t: t.kNet25, b: true, color: 'B8862F' }, { t: N(d.net25, 0) + ' ' + t.baht, right: true, b: true, color: 'B8862F' }] });
        out.push(table(finRows, [5400, 3400]));
        out.push(para(run(t.assume, { size: 17, color: '5A6B78' }), { before: 200 }));

        return out.join('');
    }

    function execParas(lang, d, N, t) {
        if (lang === 'th') {
            return [
                `ระบบที่นำเสนอมีกำลังติดตั้ง ${N(d.kwp, 2)} กิโลวัตต์ ประกอบด้วยแผงโซลาร์ ${N(d.nPv, 0)} แผง คาดว่าจะผลิตไฟฟ้าได้ ${N(d.yieldY, 0)} หน่วยต่อปี`,
                d.coverage != null ? `ปริมาณดังกล่าวคิดเป็นราว ${N(d.coverage, 0)}% ของการใช้ไฟฟ้าทั้งหมดของอาคาร โดยผลิตในช่วงกลางวันซึ่งตรงกับช่วงที่มีการใช้งานสูงสุดพอดี ทำให้ไฟฟ้าที่ผลิตได้ถูกใช้เองเกือบทั้งหมด` : '',
                `ระบบออกแบบให้มีประสิทธิภาพรวมที่ ${N(d.pr, 1)}% โดยคำนวณผลกระทบจากอุณหภูมิ ฝุ่น และเงาบังไว้แล้ว`,
                `เงินลงทุนรวม ${N(d.capex, 0)} บาท${d.payback ? ` คืนทุนภายใน ${N(d.payback, 1)} ปี` : ''}${d.net25 != null ? ` และประหยัดค่าไฟสะสมตลอดอายุโครงการ 25 ปี ราว ${N(d.net25 / 1e6, 1)} ล้านบาท` : ''}`
            ].filter(Boolean);
        }
        return [
            `The proposed system has an installed capacity of ${N(d.kwp, 2)} kWp, comprising ${N(d.nPv, 0)} modules, with expected generation of ${N(d.yieldY, 0)} kWh per year.`,
            d.coverage != null ? `This covers approximately ${N(d.coverage, 0)}% of total consumption. Because generation peaks during daytime hours — precisely when demand is highest — nearly all output is consumed on site.` : '',
            `The system is designed to achieve a ${N(d.pr, 1)}% performance ratio, with temperature, soiling and shading losses already accounted for.`,
            `Total investment is THB ${N(d.capex, 0)}${d.payback ? `, recovered within ${N(d.payback, 1)} years` : ''}${d.net25 != null ? `, with cumulative savings of approximately THB ${N(d.net25 / 1e6, 1)} million over the 25-year life` : ''}.`
        ].filter(Boolean);
    }

    function stripHtml(arr) {
        return arr.map(x => String(x).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()).filter(Boolean);
    }

    /* ── ไฟล์ประกอบของ .docx ────────────────────────────────────────────── */
    function documentXml(body) {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
        'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">' +
        '<w:body>' + body +
        '<w:sectPr><w:pgSz w:w="' + PAGE_W_TWIP + '" w:h="16838"/>' +
        '<w:pgMar w:top="' + MARGIN_TWIP + '" w:right="' + MARGIN_TWIP + '" w:bottom="' + MARGIN_TWIP +
        '" w:left="' + MARGIN_TWIP + '" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>' +
        '</w:body></w:document>';
    }

    function relsXml() {
        const extra = media.map(m =>
            '<Relationship Id="' + m.rid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/' + m.name + '"/>'
        ).join('');
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        extra + '</Relationships>';
    }

    function contentTypes() {
        const png = media.some(m => /\.png$/.test(m.name));
        const jpg = media.some(m => /\.jpg$/.test(m.name));
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        (png ? '<Default Extension="png" ContentType="image/png"/>' : '') +
        (jpg ? '<Default Extension="jpg" ContentType="image/jpeg"/>' : '') +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        '</Types>';
    }

    const ROOT_RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
        '</Relationships>';

    /* ── ปุ่มส่งออก ─────────────────────────────────────────────────────── */
    P.exportDOCX = async function () {
        if (typeof JSZip === 'undefined') {
            alert('โหลดไลบรารีสร้างไฟล์ Word ไม่สำเร็จ (ต้องต่ออินเทอร์เน็ต)\n\nกรุณาใช้ปุ่ม "ส่งออก PDF" แทน ซึ่งใช้งานได้โดยไม่ต้องต่อเน็ต');
            return;
        }
        const d = P.collect();
        if (!d.kwp) { alert('ยังไม่มีข้อมูล กรุณานำเข้าไฟล์ DB2/DB3 และกดประมวลผลก่อน'); return; }

        const btn = document.getElementById('pp-docx-btn');
        const old = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> กำลังสร้าง...'; }

        try {
            media = []; relId = 0;
            const body = buildBody();          // ต้องเรียกก่อน เพราะเป็นตัวเก็บรายการรูป

            const zip = new JSZip();
            zip.file('[Content_Types].xml', contentTypes());
            zip.folder('_rels').file('.rels', ROOT_RELS);
            const w = zip.folder('word');
            w.file('document.xml', documentXml(body));
            w.folder('_rels').file('document.xml.rels', relsXml());
            if (media.length) {
                const mf = w.folder('media');
                media.forEach(m => mf.file(m.name, m.b64, { base64: true }));
            }

            const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
            const name = (typeof global.ascFileStamp === 'function')
                ? global.ascFileStamp(d.proj, 'proposal_' + P.getLang().toUpperCase())
                : 'proposal';
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = name + '.docx';
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        } catch (e) {
            console.error('สร้างไฟล์ Word ไม่สำเร็จ', e);
            alert('สร้างไฟล์ Word ไม่สำเร็จ : ' + e.message + '\n\nกรุณาใช้ปุ่มส่งออก PDF แทน');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = old; }
        }
    };

})(window);
