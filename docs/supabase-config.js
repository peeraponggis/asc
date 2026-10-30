/* ============================================================================
 *  Auto Solar Co-pilot Studio (ASC Studio / ASCS)
 *  Copyright (C) 2024-2569 ProInventive. All rights reserved.
 *
 *  PROPRIETARY AND CONFIDENTIAL
 *  This software is the exclusive property of ProInventive.
 *  Unauthorized copying, reverse engineering, decompilation, or distribution
 *  of this file, in whole or in part, is strictly prohibited.
 *
 *  License : Proprietary -- see EULA at https://proinventive.co.th/asc-eula
 *  Author  : Peerapong (Lungpee) -- ProInventive -- giskku@gmail.com
 * ========================================================================== */
/* ============================================================================
 *  ตั้งค่าการเชื่อมต่อ Supabase
 *  ----------------------------------------------------------------------------
 *  หาค่าสองตัวนี้ได้ที่  Supabase Dashboard > Project Settings > API
 *
 *    SUPABASE_URL       ช่อง "Project URL"
 *    SUPABASE_ANON_KEY  ช่อง "anon" / "public"
 *                       โปรเจกต์รุ่นใหม่จะเป็นคีย์ที่ขึ้นต้นด้วย sb_publishable_
 *                       ซึ่งใช้แทนกันได้ และเป็นคีย์ฝั่งผู้ใช้เหมือนกัน
 *
 *  ⚠ ใส่ได้เฉพาะคีย์ anon เท่านั้น
 *    คีย์นี้ออกแบบมาให้เปิดเผยในโค้ดฝั่งเบราว์เซอร์ได้ ความปลอดภัยมาจาก
 *    Row Level Security ในฐานข้อมูล ไม่ใช่จากการซ่อนคีย์
 *
 *    ห้ามใส่คีย์ service_role ในไฟล์นี้เด็ดขาด คีย์นั้นข้าม RLS ได้ทั้งหมด
 *    ถ้าหลุดขึ้นเว็บ ใครก็อ่านและลบข้อมูลของทุกคนได้
 *
 *  ตราบใดที่ยังไม่ได้ใส่ค่า ระบบจะทำงานแบบเดิม (เก็บในเครื่อง) ต่อไปตามปกติ
 * ========================================================================== */

window.SUPABASE_URL      = 'https://rcaslesvgilknupqmwrp.supabase.co';
window.SUPABASE_ANON_KEY = 'sb_publishable_CI5Y4LzcJ3A8rPinxKmVyA_GvUS0Ba6';
