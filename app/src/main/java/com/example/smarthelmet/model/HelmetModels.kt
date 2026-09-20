package com.example.smarthelmet.model

import kotlinx.serialization.Serializable

@Serializable
data class Waypoint(
    val lat: Double,
    val lng: Double,
    val instruction: String = "",
    val instructionTh: String = "",
    val direction: String = "straight", // straight, left, right, arrive, slight-left, slight-right, caution
    val distanceMeters: Int = 0,
    val landmark: String? = null
)

@Serializable
data class Route(
    val id: String,
    val name: String,
    val description: String = "",
    val createdBy: String = "User",
    val createdAt: String = "",
    val updatedAt: String = "",
    val source: String = "APP_RECORDED", // ESP32, APP_RECORDED, PRESET, FIREBASE, SAVED, PHONE_GPS
    val totalDistanceMeters: Int = 0,
    val estimatedMinutes: Int = 0,
    val waypoints: List<Waypoint> = emptyList(),
    val pathCoordinates: List<List<Double>> = emptyList(), // [[lat, lng], ...]
    val tags: List<String> = emptyList(),
    val isFavorite: Boolean = false
)

data class ObstacleData(
    val frontDistanceCm: Int = 185,
    val leftDistanceCm: Int = 240,
    val rightDistanceCm: Int = 220,
    val zone: String = "safe", // safe, warning, danger
    val closestDistanceCm: Int = 185,
    val closestSector: String = "front", // front, left, right
    val detectedAt: Long = System.currentTimeMillis(),
    val vibrating: Boolean = false
)

data class Esp32Telemetry(
    val deviceId: String = "ESP32-HELMET-01",
    val firmwareVersion: String = "v2.4.1-BLE",
    val connected: Boolean = false,
    val connectionType: String = "SIMULATOR", // SIMULATOR, BLE, WEBSOCKET, REST_API
    val batteryPercent: Int = 88,
    val isCharging: Boolean = false,
    val wifiRssiDbm: Int = -58,
    val tempCelsius: Double = 31.4,
    val buzzerActive: Boolean = false,
    val vibrationLevel: Int = 0,
    val speakerVolume: Int = 85,
    val gpsFix: Boolean = true,
    val satellites: Int = 9,
    val lastHeartbeat: Long = System.currentTimeMillis()
)

data class GpsLocation(
    val lat: Double = 13.7563,
    val lng: Double = 100.5018,
    val accuracy: Float = 3.5f,
    val heading: Float = 45f,
    val speed: Float = 0f,
    val altitude: Double = 12.0,
    val timestamp: Long = System.currentTimeMillis()
)

data class NavigationState(
    val isActive: Boolean = false,
    val route: Route? = null,
    val currentStepIndex: Int = 0,
    val distanceToCurrentStep: Int = 0,
    val totalDistanceRemaining: Int = 0,
    val currentInstruction: String = "",
    val currentInstructionTh: String = "",
    val nextDirection: String = "straight",
    val estimatedArrivalTimestamp: Long? = null,
    val deviationWarning: Boolean = false,
    val lastSpokenTimestamp: Long = 0L,
    val isSimulation: Boolean = false
)

data class RouteRecordingSession(
    val isRecording: Boolean = false,
    val startTime: Long? = null,
    val routeName: String = "",
    val description: String = "",
    val recordedWaypoints: List<Waypoint> = emptyList(),
    val recordedGpsPath: List<List<Double>> = emptyList(),
    val currentHeading: Float = 0f,
    val lastWaypointLocation: List<Double>? = null
)

data class SystemLog(
    val id: String = java.util.UUID.randomUUID().toString(),
    val timestamp: String,
    val category: String, // ESP32, NAV, OBSTACLE, VOICE, GPS
    val message: String,
    val level: String = "info" // info, success, warning, danger
)

data class VoiceSettings(
    val language: String = "th-TH",
    val volume: Float = 1.0f,
    val rate: Float = 1.0f,
    val pitch: Float = 1.0f,
    val autoSpeakDirections: Boolean = true,
    val audioBeepAlerts: Boolean = true,
    val screenReaderOptimized: Boolean = true,
    val highContrast: Boolean = false
)

@Serializable
data class SearchPlaceResult(
    val placeId: String,
    val name: String,
    val displayName: String,
    val lat: Double,
    val lng: Double,
    val type: String = "place"
)

@Serializable
data class WalkingRouteStep(
    val instructionTh: String,
    val instructionEn: String,
    val direction: String, // straight, left, right, slight-left, slight-right, arrive, caution
    val distanceMeters: Int,
    val durationSeconds: Int,
    val lat: Double,
    val lng: Double,
    val streetName: String? = null
)

@Serializable
data class CalculatedWalkingRoute(
    val totalDistanceMeters: Int,
    val totalDurationMinutes: Int,
    val coordinates: List<List<Double>>, // [[lat, lng], ...]
    val steps: List<WalkingRouteStep>,
    val startName: String,
    val destinationName: String
)
