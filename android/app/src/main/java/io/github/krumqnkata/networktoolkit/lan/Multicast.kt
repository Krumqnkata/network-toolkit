package io.github.krumqnkata.networktoolkit.lan

import io.github.krumqnkata.networktoolkit.tools.DnsMessage
import io.github.krumqnkata.networktoolkit.tools.DnsRecord
import java.net.DatagramPacket
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.MulticastSocket
import java.net.NetworkInterface
import java.net.SocketTimeoutException

data class MdnsReply(val from: String, val records: List<DnsRecord>)

data class SsdpReply(val from: String, val headers: Map<String, String>)

/**
 * mDNS and SSDP discovery over multicast.
 *
 * Both use *unicast replies* so that no `WifiManager.MulticastLock` (and no
 * extra permission) is needed:
 * - mDNS: queries are sent from an ephemeral port, which makes responders
 *   answer with a "legacy unicast" response to that port (RFC 6762 §6.7).
 * - SSDP: M-SEARCH responses are always unicast to the sender (UPnP 1.1 §1.3).
 *
 * The socket is bound to the interface that owns `localAddress` so that the
 * multicast goes out on Wi-Fi/Ethernet, not mobile data.
 */
object Multicast {
    private val MDNS_GROUP: InetAddress = InetAddress.getByName("224.0.0.251")
    private const val MDNS_PORT = 5353
    private val SSDP_GROUP: InetAddress = InetAddress.getByName("239.255.255.250")
    private const val SSDP_PORT = 1900
    private const val MAX_QUESTIONS_PER_PACKET = 12

    fun mdns(localAddress: String, questions: List<Pair<String, Int>>, durationMs: Int): List<MdnsReply> {
        require(questions.isNotEmpty()) { "No mDNS questions" }
        require(questions.all { it.first.lowercase().removeSuffix(".").endsWith(".local") }) {
            "mDNS names must end in .local"
        }
        val replies = mutableListOf<MdnsReply>()
        openSocket(localAddress).use { socket ->
            questions.chunked(MAX_QUESTIONS_PER_PACKET).forEach { chunk ->
                val query = DnsMessage.buildQuery(0, chunk, recursionDesired = false)
                socket.send(DatagramPacket(query, query.size, MDNS_GROUP, MDNS_PORT))
            }
            receive(socket, durationMs) { from, data ->
                val response = try {
                    DnsMessage.parse(data)
                } catch (error: IllegalArgumentException) {
                    return@receive
                }
                val records = response.answers + response.additional
                if (records.isNotEmpty()) replies += MdnsReply(from, records)
            }
        }
        return replies
    }

    fun ssdp(localAddress: String, durationMs: Int): List<SsdpReply> {
        val replies = mutableListOf<SsdpReply>()
        openSocket(localAddress).use { socket ->
            val waitSeconds = (durationMs / 1000).coerceIn(1, 5)
            val message = SsdpFormat.searchRequest(waitSeconds).toByteArray(Charsets.US_ASCII)
            // UDP is unreliable; UPnP recommends sending the search more than once.
            repeat(2) { socket.send(DatagramPacket(message, message.size, SSDP_GROUP, SSDP_PORT)) }
            receive(socket, durationMs) { from, data ->
                SsdpFormat.parseResponse(String(data, Charsets.UTF_8))?.let { replies += SsdpReply(from, it) }
            }
        }
        return replies
    }

    private fun openSocket(localAddress: String): MulticastSocket {
        val socket = MulticastSocket(InetSocketAddress(0))
        try {
            socket.timeToLive = 255
            val local = InetAddress.getByName(localAddress)
            NetworkInterface.getByInetAddress(local)?.let { socket.networkInterface = it }
        } catch (error: Exception) {
            socket.close()
            throw error
        }
        return socket
    }

    private fun receive(socket: MulticastSocket, durationMs: Int, onPacket: (String, ByteArray) -> Unit) {
        val deadline = System.nanoTime() + durationMs.coerceIn(200, 10_000) * 1_000_000L
        val buffer = ByteArray(9000)
        while (true) {
            val remaining = (deadline - System.nanoTime()) / 1_000_000L
            if (remaining <= 0) return
            socket.soTimeout = remaining.toInt().coerceAtLeast(1)
            val packet = DatagramPacket(buffer, buffer.size)
            try {
                socket.receive(packet)
            } catch (error: SocketTimeoutException) {
                return
            }
            onPacket(packet.address.hostAddress.orEmpty(), buffer.copyOf(packet.length))
        }
    }
}

/** SSDP message helpers; pure, unit-tested. */
object SsdpFormat {
    fun searchRequest(waitSeconds: Int): String =
        "M-SEARCH * HTTP/1.1\r\n" +
            "HOST: 239.255.255.250:1900\r\n" +
            "MAN: \"ssdp:discover\"\r\n" +
            "MX: $waitSeconds\r\n" +
            "ST: ssdp:all\r\n" +
            "USER-AGENT: Android UPnP/1.1 NetworkToolkit/1\r\n\r\n"

    /** Header map (lower-case keys) of an `HTTP/1.1 200 OK` search response, or null. */
    fun parseResponse(text: String): Map<String, String>? {
        val lines = text.split("\r\n", "\n")
        if (!lines.firstOrNull().orEmpty().startsWith("HTTP/1.1 200", ignoreCase = true)) return null
        val headers = linkedMapOf<String, String>()
        for (line in lines.drop(1)) {
            val index = line.indexOf(':')
            if (index <= 0) continue
            headers[line.substring(0, index).trim().lowercase()] = line.substring(index + 1).trim()
        }
        return headers
    }
}
