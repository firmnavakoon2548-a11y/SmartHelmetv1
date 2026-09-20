package com.example.smarthelmet.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.smarthelmet.ui.components.*
import com.example.smarthelmet.ui.components.dialogs.*
import com.example.smarthelmet.ui.theme.*

@Composable
fun HomeScreen(
    viewModel: MainViewModel,
    hasPermissions: Boolean = true,
    onRequestPermissions: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val telemetry by viewModel.telemetry.collectAsStateWithLifecycle()
    val obstacle by viewModel.obstacle.collectAsStateWithLifecycle()
    val gps by viewModel.gps.collectAsStateWithLifecycle()
    val savedRoutes by viewModel.savedRoutes.collectAsStateWithLifecycle()
    val navState by viewModel.navState.collectAsStateWithLifecycle()
    val voiceSettings by viewModel.voiceSettings.collectAsStateWithLifecycle()
    val logs by viewModel.logs.collectAsStateWithLifecycle()
    val recordingSession by viewModel.recordingSession.collectAsStateWithLifecycle()

    val isRouteRecorderOpen by viewModel.isRouteRecorderOpen.collectAsStateWithLifecycle()
    val isSavedRoutesOpen by viewModel.isSavedRoutesOpen.collectAsStateWithLifecycle()
    val isEsp32HubOpen by viewModel.isEsp32HubOpen.collectAsStateWithLifecycle()
    val isHelpOpen by viewModel.isHelpOpen.collectAsStateWithLifecycle()
    val proximityRoute by viewModel.proximityDialogData.collectAsStateWithLifecycle()

    val searchResults by viewModel.searchResults.collectAsStateWithLifecycle()
    val isSearching by viewModel.isSearching.collectAsStateWithLifecycle()

    val isListening by viewModel.voiceCommandManager.isListening.collectAsStateWithLifecycle()
    val recognizedTranscript by viewModel.voiceCommandManager.recognizedTranscript.collectAsStateWithLifecycle()

    var isLogsExpanded by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            Header(
                telemetry = telemetry,
                gps = gps,
                highContrast = voiceSettings.highContrast,
                onToggleHighContrast = { viewModel.toggleHighContrast() },
                onOpenHelp = { viewModel.setHelpOpen(true) },
                onOpenSavedRoutes = { viewModel.setSavedRoutesOpen(true) },
                onOpenRecorder = { viewModel.setRouteRecorderOpen(true) },
                onOpenEsp32Hub = { viewModel.setEsp32HubOpen(true) }
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
        contentWindowInsets = WindowInsets.safeDrawing,
        modifier = modifier.fillMaxSize()
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
            contentAlignment = Alignment.TopCenter
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .widthIn(max = 640.dp)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // 0. Prominent Permission Request Banner if not yet granted
                if (!hasPermissions) {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = WarningBg),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(2.dp, WarningAmber, RoundedCornerShape(16.dp))
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Warning,
                                    contentDescription = "แจ้งเตือนสิทธิ์",
                                    tint = WarningAmber,
                                    modifier = Modifier.size(28.dp)
                                )
                                Text(
                                    text = "ขออนุญาตสิทธิ์การใช้งานแอป",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 17.sp,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                            }
                            Text(
                                text = "กรุณากดปุ่มด้านล่างเพื่ออนุญาตสิทธิ์ 'ตำแหน่ง GPS' และ 'ไมโครโฟน' เพื่อให้หมวกอัจฉริยะนำทางและรับคำสั่งเสียงได้อย่างสมบูรณ์",
                                fontSize = 14.sp,
                                color = MaterialTheme.colorScheme.onSurface,
                                lineHeight = 20.sp
                            )
                            Button(
                                onClick = onRequestPermissions,
                                colors = ButtonDefaults.buttonColors(containerColor = WarningAmber),
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(52.dp)
                                    .testTag("request_permissions_btn")
                            ) {
                                Icon(
                                    imageVector = Icons.Default.CheckCircle,
                                    contentDescription = null,
                                    tint = Color.Black
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "แตะเพื่ออนุญาตสิทธิ์ทันที",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 16.sp,
                                    color = Color.Black
                                )
                            }
                        }
                    }
                }

                // Quick Accessibility Audio Announcement Bar (เสียงสรุปสถานะ)
                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(16.dp))
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(
                                imageVector = Icons.Default.SpatialAudio,
                                contentDescription = null,
                                tint = CyanAccent,
                                modifier = Modifier.size(24.dp)
                            )
                            Column {
                                Text(
                                    text = "ผู้ช่วยเสียงคนตาบอด",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                                Text(
                                    text = if (telemetry.connected) "หมวกเชื่อมต่อแล้ว • GPS พร้อม" else "แตะเพื่อฟังสรุปสถานะแอป",
                                    fontSize = 12.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }

                        FilledTonalButton(
                            onClick = {
                                val statusText = buildString {
                                    append("สถานะระบบSafeSight: ")
                                    if (telemetry.connected) {
                                        append("หมวกอัจฉริยะเชื่อมต่อบลูทูธเรียบร้อยแล้ว แบตเตอรี่หมวก ${telemetry.batteryPercent} เปอร์เซ็นต์ ")
                                    } else {
                                        append("ยังไม่ได้เชื่อมต่อบลูทูธกับหมวก ")
                                    }
                                    if (navState.isActive) {
                                        append("กำลังนำทาง: ${navState.currentInstructionTh} ระยะทางที่เหลือ ${navState.totalDistanceRemaining} เมตร ")
                                    } else {
                                        append("ขณะนี้ระบบพร้อมนำทาง กดปุ่มไมโครโฟนเพื่อบอกจุดหมายได้เลยค่ะ ")
                                    }
                                    if (obstacle.zone == "danger") {
                                        append("คำเตือน ตรวจพบสิ่งกีดขวางใกล้ ${obstacle.closestDistanceCm} เซนติเมตร")
                                    }
                                }
                                viewModel.soundManager.speak(statusText)
                            },
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier
                                .height(44.dp)
                                .testTag("speak_status_btn")
                        ) {
                            Icon(
                                imageVector = Icons.Default.VolumeUp,
                                contentDescription = "ฟังสรุปสถานะ",
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(text = "ฟังสรุป", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
                    }
                }

                // 1. Hardware Status Card
                BluetoothHelmetCard(
                    telemetry = telemetry,
                    onConnectVirtual = { viewModel.connectVirtualHelmet() },
                    onDisconnect = { viewModel.disconnectHelmet() },
                    onTestHaptic = { viewModel.testHapticMotor() },
                    onTestBuzzer = { viewModel.testBuzzer() },
                    onOpenEsp32Hub = { viewModel.setEsp32HubOpen(true) }
                )

                // 2. Obstacle Sonar Radar Card
                SafetyScannerCard(
                    obstacle = obstacle,
                    onTestAlert = { viewModel.soundManager.playObstacleAlert(obstacle.closestDistanceCm) }
                )

                // 3. Map & Turn-by-turn Navigation Card
                MapNavigationCard(
                    navState = navState,
                    gps = gps,
                    searchResults = searchResults,
                    isSearching = isSearching,
                    onSearchPlace = { query -> viewModel.searchPlace(query) },
                    onSelectSearchResult = { place -> viewModel.startNavigationToPlace(place) },
                    onStartNavigation = { route, isSim -> viewModel.startNavigation(route, isSim) },
                    onStopNavigation = { viewModel.stopNavigation() },
                    onSpeakInstruction = { text -> viewModel.soundManager.speak(text) }
                )

                // 4. Voice Command Assistant Card
                VoiceAssistantCard(
                    isListening = isListening,
                    transcript = recognizedTranscript,
                    onStartListening = { viewModel.voiceCommandManager.startListening(voiceSettings.language) },
                    onStopListening = { viewModel.voiceCommandManager.stopListening() },
                    onQuickCommand = { cmd -> viewModel.voiceCommandManager.parseAndDispatchCommand(cmd) }
                )

                // 5. System Log Terminal (Collapsible for Clean Accessibility)
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(16.dp))
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .clickable { isLogsExpanded = !isLogsExpanded }
                                .padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Terminal,
                                    contentDescription = null,
                                    tint = CyanAccent,
                                    modifier = Modifier.size(20.dp)
                                )
                                Text(
                                    text = "บันทึกข้อมูลเทคนิคระบบ IoT (${logs.size})",
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 14.sp,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                            }
                            IconButton(onClick = { isLogsExpanded = !isLogsExpanded }) {
                                Icon(
                                    imageVector = if (isLogsExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                                    contentDescription = if (isLogsExpanded) "ย่อบันทึก" else "ขยายบันทึก",
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }

                        if (isLogsExpanded) {
                            Spacer(modifier = Modifier.height(10.dp))
                            SystemLogTerminal(
                                logs = logs,
                                onClearLogs = { viewModel.clearLogs() }
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }

    // Modal Dialogs
    RouteRecorderDialog(
        isOpen = isRouteRecorderOpen,
        session = recordingSession,
        gps = gps,
        onDismiss = { viewModel.setRouteRecorderOpen(false) },
        onStartRecording = { name, desc -> viewModel.startRouteRecording(name, desc) },
        onAddBreadcrumb = { lat, lng -> viewModel.addBreadcrumbPoint(lat, lng) },
        onFinishAndSave = { viewModel.finishAndSaveRecordedRoute() }
    )

    SavedRoutesDialog(
        isOpen = isSavedRoutesOpen,
        routes = savedRoutes,
        onDismiss = { viewModel.setSavedRoutesOpen(false) },
        onSelectRoute = { route -> viewModel.startNavigation(route, isSimulation = true) },
        onDeleteRoute = { id -> viewModel.deleteRoute(id) },
        onToggleFavorite = { id -> viewModel.toggleFavoriteRoute(id) }
    )

    Esp32HubDialog(
        isOpen = isEsp32HubOpen,
        telemetry = telemetry,
        onDismiss = { viewModel.setEsp32HubOpen(false) },
        onConnectVirtual = { viewModel.connectVirtualHelmet() },
        onDisconnect = { viewModel.disconnectHelmet() },
        onTestHaptic = { viewModel.testHapticMotor() },
        onTestBuzzer = { viewModel.testBuzzer() }
    )

    AccessibilityHelpDialog(
        isOpen = isHelpOpen,
        onDismiss = { viewModel.setHelpOpen(false) }
    )

    ProximityWarningDialog(
        route = proximityRoute,
        onDismiss = { viewModel.setProximityDialogData(null) },
        onStartNavigation = { route -> viewModel.startNavigation(route, isSimulation = false) }
    )
}
