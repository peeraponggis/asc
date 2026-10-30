/* ============================================================================
 *  ASC Studio (ascs) ใต้ ASC Cloud — สวิตช์เปิดใช้
 *  ----------------------------------------------------------------------------
 *  ascs คือโปรแกรมออกแบบ 3D ที่วางไว้ในโฟลเดอร์ studio/ (build จาก repo design-auto
 *  ด้วย  npm run build:cloud  — ดู docs/asc-cloud-merge-plan.md ใน repo นั้น)
 *  ใช้หน้าเข้าสู่ระบบ · Dashboard · สิทธิ์ · การแชร์ ของ ASC Cloud ชุดเดิมทั้งหมด
 *
 *  enabled : false = ปิด ascs ทั้งระบบ (Dashboard ทำงานแบบเดิมทุกอย่าง)
 *  rollout : 'admin' = เฉพาะผู้ดูแลระบบ + ทีมพัฒนา (ช่วงทดลอง)
 *            'all'   = ทุกคน — "สร้างโปรเจกต์ใหม่" เปิดด้วย ascs และงานเดิมมีปุ่ม "เปิดใน ASCS"
 *  teamDomains : โดเมนอีเมลของทีมพัฒนา ใช้ ascs ได้แม้ rollout = 'admin'
 *            (สิทธิ์สมัครของโดเมนตั้งที่ตาราง allowed_domains — supabase/allow-domains.sql)
 *  งานที่สร้างใน ascs แล้วเปิดใน ascs เสมอ ไม่ว่าตั้ง rollout เป็นอะไร
 * ========================================================================== */
window.ASCS_STUDIO = {
    enabled    : true,
    rollout    : 'admin',
    teamDomains: ['proinventive.co.th'],
    path       : 'studio/'
};
