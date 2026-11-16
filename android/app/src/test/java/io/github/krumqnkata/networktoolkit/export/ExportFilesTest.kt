package io.github.krumqnkata.networktoolkit.export

import org.junit.Assert.assertEquals
import org.junit.Test

class ExportFilesTest {
    @Test
    fun `keeps safe names and maps their type`() {
        assertEquals("network-map_2026-11-16.png", ExportFiles.safeName("network-map_2026-11-16.png"))
        assertEquals("image/png", ExportFiles.mimeType("map.PNG"))
        assertEquals("image/svg+xml", ExportFiles.mimeType("map.svg"))
    }

    @Test
    fun `replaces path separators and hidden prefixes`() {
        assertEquals("_.._etc_passwd.txt", ExportFiles.safeName("/../etc/passwd.txt"))
        assertEquals("report.json", ExportFiles.safeName("..report.json"))
    }

    @Test(expected = IllegalArgumentException::class)
    fun `rejects unknown types`() {
        ExportFiles.safeName("app.apk")
    }

    @Test(expected = IllegalArgumentException::class)
    fun `rejects empty names`() {
        ExportFiles.safeName("   ")
    }
}
