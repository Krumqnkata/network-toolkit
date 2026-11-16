package io.github.krumqnkata.networktoolkit.storage

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import io.github.krumqnkata.networktoolkit.specs.NativeStorageModuleSpec
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/** Turbo Native Module over [AppDatabase]. All queries run serially on one background thread. */
class StorageModule(reactContext: ReactApplicationContext) : NativeStorageModuleSpec(reactContext) {
    private val executor: ExecutorService = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "StorageModule").apply { isDaemon = true }
    }
    private val database = AppDatabase(reactContext)

    override fun getName(): String = NAME

    override fun insertRecord(kind: String, createdAt: Double, data: String, promise: Promise) =
        execute(promise) {
            requireKind(kind)
            require(data.length <= MAX_DATA_CHARS) { "Record is too large" }
            database.insert(kind, createdAt.toLong(), data).toDouble()
        }

    override fun updateRecord(id: Double, data: String, promise: Promise) =
        execute(promise) {
            require(data.length <= MAX_DATA_CHARS) { "Record is too large" }
            database.update(id.toLong(), data)
        }

    override fun listRecords(kind: String, limit: Double, before: Double, promise: Promise) =
        execute(promise) {
            requireKind(kind)
            val records = database.list(kind, limit.toInt().coerceIn(1, 500), if (before > 0) before.toLong() else null)
            Arguments.createArray().apply {
                records.forEach { record ->
                    pushMap(
                        Arguments.createMap().apply {
                            putDouble("id", record.id.toDouble())
                            putString("kind", record.kind)
                            putDouble("createdAt", record.createdAt.toDouble())
                            putString("data", record.data)
                        },
                    )
                }
            }
        }

    override fun deleteRecord(id: Double, promise: Promise) = execute(promise) { database.delete(id.toLong()) }

    override fun clearRecords(kind: String, promise: Promise) =
        execute(promise) {
            requireKind(kind)
            database.clear(kind).toDouble()
        }

    override fun pruneRecords(kind: String, keep: Double, promise: Promise) =
        execute(promise) {
            requireKind(kind)
            database.prune(kind, keep.toInt().coerceAtLeast(0)).toDouble()
        }

    override fun getSetting(key: String, promise: Promise) = execute(promise) { database.getSetting(key) }

    override fun setSetting(key: String, value: String?, promise: Promise) =
        execute(promise) {
            require(key.isNotBlank() && key.length <= 64) { "Invalid setting key" }
            database.setSetting(key, value)
            null
        }

    private fun requireKind(kind: String) {
        require(KIND.matches(kind)) { "Invalid record kind" }
    }

    private fun execute(promise: Promise, block: () -> Any?) {
        executor.execute {
            try {
                promise.resolve(block())
            } catch (error: IllegalArgumentException) {
                promise.reject("E_INVALID_INPUT", error.message ?: "Invalid input", error)
            } catch (error: Exception) {
                promise.reject("E_STORAGE", error.message ?: "Storage error", error)
            }
        }
    }

    override fun invalidate() {
        executor.execute { database.close() }
        executor.shutdown()
        super.invalidate()
    }

    companion object {
        const val NAME = "NativeStorageModule"
        private val KIND = Regex("^[a-z][a-z0-9-]{0,31}$")
        private const val MAX_DATA_CHARS = 1_000_000
    }
}
