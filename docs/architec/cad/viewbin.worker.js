// ถอดไฟล์เส้นไบนารีของไฟล์ CAD ใหญ่ (server/core/cadpart.write_bin) นอกหน้าหลัก — หน้าไม่ค้างระหว่างโหลด (โดย ลุงพี)
// หัว 32 ไบต์: 'AVB1' · จำนวนเส้น · จำนวนตัวเลข · 0 · จุดอ้างอิง x, y (float64) → จำนวนตัวเลขต่อเส้น (uint32) · ปิดรูป (uint8 เติมครบ 4) · พิกัด float32
self.onmessage = async (ev) => {
  try {
    const r = await fetch(ev.data.url);
    if (!r.ok) throw new Error("โหลดเส้นไม่ได้ (HTTP " + r.status + ") — เปิดไฟล์อีกครั้ง");
    const buf = await r.arrayBuffer(), dv = new DataView(buf);
    if (dv.getUint32(0, true) !== 0x31425641) throw new Error("ไฟล์เส้นผิดรูปแบบ");   // "AVB1"
    const n = dv.getUint32(4, true), nf = dv.getUint32(8, true), ox = dv.getFloat64(16, true), oy = dv.getFloat64(24, true);
    const counts = new Uint32Array(buf, 32, n).slice();
    const fo = 32 + 4 * n, flags = new Uint8Array(buf, fo, n).slice();
    const f32 = new Float32Array(buf, fo + n + ((4 - (n % 4)) % 4), nf);
    const xy = new Float64Array(nf);
    for (let i = 0; i < nf; i += 2) { xy[i] = f32[i] + ox; xy[i + 1] = f32[i + 1] + oy; }
    self.postMessage({ counts, flags, xy, bytes: buf.byteLength }, [counts.buffer, flags.buffer, xy.buffer]);
  } catch (e) { self.postMessage({ error: e.message }); }
};
