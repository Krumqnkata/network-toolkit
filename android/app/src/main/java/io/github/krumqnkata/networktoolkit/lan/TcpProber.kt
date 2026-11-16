package io.github.krumqnkata.networktoolkit.lan

import io.github.krumqnkata.networktoolkit.tools.Probes
import java.io.IOException
import java.net.ConnectException
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.NoRouteToHostException
import java.nio.channels.SelectionKey
import java.nio.channels.Selector
import java.nio.channels.SocketChannel
import java.util.concurrent.Callable
import java.util.concurrent.ExecutorService
import java.util.concurrent.TimeUnit

data class ConnectOutcome(
    /** `open`, `refused`, `timeout` or `unreachable`. */
    val status: String,
    val connectMs: Double?,
)

data class HostProbe(
    val address: String,
    val alive: Boolean,
    /** `tcp`, `icmp` or null when the host did not answer. */
    val method: String?,
    val rttMs: Double?,
    val openPorts: List<Int>,
)

/**
 * Non-blocking TCP connects with one selector, so hundreds of host/port pairs
 * can be tried at once with a single timeout. A refused connection (RST)
 * proves that a host is up just as well as an accepted one.
 */
object TcpProber {
    const val MAX_TARGETS = 512

    fun connectAll(targets: List<InetSocketAddress>, timeoutMs: Int): List<ConnectOutcome> {
        require(targets.size <= MAX_TARGETS) { "Too many targets in one batch" }
        val results = arrayOfNulls<ConnectOutcome>(targets.size)
        val started = System.nanoTime()
        val elapsed = { Math.round((System.nanoTime() - started) / 10_000.0) / 100.0 }
        val channels = ArrayList<SocketChannel>(targets.size)
        Selector.open().use { selector ->
            try {
                var pending = 0
                targets.forEachIndexed { index, target ->
                    try {
                        val channel = SocketChannel.open()
                        channels += channel
                        channel.configureBlocking(false)
                        if (channel.connect(target)) {
                            results[index] = ConnectOutcome("open", elapsed())
                        } else {
                            channel.register(selector, SelectionKey.OP_CONNECT, index)
                            pending++
                        }
                    } catch (error: IOException) {
                        results[index] = classify(error, elapsed())
                    }
                }
                val deadline = started + timeoutMs * 1_000_000L
                while (pending > 0) {
                    val remaining = (deadline - System.nanoTime()) / 1_000_000L
                    if (remaining <= 0) break
                    if (selector.select(remaining) == 0) continue
                    val keys = selector.selectedKeys().iterator()
                    while (keys.hasNext()) {
                        val key = keys.next()
                        keys.remove()
                        val index = key.attachment() as Int
                        val channel = key.channel() as SocketChannel
                        results[index] = try {
                            if (channel.finishConnect()) ConnectOutcome("open", elapsed()) else continue
                        } catch (error: IOException) {
                            classify(error, elapsed())
                        }
                        key.cancel()
                        pending--
                    }
                }
            } finally {
                channels.forEach { runCatching { it.close() } }
            }
        }
        return results.map { it ?: ConnectOutcome("timeout", null) }
    }

    /**
     * Checks which hosts are up: TCP connects to `ports` on every host at once,
     * then, for hosts that did not answer, one ICMP echo each (in parallel).
     */
    fun probeHosts(
        hosts: List<InetAddress>,
        ports: List<Int>,
        timeoutMs: Int,
        icmp: Boolean,
        executor: ExecutorService,
    ): List<HostProbe> {
        val targets = hosts.flatMap { host -> ports.map { InetSocketAddress(host, it) } }
        val outcomes = if (targets.isEmpty()) emptyList() else connectAll(targets, timeoutMs)
        val byHost = hosts.mapIndexed { hostIndex, host ->
            val slice = outcomes.subList(hostIndex * ports.size, (hostIndex + 1) * ports.size)
            val answered = slice.withIndex().filter { it.value.status == "open" || it.value.status == "refused" }
            HostProbe(
                address = host.hostAddress.orEmpty(),
                alive = answered.isNotEmpty(),
                method = if (answered.isNotEmpty()) "tcp" else null,
                rttMs = answered.mapNotNull { it.value.connectMs }.minOrNull(),
                openPorts = slice.withIndex().filter { it.value.status == "open" }.map { ports[it.index] },
            )
        }
        if (!icmp) return byHost
        val silent = byHost.withIndex().filter { !it.value.alive }
        val echoes = executor.invokeAll(
            silent.map { entry -> Callable { Probes.icmpEcho(hosts[entry.index], ICMP_TIMEOUT_MS) } },
            (ICMP_TIMEOUT_MS + 5_000).toLong(),
            TimeUnit.MILLISECONDS,
        )
        val result = byHost.toMutableList()
        silent.forEachIndexed { position, entry ->
            val reply = runCatching { echoes[position].get() }.getOrNull()
            if (reply?.status == "reply") {
                result[entry.index] = entry.value.copy(alive = true, method = "icmp", rttMs = reply.rttMs)
            }
        }
        return result
    }

    private const val ICMP_TIMEOUT_MS = 1000

    private fun classify(error: IOException, elapsedMs: Double): ConnectOutcome {
        val text = error.message.orEmpty()
        return when {
            error is ConnectException && ("ECONNREFUSED" in text || "refused" in text.lowercase()) ->
                ConnectOutcome("refused", elapsedMs)
            error is NoRouteToHostException || "EHOSTUNREACH" in text || "ENETUNREACH" in text ->
                ConnectOutcome("unreachable", null)
            else -> ConnectOutcome("unreachable", null)
        }
    }
}
