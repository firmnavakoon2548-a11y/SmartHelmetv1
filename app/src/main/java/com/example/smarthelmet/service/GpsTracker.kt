package com.example.smarthelmet.service

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import com.example.smarthelmet.model.GpsLocation
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class GpsTracker(private val context: Context) : LocationListener {

    private val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
    private val _hasRealLocation = MutableStateFlow(false)
    val hasRealLocation: StateFlow<Boolean> = _hasRealLocation.asStateFlow()

    private val _isLocationServiceEnabled = MutableStateFlow(true)
    val isLocationServiceEnabled: StateFlow<Boolean> = _isLocationServiceEnabled.asStateFlow()

    private val _gpsLocation = MutableStateFlow(
        GpsLocation(
            lat = 13.7563,
            lng = 100.5018,
            accuracy = 3.5f,
            heading = 45f,
            speed = 0f,
            altitude = 12.0,
            timestamp = System.currentTimeMillis()
        )
    )
    val gpsLocation: StateFlow<GpsLocation> = _gpsLocation.asStateFlow()

    private var isTracking = false

    @SuppressLint("MissingPermission")
    fun startTracking() {
        if (locationManager == null) return
        try {
            val isGpsEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)
            val isNetworkEnabled = locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
            _isLocationServiceEnabled.value = isGpsEnabled || isNetworkEnabled

            // Immediately pick best last known location if available
            val lastGps = try { locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER) } catch (_: Exception) { null }
            val lastNet = try { locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER) } catch (_: Exception) { null }
            val bestLast = when {
                lastGps != null && lastNet != null -> if (lastGps.time >= lastNet.time) lastGps else lastNet
                lastGps != null -> lastGps
                else -> lastNet
            }
            if (bestLast != null) {
                onLocationChanged(bestLast)
            }

            if (!isTracking) {
                if (isGpsEnabled) {
                    locationManager.requestLocationUpdates(
                        LocationManager.GPS_PROVIDER,
                        1000L,
                        1.0f,
                        this
                    )
                }
                if (isNetworkEnabled) {
                    locationManager.requestLocationUpdates(
                        LocationManager.NETWORK_PROVIDER,
                        1000L,
                        1.0f,
                        this
                    )
                }
                isTracking = true
            }
        } catch (_: SecurityException) {
            // Permission not yet granted, fallback default location active
        }
    }

    fun stopTracking() {
        if (!isTracking) return
        try {
            locationManager?.removeUpdates(this)
            isTracking = false
        } catch (_: Exception) {}
    }

    fun updateManualLocation(lat: Double, lng: Double, heading: Float = _gpsLocation.value.heading) {
        _gpsLocation.value = _gpsLocation.value.copy(
            lat = lat,
            lng = lng,
            heading = heading,
            timestamp = System.currentTimeMillis()
        )
    }

    override fun onLocationChanged(location: Location) {
        _hasRealLocation.value = true
        _gpsLocation.value = GpsLocation(
            lat = location.latitude,
            lng = location.longitude,
            accuracy = location.accuracy,
            heading = if (location.hasBearing()) location.bearing else _gpsLocation.value.heading,
            speed = if (location.hasSpeed()) location.speed * 3.6f else 0f,
            altitude = location.altitude,
            timestamp = location.time
        )
    }

    @Deprecated("Deprecated in Java")
    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
    override fun onProviderEnabled(provider: String) {}
    override fun onProviderDisabled(provider: String) {}
}
