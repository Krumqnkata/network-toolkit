# Android permissions

Network Toolkit asks only for what a feature needs, **when the user opens that
feature** — never all at once on first launch. This file is the source of truth
for which permissions the app declares and why.

## Declared today

| Permission | Since | Why                                                               | Runtime prompt |
| ---------- | ----- | ----------------------------------------------------------------- | -------------- |
| `INTERNET` | 0.1.0 | Network diagnostics, and Metro bundler connection in debug builds | No (normal)    |

## Planned

Each row is added to the manifest in the milestone that needs it. Behavior must
be re-checked against the official Android documentation at that time, since it
differs between Android versions.

| Permission / API                   | Milestone | Purpose                                                                     | Notes                                                                               |
| ---------------------------------- | --------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `ACCESS_NETWORK_STATE`             | 3         | Connection type, `NetworkCapabilities`, `LinkProperties` (IP, gateway, DNS) | Normal permission                                                                   |
| `ACCESS_WIFI_STATE`                | 3         | Current Wi-Fi connection info                                               | Normal permission; SSID/BSSID still require location or nearby-devices access       |
| `ACCESS_FINE_LOCATION`             | 4         | Wi-Fi scan results on Android 8–12; SSID of the current network             | Runtime; scan results are location data on these versions                           |
| `NEARBY_WIFI_DEVICES`              | 4         | Wi-Fi scan results on Android 13+                                           | Runtime; declare with `neverForLocation` only if no location is derived             |
| `CHANGE_WIFI_STATE`                | 4         | `WifiManager.startScan()`                                                   | Normal; scans are throttled by the OS (foreground: 4 scans / 2 min on Android 9+)   |
| Local network access (Android 17+) | 6         | LAN scanner and port scanner on newer targets                               | Must be verified against the Android 17 behavior changes before raising `targetSdk` |

## Handling rules

- Permission state is managed centrally (one service, not per screen).
- Every request is preceded by a short in-app explanation of why it is needed.
- Denial is a normal state: the feature shows what is missing and how to grant
  it, and the rest of the app keeps working.
- "Don't ask again" leads to an explanation with a link to system settings —
  the app never loops on the system dialog.
