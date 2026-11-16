package io.github.krumqnkata.networktoolkit.speed

import kotlin.math.abs

/** Pure helpers of the speed test, unit-tested on the JVM. */
object SpeedMath {
    /** Megabits per second for `bytes` transferred in `nanos`. */
    fun mbps(bytes: Long, nanos: Long): Double =
        if (nanos <= 0) 0.0 else bytes * 8.0 / (nanos / 1_000_000_000.0) / 1_000_000.0

    fun median(values: List<Double>): Double? {
        if (values.isEmpty()) return null
        val sorted = values.sorted()
        val middle = sorted.size / 2
        return if (sorted.size % 2 == 1) sorted[middle] else (sorted[middle - 1] + sorted[middle]) / 2
    }

    /** Mean absolute difference between consecutive samples. */
    fun jitter(values: List<Double>): Double? {
        if (values.size < 2) return null
        return values.zipWithNext { a, b -> abs(b - a) }.average()
    }

    /**
     * Server processing time in ms from a `Server-Timing` header such as
     * `cfSpeedEdge;dur=1, cfSpeedWorker;dur=15` (W3C Server Timing). Sums all
     * `dur` values of the named metrics, or returns 0 when none is present.
     */
    fun serverTimingMs(header: String?, metrics: Set<String> = setOf("cfspeedworker")): Double {
        if (header.isNullOrBlank()) return 0.0
        var total = 0.0
        for (entry in header.split(',')) {
            val parts = entry.split(';').map { it.trim() }
            val name = parts.firstOrNull()?.lowercase() ?: continue
            if (name !in metrics) continue
            val duration = parts.drop(1).firstOrNull { it.startsWith("dur=", ignoreCase = true) }
                ?.substringAfter('=')?.toDoubleOrNull()
            if (duration != null) total += duration
        }
        return total
    }

    /**
     * Throughput of a transfer from cumulative byte samples, ignoring the
     * first `warmupNanos` (TCP slow start), so the result reflects the
     * sustained rate. Samples are (elapsedNanos, totalBytes) pairs in order.
     */
    fun sustainedMbps(samples: List<Pair<Long, Long>>, warmupNanos: Long): Double? {
        if (samples.size < 2) return null
        val start = samples.lastOrNull { it.first <= warmupNanos } ?: samples.first()
        val end = samples.last()
        if (end.first <= start.first) return null
        return mbps(end.second - start.second, end.first - start.first)
    }
}
