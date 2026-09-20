package com.example.smarthelmet.ui.components.dialogs

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.window.Dialog
import com.example.smarthelmet.model.GpsLocation
import com.example.smarthelmet.model.RouteRecordingSession
import com.example.smarthelmet.ui.theme.*

@Composable
fun RouteRecorderDialog(
    isOpen: Boolean,
    session: RouteRecordingSession,
    gps: GpsLocation,
    onDismiss: () -> Unit,
    onStartRecording: (String, String) -> Unit,
    onAddBreadcrumb: (Double, Double) -> Unit,
    onFinishAndSave: () -> Unit
) {
    if (!isOpen) return

    var routeName by remember { mutableStateOf(session.routeName) }
    var description by remember { mutableStateOf(session.description) }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(20.dp),
            color = MaterialTheme.colorScheme.surface,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp)
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(12.dp)
                                .clip(CircleShape)
                                .background(if (session.isRecording) DangerRed else TextMuted)
                        )
                        Text(
                            text = if (session.isRecording) "กำลังบันทึกเส้นทาง..." else "บันทึกเส้นทางเดินใหม่ (GPS)",
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(imageVector = Icons.Default.Close, contentDescription = "Close")
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                if (!session.isRecording) {
                    OutlinedTextField(
                        value = routeName,
                        onValueChange = { routeName = it },
                        label = { Text("ชื่อเส้นทาง (เช่น ทางไปตึก 1)") },
                        singleLine = true,
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("route_name_input")
                    )

                    Spacer(modifier = Modifier.height(10.dp))

                    OutlinedTextField(
                        value = description,
                        onValueChange = { description = it },
                        label = { Text("รายละเอียดจุดสังเกต") },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(80.dp)
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    Button(
                        onClick = {
                            onStartRecording(
                                routeName.ifBlank { "เส้นทางที่บันทึกใหม่" },
                                description
                            )
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = TealPrimary,
                            contentColor = Color.White
                        ),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("start_recording_btn")
                    ) {
                        Icon(imageVector = Icons.Default.FiberManualRecord, contentDescription = null, tint = DangerRed)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("เริ่มเดินบันทึกพิกัดจริง", fontWeight = FontWeight.Bold)
                    }
                } else {
                    // Recording In Progress Stats
                    Surface(
                        color = MaterialTheme.colorScheme.surfaceVariant,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = "ชื่อ: ${session.routeName}",
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp
                            )
                            Text(
                                text = "จุดพิกัดที่บันทึกแล้ว: ${session.recordedGpsPath.size} จุด",
                                fontSize = 13.sp,
                                color = CyanAccent
                            )
                            Text(
                                text = "พิกัดปัจจุบัน: ${String.format("%.5f, %.5f", gps.lat, gps.lng)}",
                                fontSize = 12.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        OutlinedButton(
                            onClick = { onAddBreadcrumb(gps.lat, gps.lng) },
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(imageVector = Icons.Default.AddLocation, contentDescription = null)
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("ปักหมุดจุดนี้", fontSize = 12.sp)
                        }

                        Button(
                            onClick = onFinishAndSave,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = SuccessEmerald,
                                contentColor = Color.White
                            ),
                            modifier = Modifier
                                .weight(1f)
                                .testTag("finish_save_route_btn")
                        ) {
                            Icon(imageVector = Icons.Default.Check, contentDescription = null)
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("เสร็จสิ้น & บันทึก", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}
