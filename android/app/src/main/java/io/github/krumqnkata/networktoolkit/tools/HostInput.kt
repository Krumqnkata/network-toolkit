package io.github.krumqnkata.networktoolkit.tools

import java.net.IDN

/** Validation of user-entered hosts and DNS names. Pure functions, unit-tested on the JVM. */
object HostInput {
    private val IP_LITERAL = Regex("^[0-9A-Fa-f:.]+(%[A-Za-z0-9_.-]+)?$")
    private val LABEL = Regex("^[A-Za-z0-9_]([A-Za-z0-9_-]{0,61}[A-Za-z0-9_])?$")

    /**
     * Returns the host in ASCII form (IDN-encoded, brackets and trailing dot
     * removed). Throws [IllegalArgumentException] for anything that is not a
     * hostname or an IP literal, so it can never be mistaken for a command-line
     * option or carry whitespace.
     */
    fun normalizeHost(input: String): String {
        var host = input.trim()
        if (host.startsWith("[") && host.endsWith("]")) host = host.substring(1, host.length - 1)
        require(host.isNotEmpty()) { "Enter a host name or IP address" }
        if (isIpLiteral(host)) return host
        return normalizeDnsName(host)
    }

    /** Normalizes a DNS name for queries; labels may contain `_` (SRV, DMARC, …). */
    fun normalizeDnsName(input: String): String {
        val trimmed = input.trim().removeSuffix(".")
        require(trimmed.isNotEmpty()) { "Enter a domain name" }
        val ascii = try {
            IDN.toASCII(trimmed, IDN.ALLOW_UNASSIGNED)
        } catch (error: IllegalArgumentException) {
            throw IllegalArgumentException("Invalid domain name: $input", error)
        }
        require(ascii.length <= 253) { "Domain name is too long" }
        val labels = ascii.split('.')
        require(labels.all { LABEL.matches(it) }) { "Invalid domain name: $input" }
        return ascii.lowercase()
    }

    /** True for strings shaped like an IPv4 or IPv6 literal (never triggers a DNS lookup). */
    fun isIpLiteral(host: String): Boolean =
        IP_LITERAL.matches(host) && (host.count { it == '.' } == 3 || host.contains(':'))

    fun requirePort(port: Int): Int {
        require(port in 1..65535) { "Port must be between 1 and 65535" }
        return port
    }
}
