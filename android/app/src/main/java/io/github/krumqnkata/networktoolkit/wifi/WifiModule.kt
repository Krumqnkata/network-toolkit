package io.github.krumqnkata.networktoolkit.wifi

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import io.github.krumqnkata.networktoolkit.specs.NativeWifiModuleSpec
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/** Turbo Native Module for Wi-Fi scanning. Scans run serially on a background thread. */
class WifiModule(reactContext: ReactApplicationContext) : NativeWifiModuleSpec(reactContext) {
    private val executor: ExecutorService = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "WifiModule").apply { isDaemon = true }
    }
    private val scanner = WifiScanner(reactContext)

    override fun getName(): String = NAME

    override fun scan(promise: Promise) = execute(promise) { scanner.scan() }

    override fun getCachedScanResults(promise: Promise) = execute(promise) { scanner.cached() }

    private fun execute(promise: Promise, block: () -> WritableMap) {
        executor.execute {
            try {
                promise.resolve(block())
            } catch (error: SecurityException) {
                promise.reject("E_PERMISSION", error.message ?: "Permission denied", error)
            } catch (error: Exception) {
                promise.reject("E_WIFI", error.message ?: "Wi-Fi scan failed", error)
            }
        }
    }

    override fun invalidate() {
        executor.shutdownNow()
        super.invalidate()
    }

    companion object {
        const val NAME = "NativeWifiModule"
    }
}
