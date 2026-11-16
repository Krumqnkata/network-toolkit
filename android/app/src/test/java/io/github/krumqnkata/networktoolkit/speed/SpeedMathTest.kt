package io.github.krumqnkata.networktoolkit.speed

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SpeedMathTest {
    @Test
    fun `converts bytes and time to megabits per second`() {
        assertEquals(100.0, SpeedMath.mbps(12_500_000, 1_000_000_000), 1e-9)
        assertEquals(0.0, SpeedMath.mbps(1000, 0), 0.0)
    }

    @Test
    fun `median and jitter`() {
        assertEquals(15.0, SpeedMath.median(listOf(20.0, 10.0, 15.0))!!, 0.0)
        assertEquals(12.5, SpeedMath.median(listOf(10.0, 15.0, 20.0, 5.0))!!, 0.0)
        assertNull(SpeedMath.median(emptyList()))
        assertEquals(7.5, SpeedMath.jitter(listOf(10.0, 20.0, 15.0))!!, 0.0)
        assertNull(SpeedMath.jitter(listOf(10.0)))
    }

    @Test
    fun `reads server processing time from Server-Timing`() {
        assertEquals(15.0, SpeedMath.serverTimingMs("cfSpeedEdge;dur=1, cfSpeedWorker;dur=15"), 0.0)
        assertEquals(0.0, SpeedMath.serverTimingMs("cfL4;desc=\"?proto=TCP&rtt=29352\""), 0.0)
        assertEquals(0.0, SpeedMath.serverTimingMs(null), 0.0)
    }

    @Test
    fun `sustained throughput ignores the warm-up`() {
        val second = 1_000_000_000L
        // Slow start: 1 MB in the first 2 s, then 12.5 MB/s (100 Mbit/s) for 3 s.
        val samples = listOf(
            second to 250_000L,
            2 * second to 1_000_000L,
            3 * second to 13_500_000L,
            5 * second to 38_500_000L,
        )
        assertEquals(100.0, SpeedMath.sustainedMbps(samples, 2 * second)!!, 1e-9)
        assertNull(SpeedMath.sustainedMbps(samples.take(1), 2 * second))
    }
}
