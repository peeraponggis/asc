// ASC Architect — ชั้นกั้นของรุ่นออนไลน์ (ASC Cloud › architec) · ลุงพีสั่ง 22 พ.ย. 2569 (งาน A แบบ 1)
//   รุ่นในเครื่องใช้ server /api/gate (asc_link.py) อยู่แล้ว ไฟล์นี้ออกจากการทำงานทันทีเมื่อ PA_MODE !== "cloud"
//   รุ่นออนไลน์: ต้องเข้าสู่ระบบ ASC Cloud ก่อน + แพ็กเกจต้องมีความสามารถ asca (เหมือน desktop 0.31.4)
//     · ยังไม่ล็อกอิน / ล็อกเอาท์ระหว่างเปิดค้าง = หน้าจอ "ต้องเข้าสู่ระบบก่อนใช้งาน" + ปุ่มไปหน้าเข้าสู่ระบบ
//     · ล็อกอินแล้วแต่ features.asca ไม่เป็น true = หน้าจอ "แพ็กเกจนี้ไม่รวมโปรแกรมนี้" (ข้อความเดียวกับรุ่นในเครื่อง)
//     · ผู้ดูแลระบบ/@proinventive.co.th (state exempt) ได้ features ครบจากฐานข้อมูล = ผ่านเสมอ
//     · ไม่มี asc-cloud.js / ยังไม่รัน SQL / อ่านสิทธิ์ไม่ได้ = ไม่บล็อก (แนวเดียวกับรุ่นในเครื่อง)
//     · suspended · expired · busy ปล่อยให้ asc-cloud.js กั้นเอง (ไม่แสดงซ้อน)
//   ใส่ไว้ทุกหน้าของ ASCA (index · editor · cad · manual) — scripts/build_cloud.py แทรก supabase + asc-cloud.js ให้ตามความลึกของหน้า
(function () {
  "use strict";
  if (window.PA_MODE !== "cloud") return;

  var TXT = {
    login: {
      icon: "🔒",
      title: { th: "ต้องเข้าสู่ระบบก่อนใช้งาน", lo: "ຕ້ອງເຂົ້າສູ່ລະບົບກ່ອນໃຊ້ງານ", en: "Please sign in first" },
      message: {
        th: "ASC Architect ออนไลน์ใช้บัญชีเดียวกับ ASC Enterprise เข้าสู่ระบบด้วยอีเมลของคุณ แล้วเปิด ASC Architect จากเมนูอีกครั้ง",
        lo: "ASC Architect ອອນລາຍໃຊ້ບັນຊີດຽວກັບ ASC Enterprise ເຂົ້າສູ່ລະບົບດ້ວຍອີເມວຂອງທ່ານ ແລ້ວເປີດ ASC Architect ຈາກເມນູອີກຄັ້ງ",
        en: "ASC Architect online uses your ASC Enterprise account. Sign in with your email, then open ASC Architect from the menu again."
      }
    },
    feature: {
      icon: "🧾",
      title: { th: "แพ็กเกจนี้ไม่รวมโปรแกรมนี้", lo: "ແພັກເກັດນີ້ບໍ່ລວມໂປຣແກຣມນີ້", en: "Your package does not include this program" },
      message: { th: "ติดต่อผู้ดูแลระบบเพื่อเปลี่ยนแพ็กเกจ", lo: "ຕິດຕໍ່ຜູ້ດູແລລະບົບເພື່ອປ່ຽນແພັກເກັດ", en: "Contact the administrator to change your package." }
    }
  };
  var BTN = {
    signin: { th: "ไปหน้าเข้าสู่ระบบ", lo: "ໄປໜ້າເຂົ້າສູ່ລະບົບ", en: "Go to sign in" },
    home: { th: "กลับหน้าหลัก ASC", lo: "ກັບໜ້າຫຼັກ ASC", en: "Back to ASC home" },
    retry: { th: "ลองอีกครั้ง", lo: "ລອງອີກຄັ້ງ", en: "Try again" }
  };

  function lang() {
    var l = String(document.documentElement.lang || navigator.language || "th").slice(0, 2).toLowerCase();
    return ["th", "lo", "en"].indexOf(l) >= 0 ? l : "th";
  }
  function pick(m) { var L = lang(); return (m && (m[L] || m.th)) || ""; }

  // หน้าหลัก ASC Enterprise = โฟลเดอร์แม่ของ architec (ASCA อยู่ที่ <ราก>/architec/ · หน้าย่อยอยู่ลึกอีกชั้น)
  function ascHome() {
    var p = location.pathname.replace(/\/+$/, "/");
    var i = p.toLowerCase().lastIndexOf("/architec/");
    return i >= 0 ? location.origin + p.slice(0, i + 1) : "../";
  }

  var shown = null;      // "login" | "feature" | null
  var timer = null;

  function hide() {
    var e = document.getElementById("asca-gate");
    if (e) e.remove();
    shown = null;
    if (!window.__ascAccessBlocked && !window.__ascMaint) document.documentElement.style.overflow = "";
  }

  function show(kind) {
    if (shown === kind) return;
    if (shown) hide();
    shown = kind;
    var t = TXT[kind];
    var box = document.createElement("div");
    box.id = "asca-gate";
    box.setAttribute("role", "alertdialog");
    box.style.cssText = "position:fixed;inset:0;z-index:2147483645;display:flex;align-items:center;justify-content:center;padding:24px;"
      + "background:linear-gradient(160deg,#16213a,#2a3a5e);color:#fff;font-family:Sarabun,Kanit,Tahoma,sans-serif;text-align:center";
    box.innerHTML = '<div style="max-width:540px"><div data-icon style="font-size:52px"></div>'
      + '<h1 style="font-size:24px;margin:10px 0 8px;font-weight:700"></h1>'
      + '<p style="font-size:15px;line-height:1.7;opacity:.92;margin:0 0 18px"></p>'
      + '<div data-row style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"></div></div>';
    box.querySelector("[data-icon]").textContent = t.icon;
    box.querySelector("h1").textContent = pick(t.title);
    box.querySelector("p").textContent = pick(t.message);
    var row = box.querySelector("[data-row]");
    var mk = function (label, fn, primary) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.style.cssText = "font:inherit;padding:9px 22px;border-radius:10px;cursor:pointer;border:1px solid #8fb0e0;color:#fff;background:" + (primary ? "#2f6fd1" : "transparent");
      b.onclick = fn;
      row.appendChild(b);
    };
    var L = lang();
    if (kind === "login") {
      mk(BTN.signin[L], function () { location.href = ascHome(); }, true);
      mk(BTN.retry[L], function () { location.reload(); });
    } else {
      mk(BTN.home[L], function () { location.href = ascHome(); }, true);
    }
    var put = function () {
      if (shown === kind && !document.getElementById("asca-gate")) (document.body || document.documentElement).appendChild(box);
      if (shown === kind) document.documentElement.style.overflow = "hidden";
    };
    put();
    if (!timer) timer = setInterval(put, 1000);                 // หน้าโปรแกรมวาดทับ/ลบ node ไม่ได้
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", put);
  }

  // สิทธิ์ที่ asc-cloud.js อ่านมาแล้ว (my_access) — null/อ่านไม่ได้ = ไม่บล็อก
  function verdict(profile) {
    if (!profile) return "login";
    var acc = profile.access;
    if (!acc || acc.ok === false) return null;                  // ยังไม่รัน SQL / เรียกไม่สำเร็จ = ไม่บล็อก
    if (["suspended", "expired", "busy"].indexOf(acc.state) >= 0) return null;   // asc-cloud.js กั้นเอง
    var f = acc.features;
    if (!f || typeof f !== "object") return null;               // ไม่รู้ความสามารถ = ไม่บล็อก
    return f.asca === true ? null : "feature";
  }

  function apply(profile) {
    var v = verdict(profile);
    if (v) show(v); else hide();
  }

  function start() {
    var AC = window.AscCloud;
    if (!AC || !AC.enabled || !AC.ready) return;                // ไม่มีชั้นบัญชี = ไม่บล็อก (เปิดไฟล์ตรง/ทดสอบ)
    AC.ready().then(apply, function () { /* อ่านไม่ได้ = ไม่บล็อก */ });     // ไม่ครอบ apply ด้วย catch: ข้อผิดพลาดของชั้นกั้นต้องขึ้น console ไม่ใช่เงียบหาย
    if (AC.onAuthChange) AC.onAuthChange(apply);                // ล็อกเอาท์/สลับบัญชีระหว่างเปิดค้าง
  }

  // asc-cloud.js โหลดก่อนไฟล์นี้ (build_cloud.py แทรกไว้เหนือกัน) · เผื่อยังไม่พร้อม รออีกไม่เกิน 5 วินาที
  if (window.AscCloud) start();
  else {
    var n = 0;
    var w = setInterval(function () {
      if (window.AscCloud || ++n > 50) { clearInterval(w); start(); }
    }, 100);
  }
})();
