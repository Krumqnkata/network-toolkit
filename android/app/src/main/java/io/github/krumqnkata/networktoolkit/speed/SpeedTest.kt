package io.github.krumqnkata.networktoolkit.speed

import io.github.krumqnkata.networktoolkit.tools.Probes
import java.io.IOException
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.URL
import java.util.concurrent.Callable
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

/** Immutable snapshot of a running or finished test, read by the UI about 4× per second. */
data class SpeedStatus(
    /** `idle`, `latency`, `download`, `upload`, `done`, `cancelled` or `error`. */
    val phase: String,
    /** 0–1 over the whole test. */
    val progress: Double,
    /** Rate over the last second of the current transfer phase. */
    val currentMbps: Double?,
    val downloadMbps: Double?,
    val uploadMbps: Double?,
    val idleLatencyMs: Double?,
    val jitterMs: Double?,
    val downloadLatencyMs: Double?,
    val uploadLatencyMs: Double?,
    /** Percentage of ICMP probes lost, or null when ICMP is not available. */
    val packetLossPercent: Double?,
    val bytesDownloaded: Long,
    val bytesUploaded: Long,
    val serverColo: String?,
    val serverCity: String?,
    val serverCountry: String?,
    val error: String?,
)

/**
 * Speed test against Cloudflare's public speed-test endpoints, the ones used by
 * speed.cloudflare.com (`/__down?bytes=N`, `/__up`). They are not a documented
 * API and could change; the endpoints are therefore kept in one place.
 *
 * Phases: unloaded latency (HTTP round trips minus server time, plus ICMP loss),
 * download and upload with several parallel streams for a fixed duration, with
 * latency probes running alongside to show latency under load (bufferbloat).
 */
class SpeedTest(
    private val streams: Int,
    private val phaseNanos: Long,
) {
    @Volatile private var status = SpeedStatus(
        "idle", 0.0, null, null, null, null, null, null, null, null, 0, 0, null, null, null, null,
    )
    private val cancelled = AtomicBoolean(false)

    fun status(): SpeedStatus = status

    fun cancel() {
        cancelled.set(true)
    }

    /** Runs the whole test on the calling thread. */
    fun run() {
        try {
            val latency = measureLatency(LATENCY_SAMPLES)
            if (checkCancelled()) return
            val loss = measureLoss()
            update { it.copy(packetLossPercent = loss, progress = 0.1) }
            if (checkCancelled()) return

            update { it.copy(phase = "download", currentMbps = null) }
            val download = transfer(upload = false, progressFrom = 0.1, progressTo = 0.55)
            if (checkCancelled()) return
            update {
                it.copy(downloadMbps = download.mbps, downloadLatencyMs = download.loadedLatencyMs, currentMbps = null)
            }

            update { it.copy(phase = "upload") }
            val upload = transfer(upload = true, progressFrom = 0.55, progressTo = 1.0)
            if (checkCancelled()) return
            update {
                it.copy(
                    phase = "done",
                    progress = 1.0,
                    currentMbps = null,
                    uploadMbps = upload.mbps,
                    uploadLatencyMs = upload.loadedLatencyMs,
                    idleLatencyMs = latency.first ?: it.idleLatencyMs,
                    jitterMs = latency.second ?: it.jitterMs,
                )
            }
        } catch (error: Exception) {
            if (!checkCancelled()) {
                update { it.copy(phase = "error", currentMbps = null, error = error.message ?: error.javaClass.simpleName) }
            }
        }
    }

    private fun checkCancelled(): Boolean {
        if (!cancelled.get()) return false
        update { it.copy(phase = "cancelled", currentMbps = null) }
        return true
    }

    @Synchronized
    private fun update(change: (SpeedStatus) -> SpeedStatus) {
        status = change(status)
    }

    /** Median unloaded RTT and jitter; the first request (DNS + TLS setup) is discarded. */
    private fun measureLatency(samples: Int): Pair<Double?, Double?> {
        update { it.copy(phase = "latency") }
        val rtts = mutableListOf<Double>()
        repeat(samples + 1) { index ->
            if (cancelled.get()) return null to null
            val rtt = latencyProbe(readMeta = index == 0)
            if (index > 0 && rtt != null) rtts += rtt
            update { it.copy(progress = 0.08 * (index + 1) / (samples + 1)) }
        }
        val median = SpeedMath.median(rtts)
        val jitter = SpeedMath.jitter(rtts)
        update { it.copy(idleLatencyMs = median, jitterMs = jitter) }
        return median to jitter
    }

    /** One small request; returns its round-trip time without the server's processing time. */
    private fun latencyProbe(readMeta: Boolean): Double? {
        val connection = open("$BASE/__down?bytes=0", timeoutMs = 5000)
        return try {
            val started = System.nanoTime()
            connection.responseCode
            val elapsed = (System.nanoTime() - started) / 1_000_000.0
            connection.inputStream.use { it.readBytes() }
            if (readMeta) {
                update {
                    it.copy(
                        serverColo = connection.getHeaderField("cf-meta-colo"),
                        serverCity = connection.getHeaderField("cf-meta-city"),
                        serverCountry = connection.getHeaderField("cf-meta-country"),
                    )
                }
            }
            val server = SpeedMath.serverTimingMs(connection.getHeaderField("Server-Timing"))
            (elapsed - server).coerceAtLeast(0.0)
        } catch (error: IOException) {
            null
        }
    }

    /** ICMP echo to the speed-test host; null when the device does not allow ICMP. */
    private fun measureLoss(): Double? {
        val address = try {
            InetAddress.getByName(HOST)
        } catch (error: IOException) {
            return null
        }
        val pool = Executors.newFixedThreadPool(LOSS_PARALLELISM)
        try {
            val replies = pool.invokeAll(
                List(LOSS_PROBES) { Callable { Probes.icmpEcho(address, 1500) } },
                30,
                TimeUnit.SECONDS,
            ).map { runCatching { it.get() }.getOrNull() }
            if (replies.all { it == null }) return null
            val lost = replies.count { it?.status != "reply" }
            return Math.round(lost * 1000.0 / LOSS_PROBES) / 10.0
        } finally {
            pool.shutdownNow()
        }
    }

    private data class TransferResult(val mbps: Double?, val loadedLatencyMs: Double?)

    private fun transfer(upload: Boolean, progressFrom: Double, progressTo: Double): TransferResult {
        val bytes = AtomicLong(0)
        val stop = AtomicBoolean(false)
        val pool = Executors.newFixedThreadPool(streams + 1)
        val loaded = mutableListOf<Double>()
        val samples = mutableListOf<Pair<Long, Long>>()
        val started = System.nanoTime()
        try {
            repeat(streams) {
                pool.execute {
                    try {
                        while (!stop.get() && !cancelled.get()) {
                            try {
                                if (upload) uploadChunk(bytes, stop) else downloadChunk(bytes, stop)
                            } catch (error: IOException) {
                                if (stop.get()) break
                                Thread.sleep(RETRY_DELAY_MS)
                            }
                        }
                    } catch (error: InterruptedException) {
                        // Phase ended.
                    }
                }
            }
            pool.execute {
                try {
                    while (!stop.get() && !cancelled.get()) {
                        latencyProbe(readMeta = false)?.let { synchronized(loaded) { loaded += it } }
                        Thread.sleep(LOADED_PROBE_INTERVAL_MS)
                    }
                } catch (error: InterruptedException) {
                    // Phase ended.
                }
            }
            var lastBytes = 0L
            var lastNanos = 0L
            while (!cancelled.get()) {
                Thread.sleep(SAMPLE_INTERVAL_MS)
                val elapsed = System.nanoTime() - started
                val total = bytes.get()
                samples += elapsed to total
                val window = samples.lastOrNull { elapsed - it.first >= 1_000_000_000L } ?: (lastNanos to lastBytes)
                val current = SpeedMath.mbps(total - window.second, elapsed - window.first)
                val fraction = (elapsed.toDouble() / phaseNanos).coerceIn(0.0, 1.0)
                update {
                    it.copy(
                        currentMbps = current,
                        progress = progressFrom + (progressTo - progressFrom) * fraction,
                        bytesDownloaded = if (upload) it.bytesDownloaded else total,
                        bytesUploaded = if (upload) total else it.bytesUploaded,
                    )
                }
                lastBytes = total
                lastNanos = elapsed
                if (elapsed >= phaseNanos) break
            }
        } finally {
            stop.set(true)
            pool.shutdownNow()
            pool.awaitTermination(3, TimeUnit.SECONDS)
        }
        val mbps = SpeedMath.sustainedMbps(samples, WARMUP_NANOS)
        val latency = synchronized(loaded) { SpeedMath.median(loaded) }
        return TransferResult(mbps, latency)
    }

    private fun downloadChunk(counter: AtomicLong, stop: AtomicBoolean) {
        val connection = open("$BASE/__down?bytes=$DOWNLOAD_CHUNK_BYTES", timeoutMs = 10_000)
        try {
            connection.inputStream.use { input ->
                val buffer = ByteArray(BUFFER_BYTES)
                while (!stop.get() && !cancelled.get()) {
                    val read = input.read(buffer)
                    if (read < 0) break
                    counter.addAndGet(read.toLong())
                }
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun uploadChunk(counter: AtomicLong, stop: AtomicBoolean) {
        val connection = open("$BASE/__up", timeoutMs = 10_000)
        try {
            connection.requestMethod = "POST"
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/octet-stream")
            connection.setFixedLengthStreamingMode(UPLOAD_CHUNK_BYTES)
            val buffer = ByteArray(BUFFER_BYTES)
            var sent = 0L
            connection.outputStream.use { output ->
                while (sent < UPLOAD_CHUNK_BYTES) {
                    if (stop.get() || cancelled.get()) return
                    val size = minOf(BUFFER_BYTES.toLong(), UPLOAD_CHUNK_BYTES - sent).toInt()
                    output.write(buffer, 0, size)
                    sent += size
                    counter.addAndGet(size.toLong())
                }
            }
            connection.responseCode
        } finally {
            connection.disconnect()
        }
    }

    private fun open(url: String, timeoutMs: Int): HttpURLConnection =
        (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = timeoutMs
            readTimeout = timeoutMs
            useCaches = false
            setRequestProperty("User-Agent", USER_AGENT)
            setRequestProperty("Accept-Encoding", "identity")
        }

    companion object {
        const val HOST = "speed.cloudflare.com"
        private const val BASE = "https://$HOST"
        private const val USER_AGENT = "NetworkToolkit (Android; +https://github.com/Krumqnkata/network-toolkit)"
        private const val LATENCY_SAMPLES = 20
        private const val LOSS_PROBES = 20
        private const val LOSS_PARALLELISM = 5
        private const val DOWNLOAD_CHUNK_BYTES = 25_000_000L
        private const val UPLOAD_CHUNK_BYTES = 8_000_000L
        private const val BUFFER_BYTES = 64 * 1024
        private const val SAMPLE_INTERVAL_MS = 200L
        private const val LOADED_PROBE_INTERVAL_MS = 400L
        private const val WARMUP_NANOS = 2_000_000_000L
        private const val RETRY_DELAY_MS = 200L
    }
}
