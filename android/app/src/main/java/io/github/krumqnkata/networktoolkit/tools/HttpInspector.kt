package io.github.krumqnkata.networktoolkit.tools

import java.net.HttpURLConnection
import java.net.URL
import javax.net.ssl.HttpsURLConnection

data class HttpHop(
    val url: String,
    val status: Int,
    val statusText: String,
    /** `http/1.1`, `h2`, … as negotiated by Android's HTTP stack, when it reports it. */
    val protocol: String?,
    val cipherSuite: String?,
    val durationMs: Double,
    val headers: List<Pair<String, String>>,
)

/**
 * Sends a HEAD or GET request and follows redirects manually so that every
 * hop, its status and its headers can be shown. Response bodies are never read.
 * No cookies, credentials or caches are used.
 */
object HttpInspector {
    private const val USER_AGENT = "NetworkToolkit (Android; +https://github.com/Krumqnkata/network-toolkit)"
    private const val ANDROID_HEADER_PREFIX = "x-android-"
    private val METHODS = setOf("HEAD", "GET")

    fun inspect(rawUrl: String, method: String, maxRedirects: Int, timeoutMs: Int): List<HttpHop> {
        require(method in METHODS) { "Unsupported method" }
        var url = parseUrl(rawUrl)
        val hops = mutableListOf<HttpHop>()
        while (true) {
            val hop = request(url, method, timeoutMs)
            hops += hop
            val location = hop.headers.firstOrNull { it.first.equals("Location", ignoreCase = true) }?.second
            if (hop.status !in 300..399 || location == null || hops.size > maxRedirects.coerceIn(0, 20)) {
                return hops
            }
            url = parseUrl(URL(url, location).toString())
        }
    }

    fun parseUrl(raw: String): URL {
        val trimmed = raw.trim()
        require(trimmed.isNotEmpty()) { "Enter a URL" }
        val url = try {
            URL(trimmed)
        } catch (error: java.net.MalformedURLException) {
            throw IllegalArgumentException("Invalid URL: $raw", error)
        }
        require(url.protocol == "http" || url.protocol == "https") { "Only http and https URLs are supported" }
        HostInput.normalizeHost(url.host)
        return url
    }

    private fun request(url: URL, method: String, timeoutMs: Int): HttpHop {
        val connection = url.openConnection() as HttpURLConnection
        val started = System.nanoTime()
        try {
            connection.instanceFollowRedirects = false
            connection.useCaches = false
            connection.connectTimeout = timeoutMs
            connection.readTimeout = timeoutMs
            connection.requestMethod = method
            connection.setRequestProperty("User-Agent", USER_AGENT)
            connection.setRequestProperty("Accept", "*/*")
            val status = connection.responseCode
            val duration = Math.round((System.nanoTime() - started) / 10_000.0) / 100.0
            val headers = mutableListOf<Pair<String, String>>()
            var protocol: String? = null
            var index = 0
            while (true) {
                val value = connection.getHeaderField(index) ?: break
                val key = connection.getHeaderFieldKey(index)
                index++
                if (key == null) continue // status line
                if (key.lowercase().startsWith(ANDROID_HEADER_PREFIX)) {
                    if (key.equals("X-Android-Selected-Protocol", ignoreCase = true)) protocol = value
                    continue
                }
                headers += key to value
            }
            return HttpHop(
                url = url.toString(),
                status = status,
                statusText = connection.responseMessage.orEmpty(),
                protocol = protocol,
                cipherSuite = (connection as? HttpsURLConnection)?.cipherSuite,
                durationMs = duration,
                headers = headers,
            )
        } finally {
            connection.disconnect()
        }
    }
}
