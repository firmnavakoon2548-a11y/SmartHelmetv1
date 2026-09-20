package com.example.smarthelmet.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import com.example.smarthelmet.ui.theme.*

@Composable
fun BluetoothHelmetCard(
    telemetry: Esp32Telemetry,
    onConnectVirtual: () -> Unit,
    onDisconnect: () -> Unit,
    onTestHaptic: () -> Unit,
    onTestBuzzer: () -> Unit,
    onOpenEsp32Hub: () -> Unit,
    modifier: Modifier = Modifier
) {
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
                        imageVector = Icons.Default.Bluetooth,
                        contentDescription = "Bluetooth Status",
                        tint = if (telemetry.connected) CyanAccent else TextMuted
                    )
                    Text(
                        text = "ฮาร์ดแวร์หมวก (ESP32 Helmet Bridge)",
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 15.sp,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }

                TextButton(
                    onClick = onOpenEsp32Hub,
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                    modifier = Modifier.testTag("open_esp32_hub_btn")
                ) {
                    Text(text = "ตั้งค่าฮับ", fontSize = 12.sp, color = CyanAccent)
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Info Grid
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // Battery
                Surface(
                    color = MaterialTheme.colorScheme.surface,
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Row(
                        modifier = Modifier.padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = if (telemetry.batteryPercent > 50) Icons.Default.BatteryFull else Icons.Default.BatteryAlert,
                            contentDescription = "Battery",
                            tint = if (telemetry.batteryPercent > 20) SuccessEmerald else DangerRed,
                            modifier = Modifier.size(20.dp)
                        )
                        Column {
                            Text(text = "แบตเตอรี่", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(
                                text = "${telemetry.batteryPercent}%",
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                        }
                    }
                }

                // Device ID / Status
                Surface(
                    color = MaterialTheme.colorScheme.surface,
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Row(
                        modifier = Modifier.padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(10.dp)
                                .clip(CircleShape)
                                .background(if (telemetry.connected) SuccessEmerald else DangerRed)
                        )
                        Column {
                            Text(text = "สถานะ", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(
                                text = if (telemetry.connected) "พร้อมทำงาน" else "ออฟไลน์",
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                                color = if (telemetry.connected) SuccessEmerald else DangerRed
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Action Buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (!telemetry.connected) {
                    Button(
                        onClick = onConnectVirtual,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = TealPrimary,
                            contentColor = Color.White
                        ),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .weight(1f)
                            .height(52.dp)
                            .testTag("connect_helmet_btn")
                    ) {
                        Icon(imageVector = Icons.Default.BluetoothConnected, contentDescription = null, modifier = Modifier.size(20.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(text = "เชื่อมต่อหมวก", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    }
                } else {
                    OutlinedButton(
                        onClick = onDisconnect,
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = DangerRed
                        ),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .weight(1f)
                            .height(52.dp)
                            .border(1.dp, DangerRed, RoundedCornerShape(12.dp))
                            .testTag("disconnect_helmet_btn")
                    ) {
                        Text(text = "ตัดการเชื่อมต่อ", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    }
                }

                FilledTonalButton(
                    onClick = onTestHaptic,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .height(52.dp)
                        .testTag("test_haptic_btn")
                ) {
                    Icon(imageVector = Icons.Default.Vibration, contentDescription = "ทดสอบการสั่น", modifier = Modifier.size(20.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(text = "สั่น", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                }

                FilledTonalButton(
                    onClick = onTestBuzzer,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .height(52.dp)
                        .testTag("test_buzzer_btn")
                ) {
                    Icon(imageVector = Icons.Default.VolumeUp, contentDescription = "ทดสอบเสียงเตือน", modifier = Modifier.size(20.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(text = "เสียง", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                }
            }
        }
    }
}
