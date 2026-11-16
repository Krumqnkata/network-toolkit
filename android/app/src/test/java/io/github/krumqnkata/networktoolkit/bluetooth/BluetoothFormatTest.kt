package io.github.krumqnkata.networktoolkit.bluetooth

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.util.UUID

class BluetoothFormatTest {
    @Test
    fun `extracts 16-bit assigned numbers from base UUIDs`() {
        assertEquals(0x180D, BluetoothFormat.shortUuid(UUID.fromString("0000180d-0000-1000-8000-00805f9b34fb")))
        assertEquals(0xFE2C, BluetoothFormat.shortUuid(UUID.fromString("0000FE2C-0000-1000-8000-00805F9B34FB")))
        assertNull(BluetoothFormat.shortUuid(UUID.fromString("0001180d-0000-1000-8000-00805f9b34fb")))
        assertNull(BluetoothFormat.shortUuid(UUID.fromString("6e400001-b5a3-f393-e0a9-e50e24dcca9e")))
    }

    @Test
    fun `keeps a bounded RSSI history`() {
        val history = (1..40).fold(emptyList<Int>()) { acc, value -> BluetoothFormat.appendRssi(acc, -value) }
        assertEquals(30, history.size)
        assertEquals(-40, history.last())
        assertEquals(-11, history.first())
    }

    @Test
    fun `treats unknown TX power as missing`() {
        assertEquals(-59, BluetoothFormat.txPowerOrNull(-59))
        assertNull(BluetoothFormat.txPowerOrNull(127))
        assertNull(BluetoothFormat.txPowerOrNull(Int.MIN_VALUE))
    }
}
