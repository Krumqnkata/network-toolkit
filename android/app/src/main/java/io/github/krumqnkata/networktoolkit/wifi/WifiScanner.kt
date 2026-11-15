package io.github.krumqnkata.networktoolkit.wifi

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.location.LocationManager
import android.net.wifi.ScanResult
import android.net.wifi.WifiManager
import android.os.Build
import android.os.SystemClock
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import io.github.krumqnkata.networktoolkit.network.NetworkFormat
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Wi-Fi scanning following https://developer.android.com/develop/connectivity/wifi/wifi-scan:
 * startScan() + SCAN_RESULTS_AVAILABLE_ACTION, then getScanResults().
 *
 * Both calls need ACCESS_FINE_LOCATION and location services on (also on
 * Android 13+). Android throttles foreground apps to 4 scans per 2 minutes;
 * a throttled request returns the previous results, flagged as not fresh.
 * Must be called off the main thread.
 */
class WifiScanner(context: Context) {
    private val context = context.applicationContext
    private val wifiManager = this.context.getSystemService(WifiManager::class.java)

    class MissingPermissionException : SecurityException("Precise location permission is required to scan")

    fun scan(timeoutMillis: Long = 12_000): WritableMap {
        val state = preconditions()
        if (state != null) return state

        val done = CountDownLatch(1)
        val updated = AtomicBoolean(false)
        val receiver =
            object : BroadcastReceiver() {
                override fun onReceive(context: Context, intent: Intent) {
                    updated.set(intent.getBooleanExtra(WifiManager.EXTRA_RESULTS_UPDATED, false))
                    done.countDown()
                }
            }
        ContextCompat.registerReceiver(
            context,
            receiver,
            IntentFilter(WifiManager.SCAN_RESULTS_AVAILABLE_ACTION),
            ContextCompat.RECEIVER_NOT_EXPORTED,
        )
        val started =
            try {
                @Suppress("DEPRECATION") // startScan() is deprecated but remains the only way to request a scan.
                val accepted = wifiManager?.startScan() == true
                if (accepted) done.await(timeoutMillis, TimeUnit.MILLISECONDS)
                accepted
            } finally {
                context.unregisterReceiver(receiver)
            }
        return results(scanStarted = started, fresh = started && updated.get())
    }

    fun cached(): WritableMap = preconditions() ?: results(scanStarted = false, fresh = false)

    /** Returns an empty, explained result when scanning is impossible; throws without permission. */
    private fun preconditions(): WritableMap? {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            throw MissingPermissionException()
        }
        val locationOn =
            context.getSystemService(LocationManager::class.java)?.let(LocationManagerCompat::isLocationEnabled) ?: false
        val wifiOn = wifiManager?.isWifiEnabled == true
        if (locationOn && wifiOn) return null
        return emptyResult(scanStarted = false, wifiEnabled = wifiOn, locationEnabled = locationOn)
    }

    private fun emptyResult(scanStarted: Boolean, wifiEnabled: Boolean, locationEnabled: Boolean): WritableMap =
        Arguments.createMap().apply {
            putDouble("timestamp", System.currentTimeMillis().toDouble())
            putBoolean("scanStarted", scanStarted)
            putBoolean("fresh", false)
            putBoolean("wifiEnabled", wifiEnabled)
            putBoolean("locationEnabled", locationEnabled)
            putArray("networks", Arguments.createArray())
        }

    private fun results(scanStarted: Boolean, fresh: Boolean): WritableMap {
        val now = SystemClock.elapsedRealtime()
        val networks = Arguments.createArray()
        wifiManager?.scanResults.orEmpty().forEach { result -> networks.pushMap(toMap(result, now)) }
        return Arguments.createMap().apply {
            putDouble("timestamp", System.currentTimeMillis().toDouble())
            putBoolean("scanStarted", scanStarted)
            putBoolean("fresh", fresh)
            putBoolean("wifiEnabled", true)
            putBoolean("locationEnabled", true)
            putArray("networks", networks)
        }
    }

    @Suppress("DEPRECATION") // ScanResult.SSID is deprecated on API 33 in favor of wifiSsid; both are populated.
    private fun toMap(result: ScanResult, nowElapsedMillis: Long): WritableMap =
        Arguments.createMap().apply {
            putString("ssid", ScanFormat.normalizeScanSsid(result.SSID))
            putString("bssid", NetworkFormat.normalizeBssid(result.BSSID))
            putInt("rssi", result.level)
            putInt("frequencyMhz", result.frequency)
            val width = ScanFormat.channelWidthMhz(result.channelWidth)
            if (width == null) putNull("channelWidthMhz") else putInt("channelWidthMhz", width)
            putInt("centerFreq0Mhz", result.centerFreq0)
            putInt("centerFreq1Mhz", result.centerFreq1)
            putString("capabilities", result.capabilities ?: "")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                putInt("wifiStandard", result.wifiStandard)
            } else {
                putNull("wifiStandard")
            }
            putBoolean("supportsRtt", result.is80211mcResponder)
            putBoolean("passpoint", result.isPasspointNetwork)
            putDouble("ageMs", ScanFormat.ageMillis(nowElapsedMillis, result.timestamp).toDouble())
        }
}
