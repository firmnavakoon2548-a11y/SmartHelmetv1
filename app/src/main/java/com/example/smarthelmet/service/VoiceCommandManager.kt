package com.example.smarthelmet.service

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.Locale

data class VoiceCommandResult(
    val rawText: String,
    val intent: VoiceIntent,
    val targetDestination: String? = null
)

enum class VoiceIntent {
    NAVIGATE,
    STOP_NAV,
    STATUS,
    RECORD_ROUTE,
    SAVE_RECORDING,
    VOLUME_UP,
    VOLUME_DOWN,
    HELP,
    OBSTACLE_CHECK,
    UNKNOWN
}

class VoiceCommandManager(
    private val context: Context,
    private val onCommandParsed: (VoiceCommandResult) -> Unit
) : RecognitionListener {

    private var speechRecognizer: SpeechRecognizer? = null
    private val _isListening = MutableStateFlow(false)
    val isListening: StateFlow<Boolean> = _isListening.asStateFlow()

    private val _recognizedTranscript = MutableStateFlow("")
    val recognizedTranscript: StateFlow<String> = _recognizedTranscript.asStateFlow()

    fun isSpeechRecognitionAvailable(): Boolean {
        return SpeechRecognizer.isRecognitionAvailable(context)
    }

    fun startListening(lang: String = "th-TH") {
        if (!isSpeechRecognitionAvailable()) return

        stopListening()
        try {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context).apply {
                setRecognitionListener(this@VoiceCommandManager)
            }

            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, if (lang.startsWith("th")) "th-TH" else "en-US")
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            }

            speechRecognizer?.startListening(intent)
            _isListening.value = true
        } catch (_: Exception) {
            _isListening.value = false
        }
    }

    fun stopListening() {
        _isListening.value = false
        try {
            speechRecognizer?.stopListening()
            speechRecognizer?.destroy()
            speechRecognizer = null
        } catch (_: Exception) {}
    }

    fun parseAndDispatchCommand(text: String) {
        val trimmed = text.trim()
        val lower = trimmed.lowercase(Locale.ROOT)
        var intent = VoiceIntent.UNKNOWN
        var target: String? = null

        when {
            lower.contains("ไป") || lower.contains("นำทางไป") || lower.contains("พาไป") ||
                    lower.contains("go to") || lower.contains("navigate to") -> {
                intent = VoiceIntent.NAVIGATE
                target = trimmed
                    .replace(Regex("^(ช่วย|กรุณา)?(นำทางไป|พาไป|ไปที่|ไป|navigate to|go to)\\s*", RegexOption.IGNORE_CASE), "")
                    .replace(Regex("[.!?]"), "")
                    .trim()
            }
            lower.contains("หยุด") || lower.contains("ยกเลิก") || lower.contains("stop") || lower.contains("cancel") -> {
                intent = VoiceIntent.STOP_NAV
            }
            lower.contains("สถานะ") || lower.contains("แบต") || lower.contains("status") || lower.contains("battery") -> {
                intent = VoiceIntent.STATUS
            }
            lower.contains("บันทึกเส้นทาง") || lower.contains("เริ่มบันทึก") || lower.contains("record route") || lower.contains("start recording") -> {
                intent = VoiceIntent.RECORD_ROUTE
            }
            lower.contains("บันทึกทางนี้") || lower.contains("เสร็จสิ้นการบันทึก") || lower.contains("save route") || lower.contains("finish recording") -> {
                intent = VoiceIntent.SAVE_RECORDING
            }
            lower.contains("เพิ่มเสียง") || lower.contains("ดังขึ้น") || lower.contains("volume up") -> {
                intent = VoiceIntent.VOLUME_UP
            }
            lower.contains("ลดเสียง") || lower.contains("เบาลง") || lower.contains("volume down") -> {
                intent = VoiceIntent.VOLUME_DOWN
            }
            lower.contains("มีอะไรขวาง") || lower.contains("สิ่งกีดขวาง") || lower.contains("obstacle") || lower.contains("check obstacle") -> {
                intent = VoiceIntent.OBSTACLE_CHECK
            }
            lower.contains("ช่วยเหลือ") || lower.contains("วิธีใช้") || lower.contains("help") -> {
                intent = VoiceIntent.HELP
            }
            trimmed.length in 2..40 -> {
                intent = VoiceIntent.NAVIGATE
                target = trimmed
            }
        }

        onCommandParsed(
            VoiceCommandResult(
                rawText = trimmed,
                intent = intent,
                targetDestination = target
            )
        )
    }

    override fun onResults(results: Bundle?) {
        _isListening.value = false
        val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        val bestMatch = matches?.firstOrNull() ?: ""
        if (bestMatch.isNotEmpty()) {
            _recognizedTranscript.value = bestMatch
            parseAndDispatchCommand(bestMatch)
        }
    }

    override fun onPartialResults(partialResults: Bundle?) {
        val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        val partial = matches?.firstOrNull() ?: ""
        if (partial.isNotEmpty()) {
            _recognizedTranscript.value = partial
        }
    }

    override fun onError(error: Int) {
        _isListening.value = false
    }

    override fun onReadyForSpeech(params: Bundle?) {}
    override fun onBeginningOfSpeech() {}
    override fun onRmsChanged(rmsdB: Float) {}
    override fun onBufferReceived(buffer: ByteArray?) {}
    override fun onEndOfSpeech() {
        _isListening.value = false
    }
    override fun onEvent(eventType: Int, params: Bundle?) {}
}
