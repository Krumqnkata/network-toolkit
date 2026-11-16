package io.github.krumqnkata.networktoolkit.tools

import java.io.File
import java.io.IOException
import java.net.ConnectException
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.NoRouteToHostException
import java.net.Socket
import java.net.SocketTimeoutException
import java.util.concurrent.TimeUnit
import kotlin.math.ceil

data class PingResult(
    val address: String,
    val family: String,
    /** `icmp` when the system `ping` binary was used, `tcp` for the connect-time fallback. */
    val method: String,
    val reply: PingReply,
)

data class TcpResult(
    val address: String,
    val family: String,
    /** `open`, `refused`, `timeout` or `unreachable`. */
    val status: String,
    val connectMs: Double?,
    val message: String?,
)

/**
 * Latency probes.
 *
 * Android apps cannot open raw sockets, but the system `/system/bin/ping`
 * (iputils) is allowed to send ICMP echo requests for unprivileged apps on
 * practically every device. Each probe runs it once (`-c 1`) with the already
 * resolved numeric address, so user input never reaches the command line.
 * Where `ping` is unavailable, [ping] falls back to timing a TCP connect.
 */
object Probes {
    private val PING_BINARIES = listOf("/system/bin/ping", "/system/xbin/ping")
    private val PING6_BINARIES = listOf("/system/bin/ping6", "/system/xbin/ping6")
    private val FALLBACK_PORTS = listOf(443, 80)

    fun ping(host: String, family: String, ttl: Int, timeoutMs: Int): PingResult {
        val address = AddressResolver.resolve(host, if (ttl > 0 && family == "any") "ipv4" else family)
        val addressFamily = AddressResolver.familyOf(address)
        if (ttl > 0 && addressFamily == "ipv6") {
            throw UnsupportedOperationException("Traceroute supports IPv4 destinations only")
        }
        val reply = try {
            runPing(address, addressFamily, ttl, timeoutMs)
        } catch (error: PingUnavailableException) {
            if (ttl > 0) {
                throw UnsupportedOperationException(
                    "This device does not let apps send ICMP, so traceroute is unavailable",
                    error,
                )
            }
            return PingResult(address.hostAddress.orEmpty(), addressFamily, "tcp", tcpPing(address, timeoutMs))
        }
        return PingResult(address.hostAddress.orEmpty(), addressFamily, "icmp", reply)
    }

    fun tcpConnect(host: String, port: Int, family: String, timeoutMs: Int): TcpResult {
        HostInput.requirePort(port)
        val address = AddressResolver.resolve(host, family)
        val started = System.nanoTime()
        val (status, message) = try {
            Socket().use { it.connect(InetSocketAddress(address, port), timeoutMs) }
            "open" to null
        } catch (error: SocketTimeoutException) {
            "timeout" to error.message
        } catch (error: NoRouteToHostException) {
            "unreachable" to error.message
        } catch (error: ConnectException) {
            val text = error.message.orEmpty()
            (if ("ECONNREFUSED" in text || "refused" in text.lowercase()) "refused" else "unreachable") to text
        }
        val elapsed = elapsedMs(started)
        return TcpResult(
            address = address.hostAddress.orEmpty(),
            family = AddressResolver.familyOf(address),
            status = status,
            connectMs = if (status == "open" || status == "refused") elapsed else null,
            message = message,
        )
    }

    private fun runPing(address: InetAddress, family: String, ttl: Int, timeoutMs: Int): PingReply {
        val binary = (if (family == "ipv6") PING6_BINARIES else PING_BINARIES)
            .firstOrNull { File(it).canExecute() }
            ?: throw PingUnavailableException("ping binary not found")
        val waitSeconds = ceil(timeoutMs / 1000.0).toInt().coerceIn(1, 30)
        val command = buildList {
            addAll(listOf(binary, "-n", "-c", "1", "-W", waitSeconds.toString()))
            if (ttl > 0) addAll(listOf("-t", ttl.coerceIn(1, 255).toString()))
            add(address.hostAddress.orEmpty())
        }
        val process = try {
            ProcessBuilder(command).start()
        } catch (error: IOException) {
            throw PingUnavailableException(error.message ?: "ping could not be started", error)
        }
        try {
            if (!process.waitFor(waitSeconds + 3L, TimeUnit.SECONDS)) {
                return PingReply("timeout")
            }
            val stdout = process.inputStream.bufferedReader().readText()
            val stderr = process.errorStream.bufferedReader().readText()
            val reply = PingParser.parse(stdout)
            if (reply.status == "timeout" && stdout.isBlank() && PingParser.isUnsupported(stderr)) {
                throw PingUnavailableException(stderr.trim())
            }
            return reply
        } finally {
            process.destroy()
        }
    }

    /** Connect time to the first port that answers; a refused connection still proves the host replied. */
    private fun tcpPing(address: InetAddress, timeoutMs: Int): PingReply {
        for (port in FALLBACK_PORTS) {
            val started = System.nanoTime()
            try {
                Socket().use { it.connect(InetSocketAddress(address, port), timeoutMs) }
                return PingReply("reply", rttMs = elapsedMs(started), from = address.hostAddress)
            } catch (error: SocketTimeoutException) {
                return PingReply("timeout")
            } catch (error: ConnectException) {
                if ("ECONNREFUSED" in error.message.orEmpty()) {
                    return PingReply("reply", rttMs = elapsedMs(started), from = address.hostAddress)
                }
            } catch (error: NoRouteToHostException) {
                return PingReply("unreachable")
            }
        }
        return PingReply("timeout")
    }

    private fun elapsedMs(startedNanos: Long): Double =
        Math.round((System.nanoTime() - startedNanos) / 10_000.0) / 100.0

    private class PingUnavailableException(message: String, cause: Throwable? = null) :
        IOException(message, cause)
}
