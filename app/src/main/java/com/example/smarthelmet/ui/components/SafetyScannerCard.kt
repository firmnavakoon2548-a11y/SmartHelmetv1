package com.example.smarthelmet.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.smarthelmet.model.ObstacleData
import com.example.smarthelmet.ui.theme.*
import kotlin.math.cos
import kotlin.math.sin

@Composable
fun SafetyScannerCard(
    obstacle: ObstacleData,
    onTestAlert: () -> Unit,
    modifier: Modifier = Modifier
) {
    // Radar sweep rotation animation
    val infiniteTransition = rememberInfiniteTransition(label = "radar_sweep")
    val sweepAngle by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(3000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "sweep_angle"
    )

    val bannerColor = when (obstacle.zone) {
        "danger" -> DangerRed
        "warning" -> WarningAmber
        else -> SuccessEmerald
    }

    val bannerBg = when (obstacle.zone) {
        "danger" -> DangerBg
        "warning" -> WarningBg
        else -> SuccessBg
    }

    val statusTitle = when (obstacle.zone) {
        "danger" -> "หยุดทันที! สิ่งกีดขวางกระชั้นชิด"
        "warning" -> "ระวัง! พบสิ่งกีดขวางด้านหน้า"
        else -> "ปลอดภัย เส้นทางโล่งเดินได้สะดวก"
    }

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
                        imageVector = Icons.Default.Sensors,
                        contentDescription = "Sonar Radar",
                        tint = bannerColor
                    )
                    Text(
                        text = "ระบบตรวจจับสิ่งกีดขวาง (Obstacle Detection)",
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 15.sp,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Radar & Distance Sensors Visual
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Radar Circle Canvas
                Box(
                    modifier = Modifier
                        .size(130.dp)
                        .clip(RoundedCornerShape(65.dp))
                        .background(DarkBg),
                    contentAlignment = Alignment.Center
                ) {
                    Canvas(modifier = Modifier.fillMaxSize()) {
                        val center = Offset(size.width / 2, size.height / 2)
                        val radius = size.minDimension / 2 - 8

                        // Concentric distance rings
                        drawCircle(
                            color = Color(0x330D9488),
                            radius = radius,
                            center = center,
                            style = Stroke(width = 1.5f)
                        )
                        drawCircle(
                            color = Color(0x330D9488),
                            radius = radius * 0.66f,
                            center = center,
                            style = Stroke(width = 1f)
                        )
                        drawCircle(
                            color = Color(0x330D9488),
                            radius = radius * 0.33f,
                            center = center,
                            style = Stroke(width = 1f)
                        )

                        // Cross hairs
                        drawLine(
                            color = Color(0x22FFFFFF),
                            start = Offset(center.x, 8f),
                            end = Offset(center.x, size.height - 8f),
                            strokeWidth = 1f
                        )
                        drawLine(
                            color = Color(0x22FFFFFF),
                            start = Offset(8f, center.y),
                            end = Offset(size.width - 8f, center.y),
                            strokeWidth = 1f
                        )

                        // Radar sweep line
                        val rad = Math.toRadians(sweepAngle.toDouble())
                        val sweepEnd = Offset(
                            (center.x + radius * cos(rad)).toFloat(),
                            (center.y + radius * sin(rad)).toFloat()
                        )
                        drawLine(
                            brush = Brush.linearGradient(
                                colors = listOf(Color.Transparent, CyanAccent),
                                start = center,
                                end = sweepEnd
                            ),
                            start = center,
                            end = sweepEnd,
                            strokeWidth = 2.5f,
                            cap = StrokeCap.Round
                        )

                        // Obstacle blip (closest)
                        val blipDistFactor = (obstacle.closestDistanceCm / 250f).coerceIn(0.2f, 0.95f)
                        val blipAngle = when (obstacle.closestSector) {
                            "left" -> 225.0
                            "right" -> 315.0
                            else -> 270.0
                        }
                        val blipRad = Math.toRadians(blipAngle)
                        val blipPos = Offset(
                            (center.x + radius * blipDistFactor * cos(blipRad)).toFloat(),
                            (center.y + radius * blipDistFactor * sin(blipRad)).toFloat()
                        )
                        drawCircle(
                            color = bannerColor,
                            radius = 6f,
                            center = blipPos
                        )
                    }

                    // Center user dot
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .clip(RoundedCornerShape(5.dp))
                            .background(Color.White)
                    )
                }

                // Distance Bars (Left, Front, Right)
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    SensorDistanceRow(
                        label = "ซ้าย (Left)",
                        distanceCm = obstacle.leftDistanceCm,
                        isClosest = obstacle.closestSector == "left"
                    )
                    SensorDistanceRow(
                        label = "หน้า (Front)",
                        distanceCm = obstacle.frontDistanceCm,
                        isClosest = obstacle.closestSector == "front"
                    )
                    SensorDistanceRow(
                        label = "ขวา (Right)",
                        distanceCm = obstacle.rightDistanceCm,
                        isClosest = obstacle.closestSector == "right"
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Alert Status Banner
            Surface(
                color = bannerBg,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Icon(
                        imageVector = if (obstacle.zone == "danger") Icons.Default.Warning else if (obstacle.zone == "warning") Icons.Default.Info else Icons.Default.CheckCircle,
                        contentDescription = null,
                        tint = bannerColor,
                        modifier = Modifier.size(22.dp)
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = statusTitle,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            color = bannerColor
                        )
                        Text(
                            text = "วัตถุใกล้สุด: ${obstacle.closestDistanceCm} ซม. (${when (obstacle.closestSector) { "left" -> "ด้านซ้าย"; "right" -> "ด้านขวา"; else -> "ตรงกลาง" }})",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            OutlinedButton(
                onClick = onTestAlert,
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.VolumeUp,
                    contentDescription = "ทดสอบเสียงเตือนสิ่งกีดขวาง",
                    tint = bannerColor,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "ทดสอบเสียงเตือนสิ่งกีดขวาง",
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.sp,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }
        }
    }
}

@Composable
private fun SensorDistanceRow(
    label: String,
    distanceCm: Int,
    isClosest: Boolean
) {
    val barColor = when {
        distanceCm < 60 -> DangerRed
        distanceCm < 140 -> WarningAmber
        else -> SuccessEmerald
    }

    val progress = (distanceCm / 250f).coerceIn(0.05f, 1f)

    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = label,
                fontSize = 11.sp,
                fontWeight = if (isClosest) FontWeight.Bold else FontWeight.Normal,
                color = if (isClosest) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = "$distanceCm ซม.",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = barColor
            )
        }
        Spacer(modifier = Modifier.height(3.dp))
        LinearProgressIndicator(
            progress = { progress },
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp)
                .clip(RoundedCornerShape(3.dp)),
            color = barColor,
            trackColor = MaterialTheme.colorScheme.surface
        )
    }
}
