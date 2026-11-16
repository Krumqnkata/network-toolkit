package io.github.krumqnkata.networktoolkit.tools

import android.content.Context
import android.net.ConnectivityManager
import android.net.DnsResolver
import android.os.Build
import android.os.CancellationSignal
import androidx.annotation.RequiresApi
import java.io.DataInputStream
import java.io.IOException
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Socket
import java.net.SocketTimeoutException
import java.security.SecureRandom
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

data class DnsQueryResult(
    /** `system` when Android's resolver answered (it may use Private DNS), otherwise the server IP. */
    val server: String,
    val durationMs: Double,
    val response: DnsResponse,
)

/**
 * Sends DNS queries for any record type.
 *
 * - System resolver, Android 10+: [DnsResolver.rawQuery] on the active
 *   network, which honours Private DNS (DNS-over-TLS).
 * - System resolver, Android 8–9: plain DNS to the active network's first DNS
 *   server from `LinkProperties`.
 * - A chosen server (e.g. 1.1.1.1): plain DNS over UDP, retried over TCP when
 *   the answer is truncated.
 */
class DnsClient(context: Context) {
    private val connectivity = context.applicationContext.getSystemService(ConnectivityManager::class.java)
    private val random = SecureRandom()
    private val callbackExecutor = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "DnsClient").apply { isDaemon = true }
    }

    fun query(name: String, type: Int, server: String, timeoutMs: Int): DnsQueryResult {
        require(type in 1..65535) { "Unsupported record type" }
        val qname = if (name.trim() == ".") "" else HostInput.normalizeDnsName(name)
        val started = System.nanoTime()
        if (server.isBlank()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val response = systemQuery(qname, type, timeoutMs)
                return DnsQueryResult("system", elapsedMs(started), response)
            }
            val dns = systemDnsServer() ?: throw IOException("The active network has no DNS server")
            return DnsQueryResult(dns.hostAddress.orEmpty(), elapsedMs(started), exchange(dns, qname, type, timeoutMs))
        }
        require(HostInput.isIpLiteral(server.trim())) { "DNS server must be an IP address" }
        val address = InetAddress.getByName(server.trim())
        val response = exchange(address, qname, type, timeoutMs)
        return DnsQueryResult(address.hostAddress.orEmpty(), elapsedMs(started), response)
    }

    fun shutdown() {
        callbackExecutor.shutdownNow()
    }

    @RequiresApi(Build.VERSION_CODES.Q)
    private fun systemQuery(qname: String, type: Int, timeoutMs: Int): DnsResponse {
        val latch = CountDownLatch(1)
        val answer = AtomicReference<ByteArray?>()
        val failure = AtomicReference<Throwable?>()
        val cancel = CancellationSignal()
        DnsResolver.getInstance().rawQuery(
            connectivity?.activeNetwork,
            qname,
            DnsMessage.CLASS_IN,
            type,
            DnsResolver.FLAG_EMPTY,
            callbackExecutor,
            cancel,
            object : DnsResolver.Callback<ByteArray> {
                override fun onAnswer(response: ByteArray, rcode: Int) {
                    answer.set(response)
                    latch.countDown()
                }

                override fun onError(error: DnsResolver.DnsException) {
                    failure.set(error)
                    latch.countDown()
                }
            },
        )
        if (!latch.await(timeoutMs.toLong(), TimeUnit.MILLISECONDS)) {
            cancel.cancel()
            throw SocketTimeoutException("DNS query timed out")
        }
        failure.get()?.let { throw IOException(it.message ?: "DNS query failed", it) }
        return DnsMessage.parse(answer.get() ?: throw IOException("Empty DNS response"))
    }

    private fun systemDnsServer(): InetAddress? {
        val manager = connectivity ?: return null
        val network = manager.activeNetwork ?: return null
        return manager.getLinkProperties(network)?.dnsServers?.firstOrNull()
    }

    private fun exchange(server: InetAddress, qname: String, type: Int, timeoutMs: Int): DnsResponse {
        val id = random.nextInt(0x10000)
        val query = DnsMessage.buildQuery(id, qname, type)
        val udp = udpExchange(server, query, id, timeoutMs)
        return if (udp.truncated) tcpExchange(server, query, id, timeoutMs) else udp
    }

    private fun udpExchange(server: InetAddress, query: ByteArray, id: Int, timeoutMs: Int): DnsResponse {
        DatagramSocket().use { socket ->
            socket.soTimeout = timeoutMs
            socket.send(DatagramPacket(query, query.size, server, PORT))
            val buffer = ByteArray(4096)
            val deadline = System.nanoTime() + timeoutMs * 1_000_000L
            while (true) {
                val packet = DatagramPacket(buffer, buffer.size)
                socket.receive(packet)
                if (packet.address == server) {
                    val response = DnsMessage.parse(buffer.copyOf(packet.length))
                    if (response.id == id) return response
                }
                // Ignore stray packets until the deadline.
                val remaining = (deadline - System.nanoTime()) / 1_000_000L
                if (remaining <= 0) throw SocketTimeoutException("DNS query timed out")
                socket.soTimeout = remaining.toInt()
            }
        }
    }

    private fun tcpExchange(server: InetAddress, query: ByteArray, id: Int, timeoutMs: Int): DnsResponse {
        Socket().use { socket ->
            socket.connect(InetSocketAddress(server, PORT), timeoutMs)
            socket.soTimeout = timeoutMs
            val out = socket.getOutputStream()
            out.write(byteArrayOf((query.size shr 8).toByte(), query.size.toByte()) + query)
            out.flush()
            val input = DataInputStream(socket.getInputStream())
            val length = input.readUnsignedShort()
            val message = ByteArray(length).also { input.readFully(it) }
            val response = DnsMessage.parse(message)
            if (response.id != id) throw IOException("DNS response ID mismatch")
            return response
        }
    }

    private fun elapsedMs(startedNanos: Long): Double =
        Math.round((System.nanoTime() - startedNanos) / 10_000.0) / 100.0

    private companion object {
        const val PORT = 53
    }
}
