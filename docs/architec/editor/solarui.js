// หน้าต่าง ⚡ โซลาร์ + SLD: จากแผงที่วางบนหลังคาจริงในแบบ → ผลผลิตไฟฟ้า (pvlib) · จัดสตริง · Single Line Diagram DXF/PDF (โดย ลุงพี)
// ทุกตัวเลขคำนวณที่เซิร์ฟเวอร์ (pvlib_solar · server/core/sld.py) — หน้านี้แสดงผลและส่งค่าเท่านั้น
import * as M from "./model.js?v=0.25.1";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = (v, d = 0) => Number(v).toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });
const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem("ascaEditor.solar." + k)) ?? d; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem("ascaEditor.solar." + k, JSON.stringify(v)); } catch (e) { /* */ } } };
const MOD = { pmax: 550, voc: 49.9, isc: 14.0, vmp: 41.9, imp: 13.13 };
const INV = { name: "อินเวอร์เตอร์ออนกริด 10 kW", pac: 10000, mppt: 2, vmppt_min: 200, vmppt_max: 1000, vdc_max: 1100, imax_mppt: 26, strings_per_mppt: 2 };

export function openSolar(ctx) {
  const { hist, status, CLOUD } = ctx, dlg = document.querySelector("#solar-dlg"), body = document.querySelector("#solar-body"), msg = document.querySelector("#solar-msg");
  const d = hist.doc, s = M.summary(d), asc = d.imported && d.imported.summary;
  const n = s.pvCount || (asc && asc.modules) || 0, kwp = s.pvKwp || (asc && asc.kwp) || 0;
  const mod = Object.assign({}, MOD, store.get("mod", {}), { pmax: d.pv.watt || MOD.pmax }), inv = Object.assign({}, INV, store.get("inv", {}));
  if (!store.get("inv", null) && kwp) {                    // ยังไม่เคยกรอกอินเวอร์เตอร์ → ขนาดมาตรฐานเล็กสุดที่ DC/AC ≤ 1.3
    const pac = [3, 5, 6, 8, 10, 12, 15, 17, 20, 25, 30, 36, 40, 50, 60, 80, 100].find((k) => kwp / k <= 1.3) || 100;
    Object.assign(inv, { pac: pac * 1000, name: `อินเวอร์เตอร์ออนกริด ${pac} kW`, mppt: pac <= 5 ? 1 : 2 });
  }
  const sys = Object.assign({ phase: 3, len_dc: 25, len_ac: 15 }, store.get("sys", {}));
  const f = (id, label, v, step = "any") => `<label>${label}<input type="number" step="${step}" data-g="${id}" value="${v}"></label>`;
  body.innerHTML = `
    <div class="sgrid">
      <section class="card"><h4>1 · ระบบจากแบบนี้</h4>
        <div class="kv"><span>แผงบนหลังคา</span><b>${n ? `${n} แผง = ${fmt(kwp, 2)} kWp` : "ยังไม่มี — เปิด วางแผงโซลาร์อัตโนมัติ ที่ถาด หลังคา + แผงโซลาร์"}</b>
          <span>มุมเอียง / ทิศ</span><b>${s.pvTilt ?? (asc && asc.tilt) ?? "-"}° / ${s.pvAzimuth != null ? Math.round(s.pvAzimuth) : (asc && asc.azimuth) ?? "-"}°</b>
          <span>พิกัด</span><b>${d.site.lat ?? "-"}, ${d.site.lon ?? "-"}${d.site.lat == null ? " (ตั้งที่ ข้อมูลโมเดล → ตำแหน่งที่ตั้ง)" : ""}</b></div>
        <div class="pform" style="margin-top:8px">
          <label>ระบบไฟ<select data-g="sys.phase"><option value="3" ${sys.phase == 3 ? "selected" : ""}>3 เฟส 400/230 V</option><option value="1" ${sys.phase == 1 ? "selected" : ""}>1 เฟส 230 V</option></select></label>
          ${f("sys.len_dc", "สาย DC แผง→อินเวอร์เตอร์ (ม.)", sys.len_dc, 1)}${f("sys.len_ac", "สาย AC อินเวอร์เตอร์→MDB (ม.)", sys.len_ac, 1)}
        </div></section>
      <section class="card"><h4>2 · สเปกแผง + อินเวอร์เตอร์ (จาก datasheet)</h4>
        <div class="pform">${f("mod.pmax", "แผง Pmax (W)", mod.pmax)}${f("mod.voc", "Voc (V)", mod.voc)}${f("mod.isc", "Isc (A)", mod.isc)}${f("mod.vmp", "Vmp (V)", mod.vmp)}${f("mod.imp", "Imp (A)", mod.imp)}</div>
        <div class="pform">${f("inv.pac", "อินเวอร์เตอร์ (W)", inv.pac, 100)}${f("inv.mppt", "จำนวน MPPT", inv.mppt, 1)}${f("inv.vmppt_min", "MPPT ต่ำสุด (V)", inv.vmppt_min)}${f("inv.vmppt_max", "MPPT สูงสุด (V)", inv.vmppt_max)}${f("inv.vdc_max", "DC สูงสุด (V)", inv.vdc_max)}${f("inv.imax_mppt", "กระแส/MPPT (A)", inv.imax_mppt)}</div>
        <p class="note">ค่าเริ่มต้นเป็นแผง 550 W ทั่วไป + อินเวอร์เตอร์ 10 kW 2 MPPT — แก้ตาม datasheet ของรุ่นที่ใช้จริง (จำค่าไว้ในเครื่องนี้)</p></section>
    </div>
    <div class="row" style="margin:6px 0"><button type="button" class="accent" data-sol="sld" ${n && !CLOUD ? "" : "disabled"}>📐 สร้าง Single Line Diagram</button><button type="button" data-sol="yield" ${kwp && !CLOUD ? "" : "disabled"}>☀ คำนวณผลผลิตไฟฟ้า (pvlib)</button>
      ${CLOUD ? '<span class="note">รุ่นออนไลน์: SLD + pvlib ใช้ได้ในรุ่นในเครื่อง (ASC Architect บน PC)</span>' : ""}</div>
    <div id="sol-out"></div>`;
  const out = body.querySelector("#sol-out");
  body.onchange = (e) => {
    const g = e.target.dataset.g; if (!g) return; const [grp, k] = g.split("."), v = e.target.tagName === "SELECT" ? Number(e.target.value) : Number(e.target.value);
    if (!(v > 0)) { status("ค่าต้องมากกว่า 0 — ไม่ได้เปลี่ยน"); return; }
    ({ mod, inv, sys })[grp][k] = v; store.set(grp, ({ mod, inv, sys })[grp]);
    if (grp === "mod" && k === "pmax") { hist.commit((dd) => { dd.pv.watt = v; }); ctx.onChange && ctx.onChange(); status(`แผง ${v} W — kWp ในแบบคำนวณใหม่แล้ว`); }   // Pmax = วัตต์แผงของแบบ (เดิมถูกเขียนทับทุกครั้งที่เปิด)
  };
  body.onclick = async (e) => {
    const b = e.target.closest("[data-sol]"); if (!b) return;
    b.disabled = true; const old = b.textContent; b.textContent = "กำลังคำนวณ…"; msg.textContent = "";
    try {
      if (b.dataset.sol === "sld") {
        const r = await (await fetch("/api/sld", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modules: n, module: mod, inverter: inv, phase: sys.phase, len_dc: sys.len_dc, len_ac: sys.len_ac, project: d.name, fields: { LOCATION: d.site.lat != null ? `${d.site.lat}, ${d.site.lon}` : "" } }) })).json();
        if (r.error) throw new Error(r.error);
        const x = r.design;
        out.innerHTML = `<section class="card"><h4>Single Line Diagram ${fmt(x.kwp, 2)} kWp ${x.modules < x.modules_roof ? `<span class="badge bad">ใช้ ${x.modules}/${x.modules_roof} แผง (จัดสตริงลงตัว)</span>` : '<span class="badge ok">ใช้แผงครบ</span>'}</h4>
          <div class="kv k4"><span>สตริง</span><b>${x.strings} × ${x.n_per_string} แผง · MPPT ${x.per_mppt.join(" + ")}</b><span>Voc เย็นสุด</span><b>${x.voc_cold} V</b><span>Vmp ร้อนสุด</span><b>${x.vmp_hot} V</b><span>DC/AC</span><b>${x.dc_ac}</b>
            <span>สาย DC</span><b>PV1-F ${x.dc_cable} มม.² · Vd ${x.vd_dc}%</b><span>ฟิวส์สตริง</span><b>${x.fuse ? x.fuse + " A" : "ไม่ต้องใช้"}</b><span>เบรกเกอร์ AC</span><b>${x.ac_breaker} A (I ${x.i_ac} A)</b><span>สาย AC / ดิน</span><b>${x.ac_cable} / ${x.pe} มม.² · Vd ${x.vd_ac}%</b></div>
          <div class="sldprev">${r.svg}</div>
          <div class="row"><a class="btn accent" href="${r.pdf}" target="_blank">📄 เปิด PDF (A3 + กรอบชื่อ)</a><a class="btn" href="${r.dxf}">⬇ DXF</a><a class="btn" href="../cad/?file=${encodeURIComponent(r.cad)}" target="_blank">📐 แก้ต่อใน CAD 2D</a></div>
          <p class="note">ไฟล์อยู่ที่ out\\sld\\${esc(r.folder)}\\ (SLD.dxf · SLD.pdf · SLD.svg) · แบบร่างให้วิศวกรไฟฟ้าตรวจ/ลงนามก่อนยื่นการไฟฟ้า</p></section>`;
        status(`สร้าง SLD ${fmt(x.kwp, 2)} kWp แล้ว — PDF/DXF ใน out\\sld\\${r.folder}`);
        hist.commit((dd) => {                                // ตรวจลำดับงาน (SLD ตรงกับแผงไหม) + ตรวจมาตรฐานไฟฟ้า (ค่าจากเซิร์ฟเวอร์ ไม่คำนวณซ้ำ)
          dd.sldRec = { count: n, kwp: x.kwp, at: new Date().toISOString().slice(0, 16), folder: r.folder, phase: sys.phase, voc_cold: x.voc_cold, vdc_limit: x.limits && x.limits.vdc_limit,
            i_str: x.i_str, dc_cable: x.dc_cable, dc_amp: x.dc_amp, vd_dc: x.vd_dc, i_ac: x.i_ac, ac_breaker: x.ac_breaker, ac_cable: x.ac_cable, ac_amp: x.ac_amp, vd_ac: x.vd_ac, dc_ac: x.dc_ac, inverter: inv.name || "" };
        });
        ctx.onChange && ctx.onChange();
      } else {
        if (d.site.lat == null) throw new Error("ยังไม่มีพิกัดโครงการ — ตั้งที่ ข้อมูลโมเดล → ตำแหน่งที่ตั้ง");
        const r = await (await fetch("/api/yield", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lat: d.site.lat, lon: d.site.lon, kwp, tilt: s.pvTilt ?? 10, azimuth: s.pvAzimuth ?? 180, name: d.name }) })).json();
        if (r.error) throw new Error(r.error);
        const mx = Math.max(...r.monthly.map((m) => m.kwh));
        out.innerHTML = `<section class="card"><h4>ผลผลิตไฟฟ้า (pvlib · ${esc(r.source || "แคชสภาพอากาศ")})</h4>
          <div class="kv k4"><span>ต่อปี</span><b>${fmt(r.annual_kwh)} kWh</b><span>ต่อ kWp</span><b>${fmt(r.specific_yield)} kWh/kWp</b><span>PR</span><b>${fmt(r.pr, 2)}</b><span>เงาขอบฟ้า</span><b>${r.shading ? fmt(r.shading.loss_pct ?? 0, 1) + " %" : "-"}</b></div>
          <div class="bars">${r.monthly.map((m) => `<div title="${esc(m.name)} ${fmt(m.kwh)} kWh"><i style="height:${Math.round((m.kwh / mx) * 100)}%"></i><span>${esc(m.name).slice(0, 3)}</span></div>`).join("")}</div></section>`;
        status(`ผลผลิต ${fmt(r.annual_kwh)} kWh/ปี (${fmt(r.specific_yield)} kWh/kWp)`);
      }
    } catch (err) { msg.textContent = "⚠ " + err.message; out.innerHTML = `<p class="note">⚠ ${esc(err.message)}</p>`; }
    b.disabled = false; b.textContent = old;
  };
  dlg.hidden = false;
}
