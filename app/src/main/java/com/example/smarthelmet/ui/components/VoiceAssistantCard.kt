package com.example.smarthelmet.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.smarthelmet.ui.theme.*

@Composable
fun VoiceAssistantCard(
    isListening: Boolean,
    transcript: String,
    onStartListening: () -> Unit,
    onStopListening: () -> Unit,
    onQuickCommand: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 1.0f,
        targetValue = if (isListening) 1.25f else 1.0f,
        animationSpec = infiniteRepeatable(
            animation = tween(600, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse_scale"
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
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
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
                        imageVector = Icons.Default.Mic,
                        contentDescription = "Voice Command",
                        tint = CyanAccent
                    )
                    Text(
                        text = "สั่งงานด้วยเสียง (Voice Command)",
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 15.sp,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Big Circular Microphone Button (Accessible Extra-Large Touch Target)
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier.size(110.dp)
            ) {
                // Pulse ripple
                if (isListening) {
                    Box(
                        modifier = Modifier
                            .size(110.dp)
                            .scale(pulseScale)
                            .clip(CircleShape)
                            .background(Color(0x3306B6D4))
                    )
                }

                Box(
                    modifier = Modifier
                        .size(86.dp)
                        .clip(CircleShape)
                        .background(if (isListening) DangerRed else TealPrimary)
                        .border(3.dp, if (isListening) Color.White else CyanAccent, CircleShape)
                        .clickable {
                            if (isListening) onStopListening() else onStartListening()
                        }
                        .testTag("voice_mic_btn"),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = if (isListening) Icons.Default.MicOff else Icons.Default.Mic,
                        contentDescription = if (isListening) "หยุดการรับฟังเสียง" else "แตะเพื่อพูดสั่งการด้วยเสียง",
                        tint = Color.White,
                        modifier = Modifier.size(42.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = if (isListening) "● กำลังฟังเสียงคำสั่งของคุณ..." else "แตะปุ่มไมโครโฟนเพื่อเริ่มพูดคำสั่ง",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = if (isListening) DangerRed else MaterialTheme.colorScheme.onSurface
            )

            if (transcript.isNotEmpty()) {
                Spacer(modifier = Modifier.height(8.dp))
                Surface(
                    color = MaterialTheme.colorScheme.surface,
                    shape = RoundedCornerShape(10.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, CyanAccent)
                ) {
                    Text(
                        text = "\"$transcript\"",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = CyanAccent,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Suggested Voice Commands
            Text(
                text = "คำสั่งเสียงที่แนะนำ (แตะทดสอบได้):",
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.align(Alignment.Start)
            )
            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                SuggestionChip(
                    onClick = { onQuickCommand("ไปตึก LC") },
                    label = { Text("ไปตึก LC", fontSize = 12.sp, fontWeight = FontWeight.Bold) },
                    modifier = Modifier.weight(1f).height(46.dp)
                )
                SuggestionChip(
                    onClick = { onQuickCommand("ไปโรงอาหาร") },
                    label = { Text("ไปโรงอาหาร", fontSize = 12.sp, fontWeight = FontWeight.Bold) },
                    modifier = Modifier.weight(1f).height(46.dp)
                )
                SuggestionChip(
                    onClick = { onQuickCommand("ตรวจสิ่งกีดขวาง") },
                    label = { Text("ตรวจสิ่งกีดขวาง", fontSize = 12.sp, fontWeight = FontWeight.Bold) },
                    modifier = Modifier.weight(1f).height(46.dp)
                )
            }
        }
    }
}
