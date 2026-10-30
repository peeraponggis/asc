// ตำแหน่งดวงอาทิตย์จากพิกัด + วันเวลาท้องถิ่น (สูตร NOAA แบบย่อ · คลาดเคลื่อน < 0.5°) — ใช้ทำเงาตามเวลาจริง (โดย ลุงพี)
// คืน { az (0 = เหนือ ตามเข็ม), el (มุมเงย องศา) }
export function sunPosition(lat, lon, date, tzHours = 7) {
  const rad = Math.PI / 180;
  const y = date.getFullYear(), start = Date.UTC(y, 0, 1);
  const local = Date.UTC(y, date.getMonth(), date.getDate(), date.getHours(), date.getMinutes());
  const doy = Math.floor((local - start) / 86400000) + 1, hour = date.getHours() + date.getMinutes() / 60;
  const g = ((2 * Math.PI) / 365) * (doy - 1 + (hour - 12) / 24);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g)
    - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const tst = hour * 60 + eqt + 4 * lon - 60 * tzHours;          // เวลาสุริยะจริง (นาที)
  const ha = (tst / 4 - 180) * rad;
  const phi = lat * rad;
  const cosZ = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(ha);
  const zen = Math.acos(Math.max(-1, Math.min(1, cosZ)));
  let az = Math.acos(Math.max(-1, Math.min(1, (Math.sin(phi) * Math.cos(zen) - Math.sin(decl)) / (Math.cos(phi) * Math.sin(zen) || 1e-9)))) / rad;
  az = ha > 0 ? (az + 180) % 360 : (540 - az) % 360;
  return { az: Math.round(az * 10) / 10, el: Math.round((90 - zen / rad) * 10) / 10 };
}
