package io.github.krumqnkata.networktoolkit.tools

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class DnsMessageTest {
    private fun bytes(vararg values: Int) = ByteArray(values.size) { values[it].toByte() }

    private fun ascii(text: String) = text.toByteArray(Charsets.US_ASCII)

    /** Response header (ID 0x1234, QR+RD+RA, one question). */
    private val header = bytes(0x12, 0x34, 0x81, 0x80, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00)

    /** Question for example.com IN A, starting at offset 12. */
    private val question =
        bytes(7) + ascii("example") + bytes(3) + ascii("com") + bytes(0, 0x00, 0x01, 0x00, 0x01)

    private fun response(answerCount: Int, vararg answers: ByteArray): ByteArray {
        val head = header.copyOf()
        head[7] = answerCount.toByte()
        return answers.fold(head + question) { acc, answer -> acc + answer }
    }

    /** Answer RR owned by the question name (compression pointer to offset 12). */
    private fun answer(type: Int, ttl: Int, rdata: ByteArray) = bytes(
        0xC0, 0x0C, type shr 8, type and 0xFF, 0x00, 0x01,
        ttl ushr 24 and 0xFF, ttl shr 16 and 0xFF, ttl shr 8 and 0xFF, ttl and 0xFF,
        rdata.size shr 8, rdata.size and 0xFF,
    ) + rdata

    @Test
    fun `builds a recursive query`() {
        val query = DnsMessage.buildQuery(0x1234, "example.com", DnsTypes.A)
        assertArrayEquals(
            bytes(0x12, 0x34, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00) + question,
            query,
        )
    }

    @Test
    fun `parses A and AAAA answers`() {
        val aaaa = ByteArray(16)
        aaaa[0] = 0x26
        aaaa[1] = 0x06
        aaaa[2] = 0x47
        aaaa[15] = 0x01
        val message = response(
            2,
            answer(DnsTypes.A, 300, bytes(93, 184, 216, 34)),
            answer(DnsTypes.AAAA, 60, aaaa),
        )
        val parsed = DnsMessage.parse(message)
        assertEquals(0x1234, parsed.id)
        assertEquals(0, parsed.rcode)
        assertFalse(parsed.truncated)
        assertEquals(DnsRecord("example.com", DnsTypes.A, 300, "93.184.216.34"), parsed.answers[0])
        assertEquals("2606:4700::1", parsed.answers[1].data)
    }

    @Test
    fun `parses MX with a compressed exchange name`() {
        // Preference 10, exchange "mail" followed by a pointer to example.com.
        val rdata = bytes(0x00, 0x0A, 4) + ascii("mail") + bytes(0xC0, 0x0C)
        val parsed = DnsMessage.parse(response(1, answer(DnsTypes.MX, 3600, rdata)))
        assertEquals("10 mail.example.com", parsed.answers.single().data)
    }

    @Test
    fun `parses TXT and CAA`() {
        val txt = bytes(5) + ascii("hello") + bytes(2) + ascii("hi")
        val caa = bytes(0, 5) + ascii("issue") + ascii("ca")
        val parsed = DnsMessage.parse(response(2, answer(DnsTypes.TXT, 1, txt), answer(DnsTypes.CAA, 1, caa)))
        assertEquals("\"hello\" \"hi\"", parsed.answers[0].data)
        assertEquals("0 issue \"ca\"", parsed.answers[1].data)
    }

    @Test
    fun `reports rcode and truncation flags`() {
        val message = response(0)
        message[2] = 0x83.toByte() // QR + TC + RD
        message[3] = 0x83.toByte() // RA + NXDOMAIN
        val parsed = DnsMessage.parse(message)
        assertEquals(3, parsed.rcode)
        assertTrue(parsed.truncated)
        assertTrue(parsed.answers.isEmpty())
    }

    @Test
    fun `rejects truncated messages and pointer loops`() {
        assertThrows(IllegalArgumentException::class.java) { DnsMessage.parse(header.copyOf(6)) }
        // The answer name (offset 29 = 12 + 17) points at itself.
        val loop = response(1, bytes(0xC0, 0x1D, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0))
        assertThrows(IllegalArgumentException::class.java) { DnsMessage.parse(loop) }
    }

    @Test
    fun `formats IPv6 per RFC 5952`() {
        val loopback = ByteArray(16)
        loopback[15] = 1
        assertEquals("::1", IpFormat.ipv6(loopback))
        assertEquals("::", IpFormat.ipv6(ByteArray(16)))
        val noZeros = ByteArray(16) { if (it % 2 == 1) 1 else 0 }
        assertEquals("1:1:1:1:1:1:1:1", IpFormat.ipv6(noZeros))
        // A single zero group is not compressed.
        val single = ByteArray(16) { if (it % 2 == 1 && it != 5) 1 else 0 }
        assertEquals("1:1:0:1:1:1:1:1", IpFormat.ipv6(single))
    }
}
