package io.github.krumqnkata.networktoolkit.network

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import io.github.krumqnkata.networktoolkit.specs.NativeNetworkModuleSpec
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/** Turbo Native Module exposing the current network state. All work runs off the JS/UI threads. */
class NetworkModule(reactContext: ReactApplicationContext) : NativeNetworkModuleSpec(reactContext) {
    private val executor: ExecutorService = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "NetworkModule").apply { isDaemon = true }
    }
    private val reader = NetworkSnapshotReader(reactContext)

    override fun getName(): String = NAME

    override fun getNetworkSnapshot(promise: Promise) {
        executor.execute {
            try {
                promise.resolve(reader.read().toWritableMap())
            } catch (error: SecurityException) {
                promise.reject("E_PERMISSION", error.message ?: "Permission denied", error)
            } catch (error: Exception) {
                promise.reject("E_NETWORK", error.message ?: "Failed to read network state", error)
            }
        }
    }

    override fun invalidate() {
        executor.shutdownNow()
        super.invalidate()
    }

    companion object {
        const val NAME = "NativeNetworkModule"
    }
}
