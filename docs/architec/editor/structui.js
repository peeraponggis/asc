// หน้าต่าง 🏗 โครงสร้าง: ชั้นอาคาร · สร้างโครงจากผนัง · ตรวจขนาดเบื้องต้น · ตารางเสา คาน ฐานราก + ปริมาณงาน (โดย ลุงพี)
import * as M from "./model.js?v=0.24.0";
import * as ST from "./struct.js?v=0.24.0";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const f1 = (v, d = 1) => Number(v).toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });

export function openStruct(ctx) {
  const { hist, onChange, status, select } = ctx, dlg = document.querySelector("#struct-dlg"), body = document.querySelector("#struct-body");
  const draw = () => {
    const d = hist.doc, L = ST.levels(d), q = ST.quantities(d), ck = ST.check(d), n = (k) => (d.struct || []).filter((o) => o.kind === k).length;
    const mark = (r) => `<button type="button" class="lnk" data-pick="${r.o.id}">${esc(r.o.mark || "-")}</button>`;
    /** แต่ละรหัส แสดงตัวที่หนักที่สุด (อัตราส่วนใช้งานสูงสุด) + จำนวนชิ้น · ตัวที่ไม่ผ่านแสดงทุกตัว */
    const worst = (rows, ratio) => { const g = new Map(); for (const r of rows) { const k = r.o.mark + (r.ok ? "" : "|" + r.o.id); const x = g.get(k); if (!x || ratio(r) > ratio(x)) g.set(k, { ...r, n: (x ? x.n : 0) + 1 }); else x.n++; } return [...g.values()]; };
    const badge = (ok) => `<span class="badge ${ok ? "ok" : "bad"}">${ok ? "✓ ผ่าน" : "✗ ไม่ผ่าน"}</span>`;
    body.innerHTML = `
      <div class="sgrid">
        <section class="card"><h4>1 · ชั้นอาคาร</h4>
          <table class="t"><tr><th>ชั้น</th><th>ระดับพื้น (มม.)</th><th>สูงชั้น (มม.)</th><th></th></tr>
          ${L.map((l, i) => `<tr><td><input data-lv="${i}" data-k="name" value="${esc(l.name)}"></td><td><input type="number" step="50" data-lv="${i}" data-k="z" value="${l.z}"></td><td><input type="number" step="50" data-lv="${i}" data-k="h" value="${l.h}"></td><td>${i ? `<button type="button" data-lvdel="${i}" title="ลบชั้น (ไม่ลบผนัง)">✕</button>` : ""}</td></tr>`).join("")}</table>
          <div class="row"><button type="button" data-s="lvadd">＋ เพิ่มชั้น</button><button type="button" data-s="copyup" ${L.length > 1 ? "" : "disabled"} title="คัดลอกผนังชั้น 1 ขึ้นชั้นบน (เฉพาะผนังภายนอกหนา ≥ 150 มม.)">คัดลอกผนังรอบนอกขึ้นชั้นบน</button></div>
          <p class="note">ผัง 2D แสดงทีละชั้น (เลือกที่แถบ ชั้น) · ผนัง/เสา/คานที่วาดใหม่ใช้ระดับของชั้นนั้น · หลังคาวางบนผนังชั้นบนสุด</p></section>
        <section class="card"><h4>2 · โครงสร้าง (คอนกรีตเสริมเหล็ก)</h4>
          <div class="kv"><span>ฐานราก</span><b>${n("footing")}</b><span>เสา</span><b>${n("column")}</b><span>คาน</span><b>${n("beam")}</b><span>พื้น</span><b>${n("slab")}</b><span>บันได</span><b>${n("stair")}</b></div>
          <div class="row"><button type="button" class="accent" data-s="auto" title="วางเสา + ฐานรากที่มุม/จุดตัดผนังรอบนอก และคานตามแนวผนังทุกชั้น (คานคอดิน · คานชั้น · คานหลังคา)">⚙ สร้างโครงจากผนัง</button><button type="button" data-s="clear" ${n("column") + n("beam") + n("footing") ? "" : "disabled"}>ลบโครงสร้างทั้งหมด</button></div>
          <p class="note">หรือวาดเองในผัง 2D: เครื่องมือ <b>เสา · คาน · ฐานราก · พื้น · บันได</b> (คอลัมน์ซ้าย) · ขนาด เหล็กเสริม เข็ม แก้ที่ ข้อมูลวัตถุ</p>
          <div class="kv"><span>คอนกรีต fc'</span><input type="number" data-d="fc" value="${ST.DESIGN.fc}"><span>เหล็ก fy</span><input type="number" data-d="fy" value="${ST.DESIGN.fy}"><span>น้ำหนักจร</span><input type="number" data-d="live" value="${ST.DESIGN.live}"><span>ดินรับได้ (กก./ตร.ม.)</span><input type="number" data-d="qa" value="${ST.DESIGN.qa}"></div></section>
      </div>
      <section class="card"><h4>3 · ตรวจขนาดเบื้องต้น ${(d.struct || []).length ? badge(ck.ok) : ""}</h4>
        ${(d.struct || []).length ? `
        <table class="t"><tr><th>คาน</th><th>ขนาด (มม.)</th><th>ช่วง (ม.)</th><th>w (กก./ม.)</th><th>M / Mc (กก.-ม.)</th><th>V (กก.)</th><th>เหล็กล่างที่ต้องการ</th><th>ปลอก</th><th>ผล</th></tr>
        ${worst(ck.beams, (r) => r.M / Math.max(1, r.Mc)).map((r) => `<tr class="${r.ok ? "" : "bad"}"><td>${mark(r)}${r.n > 1 ? ` <small>×${r.n}</small>` : ""}</td><td>${r.o.w}×${r.o.d}</td><td>${f1(r.L, 2)}</td><td>${r.w.toLocaleString()}</td><td>${r.M.toLocaleString()} / ${r.Mc.toLocaleString()}</td><td>${r.V.toLocaleString()}</td><td>As ${r.As} ซม.² → ${r.bars}</td><td>${r.stir}</td><td>${esc(r.msg)}</td></tr>`).join("")}</table>
        <table class="t"><tr><th>เสา</th><th>ขนาด</th><th>ช่วงเสา (ม.)</th><th>P (ตัน)</th><th>Pallow (ตัน)</th><th>ผล</th></tr>
        ${worst(ck.columns, (r) => r.P / Math.max(1, r.Pa)).map((r) => `<tr class="${r.ok ? "" : "bad"}"><td>${mark(r)}${r.n > 1 ? ` <small>×${r.n}</small>` : ""}</td><td>${r.o.w}×${r.o.l || r.o.w}</td><td>${f1(((r.o.base ?? 0) / 1000), 2)} → ${f1(((r.o.top ?? 3000) / 1000), 2)}</td><td>${f1(r.P / 1000)}</td><td>${f1(r.Pa / 1000)}</td><td>${esc(r.msg)}</td></tr>`).join("")}</table>
        <table class="t"><tr><th>ฐานราก</th><th>ขนาด</th><th>P (ตัน)</th><th>รับได้ (ตัน)</th><th>ผล</th></tr>
        ${worst(ck.footings, (r) => r.P / Math.max(1, r.cap)).map((r) => `<tr class="${r.ok ? "" : "bad"}"><td>${mark(r)}${r.n > 1 ? ` <small>×${r.n}</small>` : ""}</td><td>${r.o.w}×${r.o.l}×${r.o.t}${r.o.pile ? ` · ${esc(r.o.pile)}` : ""}</td><td>${f1(r.P / 1000)}</td><td>${f1(r.cap / 1000)}</td><td>${esc(r.msg)}</td></tr>`).join("")}</table>
        ${ck.slabs.length ? `<table class="t"><tr><th>พื้น</th><th>หนา</th><th>ช่องพื้นใหญ่สุด</th><th>น้ำหนักรวม (กก./ตร.ม.)</th><th>หนาต่ำสุด</th><th>ผล</th></tr>${ck.slabs.map((r) => `<tr class="${r.ok ? "" : "bad"}"><td>${mark(r)}</td><td>${r.o.t}</td><td>${r.span}</td><td>${Math.round(r.w)}</td><td>${r.tmin}</td><td>${esc(r.msg)}</td></tr>`).join("")}</table>` : ""}
        <p class="note">แต่ละรหัสแสดงชิ้นที่รับแรงมากที่สุด (×จำนวนชิ้น) · ชิ้นที่ไม่ผ่านแสดงทุกชิ้น · วิธีหน่วยแรงใช้งาน (WSD): fc = 0.45fc' · fs = min(0.5fy, 1,700) · n = 134/√fc' · คานคิดแบบช่วงเดียวธรรมดา M = wL²/8 (ปลอดภัย) · น้ำหนักจากพื้นตามพื้นที่รับน้ำหนักถึงคานขนานตัวถัดไป + ผนังก่อ ${ST.DESIGN.wall} กก./ตร.ม. · เสา P ≤ 0.85Ag(0.25fc' + fsρg) ρg 1% · น้ำหนักจรตามกฎกระทรวง ฉ.6 (2527) · คลิกรหัสเพื่อเลือกชิ้นนั้นในแบบ</p>`
        : `<p class="note">ยังไม่มีโครงสร้าง — กด ⚙ สร้างโครงจากผนัง หรือวาดเสา/คานในผัง 2D</p>`}</section>
      <section class="card"><h4>4 · ตารางโครงสร้าง + ปริมาณงาน</h4>
        <table class="t"><tr><th>ชนิด</th><th>รหัส</th><th>ขนาด (มม.)</th><th>เหล็กเสริม / เข็ม</th><th>จำนวน</th><th>คอนกรีต (ลบ.ม.)</th></tr>
        ${q.rows.map((r) => `<tr><td>${ST.KINDS[r.kind]}</td><td>${esc(r.mark)}</td><td>${esc(r.size)}</td><td>${esc(r.rebar)}</td><td>${r.n}</td><td>${f1(r.v, 2)}</td></tr>`).join("")}
        <tr class="sum"><td colspan="5">รวมคอนกรีตโครงสร้าง</td><td>${f1(q.concrete, 2)}</td></tr></table>
        <div class="kv"><span>เหล็กเสริมประมาณ</span><b>${Math.round(q.steel).toLocaleString()} กก.</b><span>ไม้แบบประมาณ</span><b>${f1(q.formwork, 1)} ตร.ม.</b></div>
        <div class="row"><button type="button" data-s="csv">⬇ ตาราง CSV (เปิดใน Excel)</button></div></section>`;
  };
  const setLv = (fn) => { hist.commit((d) => { d.levels = JSON.parse(JSON.stringify(ST.levels(d))); fn(d); }); onChange(); draw(); ctx.levelsChanged && ctx.levelsChanged(); };
  body.onchange = (e) => {
    const t = e.target;
    if (t.dataset.lv != null) { const i = Number(t.dataset.lv), k = t.dataset.k; setLv((d) => { d.levels[i][k] = k === "name" ? t.value : Number(t.value) || 0; }); return; }
    if (t.dataset.d) { const v = Number(t.value); if (v > 0) { ST.DESIGN[t.dataset.d] = v; draw(); } else status("ค่าต้องมากกว่า 0 — ไม่ได้เปลี่ยน"); }
  };
  body.onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.pick) { select("struct:" + b.dataset.pick); return; }
    if (b.dataset.lvdel) { setLv((d) => d.levels.splice(Number(b.dataset.lvdel), 1)); return; }
    const a = b.dataset.s;
    if (a === "lvadd") setLv((d) => { const l = d.levels[d.levels.length - 1]; d.levels.push({ id: M.uid("L"), name: `ชั้น ${d.levels.length + 1}`, z: l.z + (l.h || 3000), h: 3000 }); });
    if (a === "copyup") {
      const d = hist.doc, L = ST.levels(d), src = d.walls.filter((w) => (w.base || 0) <= 100 && w.thick >= 150);
      hist.commit((dd) => { for (const l of L.slice(1)) for (const w of src) if (!dd.walls.some((x) => (x.base || 0) === l.z && M.dist(x.a, w.a) < 1 && M.dist(x.b, w.b) < 1)) dd.walls.push({ ...JSON.parse(JSON.stringify(w)), id: M.uid("w"), base: l.z, height: l.h || w.height }); });
      onChange(); draw(); status(`คัดลอกผนังรอบนอก ${src.length} ช่วง ขึ้น ${L.length - 1} ชั้น`);
    }
    if (a === "auto") {
      const d = hist.doc; if (!d.walls.length) return status("ยังไม่มีผนัง — วาดผนัง/ห้องก่อน");
      const S = ST.autoFrame(d);
      hist.commit((dd) => { dd.struct = (dd.struct || []).filter((o) => o.kind === "slab" || o.kind === "stair").concat(S); });
      onChange(); draw(); status(`สร้างโครงสร้างจากผนังแล้ว: เสา ${S.filter((o) => o.kind === "column").length} ต้น · ฐานราก ${S.filter((o) => o.kind === "footing").length} · คาน ${S.filter((o) => o.kind === "beam").length} ช่วง — ตรวจผลในข้อ 3`);
    }
    if (a === "clear" && confirm("ลบเสา คาน ฐานรากทั้งหมด? (Ctrl+Z ย้อนได้)")) { hist.commit((d) => { d.struct = (d.struct || []).filter((o) => o.kind === "slab" || o.kind === "stair"); }); onChange(); draw(); }
    if (a === "csv") {
      const q = ST.quantities(hist.doc), rows = [["ชนิด", "รหัส", "ขนาด (มม.)", "เหล็กเสริม/เข็ม", "จำนวน", "คอนกรีต (ลบ.ม.)"], ...q.rows.map((r) => [ST.KINDS[r.kind], r.mark, r.size, r.rebar, r.n, r.v.toFixed(3)]), ["รวม", "", "", "", "", q.concrete.toFixed(3)], ["เหล็กเสริมประมาณ (กก.)", "", "", "", "", Math.round(q.steel)]];
      const csv = "﻿" + rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\r\n");
      ctx.output(`${hist.doc.name}_ตารางโครงสร้าง.csv`, new Blob([csv], { type: "text/csv" }), "struct_schedule.csv");
    }
  };
  draw(); dlg.hidden = false;
  return draw;
}
