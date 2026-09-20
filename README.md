# SafeSight - Smart Helmet for the Visually Impaired (Android)

SafeSight is an assistive Android application designed to accompany an IoT Smart Helmet equipped with ultrasonic distance sensors, ESP32 BLE microcontroller, and haptic/buzzer feedback actuators. It provides pedestrian navigation, obstacle proximity detection, live GPS route recording, Thai voice commands, and speech synthesis.

## Core Features

- **Pedestrian Turn-by-Turn Navigation**:
  - OpenStreetMap (OSM) & OSRM Foot Routing engine.
  - Step-by-step pedestrian guidance with Thai and English instructions.
  - Off-route detection and auto-recalculation within pedestrian limits.
- **Safety Scanner & Obstacle Proximity**:
  - Multi-zone distance radar (Front, Left, Right).
  - Visual color-coded warning levels (Green / Yellow / Red) and distance readouts.
  - Audio and haptic vibration feedback on imminent obstacles.
- **Smart Helmet ESP32 BLE Integration**:
  - Bluetooth Low Energy connection to the Smart Helmet hardware.
  - Real-time battery, telemetry, and sensor monitoring.
  - Built-in Virtual Helmet mode for hardware-independent demonstration and testing.
  - Haptic motor and audio buzzer test controls.
- **Voice Assistant & Thai Speech Synthesis**:
  - Offline-capable Android Text-To-Speech (TTS) with configurable pitch and rate.
  - Voice recognition for hands-free commands (e.g. "นำทางไป...", "หยุด", "สถานะ", "บันทึกเส้นทาง", "สิ่งกีดขวาง").
- **Local Route Management (Room Database)**:
  - Record custom walking routes using live GPS breadcrumbs.
  - Save, bookmark (favorites), inspect, and navigate pre-saved or custom paths offline.
- **System Event Terminal**:
  - Categorized real-time telemetry logs (ESP32, NAV, OBSTACLE, VOICE, GPS).

## Architecture & Tech Stack

- **Platform**: Android (Kotlin, Jetpack Compose, Material 3)
- **Architecture**: MVVM with Coroutines & StateFlow
- **Database**: Android Jetpack Room (KSP, SQLite)
- **Networking**: OkHttp & kotlinx.serialization
- **Accessibility**: High-contrast theme mode, accessible touch targets (≥48dp), TalkBack content descriptions.
