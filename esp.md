# โค้ด ESP32 (Arduino IDE) สำหรับคัดลอกใช้งาน
> **ชื่อไฟล์:** `esp.md`  
> **อุปกรณ์:** ESP32 Dev Module + DFPlayer Mini + HC-SR04 Ultrasonic Sensor + BLE  
> **วิธีใช้งาน:** คลิกปุ่ม Copy หรือคลุมดำคัดลอกโค้ดด้านล่างทั้งหมด ไปวางในโปรแกรม **Arduino IDE** แล้วกด Upload ลงบอร์ด ESP32 ได้ทันทีครับ

```cpp
/*
=========================================================
SafeSight Smart Helmet
ESP32 + BLE + DFPlayer Mini + HC-SR04
Arduino IDE
=========================================================
*/

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <DFRobotDFPlayerMini.h>
#include <map>

// =====================================================
// Hardware Pins
// =====================================================
#define DF_RX 16
#define DF_TX 17

#define TRIG_PIN 5
#define ECHO_PIN 18

#define STATUS_LED 2

// =====================================================
// BLE UUID (Nordic UART)
// =====================================================
#define SERVICE_UUID           "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define CHARACTERISTIC_UUID_RX "6e400002-b5a3-f393-e0a9-e50e24dcca9e"
#define CHARACTERISTIC_UUID_TX "6e400003-b5a3-f393-e0a9-e50e24dcca9e"

// =====================================================
// Global Objects
// =====================================================
HardwareSerial dfSerial(2);
DFRobotDFPlayerMini dfPlayer;

BLEServer* pServer = nullptr;
BLECharacteristic* pTxCharacteristic = nullptr;

bool deviceConnected = false;
bool oldDeviceConnected = false;

// =====================================================
// Timing
// =====================================================
unsigned long lastObstacleCheck = 0;
unsigned long lastObstacleAlert = 0;

const uint32_t OBSTACLE_INTERVAL = 300;
const uint32_t OBSTACLE_COOLDOWN = 3500;

// =====================================================
// Command Mapping
// =====================================================
std::map<String, uint16_t> commandMap;

// =====================================================
// Function Prototypes
// =====================================================
void initCommandMap();
void handleCommand(String cmd);
void playTrack(uint16_t track);
float readDistanceCM();
void checkObstacle();

// =====================================================
// BLE Server Callback
// =====================================================
class ServerCallbacks : public BLEServerCallbacks {

  void onConnect(BLEServer* pServer) override {

    deviceConnected = true;
    digitalWrite(STATUS_LED, HIGH);

    Serial.println("BLE Connected");

    playTrack(90); // HB (เชื่อมต่อบลูทูธสำเร็จ)
  }

  void onDisconnect(BLEServer* pServer) override {

    deviceConnected = false;
    digitalWrite(STATUS_LED, LOW);

    Serial.println("BLE Disconnected");
  }
};

// =====================================================
// BLE RX Callback
// =====================================================
class RXCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) override {
    
    String cmd = pCharacteristic->getValue().c_str();

    if(cmd.length() > 0) {
      handleCommand(cmd);
    }
  }
};

// =====================================================
// Play MP3
// =====================================================
void playTrack(uint16_t track) {

  if(track == 0) return;

  Serial.printf("Play MP3: %04d.mp3\n", track);

  dfPlayer.playMp3Folder(track);
}

// =====================================================
// Handle BLE Command
// =====================================================
void handleCommand(String cmd) {

  cmd.trim();
  cmd.toUpperCase();

  Serial.print("RX: ");
  Serial.println(cmd);

  // Volume command V0-V30
  if(cmd.startsWith("V")) {

    int vol = cmd.substring(1).toInt();

    if(vol >= 0 && vol <= 30) {

      dfPlayer.volume(vol);

      Serial.printf("Volume = %d\n", vol);
    }

    return;
  }

  auto it = commandMap.find(cmd);

  if(it != commandMap.end()) {

    playTrack(it->second);
  }
  else {

    Serial.println("Unknown Command");
  }
}

// =====================================================
// Ultrasonic
// =====================================================
float readDistanceCM() {

  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);

  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);

  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 25000);

  if(duration == 0) return -1;

  return (duration * 0.0343f) / 2.0f;
}

// =====================================================
// Obstacle Detection
// =====================================================
void checkObstacle() {

  float distance = readDistanceCM();

  if(distance < 0) return;

  if(distance < 120) {

    unsigned long now = millis();

    if(now - lastObstacleAlert > OBSTACLE_COOLDOWN) {

      lastObstacleAlert = now;

      Serial.printf("Obstacle %.1f cm\n", distance);

      playTrack(80); // OF (0080.mp3 ตรวจพบสิ่งกีดขวางด้านหน้า)

      if(deviceConnected && pTxCharacteristic) {

        String msg =
          "OBS:FRONT:" +
          String((int)distance) +
          "\n";

        pTxCharacteristic->setValue(msg.c_str());
        pTxCharacteristic->notify();
      }
    }
  }
}

// =====================================================
// Command Table
// =====================================================
void initCommandMap() {

  // หมวดที่ 1: Navigation (สถานะการนำทาง)
  commandMap["A"] = 1;
  commandMap["B"] = 2;
  commandMap["C"] = 3;
  commandMap["D"] = 4;
  commandMap["E"] = 5;
  commandMap["F"] = 6;
  commandMap["G"] = 7;
  commandMap["H"] = 8;

  // หมวดที่ 2: Distance (ระยะทางคงเหลือ)
  commandMap["M1000"] = 10;
  commandMap["M500"]  = 11;
  commandMap["M300"]  = 12;
  commandMap["M200"]  = 13;
  commandMap["M150"]  = 14;
  commandMap["M100"]  = 15;
  commandMap["M90"]   = 16;
  commandMap["M80"]   = 17;
  commandMap["M70"]   = 18;
  commandMap["M60"]   = 19;
  commandMap["M50"]   = 20;
  commandMap["M40"]   = 21;
  commandMap["M30"]   = 22;
  commandMap["M25"]   = 23;
  commandMap["M20"]   = 24;
  commandMap["M15"]   = 25;
  commandMap["M10"]   = 26;
  commandMap["M5"]    = 27;
  commandMap["M0"]    = 28;

  // หมวดที่ 3: Turn (ทิศทางการเลี้ยว)
  commandMap["TS"]   = 30;
  commandMap["TNL"]  = 31;
  commandMap["TL"]   = 32;
  commandMap["TNR"]  = 33;
  commandMap["TR"]   = 34;
  commandMap["TSL"]  = 35;
  commandMap["TSR"]  = 36;
  commandMap["TSHL"] = 37;
  commandMap["TSHR"] = 38;
  commandMap["TU"]   = 39;
  commandMap["TX"]   = 40;
  commandMap["TC"]   = 41;
  commandMap["TB"]   = 42;
  commandMap["TD"]   = 43;
  commandMap["TRP"]  = 44;

  // หมวดที่ 4: Compass (เข็มทิศ 8 ทิศ)
  commandMap["CN"]  = 50;
  commandMap["CNE"] = 51;
  commandMap["CE"]  = 52;
  commandMap["CSE"] = 53;
  commandMap["CS"]  = 54;
  commandMap["CSW"] = 55;
  commandMap["CW"]  = 56;
  commandMap["CNW"] = 57;

  // หมวดที่ 5: Off Route (เตือนออกนอกเส้นทาง)
  commandMap["EU"]  = 60;
  commandMap["EL"]  = 61;
  commandMap["ER"]  = 62;
  commandMap["ES"]  = 63;
  commandMap["EOK"] = 64;

  // หมวดที่ 6: Sidewalk (แนวทางเท้า)
  commandMap["SL"]  = 70;
  commandMap["SR"]  = 71;
  commandMap["SC"]  = 72;
  commandMap["SW"]  = 73;
  commandMap["SOK"] = 74;

  // หมวดที่ 7: Obstacles (สิ่งกีดขวาง)
  commandMap["OF"] = 80;
  commandMap["OL"] = 81;
  commandMap["OR"] = 82;
  commandMap["OH"] = 83;
  commandMap["OG"] = 84;
  commandMap["OC"] = 85;

  // หมวดที่ 8: Hardware Status (สถานะระบบ)
  commandMap["HB"]  = 90;
  commandMap["HD"]  = 91;
  commandMap["HG"]  = 92;
  commandMap["HW"]  = 93;
  commandMap["HL"]  = 94;
  commandMap["HR"]  = 95;
  commandMap["HS"]  = 96;
  commandMap["HWP"] = 97;
}

// =====================================================
// Setup
// =====================================================
void setup() {

  Serial.begin(115200);

  pinMode(STATUS_LED, OUTPUT);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  initCommandMap();

  // DFPlayer Mini UART2
  dfSerial.begin(
      9600,
      SERIAL_8N1,
      DF_RX,
      DF_TX
  );

  if(dfPlayer.begin(dfSerial)) {

    Serial.println("DFPlayer Ready");

    dfPlayer.volume(25);
    dfPlayer.EQ(DFPLAYER_EQ_NORMAL);
  }
  else {

    Serial.println("DFPlayer Not Found");
  }

  // BLE
  BLEDevice::init("SafeSight-SmartHelmet");

  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  BLEService* pService =
      pServer->createService(SERVICE_UUID);

  pTxCharacteristic =
      pService->createCharacteristic(
        CHARACTERISTIC_UUID_TX,
        BLECharacteristic::PROPERTY_NOTIFY
      );

  pTxCharacteristic->addDescriptor(
      new BLE2902()
  );

  BLECharacteristic* pRx =
      pService->createCharacteristic(
        CHARACTERISTIC_UUID_RX,
        BLECharacteristic::PROPERTY_WRITE |
        BLECharacteristic::PROPERTY_WRITE_NR
      );

  pRx->setCallbacks(
      new RXCallbacks()
  );

  pService->start();

  BLEAdvertising* advertising =
      BLEDevice::getAdvertising();

  advertising->addServiceUUID(
      SERVICE_UUID
  );

  advertising->start();

  Serial.println("BLE Advertising...");
}

// =====================================================
// Loop
// =====================================================
void loop() {

  if(!deviceConnected && oldDeviceConnected) {

    delay(500);

    pServer->startAdvertising();

    oldDeviceConnected = deviceConnected;
  }

  if(deviceConnected && !oldDeviceConnected) {

    oldDeviceConnected = deviceConnected;
  }

  unsigned long now = millis();

  if(now - lastObstacleCheck >= OBSTACLE_INTERVAL) {

    lastObstacleCheck = now;

    checkObstacle();
  }

  delay(20);
}
```
