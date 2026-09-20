package com.example.smarthelmet.service

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.speech.tts.TextToSpeech
import java.util.Locale

class SoundManager(private val context: Context) : TextToSpeech.OnInitListener {

    private var tts: TextToSpeech? = null
    private var isTtsReady = false
    private var toneGenerator: ToneGenerator? = null
    private var isMuted = false
    private var lastSpokenText = ""
    private var lastSpokenTime = 0L

    private val vibrator: Vibrator? by lazy {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
            vibratorManager?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
    }

    init {
        try {
            tts = TextToSpeech(context.applicationContext, this)
            toneGenerator = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 85)
        } catch (_: Exception) {
            // Audio setup fallback
        }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            isTtsReady = true
            val thaiLocale = Locale("th", "TH")
            val res = tts?.setLanguage(thaiLocale)
            if (res == TextToSpeech.LANG_MISSING_DATA || res == TextToSpeech.LANG_NOT_SUPPORTED) {
                tts?.language = Locale.US
            }
        }
    }

    fun setLanguage(lang: String) {
        if (!isTtsReady) return
        if (lang.startsWith("th", ignoreCase = true)) {
            tts?.language = Locale("th", "TH")
        } else {
            tts?.language = Locale.US
        }
    }

    fun setSpeechRate(rate: Float) {
        tts?.setSpeechRate(rate.coerceIn(0.5f, 2.0f))
    }

    fun setPitch(pitch: Float) {
        tts?.setPitch(pitch.coerceIn(0.5f, 2.0f))
    }

    fun speak(text: String, priorityEmergency: Boolean = false) {
        if (isMuted || !isTtsReady || text.isBlank()) return
        val now = System.currentTimeMillis()
        if (!priorityEmergency && lastSpokenText == text && (now - lastSpokenTime < 2500)) {
            return
        }

        lastSpokenText = text
        lastSpokenTime = now

        val queueMode = if (priorityEmergency) TextToSpeech.QUEUE_FLUSH else TextToSpeech.QUEUE_ADD
        tts?.speak(text, queueMode, null, "UTTERANCE_${System.currentTimeMillis()}")
    }

    fun stopSpeech() {
        tts?.stop()
    }

    fun playDirectionChime(direction: String) {
        if (isMuted) return
        try {
            when (direction) {
                "left", "slight-left" -> {
                    toneGenerator?.startTone(ToneGenerator.TONE_PROP_BEEP, 120)
                }
                "right", "slight-right" -> {
                    toneGenerator?.startTone(ToneGenerator.TONE_PROP_BEEP2, 120)
                }
                "straight" -> {
                    toneGenerator?.startTone(ToneGenerator.TONE_PROP_ACK, 100)
                }
                "arrive" -> {
                    toneGenerator?.startTone(ToneGenerator.TONE_PROP_PROMPT, 300)
                }
                "caution", "danger" -> {
                    toneGenerator?.startTone(ToneGenerator.TONE_CDMA_EMERGENCY_RINGBACK, 200)
                }
                else -> {
                    toneGenerator?.startTone(ToneGenerator.TONE_PROP_BEEP, 80)
                }
            }
        } catch (_: Exception) {}
    }

    fun playObstacleAlert(distanceCm: Int) {
        if (isMuted) return
        try {
            val tone = if (distanceCm < 80) {
                ToneGenerator.TONE_CDMA_ALERT_NETWORK_LITE
            } else {
                ToneGenerator.TONE_PROP_BEEP
            }
            toneGenerator?.startTone(tone, if (distanceCm < 80) 150 else 80)
        } catch (_: Exception) {}
    }

    fun vibrate(durationMs: Long = 200) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createOneShot(durationMs, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(durationMs)
            }
        } catch (_: Exception) {}
    }

    fun setMuted(muted: Boolean) {
        isMuted = muted
        if (muted) stopSpeech()
    }

    fun release() {
        tts?.stop()
        tts?.shutdown()
        toneGenerator?.release()
    }
}
