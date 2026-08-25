/* ============================================================================
 *  ASC · ตัวตรวจแบบ (ASC Advisor)
 *
 *  แนวคิด
 *  ------------------------------------------------------------
 *  ตรวจแบบด้วยกฎที่เขียนตรงๆ ไม่ใช้โมเดลภาษา ทุกข้อสรุปคำนวณจากตัวเลขในไฟล์
 *  จึงตรวจสอบย้อนกลับได้ ให้ผลเหมือนเดิมทุกครั้ง ทำงานออฟไลน์ และไม่มีวันแต่งตัวเลข
 *
 *  ข้อนี้สำคัญเพราะเอกสารที่ออกไปหาลูกค้ามีผลผูกพัน สิ่งที่ตัวช่วยบอกจึงต้อง
 *  พิสูจน์ได้ทุกบรรทัด ทุกข้อที่รายงานจะแนบตัวเลขที่ใช้ตัดสินมาด้วยเสมอ
 *
 *  กฎทั้งหมดในไฟล์นี้มาจากปัญหาที่เจอจริงในโครงการ ไม่ได้คิดขึ้นลอยๆ
 *
 *  ระดับความสำคัญ
 *    error  ผิดแน่ ต้องแก้ก่อนส่งงาน
 *    warn   ควรตรวจสอบ อาจตั้งใจก็ได้
 *    info   ข้อสังเกต ไม่ใช่ปัญหา
 *    ok     ตรวจแล้วผ่าน แสดงเพื่อยืนยันว่าตรวจครบ
 * ==========================================================================*/

(function (global) {
    'use strict';

    const num = (v, d) => { const n = parseFloat(v); return isFinite(n) ? n : (d === undefined ? null : d); };
    const fmt = (v, d) => (v === null || v === undefined || !isFinite(v)) ? '—' : Number(v).toFixed(d === undefined ? 2 : d);

    /* ── ดึงข้อมูลที่ต้องใช้ออกจากไฟล์ DB2/DB3 ให้อยู่ในรูปเดียวกัน ─────
       รองรับทั้งการเรียกจาก asc_report ที่มี AppState อยู่แล้ว
       และการเรียกด้วยไฟล์ DB2 ดิบๆ จากที่อื่น */
    function normalize(input) {
        const src = input || {};
        const b = src.base_layout_db1 || (src.db2 && src.db2.base_layout_db1) || null;

        if (b) {
            const s1 = b.step1_initialization || {};
            const s2 = b.step2_equipment || {};
            const s3 = b.step3_design_and_layout || {};
            const s4 = b.step4_validation_results || {};
            const s7 = b.step7_simulation_params || {};
            const sim = src.simulation_params_db2 || {};
            return {
                projectName: s1.projectName || '',
                coords: String(s1.coordinates || ''),
                pv: s2.pv || {}, inv1: s2.inv1 || {}, inv2: s2.inv2 || {}, opt: s2.opt || {},
                industrial: s2.industrial_settings || {},
                polys: s3.roofPolygons || [],
                mapFeatures: (b.mapGeoJSON && b.mapGeoJSON.features) || [],
                counts: s4.equipmentCounts || {},
                kwp: num(s4.totalDcCapacity_kWp),
                dcac: num(s4.dcAcRatio),
                strings: s4.stringConfiguration_EIT_Standard || {},
                bom: s4.engineering_and_bom || {},
                losses: sim.losses || {},
                simParams: s7,
                mount: sim.mountingPosition || s3.mountType || '',
                results: src.results || null
            };
        }
        // เรียกจาก asc_report โดยตรง (AppState)
        return {
            projectName: src.projectName || '',
            coords: String(src.coords || ''),
            pv: (src.equipData && src.equipData.pv) || {},
            inv1: (src.equipData && src.equipData.inv1) || {},
            inv2: (src.equipData && src.equipData.inv2) || {},
            opt: (src.equipData && src.equipData.opt) || {},
            industrial: (src.equipData && src.equipData.industrial_settings) || {},
            polys: src.sysPolygons || [],
            mapFeatures: [],
            counts: src.counts || {},
            kwp: num(src.kwp),
            dcac: num(src.dcac),
            strings: src.stringConfig || {},
            bom: src.bomData || {},
            losses: src.losses || {},
            simParams: src.simulationParams || {},
            mount: src.sysMountType || '',
            results: src.results || null
        };
    }

    /* ทิศแบบเข็มทิศ ระยะห่างเชิงมุมที่สั้นที่สุดจากทิศใต้ (180) */
    const offSouth = a => {
        const x = ((num(a, 0) % 360) + 360) % 360;
        return Math.min(Math.abs(x - 180), 360 - Math.abs(x - 180));
    };

    /* ดึงจำนวนแผงต่อสตริงออกจากข้อความอย่าง "INV1 (3 MPPT): 24 แผง"

       ห้ามใช้วิธีลบอักขระที่ไม่ใช่ตัวเลขทิ้งทั้งหมด เพราะจะได้ 1324 จากการต่อ
       เลข 1 กับ 3 กับ 24 เข้าด้วยกัน ซึ่งทำให้การตรวจแรงดันสตริงผิดพลาดร้ายแรง
       ต้องหยิบเฉพาะตัวเลขที่อยู่ติดหน้าคำว่าแผง ซึ่งเป็นค่าที่ต้องการจริง */
    function panelsPerString(text) {
        const s = String(text || '');
        let m = s.match(/(\d+)\s*(?:แผง|panels?|modules?)/i);
        if (m) return parseInt(m[1], 10);
        m = s.match(/(\d+)(?!.*\d)/);            // ไม่มีหน่วยกำกับ ใช้ตัวเลขตัวสุดท้าย
        return m ? parseInt(m[1], 10) : NaN;
    }

    /* ── ชุดกฎ ───────────────────────────────────────────────────────────
       แต่ละกฎคืน finding หนึ่งข้อ หรือ null ถ้าไม่มีข้อมูลพอจะตัดสิน
       การไม่มีข้อมูลพอ ต้องเงียบ ไม่ใช่เดา */
    const RULES = [

    /* ---- ไฟฟ้า ---- */
    {
        id: 'dcac',
        run(d) {
            let r = d.dcac;
            if (r === null) {
                const ac = num(d.inv1.Rated_AC_Output_Power_kW) * num(d.inv1.qty, 1)
                         + num(d.inv2.Rated_AC_Output_Power_kW, 0) * num(d.inv2.qty, 0);
                if (!d.kwp || !ac) return null;
                r = d.kwp / ac;
            }
            const acTotal = num(d.inv1.Rated_AC_Output_Power_kW, 0) * num(d.inv1.qty, 1)
                          + num(d.inv2.Rated_AC_Output_Power_kW, 0) * num(d.inv2.qty, 0);
            const ev = 'DC ' + fmt(d.kwp, 1) + ' kWp ÷ AC ' + fmt(acTotal, 1) + ' kW = ' + fmt(r, 2);
            if (r > 1.4) {
                const need = Math.ceil(d.kwp / 1.3 / Math.max(num(d.inv1.Rated_AC_Output_Power_kW, 1), 1));
                return { level: 'error', title: 'DC/AC สูงเกินไป อินเวอร์เตอร์จะตัดยอดกำลัง',
                    detail: 'อัตราส่วน ' + fmt(r, 2) + ' เกินช่วงที่นิยม 1.1–1.3 มาก พลังงานช่วงกลางวันที่แดดแรงจะถูกตัดทิ้ง และค่า PR จะตกลงชัดเจน',
                    evidence: ev,
                    fix: ['เพิ่มอินเวอร์เตอร์เป็น ' + need + ' ตัว เพื่อให้ DC/AC ลงมาที่ราว 1.3',
                          'หรือลดจำนวนแผงลงเหลือราว ' + fmt(acTotal * 1.3, 0) + ' kWp',
                          'ถ้าตั้งใจให้ตัดยอดกำลังเพื่อประหยัดค่าอินเวอร์เตอร์ ให้ระบุไว้ในรายงานว่าเป็นการเลือกโดยตั้งใจ'],
                    kb: 'dcac-ratio' };
            }
            if (r > 1.3) return { level: 'warn', title: 'DC/AC ค่อนข้างสูง',
                detail: 'อัตราส่วน ' + fmt(r, 2) + ' อยู่เหนือช่วงที่นิยม จะมีการตัดยอดกำลังบ้างในวันที่แดดแรง',
                evidence: ev, fix: ['ตรวจว่าเป็นการเลือกโดยตั้งใจหรือไม่'], kb: 'dcac-ratio' };
            if (r < 0.9) return { level: 'warn', title: 'DC/AC ต่ำ อินเวอร์เตอร์ใหญ่เกินความจำเป็น',
                detail: 'อัตราส่วน ' + fmt(r, 2) + ' แปลว่าลงทุนค่าอินเวอร์เตอร์เกินกว่าที่แผงจะใช้ได้',
                evidence: ev, fix: ['ลดขนาดหรือจำนวนอินเวอร์เตอร์', 'หรือเพิ่มแผงถ้าพื้นที่ยังเหลือ'], kb: 'dcac-ratio' };
            return { level: 'ok', title: 'DC/AC อยู่ในเกณฑ์', detail: 'อัตราส่วน ' + fmt(r, 2), evidence: ev, kb: 'dcac-ratio' };
        }
    },

    {
        id: 'voc-cold',
        run(d) {
            const voc = num(d.pv.Voc_V), tk = num(d.pv.Tk_Voc_Pct_Per_C), vmax = num(d.inv1.Max_DC_Input_Voltage_V);
            const perStr = panelsPerString(d.strings.maxPanelsPerString);
            if (!voc || !tk || !vmax || !perStr) return null;

            /* ระบบที่ใช้ Power Optimizer หรือ Micro-inverter คิดแบบนี้ไม่ได้
               แรงดันของสตริงถูกกำหนดโดยตัวออปติไมเซอร์ ไม่ใช่ผลรวมแรงดันของแผง
               ถ้าเอาสูตรบวก Voc มาใช้ จะได้ตัวเลขที่สูงเกินจริงมากและเตือนผิด
               ต้องไปดูตารางความยาวสตริงของผู้ผลิตออปติไมเซอร์แทน */
            const optQty = num(d.opt.qty, 0);
            if (optQty > 0) {
                const optV = num(d.opt.Max_Output_Voltage_V);
                return { level: 'info', title: 'ระบบใช้ Power Optimizer แรงดันสตริงไม่ได้มาจากผลรวม Voc ของแผง',
                    detail: 'ออปติไมเซอร์ควบคุมแรงดันขาออกของแต่ละจุด ความยาวสตริงจึงถูกจำกัดด้วยข้อกำหนดของผู้ผลิต ' +
                            'ไม่ใช่ด้วยการบวกแรงดันแผงตามอุณหภูมิ ระบบจึงข้ามการตรวจข้อนี้ให้ และต้องตรวจกับตารางของผู้ผลิตเอง',
                    evidence: 'ออปติไมเซอร์ ' + (d.opt.Model_Name || '-') +
                              ' จำนวน ' + fmt(optQty, 0) + ' ตัว · แผงต่อตัว ' + (d.opt.ratio || '-') +
                              (optV ? ' · แรงดันขาออกสูงสุด ' + fmt(optV, 0) + ' V' : ''),
                    fix: ['ตรวจความยาวสตริงกับตารางของผู้ผลิตออปติไมเซอร์',
                          'ตรวจว่าจำนวนออปติไมเซอร์ต่อสตริงอยู่ในช่วงต่ำสุดถึงสูงสุดที่กำหนด'],
                    kb: 'voc-cold' };
            }
            const TMIN = 15;                       // ค่าอนุรักษ์นิยมสำหรับภาคกลางและภาคใต้
            const vocCold = voc * (1 + (tk / 100) * (TMIN - 25));
            const total = vocCold * perStr;
            const pct = total / vmax * 100;
            const ev = 'Voc ' + fmt(voc) + ' V · Tk ' + fmt(tk) + ' %/°C · ที่ ' + TMIN + ' °C = ' + fmt(vocCold) +
                       ' V × ' + perStr + ' แผง = ' + fmt(total, 1) + ' V เทียบพิกัด ' + fmt(vmax, 0) + ' V';
            if (total > vmax) return { level: 'error', title: 'แรงดันสตริงตอนอากาศเย็นเกินพิกัดอินเวอร์เตอร์',
                detail: 'คำนวณที่ ' + TMIN + ' °C ได้ ' + fmt(total, 1) + ' V ซึ่งเกิน ' + fmt(vmax, 0) + ' V เป็นเรื่องความปลอดภัย ไม่ใช่ประสิทธิภาพ',
                evidence: ev,
                fix: ['ลดจำนวนแผงต่อสตริงลงเหลือไม่เกิน ' + Math.floor(vmax / vocCold) + ' แผง',
                      'ถ้าไซต์อยู่ภาคเหนือหรืออีสานบน ต้องคำนวณใหม่ที่ 8–10 °C ซึ่งจะยิ่งเข้มกว่านี้'],
                kb: 'voc-cold' };
            if (pct > 95) return { level: 'warn', title: 'แรงดันสตริงตอนอากาศเย็นใกล้ชนพิกัด',
                detail: 'ใช้ไปแล้ว ' + fmt(pct, 1) + ' % ของพิกัด เหลือเผื่อน้อย',
                evidence: ev, fix: ['พิจารณาลดจำนวนแผงต่อสตริงลงหนึ่งแผ่นเพื่อความปลอดภัย'], kb: 'voc-cold' };
            return { level: 'ok', title: 'แรงดันสตริงตอนอากาศเย็นอยู่ในพิกัด',
                detail: fmt(total, 1) + ' V คิดเป็น ' + fmt(pct, 1) + ' % ของพิกัด', evidence: ev, kb: 'voc-cold' };
        }
    },

    {
        id: 'mppt-window',
        run(d) {
            const vmp = num(d.pv.Vmp_V), vmin = num(d.inv1.MPPT_Voltage_Min_V);
            const perStr = panelsPerString(d.strings.minPanelsPerString);
            if (!vmp || !vmin || !perStr) return null;
            if (num(d.opt.qty, 0) > 0) return null;   // ใช้ออปติไมเซอร์ แรงดันไม่ได้มาจากผลรวมของแผง
            // แผงร้อนจัดกลางวัน Vmp ตกลงราว 15 % เทียบกับสภาวะมาตรฐาน
            const vmpHot = vmp * 0.85;
            const total = vmpHot * perStr;
            const ev = 'Vmp ' + fmt(vmp) + ' V · แผงร้อนประมาณ ' + fmt(vmpHot) + ' V × ' + perStr +
                       ' แผง = ' + fmt(total, 1) + ' V เทียบ MPPT ขั้นต่ำ ' + fmt(vmin, 0) + ' V';
            if (total < vmin) return { level: 'error', title: 'แรงดันสตริงตอนแผงร้อนต่ำกว่าช่วง MPPT',
                detail: 'สตริงที่สั้นที่สุดให้ ' + fmt(total, 1) + ' V ซึ่งต่ำกว่า ' + fmt(vmin, 0) + ' V อินเวอร์เตอร์จะหลุดจากจุดกำลังสูงสุดในวันที่ร้อนจัด',
                evidence: ev, fix: ['เพิ่มจำนวนแผงต่อสตริงเป็นอย่างน้อย ' + Math.ceil(vmin / vmpHot) + ' แผง'],
                kb: 'mppt-window' };
            return { level: 'ok', title: 'แรงดันสตริงอยู่ในช่วง MPPT',
                detail: fmt(total, 1) + ' V สูงกว่าขั้นต่ำ ' + fmt(vmin, 0) + ' V', evidence: ev, kb: 'mppt-window' };
        }
    },

    /* ---- ทิศทางและมุมเอียง ---- */
    {
        id: 'azimuth',
        run(d) {
            if (!d.polys.length) return null;
            const worst = d.polys.map(p => ({ id: p.id, off: offSouth(p.azimuth), tilt: num(p.slope, 0) }))
                                 .sort((x, y) => y.off - x.off)[0];
            const ev = d.polys.map(p => 'หลังคา ' + p.id + ' ทิศ ' + Math.round(((num(p.azimuth,0)%360)+360)%360) +
                                        '° เอียง ' + fmt(p.slope, 1) + '°').join(' · ');

            /* ทิศมีผลมากหรือน้อย ขึ้นกับมุมเอียงด้วย ไม่ได้ขึ้นกับทิศอย่างเดียว
               แผงที่วางเกือบราบ รับแสงจากทั่วท้องฟ้าใกล้เคียงกันทุกทิศ การหันผิดทิศ
               จึงแทบไม่เสียอะไร ถ้าเตือนโดยดูแต่ทิศ จะไปเตือนผิดกับหลังคาแบนที่ออกแบบ
               มาถูกต้องแล้ว ซึ่งทำให้ผู้ใช้เลิกเชื่อคำเตือนทั้งหมด */
            if (worst.tilt < 10) {
                return { level: 'ok', title: 'ทิศของหลังคาไม่ใช่ประเด็น เพราะแผงวางเกือบราบ',
                    detail: 'มุมเอียงเพียง ' + fmt(worst.tilt, 1) + '° แผงรับแสงใกล้เคียงกันทุกทิศ ถึงจะเบี่ยงจากทิศใต้ ' +
                            Math.round(worst.off) + '° ก็เสียพลังงานน้อยมาก',
                    evidence: ev, kb: 'azimuth-thailand' };
            }
            if (worst.off > 120) return { level: 'warn', title: 'มีหลังคาหันไปทางทิศเหนือ',
                detail: 'หลังคา ' + worst.id + ' เบี่ยงจากทิศใต้ ' + Math.round(worst.off) + '° ที่มุมเอียง ' +
                        fmt(worst.tilt, 1) + '° ซึ่งได้พลังงานน้อยกว่าหันทิศใต้อย่างมีนัยสำคัญ',
                evidence: ev,
                fix: ['ตรวจว่าทิศถูกต้องจริง โดยเปิดลูกศรทิศลาดในหน้าออกแบบเทียบกับภาพถ่ายดาวเทียม',
                      'ถ้าเป็นหลังคาจั่ว ให้ตรวจว่าไม่ได้กลายเป็นรางน้ำจากการสลับทิศผิดผืน'],
                kb: 'azimuth-thailand' };
            if (worst.off > 60) return { level: 'info', title: 'มีหลังคาหันออกจากทิศใต้พอสมควร',
                detail: 'หลังคา ' + worst.id + ' เบี่ยงจากทิศใต้ ' + Math.round(worst.off) + '° พบได้ปกติเมื่อยึดตามแนวอาคาร',
                evidence: ev, kb: 'azimuth-thailand' };
            return { level: 'ok', title: 'ทิศของหลังคาอยู่ในเกณฑ์ดี',
                detail: 'เบี่ยงจากทิศใต้มากที่สุด ' + Math.round(worst.off) + '°', evidence: ev, kb: 'azimuth-thailand' };
        }
    },

    {
        id: 'tilt',
        run(d) {
            if (!d.polys.length) return null;
            const tilts = d.polys.map(p => num(p.slope, 0));
            const lo = Math.min.apply(null, tilts), hi = Math.max.apply(null, tilts);
            const ev = d.polys.map(p => 'หลังคา ' + p.id + ' เอียง ' + fmt(p.slope, 1) + '°').join(' · ');
            if (lo < 5) return { level: 'warn', title: 'มุมเอียงต่ำมาก ฝุ่นจะสะสมเร็ว',
                detail: 'มุมต่ำสุด ' + fmt(lo, 1) + '° น้ำฝนไหลไม่แรงพอจะชะฝุ่นออก ค่าสูญเสียจากคราบสกปรกจะสูงกว่าปกติ',
                evidence: ev, fix: ['เพิ่มรอบการล้างแผง หรือพิจารณาระบบล้างอัตโนมัติ',
                                    'ตรวจว่าค่า Soiling Loss ที่กรอกไว้สอดคล้องกับมุมนี้'], kb: 'tilt-thailand' };
            if (hi > 25) return { level: 'warn', title: 'มุมเอียงชัน ต้องตรวจการยึดโครงสร้าง',
                detail: 'มุมสูงสุด ' + fmt(hi, 1) + '° เพิ่มแรงลมยกอย่างมีนัยสำคัญ',
                evidence: ev, fix: ['ตรวจการยึดโครงสร้างและจำนวนจุดยึดกับวิศวกรโครงสร้าง'], kb: 'tilt-thailand' };
            return { level: 'ok', title: 'มุมเอียงอยู่ในเกณฑ์',
                detail: 'ช่วง ' + fmt(lo, 1) + '° ถึง ' + fmt(hi, 1) + '°', evidence: ev, kb: 'tilt-thailand' };
        }
    },

    {
        id: 'ridge-eave',
        run(d) {
            if (!d.polys.length) return null;
            const bad = d.polys.filter(p => {
                const e = num(p.eaveHeight_m), r = num(p.ridgeHeight_m);
                return e !== null && r !== null && r < e - 0.005;
            });
            if (bad.length) return { level: 'warn', title: 'มีหลังคาที่สันต่ำกว่าชายคา',
                detail: 'พบ ' + bad.length + ' ผืน ซึ่งเป็นหลังคาลาดกลับด้าน ถ้าไม่ได้ตั้งใจทำปีกผีเสื้อ แปลว่ากรอกค่าสลับกัน',
                evidence: bad.map(p => 'หลังคา ' + p.id + ' ชายคา ' + fmt(p.eaveHeight_m) + ' ม. สัน ' + fmt(p.ridgeHeight_m) + ' ม.').join(' · '),
                fix: ['ตรวจว่ากรอกความสูงสลับช่องกันหรือไม่', 'ถ้าตั้งใจทำปีกผีเสื้อ ไม่ต้องแก้'], kb: 'per-roof-values' };
            return { level: 'ok', title: 'ความสูงสันและชายคาสมเหตุสมผลทุกผืน',
                detail: d.polys.length + ' ผืน', evidence: '', kb: 'per-roof-values' };
        }
    },

    {
        id: 'gable-valley',
        run(d) {
            if (d.polys.length < 2) return null;
            // ใช้ขอบเขตพิกัดจริงถ้ามี เพื่อรู้ว่าหลังคาผืนไหนอยู่ตรงไหนของไซต์
            const withWorld = d.polys.filter(p => (p.worldBoundary || []).length >= 3);
            if (withWorld.length < 2) return null;
            const cen = p => {
                const w = p.worldBoundary;
                return { x: w.reduce((s, q) => s + q.x, 0) / w.length, y: w.reduce((s, q) => s + q.y, 0) / w.length };
            };
            const valleys = [];
            for (let i = 0; i < withWorld.length; i++) {
                for (let j = i + 1; j < withWorld.length; j++) {
                    const A = withWorld[i], B = withWorld[j];
                    const ca = cen(A), cb = cen(B);
                    const dist = Math.hypot(ca.x - cb.x, ca.y - cb.y);
                    if (dist > 60) continue;              // ไกลเกินกว่าจะเป็นหลังคาที่ต่อกัน
                    const bAB = (Math.atan2(cb.x - ca.x, cb.y - ca.y) * 180 / Math.PI + 360) % 360;
                    const dev = (x, y) => { const t = Math.abs(((x - y + 540) % 360) - 180); return t; };
                    const aTo = dev(num(A.azimuth, 0), bAB) < 90;
                    const bTo = dev(num(B.azimuth, 0), (bAB + 180) % 360) < 90;
                    if (aTo && bTo) valleys.push({ a: A.id, b: B.id, aa: A.azimuth, ba: B.azimuth });
                }
            }
            if (valleys.length) return { level: 'warn', title: 'มีหลังคาที่ชายคาชนกัน (รางน้ำ) ไม่ใช่สันชนกัน',
                detail: 'หลังคาที่วางติดกันลาดเข้าหากัน ซึ่งเป็นรางน้ำหรือปีกผีเสื้อ ถ้าตั้งใจทำจั่วแปลว่าทิศของสองผืนสลับกันอยู่',
                evidence: valleys.map(v => 'หลังคา ' + v.a + ' (' + Math.round(v.aa) + '°) ↔ ' + v.b + ' (' + Math.round(v.ba) + '°)').join(' · '),
                fix: ['เปิดลูกศรทิศลาดในหน้าออกแบบเพื่อดูด้วยตา',
                      'ถ้าตั้งใจทำจั่ว กดปุ่มแก้ให้เป็นจั่ว ซึ่งสลับทิศทั้งสองผืนพร้อมกัน',
                      'สลับผืนเดียวจะได้เพิงแหงนต่อเนื่อง ไม่ใช่จั่ว'],
                kb: 'gable-vs-valley' };
            return { level: 'ok', title: 'ทิศของหลังคาที่ติดกันสอดคล้องกัน',
                detail: 'ตรวจ ' + withWorld.length + ' ผืน ไม่พบคู่ที่ชายคาชนกัน', evidence: '', kb: 'gable-vs-valley' };
        }
    },

    /* ---- เงาบัง ---- */
    {
        id: 'shading',
        run(d) {
            const ls = num(d.losses && d.losses.shading);
            const v = (ls !== null) ? ls : num(d.results && d.results.loss_Shading);
            if (v === null) return null;
            const ev = 'สูญเสียจากเงาบังทั้งปี ' + fmt(v, 2) + ' %';
            if (v >= 5) return { level: 'error', title: 'สูญเสียจากเงาบังสูงเกินเกณฑ์',
                detail: fmt(v, 2) + ' % ต่อปี ควรแก้ไข เพราะเงาที่บังแผงเพียงแผ่นเดียวทำให้ทั้งสตริงเสียกำลัง',
                evidence: ev,
                fix: ['จัดสตริงใหม่ ให้แผงที่โดนบังช่วงเวลาเดียวกันอยู่สตริงเดียวกัน',
                      'ย้ายหรือลดแผงในโซนที่โดนบังหนัก',
                      'ติด Power Optimizer เฉพาะสตริงที่มีปัญหา',
                      'ตัดแต่งกิ่งไม้ที่ควบคุมได้'],
                kb: 'shading-loss' };
            if (v >= 2) return { level: 'warn', title: 'สูญเสียจากเงาบังอยู่ในระดับที่ควรตรวจสอบ',
                detail: fmt(v, 2) + ' % ต่อปี ยอมรับได้ แต่ควรตรวจการจัดสตริง',
                evidence: ev, fix: ['ตรวจว่าแผงในโซนเงาไม่ได้พ่วงอยู่กับแผงที่ไม่ถูกบัง'], kb: 'shading-loss' };
            return { level: 'ok', title: 'สูญเสียจากเงาบังอยู่ในเกณฑ์ดี', detail: fmt(v, 2) + ' % ต่อปี', evidence: ev, kb: 'shading-loss' };
        }
    },

    {
        id: 'tree-growth',
        run(d) {
            const trees = d.mapFeatures.filter(f => f.properties && f.properties.drawMode === 'tree');
            if (!trees.length) return null;
            const noGrow = trees.filter(t => !num((t.properties.treeData || {}).growth_m, 0));
            if (noGrow.length) return { level: 'warn', title: 'มีต้นไม้ที่ยังไม่ได้เผื่อการเติบโต',
                detail: 'พบต้นไม้ ' + trees.length + ' ต้น โดย ' + noGrow.length + ' ต้นตั้งค่าเผื่อโตเป็นศูนย์ ระบบมีอายุใช้งาน 25 ปี ต้นไม้จะสูงขึ้นมากในช่วงเวลานั้น',
                evidence: trees.map((t, i) => 'ต้นที่ ' + (i + 1) + ' สูง ' + fmt((t.properties.treeData || {}).height_m, 1) +
                          ' ม. เผื่อโต ' + fmt((t.properties.treeData || {}).growth_m, 1) + ' ม.').join(' · '),
                fix: ['กรอกค่าเผื่อโตอย่างน้อยสำหรับ 10 ปี ไม้โตเร็ว 1–2 ม./ปี ไม้ทั่วไป 0.3–0.8 ม./ปี',
                      'ถ้าต้นไม้อยู่นอกเขตที่ควบคุมได้ ให้ระบุความเสี่ยงนี้ในเอกสารเสนอราคา'],
                kb: 'tree-growth' };
            return { level: 'ok', title: 'ต้นไม้ทุกต้นเผื่อการเติบโตไว้แล้ว', detail: trees.length + ' ต้น', evidence: '', kb: 'tree-growth' };
        }
    },

    /* ---- ค่าสูญเสียและสมรรถนะ ---- */
    {
        id: 'pr',
        run(d) {
            let pr = num(d.results && d.results.effPR);
            if (pr === null) return null;
            if (pr > 0 && pr <= 1.5) pr = pr * 100;        // บางที่เก็บเป็นสัดส่วน
            const ev = 'Performance Ratio ' + fmt(pr, 1) + ' %';
            if (pr < 70) return { level: 'error', title: 'Performance Ratio ต่ำกว่าเกณฑ์',
                detail: fmt(pr, 1) + ' % ระบบบนหลังคาที่ออกแบบดีควรได้ 75–82 % ต้องหาสาเหตุก่อนส่งรายงาน',
                evidence: ev,
                fix: ['ตรวจ DC/AC ว่าสูงเกินจนตัดยอดกำลังหรือไม่',
                      'ตรวจการสูญเสียจากเงาบัง',
                      'ตรวจว่าค่าสูญเสียที่กรอกไว้สูงผิดปกติหรือไม่',
                      'ถ้าเป็นผลจากการเลือกออกแบบโดยตั้งใจ ให้อธิบายไว้ในรายงาน'],
                kb: 'pr-benchmark' };
            if (pr < 75) return { level: 'warn', title: 'Performance Ratio ค่อนข้างต่ำ',
                detail: fmt(pr, 1) + ' % ต่ำกว่าช่วงที่ควรได้เล็กน้อย', evidence: ev,
                fix: ['ไล่ดูรายการสูญเสียในแผนภาพ Loss Diagram ว่าก้อนไหนใหญ่ผิดปกติ'], kb: 'pr-benchmark' };
            return { level: 'ok', title: 'Performance Ratio อยู่ในเกณฑ์', detail: fmt(pr, 1) + ' %', evidence: ev, kb: 'pr-benchmark' };
        }
    },

    {
        id: 'soiling',
        run(d) {
            const s = num(d.simParams.soilingLoss);
            if (s === null) return null;
            const tilts = d.polys.map(p => num(p.slope, 0));
            const lo = tilts.length ? Math.min.apply(null, tilts) : null;
            const ev = 'Soiling Loss ที่กรอก ' + fmt(s, 1) + ' %' + (lo !== null ? ' · มุมเอียงต่ำสุด ' + fmt(lo, 1) + '°' : '');
            if (s < 2) return { level: 'warn', title: 'ค่าสูญเสียจากคราบสกปรกต่ำผิดปกติ',
                detail: 'กรอกไว้ ' + fmt(s, 1) + ' % ซึ่งต่ำกว่าที่พบจริงในไทย ตัวเลขผลตอบแทนในรายงานจะสูงเกินจริง',
                evidence: ev, fix: ['พื้นที่ทั่วไปใช้ 2–3 % เขตอุตสาหกรรมใช้ 4–6 %'], kb: 'soiling-thailand' };
            if (lo !== null && lo < 10 && s < 4) return { level: 'warn', title: 'มุมเอียงต่ำแต่ตั้งค่าฝุ่นไว้น้อย',
                detail: 'มุม ' + fmt(lo, 1) + '° น้ำฝนชะฝุ่นได้ไม่ดี แต่ตั้ง Soiling ไว้เพียง ' + fmt(s, 1) + ' %',
                evidence: ev, fix: ['เพิ่มค่าเป็น 4–6 % หรือวางแผนล้างแผงถี่ขึ้น'], kb: 'soiling-thailand' };
            return { level: 'ok', title: 'ค่าสูญเสียจากคราบสกปรกสมเหตุสมผล', detail: fmt(s, 1) + ' %', evidence: ev, kb: 'soiling-thailand' };
        }
    },

    {
        id: 'bifacial',
        run(d) {
            const isBi = String(d.pv.Is_Bifacial || '').toLowerCase() === 'true';
            if (!isBi) return null;
            const gc = num(d.simParams.groundClearance_m);
            const ev = 'แผงสองหน้า Bifaciality ' + fmt(d.pv.Bifaciality_Factor, 2) +
                       (gc !== null ? ' · ระยะยกแผง ' + fmt(gc, 2) + ' ม.' : '');
            return { level: 'info', title: 'ใช้แผงสองหน้า ต้องตรวจค่า Albedo และระยะยกแผง',
                detail: 'ผลที่ได้จากด้านหลังขึ้นกับสีของผิวหลังคาและระยะยกแผง ถ้ายกต่ำกว่า 20 ซม. แทบไม่ได้ประโยชน์',
                evidence: ev,
                fix: ['หลังคาเมทัลชีทสีอ่อนใช้ Albedo 0.5–0.7 สีเข้มใช้ 0.1–0.2',
                      'ถ้ายกแผงต่ำ ให้ทบทวนว่าคุ้มกับส่วนต่างราคาแผงสองหน้าหรือไม่'],
                kb: 'bifacial' };
        }
    },

    /* ---- ผังและพื้นที่ ---- */
    {
        id: 'edge-setback',
        run(d) {
            const cm = num(d.simParams.innerEdgeGapCm);
            let v = cm;
            if (v === null && d.polys.length) {
                const pc = d.polys[0].panelConfig || {};
                if (num(pc.innerEdgeGapM) !== null) v = num(pc.innerEdgeGapM) * 100;
            }
            if (v === null) return null;
            const ev = 'ระยะเว้นขอบด้านใน ' + fmt(v, 0) + ' ซม.';
            if (v < 60) return { level: 'warn', title: 'ระยะเว้นขอบหลังคาน้อยกว่าแนวปฏิบัติทั่วไป',
                detail: 'ตั้งไว้ ' + fmt(v, 0) + ' ซม. แนวปฏิบัติทั่วไปคืออย่างน้อย 60–100 ซม. เพื่อการตรวจสอบ การดับเพลิง และลดแรงลมยกที่ขอบ',
                evidence: ev, fix: ['เพิ่มระยะเว้นขอบ หรือยืนยันกับเจ้าของอาคารและผู้รับประกันภัยว่ายอมรับได้'],
                kb: 'edge-setback' };
            return { level: 'ok', title: 'ระยะเว้นขอบหลังคาอยู่ในแนวปฏิบัติ', detail: fmt(v, 0) + ' ซม.', evidence: ev, kb: 'edge-setback' };
        }
    },

    {
        id: 'panel-count-match',
        run(d) {
            const fromLayout = d.polys.reduce((s, p) => s + ((p.customLayout || []).length), 0);
            const declared = num(d.counts.totalPanels);
            if (!fromLayout || declared === null) return null;
            const ev = 'ผังมี ' + fromLayout + ' แผง · ระบุไว้ ' + declared + ' แผง';
            if (fromLayout !== declared) return { level: 'warn', title: 'จำนวนแผงในผังไม่ตรงกับที่ระบุไว้',
                detail: 'ต่างกัน ' + Math.abs(fromLayout - declared) + ' แผง อาจเกิดจากปรับผังแล้วยังไม่ได้กดคำนวณใหม่',
                evidence: ev, fix: ['กลับไปที่หน้าออกแบบ กดประมวลผลใหม่ แล้วส่งออก DB2 อีกครั้ง'], kb: 'file-flow' };
            return { level: 'ok', title: 'จำนวนแผงในผังตรงกับที่ระบุ', detail: declared + ' แผง', evidence: ev, kb: 'file-flow' };
        }
    },

    {
        id: 'optimizer-count',
        run(d) {
            const q = num(d.opt.qty, 0);
            if (!q) return null;
            const ratio = num(d.opt.ratio, 1) || 1;
            const panels = num(d.counts.totalPanels);
            if (panels === null) return null;
            const need = Math.ceil(panels / ratio);
            const ev = 'แผง ' + panels + ' แผ่น ÷ ' + ratio + ' แผงต่อตัว = ต้องใช้ ' + need + ' ตัว · ระบุไว้ ' + q + ' ตัว';
            if (q < need) return { level: 'error', title: 'จำนวน Power Optimizer ไม่พอกับจำนวนแผง',
                detail: 'ขาดไป ' + (need - q) + ' ตัว แผงส่วนที่ไม่มีออปติไมเซอร์จะต่อเข้าระบบไม่ได้',
                evidence: ev, fix: ['เพิ่มจำนวนออปติไมเซอร์เป็น ' + need + ' ตัว'], kb: 'shading-loss' };
            if (q > need) return { level: 'warn', title: 'จำนวน Power Optimizer เกินความจำเป็น',
                detail: 'เกินมา ' + (q - need) + ' ตัว เป็นต้นทุนที่ไม่ได้ใช้',
                evidence: ev, fix: ['ปรับจำนวนลงเหลือ ' + need + ' ตัว'], kb: 'shading-loss' };
            return { level: 'ok', title: 'จำนวน Power Optimizer สอดคล้องกับจำนวนแผง',
                detail: q + ' ตัว สำหรับ ' + panels + ' แผง', evidence: ev, kb: 'shading-loss' };
        }
    },

    {
        id: 'mppt-current',
        run(d) {
            if (num(d.opt.qty, 0) > 0) return null;      // ออปติไมเซอร์ควบคุมกระแสเอง
            const isc = num(d.pv.Isc_A), imax = num(d.inv1.Max_Input_Current_MPPT_A);
            const mppts = num(d.inv1.Number_of_MPPTs) * Math.max(num(d.inv1.qty, 1), 1);
            const nStr = parseInt(String(d.strings.totalStringsUsed || '').replace(/[^\d]/g, ''), 10);
            if (!isc || !imax || !mppts || !nStr) return null;
            const perM = nStr / mppts;
            const cur = Math.ceil(perM) * isc;
            const ev = nStr + ' สตริง ÷ ' + mppts + ' ช่อง MPPT = ' + fmt(perM, 1) +
                       ' สตริงต่อช่อง × Isc ' + fmt(isc) + ' A = ' + fmt(cur, 1) + ' A เทียบพิกัด ' + fmt(imax, 1) + ' A';
            if (cur > imax) return { level: 'error', title: 'กระแสขาเข้าต่อช่อง MPPT เกินพิกัดอินเวอร์เตอร์',
                detail: 'ต่อสตริงขนานเข้าช่องเดียวกันมากเกินไป กระแสรวม ' + fmt(cur, 1) + ' A เกิน ' + fmt(imax, 1) + ' A',
                evidence: ev,
                fix: ['ลดจำนวนสตริงต่อช่องเหลือไม่เกิน ' + Math.floor(imax / isc) + ' สตริง',
                      'หรือเพิ่มจำนวนอินเวอร์เตอร์เพื่อให้มีช่อง MPPT มากขึ้น'], kb: 'mppt-current' };
            if (Math.abs(perM - Math.round(perM)) > 0.01) return { level: 'info', title: 'จำนวนสตริงกระจายลงช่อง MPPT ไม่เท่ากัน',
                detail: 'ช่องที่รับสตริงมากกว่าจะร้อนกว่าและเป็นตัวจำกัดสมรรถนะของทั้งเครื่อง',
                evidence: ev, fix: ['ปรับจำนวนสตริงให้หารลงตัวกับจำนวนช่อง MPPT ถ้าทำได้'], kb: 'mppt-current' };
            return { level: 'ok', title: 'กระแสขาเข้าต่อช่อง MPPT อยู่ในพิกัด',
                detail: fmt(cur, 1) + ' A จากพิกัด ' + fmt(imax, 1) + ' A', evidence: ev, kb: 'mppt-current' };
        }
    },

    {
        id: 'ac-breaker',
        run(d) {
            const iac = num(d.inv1.Max_AC_Output_Current_A) * Math.max(num(d.inv1.qty, 1), 1);
            const brk = num(d.bom.protection && d.bom.protection.ac_breaker_amp);
            if (!iac || !brk) return null;
            const need = iac * 1.25;
            const ev = 'กระแสขาออกอินเวอร์เตอร์ ' + fmt(iac, 0) + ' A × 1.25 = ต้องใช้อย่างน้อย ' +
                       fmt(need, 0) + ' A · เลือกไว้ ' + fmt(brk, 0) + ' A';
            if (brk < need) return { level: 'error', title: 'เบรกเกอร์ฝั่งไฟสลับเล็กกว่าที่มาตรฐานกำหนด',
                detail: 'ระบบโซลาร์จัดเป็นโหลดต่อเนื่อง ต้องใช้ตัวคูณ 1.25 เบรกเกอร์จะตัดขณะใช้งานปกติ',
                evidence: ev, fix: ['เปลี่ยนเป็นเบรกเกอร์ขนาดอย่างน้อย ' + fmt(Math.ceil(need / 5) * 5, 0) + ' A'],
                kb: 'breaker-sizing' };
            if (brk > need * 1.6) return { level: 'warn', title: 'เบรกเกอร์ฝั่งไฟสลับใหญ่เกินไป',
                detail: 'เบรกเกอร์ที่ใหญ่เกินจะไม่ตัดวงจรก่อนที่สายจะร้อนเกินพิกัด ต้องตรวจว่าสายรับกระแสได้ถึงพิกัดเบรกเกอร์',
                evidence: ev, fix: ['ตรวจความสามารถนำกระแสของสายเทียบกับพิกัดเบรกเกอร์'], kb: 'breaker-sizing' };
            return { level: 'ok', title: 'ขนาดเบรกเกอร์ฝั่งไฟสลับเหมาะสม',
                detail: fmt(brk, 0) + ' A จากที่ต้องการอย่างน้อย ' + fmt(need, 0) + ' A', evidence: ev, kb: 'breaker-sizing' };
        }
    },

    {
        id: 'dc-breaker',
        run(d) {
            const isc = num(d.pv.Isc_A);
            const brk = num(d.bom.protection && d.bom.protection.dc_breaker_amp);
            if (!isc || !brk) return null;
            const need = isc * 1.25;
            const ev = 'Isc ของแผง ' + fmt(isc) + ' A × 1.25 = ต้องใช้อย่างน้อย ' + fmt(need, 1) +
                       ' A · เลือกไว้ ' + fmt(brk, 0) + ' A';
            if (brk < need) return { level: 'error', title: 'อุปกรณ์ป้องกันฝั่งไฟตรงเล็กกว่าที่มาตรฐานกำหนด',
                detail: 'ต้องไม่น้อยกว่า 1.25 เท่าของกระแสลัดวงจรของแผง',
                evidence: ev, fix: ['เปลี่ยนเป็นขนาดอย่างน้อย ' + Math.ceil(need) + ' A'], kb: 'breaker-sizing' };
            return { level: 'ok', title: 'ขนาดอุปกรณ์ป้องกันฝั่งไฟตรงเหมาะสม',
                detail: fmt(brk, 0) + ' A จากที่ต้องการอย่างน้อย ' + fmt(need, 1) + ' A', evidence: ev, kb: 'breaker-sizing' };
        }
    },

    {
        id: 'transformer',
        run(d) {
            const ind = d.industrial || {};
            const kva = num(ind.transformerRatingKva) * Math.max(num(ind.transformerQty, 1), 1);
            const ac = num(d.inv1.Rated_AC_Output_Power_kW, 0) * Math.max(num(d.inv1.qty, 1), 1)
                     + num(d.inv2.Rated_AC_Output_Power_kW, 0) * num(d.inv2.qty, 0);
            if (!kva || !ac) return null;
            const pct = ac / kva * 100;
            const ev = 'กำลังฝั่งไฟสลับ ' + fmt(ac, 1) + ' kW ÷ หม้อแปลง ' + fmt(kva, 0) + ' kVA = ' + fmt(pct, 1) + ' %';
            if (pct > 100) return { level: 'error', title: 'กำลังที่จ่ายออกเกินพิกัดหม้อแปลง',
                detail: 'ใช้ไปแล้ว ' + fmt(pct, 1) + ' % ของพิกัด หม้อแปลงจะร้อนเกินและการไฟฟ้าจะไม่อนุมัติการเชื่อมต่อ',
                evidence: ev, fix: ['ลดขนาดระบบ หรือเปลี่ยนหม้อแปลงให้ใหญ่ขึ้น'], kb: 'transformer' };
            if (pct > 80) return { level: 'warn', title: 'กำลังที่จ่ายออกเกิน 80 % ของพิกัดหม้อแปลง',
                detail: 'ใช้ไป ' + fmt(pct, 1) + ' % แนวปฏิบัติทั่วไปคือไม่ควรเกิน 80 % เพื่อเผื่อโหลดปกติและความร้อนสะสม',
                evidence: ev, fix: ['ตรวจกับการไฟฟ้าว่ายอมรับได้หรือไม่ก่อนสั่งอุปกรณ์'], kb: 'transformer' };
            return { level: 'ok', title: 'ขนาดหม้อแปลงรองรับได้',
                detail: 'ใช้ไป ' + fmt(pct, 1) + ' % ของพิกัด', evidence: ev, kb: 'transformer' };
        }
    },

    {
        id: 'grid-code',
        run(d) {
            const yes = v => String(v).toLowerCase() === 'true';
            const anti = d.inv1.Active_Anti_Islanding, lvrt = d.inv1.LVRT_HVRT_Supported;
            if (anti === undefined && lvrt === undefined) return null;
            const ev = 'Anti-islanding: ' + (anti === undefined ? 'ไม่ระบุ' : anti) +
                       ' · LVRT/HVRT: ' + (lvrt === undefined ? 'ไม่ระบุ' : lvrt);
            if (anti !== undefined && !yes(anti)) return { level: 'error', title: 'อินเวอร์เตอร์ไม่มีระบบป้องกันการจ่ายไฟขณะไฟดับ',
                detail: 'Anti-islanding เป็นข้อบังคับทุกกรณี เพื่อความปลอดภัยของเจ้าหน้าที่ที่ทำงานบนสายขณะไฟดับ จะไม่ได้รับอนุมัติให้เชื่อมต่อ',
                evidence: ev, fix: ['เปลี่ยนเป็นอินเวอร์เตอร์รุ่นที่อยู่ในรายชื่อที่การไฟฟ้ารับรอง'], kb: 'grid-code' };
            if (lvrt !== undefined && !yes(lvrt)) return { level: 'warn', title: 'อินเวอร์เตอร์ไม่รองรับ LVRT/HVRT',
                detail: 'จำเป็นสำหรับระบบขนาดใหญ่ ตรวจกับการไฟฟ้าว่าขนาดระบบนี้ต้องการหรือไม่',
                evidence: ev, fix: ['ตรวจข้อกำหนดของการไฟฟ้าสำหรับขนาดระบบนี้'], kb: 'grid-code' };
            return { level: 'ok', title: 'อินเวอร์เตอร์ผ่านข้อกำหนดพื้นฐานของการไฟฟ้า', detail: '', evidence: ev, kb: 'grid-code' };
        }
    },

    {
        id: 'phase',
        run(d) {
            const ph = String(d.inv1.Phase_Type || '');
            const ac = num(d.inv1.Rated_AC_Output_Power_kW, 0) * Math.max(num(d.inv1.qty, 1), 1);
            if (!ph || !ac) return null;
            const single = /1[\s-]*phase|single/i.test(ph);
            const ev = 'ชนิดเฟส ' + ph + ' · กำลังฝั่งไฟสลับรวม ' + fmt(ac, 1) + ' kW';
            if (single && ac > 5) return { level: 'warn', title: 'ระบบหนึ่งเฟสแต่ขนาดเกิน 5 กิโลวัตต์',
                detail: 'โดยทั่วไปการไฟฟ้าจำกัดระบบหนึ่งเฟสไว้ไม่เกิน 5 กิโลวัตต์ ใหญ่กว่านั้นต้องใช้สามเฟส',
                evidence: ev, fix: ['เปลี่ยนเป็นอินเวอร์เตอร์สามเฟส หรือตรวจข้อกำหนดกับการไฟฟ้าในพื้นที่'], kb: 'grid-code' };
            return { level: 'ok', title: 'ชนิดเฟสสอดคล้องกับขนาดระบบ', detail: ph, evidence: ev, kb: 'grid-code' };
        }
    },

    {
        id: 'roof-load',
        run(d) {
            const w = num(d.pv.Weight_kg), n = num(d.counts.totalPanels);
            const area = d.polys.reduce((s, p) => s + num(p.area, 0), 0);
            if (!w || !n || !area) return null;
            const panelLoad = w * n / area;
            const MOUNT = 4;                              // โครงยึดโดยประมาณ 3–6 กก./ตร.ม.
            const total = panelLoad + MOUNT;
            const ev = 'แผง ' + fmt(w, 1) + ' กก. × ' + n + ' แผ่น ÷ ' + fmt(area, 0) + ' ตร.ม. = ' +
                       fmt(panelLoad, 1) + ' + โครงยึดประมาณ ' + MOUNT + ' = ' + fmt(total, 1) + ' กก./ตร.ม.';
            const common = ['ให้วิศวกรโครงสร้างตรวจสอบและรับรอง โดยเฉพาะอาคารเก่าหรืออาคารที่เคยดัดแปลง',
                            'น้ำหนักไม่ได้กระจายสม่ำเสมอ จุดที่ขายึดถ่ายลงแปรับแรงเป็นจุด ต้องตรวจแยกจากค่าเฉลี่ย'];
            if (total > 25) return { level: 'error', title: 'น้ำหนักที่เพิ่มบนหลังคาสูงมาก',
                detail: fmt(total, 1) + ' กก./ตร.ม. เกินเกณฑ์คัดกรอง 25 กก./ตร.ม. โดยทั่วไปต้องเสริมโครงสร้าง',
                evidence: ev, fix: ['เสริมโครงสร้างรองรับ', 'หรือลดจำนวนแผง'].concat(common), kb: 'roof-load' };
            if (total > 15) return { level: 'warn', title: 'น้ำหนักที่เพิ่มบนหลังคาต้องให้วิศวกรโครงสร้างตรวจ',
                detail: fmt(total, 1) + ' กก./ตร.ม. อยู่ในช่วงที่ต้องตรวจสอบก่อน',
                evidence: ev, fix: common, kb: 'roof-load' };
            return { level: 'ok', title: 'น้ำหนักที่เพิ่มบนหลังคาอยู่ในเกณฑ์คัดกรอง',
                detail: fmt(total, 1) + ' กก./ตร.ม. ต่ำกว่า 15 ซึ่งหลังคาเหล็กรีดลอนตามมาตรฐานมักรับได้ แต่ยังต้องให้วิศวกรโครงสร้างรับรอง',
                evidence: ev, kb: 'roof-load' };
        }
    },

    {
        id: 'inverter-eff',
        run(d) {
            const used = num(d.simParams.invEfficiency), max = num(d.inv1.Max_Efficiency_Pct);
            const euro = num(d.inv1.Euro_CEC_Efficiency_Pct);
            if (!used || !max) return null;
            const ev = 'ค่าที่ใช้จำลอง ' + fmt(used, 2) + ' % · สูงสุดตามสเปก ' + fmt(max, 2) + ' %' +
                       (euro ? ' · ถ่วงน้ำหนัก ' + fmt(euro, 2) + ' %' : '');
            if (used > max) return { level: 'error', title: 'ประสิทธิภาพอินเวอร์เตอร์ที่ใช้จำลองสูงกว่าค่าสูงสุดตามสเปก',
                detail: 'กรอกไว้ ' + fmt(used, 2) + ' % ซึ่งสูงกว่าค่าสูงสุด ' + fmt(max, 2) + ' % เป็นไปไม่ได้ทางกายภาพ ตัวเลขผลผลิตในรายงานจะสูงกว่าความเป็นจริง',
                evidence: ev,
                fix: [euro ? 'ใช้ค่าถ่วงน้ำหนัก ' + fmt(euro, 2) + ' % ซึ่งเป็นค่าที่ควรใช้ในการจำลอง'
                           : 'ลดลงมาไม่เกินค่าสูงสุด และควรใช้ค่าถ่วงน้ำหนัก (Euro หรือ CEC) แทน'],
                kb: 'inverter-efficiency' };
            if (euro && used > euro + 0.5) return { level: 'warn', title: 'ใช้ประสิทธิภาพอินเวอร์เตอร์สูงกว่าค่าถ่วงน้ำหนัก',
                detail: 'ค่าที่ควรใช้ในการจำลองคือค่าถ่วงน้ำหนัก ' + fmt(euro, 2) + ' % ซึ่งสะท้อนการใช้งานจริง',
                evidence: ev, fix: ['เปลี่ยนมาใช้ ' + fmt(euro, 2) + ' %'], kb: 'inverter-efficiency' };
            return { level: 'ok', title: 'ประสิทธิภาพอินเวอร์เตอร์ที่ใช้จำลองสมเหตุสมผล',
                detail: fmt(used, 2) + ' %', evidence: ev, kb: 'inverter-efficiency' };
        }
    },

    {
        id: 'wiring-loss',
        run(d) {
            const w = num(d.simParams.wiringLoss);
            if (w === null) return null;
            const dc = num(d.bom.distances && d.bom.distances.dc_m);
            const ev = 'ค่าสูญเสียในสายที่กรอก ' + fmt(w, 2) + ' %' + (dc ? ' · ระยะสายไฟตรงรวม ' + fmt(dc, 0) + ' ม.' : '');
            if (w > 3) return { level: 'warn', title: 'ค่าสูญเสียในสายสูง สายอาจเล็กเกินไป',
                detail: fmt(w, 2) + ' % สูงกว่าเกณฑ์ที่ยอมรับกันคือไม่เกิน 3 % การเพิ่มขนาดสายมักคุ้มกว่าการยอมสูญเสียตลอด 25 ปี',
                evidence: ev, fix: ['เพิ่มขนาดสาย หรือลดระยะเดินสายโดยย้ายตำแหน่งตู้ให้ใกล้ขึ้น'], kb: 'wiring-loss' };
            if (w < 0.3 && dc && dc > 500) return { level: 'warn', title: 'ค่าสูญเสียในสายต่ำผิดปกติเมื่อเทียบกับระยะเดินสาย',
                detail: 'ระยะสายรวม ' + fmt(dc, 0) + ' ม. แต่ตั้งค่าสูญเสียไว้เพียง ' + fmt(w, 2) + ' % ตัวเลขผลผลิตจะสูงเกินจริง',
                evidence: ev, fix: ['ตรวจค่าที่กรอกให้สอดคล้องกับระยะและขนาดสายจริง'], kb: 'wiring-loss' };
            return { level: 'ok', title: 'ค่าสูญเสียในสายอยู่ในเกณฑ์', detail: fmt(w, 2) + ' %', evidence: ev, kb: 'wiring-loss' };
        }
    },

    {
        id: 'uncertainty',
        run(d) {
            const m = num(d.simParams.uncertMeteo), e = num(d.simParams.uncertEquip);
            if (m === null && e === null) return null;
            const ev = 'ความแปรปรวนสภาพอากาศ ' + fmt(m, 1) + ' % · ความคลาดเคลื่อนอุปกรณ์ ' + fmt(e, 1) + ' %';
            if (!m && !e) return { level: 'warn', title: 'ค่าความไม่แน่นอนเป็นศูนย์ ทำให้ P90 ไม่มีความหมาย',
                detail: 'ถ้าไม่ใส่ค่าความไม่แน่นอน ตัวเลข P90 จะเท่ากับ P50 ซึ่งจะถูกตั้งคำถามทันทีเมื่อยื่นขอสินเชื่อ',
                evidence: ev, fix: ['ใส่ความแปรปรวนสภาพอากาศ 3–6 % และความคลาดเคลื่อนอุปกรณ์ 2–3 %'], kb: 'uncertainty' };
            if (m !== null && (m < 2 || m > 8)) return { level: 'info', title: 'ค่าความแปรปรวนสภาพอากาศอยู่นอกช่วงที่พบทั่วไป',
                detail: 'ค่าที่ใช้กันทั่วไปคือ 3–6 % ค่าที่ตั้งไว้คือ ' + fmt(m, 1) + ' %',
                evidence: ev, kb: 'uncertainty' };
            return { level: 'ok', title: 'ค่าความไม่แน่นอนอยู่ในช่วงที่ใช้กันทั่วไป', detail: ev, evidence: ev, kb: 'uncertainty' };
        }
    },

    {
        id: 'roof-usage',
        run(d) {
            const n = num(d.counts.totalPanels);
            const pw = num(d.pv.Width_mm), pl = num(d.pv.Length_mm);
            const area = d.polys.reduce((s, p) => s + num(p.area, 0), 0);
            if (!n || !pw || !pl || !area) return null;
            const pvArea = n * (pw / 1000) * (pl / 1000);
            const pct = pvArea / area * 100;
            const ev = 'พื้นที่แผงรวม ' + fmt(pvArea, 0) + ' ตร.ม. ÷ พื้นที่หลังคา ' + fmt(area, 0) + ' ตร.ม. = ' + fmt(pct, 1) + ' %';
            if (pct < 35) return { level: 'info', title: 'ยังใช้พื้นที่หลังคาไม่มาก',
                detail: 'ใช้ไป ' + fmt(pct, 1) + ' % ถ้าไม่ได้ตั้งใจแบ่งเฟสหรือติดขัดสิ่งกีดขวาง ยังเพิ่มแผงได้อีก',
                evidence: ev, fix: ['ตรวจว่ามีกรอบพื้นที่วางแผงหรือสิ่งกีดขวางที่จำกัดไว้เกินจำเป็นหรือไม่'], kb: 'pvzone' };
            return { level: 'ok', title: 'การใช้พื้นที่หลังคาอยู่ในเกณฑ์ปกติ',
                detail: 'ใช้ไป ' + fmt(pct, 1) + ' % ของพื้นที่หลังคา', evidence: ev, kb: 'pvzone' };
        }
    },

    {
        id: 'walkway',
        run(d) {
            const area = d.polys.reduce((s, p) => s + num(p.area, 0), 0);
            const wk = num(d.bom.mounting_structure && d.bom.mounting_structure.walkway_sqm);
            if (!area || wk === null) return null;
            const ev = 'ทางเดินบนหลังคา ' + fmt(wk, 0) + ' ตร.ม. จากพื้นที่หลังคา ' + fmt(area, 0) + ' ตร.ม.';
            if (area > 500 && wk <= 0) return { level: 'warn', title: 'หลังคาขนาดใหญ่แต่ไม่มีทางเดิน',
                detail: 'พื้นที่ ' + fmt(area, 0) + ' ตร.ม. ควรมีทางเดินสำหรับตรวจสอบ บำรุงรักษา และการเข้าถึงเพื่อดับเพลิง',
                evidence: ev, fix: ['วาดทางเดินในหน้าออกแบบ ด้วยโหมดวาดทางเดิน'], kb: 'edge-setback' };
            return { level: 'ok', title: 'มีทางเดินบนหลังคาแล้ว', detail: fmt(wk, 0) + ' ตร.ม.', evidence: ev, kb: 'edge-setback' };
        }
    },

    /* ---- ความครบถ้วนของข้อมูล ---- */
    {
        id: 'coords',
        run(d) {
            const parts = d.coords.split(',').map(s => parseFloat(s));
            const ok = parts.length === 2 && isFinite(parts[0]) && isFinite(parts[1]);
            if (!ok) return { level: 'error', title: 'ไม่มีพิกัดที่ตั้งโครงการ',
                detail: 'การคำนวณมุมดวงอาทิตย์ เงาบัง และการดึงข้อมูลรังสีดวงอาทิตย์ ต้องใช้พิกัด ผลที่ได้จะไม่ตรงกับไซต์จริง',
                evidence: 'coordinates = "' + d.coords + '"',
                fix: ['กลับไปที่หน้าออกแบบ ค้นหาตำแหน่งไซต์บนแผนที่ แล้วส่งออก DB2 ใหม่'], kb: 'file-flow' };
            if (parts[0] < 5 || parts[0] > 21 || parts[1] < 96 || parts[1] > 106)
                return { level: 'warn', title: 'พิกัดอยู่นอกประเทศไทย',
                    detail: 'ละติจูด ' + fmt(parts[0], 4) + ' ลองจิจูด ' + fmt(parts[1], 4) + ' ถ้าไม่ใช่โครงการต่างประเทศ แสดงว่าพิกัดผิด',
                    evidence: d.coords, fix: ['ตรวจตำแหน่งบนแผนที่ในหน้าออกแบบ'], kb: 'file-flow' };
            return { level: 'ok', title: 'มีพิกัดที่ตั้งโครงการครบ',
                detail: fmt(parts[0], 4) + ', ' + fmt(parts[1], 4), evidence: '', kb: 'file-flow' };
        }
    },

    {
        id: 'mdb',
        run(d) {
            if (!d.mapFeatures.length) return null;
            const has = d.mapFeatures.some(f => f.properties && f.properties.drawMode === 'mdb');
            if (!has) return { level: 'warn', title: 'ยังไม่ได้วางหมุดตู้ MDB',
                detail: 'ระยะเดินสายไฟฟ้ากระแสตรงและกระแสสลับคำนวณจากตำแหน่งตู้ ถ้าไม่มีหมุด ปริมาณสายและราคาในใบรายการวัสดุจะไม่แม่นยำ',
                evidence: 'ไม่พบวัตถุชนิด mdb ในผัง',
                fix: ['กลับไปที่หน้าออกแบบ เลือกโหมดวางหมุด MDB แล้ววางที่ตำแหน่งตู้จริง'], kb: 'file-flow' };
            return { level: 'ok', title: 'วางหมุดตู้ MDB แล้ว', detail: '', evidence: '', kb: 'file-flow' };
        }
    },

    {
        id: 'horizon',
        run(d) {
            if (!d.polys.length) return null;
            const withHz = d.polys.filter(p => p.horizonProfile && String(p.horizonProfile).length > 5).length;
            const siteHz = String(d.simParams.horizonProfile || '').length > 5;
            if (!withHz && !siteHz) return { level: 'info', title: 'ยังไม่มีข้อมูลสิ่งกีดขวางรอบไซต์',
                detail: 'การวิเคราะห์เงาบังจะคิดว่าฟ้าโล่งทุกทิศ ซึ่งให้ผลดีเกินจริงถ้าหน้างานมีอาคารข้างเคียง ต้นไม้ หรือภูเขา',
                evidence: 'ไม่พบเส้นขอบฟ้าทั้งรายหลังคาและค่ากลางของไซต์',
                fix: ['ใช้เครื่องมือต้นไม้ในหน้าออกแบบ เพื่อให้ระบบสร้างเส้นขอบฟ้ารายหลังคาให้เอง',
                      'หรือกรอกเส้นขอบฟ้าเองที่ช่อง Far Horizon Profile'], kb: 'shading-loss' };
            return { level: 'ok', title: 'มีข้อมูลสิ่งกีดขวางสำหรับวิเคราะห์เงา',
                detail: withHz ? withHz + ' หลังคามีเส้นขอบฟ้าของตัวเอง' : 'ใช้ค่ากลางของไซต์', evidence: '', kb: 'shading-loss' };
        }
    }

    ];

    /* ── เรียกใช้กฎทั้งหมด ─────────────────────────────────────────────── */
    function analyze(input) {
        const d = normalize(input);
        const out = [];
        RULES.forEach(rule => {
            let f = null;
            try { f = rule.run(d); }
            catch (e) {
                f = { level: 'info', title: 'ตรวจข้อ ' + rule.id + ' ไม่สำเร็จ',
                      detail: 'ข้อมูลไม่อยู่ในรูปที่คาดไว้ จึงข้ามการตรวจข้อนี้', evidence: String(e.message || e) };
            }
            if (f) out.push(Object.assign({ id: rule.id }, f));
        });
        const rank = { error: 0, warn: 1, info: 2, ok: 3 };
        out.sort((a, b) => rank[a.level] - rank[b.level]);
        return {
            findings: out,
            summary: {
                error: out.filter(f => f.level === 'error').length,
                warn:  out.filter(f => f.level === 'warn').length,
                info:  out.filter(f => f.level === 'info').length,
                ok:    out.filter(f => f.level === 'ok').length,
                checked: out.length,
                total: RULES.length
            },
            project: d.projectName
        };
    }

    /* ── วาดผลตรวจเป็น HTML ─────────────────────────────────────────────
       อยู่ในโมดูลนี้เพื่อให้หน้าออกแบบและหน้ารายงานใช้ตัวเดียวกัน
       ถ้าแยกกันเขียนสองที่ หน้าตาและถ้อยคำจะค่อยๆ เพี้ยนออกจากกันจนสับสน */
    const STYLE = {
        error: { bg: '#fef2f2', bd: '#fca5a5', fg: '#991b1b', mark: '🔴', label: 'ต้องแก้' },
        warn:  { bg: '#fffbeb', bd: '#fcd34d', fg: '#92400e', mark: '🟡', label: 'ควรตรวจสอบ' },
        info:  { bg: '#eff6ff', bd: '#93c5fd', fg: '#1e40af', mark: '🔵', label: 'ข้อสังเกต' },
        ok:    { bg: '#f0fdf4', bd: '#86efac', fg: '#166534', mark: '🟢', label: 'ผ่าน' }
    };

    const esc = s => String(s === undefined || s === null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    function renderHTML(findings, opts) {
        const o = opts || {};
        const show = o.levels || { error: true, warn: true, info: true, ok: false };
        const list = (findings || []).filter(f => show[f.level]);
        if (!list.length) return '<div style="color:#94a3b8;font-size:0.86em;padding:8px;">ไม่มีรายการตามตัวกรองที่เลือก</div>';
        return list.map(f => {
            const st = STYLE[f.level] || STYLE.info;
            const fixes = (f.fix || []).map(x => '<li>' + esc(x) + '</li>').join('');
            const kb = (f.kb && global.AscKB && AscKB.get(f.kb))
                ? '<div style="margin-top:5px;"><button type="button" onclick="AscKB.open(\'' + f.kb + '\')" ' +
                  'style="background:none;border:0;padding:0;cursor:pointer;text-decoration:underline;font-weight:600;font-size:0.8em;color:' +
                  st.fg + ';">อ่าน: ' + esc(AscKB.get(f.kb).title) + '</button></div>' : '';
            return '<div style="background:' + st.bg + ';border:1px solid ' + st.bd + ';border-radius:6px;padding:8px 10px;margin-bottom:7px;">' +
                '<div style="color:' + st.fg + ';font-weight:700;font-size:0.88em;line-height:1.4;">' +
                    st.mark + ' [' + st.label + '] ' + esc(f.title) + '</div>' +
                (f.detail ? '<div style="color:#334155;font-size:0.83em;line-height:1.55;margin-top:3px;">' + esc(f.detail) + '</div>' : '') +
                (f.evidence ? '<div style="color:#64748b;font-size:0.76em;font-family:monospace;margin-top:3px;word-break:break-word;">' + esc(f.evidence) + '</div>' : '') +
                (fixes ? '<ul style="list-style:disc;padding-left:18px;margin-top:5px;color:#334155;font-size:0.8em;line-height:1.5;">' + fixes + '</ul>' : '') +
                kb +
            '</div>';
        }).join('');
    }

    function summaryHTML(s) {
        if (!s) return '';
        return 'ตรวจ ' + s.checked + ' จาก ' + s.total + ' ข้อ · ' +
            '<b style="color:#991b1b">ต้องแก้ ' + s.error + '</b> · ' +
            '<b style="color:#92400e">ควรตรวจ ' + s.warn + '</b> · ' +
            '<b style="color:#1e40af">ข้อสังเกต ' + s.info + '</b> · ' +
            '<b style="color:#166534">ผ่าน ' + s.ok + '</b>';
    }

    global.AscAdvisor = { analyze, renderHTML, summaryHTML, _rules: RULES, _normalize: normalize, _style: STYLE };

})(window);
