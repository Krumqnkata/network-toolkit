package io.github.krumqnkata.networktoolkit.lan

import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.SocketTimeoutException

data class NetBiosInfo(
    val address: String,
    /** Computer name (unique name with suffix 0x00). */
    val name: String?,
    val workgroup: String?,
    /** Adapter MAC from the node status reply, when the host reports a real one. */
    val mac: String?,
)

/**
 * NetBIOS node status (NBSTAT) queries, RFC 1002 §4.2.17. Windows PCs and
 * Samba servers (NAS, routers) answer on UDP 137 with their computer name and,
 * usually, their MAC address — one of the few ways to learn a MAC address on
 * Android 10+, where the ARP table is not readable by apps.
 */
object NetBios {
    private const val PORT = 137
    private const val TYPE_NBSTAT = 0x21

    /** Query for the wildcard name `*`, first-level encoded (RFC 1001 §14.1). */
    fun buildStatusQuery(id: Int): ByteArray {
        val name = ByteArray(16).also { it[0] = '*'.code.toByte() }
        val encoded = ByteArray(32)
        for (i in 0 until 16) {
            val value = name[i].toInt() and 0xFF
            encoded[i * 2] = ('A'.code + (value shr 4)).toByte()
            encoded[i * 2 + 1] = ('A'.code + (value and 0x0F)).toByte()
        }
        val header = byteArrayOf(
            (id shr 8).toByte(), id.toByte(), 0, 0, 0, 1, 0, 0, 0, 0, 0, 0,
        )
        val question = byteArrayOf(32) + encoded + byteArrayOf(0, 0, TYPE_NBSTAT.toByte(), 0, 1)
        return header + question
    }

    /** Parses a node status response; returns null when it is not one. */
    fun parseStatusResponse(address: String, data: ByteArray): NetBiosInfo? {
        if (data.size < 12) return null
        var position = 12
        // Skip the (uncompressed) question name echoed in the answer.
        while (position < data.size) {
            val length = data[position].toInt() and 0xFF
            if (length == 0) {
                position++
                break
            }
            if (length and 0xC0 == 0xC0) {
                position += 2
                break
            }
            position += 1 + length
        }
        if (position + 10 > data.size) return null
        val type = ((data[position].toInt() and 0xFF) shl 8) or (data[position + 1].toInt() and 0xFF)
        if (type != TYPE_NBSTAT) return null
        position += 10 // type, class, ttl, rdlength
        if (position >= data.size) return null
        val count = data[position].toInt() and 0xFF
        position++
        var computerName: String? = null
        var workgroup: String? = null
        repeat(count) {
            if (position + 18 > data.size) return@repeat
            val raw = String(data, position, 15, Charsets.US_ASCII).trimEnd(' ', '\u0000')
            val suffix = data[position + 15].toInt() and 0xFF
            val group = (data[position + 16].toInt() and 0x80) != 0
            if (suffix == 0x00 && raw.isNotEmpty()) {
                if (group) {
                    if (workgroup == null) workgroup = raw
                } else if (computerName == null) {
                    computerName = raw
                }
            }
            position += 18
        }
        val mac = if (position + 6 <= data.size) {
            val bytes = data.copyOfRange(position, position + 6)
            if (bytes.all { it.toInt() == 0 }) null else bytes.joinToString(":") { "%02X".format(it.toInt() and 0xFF) }
        } else {
            null
        }
        return NetBiosInfo(address, computerName, workgroup, mac)
    }

    /** Sends one query to every address and collects the replies until the timeout. */
    fun query(addresses: List<InetAddress>, timeoutMs: Int): List<NetBiosInfo> {
        if (addresses.isEmpty()) return emptyList()
        val results = linkedMapOf<String, NetBiosInfo>()
        DatagramSocket().use { socket ->
            val packet = buildStatusQuery(0x4E54)
            for (address in addresses) {
                socket.send(DatagramPacket(packet, packet.size, address, PORT))
            }
            val wanted = addresses.map { it.hostAddress.orEmpty() }.toSet()
            val deadline = System.nanoTime() + timeoutMs * 1_000_000L
            val buffer = ByteArray(1024)
            while (results.size < wanted.size) {
                val remaining = (deadline - System.nanoTime()) / 1_000_000L
                if (remaining <= 0) break
                socket.soTimeout = remaining.toInt().coerceAtLeast(1)
                val reply = DatagramPacket(buffer, buffer.size)
                try {
                    socket.receive(reply)
                } catch (error: SocketTimeoutException) {
                    break
                }
                val from = reply.address.hostAddress.orEmpty()
                if (from !in wanted) continue
                parseStatusResponse(from, buffer.copyOf(reply.length))?.let { results[from] = it }
            }
        }
        return results.values.toList()
    }
}
