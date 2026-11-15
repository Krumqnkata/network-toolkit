package io.github.krumqnkata.networktoolkit.wifi

/** Pure helpers for ScanResult values, unit-tested on the JVM. */
object ScanFormat {
    /**
     * Maps ScanResult.CHANNEL_WIDTH_* to MHz. 80+80 MHz is reported as 160
     * (two 80 MHz segments; the second segment center is centerFreq1).
     */
    fun channelWidthMhz(code: Int): Int? =
        when (code) {
            0 -> 20 // CHANNEL_WIDTH_20MHZ
            1 -> 40 // CHANNEL_WIDTH_40MHZ
            2 -> 80 // CHANNEL_WIDTH_80MHZ
            3 -> 160 // CHANNEL_WIDTH_160MHZ
            4 -> 160 // CHANNEL_WIDTH_80MHZ_PLUS_MHZ
            5 -> 320 // CHANNEL_WIDTH_320MHZ (Android 13+)
            else -> null
        }

    fun isSplitChannel(code: Int): Boolean = code == 4

    /** Hidden networks report an empty SSID. */
    fun normalizeScanSsid(raw: String?): String? {
        if (raw.isNullOrEmpty() || raw == "<unknown ssid>") return null
        return if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
            raw.substring(1, raw.length - 1).ifEmpty { null }
        } else {
            raw
        }
    }

    /** Age of a result: ScanResult.timestamp is µs since boot. */
    fun ageMillis(nowElapsedMillis: Long, timestampMicros: Long): Long =
        ((nowElapsedMillis * 1000 - timestampMicros) / 1000).coerceAtLeast(0)
}
