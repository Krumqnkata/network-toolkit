package io.github.krumqnkata.networktoolkit.lan

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.net.InetAddress
import java.net.ServerSocket
import kotlin.concurrent.thread

class BannerReaderTest {
    @Test
    fun `allows only local addresses`() {
        assertTrue(BannerReader.isLocal(InetAddress.getByName("192.168.1.10")))
        assertTrue(BannerReader.isLocal(InetAddress.getByName("10.0.0.1")))
        assertTrue(BannerReader.isLocal(InetAddress.getByName("fe80::1")))
        assertTrue(BannerReader.isLocal(InetAddress.getByName("fd00::1")))
        assertFalse(BannerReader.isLocal(InetAddress.getByName("1.1.1.1")))
        assertFalse(BannerReader.isLocal(InetAddress.getByName("2001:db8::1")))
    }

    @Test
    fun `removes control characters but keeps line breaks`() {
        val bytes = "SSH-2.0-OpenSSH_9.6\u0000\u001b[0m\r\n".toByteArray(Charsets.UTF_8)
        assertEquals("SSH-2.0-OpenSSH_9.6[0m\r\n", BannerReader.sanitize(bytes))
    }

    @Test
    fun `reads a greeting line from a local server`() {
        ServerSocket(0, 1, InetAddress.getLoopbackAddress()).use { server ->
            thread {
                server.accept().use { client ->
                    client.getOutputStream().write("SSH-2.0-dropbear_2022.83\r\n".toByteArray())
                    client.getOutputStream().flush()
                    Thread.sleep(200)
                }
            }
            val banner = BannerReader.read(InetAddress.getLoopbackAddress(), server.localPort, "", 256, 2_000)
            assertEquals("SSH-2.0-dropbear_2022.83\r\n", banner.text)
            assertEquals(26, banner.bytes)
        }
    }

    @Test
    fun `sends the request and reads the reply`() {
        ServerSocket(0, 1, InetAddress.getLoopbackAddress()).use { server ->
            thread {
                server.accept().use { client ->
                    val request = client.getInputStream().bufferedReader().readLine()
                    val body = "HTTP/1.0 200 OK\r\nServer: test\r\n\r\n<title>$request</title>"
                    client.getOutputStream().write(body.toByteArray())
                }
            }
            val banner = BannerReader.read(
                InetAddress.getLoopbackAddress(),
                server.localPort,
                "GET / HTTP/1.0\r\n\r\n",
                4_096,
                2_000,
            )
            assertTrue(banner.text.startsWith("HTTP/1.0 200 OK"))
            assertTrue(banner.text.endsWith("<title>GET / HTTP/1.0</title>"))
        }
    }
}
