package io.github.krumqnkata.networktoolkit.network

import java.net.Inet6Address
import java.net.InetAddress
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NetworkFormatTest {
    @Test
    fun `normalizeSsid strips the quotes Android adds to UTF-8 SSIDs`() {
        assertEquals("Home Wi-Fi", NetworkFormat.normalizeSsid("\"Home Wi-Fi\""))
        assertEquals("Домашна мрежа", NetworkFormat.normalizeSsid("\"Домашна мрежа\""))
    }

    @Test
    fun `normalizeSsid keeps hex SSIDs as reported`() {
        assertEquals("68656c6c6f", NetworkFormat.normalizeSsid("68656c6c6f"))
    }

    @Test
    fun `normalizeSsid returns null when the SSID is unavailable`() {
        assertNull(NetworkFormat.normalizeSsid(null))
        assertNull(NetworkFormat.normalizeSsid(""))
        assertNull(NetworkFormat.normalizeSsid("<unknown ssid>"))
        assertNull(NetworkFormat.normalizeSsid("\"\""))
    }

    @Test
    fun `normalizeBssid hides redacted and empty values`() {
        assertEquals("aa:bb:cc:dd:ee:ff", NetworkFormat.normalizeBssid("AA:BB:CC:DD:EE:FF"))
        assertNull(NetworkFormat.normalizeBssid("02:00:00:00:00:00"))
        assertNull(NetworkFormat.normalizeBssid("00:00:00:00:00:00"))
        assertNull(NetworkFormat.normalizeBssid(null))
    }

    @Test
    fun `normalizeRssi rejects invalid readings`() {
        assertEquals(-61, NetworkFormat.normalizeRssi(-61))
        assertNull(NetworkFormat.normalizeRssi(-127))
        assertNull(NetworkFormat.normalizeRssi(-200))
        assertNull(NetworkFormat.normalizeRssi(0))
    }

    @Test
    fun `positiveOrNull treats zero and sentinel values as unknown`() {
        assertEquals(866, NetworkFormat.positiveOrNull(866))
        assertNull(NetworkFormat.positiveOrNull(0))
        assertNull(NetworkFormat.positiveOrNull(-1))
    }

    @Test
    fun `hostAddress drops the IPv6 zone index`() {
        val address = InetAddress.getByName("fe80::1%1")
        assertEquals("fe80:0:0:0:0:0:0:1", NetworkFormat.hostAddress(address))
        assertEquals("192.168.1.1", NetworkFormat.hostAddress(InetAddress.getByName("192.168.1.1")))
    }

    @Test
    fun `isUnspecified detects missing and wildcard gateways`() {
        assertTrue(NetworkFormat.isUnspecified(null))
        assertTrue(NetworkFormat.isUnspecified(InetAddress.getByName("0.0.0.0")))
        assertTrue(NetworkFormat.isUnspecified(InetAddress.getByName("::")))
        assertFalse(NetworkFormat.isUnspecified(InetAddress.getByName("192.168.0.1")))
    }

    @Test
    fun `ipv6Scope classifies addresses`() {
        fun scope(value: String) = NetworkFormat.ipv6Scope(InetAddress.getByName(value) as Inet6Address)
        assertEquals("link-local", scope("fe80::1"))
        assertEquals("unique-local", scope("fd12:3456::1"))
        assertEquals("global", scope("2001:db8::1"))
        assertEquals("loopback", scope("::1"))
    }

    @Test
    fun `cellular dBm ignores unavailable values`() {
        assertEquals(-84, NetworkFormat.cellDbm(-84))
        assertNull(NetworkFormat.cellDbm(Int.MAX_VALUE))
        assertNull(NetworkFormat.cellDbm(0))
    }

    @Test
    fun `best cellular report prefers the newest generation`() {
        assertEquals("5G" to -95, NetworkFormat.bestCellReport(listOf("4G" to -84, "5G" to -95)))
        // Non-standalone 5G sometimes reports NR without a level: fall back to LTE dBm.
        assertEquals("5G" to -84, NetworkFormat.bestCellReport(listOf("4G" to -84, "5G" to null)))
        assertNull(NetworkFormat.bestCellReport(emptyList()))
    }
}
