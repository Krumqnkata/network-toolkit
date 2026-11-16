package io.github.krumqnkata.networktoolkit.update

import java.security.MessageDigest

/** Pure rules of the self-updater, unit-tested on the JVM. */
object UpdateRules {
    /** Updates are only downloaded from this repository's GitHub releases. */
    const val RELEASE_PREFIX = "https://github.com/Krumqnkata/network-toolkit/releases/download/"

    // ABI suffixes include underscores (x86_64).
    private val FILE_NAME = Regex("^NetworkToolkit-v[0-9A-Za-z._+-]+\\.apk$")
    private val SHA256 = Regex("^[0-9a-f]{64}$")

    fun isAllowedUrl(url: String): Boolean =
        url.startsWith(RELEASE_PREFIX) && !url.contains("..") && url.substringAfterLast('/').let(FILE_NAME::matches)

    fun isValidFileName(name: String): Boolean = FILE_NAME.matches(name)

    fun isValidSha256(hex: String): Boolean = SHA256.matches(hex)

    fun hex(bytes: ByteArray): String = bytes.joinToString("") { "%02x".format(it.toInt() and 0xFF) }

    fun sha256(bytes: ByteArray): String = hex(MessageDigest.getInstance("SHA-256").digest(bytes))

    /** True when both sets of signing certificates are identical (and non-empty). */
    fun sameSigners(installed: Set<String>, candidate: Set<String>): Boolean =
        installed.isNotEmpty() && installed == candidate
}
