package io.github.krumqnkata.networktoolkit.tools

import android.net.http.X509TrustManagerExtensions
import java.net.InetSocketAddress
import java.net.Socket
import java.security.KeyStore
import java.security.MessageDigest
import java.security.cert.CertificateException
import java.security.cert.X509Certificate
import java.security.interfaces.ECPublicKey
import java.security.interfaces.RSAPublicKey
import javax.net.ssl.HttpsURLConnection
import javax.net.ssl.SNIHostName
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLSocket
import javax.net.ssl.TrustManagerFactory
import javax.net.ssl.X509TrustManager

data class CertificateInfo(
    val subject: String,
    val issuer: String,
    val serialNumber: String,
    val notBefore: Long,
    val notAfter: Long,
    val signatureAlgorithm: String,
    val publicKeyAlgorithm: String,
    val publicKeyBits: Int?,
    val subjectAltNames: List<String>,
    val isCa: Boolean,
    val sha256: String,
)

data class TlsResult(
    val address: String,
    val protocol: String,
    val cipherSuite: String,
    val handshakeMs: Double,
    /** Chain validated against the device's trusted CAs (and network security config). */
    val trusted: Boolean,
    val trustError: String?,
    val hostnameMatches: Boolean,
    val chain: List<CertificateInfo>,
)

/**
 * Performs a TLS handshake and reports the server's certificate chain.
 *
 * To be able to show expired, self-signed or mismatched certificates, the
 * handshake uses a trust manager that records the platform's verdict instead
 * of aborting. The connection is closed right after the handshake: no
 * application data is ever sent over it, so accepting the chain cannot leak
 * anything. Normal app traffic keeps using the default, strict trust manager.
 */
object TlsInspector {
    fun inspect(host: String, port: Int, timeoutMs: Int): TlsResult {
        HostInput.requirePort(port)
        val normalized = HostInput.normalizeHost(host)
        val address = AddressResolver.resolve(normalized, "any")
        val recorder = RecordingTrustManager(defaultTrustManager(), normalized)
        val context = SSLContext.getInstance("TLS").apply { init(null, arrayOf(recorder), null) }

        val started = System.nanoTime()
        val raw = Socket()
        try {
            raw.connect(InetSocketAddress(address, port), timeoutMs)
            raw.soTimeout = timeoutMs
        } catch (error: Exception) {
            raw.close()
            throw error
        }
        (context.socketFactory.createSocket(raw, normalized, port, true) as SSLSocket).use { socket ->
            if (!HostInput.isIpLiteral(normalized)) {
                socket.sslParameters = socket.sslParameters.apply { serverNames = listOf(SNIHostName(normalized)) }
            }
            socket.startHandshake()
            val handshakeMs = Math.round((System.nanoTime() - started) / 10_000.0) / 100.0
            val session = socket.session
            val chain = session.peerCertificates.filterIsInstance<X509Certificate>()
            return TlsResult(
                address = address.hostAddress.orEmpty(),
                protocol = session.protocol,
                cipherSuite = session.cipherSuite,
                handshakeMs = handshakeMs,
                trusted = recorder.error == null,
                trustError = recorder.error,
                hostnameMatches = HttpsURLConnection.getDefaultHostnameVerifier().verify(normalized, session),
                chain = chain.map(::describe),
            )
        }
    }

    private fun defaultTrustManager(): X509TrustManager {
        val factory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm())
        factory.init(null as KeyStore?)
        return factory.trustManagers.filterIsInstance<X509TrustManager>().first()
    }

    private fun describe(cert: X509Certificate): CertificateInfo {
        val key = cert.publicKey
        val bits = when (key) {
            is RSAPublicKey -> key.modulus.bitLength()
            is ECPublicKey -> key.params.order.bitLength()
            else -> null
        }
        val sans = cert.subjectAlternativeNames.orEmpty().mapNotNull { entry ->
            val type = entry.getOrNull(0) as? Int
            val value = entry.getOrNull(1) as? String
            when (type) {
                SAN_DNS -> value?.let { "DNS:$it" }
                SAN_IP -> value?.let { "IP:$it" }
                else -> null
            }
        }
        return CertificateInfo(
            subject = cert.subjectX500Principal.name,
            issuer = cert.issuerX500Principal.name,
            serialNumber = cert.serialNumber.toString(16).uppercase(),
            notBefore = cert.notBefore.time,
            notAfter = cert.notAfter.time,
            signatureAlgorithm = cert.sigAlgName,
            publicKeyAlgorithm = key.algorithm,
            publicKeyBits = bits,
            subjectAltNames = sans,
            isCa = cert.basicConstraints >= 0,
            sha256 = MessageDigest.getInstance("SHA-256").digest(cert.encoded)
                .joinToString(":") { "%02X".format(it.toInt() and 0xFF) },
        )
    }

    private const val SAN_DNS = 2
    private const val SAN_IP = 7

    /** Records whether the platform trusts the chain; never aborts the handshake itself. */
    private class RecordingTrustManager(
        private val delegate: X509TrustManager,
        private val host: String,
    ) : X509TrustManager {
        @Volatile var error: String? = "Certificate was not checked"

        override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String) {
            error = try {
                X509TrustManagerExtensions(delegate).checkServerTrusted(chain, authType, host)
                null
            } catch (exception: CertificateException) {
                exception.message ?: exception.javaClass.simpleName
            }
        }

        override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String) {
            throw CertificateException("Client certificates are not supported")
        }

        override fun getAcceptedIssuers(): Array<X509Certificate> = delegate.acceptedIssuers
    }
}
