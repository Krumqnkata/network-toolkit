package io.github.krumqnkata.networktoolkit.network

import java.net.Inet6Address
import java.net.InetAddress

/**
 * Pure helpers that normalize the raw values Android returns. Kept free of
 * Android types so they can be unit-tested on the JVM.
 */
object NetworkFormat {
    /** Returned by WifiInfo.getSSID() when the SSID is unknown or redacted. */
    const val UNKNOWN_SSID = "<unknown ssid>"

    /** Returned by WifiInfo.getBSSID() when the caller lacks location access. */
    const val REDACTED_BSSID = "02:00:00:00:00:00"

    /** WifiInfo.INVALID_RSSI. */
    const val INVALID_RSSI = -127

    /**
     * WifiInfo.getSSID() returns UTF-8 SSIDs wrapped in double quotes and
     * non-UTF-8 SSIDs as bare hex. Returns null when the SSID is not available.
     */
    fun normalizeSsid(raw: String?): String? {
        if (raw.isNullOrBlank() || raw == UNKNOWN_SSID) return null
        if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
            return raw.substring(1, raw.length - 1).ifEmpty { null }
        }
        return raw
    }

    fun normalizeBssid(raw: String?): String? {
        if (raw.isNullOrBlank()) return null
        val value = raw.lowercase()
        return if (value == REDACTED_BSSID || value == "00:00:00:00:00:00") null else value
    }

    fun normalizeRssi(rssi: Int): Int? = if (rssi <= INVALID_RSSI || rssi >= 0) null else rssi

    fun positiveOrNull(value: Int): Int? = if (value > 0) value else null

    /** Host address without an IPv6 zone suffix (e.g. "fe80::1%wlan0" → "fe80::1"). */
    fun hostAddress(address: InetAddress): String = (address.hostAddress ?: "").substringBefore('%')

    fun isUnspecified(address: InetAddress?): Boolean = address == null || address.isAnyLocalAddress

    fun ipv6Scope(address: Inet6Address): String =
        when {
            address.isLoopbackAddress -> "loopback"
            address.isLinkLocalAddress -> "link-local"
            (address.address[0].toInt() and 0xfe) == 0xfc -> "unique-local"
            else -> "global"
        }
}
