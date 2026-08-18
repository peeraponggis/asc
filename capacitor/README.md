# ProInventive Mobi — แอปแอนดรอยด์

ห่อ `docs/mobi.html` ให้เป็นแอปติดตั้งบนเครื่อง ด้วย Capacitor
ไฟล์เว็บทั้งหมดถูกฝังไว้ในแอป จึงเปิดใช้ได้ทันทีโดยไม่ต้องต่ออินเทอร์เน็ตแม้แต่ครั้งแรก

| | |
|---|---|
| App ID | `com.proinventive.mobi` |
| ชื่อแอป | ProInventive Mobi |
| แหล่งไฟล์เว็บ | `../docs` (แก้ที่นั่นที่เดียว ทั้งเว็บและแอปใช้ร่วมกัน) |
| ปลั๊กอิน | `@capacitor/filesystem` · `@capacitor/share` |

---

## สิ่งที่ต้องติดตั้งก่อน build

เครื่องนี้ยัง **ไม่มี Android SDK** จึงยังสร้างไฟล์ `.apk` ไม่ได้

| ต้องมี | สถานะบนเครื่องนี้ |
|---|---|
| Node.js 20+ | ✅ มีแล้ว |
| JDK **17 หรือ 21** | ⚠️ มี JDK 22 — Gradle ของ Capacitor ยังไม่รองรับ ต้องลง 17 หรือ 21 |
| Android SDK (API 35 + Build-Tools) | ❌ ยังไม่มี |

วิธีที่ง่ายที่สุดคือติดตั้ง **Android Studio** ซึ่งได้ทั้ง SDK และ JDK ที่เข้ากันได้มาในตัว
https://developer.android.com/studio

ติดตั้งแล้วเปิด Android Studio หนึ่งครั้งเพื่อให้มันโหลด SDK ให้ครบ

---

## ขั้นตอน build

```bash
cd capacitor
npm install          # ครั้งแรกครั้งเดียว
npx cap sync android # คัดลอกไฟล์จาก ../docs เข้าแอป — ทำทุกครั้งที่แก้ docs/
```

### แบบทดสอบ (ไม่ต้องเซ็นชื่อ ติดตั้งบนเครื่องตัวเองได้เลย)

```bash
cd android
./gradlew assembleDebug
```

ได้ไฟล์ที่ `android/app/build/outputs/apk/debug/app-debug.apk`
ส่งไฟล์นี้ให้ช่างติดตั้งได้เลย (ต้องเปิด "ติดตั้งจากแหล่งที่ไม่รู้จัก" ในเครื่อง)

### แบบแจกจริง (ต้องเซ็นชื่อ)

```bash
keytool -genkey -v -keystore proinventive.jks -keyalg RSA -keysize 2048 -validity 10000 -alias mobi
cd android
./gradlew assembleRelease
```

> ⚠️ **เก็บไฟล์ `.jks` และรหัสผ่านไว้ให้ดี** ถ้าหายจะอัปเดตแอปตัวเดิมไม่ได้อีกเลย ต้องให้ผู้ใช้ถอนแล้วติดตั้งใหม่
> ไฟล์ `.jks` ถูกกันไม่ให้ขึ้น git ไว้แล้ว

### เปิดใน Android Studio แทนก็ได้

```bash
npx cap open android
```

---

## แก้โค้ดแล้วต้องทำอะไร

แก้ที่ `docs/mobi.html` ที่เดียว แล้ว

```bash
cd capacitor && npx cap sync android && cd android && ./gradlew assembleDebug
```

ถ้าแก้เฉพาะเว็บ (ไม่ทำแอป) แค่ push ขึ้น GitHub Pages ก็พอ

---

## ไอคอนแอป

สร้างจาก `../img/pilogo.png` ไว้ที่ `assets/` แล้ว
ถ้าเปลี่ยนโลโก้ ให้แทนที่ไฟล์ใน `assets/` แล้วสั่ง

```bash
npx @capacitor/assets generate --android --iconBackgroundColor '#14171C' --splashBackgroundColor '#14171C'
```

---

## สิ่งที่ต่างจากรุ่นเว็บ

| | เว็บ / PWA | แอปแอนดรอยด์ |
|---|---|---|
| บันทึกภาพและไฟล์ผัง | ลิงก์ดาวน์โหลดของเบราว์เซอร์ | เขียนลงโฟลเดอร์ Documents แล้วเปิดแผงแชร์ให้เลือกปลายทาง |
| Service Worker | ใช้แคชไฟล์ให้ทำงานออฟไลน์ | ปิดไว้ เพราะไฟล์ถูกฝังในแอปอยู่แล้ว |
| ปุ่มติดตั้งแอป | แสดง | ซ่อน |

โค้ดตรวจด้วย `Capacitor.isNativePlatform()` แล้วเลือกเส้นทางเอง
ไฟล์เดียวจึงใช้ได้ทั้งสองแบบโดยไม่ต้องมีขั้นตอน build ของฝั่งเว็บเลย

---

## ข้อควรรู้

- **ข้อมูลงานยังเก็บใน localStorage ของ WebView** ซึ่งอยู่รอดกว่าบนเบราว์เซอร์
  (ล้างเมื่อผู้ใช้ล้างข้อมูลแอปเท่านั้น) แต่ถ้าต้องการความปลอดภัยกว่านี้
  ควรย้ายไปเขียนเป็นไฟล์จริงด้วย `@capacitor/filesystem` — ยังไม่ได้ทำ
- ยังไม่ได้ทดสอบบนเครื่องจริง เพราะเครื่องที่พัฒนายังไม่มี Android SDK
