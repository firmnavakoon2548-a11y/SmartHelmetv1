# คู่มือการนำ SafeSight Smart Helmet ไปเปิดในแอป Expo Go

โปรเจกต์นี้ได้รับการแปลงเป็น **React Native (Expo SDK 52)** เรียบร้อยแล้ว อยู่ในโฟลเดอร์ `expo-app/` โดยรองรับทั้งระบบ:
- 🔊 **ระบบเสียงพูดภาษาไทย (Thai Text-to-Speech)** ผ่าน `expo-speech`
- 🧭 **ระบบระบุพิกัด GPS จริง & นำทาง** ผ่าน `expo-location`
- 📳 **ระบบสั่นเตือนสิ่งกีดขวาง (Haptics Feedback)** ผ่าน `expo-haptics`
- 📡 **เรดาร์ตรวจจับสิ่งกีดขวาง 4 ทิศทาง (หน้า, ซ้าย, ขวา, ศีรษะ)**
- 🎙️ **ระบบสั่งการด้วยเสียง AI ("ไป B", "ไป 7-11", "เช็คสิ่งกีดขวาง")**
- 🚨 **ปุ่มสัญญาณขอความช่วยเหลือฉุกเฉิน (SOS)**

---

## ขั้นตอนการเปิดในแอป Expo Go บนมือถือจริง

### ขั้นตอนที่ 1: ดาวน์โหลดโปรเจกต์จาก AI Studio
1. คลิกที่เมนูการตั้งค่า หรือปุ่ม **Export** ด้านบนของ AI Studio
2. เลือก **Export to ZIP** (หรือดาวน์โหลดไฟล์ทั้งหมดลงเครื่องคอมพิวเตอร์ของคุณ)
3. แตกไฟล์ ZIP ออกมาไว้ในโฟลเดอร์ที่คุณต้องการ

---

### ขั้นตอนที่ 2: ติดตั้ง Node.js และเข้าโฟลเดอร์ `expo-app`
1. เปิดโปรแกรม Terminal (หรือ Command Prompt / PowerShell / VS Code Terminal)
2. ย้ายเข้าไปในโฟลเดอร์ `expo-app`:
   ```bash
   cd expo-app
   ```
3. รันคำสั่งติดตั้ง Dependencies (ทำเพียงครั้งแรก):
   ```bash
   npm install
   ```

---

### ขั้นตอนที่ 3: เปิดรันเซิร์ฟเวอร์ Expo
รันคำสั่ง:
```bash
npx expo start
```
*(ระบบจะแสดงรหัส **QR Code** ขึ้นมาบนหน้าจอ Terminal หรือหน้าเว็บเบราว์เซอร์ของ Expo Dev Tools)*

> **เคล็ดลับ:** คอมพิวเตอร์และมือถือควรเชื่อมต่อ Wi-Fi เครือข่ายเดียวกัน (หรือหากเชื่อมต่อคนละวง ให้พิมพ์ `npx expo start --tunnel` เพื่อเชื่อมต่อผ่าน Tunnel ได้ทุกที่ทั่วโลก)

---

### ขั้นตอนที่ 4: สแกนเพื่อเปิดบนมือถือ (Expo Go)

#### สำหรับมือถือ Android:
1. ดาวน์โหลดและติดตั้งแอป **[Expo Go](https://play.google.com/store/apps/details?id=host.exp.exponent)** จาก Google Play Store
2. เปิดแอป Expo Go
3. แตะที่ปุ่ม **"Scan QR code"** แล้วนำกล้องไปส่อง QR Code บนหน้าจอคอมพิวเตอร์
4. แอป **SafeSight** จะดาวน์โหลดและเปิดขึ้นมาบนมือถือของคุณทันที!

#### สำหรับ iPhone (iOS):
1. ดาวน์โหลดแอป **[Expo Go](https://apps.apple.com/app/expo-go/id982107779)** จาก App Store
2. เปิดแอป **Camera (กล้องถ่ายรูป)** ของ iPhone แล้วส่องไปที่ QR Code
3. แตะแถบแจ้งเตือนสีเหลืองด้านบนเพื่อเปิดใน Expo Go

---

## โครงสร้างไฟล์ Expo ในโฟลเดอร์ `expo-app/`
```text
expo-app/
├── App.tsx             <-- โค้ดหลัก SafeSight เขียนด้วย React Native + Expo Speech + Location + Haptics
├── package.json        <-- รายการแพ็กเกจ Expo SDK 52 และไลบรารีทั้งหมด
├── app.json            <-- การตั้งค่าแอป, Permissions (GPS, MIC, Vibrate) และชื่อแอป
├── babel.config.js     <-- การตั้งค่า Babel compiler
├── tsconfig.json       <-- การตั้งค่า TypeScript สำหรับ Expo
└── index.js            <-- จุดเริ่มต้นการบูตแอป Expo
```
