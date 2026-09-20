package com.example.smarthelmet.ui.components.dialogs

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.example.smarthelmet.model.Esp32Telemetry
import com.example.smarthelmet.ui.theme.*

@Composable
fun Esp32HubDialog(
    isOpen: Boolean,
    telemetry: Esp32Telemetry,
    onDismiss: () -> Unit,
    onConnectVirtual: () -> Unit,
    onDisconnect: () -> Unit,
    onTestHaptic: () -> Unit,
    onTestBuzzer: () -> Unit
) {
    if (!isOpen) return

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
                        Icon(imageVector = Icons.Default.Memory, contentDescription = null, tint = CyanAccent)
                        Text(
                            text = "ESP32 Helmet Hardware Hub",
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

                // Telemetry Specs Box
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant
                    ),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(12.dp))
                ) {
                    Column(
                        modifier = Modifier.padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        TelemetryDetailRow("Device Model:", telemetry.deviceId)
                        TelemetryDetailRow("Firmware:", telemetry.firmwareVersion)
                        TelemetryDetailRow("Status:", if (telemetry.connected) "Connected (BLE UART)" else "Disconnected")
                        TelemetryDetailRow("Battery Level:", "${telemetry.batteryPercent}% (${if (telemetry.isCharging) "Charging" else "Discharging"})")
                        TelemetryDetailRow("Temperature:", "${telemetry.tempCelsius} °C")
                        TelemetryDetailRow("Signal RSSI:", "${telemetry.wifiRssiDbm} dBm")
                        TelemetryDetailRow("GPS Fix Satellites:", "${telemetry.satellites} Satellites")
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Actuation Test Row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    FilledTonalButton(
                        onClick = onTestHaptic,
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(imageVector = Icons.Default.Vibration, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("ทดสอบมอเตอร์สั่น", fontSize = 11.sp)
                    }

                    FilledTonalButton(
                        onClick = onTestBuzzer,
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(imageVector = Icons.Default.VolumeUp, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("ทดสอบเสียง Buzzer", fontSize = 11.sp)
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                if (!telemetry.connected) {
                    Button(
                        onClick = {
                            onConnectVirtual()
                            onDismiss()
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = TealPrimary,
                            contentColor = Color.White
                        ),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(imageVector = Icons.Default.BluetoothConnected, contentDescription = null)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("เชื่อมต่อหมวกจำลอง (Virtual BLE)")
                    }
                } else {
                    OutlinedButton(
                        onClick = {
                            onDisconnect()
                            onDismiss()
                        },
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = DangerRed),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("ตัดการเชื่อมต่อหมวก")
                    }
                }
            }
        }
    }
}

@Composable
private fun TelemetryDetailRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(text = label, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(text = value, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface)
    }
}
