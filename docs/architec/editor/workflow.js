// ตรวจลำดับงาน: เตือนเมื่อทำข้ามขั้นหรือข้อมูลในแบบไม่ตรงกัน (โดย ลุงพี)
// ตรวจจากข้อมูลจริงในแบบเท่านั้น · เตือนอย่างเดียว ไม่ล็อก ไม่แก้ให้เอง · ข้ามรายข้อได้ (จำไว้ในแบบ doc.wfSkip)
// ไม่มี DOM — ทดสอบด้วย node ได้ (tests/workflow.test.mjs)
import * as M from "./model.js?v=0.30.1";
import * as ST from "./struct.js?v=0.30.1";

export const STEPS = ["ผัง 2D", "โมเดล 3D", "โครงสร้าง", "โซลาร์ + SLD", "ชุดแบบ + Plot"];
export const LEVEL = { hi: "สำคัญ", md: "ควรแก้", lo: "แนะนำ" };
const f2 = (v) => (v / 1000).toFixed(2);

/** ผนังวางอยู่บนคานไหม: คานแนวเดียวกัน (ห่างไม่เกิน 250 มม. ระดับต่างไม่เกิน 600 มม.) หลายช่วงรวมกันคลุมผนังอย่างน้อย 70% */
function onBeam(w, beams) {
  const L = M.wallLength(w); let cov = 0;
  for (const b of beams) {
    if (Math.abs((b.z ?? 0) - (w.base || 0)) > 600) continue;
    const pa = M.projectOnSegment(b.a, w.a, w.b), pb = M.projectOnSegment(b.b, w.a, w.b);   // ปลายคานบนแนวผนัง
    const off = (p, q) => M.dist(p, q.q);
    if (off(b.a, pa) > 250 && off(b.b, pb) > 250) continue;
    const ta = M.projectOnSegment(w.a, b.a, b.b), tb = M.projectOnSegment(w.b, b.a, b.b);
    if (Math.min(ta.d, tb.d, off(b.a, pa), off(b.b, pb)) > 250) continue;
    cov += Math.abs(pb.t - pa.t) * L;
  }
  return cov >= 0.7 * L;
}

/** วิเคราะห์แบบ → { steps: [{name, state: done|now|todo, info, warn}], warns: [{id, step, level, title, detail, actions:[{label, act}]}] } */
export function analyze(doc) {
  const d = M.normalize(doc), s = M.summary(d), L = ST.levels(d), S = d.struct || [];
  const skip = new Set(d.wfSkip || []), W = [];
  const add = (w) => { if (!skip.has(w.id)) W.push(w); };
  const beams = S.filter((o) => o.kind === "beam");

  // ขั้น 3 โครงสร้าง
  if (L.length > 1 && d.walls.length && !S.length)
    add({ id: "struct-none", step: 2, level: "md", title: "บ้านหลายชั้นแต่ยังไม่มีโครงสร้าง", detail: `แบบมี ${L.length} ชั้น แต่ยังไม่มีเสา คาน ฐานราก — ตรวจขนาดและตารางโครงสร้างยังทำไม่ได้`, actions: [{ label: "สร้างโครงจากผนัง", act: "struct" }] });
  if (beams.length) for (const w of d.walls) {
    if (!(w.base > 0) || onBeam(w, beams)) continue;
    add({ id: `wall-nobeam:${w.id}`, step: 2, level: "hi", title: `ผนังชั้นบนไม่มีคานรองรับ`, detail: `ผนังยาว ${f2(M.wallLength(w))} ม. ที่ระดับ +${f2(w.base)} ม. ไม่มีคานอยู่ใต้แนวผนัง — ตรวจโครงสร้างจะไม่นับน้ำหนักผนังนี้ลงคาน`, actions: [{ label: "พาไปที่ผนัง", act: `select:walls:${w.id}` }, { label: "เปิดหน้าต่างโครงสร้าง", act: "struct" }] });
  }
  for (const st of S.filter((o) => o.kind === "stair" && o.rise > 0 && o.n > 0)) {
    const base = st.base || 0, top = base + st.rise, up = L.filter((l) => l.z > base + 1).sort((a, b) => a.z - b.z)[0];   // rise = ความสูงรวมของบันได (struct.js)
    if (up && Math.abs(top - up.z) > 50)
      add({ id: `stair:${st.id}`, step: 2, level: "md", title: `บันได ${st.mark || ""} ไม่ถึง ${up.name}`.replace("  ", " "), detail: `${st.n} ขั้น × ${(st.rise / st.n / 10).toFixed(1)} ซม. = ${f2(st.rise)} ม. แต่ ${up.name} อยู่สูงกว่า ${f2(up.z - base)} ม. — ${top < up.z ? "ขาด" : "เกิน"} ${f2(Math.abs(up.z - top))} ม.`, actions: [{ label: "พาไปที่บันได", act: `select:struct:${st.id}` }] });
  }
  let fails = 0;
  if (S.length) { const c = ST.check(d); fails = [...c.beams, ...c.columns, ...c.footings, ...c.slabs].filter((r) => !r.ok).length; }
  if (fails) add({ id: "struct-fail", step: 2, level: "hi", title: `ตรวจโครงสร้างไม่ผ่าน ${fails} ชิ้น`, detail: "มีเสา คาน ฐานราก หรือพื้นที่ขนาดไม่พอตามการตรวจเบื้องต้น (WSD)", actions: [{ label: "ดูผลตรวจ", act: "struct" }] });

  // ขั้น 1 ผัง: ประตู/หน้าต่างล้นผนัง
  for (const o of d.openings) {
    const w = d.walls.find((x) => x.id === o.wall); if (!w) continue;
    const Lw = M.wallLength(w), c = (o.t ?? 0.5) * Lw;
    if (o.width > Lw || c - o.width / 2 < -1 || c + o.width / 2 > Lw + 1)
      add({ id: `open:${o.id}`, step: 0, level: "md", title: `${o.kind === "door" ? "ประตู" : "หน้าต่าง"}${o.code ? " " + o.code : ""} ล้นออกนอกผนัง`, detail: `กว้าง ${f2(o.width)} ม. บนผนังยาว ${f2(Lw)} ม. — ย้ายหรือลดขนาด`, actions: [{ label: "พาไปที่ช่องเปิด", act: `select:openings:${o.id}` }] });
  }

  // ขั้น 4 โซลาร์ + SLD
  if (d.sldRec && d.sldRec.count !== s.pvCount)
    add({ id: `sld-stale:${s.pvCount}`, step: 3, level: "hi", title: "SLD ไม่ตรงกับแบบแล้ว", detail: `สร้าง SLD ไว้จากแผง ${d.sldRec.count} แผง แต่ตอนนี้บนหลังคามี ${s.pvCount} แผง (${s.pvKwp} kWp) — ขนาดสตริง ฟิวส์ และเบรกเกอร์อาจผิด`, actions: [{ label: "สร้าง SLD ใหม่", act: "solar" }] });
  if (s.pvCount && d.site.lat == null)
    add({ id: "geo", step: 3, level: "lo", title: "ยังไม่ได้ตั้งพิกัดโครงการ", detail: "ผลผลิตไฟฟ้า (pvlib) และทิศแดดต้องใช้ละติจูด/ลองจิจูด", actions: [{ label: "ตั้งตำแหน่งที่ตั้ง", act: "info:geo" }] });
  if (d.walls.length && (!d.roof || d.roof.type === "none") && d.pv.enabled !== false)
    add({ id: "roof-none", step: 1, level: "lo", title: "ยังไม่มีหลังคา", detail: "วางแผงโซลาร์อัตโนมัติต้องมีหลังคาก่อน", actions: [] });

  // ขั้น 5 ชุดแบบ
  if (d.walls.length && !(d.credits && d.credits.author))
    add({ id: "credits", step: 4, level: "lo", title: "กรอบชื่อแบบยังไม่ครบ", detail: "ยังไม่ใส่ชื่อผู้ออกแบบ/ผู้เขียนแบบ — Plot PDF ได้ แต่ช่องจะว่าง", actions: [{ label: "กรอกข้อมูลผู้ออกแบบ", act: "info:credits" }] });

  const has = [d.walls.length > 0, d.walls.length > 0 && d.roof && d.roof.type !== "none", S.length > 0 && !fails, !!d.sldRec && d.sldRec.count === s.pvCount, !!d.plotRec];
  const info = [`${L.length} ชั้น · ${d.walls.length} ผนัง`, d.roof && d.roof.type !== "none" ? `หลังคา${d.roof.type === "gable" ? "จั่ว" : d.roof.type === "hip" ? "ปั้นหยา" : ""} ${d.roof.pitch ?? ""}°` : "ยังไม่มีหลังคา",
    S.length ? `เสา ${S.filter((o) => o.kind === "column").length} · คาน ${beams.length}${fails ? ` · ไม่ผ่าน ${fails}` : " · ผ่าน"}` : "ยังไม่มี", s.pvCount ? `${s.pvCount} แผง ${s.pvKwp} kWp${d.sldRec ? "" : " · ยังไม่สร้าง SLD"}` : "ไม่มีแผง", d.plotRec ? `Plot ล่าสุด ${d.plotRec.at}` : "ยังไม่ Plot"];
  const first = has.findIndex((x) => !x);
  const steps = STEPS.map((name, i) => {
    const warn = W.filter((w) => w.step === i).length;
    return { name, info: info[i], warn, state: has[i] && !warn ? "done" : i === first || warn ? "now" : has[i] ? "done" : "todo" };
  });
  const rank = { hi: 0, md: 1, lo: 2 };
  W.sort((a, b) => rank[a.level] - rank[b.level] || a.step - b.step);
  return { steps, warns: W, hi: W.filter((w) => w.level === "hi").length };
}
