// ตรวจตามมาตรฐาน: เฉพาะข้อที่วัดเป็นตัวเลขได้จากแบบ (โดย ลุงพี)
// อาคาร (กฎกระทรวง) · ไฟฟ้า (วสท.) · ขนานโครงข่าย (การไฟฟ้า) · โครงสร้าง (WSD) — ทุกข้ออ้างเอกสาร · ข้อที่ต้องใช้ดุลยพินิจ/ข้อมูลนอกแบบ = "ต้องตรวจเอง"
// ตัวเลขทุกตัวมาจากแบบหรือจากผลคำนวณของโปรแกรม (struct.js · SLD จากเซิร์ฟเวอร์) — ไม่แทนการลงนามของวิศวกร/สถาปนิก
// REFS: กฎกระทรวง ฉ.55 ข้อ 22/23/50 ยืนยันจากตัวบทเต็ม (3 พ.ย. 2569) · เลขข้อในวงเล็บเหลี่ยม = ยังต้องใส่จากเล่มมาตรฐาน วสท. ฉบับจริงก่อนใช้อ้างอิงทางการ
import * as ST from "./struct.js?v=0.31.5";

export const SETS = { bldg: "อาคาร", elec: "ไฟฟ้า", grid: "ขนานโครงข่าย", struct: "โครงสร้าง" };
export const SET_TITLE = {
  bldg: "อาคาร · กฎกระทรวง (อาคารพักอาศัย)", elec: "ไฟฟ้า · มาตรฐานการติดตั้งทางไฟฟ้าสำหรับประเทศไทย (วสท.)",
  grid: "ขนานโครงข่าย · ระเบียบการเชื่อมต่อของการไฟฟ้า (กฟภ. / กฟน.)", struct: "โครงสร้าง · วสท. วิธีหน่วยแรงใช้งาน (WSD)",
};
export const REFS = {
  stair: "กฎกระทรวง ฉบับที่ 55 (พ.ศ. 2543) ข้อ 23", room: "กฎกระทรวง ฉบับที่ 55 (พ.ศ. 2543) ข้อ 22", setback: "กฎกระทรวง ฉบับที่ 55 (พ.ศ. 2543) ข้อ 50",
  elec: "มาตรฐานการติดตั้งทางไฟฟ้าสำหรับประเทศไทย (วสท.) [บท/ข้อ]", prog: "เกณฑ์ออกแบบของโปรแกรม (server/core/sld.py)", maker: "ข้อกำหนดผู้ผลิตอินเวอร์เตอร์",
  grid: "ระเบียบ กฟภ. ว่าด้วยข้อกำหนดการเชื่อมต่อระบบโครงข่ายไฟฟ้า พ.ศ. 2559 · ระเบียบ กฟน. ที่เกี่ยวข้อง", wsd: "วสท. มาตรฐานอาคารคอนกรีตเสริมเหล็กโดยวิธีหน่วยแรงใช้งาน [ข้อ]", load: "กฎกระทรวง ฉบับที่ 6 (พ.ศ. 2527) ข้อ 15",
  seismic: "กฎกระทรวงการรับน้ำหนัก ความต้านทาน ความคงทนของอาคาร และพื้นดิน ที่รองรับอาคารในการต้านทานแรงสั่นสะเทือนของแผ่นดินไหว [ฉบับ] · มยผ. [เลข]",
};
const cm = (mm) => `${(mm / 10).toFixed(1)} ซม.`, m2 = (mm) => `${(mm / 1000).toFixed(2)} ม.`, n0 = (v) => Math.round(v).toLocaleString("th-TH");

/** ตรวจแบบ → { rows: [{set, item, ref, value, crit, result: pass|fail|miss|self, key?}], count: {pass, fail, miss, self} } */
export function check(doc) {
  const rows = [], L = ST.levels(doc), S = doc.struct || [];
  const row = (set, item, ref, value, crit, result, key) => rows.push({ set, item, ref, value, crit, result, key });

  // ---------- อาคาร
  for (const st of S.filter((o) => o.kind === "stair")) {
    const base = st.base || 0, up = L.filter((l) => l.z > base + 1).sort((a, b) => a.z - b.z)[0];   // ลูกตั้ง = ความสูงรวม (rise) ÷ จำนวนขั้น
    const rise = !st.n ? 0 : st.rise > 0 ? st.rise / st.n : up ? (up.z - base) / st.n : 0, nm = `บันได ${st.mark || ""}`.trim(), key = `struct:${st.id}`;
    if (rise) row("bldg", `ลูกตั้ง${nm}`, REFS.stair, cm(rise), "ไม่เกิน 20 ซม.", rise <= 200 ? "pass" : "fail", key);
    if (st.run) row("bldg", `ลูกนอน${nm}`, REFS.stair, cm(st.run), "ไม่น้อยกว่า 22 ซม.", st.run >= 220 ? "pass" : "fail", key);
    if (st.w) row("bldg", `ความกว้าง${nm}`, REFS.stair, cm(st.w), "ไม่น้อยกว่า 80 ซม.", st.w >= 800 ? "pass" : "fail", key);
    const tot = st.rise > 0 ? st.rise : rise * (st.n || 0);
    if (tot > 3000) row("bldg", `ชานพัก${nm}`, REFS.stair, `สูงรวม ${m2(tot)}`, "สูงเกิน 3 ม. ต้องมีชานพักทุกช่วง 3 ม. หรือน้อยกว่า", "self", key);   // แบบยังไม่เก็บชานพัก → ให้ตรวจเอง
  }
  for (const [i, l] of L.entries()) {
    if (!(doc.walls || []).some((w) => Math.abs((w.base || 0) - l.z) < 1)) continue;
    const nxt = L[i + 1], slab = nxt && S.find((o) => o.kind === "slab" && Math.abs((o.z ?? 0) - nxt.z) < 1);
    const clear = (l.h || 3000) - (slab ? slab.t || 0 : 0);
    row("bldg", `ระยะดิ่งห้อง ${l.name}`, REFS.room, `${m2(clear)}${slab ? "" : " (ยังไม่หักความหนาพื้น/ฝ้า)"}`, "ห้องที่ใช้เป็นที่พักอาศัย ไม่น้อยกว่า 2.60 ม.", clear >= 2600 ? "pass" : "fail");
  }
  if ((doc.walls || []).length) {
    const b = doc.site && doc.site.boundary;
    row("bldg", "ระยะผนัง/ระเบียงที่มีช่องเปิดถึงแนวเขตที่ดิน", REFS.setback, b ? "ดูผังที่ดิน" : "—", `อาคารสูงไม่เกิน 9 ม. ≥ 2 ม. · สูง 9–23 ม. ≥ 3 ม.${b ? "" : " (ต้องมีแนวเขตที่ดินในแบบ)"} · ตรวจข้อบัญญัติท้องถิ่นด้วย`, b ? "self" : "miss");
  }

  // ---------- ไฟฟ้า + ขนานโครงข่าย (ค่าจาก SLD ล่าสุด)
  const r = doc.sldRec;
  if (r && r.ac_breaker != null) {
    row("elec", `เบรกเกอร์ AC อินเวอร์เตอร์ (${r.phase === 1 ? "1" : "3"} เฟส)`, REFS.elec, `MCB ${r.ac_breaker} A`, `≥ 1.25 × กระแสพิกัด ${r.i_ac} A = ${(1.25 * r.i_ac).toFixed(1)} A`, r.ac_breaker >= 1.25 * r.i_ac - 1e-6 ? "pass" : "fail");
    if (r.dc_amp != null) row("elec", "ขนาดสาย DC (PV1-F)", REFS.elec, `${r.dc_cable} ตร.มม. รับ ${r.dc_amp} A`, `≥ กระแสออกแบบ 1.25 × 1.25 × Isc = ${r.i_str} A`, r.dc_amp >= r.i_str ? "pass" : "fail");
    if (r.ac_amp != null) row("elec", "ขนาดสาย AC", REFS.elec, `${r.ac_cable} ตร.มม. รับ ${r.ac_amp} A`, `≥ เบรกเกอร์ ${r.ac_breaker} A`, r.ac_amp >= r.ac_breaker ? "pass" : "fail");
    row("elec", "แรงดันตกสาย DC", REFS.prog, `${r.vd_dc} %`, "ไม่เกิน 1.5 %", r.vd_dc <= 1.5 ? "pass" : "fail");
    row("elec", "แรงดันตกสาย AC", REFS.prog, `${r.vd_ac} %`, "ไม่เกิน 1.5 %", r.vd_ac <= 1.5 ? "pass" : "fail");
    if (r.vdc_limit) row("grid", "แรงดัน DC สูงสุดที่อุณหภูมิต่ำสุด", REFS.maker, `${r.voc_cold} V`, `ไม่เกิน DC สูงสุดของอินเวอร์เตอร์ ${n0(r.vdc_limit)} V`, r.voc_cold <= r.vdc_limit ? "pass" : "fail");
    row("grid", "อัตราส่วน DC/AC", REFS.prog, `${r.dc_ac}`, "ไม่เกิน 1.30", r.dc_ac <= 1.3 ? "pass" : "fail");
    row("grid", "อินเวอร์เตอร์อยู่ในรายชื่อที่การไฟฟ้ารับรอง", REFS.grid, r.inverter || "[รุ่นที่ใช้]", "ตรวจกับรายชื่อล่าสุดของการไฟฟ้า", "self");
  } else if (doc.sldRec || (doc.pv && doc.pv.enabled !== false && (doc.walls || []).length)) {
    row("elec", "เบรกเกอร์ · สาย · แรงดันตก", REFS.elec, "—", "สร้าง Single Line Diagram ก่อน (ปุ่ม โซลาร์ + SLD)", "miss");
  }

  // ---------- โครงสร้าง (ผลตรวจ WSD ของ struct.js · แสดงตัวที่หนักสุดต่อรหัส)
  if (S.some((o) => o.kind !== "stair")) {
    const c = ST.check(doc), worst = (list, val, cap) => {
      const g = new Map();
      for (const x of list) { const k = x.o.mark || x.o.id, u = cap(x) ? val(x) / cap(x) : 0, cur = g.get(k); if (!cur || u > cur.u) g.set(k, { x, u, n: (cur ? cur.n : 0) + 1 }); else cur.n++; }
      return [...g.values()];
    };
    for (const { x, n } of worst(c.beams, (x) => x.M, (x) => x.Mc)) row("struct", `คาน ${x.o.mark || ""} ×${n} · ${x.o.w}×${x.o.d} มม. ช่วง ${Number(x.L).toFixed(2)} ม.`, REFS.wsd, `M ${n0(x.M)} กก.-ม.`, `≤ Mc ${n0(x.Mc)}`, x.ok ? "pass" : "fail", `struct:${x.o.id}`);
    for (const { x, n } of worst(c.columns, (x) => x.P, (x) => x.Pa)) row("struct", `เสา ${x.o.mark || ""} ×${n} · ${x.o.w}×${x.o.l} มม.`, REFS.wsd, `P ${n0(x.P / 1000)} ตัน`, `≤ ${n0(x.Pa / 1000)} ตัน`, x.ok ? "pass" : "fail", `struct:${x.o.id}`);
    for (const { x, n } of worst(c.footings, (x) => x.P, (x) => x.cap)) row("struct", `ฐานราก ${x.o.mark || ""} ×${n}`, REFS.wsd, `P ${n0(x.P / 1000)} ตัน`, `≤ ${n0(x.cap / 1000)} ตัน`, x.ok ? "pass" : "fail", `struct:${x.o.id}`);
    for (const { x, n } of worst(c.slabs, (x) => x.tmin, (x) => x.o.t)) row("struct", `พื้น ${x.o.mark || ""} ×${n}`, REFS.wsd, `หนา ${x.o.t} มม.`, `≥ ${x.tmin} มม. (${x.span})`, x.ok ? "pass" : "fail", `struct:${x.o.id}`);
    row("struct", "น้ำหนักบรรทุกจร ที่พักอาศัย / หลังคา", REFS.load, `${c.D.live} / ${c.D.liveRoof} กก./ตร.ม.`, "ตามประเภทการใช้อาคาร", "self");
    row("struct", "แรงลม · แผ่นดินไหว", REFS.seismic, "—", "อยู่นอกขอบเขตการตรวจของโปรแกรม", "self");
  }
  const count = { pass: 0, fail: 0, miss: 0, self: 0 };
  for (const x of rows) count[x.result]++;
  return { rows, count };
}
