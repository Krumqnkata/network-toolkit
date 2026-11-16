package io.github.krumqnkata.networktoolkit.tools

import java.io.ByteArrayOutputStream

data class DnsRecord(val name: String, val type: Int, val ttl: Long, val data: String)

data class DnsResponse(
    val id: Int,
    val rcode: Int,
    val authoritative: Boolean,
    val truncated: Boolean,
    val answers: List<DnsRecord>,
    val authority: List<DnsRecord>,
    val additional: List<DnsRecord> = emptyList(),
)

/**
 * Minimal DNS wire-format codec (RFC 1035, RFC 3596, RFC 2782, RFC 8659) for
 * building one-question queries and turning responses into readable records.
 * Pure Kotlin, unit-tested on the JVM.
 */
object DnsMessage {
    const val CLASS_IN = 1
    private const val MAX_POINTER_JUMPS = 32

    fun buildQuery(id: Int, name: String, type: Int): ByteArray = buildQuery(id, listOf(name to type), true)

    /** Query with several questions; mDNS uses `recursionDesired = false`. */
    fun buildQuery(id: Int, questions: List<Pair<String, Int>>, recursionDesired: Boolean): ByteArray {
        require(questions.size in 1..64) { "Too many questions" }
        val out = ByteArrayOutputStream()
        out.writeShort(id and 0xFFFF)
        out.writeShort(if (recursionDesired) 0x0100 else 0x0000)
        out.writeShort(questions.size) // QDCOUNT
        out.writeShort(0)
        out.writeShort(0)
        out.writeShort(0)
        for ((name, type) in questions) {
            writeName(out, name)
            out.writeShort(type)
            out.writeShort(CLASS_IN)
        }
        return out.toByteArray()
    }

    fun parse(message: ByteArray): DnsResponse {
        val reader = Reader(message)
        val id = reader.u16()
        val flags = reader.u16()
        val questions = reader.u16()
        val answerCount = reader.u16()
        val authorityCount = reader.u16()
        val additionalCount = reader.u16()
        repeat(questions) {
            reader.name()
            reader.skip(4)
        }
        val answers = List(answerCount) { reader.record() }
        val authority = List(authorityCount) { reader.record() }
        // Additional records matter for mDNS (SRV/TXT/A next to a PTR answer); a
        // malformed or OPT-only tail must not discard the answers above.
        val additional = try {
            List(additionalCount) { reader.record() }
        } catch (error: IllegalArgumentException) {
            emptyList()
        }
        return DnsResponse(
            id = id,
            rcode = flags and 0x0F,
            authoritative = flags and 0x0400 != 0,
            truncated = flags and 0x0200 != 0,
            answers = answers,
            authority = authority,
            additional = additional,
        )
    }

    /** Splits a presentation-format name on unescaped dots (`\.` keeps a dot inside a label). */
    fun splitLabels(name: String): List<String> {
        if (name.isEmpty() || name == ".") return emptyList()
        val labels = mutableListOf<String>()
        val current = StringBuilder()
        var index = 0
        while (index < name.length) {
            val char = name[index]
            when {
                char == BACKSLASH && index + 1 < name.length -> {
                    current.append(name[index + 1])
                    index++
                }
                char == '.' -> {
                    labels += current.toString()
                    current.clear()
                }
                else -> current.append(char)
            }
            index++
        }
        if (current.isNotEmpty() || !name.endsWith(".")) labels += current.toString()
        return labels
    }

    private const val BACKSLASH = '\\'

    private fun escapeLabel(label: String): String =
        label.replace("$BACKSLASH", "$BACKSLASH$BACKSLASH").replace(".", "$BACKSLASH.")

    private fun writeName(out: ByteArrayOutputStream, name: String) {
        if (name.isNotEmpty()) {
            for (label in splitLabels(name)) {
                // UTF-8: mDNS instance names may contain any characters (RFC 6763).
                val bytes = label.toByteArray(Charsets.UTF_8)
                require(bytes.size in 1..63) { "Invalid label in $name" }
                out.write(bytes.size)
                out.write(bytes)
            }
        }
        out.write(0)
    }

    private fun ByteArrayOutputStream.writeShort(value: Int) {
        write(value shr 8 and 0xFF)
        write(value and 0xFF)
    }

    private class Reader(private val data: ByteArray) {
        var position = 0

        fun u8(): Int {
            if (position >= data.size) throw IllegalArgumentException("Truncated DNS message")
            return data[position++].toInt() and 0xFF
        }

        fun u16(): Int = (u8() shl 8) or u8()

        fun u32(): Long = (u16().toLong() shl 16) or u16().toLong()

        fun skip(count: Int) {
            if (position + count > data.size) throw IllegalArgumentException("Truncated DNS message")
            position += count
        }

        fun bytes(count: Int): ByteArray {
            if (position + count > data.size) throw IllegalArgumentException("Truncated DNS message")
            return data.copyOfRange(position, position + count).also { position += count }
        }

        /** Reads a possibly compressed name starting at the current position. */
        fun name(): String {
            val labels = mutableListOf<String>()
            var cursor = position
            var jumped = false
            var jumps = 0
            while (true) {
                if (cursor >= data.size) throw IllegalArgumentException("Truncated DNS name")
                val length = data[cursor].toInt() and 0xFF
                when {
                    length == 0 -> {
                        cursor += 1
                        break
                    }
                    length and 0xC0 == 0xC0 -> {
                        if (cursor + 1 >= data.size) throw IllegalArgumentException("Truncated DNS name")
                        if (++jumps > MAX_POINTER_JUMPS) throw IllegalArgumentException("DNS name loop")
                        val pointer = ((length and 0x3F) shl 8) or (data[cursor + 1].toInt() and 0xFF)
                        if (!jumped) position = cursor + 2
                        jumped = true
                        cursor = pointer
                    }
                    else -> {
                        if (cursor + 1 + length > data.size) throw IllegalArgumentException("Truncated DNS name")
                        labels += escapeLabel(String(data, cursor + 1, length, Charsets.UTF_8))
                        cursor += 1 + length
                    }
                }
            }
            if (!jumped) position = cursor
            return if (labels.isEmpty()) "." else labels.joinToString(".")
        }

        fun record(): DnsRecord {
            val name = name()
            val type = u16()
            u16() // class
            val ttl = u32()
            val length = u16()
            val end = position + length
            if (end > data.size) throw IllegalArgumentException("Truncated DNS record")
            val value = rdata(type, length)
            position = end
            return DnsRecord(name, type, ttl, value)
        }

        private fun rdata(type: Int, length: Int): String = when (type) {
            DnsTypes.A -> if (length == 4) IpFormat.ipv4(bytes(4)) else hex(length)
            DnsTypes.AAAA -> if (length == 16) IpFormat.ipv6(bytes(16)) else hex(length)
            DnsTypes.NS, DnsTypes.CNAME, DnsTypes.PTR -> name()
            DnsTypes.MX -> "${u16()} ${name()}"
            DnsTypes.TXT -> characterStrings(length)
            DnsTypes.SOA -> listOf(name(), name(), u32(), u32(), u32(), u32(), u32()).joinToString(" ")
            DnsTypes.SRV -> "${u16()} ${u16()} ${u16()} ${name()}"
            DnsTypes.CAA -> {
                val flags = u8()
                val tagLength = u8()
                val tag = String(bytes(tagLength), Charsets.US_ASCII)
                val value = String(bytes(length - 2 - tagLength), Charsets.UTF_8)
                "$flags $tag \"$value\""
            }
            else -> hex(length)
        }

        private fun characterStrings(length: Int): String {
            val end = position + length
            val parts = mutableListOf<String>()
            while (position < end) {
                val size = u8()
                parts += "\"" + String(bytes(size), Charsets.UTF_8).replace("\"", "\\\"") + "\""
            }
            return parts.joinToString(" ")
        }

        /** RFC 3597 generic presentation for types without a dedicated formatter. */
        private fun hex(length: Int): String =
            "\\# $length " + bytes(length).joinToString("") { "%02x".format(it.toInt() and 0xFF) }
    }
}

object DnsTypes {
    const val A = 1
    const val NS = 2
    const val CNAME = 5
    const val SOA = 6
    const val PTR = 12
    const val MX = 15
    const val TXT = 16
    const val AAAA = 28
    const val SRV = 33
    const val CAA = 257
}

/** Textual IP formatting without java.net lookups (RFC 5952 for IPv6). */
object IpFormat {
    fun ipv4(bytes: ByteArray): String = bytes.joinToString(".") { (it.toInt() and 0xFF).toString() }

    fun ipv6(bytes: ByteArray): String {
        require(bytes.size == 16)
        val groups = IntArray(8) { ((bytes[it * 2].toInt() and 0xFF) shl 8) or (bytes[it * 2 + 1].toInt() and 0xFF) }
        // Longest run of at least two zero groups is replaced by "::".
        var bestStart = -1
        var bestLength = 1
        var index = 0
        while (index < 8) {
            if (groups[index] == 0) {
                val start = index
                while (index < 8 && groups[index] == 0) index++
                if (index - start > bestLength) {
                    bestStart = start
                    bestLength = index - start
                }
            } else {
                index++
            }
        }
        if (bestStart < 0) return groups.joinToString(":") { Integer.toHexString(it) }
        val head = groups.copyOfRange(0, bestStart).joinToString(":") { Integer.toHexString(it) }
        val tail = groups.copyOfRange(bestStart + bestLength, 8).joinToString(":") { Integer.toHexString(it) }
        return "$head::$tail"
    }
}
