package io.github.krumqnkata.networktoolkit.tools

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import io.github.krumqnkata.networktoolkit.specs.NativeNetToolsModuleSpec
import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Turbo Native Module for the diagnostic tools (ping, traceroute hops, DNS,
 * TCP connect, HTTP and TLS inspection). Each call is one bounded probe; the
 * TypeScript side schedules repeats and owns cancellation.
 */
class NetToolsModule(reactContext: ReactApplicationContext) : NativeNetToolsModuleSpec(reactContext) {
    private val executor: ExecutorService = Executors.newFixedThreadPool(4) { runnable ->
        Thread(runnable, "NetToolsModule").apply { isDaemon = true }
    }
    private val dns = DnsClient(reactContext)

    override fun getName(): String = NAME

    override fun ping(host: String, family: String, ttl: Double, timeoutMs: Double, promise: Promise) =
        execute(promise) {
            val result = Probes.ping(host, family, ttl.toInt(), timeout(timeoutMs))
            Arguments.createMap().apply {
                putString("address", result.address)
                putString("family", result.family)
                putString("method", result.method)
                putString("status", result.reply.status)
                putNullableDouble("rttMs", result.reply.rttMs)
                putNullableInt("ttl", result.reply.ttl)
                putString("from", result.reply.from)
            }
        }

    override fun dnsQuery(name: String, recordType: Double, server: String, timeoutMs: Double, promise: Promise) =
        execute(promise) {
            val result = dns.query(name, recordType.toInt(), server, timeout(timeoutMs))
            Arguments.createMap().apply {
                putString("server", result.server)
                putDouble("durationMs", result.durationMs)
                putInt("rcode", result.response.rcode)
                putBoolean("authoritative", result.response.authoritative)
                putBoolean("truncated", result.response.truncated)
                putArray("answers", records(result.response.answers))
                putArray("authority", records(result.response.authority))
            }
        }

    override fun tcpConnect(host: String, port: Double, family: String, timeoutMs: Double, promise: Promise) =
        execute(promise) {
            val result = Probes.tcpConnect(host, port.toInt(), family, timeout(timeoutMs))
            Arguments.createMap().apply {
                putString("address", result.address)
                putString("family", result.family)
                putString("status", result.status)
                putNullableDouble("connectMs", result.connectMs)
                putString("message", result.message)
            }
        }

    override fun httpRequest(url: String, method: String, maxRedirects: Double, timeoutMs: Double, promise: Promise) =
        execute(promise) {
            val hops = HttpInspector.inspect(url, method, maxRedirects.toInt(), timeout(timeoutMs))
            Arguments.createMap().apply {
                putArray(
                    "hops",
                    Arguments.createArray().apply {
                        hops.forEach { hop ->
                            pushMap(
                                Arguments.createMap().apply {
                                    putString("url", hop.url)
                                    putInt("status", hop.status)
                                    putString("statusText", hop.statusText)
                                    putString("protocol", hop.protocol)
                                    putString("cipherSuite", hop.cipherSuite)
                                    putDouble("durationMs", hop.durationMs)
                                    putArray(
                                        "headers",
                                        Arguments.createArray().apply {
                                            hop.headers.forEach { (key, value) ->
                                                pushMap(
                                                    Arguments.createMap().apply {
                                                        putString("name", key)
                                                        putString("value", value)
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

    override fun tlsInspect(host: String, port: Double, timeoutMs: Double, promise: Promise) =
        execute(promise) {
            val result = TlsInspector.inspect(host, port.toInt(), timeout(timeoutMs))
            Arguments.createMap().apply {
                putString("address", result.address)
                putString("protocol", result.protocol)
                putString("cipherSuite", result.cipherSuite)
                putDouble("handshakeMs", result.handshakeMs)
                putBoolean("trusted", result.trusted)
                putString("trustError", result.trustError)
                putBoolean("hostnameMatches", result.hostnameMatches)
                putArray(
                    "chain",
                    Arguments.createArray().apply {
                        result.chain.forEach { cert ->
                            pushMap(
                                Arguments.createMap().apply {
                                    putString("subject", cert.subject)
                                    putString("issuer", cert.issuer)
                                    putString("serialNumber", cert.serialNumber)
                                    putDouble("notBefore", cert.notBefore.toDouble())
                                    putDouble("notAfter", cert.notAfter.toDouble())
                                    putString("signatureAlgorithm", cert.signatureAlgorithm)
                                    putString("publicKeyAlgorithm", cert.publicKeyAlgorithm)
                                    putNullableInt("publicKeyBits", cert.publicKeyBits)
                                    putArray(
                                        "subjectAltNames",
                                        Arguments.createArray().apply { cert.subjectAltNames.forEach { pushString(it) } },
                                    )
                                    putBoolean("isCa", cert.isCa)
                                    putString("sha256", cert.sha256)
                                },
                            )
                        }
                    },
                )
            }
        }

    private fun records(list: List<DnsRecord>): WritableArray =
        Arguments.createArray().apply {
            list.forEach { record ->
                pushMap(
                    Arguments.createMap().apply {
                        putString("name", record.name)
                        putInt("type", record.type)
                        putDouble("ttl", record.ttl.toDouble())
                        putString("data", record.data)
                    },
                )
            }
        }

    private fun timeout(value: Double): Int = value.toInt().coerceIn(MIN_TIMEOUT_MS, MAX_TIMEOUT_MS)

    private fun execute(promise: Promise, block: () -> WritableMap) {
        executor.execute {
            try {
                promise.resolve(block())
            } catch (error: IllegalArgumentException) {
                promise.reject("E_INVALID_INPUT", error.message ?: "Invalid input", error)
            } catch (error: UnsupportedOperationException) {
                promise.reject("E_UNSUPPORTED", error.message ?: "Not supported on this device", error)
            } catch (error: UnknownHostException) {
                promise.reject("E_UNKNOWN_HOST", error.message ?: "Host not found", error)
            } catch (error: SocketTimeoutException) {
                promise.reject("E_TIMEOUT", error.message ?: "Timed out", error)
            } catch (error: SecurityException) {
                promise.reject("E_PERMISSION", error.message ?: "Permission denied", error)
            } catch (error: IOException) {
                promise.reject("E_NETWORK", error.message ?: "Network error", error)
            } catch (error: Exception) {
                promise.reject("E_TOOL", error.message ?: "Tool failed", error)
            }
        }
    }

    override fun invalidate() {
        executor.shutdownNow()
        dns.shutdown()
        super.invalidate()
    }

    companion object {
        const val NAME = "NativeNetToolsModule"
        private const val MIN_TIMEOUT_MS = 500
        private const val MAX_TIMEOUT_MS = 30_000
    }
}

private fun WritableMap.putNullableDouble(key: String, value: Double?) {
    if (value == null) putNull(key) else putDouble(key, value)
}

private fun WritableMap.putNullableInt(key: String, value: Int?) {
    if (value == null) putNull(key) else putInt(key, value)
}
