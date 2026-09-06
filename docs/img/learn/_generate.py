# -*- coding: utf-8 -*-
"""สร้างภาพประกอบ Quick Learning ทั้ง 6 ขั้นเป็น SVG

ทำไมเป็นไดอะแกรม ไม่ใช่ภาพจับหน้าจอ
  ลองจับภาพหน้าจอจริงด้วย html-to-image แล้วออกมาใช้ไม่ได้ ไทล์ดาวเทียมหาย
  ไอคอนกลายเป็นกล่องสี่เหลี่ยม และแผงบนหลังคาไม่ถูกวาด
  ไดอะแกรมที่วาดเองจึงตรงกับของจริงมากกว่าภาพจับที่เพี้ยน ไฟล์เล็กกว่ามาก
  ไม่มีข้อมูลลูกค้าติดไปด้วย และไม่เก่าแบบเงียบ ๆ เมื่อหน้าจอเปลี่ยนสี
  โครงข้อมูลใน steps.th.json รองรับภาพจริงอยู่แล้ว วันหลังวางทับได้เลย
"""
import io, os, math

OUT = (r"F:\Data\data\data\data\data\data\00-อ.พี\NEW Project\01-ProInventive"
       r"\00-Pro-Pi\Ai\14-Pi\git\asc\docs\img\learn")
os.makedirs(OUT, exist_ok=True)

W, H = 960, 540
FONT = "'Sarabun','Segoe UI',system-ui,sans-serif"

HEAD = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}"
     role="img" aria-label="{alt}">
  <title>{alt}</title>
  <style>
    text {{ font-family: {font}; }}
    .h  {{ font-size: 21px; font-weight: 700; fill: #0f172a; }}
    .s  {{ font-size: 14px; fill: #64748b; }}
    .l  {{ font-size: 13px; fill: #334155; }}
    .ll {{ font-size: 11.5px; fill: #64748b; }}
    .n  {{ font-size: 13px; font-weight: 700; fill: #fff; }}
    .card {{ fill: #fff; stroke: #e2e8f0; }}
    .pulse {{ animation: p 2.4s ease-in-out infinite; transform-origin: center; }}
    @keyframes p {{ 0%,100% {{ opacity: 1 }} 50% {{ opacity: .38 }} }}
    @media (prefers-reduced-motion: reduce) {{ .pulse {{ animation: none }} }}
  </style>
  <rect width="{w}" height="{h}" rx="14" fill="#f8fafc"/>
'''

def card(x, y, w, h, r=10, fill='#fff', stroke='#e2e8f0'):
    return ('  <rect x="%g" y="%g" width="%g" height="%g" rx="%g" fill="%s" stroke="%s"/>\n'
            % (x, y, w, h, r, fill, stroke))

def text(x, y, s, cls='l', anchor='start', extra=''):
    return '  <text x="%g" y="%g" class="%s" text-anchor="%s"%s>%s</text>\n' % (x, y, cls, anchor, extra, s)

def head(n, title, sub, colour):
    o  = '  <circle cx="46" cy="46" r="19" fill="%s"/>\n' % colour
    o += text(46, 51, str(n), 'n', 'middle')
    o += text(76, 42, title, 'h')
    o += text(76, 64, sub, 's')
    return o

def chip(x, y, w, label, fill, stroke, tcol='#0f172a', h=26, cls=''):
    o = '  <rect x="%g" y="%g" width="%g" height="%g" rx="13" fill="%s" stroke="%s"%s/>\n' % (
        x, y, w, h, fill, stroke, (' class="%s"' % cls) if cls else '')
    o += '  <text x="%g" y="%g" class="ll" fill="%s" text-anchor="middle">%s</text>\n' % (
        x + w / 2, y + h / 2 + 4, tcol, label)
    return o

def arrow(x1, y1, x2, y2, col='#94a3b8'):
    return ('  <path d="M%g %g L%g %g" stroke="%s" stroke-width="2" fill="none" marker-end="url(#a)"/>\n'
            % (x1, y1, x2, y2, col))

DEFS = ('  <defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" '
        'orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#94a3b8"/></marker></defs>\n')

def write(name, alt, body):
    s = HEAD.format(w=W, h=H, alt=alt, font=FONT) + DEFS + body + '</svg>\n'
    io.open(os.path.join(OUT, name), 'w', encoding='utf-8', newline='\n').write(s)
    print('  %-22s %5.1f KB' % (name, len(s.encode('utf-8')) / 1024.0))


# ── 1 · วิเคราะห์ค่าไฟ ────────────────────────────────────────────────────
b = head(1, 'วิเคราะห์ค่าไฟ', 'รู้ก่อนว่าลูกค้าใช้ไฟเท่าไร และใช้ตอนไหน', '#2563eb')
b += card(40, 96, 250, 170)
b += text(60, 124, 'นำเข้าข้อมูล', 'l')
b += chip(60, 138, 210, 'บิลค่าไฟ · กรอกเอง 12 เดือน', '#eff6ff', '#bfdbfe', '#1e40af')
b += text(146, 182, 'หรือ', 'll', 'middle')
b += chip(60, 192, 210, 'ไฟล์ AMR จากการไฟฟ้า', '#eff6ff', '#bfdbfe', '#1e40af')
b += text(60, 240, 'AMR ให้ข้อมูลรายชั่วโมง แม่นกว่ามาก', 'll')
b += arrow(300, 180, 340, 180)
b += card(352, 96, 268, 170)
b += text(372, 122, 'หน่วยที่ใช้รายเดือน', 'l')
vals = [62, 78, 92, 110, 104, 88, 96, 118, 100, 84, 72, 66]
for i, v in enumerate(vals):
    b += '  <rect x="%g" y="%g" width="16" height="%g" rx="3" fill="#3b82f6"/>\n' % (
        372 + i * 20.5, 248 - v, v)
b += text(372, 262, 'ม.ค.', 'll')
b += text(600, 262, 'ธ.ค.', 'll', 'end')
b += arrow(630, 180, 670, 180)
b += card(682, 96, 238, 170)
b += text(702, 122, 'สัดส่วนกลางวัน', 'l')
b += '  <circle cx="801" cy="192" r="56" fill="#e2e8f0"/>\n'
# ชิ้นพายต้องกินพื้นที่ 64 % จริง ไม่ใช่ราวหนึ่งในสี่ จึงคำนวณปลายส่วนโค้งเอา
_a = math.radians(0.64 * 360)
b += ('  <path d="M801 192 L801 136 A56 56 0 1 1 %.1f %.1f z" fill="#f59e0b" class="pulse"/>\n'
      % (801 + 56 * math.sin(_a), 192 - 56 * math.cos(_a)))
b += text(801, 198, '64 %', 'l', 'middle', ' font-weight="700" font-size="19"')
b += text(702, 262, 'ยิ่งใช้ไฟกลางวันมาก ยิ่งคุ้ม', 'll')
b += card(40, 292, 880, 78, 10, '#f0fdfa', '#99f6e4')
b += text(64, 322, 'ได้อะไรจากขั้นนี้', 'l', 'start', ' font-weight="700" fill="#0f766e"')
b += text(64, 348, 'ค่าไฟต่อหน่วยจริง · ความต้องการใช้ไฟรายชั่วโมง · ขนาดระบบที่เหมาะกับโหลด', 'l')
b += card(40, 396, 880, 108, 10, '#fff', '#e2e8f0')
b += text(64, 426, 'ส่งออก DB0 ก่อนไปขั้นถัดไป', 'l', 'start', ' font-weight="700"')
b += text(64, 452, 'ไฟล์ DB0 พาค่าไฟและรูปแบบการใช้ไฟไปให้ขั้นออกแบบและขั้นรายงานใช้ต่อ', 'l')
b += text(64, 478, 'ข้ามขั้นนี้ได้ถ้ายังไม่มีบิล แต่ตัวเลขคืนทุนจะเป็นค่าสมมติ', 'll')
write('01-bill.svg', 'ขั้นที่ 1 วิเคราะห์ค่าไฟจากบิลหรือไฟล์ AMR', b)


# ── 2 · ข้อมูลโครงการและอุปกรณ์ ──────────────────────────────────────────
b = head(2, 'ข้อมูลโครงการและเลือกอุปกรณ์', 'ปักหมุดที่ตั้ง แล้วเลือกอุปกรณ์จากคลัง', '#0891b2')
b += card(40, 96, 420, 190)
b += text(62, 124, 'ขั้นที่ 1 · ข้อมูลโครงการ', 'l', 'start', ' font-weight="700"')
for i, (k, v) in enumerate([('ชื่อโครงการ', 'โครงการตัวอย่าง'),
                            ('พิกัด', '13.6631, 100.8965'),
                            ('ประเภทการขออนุญาต', 'ขนานไฟ')]):
    y = 146 + i * 40
    b += text(62, y + 16, k, 'll')
    b += card(62, y + 22, 376, 26, 6, '#f8fafc', '#e2e8f0')
    b += text(72, y + 40, v, 'l')
b += card(474, 96, 446, 190)
b += text(496, 124, 'ขั้นที่ 2 · สเปกอุปกรณ์', 'l', 'start', ' font-weight="700"')
b += text(496, 150, 'เลือกยี่ห้อ แล้วเลือกรุ่น จากคลัง 155 รายการ', 'll')
for i, (k, brand, model) in enumerate([('PV', 'Sunpro', 'SPDG650'),
                                       ('INV', 'Huawei', 'SUN2000-300KTL')]):
    y = 168 + i * 52
    b += chip(496, y, 52, k, '#0f766e', '#0f766e', '#fff', 24)
    b += card(558, y, 150, 24, 6, '#f8fafc', '#cbd5e1')
    b += text(568, y + 17, brand, 'll')
    b += text(697, y + 17, '▾', 'll', 'end')
    b += card(718, y, 184, 24, 6, '#f8fafc', '#cbd5e1',)
    b += text(728, y + 17, model, 'll')
    b += text(891, y + 17, '▾', 'll', 'end')
b += card(40, 312, 880, 82, 10, '#fffbeb', '#fde68a')
b += text(64, 342, 'ไม่มีรุ่นที่ต้องการในคลัง', 'l', 'start', ' font-weight="700" fill="#92400e"')
b += text(64, 368, 'อัปโหลดไฟล์ดาต้าชีตเองได้ในช่องสำรองใต้ตัวเลือก · ผู้ดูแลระบบเพิ่มเข้าคลังกลางได้ที่หน้า Settings', 'l')
b += card(40, 414, 880, 90, 10, '#f0fdfa', '#99f6e4')
b += text(64, 444, 'ทำไมต้องเลือกอุปกรณ์ก่อนวาดหลังคา', 'l', 'start', ' font-weight="700" fill="#0f766e"')
b += text(64, 470, 'โปรแกรมใช้ขนาดแผงจริงในการวางกริด และใช้สเปกอินเวอร์เตอร์ในการคิดจำนวนแผงต่อสตริง', 'l')
b += text(64, 492, 'ถ้าเปลี่ยนรุ่นทีหลัง ผังแผงกับสตริงจะถูกคิดใหม่ทั้งหมด', 'll')
write('02-project.svg', 'ขั้นที่ 2 กรอกข้อมูลโครงการและเลือกอุปกรณ์จากคลัง', b)


# ── 3 · วาดหลังคาและวางแผง ───────────────────────────────────────────────
b = head(3, 'วาดหลังคาและวางแผง', 'ลากขอบหลังคาบนภาพดาวเทียม แล้วโปรแกรมจัดแผงให้', '#f59e0b')
b += card(40, 96, 500, 300, 10, '#dbeafe', '#93c5fd')
b += ('  <path d="M92 300 L160 132 L438 168 L372 336 z" fill="#fed7aa" stroke="#ea580c" '
      'stroke-width="2.5" class="pulse"/>\n')
# กริดแผงต้องอยู่ในกรอบหลังคาเท่านั้น จึงตัดด้วย clipPath ตามรูปหลังคาจริง
# และเว้นรอบสิ่งกีดขวาง เหมือนที่โปรแกรมทำ ไม่ใช่วางทับลงไปเฉย ๆ
b += ('  <clipPath id="roof"><path d="M92 300 L160 132 L438 168 L372 336 z"/></clipPath>\n'
      '  <g clip-path="url(#roof)">\n')
KX, KY, KR = 300, 250, 44
for r in range(8):
    for c in range(13):
        x = 108 + c * 27 + r * 10.5
        y = 148 + r * 26
        cx, cy = x + 11, y + 9.5
        if (cx - KX) ** 2 + (cy - KY) ** 2 < KR * KR:
            continue
        b += ('    <rect x="%g" y="%g" width="22" height="19" rx="2" fill="#1e3a8a" '
              'stroke="#93c5fd" stroke-width=".6" opacity=".92"/>\n' % (x, y))
b += '  </g>\n'
b += '  <circle cx="300" cy="250" r="34" fill="#f87171" stroke="#dc2626" opacity=".8"/>\n'
b += text(300, 254, 'สิ่งกีดขวาง', 'll', 'middle', ' fill="#7f1d1d"')
b += text(60, 380, 'ขอบส้ม = ขอบหลังคา · น้ำเงิน = แผง · วงแดง = พื้นที่ห้ามวาง', 'll')
b += card(556, 96, 364, 300)
b += text(578, 124, 'โปรแกรมทำให้อัตโนมัติ', 'l', 'start', ' font-weight="700"')
for i, t in enumerate(['หาทิศและความชันของหลังคาแต่ละผืน',
                       'เว้นระยะขอบและทางเดินตามที่ตั้งไว้',
                       'จัดกริดแผงตามขนาดแผงจริง',
                       'แบ่งสตริงตามสเปกอินเวอร์เตอร์',
                       'คิดเงาบังจากต้นไม้และอาคารข้างเคียง']):
    y = 152 + i * 34
    b += '  <circle cx="590" cy="%g" r="4" fill="#0f766e"/>\n' % (y + 8)
    b += text(606, y + 13, t, 'l')
b += card(578, 330, 320, 48, 8, '#f0fdf4', '#bbf7d0')
b += text(594, 350, 'PV 480 แผง · 312.00 kWp', 'l', 'start', ' font-weight="700" fill="#166534"')
b += text(594, 370, 'ตัวเลขขึ้นสดที่แถบล่างของหน้าจอ', 'll')
b += card(40, 414, 880, 90, 10, '#fffbeb', '#fde68a')
b += text(64, 444, 'ภาพดาวเทียมไม่ชัดพอ', 'l', 'start', ' font-weight="700" fill="#92400e"')
b += text(64, 470, 'ใส่คีย์ของตัวเองเพื่อดูภาพลึกกว่าเดิม หรือใช้เครื่องมือตรึงภาพโดรนด้วยจุดควบคุม', 'l')
b += text(64, 492, 'ซึ่งให้ความละเอียดสูงกว่าภาพดาวเทียมของทุกเจ้า', 'll')
write('03-layout.svg', 'ขั้นที่ 3 วาดขอบหลังคาบนภาพดาวเทียมแล้ววางแผง', b)


# ── 4 · วิศวกรรมและตรวจแบบ ───────────────────────────────────────────────
b = head(4, 'งานวิศวกรรมและตรวจแบบ', 'ได้รายการวัสดุ ผังไฟฟ้า และผลตรวจตามมาตรฐาน', '#7c3aed')
b += card(40, 96, 430, 200)
b += text(62, 124, 'รายการวัสดุ (BOM)', 'l', 'start', ' font-weight="700"')
for i, (a, c) in enumerate([('แผง Sunpro SPDG650', '480 แผง'),
                            ('อินเวอร์เตอร์ SUN2000-300KTL', '2 ตัว'),
                            ('เบรกเกอร์ AC', '400 AT'),
                            ('SPD ฝั่ง DC และ AC', 'Type II'),
                            ('ป้ายตาม วสท. บทที่ 6', '3 ชุด')]):
    y = 146 + i * 29
    b += '  <line x1="62" y1="%g" x2="448" y2="%g" stroke="#f1f5f9"/>\n' % (y, y)
    b += text(62, y + 20, a, 'l')
    b += text(448, y + 20, c, 'l', 'end')
b += card(486, 96, 434, 200)
b += text(508, 124, 'ตรวจแบบ 36 ข้อ', 'l', 'start', ' font-weight="700"')
b += text(508, 146, 'อ้างข้อของ วสท. 022013-25 ได้ทุกข้อ', 'll')
for i, (ico, col, bg, t) in enumerate([
        ('!', '#991b1b', '#fef2f2', 'DC/AC 1.56 สูงเกิน อินเวอร์เตอร์จะตัดยอดกำลัง'),
        ('!', '#92400e', '#fffbeb', 'แรงดันสตริงที่อากาศเย็นเข้าใกล้พิกัด'),
        ('/', '#166534', '#f0fdf4', 'ขนาดฟิวส์สตริงอยู่ในช่วงที่มาตรฐานกำหนด')]):
    y = 162 + i * 42
    b += card(508, y, 390, 34, 6, bg, bg)
    b += '  <rect x="508" y="%g" width="3" height="34" fill="%s"/>\n' % (y, col)
    b += '  <text x="524" y="%g" class="l" fill="%s" font-weight="700">%s</text>\n' % (y + 23, col, ico)
    b += text(542, y + 23, t, 'l')
b += card(40, 316, 430, 92, 10, '#f8fafc', '#e2e8f0')
b += text(62, 344, 'ผังไฟฟ้า (SLD)', 'l', 'start', ' font-weight="700"')
b += ('  <path d="M70 380 h58 v-14 h48 v14 h58 v-14 h48 v14 h58" stroke="#475569" stroke-width="2" '
      'fill="none"/>\n')
b += '  <rect x="286" y="360" width="46" height="34" rx="4" fill="#dbeafe" stroke="#2563eb"/>\n'
b += text(309, 382, 'INV', 'll', 'middle', ' fill="#1e40af"')
b += text(360, 382, 'สร้างให้อัตโนมัติ', 'll')
b += card(486, 316, 434, 92, 10, '#f0fdfa', '#99f6e4')
b += text(508, 344, 'ผู้ช่วย ASC Copilot', 'l', 'start', ' font-weight="700" fill="#0f766e"')
b += text(508, 370, 'ปุ่มมุมขวาล่าง ถามเป็นภาษาไทยได้ว่าข้อที่ไม่ผ่านแปลว่าอะไร', 'l')
b += text(508, 392, 'และควรแก้อย่างไร ทำงานในเครื่อง ไม่ได้ใช้ AI', 'll')
b += card(40, 428, 880, 76, 10, '#fffbeb', '#fde68a')
b += text(64, 458, 'ต้องกด Generate BOM ใหม่ทุกครั้งที่แก้แบบ', 'l', 'start', ' font-weight="700" fill="#92400e"')
b += text(64, 484, 'ไม่งั้นรายการวัสดุกับราคาในใบเสนอราคาจะยังเป็นของแบบเดิม', 'l')
write('04-engineering.svg', 'ขั้นที่ 4 รายการวัสดุ ผังไฟฟ้า และผลตรวจแบบ', b)


# ── 5 · สามมิติและผังอุปกรณ์ ─────────────────────────────────────────────
b = head(5, 'แบบจำลองสามมิติและผังอุปกรณ์', 'เห็นเงาตกจริงตามเวลา และวางอุปกรณ์บนภาพหน้างาน', '#4f46e5')
b += card(40, 96, 470, 292, 10, '#1e293b', '#334155')
b += '  <circle cx="430" cy="150" r="22" fill="#fbbf24" class="pulse"/>\n'
b += text(430, 190, 'ดวงอาทิตย์ตามวันเวลาจริง', 'll', 'middle', ' fill="#cbd5e1"')
# กล่องอาคารแบบไอโซเมตริก มุมบนสี่มุมคือ A B C D ผนังต้องบรรจบที่มุม D พอดี
# ไม่งั้นจะเห็นรอยบากตรงสันหน้าอาคาร
AX, AY = 120, 232          # มุมซ้าย
BX, BY = 268, 190          # มุมหลัง
CX, CY = 400, 224          # มุมขวา
DX, DY = AX + (CX - BX), AY + (CY - BY)   # มุมหน้า
HH = 88                    # ความสูงผนัง
b += ('  <path d="M%g %g L%g %g L%g %g L%g %g z" fill="#0f172a" opacity=".38"/>\n'
      % (AX, AY + HH, DX, DY + HH, CX + 46, CY + HH + 14, DX + 46, DY + HH + 52))
b += ('  <path d="M%g %g L%g %g L%g %g L%g %g z" fill="#cbd5e1" stroke="#94a3b8"/>\n'
      % (AX, AY, DX, DY, DX, DY + HH, AX, AY + HH))
b += ('  <path d="M%g %g L%g %g L%g %g L%g %g z" fill="#94a3b8" stroke="#64748b"/>\n'
      % (DX, DY, CX, CY, CX, CY + HH, DX, DY + HH))
b += ('  <path d="M%g %g L%g %g L%g %g L%g %g z" fill="#e2e8f0" stroke="#94a3b8"/>\n'
      % (AX, AY, BX, BY, CX, CY, DX, DY))
# แผงวางบนหน้าหลังคาด้วยเวกเตอร์สองแกนของระนาบนั้น จะได้เอียงไปตามรูปทรง
UX, UY = BX - AX, BY - AY
VX, VY = DX - AX, DY - AY
for r in range(4):
    for c in range(6):
        fu, fv = 0.07 + c * 0.152, 0.10 + r * 0.215
        px, py = AX + UX * fu + VX * fv, AY + UY * fu + VY * fv
        du, dv = 0.125, 0.175
        b += ('  <path d="M%.1f %.1f l%.1f %.1f l%.1f %.1f l%.1f %.1f z" fill="#1e3a8a" '
              'stroke="#3b82f6" stroke-width=".6"/>\n'
              % (px, py, UX * du, UY * du, VX * dv, VY * dv, -UX * du, -UY * du))
b += text(64, 372, 'ลากเมาส์หมุนดูรอบอาคาร · เลื่อนแถบเวลาเพื่อดูเงาตอนเช้าและบ่าย', 'll', 'start', ' fill="#94a3b8"')
b += card(526, 96, 394, 138)
b += text(548, 124, 'ส่งออกได้สองแบบ', 'l', 'start', ' font-weight="700"')
b += chip(548, 140, 160, 'ภาพนิ่ง PNG', '#eff6ff', '#bfdbfe', '#1e40af')
b += chip(720, 140, 178, 'โมเดล .glb', '#f0fdfa', '#99f6e4', '#0f766e')
b += text(548, 196, 'ไฟล์ .glb แนบใน PowerPoint แล้วหมุนดูตอนนำเสนอได้', 'll')
b += text(548, 216, 'หน่วยเป็นเมตรตามขนาดจริง', 'll')
b += card(526, 250, 394, 138)
b += text(548, 278, 'เมนู 4 · วางผังอุปกรณ์', 'l', 'start', ' font-weight="700"')
b += text(548, 302, 'ถ่ายภาพผนังห้องไฟฟ้าหน้างาน ปรับเทียบขนาดผนัง', 'l')
b += text(548, 324, 'แล้ววางอินเวอร์เตอร์และตู้ไฟตามขนาดจริง', 'l')
b += card(548, 336, 350, 36, 6, '#fffbeb', '#fde68a')
b += text(562, 359, 'ขั้นปรับเทียบผนังสำคัญที่สุด ข้ามไปขนาดจะเพี้ยนหมด', 'll', 'start', ' fill="#92400e"')
b += card(40, 408, 880, 96, 10, '#fffbeb', '#fde68a')
b += text(64, 438, 'ไฟล์ DB2 รุ่นเก่าจะขึ้นแต่กล่องอาคาร ไม่มีแผง', 'l', 'start', ' font-weight="700" fill="#92400e"')
b += text(64, 464, 'เพราะยังไม่มีขอบเขตหลังคาและตำแหน่งแผงอยู่ในไฟล์ ให้เปิดโครงการในหน้าออกแบบ', 'l')
b += text(64, 486, 'แล้วส่งออก DB2 ใหม่ หน้าสามมิติจะบอกเองว่าไฟล์ขาดอะไร', 'l')
write('05-3d.svg', 'ขั้นที่ 5 แบบจำลองสามมิติและการวางผังอุปกรณ์', b)


# ── 6 · รายงานและเอกสาร ──────────────────────────────────────────────────
b = head(6, 'รายงานและเอกสารส่งลูกค้า', 'จำลองผลผลิตรายชั่วโมงทั้งปี แล้วออกเอกสารชุดเต็ม', '#0f766e')
b += card(40, 96, 470, 210)
b += text(62, 124, 'ผลจำลองรายชั่วโมง 8,760 ชั่วโมง', 'l', 'start', ' font-weight="700"')
pts = [(0, 8), (1, 14), (2, 30), (3, 52), (4, 74), (5, 88), (6, 96), (7, 92),
       (8, 80), (9, 58), (10, 34), (11, 16), (12, 6)]
path = ' '.join('%s%g %g' % ('M' if i == 0 else 'L', 74 + x * 33, 272 - v * 1.35)
                for i, (x, v) in enumerate(pts))
b += '  <path d="%s" stroke="#0f766e" stroke-width="2.5" fill="none"/>\n' % path
b += '  <path d="%s L470 272 L74 272 z" fill="#0f766e" opacity=".12"/>\n' % path
b += '  <line x1="74" y1="272" x2="478" y2="272" stroke="#cbd5e1"/>\n'
b += text(74, 292, '06:00', 'll')
b += text(478, 292, '18:00', 'll', 'end')
b += card(526, 96, 394, 210)
b += text(548, 124, 'เอกสารที่ได้', 'l', 'start', ' font-weight="700"')
for i, (t, d) in enumerate([('รายงานวิศวกรรม PDF', 'ไทยหรืออังกฤษ เลือกก่อนส่งออก'),
                            ('เอกสารข้อเสนอลูกค้า', 'Word หรือ PDF'),
                            ('ใบเสนอราคา', 'อิงรายการวัสดุจริง'),
                            ('ใบสั่งงานช่าง', 'บรีฟก่อนออกหน้างาน')]):
    y = 144 + i * 40
    b += card(548, y, 350, 34, 6, '#f8fafc', '#e2e8f0')
    b += text(564, y + 16, t, 'l')
    b += text(564, y + 30, d, 'll')
b += card(40, 326, 430, 82, 10, '#f0fdf4', '#bbf7d0')
b += text(64, 356, 'ตัวเลขการเงิน', 'l', 'start', ' font-weight="700" fill="#166534"')
b += text(64, 382, 'คืนทุน · IRR · NPV · P50 P75 P90', 'l')
b += card(490, 326, 430, 82, 10, '#eff6ff', '#bfdbfe')
b += text(514, 356, 'คำอธิบายใต้ทุกกราฟ', 'l', 'start', ' font-weight="700" fill="#1e40af"')
b += text(514, 382, 'อธิบายว่ากราฟนั้นบอกอะไร และควรดูตรงไหน', 'l')
b += card(40, 428, 880, 76, 10, '#f0fdfa', '#99f6e4')
b += text(64, 458, 'ครบวงจรแล้ว', 'l', 'start', ' font-weight="700" fill="#0f766e"')
b += text(64, 484, 'จากบิลค่าไฟใบเดียว ได้แบบ ผลจำลอง รายการวัสดุ ราคา และเอกสารส่งลูกค้าครบชุด', 'l')
write('06-report.svg', 'ขั้นที่ 6 รายงานผลจำลองและเอกสารส่งลูกค้า', b)

print('\nเสร็จ 6 ไฟล์')
