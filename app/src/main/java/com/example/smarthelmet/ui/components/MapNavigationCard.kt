package com.example.smarthelmet.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.DirectionsWalk
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.smarthelmet.model.GpsLocation
import com.example.smarthelmet.model.NavigationState
import com.example.smarthelmet.model.Route
import com.example.smarthelmet.model.SearchPlaceResult
import com.example.smarthelmet.ui.theme.*

@Composable
fun MapNavigationCard(
    navState: NavigationState,
    gps: GpsLocation,
    searchResults: List<SearchPlaceResult>,
    isSearching: Boolean,
    onSearchPlace: (String) -> Unit,
    onSelectSearchResult: (SearchPlaceResult) -> Unit,
    onStartNavigation: (Route, Boolean) -> Unit,
    onStopNavigation: () -> Unit,
    onSpeakInstruction: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var searchQuery by remember { mutableStateOf("") }
    val quickDestinations = listOf(
        "ตึก LC อาคารเรียนรวม",
        "โรงอาหารกลาง",
        "หอสมุดกลาง",
        "ป้ายรถเมล์หน้ามหาวิทยาลัย",
        "ประตูทางเข้าหลัก"
    )

    Card(
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        ),
        shape = RoundedCornerShape(16.dp),
        modifier = modifier
            .fillMaxWidth()
            .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(16.dp))
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            // Card Title Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Navigation,
                        contentDescription = "Navigation",
                        tint = CyanAccent
                    )
                    Text(
                        text = "การนำทางและแผนที่ (Google Maps / OSM API)",
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 15.sp,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }

                if (navState.isActive) {
                    Surface(
                        color = SuccessBg,
                        shape = RoundedCornerShape(6.dp)
                    ) {
                        Text(
                            text = if (navState.isSimulation) "กำลังจำลองการเดิน" else "กำลังนำทางจริง",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = SuccessEmerald,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Search Box
            OutlinedTextField(
                value = searchQuery,
                onValueChange = {
                    searchQuery = it
                    onSearchPlace(it)
                },
                placeholder = { Text(text = "ค้นหาจุดหมายปลายทาง (เช่น ไปตึก LC)", fontSize = 13.sp) },
                leadingIcon = {
                    Icon(imageVector = Icons.Default.Search, contentDescription = "Search", tint = CyanAccent)
                },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = {
                            searchQuery = ""
                            onSearchPlace("")
                        }) {
                            Icon(imageVector = Icons.Default.Close, contentDescription = "Clear", tint = TextMuted)
                        }
                    }
                },
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = CyanAccent,
                    unfocusedBorderColor = MaterialTheme.colorScheme.outline,
                    focusedContainerColor = MaterialTheme.colorScheme.surface,
                    unfocusedContainerColor = MaterialTheme.colorScheme.surface
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("destination_search_input")
            )

            // Search Results Dropdown List
            if (searchResults.isNotEmpty()) {
                Spacer(modifier = Modifier.height(6.dp))
                Surface(
                    color = MaterialTheme.colorScheme.surface,
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(6.dp)) {
                        searchResults.take(4).forEach { place ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(8.dp))
                                    .clickable {
                                        searchQuery = place.name
                                        onSelectSearchResult(place)
                                    }
                                    .padding(8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Place,
                                    contentDescription = null,
                                    tint = TealPrimary,
                                    modifier = Modifier.size(18.dp)
                                )
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(text = place.name, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                                    Text(
                                        text = place.displayName,
                                        fontSize = 11.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        maxLines = 1
                                    )
                                }
                                Icon(
                                    imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                                    contentDescription = "Navigate",
                                    tint = CyanAccent,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        }
                    }
                }
            }

            // Quick Preset Destination Chips
            Spacer(modifier = Modifier.height(8.dp))
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                items(quickDestinations) { dest ->
                    Surface(
                        color = MaterialTheme.colorScheme.surface,
                        shape = RoundedCornerShape(20.dp),
                        modifier = Modifier
                            .clip(RoundedCornerShape(20.dp))
                            .clickable {
                                searchQuery = dest
                                onSearchPlace(dest)
                            }
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.DirectionsWalk,
                                contentDescription = null,
                                tint = TealPrimary,
                                modifier = Modifier.size(12.dp)
                            )
                            Text(text = dest, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurface)
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Interactive Road Map Canvas Visualizer
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(180.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(DarkBg)
                    .border(1.dp, Color(0x330D9488), RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center
            ) {
                Canvas(modifier = Modifier.fillMaxSize()) {
                    val w = size.width
                    val h = size.height

                    // Grid street background lines
                    val gridColor = Color(0x1538BDF8)
                    for (x in 0..w.toInt() step 35) {
                        drawLine(color = gridColor, start = Offset(x.toFloat(), 0f), end = Offset(x.toFloat(), h), strokeWidth = 1f)
                    }
                    for (y in 0..h.toInt() step 35) {
                        drawLine(color = gridColor, start = Offset(0f, y.toFloat()), end = Offset(w, y.toFloat()), strokeWidth = 1f)
                    }

                    // Draw Route Path if Active
                    if (navState.isActive && navState.route != null) {
                        val path = Path()
                        path.moveTo(w * 0.15f, h * 0.8f)
                        path.lineTo(w * 0.35f, h * 0.8f)
                        path.lineTo(w * 0.35f, h * 0.35f)
                        path.lineTo(w * 0.7f, h * 0.35f)
                        path.lineTo(w * 0.85f, h * 0.2f)

                        // Path glow & road line
                        drawPath(
                            path = path,
                            color = Color(0x5506B6D4),
                            style = Stroke(width = 12f, cap = StrokeCap.Round, join = StrokeJoin.Round)
                        )
                        drawPath(
                            path = path,
                            color = CyanAccent,
                            style = Stroke(width = 5f, cap = StrokeCap.Round, join = StrokeJoin.Round)
                        )

                        // Waypoint points
                        drawCircle(color = TealLight, radius = 6f, center = Offset(w * 0.35f, h * 0.8f))
                        drawCircle(color = TealLight, radius = 6f, center = Offset(w * 0.35f, h * 0.35f))
                        drawCircle(color = TealLight, radius = 6f, center = Offset(w * 0.7f, h * 0.35f))

                        // Destination Pin (B)
                        drawCircle(color = DangerRed, radius = 10f, center = Offset(w * 0.85f, h * 0.2f))
                        drawCircle(color = Color.White, radius = 4f, center = Offset(w * 0.85f, h * 0.2f))

                        // Live User Location (A / Current Progress)
                        val progressRatio = if (navState.route.totalDistanceMeters > 0) {
                            (1f - navState.totalDistanceRemaining.toFloat() / navState.route.totalDistanceMeters).coerceIn(0f, 1f)
                        } else 0f

                        val userX = w * (0.15f + progressRatio * 0.7f)
                        val userY = h * (0.8f - progressRatio * 0.6f)

                        drawCircle(color = Color(0x4410B981), radius = 16f, center = Offset(userX, userY))
                        drawCircle(color = SuccessEmerald, radius = 8f, center = Offset(userX, userY))
                        drawCircle(color = Color.White, radius = 3f, center = Offset(userX, userY))
                    } else {
                        // Center standby GPS pulse
                        val cx = w / 2
                        val cy = h / 2
                        drawCircle(color = Color(0x330D9488), radius = 30f, center = Offset(cx, cy))
                        drawCircle(color = TealPrimary, radius = 10f, center = Offset(cx, cy))
                        drawCircle(color = Color.White, radius = 4f, center = Offset(cx, cy))
                    }
                }

                // Map Overlay Info Badge
                Surface(
                    color = Color(0xCC050B18),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .padding(8.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(6.dp)
                                .clip(CircleShape)
                                .background(SuccessEmerald)
                        )
                        Text(
                            text = "OSRM Road Pedestrian Network",
                            fontSize = 10.sp,
                            color = TextSecondary
                        )
                    }
                }
            }

            // Live Navigation Instructions Banner
            if (navState.isActive) {
                Spacer(modifier = Modifier.height(12.dp))
                Surface(
                    color = MaterialTheme.colorScheme.surface,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            // Turn Direction Icon Badge
                            Box(
                                modifier = Modifier
                                    .size(56.dp)
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(TealPrimary)
                                    .border(2.dp, CyanAccent, RoundedCornerShape(14.dp)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = when (navState.nextDirection) {
                                        "left", "slight-left" -> Icons.Default.TurnLeft
                                        "right", "slight-right" -> Icons.Default.TurnRight
                                        "arrive" -> Icons.Default.Flag
                                        else -> Icons.Default.Straight
                                    },
                                    contentDescription = "ทิศทางการเลี้ยว",
                                    tint = Color.White,
                                    modifier = Modifier.size(34.dp)
                                )
                            }

                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = navState.currentInstructionTh.ifEmpty { "เดินตามเส้นทางนำทาง" },
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 17.sp,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                                Spacer(modifier = Modifier.height(3.dp))
                                Text(
                                    text = "ระยะทางที่เหลือ: ${navState.totalDistanceRemaining} เมตร",
                                    fontSize = 14.sp,
                                    color = CyanAccent,
                                    fontWeight = FontWeight.Bold
                                )
                            }

                            IconButton(
                                onClick = { onSpeakInstruction(navState.currentInstructionTh) },
                                modifier = Modifier
                                    .size(48.dp)
                                    .testTag("speak_instruction_btn")
                            ) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Filled.VolumeUp,
                                    contentDescription = "กดเพื่อฟังเสียงนำทางซ้ำ",
                                    tint = CyanAccent,
                                    modifier = Modifier.size(28.dp)
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Navigation Control Buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (!navState.isActive) {
                    Button(
                        onClick = {
                            if (searchQuery.isNotEmpty()) {
                                onSearchPlace(searchQuery)
                            }
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = TealPrimary,
                            contentColor = Color.White
                        ),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .weight(1f)
                            .height(52.dp)
                            .testTag("start_navigation_btn")
                    ) {
                        Icon(imageVector = Icons.AutoMirrored.Filled.DirectionsWalk, contentDescription = null, modifier = Modifier.size(20.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(text = "เริ่มนำทาง", fontSize = 15.sp, fontWeight = FontWeight.Bold)
                    }
                } else {
                    Button(
                        onClick = onStopNavigation,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = DangerRed,
                            contentColor = Color.White
                        ),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .weight(1f)
                            .height(52.dp)
                            .testTag("stop_navigation_btn")
                    ) {
                        Icon(imageVector = Icons.Default.Stop, contentDescription = null, modifier = Modifier.size(20.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(text = "หยุดการนำทาง", fontSize = 15.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
