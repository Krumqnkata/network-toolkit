package io.github.krumqnkata.networktoolkit.bluetooth

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import android.os.Build
import android.os.SystemClock
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import io.github.krumqnkata.networktoolkit.specs.NativeBluetoothModuleSpec
import java.util.concurrent.ConcurrentHashMap

/**
 * Bluetooth Low Energy scanning for the Devices tab.
 *
 * Permissions: on Android 12+ BLUETOOTH_SCAN (declared with
 * `neverForLocation`, so Android filters some beacon-only adverts) and
 * BLUETOOTH_CONNECT for names of paired devices; on Android 8–11 scanning
 * requires precise location and location services. Results are kept in memory
 * only and cleared when a new scan starts.
 */
class BluetoothModule(reactContext: ReactApplicationContext) : NativeBluetoothModuleSpec(reactContext) {
    private val context = reactContext.applicationContext
    private val adapter: BluetoothAdapter? =
        context.getSystemService(BluetoothManager::class.java)?.adapter
    private val devices = ConcurrentHashMap<String, SeenDevice>()

    @Volatile private var scanning = false
    @Volatile private var scanError: String? = null
    @Volatile private var scanStartedAt = 0L

    private data class SeenDevice(
        val address: String,
        val name: String?,
        val rssi: Int,
        val txPower: Int?,
        val connectable: Boolean,
        val manufacturerIds: List<Int>,
        val serviceUuids: List<Int>,
        val firstSeen: Long,
        val lastSeen: Long,
        val history: List<Int>,
    )

    private val callback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) = record(result)

        override fun onBatchScanResults(results: MutableList<ScanResult>) = results.forEach(::record)

        override fun onScanFailed(errorCode: Int) {
            scanning = false
            scanError = when (errorCode) {
                SCAN_FAILED_ALREADY_STARTED -> "already-started"
                SCAN_FAILED_APPLICATION_REGISTRATION_FAILED -> "registration-failed"
                SCAN_FAILED_FEATURE_UNSUPPORTED -> "unsupported"
                else -> "error-$errorCode"
            }
        }
    }

    override fun getName(): String = NAME

    override fun getState(promise: Promise) {
        promise.resolve(
            Arguments.createMap().apply {
                putBoolean("supported", context.packageManager.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE) && adapter != null)
                putBoolean("enabled", adapter?.isEnabled == true)
                putBoolean("scanPermission", hasScanPermission())
                putBoolean("connectPermission", hasConnectPermission())
                putBoolean("needsLocation", Build.VERSION.SDK_INT < Build.VERSION_CODES.S)
                putBoolean("locationEnabled", isLocationEnabled())
                putBoolean("scanning", scanning)
            },
        )
    }

    @SuppressLint("MissingPermission") // Checked by hasScanPermission() right before.
    override fun startScan(promise: Promise) {
        val scanner = adapter?.bluetoothLeScanner
        when {
            adapter == null -> promise.reject("E_UNSUPPORTED", "This device has no Bluetooth")
            !adapter.isEnabled || scanner == null -> promise.reject("E_BLUETOOTH_OFF", "Bluetooth is turned off")
            !hasScanPermission() -> promise.reject("E_PERMISSION", "Bluetooth scan permission is required")
            Build.VERSION.SDK_INT < Build.VERSION_CODES.S && !isLocationEnabled() ->
                promise.reject("E_LOCATION_OFF", "Location services must be on to scan on this Android version")
            else -> try {
                if (scanning) scanner.stopScan(callback)
                devices.clear()
                scanError = null
                val settings = ScanSettings.Builder()
                    .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                    .build()
                scanner.startScan(null, settings, callback)
                scanning = true
                scanStartedAt = SystemClock.elapsedRealtime()
                promise.resolve(null)
            } catch (error: SecurityException) {
                promise.reject("E_PERMISSION", error.message ?: "Permission denied", error)
            } catch (error: Exception) {
                promise.reject("E_BLUETOOTH", error.message ?: "Could not start the scan", error)
            }
        }
    }

    @SuppressLint("MissingPermission") // A running scan implies the permission was granted.
    override fun stopScan(promise: Promise) {
        try {
            if (scanning && hasScanPermission()) adapter?.bluetoothLeScanner?.stopScan(callback)
        } catch (error: Exception) {
            // Bluetooth may have been turned off meanwhile; the scan is gone either way.
        }
        scanning = false
        promise.resolve(null)
    }

    override fun getScanResults(promise: Promise) {
        val now = SystemClock.elapsedRealtime()
        promise.resolve(
            Arguments.createMap().apply {
                putBoolean("scanning", scanning)
                putString("error", scanError)
                putDouble("elapsedMs", if (scanStartedAt > 0) (now - scanStartedAt).toDouble() else 0.0)
                putArray(
                    "devices",
                    Arguments.createArray().apply {
                        devices.values.sortedByDescending { it.rssi }.forEach { device ->
                            pushMap(
                                Arguments.createMap().apply {
                                    putString("address", device.address)
                                    putString("name", device.name)
                                    putInt("rssi", device.rssi)
                                    if (device.txPower == null) putNull("txPower") else putInt("txPower", device.txPower)
                                    putBoolean("connectable", device.connectable)
                                    putArray("manufacturerIds", Arguments.createArray().apply { device.manufacturerIds.forEach { pushInt(it) } })
                                    putArray("serviceUuids", Arguments.createArray().apply { device.serviceUuids.forEach { pushInt(it) } })
                                    putDouble("ageMs", (now - device.lastSeen).toDouble())
                                    putDouble("seenForMs", (device.lastSeen - device.firstSeen).toDouble())
                                    putArray("history", Arguments.createArray().apply { device.history.forEach { pushInt(it) } })
                                },
                            )
                        }
                    },
                )
            },
        )
    }

    @SuppressLint("MissingPermission") // Checked by hasConnectPermission() first.
    override fun getBondedDevices(promise: Promise) {
        if (adapter == null || !hasConnectPermission()) {
            promise.resolve(Arguments.createArray())
            return
        }
        try {
            promise.resolve(
                Arguments.createArray().apply {
                    adapter.bondedDevices.orEmpty().forEach { device ->
                        pushMap(
                            Arguments.createMap().apply {
                                putString("address", device.address)
                                putString("name", device.name)
                                putString(
                                    "type",
                                    when (device.type) {
                                        BluetoothDevice.DEVICE_TYPE_CLASSIC -> "classic"
                                        BluetoothDevice.DEVICE_TYPE_LE -> "le"
                                        BluetoothDevice.DEVICE_TYPE_DUAL -> "dual"
                                        else -> "unknown"
                                    },
                                )
                                putInt("majorClass", device.bluetoothClass?.majorDeviceClass ?: -1)
                            },
                        )
                    }
                },
            )
        } catch (error: SecurityException) {
            promise.resolve(Arguments.createArray())
        }
    }

    @SuppressLint("MissingPermission") // BluetoothDevice.getName needs CONNECT; only used when granted.
    private fun record(result: ScanResult) {
        val address = result.device?.address ?: return
        val record = result.scanRecord
        val now = SystemClock.elapsedRealtime()
        val name = record?.deviceName?.ifBlank { null }
            ?: if (hasConnectPermission()) runCatching { result.device.name }.getOrNull()?.ifBlank { null } else null
        val manufacturers = record?.manufacturerSpecificData?.let { data ->
            (0 until data.size()).map { data.keyAt(it) }
        }.orEmpty()
        val services = record?.serviceUuids.orEmpty().mapNotNull { BluetoothFormat.shortUuid(it.uuid) }
        val previous = devices[address]
        devices[address] = SeenDevice(
            address = address,
            name = name ?: previous?.name,
            rssi = result.rssi,
            txPower = BluetoothFormat.txPowerOrNull(result.txPower) ?: record?.txPowerLevel?.let(BluetoothFormat::txPowerOrNull),
            connectable = result.isConnectable,
            manufacturerIds = manufacturers.ifEmpty { previous?.manufacturerIds.orEmpty() },
            serviceUuids = services.ifEmpty { previous?.serviceUuids.orEmpty() },
            firstSeen = previous?.firstSeen ?: now,
            lastSeen = now,
            history = BluetoothFormat.appendRssi(previous?.history.orEmpty(), result.rssi),
        )
    }

    private fun hasScanPermission(): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            granted(Manifest.permission.BLUETOOTH_SCAN)
        } else {
            granted(Manifest.permission.ACCESS_FINE_LOCATION)
        }

    private fun hasConnectPermission(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.S || granted(Manifest.permission.BLUETOOTH_CONNECT)

    private fun granted(permission: String): Boolean =
        ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED

    private fun isLocationEnabled(): Boolean =
        context.getSystemService(LocationManager::class.java)?.let(LocationManagerCompat::isLocationEnabled) ?: false

    @SuppressLint("MissingPermission")
    override fun invalidate() {
        try {
            if (scanning && hasScanPermission()) adapter?.bluetoothLeScanner?.stopScan(callback)
        } catch (error: Exception) {
            // Ignore: the app is shutting down.
        }
        scanning = false
        super.invalidate()
    }

    companion object {
        const val NAME = "NativeBluetoothModule"
    }
}
