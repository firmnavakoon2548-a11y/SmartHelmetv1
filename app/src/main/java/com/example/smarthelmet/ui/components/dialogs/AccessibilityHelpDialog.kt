package com.example.smarthelmet.ui.components.dialogs

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import com.example.smarthelmet.ui.theme.*

@Composable
fun AccessibilityHelpDialog(
    isOpen: Boolean,
    onDismiss: () -> Unit
) {
    if (!isOpen) return

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(20.dp),
            color = MaterialTheme.colorScheme.surface,
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(max = 520.dp)
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
                        Icon(imageVector = Icons.Default.Accessibility, contentDescription = null, tint = CyanAccent)
                        Text(
                            text = "คู่มือการใช้งานและฟังก์ชันการเข้าถึง",
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(imageVector = Icons.Default.Close, contentDescription = "Close")
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    HelpSection(
                        title = "1. การสั่งงานด้วยเสียง (Voice Commands)",
                        items = listOf(
                            "\"ไป [ชื่อสถานที่]\" หรือ \"นำทางไปตึก LC\" — ค้นหาและเริ่มนำทางทันที",
                            "\"ตรวจสิ่งกีดขวาง\" — อ่านระยะสิ่งกีดขวางและทิศทาง",
                            "\"สถานะ\" หรือ \"แบตเตอรี่\" — เช็คสถานะหมวกและระดับแบต",
                            "\"เริ่มบันทึกเส้นทาง\" — เริ่มเดินบันทึกพิกัด GPS ใหม่",
                            "\"หยุด\" หรือ \"ยกเลิก\" — หยุดการนำทาง"
                        )
                    )

                    HelpSection(
                        title = "2. การแจ้งเตือนเสียงและสัมผัส (Haptic & Audio)",
                        items = listOf(
                            "เสียงปี๊บความถี่ต่ำ: ปลอดภัย ระยะห่างเกิน 1.4 เมตร",
                            "เสียงปี๊บความถี่ปานกลาง + สั่นเบา: ระวัง ระยะ 60 - 140 ซม.",
                            "เสียงสัญญาณเตือนภัย + สั่นต่อเนื่อง: หยุดทันที! ระยะต่ำกว่า 60 ซม."
                        )
                    )

                    HelpSection(
                        title = "3. สัญญาณเตือนการเลี้ยว (Turn Chimes)",
                        items = listOf(
                            "เสียงกริ่งโทนเดี่ยว: เลี้ยวซ้าย",
                            "เสียงกริ่งโทนคู่: เลี้ยวขวา",
                            "เสียงยืนยันสั้น: เดินตรงต่อไป",
                            "เสียงดนตรีสดใส: ถึงจุดหมายปลายทางแล้ว"
                        )
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                Button(
                    onClick = onDismiss,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = TealPrimary,
                        contentColor = Color.White
                    ),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("เข้าใจแล้ว")
                }
            }
        }
    }
}

@Composable
private fun HelpSection(title: String, items: List<String>) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(text = title, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = CyanAccent)
        items.forEach { item ->
            Text(
                text = "• $item",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                lineHeight = 18.sp
            )
        }
    }
}
