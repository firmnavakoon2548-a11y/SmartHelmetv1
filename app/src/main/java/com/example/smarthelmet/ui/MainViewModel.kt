package com.example.smarthelmet.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.smarthelmet.data.local.AppDatabase
import com.example.smarthelmet.data.network.WalkingRouterService
import com.example.smarthelmet.data.repository.RouteRepository
import com.example.smarthelmet.model.*
import com.example.smarthelmet.service.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import java.text.SimpleDateFormat
import java.util.*

class MainViewModel(application: Application) : AndroidViewModel(application) {

    private val db = AppDatabase.getDatabase(application)
    val routeRepository = RouteRepository(db.routeDao())
    val walkingRouterService = WalkingRouterService()
    val soundManager = SoundManager(application)
    val gpsTracker = GpsTracker(application)
    val bleHelmetManager = BleHelmetManager(viewModelScope)

    // Telemetry & Obstacles
    val telemetry: StateFlow<Esp32Telemetry> = bleHelmetManager.telemetry
    val obstacle: StateFlow<ObstacleData> = bleHelmetManager.obstacle
    val gps: StateFlow<GpsLocation> = gpsTracker.gpsLocation

    // Saved Routes from Room
    val savedRoutes: StateFlow<List<Route>> = routeRepository.allRoutes.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

    // Navigation State
    private val _navState = MutableStateFlow(NavigationState())
    val navState: StateFlow<NavigationState> = _navState.asStateFlow()

    // Voice & Accessibility Settings
    private val _voiceSettings = MutableStateFlow(VoiceSettings())
    val voiceSettings: StateFlow<VoiceSettings> = _voiceSettings.asStateFlow()

    // System Logs
    private val _logs = MutableStateFlow<List<SystemLog>>(
        listOf(
            SystemLog(
                timestamp = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date()),
                category = "GPS",
                message = "ระบบแผนที่และพิกัดเดินเท้า OpenStreetMap (OSM) พร้อมทำงาน 100%",
                level = "success"
            ),
            SystemLog(
                timestamp = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date()),
                category = "ESP32",
                message = "โหมดนำทาง: โหมดมือถือ (Phone Mode) / รองรับบลูทูธหมวก (BLE Helmet)",
                level = "info"
            )
        )
    )
    val logs: StateFlow<List<SystemLog>> = _logs.asStateFlow()

    // Route Recording Session
    private val _recordingSession = MutableStateFlow(RouteRecordingSession())
    val recordingSession: StateFlow<RouteRecordingSession> = _recordingSession.asStateFlow()

    // Dialogs State
    private val _isRouteRecorderOpen = MutableStateFlow(false)
    val isRouteRecorderOpen: StateFlow<Boolean> = _isRouteRecorderOpen.asStateFlow()

    private val _isSavedRoutesOpen = MutableStateFlow(false)
    val isSavedRoutesOpen: StateFlow<Boolean> = _isSavedRoutesOpen.asStateFlow()

    private val _isEsp32HubOpen = MutableStateFlow(false)
    val isEsp32HubOpen: StateFlow<Boolean> = _isEsp32HubOpen.asStateFlow()

    private val _isHelpOpen = MutableStateFlow(false)
    val isHelpOpen: StateFlow<Boolean> = _isHelpOpen.asStateFlow()

    private val _proximityDialogData = MutableStateFlow<Route?>(null)
    val proximityDialogData: StateFlow<Route?> = _proximityDialogData.asStateFlow()

    // Search Results State
    private val _searchResults = MutableStateFlow<List<SearchPlaceResult>>(emptyList())
    val searchResults: StateFlow<List<SearchPlaceResult>> = _searchResults.asStateFlow()

    private val _isSearching = MutableStateFlow(false)
    val isSearching: StateFlow<Boolean> = _isSearching.asStateFlow()

    // Simulation Job
    private var simulationJob: Job? = null

    // Voice Recognizer
    val voiceCommandManager = VoiceCommandManager(application) { result ->
        handleVoiceCommandResult(result)
    }

    init {
        gpsTracker.startTracking()

        // Observe obstacles for audio & haptic warnings
        viewModelScope.launch {
            obstacle.collect { obs ->
                if (obs.zone == "danger") {
                    soundManager.playObstacleAlert(obs.closestDistanceCm)
                    soundManager.vibrate(150)
                } else if (obs.zone == "warning") {
                    soundManager.playObstacleAlert(obs.closestDistanceCm)
                }
            }
        }
    }

    fun addLog(category: String, message: String, level: String = "info") {
        val time = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
        val newLog = SystemLog(timestamp = time, category = category, message = message, level = level)
        val current = _logs.value.toMutableList()
        if (current.size > 40) current.removeAt(0)
        current.add(newLog)
        _logs.value = current
    }

    fun clearLogs() {
        _logs.value = emptyList()
    }

    fun toggleHighContrast() {
        _voiceSettings.value = _voiceSettings.value.copy(
            highContrast = !_voiceSettings.value.highContrast
        )
    }

    fun setLanguage(lang: String) {
        _voiceSettings.value = _voiceSettings.value.copy(language = lang)
        soundManager.setLanguage(lang)
    }

    fun setVoiceRate(rate: Float) {
        _voiceSettings.value = _voiceSettings.value.copy(rate = rate)
        soundManager.setSpeechRate(rate)
    }

    fun setVoicePitch(pitch: Float) {
        _voiceSettings.value = _voiceSettings.value.copy(pitch = pitch)
        soundManager.setPitch(pitch)
    }

    // Modal Toggles
    fun setRouteRecorderOpen(open: Boolean) { _isRouteRecorderOpen.value = open }
    fun setSavedRoutesOpen(open: Boolean) { _isSavedRoutesOpen.value = open }
    fun setEsp32HubOpen(open: Boolean) { _isEsp32HubOpen.value = open }
    fun setHelpOpen(open: Boolean) { _isHelpOpen.value = open }
    fun setProximityDialogData(route: Route?) { _proximityDialogData.value = route }

    fun deleteRoute(id: String) {
        viewModelScope.launch {
            routeRepository.delete(id)
            addLog("NAV", "ลบเส้นทางเรียบร้อยแล้ว", "info")
        }
    }

    fun toggleFavoriteRoute(id: String) {
        viewModelScope.launch {
            routeRepository.toggleFavorite(id)
        }
    }

    // BLE Connect / Disconnect
    fun connectVirtualHelmet() {
        val res = bleHelmetManager.connectVirtualDevice()
        addLog("ESP32", res.second, "success")
        soundManager.speak(res.second)
    }

    fun disconnectHelmet() {
        bleHelmetManager.disconnect()
        addLog("ESP32", "ตัดการเชื่อมต่อหมวกแล้ว", "warning")
    }

    fun testHapticMotor() {
        bleHelmetManager.triggerManualHaptic(400)
        soundManager.vibrate(300)
        addLog("ESP32", "ทดสอบมอเตอร์สั่นสะเทือน (Haptic Actuator) 400ms", "info")
    }

    fun testBuzzer() {
        bleHelmetManager.triggerManualBuzzer(400)
        soundManager.playDirectionChime("caution")
        addLog("ESP32", "ทดสอบลำโพงหมวก (Buzzer Sound Alert)", "info")
    }

    // Search Place
    fun searchPlace(query: String) {
        if (query.trim().length < 2) {
            _searchResults.value = emptyList()
            return
        }
        viewModelScope.launch {
            _isSearching.value = true
            val results = walkingRouterService.searchPlaces(query)
            _searchResults.value = results
            _isSearching.value = false
            if (results.isEmpty()) {
                addLog("NAV", "ค้นหาไม่พบสถานที่ \"$query\"", "warning")
            } else {
                addLog("NAV", "พบ ${results.size} สถานที่สำหรับ \"$query\"", "success")
            }
        }
    }

    // Navigate to Place / Search Result
    fun startNavigationToPlace(place: SearchPlaceResult) {
        viewModelScope.launch {
            val currentGps = gps.value
            addLog("NAV", "กำลังคำนวณเส้นทางถนนไปยัง: ${place.name}...", "info")

            val routeCalc = walkingRouterService.calculateWalkingRoute(
                startLat = currentGps.lat,
                startLng = currentGps.lng,
                destLat = place.lat,
                destLng = place.lng,
                startName = "ตำแหน่งปัจจุบัน",
                destName = place.name
            )

            val totalDist = routeCalc.totalDistanceMeters
            if (totalDist > RouteRepository.MAX_PEDESTRIAN_DISTANCE_METERS) {
                val km = totalDist / 1000.0
                val errMsg = "ระยะทาง $km กม. เกินขีดจำกัด 10 กม. ยกเลิกการนำทางอัตโนมัติ"
                addLog("NAV", errMsg, "danger")
                soundManager.speak(errMsg, priorityEmergency = true)
                return@launch
            }

            val waypoints = routeCalc.steps.mapIndexed { i, step ->
                Waypoint(
                    lat = step.lat,
                    lng = step.lng,
                    instruction = step.instructionEn,
                    instructionTh = step.instructionTh,
                    direction = step.direction,
                    distanceMeters = step.distanceMeters,
                    landmark = step.streetName ?: if (i == routeCalc.steps.size - 1) place.name else null
                )
            }

            val route = Route(
                id = "route-${System.currentTimeMillis()}",
                name = place.name,
                description = "นำทางไปยัง ${place.displayName}",
                source = "OSRM_WALK",
                totalDistanceMeters = totalDist,
                estimatedMinutes = routeCalc.totalDurationMinutes,
                waypoints = waypoints,
                pathCoordinates = routeCalc.coordinates,
                tags = listOf("ค้นหา", "นำทาง")
            )

            // Save to room for history
            routeRepository.insert(route)
            startNavigation(route, isSimulation = false)
        }
    }

    // Start Navigation with a Route
    fun startNavigation(route: Route, isSimulation: Boolean = false) {
        simulationJob?.cancel()
        simulationJob = null

        if (route.waypoints.isEmpty()) {
            addLog("NAV", "เส้นทางไม่มีจุดมาร์ค", "warning")
            return
        }

        val firstWp = route.waypoints.first()
        val nextWp = if (route.waypoints.size > 1) route.waypoints[1] else null
        val initialDist = firstWp.distanceMeters.coerceAtLeast(20)

        val guidance = WalkingRouterService.formatLiveWalkingGuidance(
            distanceMeters = initialDist,
            currentDirection = firstWp.direction,
            currentInstructionTh = firstWp.instructionTh,
            nextDirection = nextWp?.direction,
            nextDistMeters = nextWp?.distanceMeters ?: 50,
            landmark = firstWp.landmark
        )

        _navState.value = NavigationState(
            isActive = true,
            route = route,
            currentStepIndex = 0,
            distanceToCurrentStep = initialDist,
            totalDistanceRemaining = route.totalDistanceMeters,
            currentInstruction = firstWp.instruction,
            currentInstructionTh = guidance.fullInstructionTh,
            nextDirection = firstWp.direction,
            estimatedArrivalTimestamp = System.currentTimeMillis() + route.estimatedMinutes * 60 * 1000L,
            lastSpokenTimestamp = System.currentTimeMillis(),
            isSimulation = isSimulation
        )

        val startMsg = "เริ่มนำทางไปยัง ${route.name} ระยะทางรวม ${route.totalDistanceMeters} เมตร ${guidance.fullInstructionTh}"
        addLog("NAV", startMsg, "success")
        soundManager.speak(startMsg)
        soundManager.playDirectionChime(firstWp.direction)

        if (isSimulation) {
            startSimulationLoop(route)
        }
    }

    private fun startSimulationLoop(route: Route) {
        simulationJob?.cancel()
        simulationJob = viewModelScope.launch {
            var stepIndex = 0
            while (isActive && stepIndex < route.waypoints.size) {
                val currentWp = route.waypoints[stepIndex]
                val nextWp = if (stepIndex + 1 < route.waypoints.size) route.waypoints[stepIndex + 1] else null
                var distRemainingInStep = maxOf(15, currentWp.distanceMeters)

                while (isActive && distRemainingInStep > 0) {
                    delay(1000)
                    distRemainingInStep = (distRemainingInStep - 12).coerceAtLeast(0)

                    // Update GPS position to move toward waypoint
                    gpsTracker.updateManualLocation(currentWp.lat, currentWp.lng)

                    val totalRem = route.waypoints.drop(stepIndex).sumOf { it.distanceMeters } - (currentWp.distanceMeters - distRemainingInStep)

                    val guidance = WalkingRouterService.formatLiveWalkingGuidance(
                        distanceMeters = distRemainingInStep,
                        currentDirection = currentWp.direction,
                        currentInstructionTh = currentWp.instructionTh,
                        nextDirection = nextWp?.direction,
                        nextDistMeters = nextWp?.distanceMeters ?: 50,
                        landmark = currentWp.landmark
                    )

                    _navState.value = _navState.value.copy(
                        currentStepIndex = stepIndex,
                        distanceToCurrentStep = distRemainingInStep,
                        totalDistanceRemaining = maxOf(0, totalRem),
                        currentInstructionTh = guidance.fullInstructionTh,
                        nextDirection = currentWp.direction
                    )

                    // Voice prompt when approaching turn or at turn point
                    if (distRemainingInStep in listOf(0, 50, 100, 200) || guidance.isAtTurnPoint) {
                        soundManager.speak(guidance.fullInstructionTh)
                        soundManager.playDirectionChime(currentWp.direction)
                    }
                }

                stepIndex++
            }

            // Arrived
            val arriveMsg = "คุณถึงจุดหมายปลายทาง \"${route.name}\" เรียบร้อยแล้วค่ะ"
            _navState.value = _navState.value.copy(
                isActive = false,
                currentInstructionTh = arriveMsg,
                nextDirection = "arrive",
                totalDistanceRemaining = 0
            )
            addLog("NAV", arriveMsg, "success")
            soundManager.speak(arriveMsg)
            soundManager.playDirectionChime("arrive")
        }
    }

    fun stopNavigation() {
        simulationJob?.cancel()
        simulationJob = null
        _navState.value = NavigationState(isActive = false)
        val msg = "หยุดการนำทางแล้ว"
        addLog("NAV", msg, "warning")
        soundManager.speak(msg)
    }

    // Route Recording
    fun startRouteRecording(name: String, description: String = "") {
        val current = gps.value
        _recordingSession.value = RouteRecordingSession(
            isRecording = true,
            startTime = System.currentTimeMillis(),
            routeName = name.ifEmpty { "เส้นทางที่บันทึก ${SimpleDateFormat("dd/MM HH:mm", Locale.getDefault()).format(Date())}" },
            description = description,
            recordedWaypoints = emptyList(),
            recordedGpsPath = listOf(listOf(current.lat, current.lng)),
            currentHeading = current.heading,
            lastWaypointLocation = listOf(current.lat, current.lng)
        )
        val msg = "เริ่มบันทึกเส้นทาง \"${_recordingSession.value.routeName}\""
        addLog("GPS", msg, "success")
        soundManager.speak(msg)
    }

    fun addBreadcrumbPoint(lat: Double, lng: Double) {
        val session = _recordingSession.value
        if (!session.isRecording) return
        val currentPath = session.recordedGpsPath.toMutableList()
        currentPath.add(listOf(lat, lng))
        _recordingSession.value = session.copy(recordedGpsPath = currentPath)
    }

    fun finishAndSaveRecordedRoute() {
        val session = _recordingSession.value
        if (!session.isRecording || session.recordedGpsPath.size < 2) {
            _recordingSession.value = RouteRecordingSession(isRecording = false)
            addLog("GPS", "ยกเลิกการบันทึก (พิกัดไม่เพียงพอ)", "warning")
            return
        }

        viewModelScope.launch {
            val waypoints = RouteRepository.generateWaypointsFromGpsPath(
                session.recordedGpsPath,
                session.routeName
            )

            var totalDist = 0
            for (i in 1 until session.recordedGpsPath.size) {
                totalDist += RouteRepository.calculateDistanceMeters(
                    session.recordedGpsPath[i - 1][0], session.recordedGpsPath[i - 1][1],
                    session.recordedGpsPath[i][0], session.recordedGpsPath[i][1]
                )
            }

            val route = Route(
                id = "route-${System.currentTimeMillis()}",
                name = session.routeName,
                description = session.description.ifEmpty { "เส้นทางเดินที่บันทึกด้วย GPS จริง" },
                source = "APP_RECORDED",
                totalDistanceMeters = maxOf(10, totalDist),
                estimatedMinutes = maxOf(1, totalDist / 65),
                waypoints = waypoints,
                pathCoordinates = session.recordedGpsPath,
                tags = listOf("บันทึกเอง", "GPS")
            )

            routeRepository.insert(route)
            _recordingSession.value = RouteRecordingSession(isRecording = false)
            _isRouteRecorderOpen.value = false

            val msg = "บันทึกเส้นทาง \"${route.name}\" สำเร็จ (${route.totalDistanceMeters} ม.)"
            addLog("GPS", msg, "success")
            soundManager.speak(msg)
        }
    }

    // Voice Command Handler
    private fun handleVoiceCommandResult(result: VoiceCommandResult) {
        addLog("VOICE", "คำสั่งเสียง: \"${result.rawText}\"", "info")
        when (result.intent) {
            VoiceIntent.NAVIGATE -> {
                val target = result.targetDestination
                if (!target.isNullOrBlank()) {
                    addLog("VOICE", "ค้นหาเส้นทางไป: $target", "success")
                    soundManager.speak("กำลังค้นหาเส้นทางไป $target")
                    searchPlace(target)
                }
            }
            VoiceIntent.STOP_NAV -> {
                stopNavigation()
            }
            VoiceIntent.STATUS -> {
                val tel = telemetry.value
                val statusMsg = "สถานะ: ${if (tel.connected) "เชื่อมต่อหมวกแล้ว แบตเตอรี่ ${tel.batteryPercent}%" else "หมวกยังไม่ได้เชื่อมต่อ"} GPS พร้อมใช้งานค่ะ"
                addLog("ESP32", statusMsg, "info")
                soundManager.speak(statusMsg)
            }
            VoiceIntent.RECORD_ROUTE -> {
                setRouteRecorderOpen(true)
                soundManager.speak("เปิดหน้าต่างบันทึกเส้นทางใหม่ค่ะ")
            }
            VoiceIntent.SAVE_RECORDING -> {
                finishAndSaveRecordedRoute()
            }
            VoiceIntent.VOLUME_UP -> {
                soundManager.speak("เพิ่มระดับเสียงเรียบร้อยค่ะ")
            }
            VoiceIntent.VOLUME_DOWN -> {
                soundManager.speak("ลดระดับเสียงเรียบร้อยค่ะ")
            }
            VoiceIntent.OBSTACLE_CHECK -> {
                val obs = obstacle.value
                val obsMsg = "ระยะสิ่งกีดขวาง: ด้านหน้า ${obs.frontDistanceCm} ซม. ด้านซ้าย ${obs.leftDistanceCm} ซม. ด้านขวา ${obs.rightDistanceCm} ซม. สถานะ ${if (obs.zone == "safe") "ปลอดภัย" else "พบสิ่งกีดขวาง"}"
                addLog("OBSTACLE", obsMsg, if (obs.zone == "safe") "success" else "warning")
                soundManager.speak(obsMsg)
            }
            VoiceIntent.HELP -> {
                setHelpOpen(true)
                soundManager.speak("เปิดคู่มือช่วยเหลือและคำสั่งเสียงค่ะ")
            }
            VoiceIntent.UNKNOWN -> {
                soundManager.speak("รับคำสั่ง: ${result.rawText}")
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        soundManager.release()
        gpsTracker.stopTracking()
        voiceCommandManager.stopListening()
    }
}
