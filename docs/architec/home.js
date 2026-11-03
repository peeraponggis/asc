// หน้าแรกแบบ B "ขั้นงานอัจฉริยะ" (ลุงพีเลือก 3 พ.ย. 2569) — งานที่เปิดล่าสุด + 5 ขั้นงาน + ต้องดูก่อนไปต่อ + เริ่มงานอื่น (โดย ลุงพี)
// อ่านแบบล่าสุดจาก localStorage ของตัวเขียนแบบ (pa.editor.last → pa.editor.draft[.โครงการ]) แล้ววิเคราะห์ด้วย workflow.js / standards.js
// ตัวเลขทุกตัวมาจากแบบจริง · ไม่มีงาน = แนะนำแบบตัวอย่าง/แบบใหม่
import { analyze } from "./editor/workflow.js?v=0.25.0";
import { check as stdCheck } from "./editor/standards.js?v=0.25.0";
import * as M from "./editor/model.js?v=0.25.0";

const CLOUD = window.PA_MODE === "cloud";
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const STAGE = [                                              // ปุ่มของแต่ละขั้น → เปิดตัวเขียนแบบที่ขั้นนั้น
  { act: "view=2d", label: "เปิดผัง", desc: "ผนัง ห้อง ประตู หน้าต่าง · หลายชั้น" },
  { act: "view=3d", label: "เปิด 3D", desc: "หลังคา วัสดุ เงาตามวันเวลา" },
  { act: "act=struct", label: "ดูผลตรวจ", todo: "สร้างโครงสร้าง", desc: "เสา คาน ฐานราก · ตรวจ WSD" },
  { act: "act=solar", label: "สร้าง SLD", desc: "จัดสตริง · เบรกเกอร์ สาย Vd" },
  { act: "act=drawset", label: "ดูชุดแบบ", desc: "A3 · กรอบชื่อ กฟน./กฟภ. · DWG" },
];
const NEXT_SAY = ["วาดผังผนัง", "ตั้งหลังคา", "สร้างโครงสร้าง", "สร้าง SLD", "Plot ชุดแบบ"];

function lastWork() {
  let last = null, doc = null;
  try { last = JSON.parse(localStorage.getItem("pa.editor.last") || "null"); } catch (e) { /* */ }
  const key = (last && last.key) || "pa.editor.draft";
  try { doc = JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { /* */ }
  if (!doc || doc.app !== "pee_architec-drawing") return null;
  return { doc: M.normalize(doc), project: (last && last.project) || "", at: last && last.at };
}
const edUrl = (w, q) => `editor/?start=draft${w && w.project ? "&project=" + encodeURIComponent(w.project) : ""}${q ? "&" + q : ""}`;
const when = (iso) => { if (!iso) return ""; const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 1 ? "เมื่อสักครู่" : m < 60 ? `${m} นาทีที่แล้ว` : m < 1440 ? `${Math.round(m / 60)} ชั่วโมงที่แล้ว` : `${Math.round(m / 1440)} วันที่แล้ว`; };

function render() {
  const box = document.getElementById("home-smart"); if (!box) return;
  const w = lastWork();
  const start = `<section class="hstart"><h2>เริ่มงานอื่น</h2><div class="hgrid">
      <a class="hbtn" href="editor/?start=new">＋ แบบใหม่</a>
      <a class="hbtn" href="cad/">เปิด DWG / DXF</a>
      ${CLOUD ? "" : `<button type="button" class="hbtn" data-tab="projects">นำเข้างาน ASC Studio</button>`}
      <a class="hbtn" href="${edUrl(w, "act=import3d")}">นำเข้า 3D SketchUp</a>
      <a class="hbtn" href="editor/?start=demo">แบบตัวอย่าง: บ้าน 2 ชั้น + โซลาร์</a>
    </div></section>`;
  if (!w) {
    box.innerHTML = `<div class="hhero"><span class="hkick">ASC Architect · ออกแบบ · โครงสร้าง · ระบบไฟฟ้าโซลาร์ ในโปรแกรมเดียว</span>
        <h1>ยังไม่มีงานในเครื่องนี้</h1><p>เริ่มจากแบบตัวอย่างบ้าน 2 ชั้น คสล. + โซลาร์ 7.7 kWp หรือเริ่มแบบใหม่ — โปรแกรมจะพาไปทีละขั้นจนได้ชุดแบบยื่นขออนุญาต</p>
        <div class="hacts"><a class="hgo" href="editor/?start=demo">▶ เปิดแบบตัวอย่าง</a><a class="hghost" href="editor/?start=new">＋ เริ่มแบบใหม่</a></div>
        <div class="hbar"><i style="width:0%"></i></div></div>
      <div class="hstages">${STAGE.map((s, i) => `<div class="hstg"><span class="hnum todo">${i + 1}</span><b>${["ผัง 2D", "โมเดล 3D", "โครงสร้าง คสล.", "โซลาร์ + SLD", "ชุดแบบ + Plot"][i]}</b><small>${esc(s.desc)}</small></div>`).join("")}</div>
      <div class="hrow">${start}</div>`;
    return;
  }
  const r = analyze(w.doc), s = M.summary(w.doc), done = r.steps.filter((x) => x.state === "done").length;
  const cur = r.steps.findIndex((x) => x.state !== "done"), left = r.steps.filter((x) => x.state !== "done").map((x) => x.name);
  let std = null; try { std = stdCheck(w.doc).count; } catch (e) { /* */ }
  const kwp = s.pvCount ? ` + โซลาร์ ${s.pvKwp} kWp` : "";
  const dots = { hi: "#d93b30", md: "#e8892b", lo: "#2f6fd6" };
  box.innerHTML = `<div class="hhero"><span class="hkick">งานที่เปิดล่าสุด${w.at ? " · " + when(w.at) : ""}</span>
      <div class="hhead"><div><h1>${esc(w.doc.name)}${esc(kwp)}</h1>
        <p>${done === 5 ? "ครบทั้ง 5 ขั้นแล้ว — พร้อมส่งงาน" : `ทำไปแล้ว ${done} จาก 5 ขั้น · เหลือ ${esc(left.join(" · "))}`}${r.warns.length ? ` · เตือน ${r.warns.length} ข้อ` : ""}</p></div>
        <div class="hacts"><button type="button" class="hghost" data-tab="projects">เปลี่ยนโครงการ</button>
          ${cur >= 0 ? `<a class="hgo" href="${edUrl(w, STAGE[cur].act)}">ทำขั้นต่อไป: ${esc(NEXT_SAY[cur])}</a>` : `<a class="hgo" href="${edUrl(w, "act=drawset")}">เปิดชุดแบบ</a>`}</div></div>
      <div class="hbar" role="progressbar" aria-valuemin="0" aria-valuemax="5" aria-valuenow="${done}"><i style="width:${done * 20}%"></i></div></div>
    <div class="hstages">${r.steps.map((x, i) => `<div class="hstg ${i === cur ? "now" : ""}"><span class="hnum ${x.state === "done" ? "done" : i === cur ? "now" : "todo"}">${x.state === "done" ? "✓" : i + 1}</span>
        <b>${esc(x.name)}</b><small>${esc(x.info)}${x.warn ? ` · เตือน ${x.warn}` : ""}</small>
        <a class="hact ${i === cur ? "go" : ""}" href="${edUrl(w, STAGE[i].act)}">${esc(i === 2 && !w.doc.struct.length ? STAGE[i].todo : STAGE[i].label)}</a></div>`).join("")}</div>
    <div class="hrow"><section class="hwarn"><h2>ต้องดูก่อนไปต่อ</h2>
        ${r.warns.slice(0, 5).map((x) => `<div class="hli"><span class="hdot" style="background:${dots[x.level]}"></span><span class="hlt"><b>${esc(x.title)}</b><small>${esc(x.detail)}</small></span><a href="${edUrl(w, "act=workflow")}">พาไปแก้</a></div>`).join("") || `<div class="hli"><span class="hdot" style="background:#2f8f4e"></span><span class="hlt"><b>ไม่มีข้อเตือน</b><small>ลำดับงานและข้อมูลในแบบตรงกัน</small></span></div>`}
        ${std ? `<div class="hli"><span class="hdot" style="background:${std.fail ? "#d93b30" : "#2f8f4e"}"></span><span class="hlt"><b>ตรวจตามมาตรฐาน: ผ่าน ${std.pass} · ไม่ผ่าน ${std.fail}</b><small>ขาดข้อมูล ${std.miss} · ต้องตรวจเอง ${std.self}</small></span><a href="${edUrl(w, "act=standards")}">ดูรายงาน</a></div>` : ""}
      </section>${start}</div>`;
}
render();
addEventListener("focus", render);                           // กลับจากแท็บตัวเขียนแบบ = อัปเดตงานล่าสุด
addEventListener("storage", (e) => { if (e.key && e.key.startsWith("pa.editor.")) render(); });
