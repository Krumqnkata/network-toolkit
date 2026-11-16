package io.github.krumqnkata.networktoolkit.tools

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PingParserTest {
    @Test
    fun `parses an IPv4 echo reply`() {
        val output = """
            PING 1.1.1.1 (1.1.1.1) 56(84) bytes of data.
            64 bytes from 1.1.1.1: icmp_seq=1 ttl=57 time=12.3 ms

            --- 1.1.1.1 ping statistics ---
            1 packets transmitted, 1 received, 0% packet loss, time 0ms
        """.trimIndent()
        assertEquals(PingReply("reply", rttMs = 12.3, ttl = 57, from = "1.1.1.1"), PingParser.parse(output))
    }

    @Test
    fun `parses an IPv6 echo reply`() {
        val reply = PingParser.parse("64 bytes from 2606:4700:4700::1111: icmp_seq=1 ttl=58 time=9.81 ms")
        assertEquals("reply", reply.status)
        assertEquals("2606:4700:4700::1111", reply.from)
        assertEquals(9.81, reply.rttMs!!, 0.0001)
    }

    @Test
    fun `parses time exceeded with and without a colon`() {
        assertEquals(
            PingReply("ttl-exceeded", from = "192.168.1.1"),
            PingParser.parse("From 192.168.1.1: icmp_seq=1 Time to live exceeded"),
        )
        assertEquals(
            PingReply("ttl-exceeded", from = "10.0.0.1"),
            PingParser.parse("From 10.0.0.1 icmp_seq=1 Time to live exceeded"),
        )
    }

    @Test
    fun `parses destination unreachable`() {
        val reply = PingParser.parse("From 192.168.1.20 icmp_seq=1 Destination Host Unreachable")
        assertEquals("unreachable", reply.status)
        assertEquals("192.168.1.20", reply.from)
    }

    @Test
    fun `reports a timeout when no reply line is present`() {
        val reply = PingParser.parse("1 packets transmitted, 0 received, 100% packet loss, time 0ms")
        assertEquals("timeout", reply.status)
        assertNull(reply.rttMs)
    }

    @Test
    fun `detects devices that block ICMP for apps`() {
        assertTrue(PingParser.isUnsupported("ping: socket: Operation not permitted"))
        assertTrue(PingParser.isUnsupported("/system/bin/ping: Permission denied"))
        assertFalse(PingParser.isUnsupported(""))
    }
}
