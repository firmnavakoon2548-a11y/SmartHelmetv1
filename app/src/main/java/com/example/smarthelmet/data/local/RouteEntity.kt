package com.example.smarthelmet.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.example.smarthelmet.model.Route
import com.example.smarthelmet.model.Waypoint
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

@Entity(tableName = "routes")
data class RouteEntity(
    @PrimaryKey val id: String,
    val name: String,
    val description: String,
    val createdBy: String,
    val createdAt: String,
    val updatedAt: String,
    val source: String,
    val totalDistanceMeters: Int,
    val estimatedMinutes: Int,
    val waypointsJson: String,
    val pathCoordinatesJson: String,
    val tagsJson: String,
    val isFavorite: Boolean
) {
    fun toRoute(): Route {
        val json = Json { ignoreUnknownKeys = true }
        val waypointsList = try {
            json.decodeFromString<List<Waypoint>>(waypointsJson)
        } catch (_: Exception) {
            emptyList()
        }
        val coordsList = try {
            json.decodeFromString<List<List<Double>>>(pathCoordinatesJson)
        } catch (_: Exception) {
            emptyList()
        }
        val tagsList = try {
            json.decodeFromString<List<String>>(tagsJson)
        } catch (_: Exception) {
            emptyList()
        }
        return Route(
            id = id,
            name = name,
            description = description,
            createdBy = createdBy,
            createdAt = createdAt,
            updatedAt = updatedAt,
            source = source,
            totalDistanceMeters = totalDistanceMeters,
            estimatedMinutes = estimatedMinutes,
            waypoints = waypointsList,
            pathCoordinates = coordsList,
            tags = tagsList,
            isFavorite = isFavorite
        )
    }

    companion object {
        fun fromRoute(route: Route): RouteEntity {
            val json = Json { ignoreUnknownKeys = true }
            return RouteEntity(
                id = route.id,
                name = route.name,
                description = route.description,
                createdBy = route.createdBy,
                createdAt = route.createdAt.ifEmpty { System.currentTimeMillis().toString() },
                updatedAt = System.currentTimeMillis().toString(),
                source = route.source,
                totalDistanceMeters = route.totalDistanceMeters,
                estimatedMinutes = route.estimatedMinutes,
                waypointsJson = json.encodeToString(route.waypoints),
                pathCoordinatesJson = json.encodeToString(route.pathCoordinates),
                tagsJson = json.encodeToString(route.tags),
                isFavorite = route.isFavorite
            )
        }
    }
}
