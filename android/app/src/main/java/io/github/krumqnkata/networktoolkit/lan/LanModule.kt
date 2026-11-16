package io.github.krumqnkata.networktoolkit.lan

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import io.github.krumqnkata.networktoolkit.specs.NativeLanModuleSpec
import io.github.krumqnkata.networktoolkit.tools.AddressResolver
import io.github.krumqnkata.networktoolkit.tools.HostInput
import java.io.IOException
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Turbo Native Module for LAN discovery and port scanning. Every call handles
 * one bounded batch; the TypeScript side splits a scan into batches, reports
 * progress and can stop between them.
 */
class LanModule(reactContext: ReactApplicationContext) : NativeLanModuleSpec(reactContext) {
    private val executor: ExecutorService = Executors.newFixedThreadPool(3) { runnable ->
        Thread(runnable, "LanModule").apply { isDaemon = true }
    }
    private val icmpPool: ExecutorService = Executors.newFixedThreadPool(ICMP_PARALLELISM) { runnable ->
        Thread(runnable, "LanModule-icmp").apply { isDaemon = true }
    }

    override fun getName(): String = NAME

    override fun probeHosts(hosts: ReadableArray, ports: ReadableArray, timeoutMs: Double, icmp: Boolean, promise: Promise) =
        execute(promise) {
            val addresses = ipList(hosts, MAX_HOSTS)
            val portList = portList(ports)
            require(addresses.size * portList.size <= TcpProber.MAX_TARGETS) { "Batch too large" }
            val probes = TcpProber.probeHosts(addresses, portList, timeout(timeoutMs), icmp, icmpPool)
            Arguments.createMap().apply {
                putArray(
                    "hosts",
                    Arguments.createArray().apply {
                        probes.forEach { probe ->
                            pushMap(
                                Arguments.createMap().apply {
                                    putString("address", probe.address)
                                    putBoolean("alive", probe.alive)
                                    putString("method", probe.method)
                                    if (probe.rttMs == null) putNull("rttMs") else putDouble("rttMs", probe.rttMs)
                                    putArray(
                                        "openPorts",
                                        Arguments.createArray().apply { probe.openPorts.forEach { pushInt(it) } },
                                    )
                                },
                            )
                        }
                    },
                )
            }
        }

    override fun netbiosQuery(hosts: ReadableArray, timeoutMs: Double, promise: Promise) =
        execute(promise) {
            val infos = NetBios.query(ipList(hosts, MAX_HOSTS), timeout(timeoutMs))
            Arguments.createMap().apply {
                putArray(
                    "hosts",
                    Arguments.createArray().apply {
                        infos.forEach { info ->
                            pushMap(
                                Arguments.createMap().apply {
                                    putString("address", info.address)
                                    putString("name", info.name)
                                    putString("workgroup", info.workgroup)
                                    putString("mac", info.mac)
                                },
                            )
                        }
                    },
                )
            }
        }

    override fun mdnsQuery(
        localAddress: String,
        names: ReadableArray,
        types: ReadableArray,
        durationMs: Double,
        promise: Promise,
    ) = execute(promise) {
        require(names.size() == types.size()) { "names and types differ in length" }
        val questions = (0 until names.size()).map { names.getString(it).orEmpty() to types.getInt(it) }
        val replies = Multicast.mdns(requireIp(localAddress).hostAddress.orEmpty(), questions, timeout(durationMs))
        Arguments.createMap().apply {
            putArray(
                "replies",
                Arguments.createArray().apply {
                    replies.forEach { reply ->
                        pushMap(
                            Arguments.createMap().apply {
                                putString("from", reply.from)
                                putArray(
                                    "records",
                                    Arguments.createArray().apply {
                                        reply.records.forEach { record ->
                                            pushMap(
                                                Arguments.createMap().apply {
                                                    putString("name", record.name)
                                                    putInt("type", record.type)
                                                    putDouble("ttl", record.ttl.toDouble())
                                                    putString("data", record.data)
                                                },
                                            )
                                        }
                                    },
                                )
                            },
                        )
                    }
                },
            )
        }
    }

    override fun ssdpSearch(localAddress: String, durationMs: Double, promise: Promise) =
        execute(promise) {
            val replies = Multicast.ssdp(requireIp(localAddress).hostAddress.orEmpty(), timeout(durationMs))
            Arguments.createMap().apply {
                putArray(
                    "replies",
                    Arguments.createArray().apply {
                        replies.forEach { reply ->
                            pushMap(
                                Arguments.createMap().apply {
                                    putString("from", reply.from)
                                    putString("server", reply.headers["server"])
                                    putString("location", reply.headers["location"])
                                    putString("st", reply.headers["st"])
                                    putString("usn", reply.headers["usn"])
                                },
                            )
                        }
                    },
                )
            }
        }

    override fun scanPorts(host: String, ports: ReadableArray, timeoutMs: Double, promise: Promise) =
        execute(promise) {
            val address = AddressResolver.resolve(host, "any")
            val portList = portList(ports)
            require(portList.size <= TcpProber.MAX_TARGETS) { "Batch too large" }
            val outcomes = TcpProber.connectAll(portList.map { InetSocketAddress(address, it) }, timeout(timeoutMs))
            Arguments.createMap().apply {
                putString("address", address.hostAddress)
                putArray(
                    "ports",
                    Arguments.createArray().apply {
                        outcomes.forEachIndexed { index, outcome ->
                            pushMap(
                                Arguments.createMap().apply {
                                    putInt("port", portList[index])
                                    putString("status", outcome.status)
                                    if (outcome.connectMs == null) {
                                        putNull("connectMs")
                                    } else {
                                        putDouble("connectMs", outcome.connectMs)
                                    }
                                },
                            )
                        }
                    },
                )
            }
        }

    override fun readBanner(
        host: String,
        port: Double,
        payload: String,
        maxBytes: Double,
        timeoutMs: Double,
        promise: Promise,
    ) = execute(promise) {
        val banner = BannerReader.read(
            requireIp(host),
            HostInput.requirePort(port.toInt()),
            payload,
            maxBytes.toInt(),
            timeout(timeoutMs),
        )
        Arguments.createMap().apply {
            putString("address", banner.address)
            putInt("port", banner.port)
            putString("text", banner.text)
            putInt("bytes", banner.bytes)
            putDouble("connectMs", banner.connectMs)
        }
    }

    private fun requireIp(value: String): InetAddress {
        val trimmed = value.trim()
        require(HostInput.isIpLiteral(trimmed)) { "Not an IP address: $value" }
        return InetAddress.getByName(trimmed)
    }

    private fun ipList(array: ReadableArray, max: Int): List<InetAddress> {
        require(array.size() <= max) { "Too many hosts" }
        return (0 until array.size()).map { requireIp(array.getString(it).orEmpty()) }
    }

    private fun portList(array: ReadableArray): List<Int> =
        (0 until array.size()).map { HostInput.requirePort(array.getInt(it)) }

    private fun timeout(value: Double): Int = value.toInt().coerceIn(MIN_TIMEOUT_MS, MAX_TIMEOUT_MS)

    private fun execute(promise: Promise, block: () -> WritableMap) {
        executor.execute {
            try {
                promise.resolve(block())
            } catch (error: IllegalArgumentException) {
                promise.reject("E_INVALID_INPUT", error.message ?: "Invalid input", error)
            } catch (error: UnknownHostException) {
                promise.reject("E_UNKNOWN_HOST", error.message ?: "Host not found", error)
            } catch (error: SocketTimeoutException) {
                promise.reject("E_TIMEOUT", error.message ?: "Timed out", error)
            } catch (error: SecurityException) {
                promise.reject("E_PERMISSION", error.message ?: "Permission denied", error)
            } catch (error: IOException) {
                promise.reject("E_NETWORK", error.message ?: "Network error", error)
            } catch (error: Exception) {
                promise.reject("E_TOOL", error.message ?: "LAN scan failed", error)
            }
        }
    }

    override fun invalidate() {
        executor.shutdownNow()
        icmpPool.shutdownNow()
        super.invalidate()
    }

    companion object {
        const val NAME = "NativeLanModule"
        private const val MAX_HOSTS = 256
        private const val ICMP_PARALLELISM = 32
        private const val MIN_TIMEOUT_MS = 100
        private const val MAX_TIMEOUT_MS = 10_000
    }
}
