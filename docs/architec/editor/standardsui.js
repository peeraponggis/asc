// หน้าต่าง ตรวจตามมาตรฐาน: สรุปผล · เลือกชุดกฎ · ตาราง · ออกรายงาน PDF (พิมพ์) (โดย ลุงพี)
import { check, SETS, SET_TITLE } from "./standards.js?v=0.31.1";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const RES = { pass: ["ผ่าน", "ok"], fail: ["ไม่ผ่าน", "bad"], miss: ["ขาดข้อมูล", "miss"], self: ["ต้องตรวจเอง", "self"] };
let on = { bldg: true, elec: true, grid: true, struct: true };

/** ctx = { hist, select(key) } */
export function openStandards(ctx) {
  const dlg = $("#std-dlg"), body = $("#std-body");
  const draw = () => {
    const r = check(ctx.hist.doc), rows = r.rows.filter((x) => on[x.set]);
    const c = rows.reduce((a, x) => ((a[x.result] = (a[x.result] || 0) + 1), a), {});
    body.innerHTML = `<div class="stdtop">${Object.entries(RES).map(([k, [t, cls]]) => `<span class="badge ${cls}">${t} ${c[k] || 0}</span>`).join("")}
        <span class="muted">ชุดกฎ:</span>${Object.entries(SETS).map(([k, t]) => `<button type="button" class="stdset ${on[k] ? "on" : ""}" data-set="${k}" aria-pressed="${on[k]}">${t}</button>`).join("")}</div>
      ${rows.length ? `<table class="stdt"><thead><tr><th>รายการ</th><th>อ้างอิง</th><th>ค่าในแบบ</th><th>เกณฑ์</th><th>ผล</th></tr></thead><tbody>
        ${Object.keys(SETS).filter((k) => on[k] && rows.some((x) => x.set === k)).map((k) => `<tr class="grp"><td colspan="5">${esc(SET_TITLE[k])}</td></tr>` +
          rows.filter((x) => x.set === k).map((x) => `<tr${x.key ? ` data-key="${esc(x.key)}" title="คลิกเพื่อเลือกชิ้นนี้ในแบบ"` : ""}><td>${esc(x.item)}</td><td class="muted">${esc(x.ref)}</td><td>${esc(x.value)}</td><td>${esc(x.crit)}</td><td><span class="badge ${RES[x.result][1]}">${RES[x.result][0]}</span></td></tr>`).join("")).join("")}
      </tbody></table>` : `<p class="note">ยังไม่มีรายการให้ตรวจ — วาดผนัง/บันได สร้างโครงสร้าง หรือสร้าง SLD ก่อน</p>`}
      <p class="note">ผลนี้เป็นการตรวจเบื้องต้นจากตัวเลขในแบบ ไม่แทนการลงนามของวิศวกร/สถาปนิก · ทุกเกณฑ์อ้างเอกสาร (เลขข้อในวงเล็บเหลี่ยม = ต้องใส่จากเอกสารฉบับจริงก่อนใช้อ้างอิงทางการ) · ข้อที่ต้องใช้ดุลยพินิจหรือข้อมูลนอกแบบแสดงเป็น "ต้องตรวจเอง" เสมอ</p>`;
  };
  body.onclick = (e) => {
    const s = e.target.closest("[data-set]"), t = e.target.closest("tr[data-key]");
    if (s) { on[s.dataset.set] = !on[s.dataset.set]; draw(); }
    else if (t) { dlg.hidden = true; ctx.select(t.dataset.key); }
  };
  draw(); dlg.hidden = false;
}

/** ออกรายงาน PDF: พิมพ์เฉพาะหน้าต่างนี้ (เลือก บันทึกเป็น PDF ในหน้าต่างพิมพ์) */
export function printStandards(doc) {
  document.body.classList.add("print-std");
  $("#std-print-head").textContent = `รายงานตรวจตามมาตรฐาน — ${doc.name || "แบบ"} · ${new Date().toLocaleDateString("th-TH", { dateStyle: "long" })} · ASC Architect`;
  const done = () => { document.body.classList.remove("print-std"); removeEventListener("afterprint", done); };
  addEventListener("afterprint", done); setTimeout(() => print(), 100);
}
