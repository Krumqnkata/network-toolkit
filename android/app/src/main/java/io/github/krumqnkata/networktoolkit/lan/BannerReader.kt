package io.github.krumqnkata.networktoolkit.lan

import java.io.ByteArrayOutputStream
import java.net.Inet4Address
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Socket
import java.net.SocketTimeoutException

data class Banner(
    val address: String,
    val port: Int,
    /** Decoded text with control characters (except tab, CR, LF) removed. */
    val text: String,
    val bytes: Int,
    val connectMs: Double,
)

/**
 * Reads what a device on the local network says first (SSH, FTP, SMTP
 * greetings) or answers to a short request (HTTP). Used to identify devices:
 * only private, link-local and loopback addresses are allowed, the request
 * and the reply are small and bounded, and the connection is closed at once.
 */
object BannerReader {
    const val MAX_BYTES = 16_384
    const val MAX_PAYLOAD = 1_024

    fun isLocal(address: InetAddress): Boolean {
        if (address.isLoopbackAddress || address.isLinkLocalAddress || address.isSiteLocalAddress) return true
        // IPv6 unique local addresses (fc00::/7).
        if (address !is Inet4Address) {
            val first = address.address.firstOrNull()?.toInt() ?: return false
            return (first and 0xfe) == 0xfc
        }
        return false
    }

    fun read(address: InetAddress, port: Int, payload: String, maxBytes: Int, timeoutMs: Int): Banner {
        require(isLocal(address)) { "Only devices on the local network can be identified" }
        require(payload.length <= MAX_PAYLOAD) { "Request too long" }
        val limit = maxBytes.coerceIn(1, MAX_BYTES)
        val started = System.nanoTime()
        Socket().use { socket ->
            socket.connect(InetSocketAddress(address, port), timeoutMs)
            val connectMs = Math.round((System.nanoTime() - started) / 10_000.0) / 100.0
            socket.soTimeout = timeoutMs
            if (payload.isNotEmpty()) {
                socket.getOutputStream().apply {
                    write(payload.toByteArray(Charsets.ISO_8859_1))
                    flush()
                }
            }
            val deadline = started + timeoutMs * 1_000_000L
            val buffer = ByteArrayOutputStream()
            val chunk = ByteArray(2_048)
            val input = socket.getInputStream()
            try {
                while (buffer.size() < limit && System.nanoTime() < deadline) {
                    val read = input.read(chunk, 0, minOf(chunk.size, limit - buffer.size()))
                    if (read < 0) break
                    buffer.write(chunk, 0, read)
                    // A greeting is one line; stop as soon as it is complete.
                    if (payload.isEmpty() && chunk.copyOf(read).contains('\n'.code.toByte())) break
                }
            } catch (error: SocketTimeoutException) {
                if (buffer.size() == 0) throw error
            }
            val bytes = buffer.toByteArray()
            return Banner(address.hostAddress.orEmpty(), port, sanitize(bytes), bytes.size, connectMs)
        }
    }

    /** UTF-8 text without control characters other than tab, CR and LF. */
    fun sanitize(bytes: ByteArray): String =
        String(bytes, Charsets.UTF_8).filter { char ->
            char == '\t' || char == '\r' || char == '\n' || (char >= ' ' && char != '\u007f')
        }
}
