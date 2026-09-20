package com.example.smarthelmet.service

import com.example.smarthelmet.model.Esp32Telemetry
import com.example.smarthelmet.model.ObstacleData
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlin.math.cos
import kotlin.math.sin

class BleHelmetManager(private val scope: CoroutineScope) {

    private val _telemetry = MutableStateFlow(
        Esp32Telemetry(
            deviceId = "ESP32-HELMET-01",
            firmwareVersion = "v2.4.1-BLE",
            connected = false,
            connectionType = "SIMULATOR",
            batteryPercent = 88,
            isCharging = false,
            wifiRssiDbm = -58,
            tempCelsius = 31.4,
            buzzerActive = false,
            vibrationLevel = 0,
            speakerVolume = 85,
            gpsFix = true,
            satellites = 9
        )
    )
    val telemetry: StateFlow<Esp32Telemetry> = _telemetry.asStateFlow()

    private val _obstacle = MutableStateFlow(
        ObstacleData(
            frontDistanceCm = 185,
            leftDistanceCm = 240,
            rightDistanceCm = 220,
            zone = "safe",
            closestDistanceCm = 185,
            closestSector = "front",
            detectedAt = System.currentTimeMillis(),
            vibrating = false
        )
    )
    val obstacle: StateFlow<ObstacleData> = _obstacle.asStateFlow()

    private var simJob: Job? = null
    var isSimulated: Boolean = false
        private set

    fun connectVirtualDevice(): Pair<Boolean, String> {
        isSimulated = true
        _telemetry.value = _telemetry.value.copy(
            connected = true,
            deviceId = "ESP32-BLE-VIRTUAL",
            connectionType = "SIMULATOR",
            batteryPercent = 92,
            lastHeartbeat = System.currentTimeMillis()
        )

        simJob?.cancel()
        simJob = scope.launch {
            while (isActive && _telemetry.value.connected) {
                delay(800)
                val time = System.currentTimeMillis().toDouble()
                val front = (180 + sin(time / 1500.0) * 55).toInt().coerceIn(30, 260)
                val left = (200 + cos(time / 1800.0) * 45).toInt().coerceIn(35, 260)
                val right = (210 + sin(time / 2000.0) * 50).toInt().coerceIn(35, 260)

                val minDistance = minOf(front, left, right)
                val zone = when {
                    minDistance < 60 -> "danger"
                    minDistance < 140 -> "warning"
                    else -> "safe"
                }

                val closestSector = when {
                    left < front && left < right -> "left"
                    right < front -> "right"
                    else -> "front"
                }

                val isVibrating = zone != "safe"

                _obstacle.value = ObstacleData(
                    frontDistanceCm = front,
                    leftDistanceCm = left,
                    rightDistanceCm = right,
                    zone = zone,
                    closestDistanceCm = minDistance,
                    closestSector = closestSector,
                    detectedAt = System.currentTimeMillis(),
                    vibrating = isVibrating
                )

                _telemetry.value = _telemetry.value.copy(
                    vibrationLevel = if (isVibrating) 100 else 0,
                    buzzerActive = zone == "danger",
                    lastHeartbeat = System.currentTimeMillis()
                )
            }
        }

        return Pair(true, "เชื่อมต่อหมวกจำลอง (Virtual BLE Helmet) สำเร็จ พร้อมทำงาน")
    }

    fun disconnect() {
        simJob?.cancel()
        simJob = null
        isSimulated = false
        _telemetry.value = _telemetry.value.copy(
            connected = false,
            vibrationLevel = 0,
            buzzerActive = false
        )
        _obstacle.value = _obstacle.value.copy(
            vibrating = false
        )
    }

    fun triggerManualHaptic(durationMs: Long = 300) {
        scope.launch {
            _telemetry.value = _telemetry.value.copy(vibrationLevel = 100)
            _obstacle.value = _obstacle.value.copy(vibrating = true)
            delay(durationMs)
            _telemetry.value = _telemetry.value.copy(vibrationLevel = 0)
            _obstacle.value = _obstacle.value.copy(vibrating = false)
        }
    }

    fun triggerManualBuzzer(durationMs: Long = 300) {
        scope.launch {
            _telemetry.value = _telemetry.value.copy(buzzerActive = true)
            delay(durationMs)
            _telemetry.value = _telemetry.value.copy(buzzerActive = false)
        }
    }
}
