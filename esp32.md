# โค้ด ESP32 (C++) สำหรับหมวกอัจฉริยะนำทางคนตาบอด (Smart Helmet)
> **ชื่อไฟล์:** `esp32.md`  
> **ภาษา:** C++ (Arduino Framework บนชิป ESP32)  
> **ความเข้ากันได้:** ทำงานร่วมกับแอปพลิเคชันผ่าน Web Bluetooth (BLE UART Service) และสั่งงานโมดูลเครื่องเล่นเสียง DFPlayer Mini

---

## 1. ไลบรารีที่จำเป็นสำหรับ Arduino IDE

ก่อนคอมไพล์โค้ด ให้ติดตั้งไลบรารีใน Arduino IDE (เมนู **Sketch ➜ Include Library ➜ Manage Libraries...**):
1. **DFRobotDFPlayerMini** (โดย DFRobot)
2. **ESP32 BLE Arduino** (ติดตั้งมาพร้อมกับบอร์ด ESP32 โดย Espressif อยู่แล้ว)

---

## 2. แผนผังการเชื่อมต่อขา (Pin Connections)

| อุปกรณ์ | ขาอุปกรณ์ | ต่อเข้าขา ESP32 | หมายเหตุ |
|:---|:---|:---|:---|
| **DFPlayer Mini** | VCC | **5V / VIN** | จ่ายไฟ 5V เพื่อให้เสียงดังชัดเจน |
| | GND | **GND** | กราวด์ร่วม |
| | RX | **GPIO 17 (TX2)** | **แนะนำต่อ R 1kΩ คั่น** ลดเสียงซ่า |
| | TX | **GPIO 16 (RX2)** | รับสถานะจาก DFPlayer |
| | SPK_1 (+) | ขั้วบวก (+) ลำโพง | ลำโพง 8Ω 3W |
| | SPK_2 (-) | ขั้วลบ (-) ลำโพง | ลำโพง 8Ω 3W |
| **HC-SR04 (เซนเซอร์หน้า)** | VCC | 5V | เซนเซอร์อัลตราโซนิกตรวจสิ่งกีดขวาง |
| | GND | GND | กราวด์ร่วม |
| | TRIG | **GPIO 5** | ขาส่งสัญญาณคลื่นเสียง |
| | ECHO | **GPIO 18** | ขารับคลื่นเสียง (ผ่าน Voltage Divider R 1k/2k) |
| **LED แสดงสถานะ (Option)** | Anode (+) | **GPIO 2** | LED Onboard บนบอร์ด ESP32 |

---

## 3. โค้ด C++ ฉบับสมบูรณ์ (`esp32_smart_helmet.cpp` / `.ino`)

```cpp
/**
 * ============================================================================
 * โปรเจกต์: หมวกอัจฉริยะนำทางคนตาบอด (SafeSight Smart Helmet)
 * บอร์ด: ESP32 Dev Module (WROOM-32)
 * โมดูลเสียง: DFPlayer Mini (MicroSD FAT32 โฟลเดอร์ /mp3/)
 * การเชื่อมต่อ: Web Bluetooth Low Energy (BLE UART Service)
 * เซนเซอร์: HC-SR04 Ultrasonic Sensor (ตรวจจับสิ่งกีดขวางด้านหน้า)
 * ============================================================================
 */

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <DFRobotDFPlayerMini.h>

// ==========================================
// 1. กำหนดขาฮาร์ดแวร์ (Pin Configurations)
// ==========================================
#define DFPLAYER_RXD2 16    // ESP32 RX2 เชื่อมต่อกับ TX ของ DFPlayer
#define DFPLAYER_TXD2 17    // ESP32 TX2 เชื่อมต่อกับ RX ของ DFPlayer (ผ่านตัวต้านทาน 1k)

#define TRIG_PIN      5     // HC-SR04 Trigger Pin
#define ECHO_PIN      18    // HC-SR04 Echo Pin
#define STATUS_LED    2     // Onboard LED แสดงสถานะบลูทูธ

// ==========================================
// 2. กำหนดค่า BLE UUIDs (มาตรฐาน Nordic UART)
// ==========================================
#define SERVICE_UUID           "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define CHARACTERISTIC_UUID_RX "6e400002-b5a3-f393-e0a9-e50e24dcca9e" // รับรหัสจากมือถือ
#define CHARACTERISTIC_UUID_TX "6e400003-b5a3-f393-e0a9-e50e24dcca9e" // ส่งแจ้งเตือนกลับมือถือ

// ตัวแปรและออบเจกต์ระบบ
HardwareSerial dfSerial(2);
DFRobotDFPlayerMini myDFPlayer;

BLEServer *pServer = nullptr;
BLECharacteristic *pTxCharacteristic = nullptr;
bool deviceConnected = false;
bool oldDeviceConnected = false;

// ตัวแปรจับเวลาสำหรับเซนเซอร์อัลตราโซนิก
unsigned long lastSensorCheck = 0;
const unsigned long SENSOR_INTERVAL_MS = 300;     // อ่านค่าเซนเซอร์ทุก 300ms
unsigned long lastObstacleAlertTime = 0;
const unsigned long OBSTACLE_COOLDOWN_MS = 3500;  // เว้นช่วงเตือนสิ่งกีดขวางอย่างน้อย 3.5 วินาที

// ==========================================
// 3. ฟังก์ชันแปลงรหัสสั้น (BLE Code) ➜ เล่น MP3
// ==========================================
void playTrack(int trackNumber, const char* description) {
  if (trackNumber <= 0) return;
  Serial.printf("🔊 [DFPlayer] สั่งเล่นไฟล์ /mp3/%04d.mp3 -> %s\n", trackNumber, description);
  myDFPlayer.playMp3Folder(trackNumber);
}

void handleAudioCommand(String rawCode) {
  rawCode.trim();
  rawCode.toUpperCase();
  if (rawCode.length() == 0) return;

  Serial.printf("📡 [BLE RX] ได้รับรหัสสั้น: '%s'\n", rawCode.c_str());

  int track = -1;
  const char* desc = "";

  // ----------------------------------------
  // หมวดที่ 1: สถานะการนำทาง (0001 - 0008.mp3)
  // ----------------------------------------
  if (rawCode == "A" || rawCode == "A1" || rawCode == "START_NAV") {
    track = 1; desc = "เริ่มต้นการนำทาง";
  } else if (rawCode == "B" || rawCode == "A2" || rawCode == "RETURN_NAV") {
    track = 2; desc = "เริ่มต้นนำทางขากลับ";
  } else if (rawCode == "C" || rawCode == "A3" || rawCode == "STOP_NAV") {
    track = 3; desc = "หยุดการนำทาง";
  } else if (rawCode == "D" || rawCode == "A4" || rawCode == "ARRIVED") {
    track = 4; desc = "ถึงจุดหมายปลายทางแล้ว";
  } else if (rawCode == "E" || rawCode == "A5") {
    track = 5; desc = "ปลายทางไกลเกิน 10 กม.";
  } else if (rawCode == "F" || rawCode == "A6") {
    track = 6; desc = "กำลังคำนวณเส้นทาง";
  } else if (rawCode == "G" || rawCode == "A7") {
    track = 7; desc = "เลือกเส้นทางแล้ว";
  } else if (rawCode == "H" || rawCode == "A8") {
    track = 8; desc = "ยังไม่มีเส้นทางนำทาง";
  }

  // ----------------------------------------
  // หมวดที่ 2: ระยะทางคงเหลือเข้าสู่จุดเลี้ยว (0010 - 0028.mp3)
  // ----------------------------------------
  else if (rawCode == "M1000" || rawCode == "D1000") { track = 10; desc = "อีก 1 กิโลเมตร"; }
  else if (rawCode == "M500"  || rawCode == "D500")  { track = 11; desc = "อีก 500 เมตร"; }
  else if (rawCode == "M300"  || rawCode == "D300")  { track = 12; desc = "อีก 300 เมตร"; }
  else if (rawCode == "M200"  || rawCode == "D200")  { track = 13; desc = "อีก 200 เมตร"; }
  else if (rawCode == "M150"  || rawCode == "D150")  { track = 14; desc = "อีก 150 เมตร"; }
  else if (rawCode == "M100"  || rawCode == "D100")  { track = 15; desc = "อีก 100 เมตร"; }
  else if (rawCode == "M90"   || rawCode == "D90")   { track = 16; desc = "อีก 90 เมตร"; }
  else if (rawCode == "M80"   || rawCode == "D80")   { track = 17; desc = "อีก 80 เมตร"; }
  else if (rawCode == "M70"   || rawCode == "D70")   { track = 18; desc = "อีก 70 เมตร"; }
  else if (rawCode == "M60"   || rawCode == "D60")   { track = 19; desc = "อีก 60 เมตร"; }
  else if (rawCode == "M50"   || rawCode == "D50")   { track = 20; desc = "อีก 50 เมตร"; }
  else if (rawCode == "M40"   || rawCode == "D40")   { track = 21; desc = "อีก 40 เมตร"; }
  else if (rawCode == "M30"   || rawCode == "D30")   { track = 22; desc = "อีก 30 เมตร"; }
  else if (rawCode == "M25"   || rawCode == "D25")   { track = 23; desc = "อีก 25 เมตร"; }
  else if (rawCode == "M20"   || rawCode == "D20")   { track = 24; desc = "อีก 20 เมตร"; }
  else if (rawCode == "M15"   || rawCode == "D15")   { track = 25; desc = "อีก 15 เมตร (เตรียมเลี้ยว)"; }
  else if (rawCode == "M10"   || rawCode == "D10")   { track = 26; desc = "อีก 10 เมตร (ชะลอความเร็ว)"; }
  else if (rawCode == "M5"    || rawCode == "D5")    { track = 27; desc = "อีก 5 เมตร (เตรียมเปลี่ยนทิศ)"; }
  else if (rawCode == "M0"    || rawCode == "D0")    { track = 28; desc = "อีก 0 เมตร ถึงจุดเลี้ยวแล้ว"; }

  // ----------------------------------------
  // หมวดที่ 3: ทิศทางการเลี้ยวและการเคลื่อนที่ (0030 - 0044.mp3)
  // ----------------------------------------
  else if (rawCode == "TS" || rawCode == "S" || rawCode == "STRAIGHT") {
    track = 30; desc = "เดินตรงไปข้างหน้า";
  } else if (rawCode == "TNL" || rawCode == "NEXT_LEFT") {
    track = 31; desc = "ข้างหน้าเลี้ยวซ้าย";
  } else if (rawCode == "TL" || rawCode == "L" || rawCode == "LEFT") {
    track = 32; desc = "เลี้ยวซ้าย";
  } else if (rawCode == "TNR" || rawCode == "NEXT_RIGHT") {
    track = 33; desc = "ข้างหน้าเลี้ยวขวา";
  } else if (rawCode == "TR" || rawCode == "R" || rawCode == "RIGHT") {
    track = 34; desc = "เลี้ยวขวา";
  } else if (rawCode == "TSL" || rawCode == "SLIGHT_LEFT") {
    track = 35; desc = "เบี่ยงซ้ายเล็กน้อย";
  } else if (rawCode == "TSR" || rawCode == "SLIGHT_RIGHT") {
    track = 36; desc = "เบี่ยงขวาเล็กน้อย";
  } else if (rawCode == "TSHL" || rawCode == "SHARP_LEFT") {
    track = 37; desc = "เลี้ยวซ้ายหักศอก";
  } else if (rawCode == "TSHR" || rawCode == "SHARP_RIGHT") {
    track = 38; desc = "เลี้ยวขวาหักศอก";
  } else if (rawCode == "TU" || rawCode == "U" || rawCode == "UTURN") {
    track = 39; desc = "กลับหลังหัน ยูเทิร์น";
  } else if (rawCode == "TX" || rawCode == "CROSS_ROAD") {
    track = 40; desc = "ข้างหน้าเตรียมข้ามถนน";
  } else if (rawCode == "TC" || rawCode == "CROSSWALK") {
    track = 41; desc = "ข้างหน้าทางม้าลาย";
  } else if (rawCode == "TB" || rawCode == "OVERPASS_UP") {
    track = 42; desc = "เตรียมขึ้นสะพานลอย";
  } else if (rawCode == "TD" || rawCode == "OVERPASS_DOWN") {
    track = 43; desc = "ลงสะพานลอยระวังบันได";
  } else if (rawCode == "TRP" || rawCode == "RAMP") {
    track = 44; desc = "ระวังทางลาดชัน";
  }

  // ----------------------------------------
  // หมวดที่ 4: ทิศทางเข็มทิศ 8 ทิศ (0050 - 0057.mp3)
  // ----------------------------------------
  else if (rawCode == "CN")  { track = 50; desc = "มุ่งหน้าทิศเหนือ"; }
  else if (rawCode == "CNE") { track = 51; desc = "มุ่งหน้าทิศตะวันออกเฉียงเหนือ"; }
  else if (rawCode == "CE")  { track = 52; desc = "มุ่งหน้าทิศตะวันออก"; }
  else if (rawCode == "CSE") { track = 53; desc = "มุ่งหน้าทิศตะวันออกเฉียงใต้"; }
  else if (rawCode == "CS")  { track = 54; desc = "มุ่งหน้าทิศใต้"; }
  else if (rawCode == "CSW") { track = 55; desc = "มุ่งหน้าทิศตะวันตกเฉียงใต้"; }
  else if (rawCode == "CW")  { track = 56; desc = "มุ่งหน้าทิศตะวันตก"; }
  else if (rawCode == "CNW") { track = 57; desc = "มุ่งหน้าทิศตะวันตกเฉียงเหนือ"; }

  // ----------------------------------------
  // หมวดที่ 5: การเตือนเดินผิดทาง (0060 - 0064.mp3)
  // ----------------------------------------
  else if (rawCode == "EU"  || rawCode == "E1") { track = 60; desc = "เตือนออกนอกเส้นทาง กลับหลังหัน"; }
  else if (rawCode == "EL"  || rawCode == "E2") { track = 61; desc = "ออกนอกทาง ข้างหน้าเลี้ยวซ้าย"; }
  else if (rawCode == "ER"  || rawCode == "E3") { track = 62; desc = "ออกนอกทาง ข้างหน้าเลี้ยวขวา"; }
  else if (rawCode == "ES"  || rawCode == "E4") { track = 63; desc = "ออกนอกทาง กรุณาเดินตรงไป"; }
  else if (rawCode == "EOK" || rawCode == "E5") { track = 64; desc = "กลับเข้าสู่เส้นทางแล้ว"; }

  // ----------------------------------------
  // หมวดที่ 6: ทางเท้าและขอบถนน (0070 - 0074.mp3)
  // ----------------------------------------
  else if (rawCode == "SL")  { track = 70; desc = "เดินริมทางเท้าฝั่งซ้าย"; }
  else if (rawCode == "SR")  { track = 71; desc = "เดินริมทางเท้าฝั่งขวา"; }
  else if (rawCode == "SC")  { track = 72; desc = "เดินกึ่งกลางทางเดิน"; }
  else if (rawCode == "SW")  { track = 73; desc = "ระวังชิดขอบถนนเกินไป"; }
  else if (rawCode == "SOK") { track = 74; desc = "เดินตามทางเท้า ปลอดภัย"; }

  // ----------------------------------------
  // หมวดที่ 7: สิ่งกีดขวาง (0080 - 0085.mp3)
  // ----------------------------------------
  else if (rawCode == "OF") { track = 80; desc = "สิ่งกีดขวางด้านหน้า"; }
  else if (rawCode == "OL") { track = 81; desc = "สิ่งกีดขวางด้านซ้าย"; }
  else if (rawCode == "OR") { track = 82; desc = "สิ่งกีดขวางด้านขวา"; }
  else if (rawCode == "OH") { track = 83; desc = "สิ่งกีดขวางระดับศีรษะ"; }
  else if (rawCode == "OG") { track = 84; desc = "ระวังหลุม/ทางต่างระดับ"; }
  else if (rawCode == "OC") { track = 85; desc = "ทางข้างหน้าโล่ง"; }

  // ----------------------------------------
  // หมวดที่ 8: สถานะระบบ (0090 - 0097.mp3)
  // ----------------------------------------
  else if (rawCode == "HB")  { track = 90; desc = "เชื่อมต่อบลูทูธสำเร็จ"; }
  else if (rawCode == "HD")  { track = 91; desc = "การเชื่อมต่อหลุด"; }
  else if (rawCode == "HG")  { track = 92; desc = "สัญญาณ GPS พร้อม"; }
  else if (rawCode == "HW")  { track = 93; desc = "สัญญาณ GPS อ่อน"; }
  else if (rawCode == "HL")  { track = 94; desc = "แบตเตอรี่เหลือน้อยกว่า 20%"; }
  else if (rawCode == "HR")  { track = 95; desc = "เริ่มบันทึกเส้นทาง"; }
  else if (rawCode == "HS")  { track = 96; desc = "บันทึกเส้นทางสำเร็จ"; }
  else if (rawCode == "HWP") { track = 97; desc = "บันทึกจุดเลี้ยวเรียบร้อย"; }

  // คำสั่งปรับระดับเสียง (ตัวอย่าง: V25 ➜ เสียงระดับ 25)
  else if (rawCode.startsWith("V") && rawCode.length() > 1) {
    int vol = rawCode.substring(1).toInt();
    if (vol >= 0 && vol <= 30) {
      myDFPlayer.volume(vol);
      Serial.printf("🔊 ปรับระดับเสียง DFPlayer เป็น: %d\n", vol);
      return;
    }
  }

  // ดำเนินการเล่นเสียง
  if (track > 0) {
    playTrack(track, desc);
  } else {
    Serial.printf("⚠️ [DFPlayer] ไม่พบการจับคู่ของรหัส '%s'\n", rawCode.c_str());
  }
}

// ==========================================
// 4. คลาสและ Callback จัดการการเชื่อมต่อ BLE
// ==========================================
class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) override {
    deviceConnected = true;
    digitalWrite(STATUS_LED, HIGH); // ติด LED เมื่อเชื่อมต่อ
    Serial.println("✅ [BLE] แอปบนมือถือเชื่อมต่อสำเร็จแล้ว");
    playTrack(90, "เชื่อมต่อบลูทูธเรียบร้อย (0090.mp3)");
  }

  void onDisconnect(BLEServer* pServer) override {
    deviceConnected = false;
    digitalWrite(STATUS_LED, LOW);  // ดับ LED เมื่อหลุด
    Serial.println("❌ [BLE] แอปบนมือถือตัดการเชื่อมต่อ");
  }
};

class MyCharacteristicCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) override {
    String rxValue = pCharacteristic->getValue().c_str();
    if (rxValue.length() > 0) {
      handleAudioCommand(rxValue);
    }
  }
};

// ==========================================
// 5. ฟังก์ชันวัดระยะทางด้วยเซนเซอร์อัลตราโซนิก
// ==========================================
float readUltrasonicDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 25000); // Timeout 25ms (~4.3 เมตร)
  if (duration == 0) return -1.0; // วัดไม่ทันหรืออยู่นอกระยะ

  float distanceCm = (duration * 0.0343) / 2.0;
  return distanceCm;
}

void checkObstacles() {
  float distance = readUltrasonicDistanceCm();
  if (distance > 0 && distance < 120.0) { // ตรวจพบวัตถุในระยะใกล้กว่า 1.2 เมตร
    unsigned long now = millis();
    if (now - lastObstacleAlertTime >= OBSTACLE_COOLDOWN_MS) {
      lastObstacleAlertTime = now;
      Serial.printf("🚨 [Obstacle] ตรวจพบสิ่งกีดขวางข้างหน้า ระยะ %.1f ซม.!\n", distance);

      // 1. เล่นเสียงเตือนทันทีออกจากลำโพงหมวก (0080.mp3)
      playTrack(80, "ตรวจพบสิ่งกีดขวางด้านหน้า");

      // 2. ส่งรหัสแจ้งเตือนกลับไปยังแอปมือถือผ่าน BLE TX
      if (deviceConnected && pTxCharacteristic != nullptr) {
        char telemetryMsg[32];
        snprintf(telemetryMsg, sizeof(telemetryMsg), "OBS:FRONT:%.0f\n", distance);
        pTxCharacteristic->setValue((uint8_t*)telemetryMsg, strlen(telemetryMsg));
        pTxCharacteristic->notify();
      }
    }
  }
}

// ==========================================
// 6. Setup & Main Loop
// ==========================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n==========================================");
  Serial.println("  SafeSight Smart Helmet Firmware v2.0    ");
  Serial.println("==========================================");

  pinMode(STATUS_LED, OUTPUT);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(STATUS_LED, LOW);

  // 1. เริ่มต้น Hardware Serial 2 สำหรับ DFPlayer Mini
  dfSerial.begin(9600, SERIAL_8N1, DFPLAYER_RXD2, DFPLAYER_TXD2);
  Serial.println("⏳ กำลังเริ่มต้น DFPlayer Mini...");

  if (!myDFPlayer.begin(dfSerial, false, true)) {
    Serial.println("❌ ไม่พบ DFPlayer Mini กรุณาตรวจสอบการต่อสายไฟและ MicroSD Card (FAT32)");
  } else {
    Serial.println("✅ DFPlayer Mini พร้อมทำงานแล้ว");
    myDFPlayer.volume(25); // ตั้งระดับเสียงเริ่มต้น 0-30 (แนะนำ 20-28)
    myDFPlayer.EQ(DFPLAYER_EQ_NORMAL);
  }

  // 2. เริ่มต้น Bluetooth Low Energy (BLE)
  BLEDevice::init("SafeSight-SmartHelmet");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);

  // Characteristic TX (ส่งข้อมูล/เตือนสิ่งกีดขวางกลับไปมือถือ)
  pTxCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID_TX,
    BLECharacteristic::PROPERTY_NOTIFY
  );
  pTxCharacteristic->addDescriptor(new BLE2902());

  // Characteristic RX (รับคำสั่งเสียง/รหัสย่อจากมือถือ)
  BLECharacteristic *pRxCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID_RX,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
  );
  pRxCharacteristic->setCallbacks(new MyCharacteristicCallbacks());

  pService->start();

  // กระจายสัญญาณ BLE
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();

  Serial.println("📡 บลูทูธ BLE กระจายสัญญาณในชื่อ 'SafeSight-SmartHelmet' พร้อมให้เชื่อมต่อแล้ว");
}

void loop() {
  // จัดการสถานะการเชื่อมต่อบลูทูธใหม่อัตโนมัติ (Re-advertising เมื่อหลุด)
  if (!deviceConnected && oldDeviceConnected) {
    delay(500);
    pServer->startAdvertising();
    Serial.println("📡 กำลังเปิดกระจายสัญญาณบลูทูธรอบใหม่...");
    oldDeviceConnected = deviceConnected;
  }
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
  }

  // ตรวจสอบสิ่งกีดขวางตามรอบเวลา
  unsigned long currentMillis = millis();
  if (currentMillis - lastSensorCheck >= SENSOR_INTERVAL_MS) {
    lastSensorCheck = currentMillis;
    checkObstacles();
  }

  delay(20);
}
```

---

## 4. ขั้นตอนการติดตั้งและอัปโหลดลง ESP32

1. เปิดโปรแกรม **Arduino IDE**
2. เลือกบอร์ด: **Tools ➜ Board ➜ esp32 ➜ ESP32 Dev Module**
3. เลือกพอร์ต: **Tools ➜ Port ➜ (เลือก COM Port ของ ESP32)**
4. ตั้งค่า:
   - **Upload Speed:** `921600` หรือ `115200`
   - **CPU Frequency:** `240MHz`
   - **Flash Frequency:** `80MHz`
5. กดปุ่ม **Upload (ลูกศรขวา)** รอจนขึ้น `Done uploading`
6. เปิด **Serial Monitor** (ตั้งความเร็ว Baud rate: `115200`) จะเห็นข้อความเริ่มต้นระบบ พร้อมชื่อบลูทูธ `SafeSight-SmartHelmet`
7. เปิดหน้าต่างบลูทูธบนแอป SafeSight แล้วกดค้นหา จะเจอหมวกอัจฉริยะและเชื่อมต่อได้ทันทีครับ
