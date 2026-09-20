package com.example.smarthelmet.data.network

import com.example.smarthelmet.data.repository.RouteRepository
import com.example.smarthelmet.model.CalculatedWalkingRoute
import com.example.smarthelmet.model.SearchPlaceResult
import com.example.smarthelmet.model.WalkingRouteStep
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder
import java.util.concurrent.TimeUnit
import kotlin.math.abs

class WalkingRouterService {

    private val client = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(8, TimeUnit.SECONDS)
        .build()

    suspend fun reverseGeocode(lat: Double, lng: Double): String = withContext(Dispatchers.IO) {
        try {
            val url = "https://nominatim.openstreetmap.org/reverse?format=json&lat=$lat&lon=$lng&zoom=18&addressdetails=1&accept-language=th,en"
            val request = Request.Builder()
                .url(url)
                .header("User-Agent", "SmartHelmetVisuallyImpaired/1.0")
                .header("Accept", "application/json")
                .build()

            val response = client.newCall(request).execute()
            if (response.isSuccessful) {
                val body = response.body?.string() ?: return@withContext "พิกัด ${String.format("%.5f, %.5f", lat, lng)}"
                val json = JSONObject(body)
                val addr = json.optJSONObject("address")
                if (addr != null) {
                    val road = addr.optString("road", addr.optString("pedestrian", addr.optString("footway", "")))
                    val subdistrict = addr.optString("subdistrict", addr.optString("quarter", addr.optString("suburb", "")))
                    val district = addr.optString("district", addr.optString("city_district", addr.optString("town", "")))
                    val province = addr.optString("state", addr.optString("province", ""))
                    val building = addr.optString("building", addr.optString("amenity", addr.optString("university", "")))

                    val parts = mutableListOf<String>()
                    if (building.isNotEmpty()) parts.add(building)
                    if (road.isNotEmpty()) parts.add("ถนน $road")
                    if (subdistrict.isNotEmpty()) parts.add("ต.$subdistrict")
                    if (district.isNotEmpty()) parts.add("อ.$district")
                    if (province.isNotEmpty()) parts.add("จ.$province")

                    if (parts.isNotEmpty()) return@withContext parts.joinToString(", ")
                }
                val displayName = json.optString("display_name")
                if (displayName.isNotEmpty()) return@withContext displayName
            }
        } catch (_: Exception) {
            // fallback
        }
        "พิกัด GPS: ${String.format("%.5f, %.5f", lat, lng)}"
    }

    suspend fun searchPlaces(query: String): List<SearchPlaceResult> = withContext(Dispatchers.IO) {
        if (query.trim().length < 2) return@withContext emptyList()
        try {
            val encodedQuery = URLEncoder.encode(query.trim(), "UTF-8")
            val url = "https://nominatim.openstreetmap.org/search?format=json&q=$encodedQuery&limit=6&addressdetails=1&accept-language=th,en"
            val request = Request.Builder()
                .url(url)
                .header("User-Agent", "SmartHelmetVisuallyImpaired/1.0")
                .header("Accept", "application/json")
                .build()

            val response = client.newCall(request).execute()
            if (response.isSuccessful) {
                val body = response.body?.string() ?: return@withContext emptyList()
                val array = JSONArray(body)
                val results = mutableListOf<SearchPlaceResult>()
                for (i in 0 until array.length()) {
                    val item = array.getJSONObject(i)
                    results.add(
                        SearchPlaceResult(
                            placeId = item.optString("place_id"),
                            name = item.optString("name", item.optString("display_name").split(",").firstOrNull() ?: query),
                            displayName = item.optString("display_name"),
                            lat = item.optDouble("lat"),
                            lng = item.optDouble("lon"),
                            type = item.optString("type", "place")
                        )
                    )
                }
                return@withContext results
            }
        } catch (_: Exception) {
            // fallback
        }
        emptyList()
    }

    suspend fun calculateWalkingRoute(
        startLat: Double,
        startLng: Double,
        destLat: Double,
        destLng: Double,
        startName: String = "ตำแหน่งปัจจุบัน",
        destName: String = "จุดหมายปลายทาง"
    ): CalculatedWalkingRoute = withContext(Dispatchers.IO) {
        val endpoints = listOf(
            "https://routing.openstreetmap.de/routed-foot/route/v1/driving/$startLng,$startLat;$destLng,$destLat?overview=full&geometries=geojson&steps=true",
            "https://routing.openstreetmap.de/routed-bike/route/v1/driving/$startLng,$startLat;$destLng,$destLat?overview=full&geometries=geojson&steps=true",
            "https://router.project-osrm.org/route/v1/driving/$startLng,$startLat;$destLng,$destLat?overview=full&geometries=geojson&steps=true"
        )

        for (url in endpoints) {
            try {
                val request = Request.Builder().url(url).build()
                val response = client.newCall(request).execute()
                if (response.isSuccessful) {
                    val body = response.body?.string() ?: continue
                    val json = JSONObject(body)
                    val routes = json.optJSONArray("routes") ?: continue
                    if (routes.length() == 0) continue

                    val routeObj = routes.getJSONObject(0)
                    val distance = routeObj.optDouble("distance", 0.0).toInt()
                    val duration = routeObj.optDouble("duration", 0.0).toInt()

                    val geometry = routeObj.getJSONObject("geometry")
                    val coordsArray = geometry.getJSONArray("coordinates")
                    val coordinates = mutableListOf<List<Double>>()
                    for (i in 0 until coordsArray.length()) {
                        val pt = coordsArray.getJSONArray(i)
                        // OSRM [lng, lat] -> [lat, lng]
                        coordinates.add(listOf(pt.getDouble(1), pt.getDouble(0)))
                    }

                    val legs = routeObj.optJSONArray("legs")
                    val stepsList = mutableListOf<WalkingRouteStep>()

                    if (legs != null && legs.length() > 0) {
                        val legSteps = legs.getJSONObject(0).optJSONArray("steps")
                        if (legSteps != null) {
                            for (i in 0 until legSteps.length()) {
                                val step = legSteps.getJSONObject(i)
                                val isLast = i == legSteps.length() - 1
                                val dist = Math.round(step.optDouble("distance")).toInt()
                                val name = step.optString("name", "ทางเดิน/ถนน").trim().ifEmpty { "ทางเดิน/ถนน" }
                                val maneuver = step.optJSONObject("maneuver")
                                val type = maneuver?.optString("type", "") ?: ""
                                val modifier = maneuver?.optString("modifier", "") ?: ""

                                var direction = "straight"
                                var th = "ตรงไปตาม$name $dist ม."
                                var en = "Walk straight on $name for ${dist}m"

                                if (isLast || type == "arrive") {
                                    direction = "arrive"
                                    th = "ถึงจุดหมายปลายทางแล้ว: $destName"
                                    en = "Arrived at destination: $destName"
                                } else if (type == "turn" || type == "fork" || type == "end of road" || type == "roundabout") {
                                    if (modifier.contains("left")) {
                                        direction = if (modifier.contains("slight")) "slight-left" else "left"
                                        th = "เลี้ยวซ้ายเข้า$name" + if (dist > 0) " เดินต่อไปอีก $dist ม." else ""
                                        en = "Turn left onto $name"
                                    } else if (modifier.contains("right")) {
                                        direction = if (modifier.contains("slight")) "slight-right" else "right"
                                        th = "เลี้ยวขวาเข้า$name" + if (dist > 0) " เดินต่อไปอีก $dist ม." else ""
                                        en = "Turn right onto $name"
                                    } else if (modifier.contains("straight")) {
                                        direction = "straight"
                                        th = "เดินตรงต่อไปตาม$name $dist ม."
                                        en = "Continue straight onto $name"
                                    }
                                } else if (type == "depart") {
                                    th = "เริ่มออกเดิน มุ่งหน้าไปตาม$name $dist ม."
                                    en = "Start walking along $name for ${dist}m"
                                }

                                val loc = maneuver?.optJSONArray("location")
                                val sLat = loc?.getDouble(1) ?: startLat
                                val sLng = loc?.getDouble(0) ?: startLng

                                stepsList.add(
                                    WalkingRouteStep(
                                        instructionTh = th,
                                        instructionEn = en,
                                        direction = direction,
                                        distanceMeters = dist,
                                        durationSeconds = step.optDouble("duration", 0.0).toInt(),
                                        lat = sLat,
                                        lng = sLng,
                                        streetName = name
                                    )
                                )
                            }
                        }
                    }

                    if (stepsList.isEmpty()) {
                        stepsList.add(
                            WalkingRouteStep(
                                instructionTh = "เดินตามเส้นทางไปยัง $destName",
                                instructionEn = "Follow the route towards $destName",
                                direction = "straight",
                                distanceMeters = distance,
                                durationSeconds = duration,
                                lat = startLat,
                                lng = startLng,
                                streetName = "ทางเดิน"
                            )
                        )
                    }

                    return@withContext CalculatedWalkingRoute(
                        totalDistanceMeters = distance,
                        totalDurationMinutes = maxOf(1, distance / 65),
                        coordinates = coordinates,
                        steps = stepsList,
                        startName = startName,
                        destinationName = destName
                    )
                }
            } catch (_: Exception) {
                // try next endpoint
            }
        }

        // Fallback: Safe grid route
        generateSafeGridRoute(startLat, startLng, destLat, destLng, startName, destName)
    }

    private fun generateSafeGridRoute(
        startLat: Double,
        startLng: Double,
        destLat: Double,
        destLng: Double,
        startName: String,
        destName: String
    ): CalculatedWalkingRoute {
        val latDiff = destLat - startLat
        val lngDiff = destLng - startLng

        val cornerLat = startLat
        val cornerLng = destLng

        val dist1 = Math.round(abs(lngDiff) * 111000 * Math.cos(Math.toRadians(startLat))).toInt()
        val dist2 = Math.round(abs(latDiff) * 111000).toInt()
        val totalDist = maxOf(50, dist1 + dist2)

        val turnDirection = if (latDiff > 0 && lngDiff > 0) "left"
        else if (latDiff > 0 && lngDiff < 0) "right"
        else if (latDiff < 0 && lngDiff > 0) "right"
        else "left"

        val coordinates = listOf(
            listOf(startLat, startLng),
            listOf(cornerLat, cornerLng),
            listOf(destLat, destLng)
        )

        val steps = listOf(
            WalkingRouteStep(
                instructionTh = "เริ่มต้นออกเดิน มุ่งหน้าไปตามแนวทางเดิน $dist1 เมตร",
                instructionEn = "Start walking along the path for ${dist1}m",
                direction = "straight",
                distanceMeters = dist1,
                durationSeconds = dist1,
                lat = startLat,
                lng = startLng,
                streetName = "แนวทางเดิน"
            ),
            WalkingRouteStep(
                instructionTh = "${if (turnDirection == "left") "เลี้ยวซ้าย" else "เลี้ยวขวา"} ที่ทางแยก แล้วเดินต่อไปอีก $dist2 เมตร",
                instructionEn = "Turn $turnDirection at intersection and walk for ${dist2}m",
                direction = turnDirection,
                distanceMeters = dist2,
                durationSeconds = dist2,
                lat = cornerLat,
                lng = cornerLng,
                streetName = "ทางแยกถนน"
            ),
            WalkingRouteStep(
                instructionTh = "ถึงจุดหมายปลายทางแล้ว: $destName",
                instructionEn = "Arrived at destination: $destName",
                direction = "arrive",
                distanceMeters = 0,
                durationSeconds = 0,
                lat = destLat,
                lng = destLng,
                streetName = destName
            )
        )

        return CalculatedWalkingRoute(
            totalDistanceMeters = totalDist,
            totalDurationMinutes = maxOf(1, totalDist / 65),
            coordinates = coordinates,
            steps = steps,
            startName = startName,
            destinationName = destName
        )
    }

    companion object {
        data class LiveGuidance(
            val distanceNumberText: String,
            val badgeLabel: String,
            val fullInstructionTh: String,
            val nextStepPreviewTh: String,
            val isAtTurnPoint: Boolean
        )

        fun formatLiveWalkingGuidance(
            distanceMeters: Int,
            currentDirection: String,
            currentInstructionTh: String,
            nextDirection: String? = null,
            nextDistMeters: Int = 50,
            landmark: String? = null
        ): LiveGuidance {
            val suffix = if (!landmark.isNullOrEmpty()) "สู่ $landmark" else ""
            var turnAction = "เดินตรงต่อไป"
            if (currentDirection == "left" || currentDirection == "slight-left") {
                turnAction = "เลี้ยวซ้าย"
            } else if (currentDirection == "right" || currentDirection == "slight-right") {
                turnAction = "เลี้ยวขวา"
            } else if (currentDirection == "arrive") {
                turnAction = "ถึงจุดหมายปลายทาง"
            }

            var nextStepPreview = ""
            if (nextDirection != null) {
                if (nextDirection == "arrive") {
                    nextStepPreview = "ถัดไป: ถึงจุดหมายปลายทาง"
                } else if (nextDirection == "straight") {
                    nextStepPreview = "ถัดไป: เดินตรงต่อไป $nextDistMeters ม."
                } else if (nextDirection.contains("left")) {
                    nextStepPreview = "ถัดไป: เลี้ยวซ้าย ในอีก $nextDistMeters ม."
                } else if (nextDirection.contains("right")) {
                    nextStepPreview = "ถัดไป: เลี้ยวขวา ในอีก $nextDistMeters ม."
                }
            }

            if (currentDirection == "arrive" || (distanceMeters <= 10 && nextDirection == null)) {
                return LiveGuidance(
                    distanceNumberText = "0 ม.",
                    badgeLabel = "ถึงจุดหมายแล้ว",
                    fullInstructionTh = "ถึงจุดหมายปลายทางแล้ว $suffix",
                    nextStepPreviewTh = "การนำทางเสร็จสมบูรณ์",
                    isAtTurnPoint = true
                )
            }

            if (distanceMeters <= 12) {
                val nextPhrase = if (nextDirection != null) {
                    if (nextDirection == "straight") "แล้วเดินตรงต่อไปอีก $nextDistMeters เมตร"
                    else if (nextDirection == "arrive") "แล้วจะถึงจุดหมายปลายทาง"
                    else "แล้วเตรียม${if (nextDirection.contains("left")) "เลี้ยวซ้าย" else "เลี้ยวขวา"}ในอีก $nextDistMeters เมตร"
                } else ""

                return LiveGuidance(
                    distanceNumberText = "0 ม.",
                    badgeLabel = "เลี้ยวทันที!",
                    fullInstructionTh = "อีก 0 เมตร ${turnAction}เลย $nextPhrase",
                    nextStepPreviewTh = nextStepPreview.ifEmpty { "เดินตามเส้นทางนำทาง" },
                    isAtTurnPoint = true
                )
            }

            if (distanceMeters <= 50) {
                return LiveGuidance(
                    distanceNumberText = "$distanceMeters ม.",
                    badgeLabel = "ใกล้ถึงทางเลี้ยว",
                    fullInstructionTh = "อีก $distanceMeters เมตร เตรียม$turnAction $suffix",
                    nextStepPreviewTh = nextStepPreview.ifEmpty { "เดินมุ่งหน้าไปตามทาง" },
                    isAtTurnPoint = false
                )
            }

            if (distanceMeters <= 150) {
                return LiveGuidance(
                    distanceNumberText = "$distanceMeters ม.",
                    badgeLabel = "ระยะทางก้าวเดิน",
                    fullInstructionTh = "อีก $distanceMeters เมตร $turnAction $suffix",
                    nextStepPreviewTh = nextStepPreview.ifEmpty { "เดินตรงต่อไปตามเส้นทาง" },
                    isAtTurnPoint = false
                )
            }

            return LiveGuidance(
                distanceNumberText = "$distanceMeters ม.",
                badgeLabel = "ระยะทางก้าวเดิน",
                fullInstructionTh = "อีก $distanceMeters เมตร ให้$turnAction $suffix",
                nextStepPreviewTh = nextStepPreview.ifEmpty { "เดินตรงไปตามทางเท้า" },
                isAtTurnPoint = false
            )
        }
    }
}
