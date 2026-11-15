# Android permissions

Network Toolkit asks only for what a feature needs, **when the user opens that
feature** — never all at once on first launch. This file is the source of truth
for which permissions the app declares and why.

## Declared today

| Permission               | Since | Why                                                                                                                   | Runtime prompt                                                             |
| ------------------------ | ----- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `INTERNET`               | 0.1.0 | Network diagnostics, and Metro bundler connection in debug builds                                                     | No (normal)                                                                |
| `ACCESS_NETWORK_STATE`   | 0.2.0 | Connection type, `NetworkCapabilities`, `LinkProperties` (IP, gateway, DNS)                                           | No (normal)                                                                |
| `ACCESS_WIFI_STATE`      | 0.2.0 | Current Wi-Fi link (signal, frequency, link speed, standard, security) and `getScanResults()`                         | No (normal)                                                                |
| `CHANGE_WIFI_STATE`      | 0.2.0 | Required by `WifiManager.startScan()`                                                                                 | No (normal)                                                                |
| `ACCESS_FINE_LOCATION`   | 0.2.0 | SSID/BSSID of the current network, and `startScan()` / `getScanResults()` on **every** Android version, including 13+ | Yes — from the Dashboard Wi-Fi card or the Wi-Fi Analyzer, on user request |
| `ACCESS_COARSE_LOCATION` | 0.2.0 | Must be requested together with fine location on Android 12+                                                          | Yes — same dialog                                                          |

Location is never read, stored or transmitted; the permission only unlocks the
Wi-Fi data Android ties to it. SSIDs, BSSIDs and scan results also require
location services to be on — the app detects this and links to the system
location settings.

Scanning is throttled by Android: a foreground app may scan 4 times per
2 minutes (Android 9+). The analyzer auto-scans every 30 seconds, and shows a
notice when a manual scan was throttled and older results are displayed.

### Why not `NEARBY_WIFI_DEVICES`?

Per the official [Wi-Fi permissions guide](https://developer.android.com/develop/connectivity/wifi/wifi-permissions),
`getScanResults()` and `startScan()` still require `ACCESS_FINE_LOCATION` when
targeting Android 13+, so `NEARBY_WIFI_DEVICES` would not unlock anything the
app uses today. It will be added if a feature needs an API it covers (e.g.
Wi-Fi Aware or Wi-Fi RTT).

## Planned

Each row is added to the manifest in the milestone that needs it. Behavior must
be re-checked against the official Android documentation at that time, since it
differs between Android versions.

| Permission / API                   | Milestone | Purpose                                       | Notes                                                                               |
| ---------------------------------- | --------- | --------------------------------------------- | ----------------------------------------------------------------------------------- |
| Local network access (Android 17+) | 6         | LAN scanner and port scanner on newer targets | Must be verified against the Android 17 behavior changes before raising `targetSdk` |

## Handling rules

- Permission state is managed centrally (one service, not per screen).
- Every request is preceded by a short in-app explanation of why it is needed.
- Denial is a normal state: the feature shows what is missing and how to grant
  it, and the rest of the app keeps working.
- "Don't ask again" leads to an explanation with a link to system settings —
  the app never loops on the system dialog.
