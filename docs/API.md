# Native bridge API

Contract between the TypeScript app and its Kotlin Turbo Native Modules.

- Specs live in [`src/native/specs`](../src/native/specs) and drive React Native
  codegen (`codegenConfig` in `package.json`), which generates the abstract
  `…Spec` classes in `io.github.krumqnkata.networktoolkit.specs`.
- Every method is asynchronous and runs on a background executor in Kotlin.
- Native results are untyped at the bridge and **validated with Zod** in the
  wrappers in [`src/native`](../src/native) (e.g. `network.ts`). Invalid data
  raises `AppError('invalid-native-data')` instead of reaching the UI.
- Native rejections carry a code that is mapped to `AppError` codes:

  | Native code    | `AppError.code`     |
  | -------------- | ------------------- |
  | `E_PERMISSION` | `permission-denied` |
  | `E_NETWORK`    | `network`           |
  | anything else  | `unknown`           |

## `NativeNetworkModule`

Kotlin: [`network/NetworkModule.kt`](../android/app/src/main/java/io/github/krumqnkata/networktoolkit/network/NetworkModule.kt)

### `getNetworkSnapshot(): Promise<NetworkSnapshot>`

Reads `ConnectivityManager` (active network, `NetworkCapabilities`,
`LinkProperties`) and `WifiManager.getConnectionInfo()`.

Permissions: `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE` (install-time).
SSID and BSSID additionally require precise location (`ACCESS_FINE_LOCATION`)
**and** location services turned on; otherwise they are `null`, and
`locationPermission` / `locationEnabled` tell the UI why.

| Field                                  | Type                                                          | Source / notes                                                   |
| -------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------- |
| `timestamp`                            | number (ms)                                                   | Time of the read                                                 |
| `transport`                            | `wifi` `cellular` `ethernet` `bluetooth` `vpn` `other` `none` | Primary transport of the active network                          |
| `isVpn`                                | boolean                                                       | `TRANSPORT_VPN`                                                  |
| `hasInternet`                          | boolean                                                       | `NET_CAPABILITY_INTERNET`                                        |
| `isValidated`                          | boolean                                                       | `NET_CAPABILITY_VALIDATED` — Android's connectivity check passed |
| `isCaptivePortal`                      | boolean                                                       | `NET_CAPABILITY_CAPTIVE_PORTAL`                                  |
| `isMetered`                            | boolean                                                       | Absence of `NET_CAPABILITY_NOT_METERED`                          |
| `downstreamKbps`, `upstreamKbps`       | number \| null                                                | Link bandwidth **estimates** from Android                        |
| `interfaceName`                        | string \| null                                                | e.g. `wlan0`, `rmnet_data0`                                      |
| `addresses`                            | `IpAddress[]`                                                 | `address`, `prefixLength`, `family` (`ipv4`/`ipv6`), `scope`     |
| `gateways`                             | string[]                                                      | Gateways of default routes                                       |
| `dnsServers`                           | string[]                                                      | DNS servers of the active network                                |
| `privateDnsActive`, `privateDnsServer` | boolean/string \| null                                        | Android 9+                                                       |
| `domains`                              | string \| null                                                | Search domains                                                   |
| `mtu`                                  | number \| null                                                | Android 10+                                                      |
| `wifi`                                 | `WifiLink` \| null                                            | Present while associated to Wi-Fi, also when a VPN is active     |
| `cellularOperator`                     | string \| null                                                | `TelephonyManager.getNetworkOperatorName()` on mobile data       |
| `locationPermission`                   | boolean                                                       | Precise location granted                                         |
| `locationEnabled`                      | boolean                                                       | Location services on                                             |

`WifiLink`:

| Field                                | Type           | Notes                                                  |
| ------------------------------------ | -------------- | ------------------------------------------------------ |
| `ssid`, `bssid`                      | string \| null | Null when withheld by Android                          |
| `hiddenSsid`                         | boolean        |                                                        |
| `rssi`                               | number \| null | dBm                                                    |
| `frequencyMhz`                       | number \| null | Primary channel center; band/channel derived in TS     |
| `linkSpeedMbps`                      | number \| null |                                                        |
| `txLinkSpeedMbps`, `rxLinkSpeedMbps` | number \| null | Android 10+                                            |
| `maxTxLinkSpeedMbps`                 | number \| null | Android 11+                                            |
| `wifiStandard`                       | number \| null | `ScanResult.WIFI_STANDARD_*`, Android 11+              |
| `security`                           | string \| null | `open`, `wpa-personal`, `wpa3-personal`, … Android 12+ |

The MAC address of the phone is never read: Android returns a constant
placeholder to apps.

## `NativeWifiModule`

Kotlin: [`wifi/WifiModule.kt`](../android/app/src/main/java/io/github/krumqnkata/networktoolkit/wifi/WifiModule.kt),
[`wifi/WifiScanner.kt`](../android/app/src/main/java/io/github/krumqnkata/networktoolkit/wifi/WifiScanner.kt)

Permissions: `ACCESS_WIFI_STATE`, `CHANGE_WIFI_STATE` (install-time) and
`ACCESS_FINE_LOCATION` (runtime), which Android requires for scanning on all
versions. Location services must be on. Without the permission both methods
reject with `E_PERMISSION`; with location or Wi-Fi off they resolve with an
empty list and `locationEnabled` / `wifiEnabled` set to `false`.

### `scan(): Promise<WifiScanResult>`

Calls `WifiManager.startScan()`, waits for `SCAN_RESULTS_AVAILABLE_ACTION`
(up to 12 s) and returns `getScanResults()`. Android throttles foreground apps
to 4 scans per 2 minutes; a throttled request returns the previous results
with `scanStarted: false`.

### `getCachedScanResults(): Promise<WifiScanResult>`

Returns `getScanResults()` without requesting a scan (`scanStarted: false`,
`fresh: false`). Used to show results immediately when the analyzer opens.

| Field                            | Type               | Notes                             |
| -------------------------------- | ------------------ | --------------------------------- |
| `timestamp`                      | number (ms)        |                                   |
| `scanStarted`                    | boolean            | Android accepted the scan request |
| `fresh`                          | boolean            | Results come from that scan       |
| `wifiEnabled`, `locationEnabled` | boolean            | Preconditions for scanning        |
| `networks`                       | `ScannedNetwork[]` | See below                         |

`ScannedNetwork`: `ssid` (null if hidden), `bssid`, `rssi` (dBm),
`frequencyMhz` (primary channel), `channelWidthMhz` (20/40/80/160/320; 80+80 is
reported as 160), `centerFreq0Mhz` / `centerFreq1Mhz` (0 when not reported),
`capabilities` (raw string, parsed in `src/domain/algorithms/wifiAnalysis.ts`),
`wifiStandard` (Android 11+), `supportsRtt`, `passpoint`, `ageMs`.
