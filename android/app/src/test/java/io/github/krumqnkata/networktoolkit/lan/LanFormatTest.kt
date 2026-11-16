package io.github.krumqnkata.networktoolkit.lan

import io.github.krumqnkata.networktoolkit.tools.DnsMessage
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LanFormatTest {
    private fun ascii(text: String) = text.toByteArray(Charsets.US_ASCII)

    private fun nbName(name: String, suffix: Int, flags: Int): ByteArray =
        ascii(name.padEnd(15, ' ')) + byteArrayOf(suffix.toByte(), (flags shr 8).toByte(), flags.toByte())

    @Test
    fun `encodes the wildcard NBSTAT query`() {
        val query = NetBios.buildStatusQuery(0x1234)
        assertEquals(50, query.size)
        assertEquals(0x12.toByte(), query[0])
        assertEquals(32.toByte(), query[12])
        assertEquals("CKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", String(query, 13, 32, Charsets.US_ASCII))
        assertEquals(0x21.toByte(), query[47]) // NBSTAT
    }

    @Test
    fun `parses computer name, workgroup and MAC from a node status reply`() {
        val header = byteArrayOf(0x12, 0x34, 0x84.toByte(), 0, 0, 0, 0, 1, 0, 0, 0, 0)
        val name = byteArrayOf(32) + ascii("CKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA") + byteArrayOf(0)
        val names = nbName("WORKGROUP", 0x00, 0x8400) + nbName("DESKTOP-1", 0x00, 0x0400) +
            nbName("DESKTOP-1", 0x20, 0x0400)
        val mac = byteArrayOf(0x3C, 0x52, 0x82.toByte(), 0x01, 0x02, 0x03)
        val rdata = byteArrayOf(3) + names + mac
        val answer = byteArrayOf(0, 0x21, 0, 1, 0, 0, 0, 0, 0, rdata.size.toByte()) + rdata
        val info = NetBios.parseStatusResponse("192.168.1.10", header + name + answer)!!
        assertEquals("DESKTOP-1", info.name)
        assertEquals("WORKGROUP", info.workgroup)
        assertEquals("3C:52:82:01:02:03", info.mac)
    }

    @Test
    fun `ignores zero MACs and non-NBSTAT packets`() {
        val header = byteArrayOf(0, 1, 0x84.toByte(), 0, 0, 0, 0, 1, 0, 0, 0, 0)
        val name = byteArrayOf(32) + ascii("CKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA") + byteArrayOf(0)
        val rdata = byteArrayOf(1) + nbName("NAS", 0x00, 0x0400) + ByteArray(6)
        val answer = byteArrayOf(0, 0x21, 0, 1, 0, 0, 0, 0, 0, rdata.size.toByte()) + rdata
        assertNull(NetBios.parseStatusResponse("10.0.0.2", header + name + answer)!!.mac)
        val wrongType = byteArrayOf(0, 0x20, 0, 1, 0, 0, 0, 0, 0, 0)
        assertNull(NetBios.parseStatusResponse("10.0.0.2", header + name + wrongType))
        assertNull(NetBios.parseStatusResponse("10.0.0.2", ByteArray(4)))
    }

    @Test
    fun `parses SSDP search responses`() {
        val headers = SsdpFormat.parseResponse(
            "HTTP/1.1 200 OK\r\nCACHE-CONTROL: max-age=1800\r\n" +
                "LOCATION: http://192.168.1.1:1900/rootDesc.xml\r\nSERVER: Linux UPnP/1.1 MiniUPnPd/2.3\r\n" +
                "ST: upnp:rootdevice\r\nUSN: uuid:abc::upnp:rootdevice\r\n\r\n",
        )!!
        assertEquals("http://192.168.1.1:1900/rootDesc.xml", headers["location"])
        assertEquals("Linux UPnP/1.1 MiniUPnPd/2.3", headers["server"])
        assertNull(SsdpFormat.parseResponse("NOTIFY * HTTP/1.1\r\nNT: x\r\n\r\n"))
        assertTrue(SsdpFormat.searchRequest(2).contains("MX: 2\r\n"))
    }

    @Test
    fun `builds multi-question mDNS queries and escapes dots in labels`() {
        val query = DnsMessage.buildQuery(
            0,
            listOf("_http._tcp.local" to 12, "My\\.Printer._ipp._tcp.local" to 33),
            recursionDesired = false,
        )
        assertEquals(0.toByte(), query[2]) // no RD bit
        assertEquals(2.toByte(), query[5]) // QDCOUNT
        assertEquals(listOf("My.Printer", "_ipp", "_tcp", "local"), DnsMessage.splitLabels("My\\.Printer._ipp._tcp.local"))
        assertEquals(listOf("a", "b"), DnsMessage.splitLabels("a.b."))
        assertTrue(DnsMessage.splitLabels(".").isEmpty())
    }

    @Test
    fun `round-trips escaped names through the parser`() {
        // Response with one PTR answer whose target label contains a dot.
        val header = byteArrayOf(0, 0, 0x84.toByte(), 0, 0, 0, 0, 1, 0, 0, 0, 0)
        val owner = byteArrayOf(5) + ascii("_http") + byteArrayOf(4) + ascii("_tcp") + byteArrayOf(5) + ascii("local") + byteArrayOf(0)
        val target = byteArrayOf(6) + ascii("Box.TV") + byteArrayOf(0xC0.toByte(), 12)
        val answer = owner + byteArrayOf(0, 12, 0, 1, 0, 0, 0, 120, 0, target.size.toByte()) + target
        val parsed = DnsMessage.parse(header + answer)
        assertEquals("Box\\.TV._http._tcp.local", parsed.answers.single().data)
    }
}
