package com.example.smarthelmet.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.smarthelmet.model.Esp32Telemetry
import com.example.smarthelmet.model.GpsLocation
import com.example.smarthelmet.ui.theme.*

@Composable
fun Header(
    telemetry: Esp32Telemetry,
    gps: GpsLocation,
    highContrast: Boolean,
    onToggleHighContrast: () -> Unit,
    onOpenHelp: () -> Unit,
    onOpenSavedRoutes: () -> Unit,
    onOpenRecorder: () -> Unit,
    onOpenEsp32Hub: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        modifier = modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(42.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(TealPrimary),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.DirectionsWalk,
                            contentDescription = "Smart Helmet Logo",
                            tint = Color.White,
                            modifier = Modifier.size(26.dp)
                        )
                    }
                    Column {
                        Text(
                            text = "หมวกอัจฉริยะนำทาง",
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Text(
                            text = "Smart Helmet for Visually Impaired",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    IconButton(
                        onClick = onToggleHighContrast,
                        modifier = Modifier.testTag("toggle_high_contrast")
                    ) {
                        Icon(
                            imageVector = if (highContrast) Icons.Default.Contrast else Icons.Default.Brightness6,
                            contentDescription = "Toggle High Contrast",
                            tint = if (highContrast) HighContrastYellow else CyanAccent
                        )
                    }
                    IconButton(
                        onClick = onOpenHelp,
                        modifier = Modifier.testTag("help_button")
                    ) {
                        Icon(
                            imageVector = Icons.Default.HelpOutline,
                            contentDescription = "Accessibility Help",
                            tint = MaterialTheme.colorScheme.onSurface
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Quick Status & Action Pills Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // BLE Chip
                Surface(
                    color = if (telemetry.connected) SuccessBg else DangerBg,
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier
                        .clickable { onOpenEsp32Hub() }
                        .testTag("esp32_status_chip")
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(if (telemetry.connected) SuccessEmerald else DangerRed)
                        )
                        Text(
                            text = if (telemetry.connected) "หมวกเชื่อมต่อ (${telemetry.batteryPercent}%)" else "หมวกออฟไลน์",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = if (telemetry.connected) SuccessEmerald else DangerRed
                        )
                    }
                }

                // GPS Chip
                Surface(
                    color = SuccessBg,
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.GpsFixed,
                            contentDescription = "GPS Fix",
                            tint = SuccessEmerald,
                            modifier = Modifier.size(12.dp)
                        )
                        Text(
                            text = "GPS แม่นยำ ±${gps.accuracy.toInt()}m",
                            fontSize = 12.sp,
                            color = SuccessEmerald,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }

                Spacer(modifier = Modifier.weight(1f))

                // Saved Routes Button
                Button(
                    onClick = onOpenSavedRoutes,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant,
                        contentColor = MaterialTheme.colorScheme.onSurface
                    ),
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                    modifier = Modifier.testTag("saved_routes_btn")
                ) {
                    Icon(
                        imageVector = Icons.Default.BookmarkBorder,
                        contentDescription = "Saved Routes",
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(text = "เส้นทาง", fontSize = 12.sp)
                }

                // Record Route Button
                Button(
                    onClick = onOpenRecorder,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = TealPrimary,
                        contentColor = Color.White
                    ),
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                    modifier = Modifier.testTag("record_route_btn")
                ) {
                    Icon(
                        imageVector = Icons.Default.FiberManualRecord,
                        contentDescription = "Record Route",
                        modifier = Modifier.size(14.dp),
                        tint = DangerRed
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(text = "บันทึก", fontSize = 12.sp)
                }
            }
        }
    }
}
