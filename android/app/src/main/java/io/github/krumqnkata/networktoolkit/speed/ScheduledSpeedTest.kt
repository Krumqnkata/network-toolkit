package io.github.krumqnkata.networktoolkit.speed

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.util.Log
import io.github.krumqnkata.networktoolkit.storage.AppDatabase
import org.json.JSONObject

/**
 * Automatic speed tests for the provider report: a periodic JobScheduler job
 * that runs only on an unmetered network (home Wi-Fi or Ethernet) and when the
 * battery is not low, and stores each result like a test started by hand.
 */
object SpeedSchedule {
    const val JOB_ID = 4_201
    val ALLOWED_HOURS = setOf(6, 12, 24)
    /** Shorter than a manual test: a scheduled test should cost less data. */
    const val PHASE_SECONDS = 5L
    const val STREAMS = 4
    const val MAX_STORED = 200

    fun schedule(context: Context, hours: Int) {
        val scheduler = context.getSystemService(JobScheduler::class.java)
        if (hours !in ALLOWED_HOURS) {
            scheduler.cancel(JOB_ID)
            return
        }
        val interval = hours * 3_600_000L
        val job = JobInfo.Builder(JOB_ID, ComponentName(context, ScheduledSpeedTestJob::class.java))
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_UNMETERED)
            .setRequiresBatteryNotLow(true)
            // Runs somewhere in the last hour of each period, so tests land at different times of day.
            .setPeriodic(interval, 3_600_000L)
            .setPersisted(true)
            .build()
        scheduler.schedule(job)
    }

    /** Hours between tests, or 0 when no test is scheduled. */
    fun currentHours(context: Context): Int {
        val job = context.getSystemService(JobScheduler::class.java).getPendingJob(JOB_ID) ?: return 0
        return (job.intervalMillis / 3_600_000L).toInt()
    }

    /** The same JSON shape as `speedResultSchema` in src/database/repositories.ts. */
    fun resultJson(status: SpeedStatus, finishedAt: Long, transport: String, rssi: Int?): String =
        JSONObject().apply {
            put("phase", status.phase)
            put("progress", status.progress)
            put("currentMbps", JSONObject.NULL)
            putNullable("downloadMbps", status.downloadMbps)
            putNullable("uploadMbps", status.uploadMbps)
            putNullable("idleLatencyMs", status.idleLatencyMs)
            putNullable("jitterMs", status.jitterMs)
            putNullable("downloadLatencyMs", status.downloadLatencyMs)
            putNullable("uploadLatencyMs", status.uploadLatencyMs)
            putNullable("packetLossPercent", status.packetLossPercent)
            put("bytesDownloaded", status.bytesDownloaded)
            put("bytesUploaded", status.bytesUploaded)
            put("serverColo", status.serverColo ?: JSONObject.NULL)
            put("serverCity", status.serverCity ?: JSONObject.NULL)
            put("serverCountry", status.serverCountry ?: JSONObject.NULL)
            put("error", status.error ?: JSONObject.NULL)
            put("finishedAt", finishedAt)
            put("scheduled", true)
            put("transport", transport)
            put("rssi", rssi ?: JSONObject.NULL)
        }.toString()

    private fun JSONObject.putNullable(key: String, value: Double?) {
        put(key, if (value == null || value.isNaN() || value.isInfinite()) JSONObject.NULL else value)
    }
}

class ScheduledSpeedTestJob : JobService() {
    @Volatile private var test: SpeedTest? = null

    override fun onStartJob(params: JobParameters): Boolean {
        Thread({
            try {
                runTest()
            } catch (error: Exception) {
                Log.w(TAG, "Scheduled speed test failed", error)
            } finally {
                jobFinished(params, false)
            }
        }, "ScheduledSpeedTest").start()
        return true
    }

    override fun onStopJob(params: JobParameters): Boolean {
        // The network went away or the battery got low: stop and wait for the next period.
        test?.cancel()
        return false
    }

    private fun runTest() {
        val (transport, rssi) = currentLink()
        val speedTest = SpeedTest(SpeedSchedule.STREAMS, SpeedSchedule.PHASE_SECONDS * 1_000_000_000L)
        test = speedTest
        speedTest.run()
        val status = speedTest.status()
        if (status.phase != "done") return
        val database = AppDatabase(applicationContext)
        try {
            val now = System.currentTimeMillis()
            database.insert("speed-result", now, SpeedSchedule.resultJson(status, now, transport, rssi))
            database.prune("speed-result", SpeedSchedule.MAX_STORED)
        } finally {
            database.close()
        }
    }

    /** Transport of the active network and, on Wi-Fi, its signal (no location permission needed). */
    private fun currentLink(): Pair<String, Int?> {
        val connectivity = getSystemService(ConnectivityManager::class.java)
        val caps = connectivity.getNetworkCapabilities(connectivity.activeNetwork) ?: return "other" to null
        val transport = when {
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
            else -> "other"
        }
        val rssi = if (transport == "wifi" && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            caps.signalStrength.takeIf { it != NetworkCapabilities.SIGNAL_STRENGTH_UNSPECIFIED }
        } else {
            null
        }
        return transport to rssi
    }

    private companion object {
        const val TAG = "ScheduledSpeedTest"
    }
}
