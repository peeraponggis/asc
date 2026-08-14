/* ==========================================================================
   user.js  —  ฐานข้อมูลผู้ใช้งาน (แหล่งข้อมูลจริงเพียงที่เดียว)
   --------------------------------------------------------------------------
   สร้างจากหน้า Settings > จัดการผู้ใช้
   โดย Lpee  เมื่อ 14/8/2569 16:04:15
   จำนวนผู้ใช้ทั้งหมด 42 บัญชี

   วิธีนำไปใช้: วางไฟล์นี้ทับ user.js เดิมใน repo แล้ว commit + push
   ========================================================================== */

const users = {
    "aec.rooftop@gmail.com": "ymQacAMVtC",
    "anuchit221237@gmail.com": "15*PtQ6e3N",
    "beliefgroups@gmail.com": "fWeRAAk$MC",
    "bkhardware888@gmail.com": "IMr%AGLdPw",
    "canny070459@gmail.com": "IwdWl6FJ%F",
    "chairuj.ka@gmail.com": "b0lhVCskyu",
    "chaleepdy@gmail.com": "q8G*wV2Bx5",
    "ducksmall2010@gamil.com": "036VPFJzLo",
    "I.am.ngamsomchai@gmail.com": "bdMPblg$M&",
    "kanittha.fastpro@gmail.com": "9wzNF&sKk&",
    "KB": "123456",
    "Kheiywbideddeiyw@gmail.com": "4B3Gnv5dUP",
    "lpee": "1234",
    "maxsupajit@gmail.com": "maxsupajit",
    "montri123a@gmail.com": "g$7Ji8ShN!",
    "naphat.niti168@gmail.com": "I@UwRLWCwl",
    "onnetjoy@gmail.com": "i2WTzDl@%r",
    "panadda101261@gmail.com": "R%Idw7UwiI",
    "parinya.is@gmail.com": "parinya.is",
    "pariphatkaewinta@gmail.com": "9kB@I8D@ya",
    "Passonjumleanphaiboonphon@gmail.com": "D7Fg49%1&m",
    "pat": "1234",
    "patarapol777@gmail.com": "tnm%h0r&WQ",
    "Petpong250@gmail.com": "ZAJVZtT@Ol",
    "pongsakorn.kongng@gmail.com": "2ohZcYVa8l",
    "pranpipat55@gmail.com": "AIcFqgyvcg",
    "s_ativat@hotmail.com": "bm1p8Kj@#B",
    "sanitphanthawas@gmail.com": "So9ahYOwqa",
    "Sishejj6@gmail.com": "TH@u96ET1a",
    "skay70852@gmail.com": "cURD40cCd2",
    "sm0610603003@gmail.com": "sm0610603003",
    "somyos1259wang@gmail.com": "YVh7qxib5y",
    "songsri.en@gmail.com": "7Ykne@O3sE",
    "soukhameesai@gmail.com": "aLUs6sT@8s",
    "stg.energy2015@gmail.com": "#s#!IpSEmh",
    "supachaimulachiwa@gmail.com": "7fzDPI2las",
    "supaporn.ruekudom@gmail.com": "EUHcLpZ9MI",
    "supet": "1234",
    "Suphachok2707@gmail.com": "e48xGVYv4r",
    "surakarn232@gmail.com": "bukA%oGpRR",
    "thunderinno.office@gmail.com": "93JQzX#lPy",
    "waraxxx98@gmail.com": "2^6^TFrBTj"
};

/* รายชื่อผู้ดูแลระบบ — เห็น Recent Projects ของผู้ใช้ทุกคน */
const ADMIN_USERS = ["lpee"];

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

function displayNameOf(username) {
    const key = findUserKey(username) || username || '';
    return key.includes('@') ? key.split('@')[0] : key;
}

if (typeof window !== 'undefined') {
    window.users = users;
    window.validateUser = validateUser;
    window.isAdminUser = isAdminUser;
    window.displayNameOf = displayNameOf;
    window.UserDB = { users, validateUser, isAdminUser, displayNameOf, ADMIN_USERS };
}
