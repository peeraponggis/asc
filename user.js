/* ==========================================================================
   user.js  —  ฐานข้อมูลผู้ใช้งาน (แหล่งข้อมูลจริงเพียงที่เดียว)
   --------------------------------------------------------------------------
   ไฟล์นี้ถูกเรียกใช้โดย
     - index.html   (หน้า Login)
     - user.html    (ไฟล์เดิม เก็บไว้เพื่อความเข้ากันได้ย้อนหลัง)

   เพิ่ม/ลบผู้ใช้ ให้แก้ที่ไฟล์นี้ไฟล์เดียวเท่านั้น

   ⚠️ ข้อควรทราบด้านความปลอดภัย
   การเก็บรหัสผ่านเป็นข้อความธรรมดาในไฟล์ฝั่งเบราว์เซอร์ ใครก็ตามที่เปิด
   หน้าเว็บนี้สามารถกด View Source แล้วเห็นรหัสผ่านทั้งหมดได้
   เหมาะกับการใช้งานภายในองค์กร/ทดสอบเท่านั้น
   หากจะใช้งานจริงบนอินเทอร์เน็ต ต้องย้ายการตรวจสอบไปฝั่งเซิร์ฟเวอร์
   (เช่น Firebase Authentication) แล้วให้ไฟล์นี้เหลือแค่การเรียก API
   ========================================================================== */

const users = {
    "maxsupajit@gmail.com": "maxsupajit",
    "stg.energy2015@gmail.com": "#s#!IpSEmh",
    "sm0610603003@gmail.com": "sm0610603003",
    "chairuj.ka@gmail.com": "b0lhVCskyu",
    "parinya.is@gmail.com": "parinya.is",
    "waraxxx98@gmail.com": "2^6^TFrBTj",
    "pranpipat55@gmail.com": "AIcFqgyvcg",
    "aec.rooftop@gmail.com": "ymQacAMVtC",
    "onnetjoy@gmail.com": "i2WTzDl@%r",
    "beliefgroups@gmail.com": "fWeRAAk$MC",
    "surakarn232@gmail.com": "bukA%oGpRR",
    "songsri.en@gmail.com": "7Ykne@O3sE",
    "supachaimulachiwa@gmail.com": "7fzDPI2las",
    "pongsakorn.kongng@gmail.com": "2ohZcYVa8l",
    "supaporn.ruekudom@gmail.com": "EUHcLpZ9MI",
    "thunderinno.office@gmail.com": "93JQzX#lPy",
    "anuchit221237@gmail.com": "15*PtQ6e3N",
    "naphat.niti168@gmail.com": "I@UwRLWCwl",
    "kanittha.fastpro@gmail.com": "9wzNF&sKk&",
    "panadda101261@gmail.com": "R%Idw7UwiI",
    "s_ativat@hotmail.com": "bm1p8Kj@#B",
    "pariphatkaewinta@gmail.com": "9kB@I8D@ya",
    "Petpong250@gmail.com": "ZAJVZtT@Ol",
    "Sishejj6@gmail.com": "TH@u96ET1a",
    "soukhameesai@gmail.com": "aLUs6sT@8s",
    "skay70852@gmail.com": "cURD40cCd2",
    "I.am.ngamsomchai@gmail.com": "bdMPblg$M&",
    "somyos1259wang@gmail.com": "YVh7qxib5y",
    "bkhardware888@gmail.com": "IMr%AGLdPw",
    "patarapol777@gmail.com": "tnm%h0r&WQ",
    "ducksmall2010@gamil.com": "036VPFJzLo",
    "Suphachok2707@gmail.com": "e48xGVYv4r",
    "chaleepdy@gmail.com": "q8G*wV2Bx5",
    "canny070459@gmail.com": "IwdWl6FJ%F",
    "Kheiywbideddeiyw@gmail.com": "4B3Gnv5dUP",
    "montri123a@gmail.com": "g$7Ji8ShN!",
    "Passonjumleanphaiboonphon@gmail.com": "D7Fg49%1&m",
    "sanitphanthawas@gmail.com": "So9ahYOwqa",
    "supet": "1234",
    "lpee": "1234",
    "pat": "1234"
};

/* รายชื่อผู้ดูแลระบบ — เห็น Recent Projects ของผู้ใช้ทุกคน (เทียบแบบไม่สนตัวพิมพ์ใหญ่-เล็ก) */
const ADMIN_USERS = ["lpee"];

/* ตรวจสอบชื่อผู้ใช้และรหัสผ่าน
   - ชื่อผู้ใช้ไม่สนตัวพิมพ์ใหญ่-เล็ก (Lpee / lpee / LPEE ใช้ได้หมด)
   - รหัสผ่านต้องตรงทุกตัวอักษร */
function findUserKey(username) {
    if (!username) return null;
    const target = String(username).trim().toLowerCase();
    return Object.keys(users).find(k => k.toLowerCase() === target) || null;
}

function validateUser(username, password) {
    const key = findUserKey(username);
    if (!key) return false;
    return users[key] === password;
}

function isAdminUser(username) {
    if (!username) return false;
    return ADMIN_USERS.includes(String(username).trim().toLowerCase());
}

/* แปลงชื่อผู้ใช้ให้อ่านง่ายขึ้นสำหรับแสดงบนหน้าจอ
   maxsupajit@gmail.com -> maxsupajit   |   lpee -> lpee */
function displayNameOf(username) {
    const key = findUserKey(username) || username || '';
    return key.includes('@') ? key.split('@')[0] : key;
}

/* เปิดให้ไฟล์อื่นเรียกใช้ได้ทั้งแบบ global และแบบ window.UserDB */
if (typeof window !== 'undefined') {
    window.users = users;
    window.validateUser = validateUser;
    window.isAdminUser = isAdminUser;
    window.displayNameOf = displayNameOf;
    window.UserDB = { users, validateUser, isAdminUser, displayNameOf, ADMIN_USERS };
}
