package io.github.krumqnkata.networktoolkit.wifi

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ScanFormatTest {
    @Test
    fun `channelWidthMhz maps every ScanResult width constant`() {
        assertEquals(20, ScanFormat.channelWidthMhz(0))
        assertEquals(40, ScanFormat.channelWidthMhz(1))
        assertEquals(80, ScanFormat.channelWidthMhz(2))
        assertEquals(160, ScanFormat.channelWidthMhz(3))
        assertEquals(160, ScanFormat.channelWidthMhz(4))
        assertEquals(320, ScanFormat.channelWidthMhz(5))
        assertNull(ScanFormat.channelWidthMhz(-1))
        assertNull(ScanFormat.channelWidthMhz(99))
    }

    @Test
    fun `only 80 plus 80 is a split channel`() {
        assertTrue(ScanFormat.isSplitChannel(4))
        assertFalse(ScanFormat.isSplitChannel(3))
    }

    @Test
    fun `normalizeScanSsid treats empty SSIDs as hidden`() {
        assertNull(ScanFormat.normalizeScanSsid(""))
        assertNull(ScanFormat.normalizeScanSsid(null))
        assertNull(ScanFormat.normalizeScanSsid("<unknown ssid>"))
        assertEquals("Cafe", ScanFormat.normalizeScanSsid("Cafe"))
        assertEquals("Cafe", ScanFormat.normalizeScanSsid("\"Cafe\""))
    }

    @Test
    fun `ageMillis converts boot-relative microseconds`() {
        assertEquals(1_500, ScanFormat.ageMillis(nowElapsedMillis = 10_000, timestampMicros = 8_500_000))
        assertEquals(0, ScanFormat.ageMillis(nowElapsedMillis = 1_000, timestampMicros = 5_000_000))
    }
}
