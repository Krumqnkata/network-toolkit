package io.github.krumqnkata.networktoolkit.speed

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import io.github.krumqnkata.networktoolkit.specs.NativeSpeedTestModuleSpec
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Turbo Native Module for the speed test. `start` returns immediately; the UI
 * reads progress with `getStatus` (a cheap snapshot) and can `cancel`.
 * Only one test runs at a time.
 */
class SpeedTestModule(reactContext: ReactApplicationContext) : NativeSpeedTestModuleSpec(reactContext) {
    private val executor: ExecutorService = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "SpeedTest").apply { isDaemon = true }
    }

    @Volatile private var current: SpeedTest? = null

    override fun getName(): String = NAME

    override fun start(phaseSeconds: Double, streams: Double, promise: Promise) {
        val running = current?.status()?.phase in RUNNING_PHASES
        if (running) {
            promise.reject("E_BUSY", "A speed test is already running")
            return
        }
        val test = SpeedTest(
            streams = streams.toInt().coerceIn(1, MAX_STREAMS),
            phaseNanos = (phaseSeconds.coerceIn(MIN_PHASE_SECONDS, MAX_PHASE_SECONDS) * 1_000_000_000L).toLong(),
        )
        current = test
        executor.execute { test.run() }
        promise.resolve(toMap(test.status()))
    }

    override fun getStatus(promise: Promise) {
        promise.resolve(toMap(current?.status() ?: IDLE))
    }

    override fun cancel(promise: Promise) {
        current?.cancel()
        promise.resolve(null)
    }

    private fun toMap(status: SpeedStatus): WritableMap = Arguments.createMap().apply {
        putString("phase", status.phase)
        putDouble("progress", status.progress)
        putNullable("currentMbps", status.currentMbps)
        putNullable("downloadMbps", status.downloadMbps)
        putNullable("uploadMbps", status.uploadMbps)
        putNullable("idleLatencyMs", status.idleLatencyMs)
        putNullable("jitterMs", status.jitterMs)
        putNullable("downloadLatencyMs", status.downloadLatencyMs)
        putNullable("uploadLatencyMs", status.uploadLatencyMs)
        putNullable("packetLossPercent", status.packetLossPercent)
        putDouble("bytesDownloaded", status.bytesDownloaded.toDouble())
        putDouble("bytesUploaded", status.bytesUploaded.toDouble())
        putString("serverColo", status.serverColo)
        putString("serverCity", status.serverCity)
        putString("serverCountry", status.serverCountry)
        putString("error", status.error)
    }

    private fun WritableMap.putNullable(key: String, value: Double?) {
        if (value == null || value.isNaN() || value.isInfinite()) putNull(key) else putDouble(key, value)
    }

    override fun invalidate() {
        current?.cancel()
        executor.shutdownNow()
        super.invalidate()
    }

    companion object {
        const val NAME = "NativeSpeedTestModule"
        private const val MAX_STREAMS = 8
        private const val MIN_PHASE_SECONDS = 3.0
        private const val MAX_PHASE_SECONDS = 30.0
        private val RUNNING_PHASES = setOf("latency", "download", "upload")
        private val IDLE = SpeedStatus(
            "idle", 0.0, null, null, null, null, null, null, null, null, 0, 0, null, null, null, null,
        )
    }
}
