// หัวโปรแกรม ASC Architect ทุกหน้า (ข้อความที่ลุงพีกำหนด 2 พ.ย. 2569) · เลขรุ่น/วันที่จาก VERSION.json (โดย ลุงพี)
// ใส่ <div data-brand="line"></div> (แถบบรรทัดเดียว) หรือ data-brand="block" (2 บรรทัด หน้าแรก) · รุ่นในเครื่องอ่าน /api/health · รุ่นออนไลน์อ่าน version.json
(function () {
  var TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  var NAME = "Auto Structure Co-pilot Architect (ASC Architect)", TAG = "ASCA · Design · Structure · Single line diagrams";
  function thDate(iso) { var p = String(iso || "").split("-"); return p.length === 3 ? Number(p[2]) + " " + TH[Number(p[1]) - 1] + " " + (Number(p[0]) + 543) : "…"; }
  function meta(v) { return "v" + v.version + " · สร้าง " + thDate(v.created) + " · ปรับปรุง " + thDate(v.updated) + " · โดย ลุงพี"; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; e.textContent = text; return e; }
  function fill(v) {
    document.querySelectorAll("[data-brand]").forEach(function (box) {
      box.textContent = "";
      if (box.getAttribute("data-brand") === "block") {
        var b = el("b", "", NAME); b.appendChild(el("small", "bmeta", " — " + meta(v))); box.appendChild(b); box.appendChild(el("span", "", TAG));
      } else { box.appendChild(el("b", "", NAME)); box.appendChild(el("span", "bmeta", " — " + meta(v))); box.appendChild(el("span", "btag", TAG)); }
      box.title = NAME + " — " + meta(v) + "\n" + TAG;
    });
  }
  var root = (document.currentScript && document.currentScript.src || "").replace(/brand\.js.*$/, "");
  var css = ".appbrand{display:flex;align-items:baseline;gap:6px;padding:2px 12px;font-size:12px;line-height:1.5;background:var(--panel);border-bottom:1px solid var(--line);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:21px}" +
    ".appbrand b{font-weight:600}.appbrand .bmeta{color:var(--muted)}.appbrand .btag{margin-left:auto;color:var(--muted);letter-spacing:.02em}" +
    ".brand .bmeta{font-weight:400;font-size:12px;color:var(--muted)}@media (max-width:860px){.appbrand .btag,.appbrand .bmeta{display:none}}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  var last = null; window.ascaBrandRefresh = function () { if (last) fill(last); };
  function load() {
    var local = window.PA_MODE !== "cloud";
    var get = function (u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); };
    (local ? get("/api/health") : Promise.reject(new Error("cloud"))).catch(function () { return get(root + "version.json"); }).then(function (v) { last = v; fill(v); }).catch(function () { fill({ version: "?", created: "", updated: "" }); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load); else load();
})();
