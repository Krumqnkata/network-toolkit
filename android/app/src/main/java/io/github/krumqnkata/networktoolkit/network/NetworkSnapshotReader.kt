package io.github.krumqnkata.networktoolkit.network

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import android.net.ConnectivityManager
import android.net.LinkProperties
import android.net.NetworkCapabilities
import android.net.wifi.SupplicantState
import android.net.wifi.WifiInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.provider.Settings
import android.telephony.CellSignalStrengthCdma
import android.telephony.CellSignalStrengthGsm
import android.telephony.CellSignalStrengthLte
import android.telephony.CellSignalStrengthNr
import android.telephony.CellSignalStrengthTdscdma
import android.telephony.CellSignalStrengthWcdma
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import java.net.Inet4Address
import java.net.Inet6Address

/**
 * Reads the current network state from ConnectivityManager, LinkProperties
 * and WifiManager. Must be called off the main thread.
 *
 * Android only reveals the Wi-Fi SSID/BSSID when the app holds
 * ACCESS_FINE_LOCATION and location services are on; otherwise they are
 * reported as null and the UI explains why.
 */
class NetworkSnapshotReader(context: Context) {
    private val context = context.applicationContext
    private val connectivity = this.context.getSystemService(ConnectivityManager::class.java)
    private val wifiManager = this.context.getSystemService(WifiManager::class.java)

    fun read(): NetworkSnapshot {
        val network = connectivity?.activeNetwork
        val caps = network?.let { connectivity?.getNetworkCapabilities(it) }
        val link = network?.let { connectivity?.getLinkProperties(it) }
        val transport = transportOf(caps)
        val cellular = if (transport == "cellular") cellularSignal() else null

        return NetworkSnapshot(
            timestamp = System.currentTimeMillis(),
            transport = transport,
            isVpn = caps?.hasTransport(NetworkCapabilities.TRANSPORT_VPN) == true,
            hasInternet = caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true,
            isValidated = caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) == true,
            isCaptivePortal = caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_CAPTIVE_PORTAL) == true,
            isMetered = caps != null && !caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED),
            downstreamKbps = caps?.linkDownstreamBandwidthKbps?.let(NetworkFormat::positiveOrNull),
            upstreamKbps = caps?.linkUpstreamBandwidthKbps?.let(NetworkFormat::positiveOrNull),
            interfaceName = link?.interfaceName,
            addresses = link?.let(::addressesOf).orEmpty(),
            gateways = link?.let(::gatewaysOf).orEmpty(),
            dnsServers = link?.dnsServers?.map(NetworkFormat::hostAddress)?.distinct().orEmpty(),
            privateDnsActive = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) link?.isPrivateDnsActive else null,
            privateDnsServer = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) link?.privateDnsServerName else null,
            domains = link?.domains?.ifBlank { null },
            mtu = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) link?.mtu?.let(NetworkFormat::positiveOrNull) else null,
            wifi = readWifi(),
            cellularOperator = if (transport == "cellular") cellularOperator() else null,
            cellularGeneration = cellular?.generation,
            cellularDbm = cellular?.dbm,
            cellularLevel = cellular?.level,
            deviceName = deviceName(),
            locationPermission = hasFineLocation(),
            locationEnabled = isLocationEnabled(),
        )
    }

    private fun transportOf(caps: NetworkCapabilities?): String =
        when {
            caps == null -> "none"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_BLUETOOTH) -> "bluetooth"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN) -> "vpn"
            else -> "other"
        }

    private fun addressesOf(link: LinkProperties): List<IpAddress> =
        link.linkAddresses.mapNotNull { linkAddress ->
            when (val address = linkAddress.address) {
                is Inet4Address ->
                    IpAddress(NetworkFormat.hostAddress(address), linkAddress.prefixLength, "ipv4", "global")
                is Inet6Address ->
                    IpAddress(
                        NetworkFormat.hostAddress(address),
                        linkAddress.prefixLength,
                        "ipv6",
                        NetworkFormat.ipv6Scope(address),
                    )
                else -> null
            }
        }

    private fun gatewaysOf(link: LinkProperties): List<String> =
        link.routes
            .filter { it.isDefaultRoute && !NetworkFormat.isUnspecified(it.gateway) }
            .mapNotNull { route -> route.gateway?.let(NetworkFormat::hostAddress) }
            .distinct()

    /** Reads the Wi-Fi association even when a VPN is the active network. */
    @Suppress("DEPRECATION") // connectionInfo is deprecated on API 31+ but remains the only synchronous source.
    private fun readWifi(): WifiLink? {
        val manager = wifiManager ?: return null
        if (!manager.isWifiEnabled) return null
        val info: WifiInfo = manager.connectionInfo ?: return null
        if (info.supplicantState != SupplicantState.COMPLETED) return null

        // Version checks use Build.VERSION.SDK_INT directly so Android lint can verify them.
        return WifiLink(
            ssid = NetworkFormat.normalizeSsid(info.ssid),
            bssid = NetworkFormat.normalizeBssid(info.bssid),
            hiddenSsid = info.hiddenSSID,
            rssi = NetworkFormat.normalizeRssi(info.rssi),
            frequencyMhz = NetworkFormat.positiveOrNull(info.frequency),
            linkSpeedMbps = NetworkFormat.positiveOrNull(info.linkSpeed),
            txLinkSpeedMbps = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                NetworkFormat.positiveOrNull(info.txLinkSpeedMbps)
            } else {
                null
            },
            rxLinkSpeedMbps = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                NetworkFormat.positiveOrNull(info.rxLinkSpeedMbps)
            } else {
                null
            },
            maxTxLinkSpeedMbps = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                NetworkFormat.positiveOrNull(info.maxSupportedTxLinkSpeedMbps)
            } else {
                null
            },
            wifiStandard = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                NetworkFormat.positiveOrNull(info.wifiStandard)
            } else {
                null
            },
            security = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                securityName(info.currentSecurityType)
            } else {
                null
            },
        )
    }

    private fun securityName(type: Int): String? =
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            null
        } else {
            when (type) {
                WifiInfo.SECURITY_TYPE_OPEN -> "open"
                WifiInfo.SECURITY_TYPE_WEP -> "wep"
                WifiInfo.SECURITY_TYPE_PSK -> "wpa-personal"
                WifiInfo.SECURITY_TYPE_SAE -> "wpa3-personal"
                WifiInfo.SECURITY_TYPE_EAP -> "wpa-enterprise"
                WifiInfo.SECURITY_TYPE_EAP_WPA3_ENTERPRISE -> "wpa3-enterprise"
                WifiInfo.SECURITY_TYPE_EAP_WPA3_ENTERPRISE_192_BIT -> "wpa3-enterprise-192"
                WifiInfo.SECURITY_TYPE_OWE -> "owe"
                WifiInfo.SECURITY_TYPE_WAPI_PSK, WifiInfo.SECURITY_TYPE_WAPI_CERT -> "wapi"
                WifiInfo.SECURITY_TYPE_PASSPOINT_R1_R2, WifiInfo.SECURITY_TYPE_PASSPOINT_R3 -> "passpoint"
                else -> null
            }
        }

    private data class CellularSignal(val generation: String?, val dbm: Int?, val level: Int?)

    /**
     * Signal of the mobile network (Android 9+). Reading it needs no
     * permission; on Android 10+ the per-technology reports also tell the
     * generation (5G NR is reported next to LTE on non-standalone 5G).
     */
    private fun cellularSignal(): CellularSignal? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return null
        val telephony = context.getSystemService(TelephonyManager::class.java) ?: return null
        val strength = try {
            telephony.signalStrength
        } catch (error: SecurityException) {
            null
        } ?: return null
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            return CellularSignal(null, null, strength.level)
        }
        val reports = strength.cellSignalStrengths.mapNotNull { cell ->
            val generation = when (cell) {
                is CellSignalStrengthNr -> "5G"
                is CellSignalStrengthLte -> "4G"
                is CellSignalStrengthWcdma, is CellSignalStrengthTdscdma -> "3G"
                is CellSignalStrengthGsm, is CellSignalStrengthCdma -> "2G"
                else -> null
            } ?: return@mapNotNull null
            generation to NetworkFormat.cellDbm(cell.dbm)
        }
        val best = NetworkFormat.bestCellReport(reports)
        return CellularSignal(best?.first, best?.second, strength.level)
    }

    private fun deviceName(): String? =
        Settings.Global.getString(context.contentResolver, Settings.Global.DEVICE_NAME)?.ifBlank { null }
            ?: Build.MODEL

    private fun cellularOperator(): String? =
        context.getSystemService(TelephonyManager::class.java)?.networkOperatorName?.ifBlank { null }

    private fun hasFineLocation(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    private fun isLocationEnabled(): Boolean =
        context.getSystemService(LocationManager::class.java)?.let(LocationManagerCompat::isLocationEnabled) ?: false
}
