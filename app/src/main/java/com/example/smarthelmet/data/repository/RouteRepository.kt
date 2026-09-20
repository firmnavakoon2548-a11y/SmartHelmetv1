package com.example.smarthelmet.data.repository

import com.example.smarthelmet.data.local.RouteDao
import com.example.smarthelmet.data.local.RouteEntity
import com.example.smarthelmet.model.Route
import com.example.smarthelmet.model.Waypoint
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

class RouteRepository(private val routeDao: RouteDao) {

    val allRoutes: Flow<List<Route>> = routeDao.getAllRoutes().map { entities ->
        entities.map { it.toRoute() }
    }

    suspend fun insert(route: Route) {
        val routeToSave = if (route.id.isBlank()) {
            route.copy(id = "route-${System.currentTimeMillis()}")
        } else route
        routeDao.insertRoute(RouteEntity.fromRoute(routeToSave))
    }

    suspend fun delete(id: String) {
        routeDao.deleteRouteById(id)
    }

    suspend fun toggleFavorite(id: String) {
        routeDao.toggleFavorite(id)
    }

    companion object {
        const val MAX_PEDESTRIAN_DISTANCE_METERS = 10000

        fun calculateDistanceMeters(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Int {
            val r = 6371e3 // Earth radius in meters
            val phi1 = Math.toRadians(lat1)
            val phi2 = Math.toRadians(lat2)
            val deltaPhi = Math.toRadians(lat2 - lat1)
            val deltaLambda = Math.toRadians(lon2 - lon1)

            val a = sin(deltaPhi / 2) * sin(deltaPhi / 2) +
                    cos(phi1) * cos(phi2) * sin(deltaLambda / 2) * sin(deltaLambda / 2)
            val c = 2 * atan2(sqrt(a), sqrt(1 - a))
            return Math.round(r * c).toInt()
        }

        fun calculateBearing(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Float {
            val y = sin(Math.toRadians(lon2 - lon1)) * cos(Math.toRadians(lat2))
            val x = cos(Math.toRadians(lat1)) * sin(Math.toRadians(lat2)) -
                    sin(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * cos(Math.toRadians(lon2 - lon1))
            val theta = atan2(y, x)
            return ((Math.toDegrees(theta) + 360) % 360).toFloat()
        }

        fun generateWaypointsFromGpsPath(path: List<List<Double>>, name: String): List<Waypoint> {
            if (path.size < 2) return emptyList()

            val waypoints = mutableListOf<Waypoint>()
            var prevBearing = calculateBearing(path[0][0], path[0][1], path[1][0], path[1][1])

            waypoints.add(
                Waypoint(
                    lat = path[0][0],
                    lng = path[0][1],
                    instruction = "Start walking along recorded route \"$name\"",
                    instructionTh = "เริ่มต้นเดินตามเส้นทาง \"$name\" เดินตรงไปข้างหน้า",
                    direction = "straight",
                    distanceMeters = 0,
                    landmark = "จุดเริ่มต้น"
                )
            )

            var currentSegmentDist = 0
            for (i in 1 until path.size - 1) {
                val dist = calculateDistanceMeters(
                    path[i - 1][0], path[i - 1][1],
                    path[i][0], path[i][1]
                )
                currentSegmentDist += dist

                val nextBearing = calculateBearing(
                    path[i][0], path[i][1],
                    path[i + 1][0], path[i + 1][1]
                )

                var turnAngle = nextBearing - prevBearing
                while (turnAngle < -180) turnAngle += 360f
                while (turnAngle > 180) turnAngle -= 360f

                if (Math.abs(turnAngle) > 35 && currentSegmentDist > 15) {
                    val direction: String
                    val instructionTh: String
                    val instructionEn: String

                    when {
                        turnAngle > 55 -> {
                            direction = "right"
                            instructionTh = "เตรียมเลี้ยวขวา และเดินตรงต่อไป"
                            instructionEn = "Turn right and continue"
                        }
                        turnAngle < -55 -> {
                            direction = "left"
                            instructionTh = "เตรียมเลี้ยวซ้าย และเดินตรงต่อไป"
                            instructionEn = "Turn left and continue"
                        }
                        turnAngle > 0 -> {
                            direction = "slight-right"
                            instructionTh = "เบี่ยงขวาเล็กน้อย"
                            instructionEn = "Bear slightly right"
                        }
                        else -> {
                            direction = "slight-left"
                            instructionTh = "เบี่ยงซ้ายเล็กน้อย"
                            instructionEn = "Bear slightly left"
                        }
                    }

                    waypoints.add(
                        Waypoint(
                            lat = path[i][0],
                            lng = path[i][1],
                            instruction = instructionEn,
                            instructionTh = instructionTh,
                            direction = direction,
                            distanceMeters = currentSegmentDist,
                            landmark = "ทางแยกจุดที่ ${waypoints.size}"
                        )
                    )

                    currentSegmentDist = 0
                    prevBearing = nextBearing
                }
            }

            val lastPoint = path.last()
            waypoints.add(
                Waypoint(
                    lat = lastPoint[0],
                    lng = lastPoint[1],
                    instruction = "Arrive at destination: $name",
                    instructionTh = "ถึงจุดหมายปลายทาง \"$name\" เรียบร้อยแล้ว",
                    direction = "arrive",
                    distanceMeters = maxOf(10, currentSegmentDist),
                    landmark = "จุดหมายปลายทาง"
                )
            )

            return waypoints
        }
    }
}
