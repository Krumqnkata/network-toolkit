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

### Network tools (no extra permissions)

The tools in milestone 5 only need `INTERNET`:

- **Ping and traceroute** run the system `/system/bin/ping` (iputils), which
  Android lets unprivileged apps use for ICMP echo. Apps cannot open raw
  sockets, so where `ping` is missing or blocked, Ping falls back to timing a
  TCP connect and the UI says so; traceroute is then unavailable. The host is
  validated and resolved first, so only a numeric address reaches `ping`.
- **Cleartext HTTP** is allowed by
  [`network_security_config.xml`](../android/app/src/main/res/xml/network_security_config.xml)
  so that the HTTP Headers tool can inspect `http://` URLs and the
  reachability check can use Android's own captive-portal probe
  (`http://connectivitycheck.gstatic.com/generate_204`). Only system CAs are
  trusted.
- **TLS Certificate** records the platform's trust verdict instead of aborting
  the handshake, so it can show expired or self-signed certificates. That
  connection is closed right after the handshake and never carries data.
- **External services**: the reachability check contacts the gateway,
  `example.com` (DNS), `1.1.1.1`, `2606:4700:4700::1111` and Google's
  `generate_204` endpoints; IP Information contacts Cloudflare
  (`/cdn-cgi/trace`) and Team Cymru's DNS service. Both run only when the user
  taps the button.

### LAN scanner and local network access

The LAN scanner (milestone 6) also needs only `INTERNET`, because the app
targets SDK 36. Per the official
[local network permission guide](https://developer.android.com/privacy-and-security/local-network-permission),
apps targeting SDK 36 or lower get an implicit grant of `ACCESS_LOCAL_NETWORK`
and must **not** declare or request it. Raising `targetSdk` to 37 makes local
network traffic (TCP, UDP, mDNS, `NsdManager`) blocked by default; before that
the app must declare `ACCESS_LOCAL_NETWORK`, request it from the LAN scanner
with an explanation, and handle denial (TCP then times out, UDP fails with
`EPERM`).

Other Android limits the scanner works within:

- **No ARP table, no MAC addresses.** Since Android 10, apps cannot read
  `/proc/net/arp` or use netlink neighbour queries, so devices are found by
  active probes and announcements instead. A MAC address is shown only when
  the device reports it itself (NetBIOS node status). MAC vendor lookup is
  therefore not offered.
- **No multicast lock.** mDNS queries use the legacy-unicast form (RFC 6762
  §6.7) and SSDP responses are unicast, so no `CHANGE_WIFI_MULTICAST_STATE`
  permission or `MulticastLock` is needed.
- **UPnP descriptions** are fetched only from the address that announced them.

### Speed test (no extra permissions)

The speed test uses only `INTERNET`. It talks to Cloudflare's speed-test
servers (`speed.cloudflare.com`, the endpoints used by Cloudflare's own web
test), which see the device's public IP address like any web server. It runs
only when the user starts it, and asks first on metered networks because a
fast connection can transfer several hundred MB.

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

| Permission / API                     | Milestone | Purpose                                                                    | Notes                                                                                               |
| ------------------------------------ | --------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `ACCESS_LOCAL_NETWORK` (Android 17+) | 9         | LAN scanner, port scanner, gateway checks once `targetSdk` is raised to 37 | Runtime permission in the `NEARBY_DEVICES` group; must be requested in context from the LAN scanner |

## Handling rules

- Permission state is managed centrally (one service, not per screen).
- Every request is preceded by a short in-app explanation of why it is needed.
- Denial is a normal state: the feature shows what is missing and how to grant
  it, and the rest of the app keeps working.
- "Don't ask again" leads to an explanation with a link to system settings —
  the app never loops on the system dialog.
