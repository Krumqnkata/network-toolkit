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

  | Native code       | `AppError.code`     |
  | ----------------- | ------------------- |
  | `E_PERMISSION`    | `permission-denied` |
  | `E_NETWORK`       | `network`           |
  | `E_WIFI`          | `network`           |
  | `E_INVALID_INPUT` | `invalid-input`     |
  | `E_UNKNOWN_HOST`  | `unknown-host`      |
  | `E_TIMEOUT`       | `timeout`           |
  | `E_UNSUPPORTED`   | `unsupported`       |
  | anything else     | `unknown`           |

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

## `NativeNetToolsModule`

Kotlin: [`tools/NetToolsModule.kt`](../android/app/src/main/java/io/github/krumqnkata/networktoolkit/tools/NetToolsModule.kt)
· TypeScript wrapper: [`src/native/netTools.ts`](../src/native/netTools.ts)

Every method performs **one bounded probe** on a 4-thread executor; repeats
(continuous ping, traceroute) and cancellation are handled in TypeScript.
Timeouts are clamped to 0.5–30 s. Hosts are validated (`HostInput`): only
hostnames (IDN-encoded) and IP literals are accepted, so input can never be
parsed as a command-line option. Permission: `INTERNET` only.

### `ping(host, family, ttl, timeoutMs): Promise<PingProbe>`

Resolves `host` (`family`: `any` / `ipv4` / `ipv6`) and runs
`/system/bin/ping -n -c 1 -W <s> [-t <ttl>] <address>` (`ping6` for IPv6).
`ttl` > 0 is used by traceroute and supports IPv4 only. If the device does not
let apps use `ping`, it falls back to timing a TCP connect to port 443/80
(`method: "tcp"`; a refused connection still counts as a reply); with `ttl` > 0
it rejects with `E_UNSUPPORTED` instead.

| Field     | Type                                           | Notes                                     |
| --------- | ---------------------------------------------- | ----------------------------------------- |
| `address` | string                                         | Numeric address probed                    |
| `family`  | `ipv4` \| `ipv6`                               |                                           |
| `method`  | `icmp` \| `tcp`                                |                                           |
| `status`  | `reply` `timeout` `ttl-exceeded` `unreachable` |                                           |
| `rttMs`   | number \| null                                 | Only for `reply`                          |
| `ttl`     | number \| null                                 | TTL of the reply                          |
| `from`    | string \| null                                 | Router for `ttl-exceeded` / `unreachable` |

### `dnsQuery(name, recordType, server, timeoutMs): Promise<DnsQueryResult>`

`server` = `''` uses the system resolver: `DnsResolver.rawQuery` on Android 10+
(honours Private DNS), otherwise UDP to the active network's first DNS server.
An IP address sends plain DNS over UDP to that server and retries over TCP when
the answer is truncated. Responses are decoded by `DnsMessage` (A, AAAA, NS,
CNAME, SOA, PTR, MX, TXT, SRV, CAA; other types in RFC 3597 `\# len hex` form).

Result: `server` (`system` or IP), `durationMs`, `rcode`, `authoritative`,
`truncated`, `answers` and `authority` as `{ name, type, ttl, data }[]`.

### `tcpConnect(host, port, family, timeoutMs): Promise<TcpConnectResult>`

`status`: `open`, `refused`, `timeout` or `unreachable`; `connectMs` for `open`
and `refused`; `address`, `family`, `message`.

### `httpRequest(url, method, maxRedirects, timeoutMs): Promise<HttpResult>`

`HEAD` or `GET` (`http`/`https` only) with redirects followed manually up to
`maxRedirects` (max 20). Bodies are never read; no cookies or caches. Each hop:
`url`, `status`, `statusText`, `protocol` (from Android's
`X-Android-Selected-Protocol`, which is not shown as a header), `cipherSuite`,
`durationMs`, `headers` (`{ name, value }[]`, in server order).

### `tlsInspect(host, port, timeoutMs): Promise<TlsResult>`

TCP connect + TLS handshake with SNI. The chain is validated with the platform
trust manager (`X509TrustManagerExtensions`, so the network security config
applies) and the default hostname verifier, but a failure is **reported**
(`trusted: false`, `trustError`) instead of aborting, so invalid certificates
can be inspected. The socket is closed right after the handshake.

Result: `address`, `protocol`, `cipherSuite`, `handshakeMs`, `trusted`,
`trustError`, `hostnameMatches`, `chain` — per certificate: `subject`,
`issuer` (RFC 2253), `serialNumber` (hex), `notBefore` / `notAfter` (ms),
`signatureAlgorithm`, `publicKeyAlgorithm`, `publicKeyBits`,
`subjectAltNames` (`DNS:` / `IP:`), `isCa`, `sha256`.

## `NativeLanModule`

Kotlin: [`lan/LanModule.kt`](../android/app/src/main/java/io/github/krumqnkata/networktoolkit/lan/LanModule.kt)
· TypeScript wrapper: [`src/native/lan.ts`](../src/native/lan.ts)
· Orchestration: [`src/features/lan-scanner/services/lanScan.ts`](../src/features/lan-scanner/services/lanScan.ts)

All host arguments must be IP literals (`scanPorts` also accepts a hostname).
Each call is one bounded batch; the TypeScript side batches, reports progress
and stops between batches. Timeouts are clamped to 0.1–10 s.

### `probeHosts(hosts, ports, timeoutMs, icmp)`

Up to 256 hosts and 512 host×port pairs per call. All TCP connects run at once
on one NIO `Selector`; `open` or `refused` (RST) marks a host alive. With
`icmp`, hosts that did not answer get one ICMP echo each (system `ping`, up to
32 in parallel). Result: `hosts: { address, alive, method (tcp|icmp|null),
rttMs, openPorts }[]`.

### `netbiosQuery(hosts, timeoutMs)`

NetBIOS node status request (UDP 137, RFC 1002) to each host; replies give
`{ address, name, workgroup, mac }` (`mac` is null when the host reports
zeros).

### `mdnsQuery(localAddress, names, types, durationMs)`

Sends the questions (up to 12 per packet, names must end in `.local`) to
`224.0.0.251:5353` from an ephemeral port on the interface that owns
`localAddress`, so responders answer by unicast. Returns every reply as
`{ from, records }`, where records are the answer and additional sections in
the same `{ name, type, ttl, data }` form as `dnsQuery`. Dots inside labels
are escaped as `\.`.

### `ssdpSearch(localAddress, durationMs)`

Sends `M-SEARCH` (`ST: ssdp:all`) twice to `239.255.255.250:1900` and collects
the unicast responses: `{ from, server, location, st, usn }[]`.

### `scanPorts(host, ports, timeoutMs)`

TCP connect scan of up to 512 ports in one selector round. Result:
`{ address, ports: { port, status (open|refused|timeout|unreachable),
connectMs }[] }`.

## `NativeSpeedTestModule`

Kotlin: [`speed/SpeedTestModule.kt`](../android/app/src/main/java/io/github/krumqnkata/networktoolkit/speed/SpeedTestModule.kt)
· Engine: [`speed/SpeedTest.kt`](../android/app/src/main/java/io/github/krumqnkata/networktoolkit/speed/SpeedTest.kt)
· TypeScript wrapper: [`src/native/speedTest.ts`](../src/native/speedTest.ts)

Server: `https://speed.cloudflare.com` — `/__down?bytes=N` (download) and
`/__up` (POST upload), the endpoints of Cloudflare's own web speed test. They
are not a documented API and may change; they are defined in one place.

### `start(phaseSeconds, streams): Promise<SpeedStatus>`

Starts a test in the background (rejects with `E_BUSY` while one is running)
and resolves with its first status. `phaseSeconds` is clamped to 3–30,
`streams` to 1–8 (the app uses 10 s and 4).

1. **Latency** — 21 requests for 0 bytes on a kept-alive connection; the first
   (DNS, TCP, TLS setup) is discarded. RTT = request time − `cfSpeedWorker`
   from `Server-Timing`. Reports the median and jitter (mean absolute
   difference). Then 20 ICMP echoes (5 in parallel) to the server for packet
   loss; `null` when the device does not allow ICMP.
2. **Download** — `streams` connections each repeatedly fetch 25 MB chunks
   for `phaseSeconds`. A latency probe runs every 400 ms alongside.
3. **Upload** — the same with 8 MB POST bodies. Bytes are counted as they are
   written to the socket.

Throughput is the sustained rate after a 2 s warm-up (TCP slow start);
`currentMbps` is the rate over the last second.

### `getStatus(): Promise<SpeedStatus>` · `cancel(): Promise<void>`

| Field                                       | Type                                                            |
| ------------------------------------------- | --------------------------------------------------------------- |
| `phase`                                     | `idle` `latency` `download` `upload` `done` `cancelled` `error` |
| `progress`                                  | 0–1                                                             |
| `currentMbps`                               | number \| null                                                  |
| `downloadMbps`, `uploadMbps`                | number \| null                                                  |
| `idleLatencyMs`, `jitterMs`                 | number \| null                                                  |
| `downloadLatencyMs`, `uploadLatencyMs`      | number \| null — median latency under load                      |
| `packetLossPercent`                         | number \| null                                                  |
| `bytesDownloaded`, `bytesUploaded`          | number                                                          |
| `serverColo`, `serverCity`, `serverCountry` | string \| null — from `cf-meta-*` response headers              |
| `error`                                     | string \| null                                                  |
