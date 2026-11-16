package io.github.krumqnkata.networktoolkit.tools

/** Outcome of a single echo request. */
data class PingReply(
    /** `reply`, `timeout`, `ttl-exceeded` or `unreachable`. */
    val status: String,
    val rttMs: Double? = null,
    val ttl: Int? = null,
    /** Address that answered: the target for replies, a router for `ttl-exceeded`/`unreachable`. */
    val from: String? = null,
)

/**
 * Parses the output of Android's `ping`/`ping6` (iputils) for one probe
 * (`-n -c 1`). Formats handled, with and without a colon after the address:
 *
 *     64 bytes from 1.1.1.1: icmp_seq=1 ttl=57 time=12.3 ms
 *     From 192.168.1.1: icmp_seq=1 Time to live exceeded
 *     From 10.0.0.1 icmp_seq=1 Destination Host Unreachable
 */
object PingParser {
    private val REPLY = Regex("""bytes from (\S+?):?\s.*?ttl=(\d+).*?time[=<]([\d.]+)\s*ms""")
    private val TTL_EXCEEDED =
        Regex("""From (\S+?):?\s+(?:icmp_seq=\d+\s+)?(?:Time to live exceeded|Time exceeded)""")
    private val UNREACHABLE =
        Regex("""From (\S+?):?\s+(?:icmp_seq=\d+\s+)?Destination .*Unreachable""", RegexOption.IGNORE_CASE)

    fun parse(output: String): PingReply {
        for (line in output.lineSequence()) {
            REPLY.find(line)?.let { match ->
                return PingReply(
                    status = "reply",
                    rttMs = match.groupValues[3].toDoubleOrNull(),
                    ttl = match.groupValues[2].toIntOrNull(),
                    from = match.groupValues[1],
                )
            }
            TTL_EXCEEDED.find(line)?.let { return PingReply("ttl-exceeded", from = it.groupValues[1]) }
            UNREACHABLE.find(line)?.let { return PingReply("unreachable", from = it.groupValues[1]) }
        }
        return PingReply("timeout")
    }

    /** True when stderr shows that this device does not let apps send ICMP via `ping`. */
    fun isUnsupported(stderr: String): Boolean {
        val text = stderr.lowercase()
        return "permission denied" in text || "operation not permitted" in text ||
            "not found" in text || "socket: " in text
    }
}
