package com.example.smarthelmet.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface RouteDao {
    @Query("SELECT * FROM routes ORDER BY updatedAt DESC")
    fun getAllRoutes(): Flow<List<RouteEntity>>

    @Query("SELECT * FROM routes WHERE id = :id LIMIT 1")
    suspend fun getRouteById(id: String): RouteEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRoute(route: RouteEntity)

    @Query("DELETE FROM routes WHERE id = :id")
    suspend fun deleteRouteById(id: String)

    @Query("UPDATE routes SET isFavorite = NOT isFavorite, updatedAt = :updatedAt WHERE id = :id")
    suspend fun toggleFavorite(id: String, updatedAt: String = System.currentTimeMillis().toString())

    @Query("DELETE FROM routes")
    suspend fun clearAll()
}
