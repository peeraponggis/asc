/* ==========================================================================
   user.js  —  ฐานข้อมูลผู้ใช้งาน (แหล่งข้อมูลจริงเพียงที่เดียว)
   --------------------------------------------------------------------------
   ไฟล์นี้ถูกเรียกใช้โดย
     - index.html   (หน้า Login)
     - user.html    (ไฟล์เดิม เก็บไว้เพื่อความเข้ากันได้ย้อนหลัง)

   เพิ่ม/ลบผู้ใช้ ให้แก้ที่ไฟล์นี้ไฟล์เดียวเท่านั้น
   หรือใช้หน้า Settings > จัดการผู้ใช้ แล้วกดสร้างไฟล์ฉบับใหม่

   🔐 รหัสผ่านถูกเก็บเป็นค่าแฮช ไม่ใช่ข้อความธรรมดาอีกต่อไป
   รูปแบบ  sha256$<ค่าแฮช>  ของข้อความ  เกลือ|ชื่อผู้ใช้ตัวพิมพ์เล็ก|รหัสผ่าน
   เกลือรายบัญชีทำให้คนที่ใช้รหัสเดียวกันได้ค่าแฮชต่างกัน เทียบข้ามบัญชีไม่ได้

   ⚠️ ข้อจำกัดที่ต้องเข้าใจ
   การตรวจรหัสผ่านฝั่งเบราว์เซอร์ไม่ใช่ระบบที่ปลอดภัยจริง การเก็บเป็นแฮช
   ทำให้ไฟล์นี้ไม่ใช่รายการรหัสผ่านที่อ่านได้ทันทีเท่านั้น แต่คนที่ตั้งใจจริง
   ยังสุ่มเดารหัสที่สั้นหรือคาดเดาง่ายได้อยู่ ควรตั้งรหัสยาวและไม่ซ้ำที่อื่น
   หากจะใช้งานจริงบนอินเทอร์เน็ต ควรย้ายการตรวจสอบไปฝั่งเซิร์ฟเวอร์
   (เช่น Firebase Authentication) แล้วให้ไฟล์นี้เหลือแค่การเรียก API
   ========================================================================== */

/* SHA-256 แบบทำงานทันที ไม่ต้องรอ Promise
   ใช้แทน crypto.subtle ที่เป็น async เพราะจุดที่เรียกตรวจรหัสผ่านเป็นโค้ดแบบซิงโครนัส
   ถ้าเปลี่ยนเป็น async ต้องไล่แก้ทุกจุดที่เรียกและเสี่ยงพลาด */
const SHA256 = (function () {
  const K = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ];
  const rr = (x, n) => (x >>> n) | (x << (32 - n));

  /* แปลงข้อความเป็นไบต์แบบ UTF-8 รองรับอักษรไทยและอักขระพิเศษในรหัสผ่าน */
  function utf8(str) {
    const out = [];
    for (let i = 0; i < str.length; i++) {
      let c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
        const c2 = str.charCodeAt(++i);
        c = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff);
        out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }

  return function sha256Hex(str) {
    const bytes = utf8(str);
    const bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    /* ความยาวเป็นบิตแบบ 64 บิต big-endian — ข้อความยาวไม่เกิน 2^32 บิตจึงเติมศูนย์สี่ไบต์แรก */
    bytes.push(0, 0, 0, 0,
      (bitLen >>> 24) & 255, (bitLen >>> 16) & 255, (bitLen >>> 8) & 255, bitLen & 255);

    let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,
        h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
    const w = new Array(64);

    for (let i = 0; i < bytes.length; i += 64) {
      for (let t = 0; t < 16; t++) {
        w[t] = (bytes[i+t*4] << 24) | (bytes[i+t*4+1] << 16) | (bytes[i+t*4+2] << 8) | bytes[i+t*4+3];
      }
      for (let t = 16; t < 64; t++) {
        const s0 = rr(w[t-15],7) ^ rr(w[t-15],18) ^ (w[t-15] >>> 3);
        const s1 = rr(w[t-2],17) ^ rr(w[t-2],19) ^ (w[t-2] >>> 10);
        w[t] = (w[t-16] + s0 + w[t-7] + s1) | 0;
      }
      let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,hh=h7;
      for (let t = 0; t < 64; t++) {
        const S1 = rr(e,6) ^ rr(e,11) ^ rr(e,25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (hh + S1 + ch + K[t] + w[t]) | 0;
        const S0 = rr(a,2) ^ rr(a,13) ^ rr(a,22);
        const mj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + mj) | 0;
        hh=g; g=f; f=e; e=(d + t1)|0; d=c; c=b; b=a; a=(t1 + t2)|0;
      }
      h0=(h0+a)|0; h1=(h1+b)|0; h2=(h2+c)|0; h3=(h3+d)|0;
      h4=(h4+e)|0; h5=(h5+f)|0; h6=(h6+g)|0; h7=(h7+hh)|0;
    }
    return [h0,h1,h2,h3,h4,h5,h6,h7]
      .map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
  };
})();
/* เกลือประจำระบบ เปลี่ยนค่านี้เมื่อไหร่ ค่าแฮชเดิมทั้งหมดจะใช้ไม่ได้ทันที */
const PW_SALT = 'ProInventive-ASC-2026';

function hashPw(username, password) {
    return 'sha256$' + SHA256(PW_SALT + '|' +
        String(username || '').trim().toLowerCase() + '|' + String(password == null ? '' : password));
}

/* เทียบรหัสผ่านกับค่าที่เก็บไว้
   ค่าที่ขึ้นต้นด้วย sha256$ จะถูกเทียบแบบแฮช ส่วนค่าอื่นถือเป็นข้อความธรรมดา
   เพื่อให้ผู้ใช้ที่เพิ่มเองในเครื่อง (ยังไม่ได้แฮช) ยังล็อกอินได้ตามปกติ */
function pwMatches(stored, username, password) {
    if (typeof stored !== 'string') return false;
    if (stored.indexOf('sha256$') === 0) return stored === hashPw(username, password);
    return stored === password;
}

const users = {
    "maxsupajit@gmail.com": "sha256$d75cec95285d82c8568c142566a312812f37ef2d516d79f7afa9ebb6cf6df511",
    "stg.energy2015@gmail.com": "sha256$0df08ef4479770660c056fe5e1dcac5de99c41ee780794398ead8057ccaa2c4a",
    "sm0610603003@gmail.com": "sha256$b82f1a4fbfa1428a915446e78990762f200eb792c697345f4cabecdfddb21bfb",
    "chairuj.ka@gmail.com": "sha256$d265380e16fbaa395c46d3e500791d5745e647c4d120ce4dc17ab3db6cf081cb",
    "parinya.is@gmail.com": "sha256$eda15a87890152b11a55d33c49b9b19c6826770f8294e5589af7701bee905ec5",
    "waraxxx98@gmail.com": "sha256$7682552cdc7a217133e925ccf20a6d16641edac623c7073d493179471bc804d2",
    "pranpipat55@gmail.com": "sha256$43124de89267858fde2125a995b71e029c1e50a785a6a7cc1a49e3d48533d454",
    "aec.rooftop@gmail.com": "sha256$b0eadf27f47b4c59b3d3fc70777b025fc71f5134ca80967d037fdad69f8ca7d4",
    "onnetjoy@gmail.com": "sha256$44f3ed4ee001776be94ab23b71e7410613153bee7a0d639de490e8436738e562",
    "beliefgroups@gmail.com": "sha256$802468330cbe1e9434eb8acceb286751710c188a0ab94ce88f0d81083521b373",
    "surakarn232@gmail.com": "sha256$3046766fe06c2b4e1e9be626cce0a821523d534a97a611dfcb77c554982f6e2e",
    "songsri.en@gmail.com": "sha256$c60df6af4053aff21d5b71f7de5f205b32a23b297486b66415335f6363619ee4",
    "supachaimulachiwa@gmail.com": "sha256$7d7791c2c34a25d9d763d7b57e0fa3d89af7ff30b4a4d5c06c34dea15e5223c6",
    "pongsakorn.kongng@gmail.com": "sha256$208140cc961bcd2beaf9399bed524b0820b9b41a0590c68ae1ff7a265b95ddb5",
    "supaporn.ruekudom@gmail.com": "sha256$1b9ad25a7364e41d166d91d998dac6b345069378b080ece0617a3a066b4437c8",
    "thunderinno.office@gmail.com": "sha256$cad30031571277ade1d9f930f9dab9f9e5c7e2ffddc45e4063ec6b017c01a413",
    "anuchit221237@gmail.com": "sha256$6984f6fb7ba3ea0617df672c97ed7b744d327af8862197908169fc2b974d7649",
    "naphat.niti168@gmail.com": "sha256$bfd5f954e057d55d4f3aa7b893d6f4397ad93a3ebe34d9114922848daff7380a",
    "kanittha.fastpro@gmail.com": "sha256$446059acfafa60d84d886d8e1411951ef0bba1d8d17f793a9fb17a9f7b17e7df",
    "panadda101261@gmail.com": "sha256$2e653a9e46a0c1aa76bb8b20756af3b91011c6b81378165d77aae45566e9126c",
    "s_ativat@hotmail.com": "sha256$d0411a14b2773173336313ffbc72c3f81caf58ce44de80924128e03dbe2f5db5",
    "pariphatkaewinta@gmail.com": "sha256$acc253f9f94cc9bcb5d51f58e2bfc68e7641ad7eeb3e3d376253258950e431b9",
    "Petpong250@gmail.com": "sha256$812064223236e3fc230a827db3dfd00fbe5dee379b24ef95ac5c7d14a23be62c",
    "Sishejj6@gmail.com": "sha256$0a4b9faff14df8a90ae1aca73365f7affc74f164f29e7a1d68c5b8b70036e3fe",
    "soukhameesai@gmail.com": "sha256$5809e484bd40819c1056cc1c3f7fde8938330086549f2f1a13e7eae5742eaafe",
    "skay70852@gmail.com": "sha256$3518168d9be917bcd0a0134733277aad4c647608f552cbff8e5b621a0ffe3ca7",
    "I.am.ngamsomchai@gmail.com": "sha256$a4c61dedb02082152383c28ffe95f0c17a5f5a0056276dca718ae5e87889b398",
    "somyos1259wang@gmail.com": "sha256$7d36a32d6ab1695a15fcf6f6b23fd84b1733f1fa9f71e4226101c00abb91642b",
    "bkhardware888@gmail.com": "sha256$66e9c985b453d20b6b1ffbe846fedb957afa164923b523a2ee59ccb55ba4271e",
    "patarapol777@gmail.com": "sha256$79f9742dded86efd03db1a00275f7b21fac29136ca6d369640f43cd74710d916",
    "ducksmall2010@gamil.com": "sha256$447010dea6b9c76a965b931215db7ab3ff28437adbe6a17a1944e19650c50160",
    "Suphachok2707@gmail.com": "sha256$136e160e6c8dc016cb44e24be99cfa08ef4b79d97a3d48d3226841efde0840e3",
    "chaleepdy@gmail.com": "sha256$a55ff5cd0870a588c3898cf1d968f7b631b21b608f35fbbf72142c8d0416d8e5",
    "canny070459@gmail.com": "sha256$1cbb77973c9e3f5aa7dfacdf6b88972d18d3f75badbb571c999c34e45241a039",
    "Kheiywbideddeiyw@gmail.com": "sha256$9305616f8ec174f50631a82f01c8cfebb6a5a70a683622cd517c8020c38856a8",
    "montri123a@gmail.com": "sha256$88012d4ae1b5fd9395341024e4b7df7e962ca0c62d7d5c3a11a46c962d304d7e",
    "Passonjumleanphaiboonphon@gmail.com": "sha256$22ec5563d9977035f118bff6ebccd105fd8b3a58010f143adb10c527b86af240",
    "sanitphanthawas@gmail.com": "sha256$0ed771bbd1465bf7ad137fd4a53a44a1c9e9a97de348d7adc6e80896a48c10b3",
    "supet": "sha256$c607322d8e1b0217e0e5ffbaf170d563cebbcc1eeccf7f7819934e075935eec9",
    "lpee": "sha256$76dea5420102e87b22ca2fd70054d18f6aed1cf0e554a49de1caddca7d735819",
    "pat": "sha256$9b9579ace771862ba3bcf0d3731a974e795c53f278594b6a295f61156f03f2e3"
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
    return pwMatches(users[key], key, password);
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
    window.hashPw = hashPw;
    window.pwMatches = pwMatches;
    window.SHA256 = SHA256;
    window.UserDB = { users, validateUser, isAdminUser, displayNameOf, hashPw, pwMatches, ADMIN_USERS, PW_SALT };
}
