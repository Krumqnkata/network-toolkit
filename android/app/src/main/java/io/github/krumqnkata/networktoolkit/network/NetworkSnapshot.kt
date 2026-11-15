package io.github.krumqnkata.networktoolkit.network

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

/** Plain data read from Android. Field names match the TypeScript schema in src/native/network.ts. */
data class NetworkSnapshot(
    val timestamp: Long,
    val transport: String,
    val isVpn: Boolean,
    val hasInternet: Boolean,
    val isValidated: Boolean,
    val isCaptivePortal: Boolean,
    val isMetered: Boolean,
    val downstreamKbps: Int?,
    val upstreamKbps: Int?,
    val interfaceName: String?,
    val addresses: List<IpAddress>,
    val gateways: List<String>,
    val dnsServers: List<String>,
    val privateDnsActive: Boolean?,
    val privateDnsServer: String?,
    val domains: String?,
    val mtu: Int?,
    val wifi: WifiLink?,
    val cellularOperator: String?,
    val locationPermission: Boolean,
    val locationEnabled: Boolean,
)

data class IpAddress(
    val address: String,
    val prefixLength: Int,
    val family: String,
    val scope: String,
)

data class WifiLink(
    val ssid: String?,
    val bssid: String?,
    val hiddenSsid: Boolean,
    val rssi: Int?,
    val frequencyMhz: Int?,
    val linkSpeedMbps: Int?,
    val txLinkSpeedMbps: Int?,
    val rxLinkSpeedMbps: Int?,
    val maxTxLinkSpeedMbps: Int?,
    val wifiStandard: Int?,
    val security: String?,
)

private fun WritableMap.putNullableInt(key: String, value: Int?) {
    if (value == null) putNull(key) else putInt(key, value)
}

private fun WritableMap.putNullableBoolean(key: String, value: Boolean?) {
    if (value == null) putNull(key) else putBoolean(key, value)
}

fun NetworkSnapshot.toWritableMap(): WritableMap =
    Arguments.createMap().apply {
        putDouble("timestamp", timestamp.toDouble())
        putString("transport", transport)
        putBoolean("isVpn", isVpn)
        putBoolean("hasInternet", hasInternet)
        putBoolean("isValidated", isValidated)
        putBoolean("isCaptivePortal", isCaptivePortal)
        putBoolean("isMetered", isMetered)
        putNullableInt("downstreamKbps", downstreamKbps)
        putNullableInt("upstreamKbps", upstreamKbps)
        putString("interfaceName", interfaceName)
        putArray(
            "addresses",
            Arguments.createArray().apply {
                addresses.forEach { address ->
                    pushMap(
                        Arguments.createMap().apply {
                            putString("address", address.address)
                            putInt("prefixLength", address.prefixLength)
                            putString("family", address.family)
                            putString("scope", address.scope)
                        },
                    )
                }
            },
        )
        putArray("gateways", Arguments.createArray().apply { gateways.forEach(::pushString) })
        putArray("dnsServers", Arguments.createArray().apply { dnsServers.forEach(::pushString) })
        putNullableBoolean("privateDnsActive", privateDnsActive)
        putString("privateDnsServer", privateDnsServer)
        putString("domains", domains)
        putNullableInt("mtu", mtu)
        if (wifi == null) {
            putNull("wifi")
        } else {
            putMap(
                "wifi",
                Arguments.createMap().apply {
                    putString("ssid", wifi.ssid)
                    putString("bssid", wifi.bssid)
                    putBoolean("hiddenSsid", wifi.hiddenSsid)
                    putNullableInt("rssi", wifi.rssi)
                    putNullableInt("frequencyMhz", wifi.frequencyMhz)
                    putNullableInt("linkSpeedMbps", wifi.linkSpeedMbps)
                    putNullableInt("txLinkSpeedMbps", wifi.txLinkSpeedMbps)
                    putNullableInt("rxLinkSpeedMbps", wifi.rxLinkSpeedMbps)
                    putNullableInt("maxTxLinkSpeedMbps", wifi.maxTxLinkSpeedMbps)
                    putNullableInt("wifiStandard", wifi.wifiStandard)
                    putString("security", wifi.security)
                },
            )
        }
        putString("cellularOperator", cellularOperator)
        putBoolean("locationPermission", locationPermission)
        putBoolean("locationEnabled", locationEnabled)
    }
