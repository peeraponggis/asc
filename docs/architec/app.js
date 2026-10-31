// ASC Architect หน้าเว็บ — รุ่นในเครื่อง (local: เรียก server) และรุ่นออนไลน์ (cloud: ไฟล์คงที่บน ASC Cloud) (โดย ลุงพี)
(function () {
  "use strict";
  var CLOUD = window.PA_MODE === "cloud";
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var state = { status: null, projects: [], catalog: null };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmt(n, d) { return n == null || isNaN(n) ? "—" : Number(n).toLocaleString("th-TH", { maximumFractionDigits: d == null ? 0 : d, minimumFractionDigits: d || 0 }); }
  function toast(msg, bad) {
    var t = $("#toast"); t.textContent = msg; t.className = "toast" + (bad ? " bad" : ""); t.hidden = false;
    clearTimeout(toast.h); toast.h = setTimeout(function () { t.hidden = true; }, bad ? 6000 : 3000);
  }
  function api(path, body) {
    return fetch(path, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ("HTTP " + r.status)); return j; }); });
  }

  // ---------------------------------------------------------------- แท็บ
  function showTab(name) {
    $$("#tabs button").forEach(function (b) { b.classList.toggle("on", b.dataset.tab === name); });
    $$(".tab").forEach(function (s) { s.classList.toggle("on", s.id === "tab-" + name); });
    try { localStorage.setItem("pa.tab", name); } catch (e) { /* ไม่มี storage ก็ไม่เป็นไร */ }
    if (name === "library") loadCatalog();
  }
  $("#tabs").addEventListener("click", function (e) { if (e.target.dataset.tab) showTab(e.target.dataset.tab); });
  // ผู้ช่วย AI piBot: แท็บที่เปิดอยู่ = หน้าของผู้ช่วย · ต่อไปทำอะไร ตามแท็บ
  var TABS = { home: "หน้าแรก", projects: "โครงการ", yield: "ผลผลิตไฟฟ้า", strings: "จัดสตริง", library: "คลังสัญลักษณ์", templates: "แม่แบบ & โปรแกรม" };
  function curTab() { var b = document.querySelector("#tabs button.on"); return b ? b.dataset.tab : "home"; }
  window.ascaAI = {
    page: curTab,
    pageName: function () { return "หน้าหลัก › " + (TABS[curTab()] || curTab()); },
    facts: function () { return { "โหมด": window.PA_MODE === "cloud" ? "ออนไลน์" : "ในเครื่อง", "โครงการ": (state.projects || []).length }; },
    next: function () {
      var t = curTab(), n = (state.projects || []).length, cloud = window.PA_MODE === "cloud";
      if (t === "yield") return [{ done: false, say: "กรอกละติจูด ลองจิจูด kWp มุมเอียง ทิศ แล้วกด คำนวณ" + (cloud ? " (รุ่นออนไลน์คำนวณไม่ได้ ใช้รุ่นในเครื่อง)" : "") },
        { done: false, say: "ได้ผลแล้ว: ดาวน์โหลด JSON ส่ง ASC หรือเปิดหน้ารายงาน" }];
      if (t === "strings") return [{ done: false, say: "กรอกจำนวนแผง + สเปกแผงและอินเวอร์เตอร์ (ช่องว่าง = ค่าเริ่มต้น) แล้วกด หาแบบจัดสตริง" }];
      if (t === "projects") return [
        { done: n > 0 || cloud, say: "นำเข้างาน ASC Studio (กด นำเข้า ในกล่อง ASC Studio — ทุกโฟลเดอร์) หรือสร้างโครงการเปล่า" },
        { done: false, say: n ? "เลือกโครงการ → ✏️ เขียนแบบ หรือ คำนวณผลผลิต" : "หลังมีโครงการ: ✏️ เขียนแบบ / คำนวณผลผลิต", act: n ? { tool: "press", key: "yield", label: "ไปแท็บผลผลิตไฟฟ้า" } : null }];
      return [
        { done: false, say: "เขียนแบบบ้าน/อาคาร → ✏️ เขียนแบบ 2D/3D (ลิงก์ด้านบน)" },
        { done: false, say: "แก้แบบ DWG/DXF/PDF ของลูกค้า → 📐 CAD 2D" + (cloud ? " (รุ่นในเครื่อง)" : "") },
        { done: n > 0 || cloud, say: "งานโซลาร์รูฟท็อป → นำเข้างาน ASC Studio ที่แท็บ โครงการ", act: { tool: "press", key: "projects", label: "ไปแท็บโครงการ" } }];
    },
    sets: {},
  };

  // ---------------------------------------------------------------- เริ่ม
  function init() {
    document.body.classList.toggle("cloud", CLOUD);
    var m = $("#mode"); m.textContent = CLOUD ? "🌐 ออนไลน์" : "🖥️ ออฟไลน์ (ในเครื่อง)"; m.className = "badge " + (CLOUD ? "cloud" : "local");
    if (CLOUD) {
      $("#ver").textContent = "";
      cloudAuth();
      homeCards();
    } else {
      api("/api/health").then(function (h) { $("#ver").textContent = "v" + h.version + " · " + (h.updated || ""); }).catch(function () {});
      refreshStatus();
      loadProjects();
      loadDesignAuto();
    }
    loadCatalog();
    var last = null; try { last = localStorage.getItem("pa.tab"); } catch (e) { /* */ }
    var q = new URLSearchParams(location.search);
    if (q.get("tab")) last = q.get("tab");
    if (last && $("#tab-" + last)) showTab(last);
    if (q.get("kwp")) prefillYield(q);
  }

  function cloudAuth() {
    // รุ่นออนไลน์วางใต้ ASC Cloud: ใช้ล็อกอินเดียวกับ Dashboard (window.AscCloud) — ไม่มีก็ใช้แบบไม่ล็อกอิน (เครื่องมือคงที่)
    var AC = window.AscCloud;
    if (!AC || !AC.ready) return;
    AC.ready().then(function () {
      var u = AC.currentUser && AC.currentUser();
      $("#user").textContent = u ? (u.email || u.name || "") : "ยังไม่ได้เข้าสู่ระบบ ASC Cloud";
    }).catch(function () {});
  }

  function refreshStatus() {
    return api("/api/status").then(function (s) {
      state.status = s;
      homeCards();
      appCards();
      fillPresets(s.locations);
      $("#da-path").textContent = s.designauto_found ? "อ่านจาก " + s.designauto_out : "ไม่พบโฟลเดอร์ ASC Studio: " + s.designauto_out;
      fillDefaults(s.defaults);
      var rl = $("#remote-links"), r = s.remote || [];
      rl.hidden = !r.length;
      rl.innerHTML = "📱 เปิดจากมือถือ / laptop ผ่าน Tailscale: " + r.map(function (u) { return '<a href="' + esc(u) + '">' + esc(u) + "</a>"; }).join(" · ");
    }).catch(function (e) { toast("ต่อ server ไม่ได้: " + e.message, true); });
  }

  function homeCards() {
    var s = state.status, html = [];
    if (CLOUD) {
      html.push(card("โหมด", "ออนไลน์", "คลังสัญลักษณ์ · แม่แบบ · จัดสตริง ใช้ได้เลย"));
      html.push(card("งานเต็ม", "รุ่นในเครื่อง", "pvlib · เปิดโปรแกรม · render ต้องใช้ ASC Architect ในเครื่อง"));
    } else if (s) {
      var n = Object.keys(s.apps).filter(function (k) { return s.apps[k].installed; }).length;
      html.push(card("โครงการ", fmt(state.projects.length), "ใน out\\"));
      html.push(card("ข้อมูลอากาศในแคช", fmt(s.meteo.length) + " ไฟล์", "PVGIS / NASA จาก ASC Studio"));
      html.push(card("โปรแกรมในเครื่อง", n + " / " + Object.keys(s.apps).length, n ? "พร้อมใช้" : "ยังไม่ได้ติดตั้ง — ดู INSTALL-APPS.md", n ? "ok" : "no"));
    }
    if (state.catalog) html.push(card("สัญลักษณ์ CAD", fmt(state.catalog.symbols.length), state.catalog.libraries.length + " คลัง · " + state.catalog.templates.length + " แม่แบบ"));
    $("#home-cards").innerHTML = html.join("");
  }
  function card(label, big, sub, cls) { return '<div class="card">' + esc(label) + '<b class="' + (cls || "") + '">' + esc(big) + '</b><span class="small muted">' + esc(sub || "") + "</span></div>"; }

  // ---------------------------------------------------------------- โครงการ
  function loadProjects() {
    return api("/api/projects").then(function (list) {
      state.projects = list;
      $("#project-list").innerHTML = list.length ? list.map(projectItem).join("") : '<p class="muted">ยังไม่มีโครงการ</p>';
      var sel = $("#yield-form [name=project]"), cur = sel.value;
      sel.innerHTML = '<option value="">— ไม่ผูกโครงการ —</option>' + list.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name || p.id) + "</option>"; }).join("");
      sel.value = cur;
      homeCards();
    }).catch(function (e) { toast(e.message, true); });
  }
  function projectItem(p) {
    var has = function (f) { return p.files.indexOf(f) >= 0; };
    var btn = function (act, label, extra) { return '<button class="btn small" data-act="' + act + '" data-id="' + esc(p.id) + '"' + (extra || "") + ">" + label + "</button>"; };
    // ทุกไฟล์ของโครงการ: DXF/DWG → หน้า CAD 2D · อื่น ๆ → เปิดดู
    var links = p.files.filter(function (f) { return !/\.(tmp|bak)$/i.test(f); }).slice(0, 40).map(function (f) {
      if (/\.(dxf|dwg)$/i.test(f)) return '<a class="chip cad" target="_blank" href="cad/?file=' + encodeURIComponent("out/" + p.id + "/" + f) + '" title="เปิดในหน้า CAD 2D">📐 ' + esc(f) + "</a>";
      return '<a class="chip" target="_blank" href="/api/projects/' + encodeURIComponent(p.id) + "/files/" + encodeURIComponent(f) + '">' + esc(f) + "</a>";
    }).join(" ");
    return '<div class="item"><div class="t"><b>' + esc(p.name || p.id) + "</b><small>" +
      [p.kwp ? fmt(p.kwp, 2) + " kWp" : "", p.lat != null ? fmt(p.lat, 4) + ", " + fmt(p.lon, 4) : "", p.source && p.source.designAuto ? "จาก ASC Studio" : "", p.files.length + " ไฟล์"].filter(Boolean).join(" · ") +
      '</small><div class="chips" style="margin:6px 0 0">' + links + "</div></div>" +
      '<a class="btn small" href="editor/?project=' + encodeURIComponent(p.id) + '">✏️ เขียนแบบ</a>' + btn("use", "คำนวณผลผลิต") + btn("folder", "เปิดโฟลเดอร์") +
      (has("3d.glb") ? btn("render", "Render (Blender)") + btn("blender", "เปิดใน Blender") : "") +
      (p.files.some(function (f) { return /\.dxf$/i.test(f); }) ? btn("cad", "เปิด DXF") : "") + "</div>";
  }
  $("#project-list").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    var p = state.projects.filter(function (x) { return x.id === b.dataset.id; })[0]; if (!p) return;
    var act = b.dataset.act;
    if (act === "use") { useProject(p); showTab("yield"); return; }
    if (act === "folder") { api("/api/open", { app: "folder", project: p.id }).catch(function (er) { toast(er.message, true); }); return; }
    if (act === "blender") { openApp("blender", { project: p.id, file: "3d.glb" }); return; }
    if (act === "cad") {
      var dxf = p.files.filter(function (f) { return /\.dxf$/i.test(f); })[0];
      openApp(firstInstalled(["cadcraft", "librecad", "freecad"]), { project: p.id, file: dxf }); return;
    }
    if (act === "render") {
      b.disabled = true; b.textContent = "กำลัง render…";
      api("/api/render", { project: p.id }).then(function (j) { pollJob(j.id, b, p); }).catch(function (er) { b.disabled = false; b.textContent = "Render (Blender)"; toast(er.message, true); });
    }
  });
  function firstInstalled(keys) {
    var a = state.status && state.status.apps;
    return keys.filter(function (k) { return a && a[k] && a[k].installed; })[0] || keys[0];
  }
  function openApp(app, target) {
    api("/api/open", Object.assign({ app: app }, target)).then(function (r) { toast("เปิด " + r.opened); }).catch(function (e) { toast(e.message, true); });
  }
  function pollJob(id, b, p) {
    api("/api/jobs/" + id).then(function (j) {
      if (j.state === "running") { setTimeout(function () { pollJob(id, b, p); }, 3000); return; }
      b.disabled = false; b.textContent = "Render (Blender)";
      if (j.state === "done") { toast("render เสร็จ → render.png"); loadProjects(); }
      else toast("render ไม่สำเร็จ: " + (j.log || "").slice(-300), true);
    });
  }
  $("#new-project").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target, body = { name: f.name.value, lat: num(f.lat.value), lon: num(f.lon.value), kwp: num(f.kwp.value) };
    api("/api/projects", body).then(function (p) { toast("สร้างโครงการ " + p.name); f.reset(); loadProjects(); }).catch(function (er) { toast(er.message, true); });
  });
  function num(v) { return v === "" || v == null ? null : Number(v); }

  // ---------------------------------------------------------------- ASC Studio: ทุกโฟลเดอร์ · ทุกไฟล์
  var asc = { folders: [], open: {} };
  var ICON = { cad: "📐", "3d": "🧊", image: "🖼", pdf: "📕", doc: "📝", html: "🌐", text: "📄", zip: "🗜", ascent: "☀️", "design-auto": "🏠",
               backup: "💾", "sld-json": "⚡", manual: "📘", json: "🔣", other: "📄" };
  var KIND = { design: "งานออกแบบ", sld: "SLD", docs: "เอกสาร" };
  function loadDesignAuto() {
    $("#da-list").innerHTML = '<p class="muted">กำลังอ่านโฟลเดอร์ ASC Studio…</p>';
    api("/api/asc/scan").then(function (r) {
      asc.folders = r.folders;
      if (!r.found) $("#da-path").textContent = "ไม่พบโฟลเดอร์ ASC Studio: " + r.root;
      else $("#da-path").textContent = "อ่านจาก " + r.root + " · " + r.folders.length + " โฟลเดอร์ · " +
        r.folders.reduce(function (s, f) { return s + f.count; }, 0).toLocaleString() + " ไฟล์";
      renderAsc();
    }).catch(function (er) { $("#da-list").innerHTML = '<p class="muted">' + esc(er.message) + "</p>"; });
  }
  function sizeTxt(n) { return n >= 1048576 ? fmt(n / 1048576, 1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }
  function fileGroup(t) { return t === "cad" ? "cad" : /json|ascent|design-auto|backup|manual/.test(t) ? "json" : t === "sld-json" ? "sld" : "doc"; }
  function fileRow(f) {
    var href = "/api/asc/file?path=" + encodeURIComponent(f.path), acts = "";
    if (f.type === "cad") acts = '<a class="btn small" href="cad/?file=' + encodeURIComponent("asc/" + f.path) + '" target="_blank">📐 CAD 2D</a>';
    if (/^(ascent|design-auto|backup|sld-json)$/.test(f.type)) acts += '<button class="btn small" data-file="' + esc(f.path) + '">นำเข้า</button>';
    if (f.type === "sld-json") acts += '<button class="btn small" data-sld="' + esc(f.path) + '">📐 CAD 2D</button>';
    if (f.type !== "cad" && f.type !== "3d") acts += '<a class="btn small ghost" href="' + href + '" target="_blank">' + (/doc|zip/.test(f.type) ? "ดาวน์โหลด" : "ดู") + "</a>";
    if (f.type === "3d") acts += '<a class="btn small ghost" href="' + href + '" download>ดาวน์โหลด</a>';
    return '<div class="frow" data-g="' + fileGroup(f.type) + '"><span class="fi">' + (ICON[f.type] || "📄") + '</span><span class="fn" title="' + esc(f.path) + '">' +
      esc(f.name) + '</span><small class="muted">' + sizeTxt(f.size) + "</small>" + acts + "</div>";
  }
  function workRow(w) {
    var vers = w.versions.length > 1 ? '<select data-ver>' + w.versions.slice().reverse().map(function (v) { return '<option value="' + v + '">รุ่น ' + v + (v === Math.max.apply(null, w.versions) ? " (ล่าสุด)" : "") + "</option>"; }).join("") + "</select>" : "";
    var info = [KIND[w.kind] || w.kind, w.kwp ? fmt(w.kwp, 2) + " kWp" : "", w.has_glb ? "มี 3D" : "", w.roof_dxf ? "หลังคา " + w.roof_dxf + " DXF" : "",
      w.sld ? "SLD " + w.sld + " แผ่น" : "", w.docs && w.docs.length ? w.docs.join(", ") : "", w.files + " ไฟล์", w.error ? "⚠ " + w.error : ""].filter(Boolean).join(" · ");
    var dt = (w.title.split(" · ")[1] || "");
    return '<div class="item work" data-g="' + (w.kind === "design" ? "design" : w.kind) + '"><div class="t"><b>' + esc(w.name || w.title) + "</b>" + (w.name && dt ? ' <small class="muted">' + esc(dt) + "</small>" : "") +
      "<small>" + esc(info) + "</small></div>" + vers +
      '<button class="btn small" data-folder="' + esc(w.folder) + '" data-prefix="' + esc(w.prefix) + '">นำเข้า</button></div>';
  }
  function renderAsc() {
    var q = ($("#asc-q").value || "").trim().toLowerCase(), ty = $("#asc-type").value;
    var html = asc.folders.map(function (fo, i) {
      var works = fo.works.filter(function (w) { return (!ty || ty === (w.kind === "design" ? "design" : w.kind === "sld" ? "sld" : "doc")) && (!q || (w.title + " " + (w.name || "") + " " + w.prefix).toLowerCase().indexOf(q) >= 0); });
      var files = fo.files.filter(function (f) { return (!ty || ty === fileGroup(f.type) || (ty === "design" && /ascent|design-auto|backup/.test(f.type))) && (!q || f.path.toLowerCase().indexOf(q) >= 0); });
      if ((q || ty) && !works.length && !files.length && fo.title.toLowerCase().indexOf(q) < 0) return "";
      var open = asc.open[fo.folder] || (q && (works.length || files.length)) ? " open" : "";
      return '<details class="afold" data-folder="' + esc(fo.folder) + '"' + open + "><summary><b>" + esc(fo.title) + '</b> <small class="muted">' + esc(fo.folder || "") + " · " +
        fo.count + " ไฟล์ · " + esc(fo.modified.replace("T", " ")) + (fo.works.length ? " · " + fo.works.length + " งาน" : "") + "</small></summary>" +
        works.map(workRow).join("") +
        (files.length ? '<details class="afiles"' + (q || !works.length ? " open" : "") + "><summary>ไฟล์ทั้งหมด (" + files.length + ")</summary>" + files.slice(0, 400).map(fileRow).join("") +
          (files.length > 400 ? '<p class="muted small">… อีก ' + (files.length - 400) + " ไฟล์ (พิมพ์ค้นเพื่อกรอง)</p>" : "") + "</details>" : "") + "</details>";
    }).join("");
    $("#da-list").innerHTML = html || '<p class="muted">ไม่พบ</p>';
  }
  $("#asc-q").addEventListener("input", function () { clearTimeout(renderAsc.t); renderAsc.t = setTimeout(renderAsc, 200); });
  $("#asc-type").addEventListener("change", renderAsc);
  $("#asc-reload").addEventListener("click", loadDesignAuto);
  $("#da-list").addEventListener("toggle", function (e) {
    var d = e.target; if (d.classList && d.classList.contains("afold")) asc.open[d.dataset.folder] = d.open;
  }, true);
  function imported(p, b) {
    toast("นำเข้า " + p.name + " (" + p.copied.length + " ไฟล์)"); b.textContent = "นำเข้าแล้ว ✓";
    var a = document.createElement("a"); a.className = "btn small"; a.href = "editor/?project=" + encodeURIComponent(p.id); a.textContent = "✏️ เปิดในตัวเขียนแบบ";
    b.after(a); loadProjects();
  }
  $("#da-list").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.dataset.sld != null) {                       // sld.json → เปิด sld.dxf คู่กัน (หรือแปลงเป็นโครงการแล้วเปิด)
      var dxf = b.dataset.sld.replace(/\.json$/i, ".dxf");
      var fo = asc.folders.filter(function (x) { return x.files.some(function (f) { return f.path === dxf; }); })[0];
      if (fo) { window.open("cad/?file=" + encodeURIComponent("asc/" + dxf), "_blank"); return; }
      b.disabled = true;
      api("/api/asc/import", { file: b.dataset.sld }).then(function (p) { window.open("cad/?file=" + encodeURIComponent("out/" + p.id + "/sld.dxf"), "_blank"); imported(p, b); })
        .catch(function (er) { b.disabled = false; toast(er.message, true); });
      return;
    }
    var body = b.dataset.file != null ? { file: b.dataset.file } : b.dataset.folder != null ? { folder: b.dataset.folder, prefix: b.dataset.prefix } : null;
    if (!body) return;
    var sel = b.parentNode.querySelector("select[data-ver]"); if (sel && body.prefix != null) body.version = Number(sel.value);
    b.disabled = true; b.textContent = "กำลังนำเข้า…";
    api("/api/asc/import", body).then(function (p) { imported(p, b); }).catch(function (er) { b.disabled = false; b.textContent = "นำเข้า"; toast(er.message, true); });
  });

  // ---------------------------------------------------------------- ผลผลิตไฟฟ้า
  function fillPresets(locs) {
    var sel = $("#yield-form [name=preset]");
    sel.innerHTML = '<option value="">—</option>' + Object.keys(locs || {}).map(function (k) { return '<option value="' + k + '">' + esc(locs[k].name) + "</option>"; }).join("");
    sel.onchange = function () { var l = locs[sel.value]; if (l) { var f = $("#yield-form"); f.lat.value = l.lat; f.lon.value = l.lon; } };
  }
  // ค่าที่ส่งมาจากตัวเขียนแบบ (แผงบนหลังคา) → ฟอร์มผลผลิตไฟฟ้า
  function prefillYield(q) {
    var f = $("#yield-form");
    var apply = function () {
      if (q.get("project")) { var p = state.projects.filter(function (x) { return x.id === q.get("project"); })[0]; if (p) useProject(p); }
      ["kwp", "tilt", "azimuth", "lat", "lon", "name"].forEach(function (k) { if (q.get(k)) f[k].value = q.get(k); });
      toast("รับค่าจากตัวเขียนแบบ: " + q.get("kwp") + " kWp · เอียง " + q.get("tilt") + "° · หัน " + q.get("azimuth") + "°");
    };
    if (CLOUD) apply(); else loadProjects().then(apply);
  }
  function useProject(p) {
    var f = $("#yield-form");
    f.project.value = p.id; f.name.value = p.name || "";
    ["lat", "lon", "kwp", "tilt", "azimuth", "dc_ac_ratio"].forEach(function (k) { if (p[k] != null) f[k].value = p[k]; });
    if (p.mount) f.mount.value = p.mount;
  }
  $("#yield-form [name=project]").addEventListener("change", function (e) {
    var p = state.projects.filter(function (x) { return x.id === e.target.value; })[0]; if (p) useProject(p);
  });
  $("#yield-form").addEventListener("submit", function (e) {
    e.preventDefault();
    if (CLOUD) return;
    var f = e.target, btn = $("button.primary", f);
    var body = { project: f.project.value || null, name: f.name.value, lat: num(f.lat.value), lon: num(f.lon.value), kwp: num(f.kwp.value),
                 tilt: num(f.tilt.value), azimuth: num(f.azimuth.value), dc_ac_ratio: num(f.dc_ac_ratio.value), mount: f.mount.value,
                 source: f.source.value, online: f.online.checked };
    btn.disabled = true; btn.textContent = "กำลังคำนวณ…";
    api("/api/yield", body).then(function (r) { renderYield(r); if (r.files) { toast("บันทึกผลลงโครงการแล้ว"); loadProjects(); } })
      .catch(function (er) { $("#yield-result").innerHTML = '<p class="no">' + esc(er.message) + "</p>"; })
      .then(function () { btn.disabled = false; btn.textContent = "คำนวณ"; });
  });
  function renderYield(r) {
    var s = r.system, sh = r.shading;
    var rows = r.monthly.map(function (m) { return "<tr><td>" + esc(m.name) + "</td><td>" + fmt(m.kwh) + "</td><td>" + fmt(m.poa_kwh_m2, 1) + "</td></tr>"; }).join("");
    $("#yield-meteo").textContent = r.meteo.source + " · " + r.meteo.file + " · ห่าง " + r.meteo.distance_km + " กม.";
    $("#yield-result").innerHTML =
      '<div class="kpi"><div>ผลิตได้ต่อปี<b>' + fmt(r.annual_kwh) + ' kWh</b></div><div>ต่อ kWp<b>' + fmt(r.specific_yield) +
      '</b></div><div>PR<b>' + fmt(r.pr, 2) + '</b></div><div>แสงบนแผง<b>' + fmt(r.poa_kwh_m2) + ' kWh/m²</b></div><div>เซลล์ร้อนสุด<b>' + fmt(r.max_t_cell, 0) + " °C</b></div></div>" +
      '<div class="chart">' + bars(r.monthly.map(function (m) { return m.kwh; }), r.monthly.map(function (m) { return m.name; })) + "</div>" +
      '<p class="small muted">' + fmt(s.kwp, 2) + " kWp · เอียง " + s.tilt + "° · ทิศ " + s.azimuth + "° · DC/AC " + s.dc_ac_ratio + " · การสูญเสีย " + s.losses_pct + "%" +
      (sh && sh.available ? " · เงาเส้นขอบฟ้า " + sh.annual_loss_pct + "%" : " · ไม่มีข้อมูลเส้นขอบฟ้า") + "</p>" +
      "<table><tr><th>เดือน</th><th>kWh</th><th>แสงบนแผง kWh/m²</th></tr>" + rows + "</table>" +
      '<p><button class="btn small" id="dl-asc">ดาวน์โหลด JSON ส่ง ASC</button> ' +
      (r.files ? '<a class="chip" target="_blank" href="/api/projects/' + encodeURIComponent($("#yield-form").project.value) + '/files/yield_pvlib.html">หน้ารายงาน</a>' : "") + "</p>";
    $("#dl-asc").onclick = function () { download("yield_pvlib.json", JSON.stringify(r, null, 2)); };
  }
  function bars(vals, labels) {
    var w = 640, h = 220, pl = 52, pb = 26, pt = 10, max = Math.max.apply(null, vals.concat([1])), bw = (w - pl - 8) / vals.length, out = [];
    out.push('<svg viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="พลังงานรายเดือน">');
    for (var i = 0; i <= 4; i++) {
      var y = pt + (h - pt - pb) * i / 4;
      out.push('<line x1="' + pl + '" y1="' + y + '" x2="' + (w - 4) + '" y2="' + y + '" stroke="currentColor" stroke-opacity=".15"/>');
      out.push('<text x="' + (pl - 6) + '" y="' + (y + 4) + '" font-size="11" text-anchor="end">' + fmt(max * (1 - i / 4)) + "</text>");
    }
    vals.forEach(function (v, i) {
      var bh = (h - pt - pb) * v / max, x = pl + i * bw + bw * 0.15;
      out.push('<rect x="' + x + '" y="' + (h - pb - bh) + '" width="' + bw * 0.7 + '" height="' + bh + '" rx="2" fill="#e8892b"><title>' + esc(labels[i]) + " " + fmt(v) + " kWh</title></rect>");
      out.push('<text x="' + (x + bw * 0.35) + '" y="' + (h - 8) + '" font-size="11" text-anchor="middle">' + esc(labels[i]) + "</text>");
    });
    return out.join("") + "</svg>";
  }
  function download(name, text) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "application/json" })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  $("#open-json").addEventListener("change", function (e) {
    var file = e.target.files[0]; if (!file) return;
    file.text().then(function (t) { var p = JSON.parse(t); useProject(Object.assign({ id: "" }, p.location || {}, p.system || {}, p)); showTab("yield"); toast("เปิด " + file.name); })
      .catch(function () { toast("อ่านไฟล์ไม่ได้", true); });
  });

  // ---------------------------------------------------------------- จัดสตริง
  function fillDefaults(d) {
    if (!d) return;
    var f = $("#str-form");
    Object.keys(d.module).forEach(function (k) { if (f["m_" + k]) f["m_" + k].placeholder = d.module[k]; });
    Object.keys(d.inverter).forEach(function (k) { if (f["i_" + k]) f["i_" + k].placeholder = d.inverter[k]; });
    f.t_min.placeholder = d.temps.t_min; f.t_cell_max.placeholder = d.temps.t_cell_max;
  }
  $("#str-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target, mod = {}, inv = {}, temps = {};
    $$("input", f).forEach(function (i) {
      if (i.value === "") return;
      if (i.name.indexOf("m_") === 0) mod[i.name.slice(2)] = Number(i.value);
      if (i.name.indexOf("i_") === 0) inv[i.name.slice(2)] = Number(i.value);
    });
    if (f.t_min.value) temps.t_min = Number(f.t_min.value);
    if (f.t_cell_max.value) temps.t_cell_max = Number(f.t_cell_max.value);
    var body = { modules: Number(f.modules.value), inverters: Number(f.inverters.value || 1), module: mod, inverter: inv, temps: temps };
    var run = CLOUD ? Promise.resolve(window.PAStrings.bestFill(body.modules, Object.assign({}, PAStrings.MODULE, mod), Object.assign({}, PAStrings.INVERTER, inv), temps, body.inverters))
                    : api("/api/strings", body);
    run.then(function (r) { renderStrings(r, body.modules); }).catch(function (er) { toast(er.message, true); });
  });
  function renderStrings(r, asked) {
    var l = r.limits, head = '<div class="kpi"><div>ความยาวสตริง<b>' + l.n_min + "–" + l.n_max + ' แผง</b></div><div>Voc เย็น/แผง<b>' + l.voc_cold +
      ' V</b></div><div>Vmp ร้อน/แผง<b>' + l.vmp_hot + ' V</b></div><div>ขนานได้/MPPT<b>' + l.parallel_per_mppt + " สตริง</b></div></div>";
    var note = r.modules !== asked ? '<p class="no">แผง ' + asked + " จัดลงตัวไม่ได้ → ใช้ " + r.modules + " แผง</p>" : "";
    if (r.layouts[0] && r.layouts[0].imp_clip) note += '<p class="small no">แบบ ★ ขนานสตริงจนกระแสใช้งานต่อ MPPT เกินพิกัด → จะเกิด clipping ฝั่ง DC</p>';
    var rows = r.layouts.slice(0, 8).map(function (x, i) {
      return "<tr><td>" + (i === 0 ? "★ " : "") + x.modules_per_string + " × " + x.strings + "</td><td>" + x.kwp + "</td><td>" + x.dc_ac_ratio +
        "</td><td>" + x.voc_cold + "</td><td>" + x.vmp_hot + "</td><td>" + x.strings_per_mppt_max + (x.imp_clip ? " ⚠" : "") + "</td></tr>";
    }).join("");
    $("#str-result").innerHTML = head + note + (rows ? "<table><tr><th>แผง × สตริง</th><th>kWp</th><th>DC/AC</th><th>Voc เย็น V</th><th>Vmp ร้อน V</th><th>สตริง/MPPT</th></tr>" + rows + "</table>" : '<p class="no">ไม่มีแบบที่ผ่านเงื่อนไข</p>');
  }

  // ---------------------------------------------------------------- คลังสัญลักษณ์ + แม่แบบ
  function loadCatalog() {
    if (state.catalog) { renderLibrary(); return; }
    fetch("library/catalog.json").then(function (r) { return r.json(); }).then(function (c) {
      state.catalog = c;
      var groups = {}; c.symbols.forEach(function (s) { groups[s.group] = 1; });
      $("#lib-group").innerHTML = '<option value="">ทุกหมวด</option>' + Object.keys(groups).map(function (g) { return "<option>" + esc(g) + "</option>"; }).join("");
      $("#lib-files").innerHTML = c.libraries.map(function (l) { return '<a class="chip" href="' + esc(l.file) + '" download>⬇ ' + esc(l.file.split("/").pop()) + " (" + l.count + ")</a>"; }).join("");
      $("#tpl-list").innerHTML = c.templates.map(function (t) {
        return '<div class="item"><div class="t"><b>' + esc(t.file.split("/").pop()) + "</b><small>" + esc(t.th) + '</small></div><a class="btn small" href="' + esc(t.file) +
          '" download>ดาวน์โหลด</a>' + (CLOUD ? "" : '<button class="btn small" data-lib="' + esc(t.file) + '">เปิดในโปรแกรม CAD</button>') + "</div>";
      }).join("");
      renderLibrary(); homeCards();
    }).catch(function () { $("#lib-grid").innerHTML = '<p class="muted">ยังไม่มีคลัง — รัน python -m cad.build</p>'; });
  }
  function renderLibrary() {
    var c = state.catalog; if (!c) return;
    var q = $("#lib-q").value.trim().toLowerCase(), g = $("#lib-group").value;
    var list = c.symbols.filter(function (s) {
      return (!g || s.group === g) && (!q || (s.name + " " + s.th + " " + s.en).toLowerCase().indexOf(q) >= 0);
    });
    $("#lib-grid").innerHTML = list.map(function (s) {
      return '<div class="sym" title="' + esc(s.note + (s.attributes.length ? " · attribute: " + s.attributes.join(", ") : "")) + '"><img loading="lazy" src="' + esc(s.svg) + '" alt=""><b>' +
        esc(s.name) + "</b><span>" + esc(s.th) + "</span></div>";
    }).join("") || '<p class="muted">ไม่พบ</p>';
  }
  $("#lib-q").addEventListener("input", renderLibrary);
  $("#lib-group").addEventListener("change", renderLibrary);
  $("#tpl-list").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-lib]"); if (!b) return;
    openApp(firstInstalled(["cadcraft", "librecad", "freecad"]), { library: b.dataset.lib });
  });

  function appCards() {
    var a = state.status.apps;
    $("#app-list").innerHTML = Object.keys(a).map(function (k) {
      var x = a[k];
      return card(x.name, x.installed ? "ติดตั้งแล้ว" : "ยังไม่ติดตั้ง", x.installed ? x.path : "วางไว้ที่ " + state.status.apps_dir + "\\" + x.folder, x.installed ? "ok" : "no");
    }).join("");
  }

  init();
})();
