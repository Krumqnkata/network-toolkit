package io.github.krumqnkata.networktoolkit.update

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UpdateRulesTest {
    private val base = UpdateRules.RELEASE_PREFIX

    @Test
    fun `allows only APKs from this repository's releases`() {
        assertTrue(UpdateRules.isAllowedUrl("${base}v1.0.0/NetworkToolkit-v1.0.0-arm64-v8a.apk"))
        assertTrue(UpdateRules.isAllowedUrl("${base}v1.0.0-rc.3/NetworkToolkit-v1.0.0-rc.3.apk"))
        assertTrue(UpdateRules.isAllowedUrl("${base}v1.0.0/NetworkToolkit-v1.0.0-x86_64.apk"))
        assertTrue(UpdateRules.isAllowedUrl("${base}v1.0.0/NetworkToolkit-v1.0.0-armeabi-v7a.apk"))
        assertFalse(UpdateRules.isAllowedUrl("http://github.com/Krumqnkata/network-toolkit/releases/download/v1/NetworkToolkit-v1.apk"))
        assertFalse(UpdateRules.isAllowedUrl("https://github.com/someone/else/releases/download/v1/NetworkToolkit-v1.0.0.apk"))
        assertFalse(UpdateRules.isAllowedUrl("${base}v1.0.0/../../x/NetworkToolkit-v1.0.0.apk"))
        assertFalse(UpdateRules.isAllowedUrl("${base}v1.0.0/NetworkToolkit-v1.0.0.aab"))
        assertFalse(UpdateRules.isAllowedUrl("${base}v1.0.0/other.apk"))
    }

    @Test
    fun `validates file names and checksums`() {
        assertTrue(UpdateRules.isValidFileName("NetworkToolkit-v1.0.0-x86_64.apk"))
        assertFalse(UpdateRules.isValidFileName("../NetworkToolkit-v1.0.0.apk"))
        assertTrue(UpdateRules.isValidSha256("a".repeat(64)))
        assertFalse(UpdateRules.isValidSha256("A".repeat(64)))
        assertFalse(UpdateRules.isValidSha256("abc"))
    }

    @Test
    fun `hashes and compares signers`() {
        assertEquals(
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            UpdateRules.sha256(ByteArray(0)),
        )
        assertTrue(UpdateRules.sameSigners(setOf("a"), setOf("a")))
        assertFalse(UpdateRules.sameSigners(setOf("a"), setOf("b")))
        assertFalse(UpdateRules.sameSigners(emptySet(), emptySet()))
    }
}
