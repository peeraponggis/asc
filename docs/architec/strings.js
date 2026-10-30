// จัดสตริงในเบราว์เซอร์ (รุ่นออนไลน์) — ตรรกะเดียวกับ pvlib_solar/string_optimizer.py ทุกบรรทัด (โดย ลุงพี)
(function (g) {
  "use strict";
  var MODULE = { pmax: 550, voc: 49.9, isc: 14.0, vmp: 41.9, imp: 13.13, beta_voc: -0.27, alpha_isc: 0.045, gamma_pmax: -0.35 };
  var INVERTER = { pac: 10000, vdc_max: 1100, vmppt_min: 200, vmppt_max: 1000, vstart: 200, mppt: 2, imax_mppt: 26, isc_max_mppt: 40, strings_per_mppt: 2 };
  var TEMPS = { t_min: 10, t_cell_max: 75 };

  function atTemp(v, beta, t) { return v * (1 + beta / 100 * (t - 25)); }
  function r(v, n) { var k = Math.pow(10, n); return Math.round(v * k) / k; }

  function limits(m, inv, temps) {
    var t = Object.assign({}, TEMPS, temps || {});
    var beta = m.beta_voc != null ? m.beta_voc : -0.27;
    var betaVmp = m.gamma_pmax != null ? m.gamma_pmax : beta;
    var vocCold = atTemp(m.voc, beta, t.t_min), vmpCold = atTemp(m.vmp, betaVmp, t.t_min), vmpHot = atTemp(m.vmp, betaVmp, t.t_cell_max);
    var vmax = Math.min(inv.vdc_max, m.v_sys_max || inv.vdc_max);
    var nVoc = Math.floor(vmax / vocCold), nMppt = Math.floor(inv.vmppt_max / vmpCold);
    var nMin = Math.ceil(Math.max(inv.vmppt_min, inv.vstart || 0) / vmpHot);
    var iscD = m.isc * 1.25;
    var parIsc = iscD > 0 ? Math.floor((inv.isc_max_mppt != null ? inv.isc_max_mppt : inv.imax_mppt * 1.5) / iscD) : 0;
    var par = parIsc ? Math.min(inv.strings_per_mppt != null ? inv.strings_per_mppt : parIsc, parIsc) : 0;
    return { voc_cold: r(vocCold, 2), vmp_cold: r(vmpCold, 2), vmp_hot: r(vmpHot, 2), n_min: nMin, n_max: Math.min(nVoc, nMppt),
             n_max_by_voc: nVoc, n_max_by_mppt: nMppt, parallel_per_mppt: par, vdc_limit: vmax, temps: t,
             imp_clip: m.imp * Math.max(par, 1) > inv.imax_mppt };
  }

  function layouts(n, m, inv, temps, inverters) {
    inverters = inverters || 1;
    var lim = limits(m, inv, temps), out = [];
    var mpptTotal = inv.mppt * inverters, cap = mpptTotal * lim.parallel_per_mppt;
    for (var k = lim.n_min; k <= lim.n_max; k++) {
      if (k <= 0 || n % k) continue;
      var s = n / k;
      if (s > cap || s < 1) continue;
      var perMppt = Math.ceil(s / mpptTotal), kwp = n * m.pmax / 1000, dcac = kwp * 1000 / (inv.pac * inverters);
      var vmp = k * m.vmp, mid = (inv.vmppt_min + inv.vmppt_max) / 2;
      var score = Math.abs(dcac - 1.2) * 2 + Math.abs(vmp - mid) / mid + (perMppt - 1) * 0.1;
      out.push({ modules_per_string: k, strings: s, strings_per_mppt_max: perMppt, mppt_used: Math.min(s, mpptTotal), kwp: r(kwp, 3),
                 dc_ac_ratio: r(dcac, 3), vmp_stc: r(vmp, 1), voc_cold: r(k * lim.voc_cold, 1), vmp_hot: r(k * lim.vmp_hot, 1), score: r(score, 4),
                 imp_clip: m.imp * perMppt > inv.imax_mppt });
    }
    out.sort(function (a, b) { return a.score - b.score; });
    return { limits: lim, layouts: out };
  }

  function bestFill(max, m, inv, temps, inverters) {
    for (var n = Math.floor(max); n > 0; n--) {
      var res = layouts(n, m, inv, temps, inverters);
      if (res.layouts.length) return Object.assign({ modules: n }, res);
    }
    return Object.assign({ modules: 0 }, layouts(0, m, inv, temps, inverters));
  }

  g.PAStrings = { MODULE: MODULE, INVERTER: INVERTER, TEMPS: TEMPS, limits: limits, layouts: layouts, bestFill: bestFill };
  if (typeof module !== "undefined") module.exports = g.PAStrings;
})(typeof window !== "undefined" ? window : globalThis);
