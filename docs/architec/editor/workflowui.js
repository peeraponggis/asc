// หน้าต่าง ตรวจลำดับงาน + ป้ายจำนวนข้อเตือนที่แถบบน + ถามก่อน Plot/ชุดแบบเมื่อยังมีข้อสำคัญ (โดย ลุงพี)
import { analyze, LEVEL } from "./workflow.js?v=0.30.1";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** ป้ายที่ปุ่ม ตรวจลำดับงาน: จำนวนข้อ (แดง = มีข้อสำคัญ) */
export function badge(doc) {
  const b = $("#wfN"); if (!b) return null;
  const r = analyze(doc);
  b.textContent = r.warns.length || "✓"; b.className = r.hi ? "wfn hi" : r.warns.length ? "wfn" : "wfn ok";
  b.title = r.warns.length ? `${r.warns.length} ข้อ (สำคัญ ${r.hi})` : "ไม่มีข้อเตือน";
  return r;
}

/** ก่อน Plot/ชุดแบบ: ยังมีข้อสำคัญ → ถาม (ทำต่อได้เสมอ) */
export function guard(doc, what) {
  const r = analyze(doc);
  return !r.hi || confirm(`ยังมี ${r.hi} ข้อสำคัญในตรวจลำดับงาน:\n• ${r.warns.filter((w) => w.level === "hi").map((w) => w.title).join("\n• ")}\n\nจะ${what}ต่อไหม?`);
}

/** ctx = { hist, onChange, run(act) } — act: struct · solar · info:<หน้า> · select:<ชนิด>:<id> */
export function openWorkflow(ctx) {
  const dlg = $("#wf-dlg"), body = $("#wf-body");
  const draw = () => {
    const r = analyze(ctx.hist.doc);
    body.innerHTML = `<div class="wfsteps">${r.steps.map((s, i) => `<div class="wfs ${s.state}"><span>${s.state === "done" ? "✓" : i + 1}</span><div><b>${esc(s.name)}</b><small>${esc(s.info)}${s.warn ? ` · เตือน ${s.warn}` : ""}</small></div></div>`).join("")}</div>
      ${r.warns.length ? r.warns.map((w) => `<div class="wfw"><span class="wfl ${w.level}">${LEVEL[w.level]}</span><div class="wft"><b>${esc(w.title)}</b><p>${esc(w.detail)}</p></div>
        <span class="wfa">${w.actions.map((a, i) => `<button type="button" class="${i ? "" : "accent"}" data-wf="${esc(a.act)}">${esc(a.label)}</button>`).join("")}<button type="button" data-skip="${esc(w.id)}" title="ไม่เตือนข้อนี้อีกในแบบนี้">ข้าม</button></span></div>`).join("")
        : `<p class="wfok">ไม่มีข้อเตือน — ลำดับงานและข้อมูลในแบบตรงกัน</p>`}
      <p class="muted">ตรวจใหม่ทุกครั้งที่แบบเปลี่ยน · เตือนเท่านั้น ไม่ล็อก ไม่แก้ให้เอง · กด Plot/ชุดแบบ ขณะยังมีข้อ "สำคัญ" จะถามก่อนเสมอ${(ctx.hist.doc.wfSkip || []).length ? ` · <button type="button" data-unskip>แสดงข้อที่ข้ามไว้ (${ctx.hist.doc.wfSkip.length})</button>` : ""}</p>`;
  };
  body.onclick = (e) => {
    const a = e.target.closest("[data-wf]"), sk = e.target.closest("[data-skip]"), un = e.target.closest("[data-unskip]");
    if (a) { dlg.hidden = true; ctx.run(a.dataset.wf); return; }
    if (sk) { ctx.hist.commit((d) => { d.wfSkip = [...new Set([...(d.wfSkip || []), sk.dataset.skip])]; }); ctx.onChange(); draw(); }
    if (un) { ctx.hist.commit((d) => { d.wfSkip = []; }); ctx.onChange(); draw(); }
  };
  draw(); dlg.hidden = false;
}
