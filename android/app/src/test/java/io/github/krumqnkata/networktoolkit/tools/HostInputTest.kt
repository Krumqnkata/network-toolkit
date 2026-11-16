package io.github.krumqnkata.networktoolkit.tools

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class HostInputTest {
    @Test
    fun `accepts hostnames and IP literals`() {
        assertEquals("example.com", HostInput.normalizeHost("  Example.COM. "))
        assertEquals("192.168.1.1", HostInput.normalizeHost("192.168.1.1"))
        assertEquals("2606:4700::1111", HostInput.normalizeHost("[2606:4700::1111]"))
        assertEquals("_dmarc.example.com", HostInput.normalizeDnsName("_dmarc.example.com"))
    }

    @Test
    fun `encodes internationalized domain names`() {
        assertEquals("xn--bcher-kva.example", HostInput.normalizeHost("bücher.example"))
    }

    @Test
    fun `rejects option-like, empty and malformed input`() {
        val inputs = listOf("", "   ", "-c 100", "a b.com", "exa\$mple.com", "x".repeat(64) + ".com", "a..b")
        for (input in inputs) {
            assertThrows(IllegalArgumentException::class.java) { HostInput.normalizeHost(input) }
        }
    }

    @Test
    fun `recognizes IP literals without resolving them`() {
        assertTrue(HostInput.isIpLiteral("10.0.0.1"))
        assertTrue(HostInput.isIpLiteral("fe80::1%wlan0"))
        assertFalse(HostInput.isIpLiteral("cafe"))
        assertFalse(HostInput.isIpLiteral("example.com"))
    }

    @Test
    fun `validates ports`() {
        assertEquals(443, HostInput.requirePort(443))
        assertThrows(IllegalArgumentException::class.java) { HostInput.requirePort(0) }
        assertThrows(IllegalArgumentException::class.java) { HostInput.requirePort(70000) }
    }
}
