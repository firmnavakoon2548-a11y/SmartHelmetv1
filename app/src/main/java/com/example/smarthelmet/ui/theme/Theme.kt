package com.example.smarthelmet.ui.theme

import android.app.Activity
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val DarkColorScheme = darkColorScheme(
    primary = TealPrimary,
    onPrimary = TextPrimary,
    secondary = CyanAccent,
    onSecondary = DarkBg,
    tertiary = CyanGlow,
    background = DarkBg,
    onBackground = TextPrimary,
    surface = DarkSurface,
    onSurface = TextPrimary,
    surfaceVariant = DarkCard,
    onSurfaceVariant = TextSecondary,
    outline = DarkCardBorder,
    error = DangerRed
)

private val HighContrastColorScheme = darkColorScheme(
    primary = HighContrastYellow,
    onPrimary = HighContrastBg,
    secondary = HighContrastCyan,
    onSecondary = HighContrastBg,
    tertiary = HighContrastYellow,
    background = HighContrastBg,
    onBackground = HighContrastYellow,
    surface = HighContrastCard,
    onSurface = HighContrastYellow,
    surfaceVariant = HighContrastCard,
    onSurfaceVariant = HighContrastCyan,
    outline = HighContrastBorder,
    error = DangerRed
)

@Composable
fun SmartHelmetTheme(
    highContrast: Boolean = false,
    content: @Composable () -> Unit
) {
    val colorScheme = if (highContrast) HighContrastColorScheme else DarkColorScheme
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.background.toArgb()
            window.navigationBarColor = colorScheme.background.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = false
            WindowCompat.getInsetsController(window, view).isAppearanceLightNavigationBars = false
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
