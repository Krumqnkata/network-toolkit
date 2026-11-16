package io.github.krumqnkata.networktoolkit.bluetooth

import java.util.UUID

/** Pure helpers for Bluetooth scan data, unit-tested on the JVM. */
object BluetoothFormat {
    /** Bluetooth Base UUID suffix: xxxxxxxx-0000-1000-8000-00805F9B34FB. */
    private const val BASE_SUFFIX = "-0000-1000-8000-00805f9b34fb"

    /** 16-bit assigned number of a UUID built on the Bluetooth Base UUID, or null. */
    fun shortUuid(uuid: UUID): Int? {
        val text = uuid.toString().lowercase()
        if (!text.endsWith(BASE_SUFFIX)) return null
        val value = text.substring(0, 8).toLongOrNull(16) ?: return null
        return if (value in 0..0xFFFF) value.toInt() else null
    }

    /** Keeps the last `max` RSSI readings. */
    fun appendRssi(history: List<Int>, rssi: Int, max: Int = 30): List<Int> = (history + rssi).takeLast(max)

    /** Android reports 127 (TX_POWER_NOT_PRESENT) or Int.MIN_VALUE when unknown. */
    fun txPowerOrNull(value: Int): Int? = if (value in -127..126) value else null
}
