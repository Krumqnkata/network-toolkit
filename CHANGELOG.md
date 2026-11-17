# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
The release workflow publishes the section matching the tag as the GitHub
Release notes.

## [Unreleased]

## [1.4.1] - 2026-11-17

### Fixed

- Home: ping no longer looks like Mbps — every number in the speed card has
  its own unit (Mbps, Mbps, ms).
- Home: the router → phone line in the diagram takes the colour of the Wi-Fi
  signal instead of always being green.
- "All results" is a full-size touch target.
- Errors say what happened in plain words and what to do next; the technical
  text is behind "Details".
- Tab names follow your text size (up to 1.2×) and still fit.

### Changed

- Section headings are written normally instead of in small spaced capitals,
  and the "Network Toolkit" label above the home title is gone.
- "What affects your speed" lists one item per line; response times show the
  names and times without repeated pictures.
- Speed history: two lines per test — speeds with units, then date and ping.
- Shorter, plainer text under the speed test.
- Text that shrinks to fit never goes below 70% of its size.

## [1.4.0] - 2026-11-17

### Added

- **Provider report** (Tools → Check my connection): do you get the speed you
  pay for? Enter your plan's download and upload speed and, if you like, turn
  on automatic tests every 6, 12 or 24 hours. They run in the background only
  on home Wi-Fi or Ethernet and when the battery is not low, are shorter than
  a manual test, and the screen shows how much data each one uses. For the
  last 7, 30 or 90 days the report shows the typical download and upload as a
  share of the plan, the slowest and fastest test, how many tests reached 80%
  of the plan, a chart with the plan line, and the speed by time of day — and
  says when the evening is much slower. Tests on weak Wi-Fi or mobile data are
  left out, because there the phone limits the speed. Share it as text or as
  a spreadsheet (CSV).
- Speed test results now remember the connection type and Wi-Fi signal.

## [1.3.1] - 2026-11-16

### Fixed

Found on a phone with a larger system font and Bulgarian:

- Text no longer runs under the clock and status icons when you scroll; the
  status bar area now has the app's background.
- Tab names ("Устройства", "Инструменти") use the whole tab width and shrink
  slightly instead of ending in "…".
- Home diagram: the provider's name, the router and the phone shrink to fit on
  two lines, and IP addresses on one, instead of being cut at the screen edge
  or ending in "…".
- Home speed card: "Download", "Upload" and "Ping" and their numbers shrink to
  fit their columns instead of running into each other.
- Response-time names and values, segmented controls and badges shrink to
  fit; in Wi-Fi by room the badges moved below the room name.
- A Bulgarian sentence on the home screen still used the English word
  "latency".

## [1.3.0] - 2026-11-16

### Added

- **Security check** (Tools → My network). Looks at your home network the way
  an attacker nearby would and explains each finding in plain language:

  - Wi-Fi encryption (open, WEP, WPA, TKIP, WPA2, WPA3) and whether WPS is on;
  - the router: settings page without HTTPS, Telnet or FTP open;
  - UPnP: whether devices can open ports to the internet by themselves, and
    the list of ports already opened (read from the router's own UPnP
    interface — nothing is added or removed);
  - devices from the last network scan with Telnet, FTP or remote desktop
    open;
  - whether encrypted DNS (Private DNS) is on.

  The result is rated "safe", "a few things to look at" or "at risk", risks
  first, and can be shared as text. Nothing is logged into or changed.

## [1.2.0] - 2026-11-16

### Added

- **Wi-Fi by room** (Wi-Fi tab, Tools → Check my connection, or the home
  screen). Walk through your home and tap "Measure here" in each room: the app
  takes eight signal readings, the link rate, the router's response time and
  which access point the phone used, then compares the rooms with a coloured
  bar each and names the best and the weakest. Plain-language advice covers
  dead zones, weak rooms, when to add a mesh point or move the router, a
  phone that stays on a far access point, strong rooms stuck on 2.4 GHz and
  interference. Checks can be shared as text and are kept in a history.

### Changed

- The home screen's fourth tile opens Wi-Fi by room; the public IP is already
  shown in the diagram at the top.

## [1.1.1] - 2026-11-16

### Fixed

- **Text cut off on some phones:** titles and badges lost their last letter
  (Android measures text without letter spacing, so the spacing was removed
  from titles and reduced on small labels); very large system font sizes are
  now capped where layouts would break, and tab labels no longer scale past
  the tab bar.
- **Content hidden under the navigation bar** at the bottom of Settings, tool
  and device screens (edge-to-edge insets are now respected there).
- Badges such as "GATEWAY" are no longer squeezed by a long name next to them.

### Changed

- **Settings button** on every tab, in the same top-right spot: a larger gear
  in a tinted rounded square.
- **Android 17:** the app now targets Android 17 (API 37) and asks for the new
  "local network" permission (Nearby devices) when you start a device scan,
  the network map, a health check or a tool aimed at a home address. If you
  already allowed Bluetooth, Android does not ask again. Without it, the
  internet tools keep working.

## [1.1.0] - 2026-11-16

Stable release with everything from 1.1.0-rc.1 (where is the problem,
network map, device identification) plus a regrouped, simpler interface,
equipment pictures and map export. Installed copies of 1.0.0 update to it
automatically.

### Added

- **Network map export:** share the map as an image (PNG), a drawing (SVG), a
  text report or data (JSON) from the share menu — save it to Files or Drive or
  send it in a chat.
- **Equipment pictures:** the map, the home screen, the device list and the
  health check now show original illustrations of the equipment (cloud,
  provider, cell tower, router, switch, mesh access point, phone, laptop,
  printer, TV, storage, camera, smart plug and Bluetooth gadgets).
- **Network switches** are recognised as their own device type.
- Screenshots in the README.

### Changed

- **Network map redrawn:** the provider's routers collapse into one
  "Internet provider" node (tap it for every hop), a second home router
  (double NAT) stays visible, and devices hang off a line at the side so no
  line crosses a name.
- **Home:** the title is your Wi-Fi network's name; the diagram shows
  provider → router → this phone with response times on the links; response
  times sit in four even columns instead of a row that was cut off.
- **Tools** are grouped by task — Check my connection, My network, Look up &
  trace, Websites & security — and every tool has its own icon. The network
  map is also listed there.
- **Speed test:** the gauge and the start button come first; the technical
  details moved below. The Speed tab no longer shows a "Tools" back link.
- Shorter, plainer introductions on the device and map screens; the settings
  icon is now a gear.

## [1.1.0-rc.1] - 2026-11-16

Release candidate for 1.1: smarter diagnostics, a self-building network map
and device identification. Installed copies of 1.0.0 do not update to it
automatically (pre-releases are offered only to pre-release installs); install
the APK from the release page to test it.

### Added

- **Health check: "Where is the problem?"** The check now measures each part
  of the connection separately (this phone → router → provider → internet)
  with eight pings each, and shows the chain with every link coloured by the
  delay and loss it adds. A plain-language verdict says whether the Wi-Fi or
  mobile signal, the router, the provider's line or the internet beyond it is
  to blame, with advice. The result is included in shared reports.
- **Network map** (Devices → Map). Builds itself by measuring the network:
  the path to the internet (TTL-limited pings), your router, every access
  point that broadcasts your network's name (mesh), the devices found by the
  LAN scanner and nearby Bluetooth devices. Lines are coloured by the delay
  each link adds, and wireless links are dashed. Tap a node for its address,
  response time and what it is, and to open device details or ping it.
  Double NAT and provider CGNAT are detected and explained. Packets are not
  captured: Android does not allow that without root.
- **Smarter device identification.** After finding devices, the LAN scan
  asks each one about itself, using only the ports it found open: the TTL
  of a ping reply (Linux/Android/Apple, Windows or network equipment), the
  web server's `Server` header, page title and login realm, the SSH
  greeting (software and distribution) and the HTTPS certificate. Brands
  such as MikroTik, FRITZ!Box, Ubiquiti, Synology, HP and Hikvision are
  recognised, and a device without another name is called by its web
  page's title. A new Identification card on the device screen shows what
  was found. Only private addresses can be asked.
- **Manufacturer from MAC addresses** using the bundled IEEE OUI registry:
  Wi-Fi Analyzer shows who made each access point, the network map names
  access points by maker, and devices with a known MAC show their network
  card's maker. Randomised addresses are skipped.

## [1.0.0] - 2026-11-16

First stable release. It contains exactly what was tested as 1.0.0-rc.5 on a
phone, including a successful automatic update from rc.3.

### Highlights

- **Home:** your provider and this phone with their IP addresses, a
  one-sentence verdict on your connection, a one-tap speed test with what the
  speed is good for, what affects your speed (Wi-Fi or mobile: operator,
  5G/4G, signal) and response times to popular sites and your router.
- **Wi-Fi Analyzer:** nearby networks on 2.4/5/6 GHz, channel graph, signal
  history and channel recommendations.
- **Speed test:** download, upload, ping, jitter, latency under load
  (bufferbloat) and packet loss, with saved history.
- **Devices:** LAN scanner (TCP/ICMP, mDNS, SSDP/UPnP, NetBIOS) with device
  names and types, and a Bluetooth scanner with a "find this device" signal
  finder.
- **Tools:** ping, traceroute, DNS and reverse DNS lookup, internet
  reachability, public IP and provider, HTTP headers, TLS certificates, port
  scanner, connection monitor with outage tracking, and a health check that
  explains problems in plain language.
- **Updates:** checks this repository's releases and installs new versions
  itself after verifying their checksum and signature.
- English and Bulgarian, dark and light themes, no accounts, ads or
  analytics.

See the 1.0.0-rc.1 … rc.5 sections below for every change.

## [1.0.0-rc.5] - 2026-11-16

### Fixed

- Automatic updates between pre-releases were refused with "The APK is not
  newer than the installed version": every `1.0.0-rc.N` had the same Android
  `versionCode`. The versionCode now includes the pre-release stage
  (`major·10⁷ + minor·10⁵ + patch·10³ + stage`, where alpha.N = 100+N,
  beta.N = 300+N, rc.N = 500+N and a release = 999), so each build is higher
  than the previous one. All new codes are above those of rc.1–rc.4, so
  installed copies update normally; rc.4 is skipped.
- Update errors are explained in the app's language instead of the native
  English message.

### Changed

- New app icon (adaptive, with a themed monochrome variant for Android 13+).
- New fonts with full Bulgarian and English support: Inter for text and
  JetBrains Mono (without ligatures) for technical values.

## [1.0.0-rc.4] - 2026-11-16

A simpler home screen and Bluetooth tools. This is also the first version that
can be installed through the automatic updater added in rc.3.

### Changed

- Simpler home screen for everyone: a diagram from your internet provider
  (name and public IP) to this phone (name and local IP) with an "Online"
  status, a one-sentence summary ("Your internet is working well."), a large
  "Start speed test" button that starts the test right away, the latest result
  with what it is good for ("Great for 4K video and video calls"), a "What
  affects your speed" card and response times to google.com, youtube.com,
  cloudflare.com and your router. IP, DNS and channel details are folded into
  "Technical details".
- Mobile data: operator, network generation (5G/4G/3G/2G) and signal in dBm
  with a plain rating, read from Android's signal report (no extra
  permission), and the device name from the system settings.

### Added

- Bluetooth scanner (Devices → Bluetooth, also in Tools): finds nearby
  Bluetooth Low Energy devices and shows their name, maker (from the Bluetooth
  SIG company and member UUID lists), a likely type (headphones, speaker,
  watch, fitness device, keyboard, TV, tracker, car …) and how close they are
  in plain words ("Very close", "In the room"), plus devices paired with the
  phone. Scans stop after 2 minutes or when you leave.
- "Find this device": live signal strength of one device, a trend ("Getting
  closer" / "Moving away"), a signal history and a rough distance, to find a
  lost earbud or tracker.
- The Devices tab now switches between Network (LAN scanner) and Bluetooth.
- Settings → Data: "Show my public IP and provider" (on by default) controls
  the public IP lookup of the home screen.

## [1.0.0-rc.3] - 2026-11-16

### Added

- Automatic updates: on start (at most every 6 hours) the app checks this
  repository's GitHub releases for a newer version — pre-releases too while a
  pre-release is installed — downloads the APK for the phone's ABI, checks its
  SHA-256 against the release's `checksums.txt`, verifies that it is this app,
  newer and signed with the same key, and installs it with `PackageInstaller`.
  On Android 12+ updates install without a confirmation once "Install unknown
  apps" is allowed for Network Toolkit; Android 8–11 always ask. On metered
  networks the update waits on a home-screen banner.
- Settings → Updates: automatic updates on/off, installed version, last check,
  "Check now", and the download/install status.

### Changed

- New permissions: `REQUEST_INSTALL_PACKAGES` and
  `UPDATE_PACKAGES_WITHOUT_USER_ACTION`, used only for self-updates.
- CI installs the Android NDK up front with retries (a corrupt NDK download
  had failed a build).

## [1.0.0-rc.2] - 2026-11-16

Second release candidate: a redesigned home screen and navigation. Release
candidate 1 was installed and tested on a phone, and everything worked.

### Changed

- New home screen: the network name as the title with the internet status,
  a large speed card with the latest download, upload and ping and a button
  to run a test, a Wi-Fi signal card (dBm, quality, signal bar, band, channel,
  link speed and a live trend line), and tiles for Devices, Health, Monitor and
  Public IP showing their latest state. Wi-Fi and IP details follow below.
- Navigation: the bottom tabs are now Home, Wi-Fi, Speed, Devices and Tools.
  The speed test and the LAN scanner have their own tabs; Settings opens from
  the gear button on the home screen.
- New colors: deep navy backgrounds with a bright blue accent in the dark
  theme and a matching light theme, all checked against WCAG AA contrast.
- Large tabular numbers for measured values.

## [1.0.0-rc.1] - 2026-11-16

Release candidate for 1.0: all nine roadmap milestones are implemented. It has
not yet been tested on physical devices, so it stays a pre-release until it
has been; please report problems in the issue tracker.

### Added

- Per-ABI APKs (milestone 9): every release now ships
  `NetworkToolkit-vX-arm64-v8a.apk` (and `armeabi-v7a`, `x86_64`, `x86`),
  about a quarter of the size of the universal APK, plus the universal APK and
  the App Bundle. The release notes explain which file to pick.
- Settings → Data: delete all saved speed tests, monitor sessions and health
  reports (with confirmation; settings are kept).
- Settings → About: privacy statement and source code links;
  [docs/PRIVACY.md](docs/PRIVACY.md) lists every service each tool contacts.
- On-device storage (milestone 8): `NativeStorageModule` over Android's
  built-in SQLite with versioned migrations, no third-party library. Records
  are JSON documents validated with Zod when read.
- Theme and language settings are now saved and restored on start.
- Speed-test history: results are saved (up to 200) and the latest 20 are
  listed with date and time; the history can be cleared.
- Connection Monitor: pings the internet (1.1.1.1), the gateway or a custom
  host every 2 s while the app is open, with live latency chart, loss,
  min/avg/max, jitter, uptime and outages (3+ consecutive losses). Sessions
  are saved every 30 s and when stopped, listed afterwards, and can be shared
  as a text report or deleted.
- Health Check: runs every reachability check and combines it with the Wi-Fi
  signal and security, the band, channel congestion from the latest scan and
  a recent speed test into prioritized findings with explanations and advice
  (weak signal, insecure Wi-Fi, captive portal, DNS failures or slowness,
  router or internet unreachable, high latency, HTTPS failures, no IPv6,
  packet loss, bufferbloat, VPN). Reports are saved and can be shared as text
  or JSON.

- Speed Test (milestone 7): download and upload throughput over 4 parallel
  HTTPS connections for 10 s each against Cloudflare's speed-test servers,
  reported as the sustained rate after a 2 s warm-up; idle latency (HTTP round
  trips minus server time) and jitter; latency under load during download and
  upload with a bufferbloat rating; packet loss from 20 ICMP probes (shown as
  "not measured" where ICMP is unavailable); server location and data used.
  A live gauge shows the current rate. Asks before running on metered
  networks. Results of the session are listed below the test.
- `NativeSpeedTestModule` (Kotlin); the test keeps running if the screen is
  left and can be stopped at any time.

### Changed

- CI runs Android lint (`:app:lintDebug`), so calls to APIs above the minimum
  Android version without a version check fail the build.
- `targetSdk` stays 36 for 1.0. Moving to 37 (Android 17) requires the new
  `ACCESS_LOCAL_NETWORK` runtime permission for the LAN tools and is planned
  for a later release, after testing on Android 17 devices.

## [0.2.0-beta.2] - 2026-11-16

First feature pre-release: the MVP (milestones 1–5) plus the LAN scanner
(milestone 6). It has not yet been tested on physical devices; please report
problems in the issue tracker.
`v0.2.0-beta.1` was tagged but never published because its release build
failed (see Fixed).

### Added

- LAN Scanner (milestone 6): sweeps the Wi-Fi/Ethernet subnet (up to a /22;
  larger subnets are reduced to the /24 around the phone) with parallel
  non-blocking TCP connects to common ports plus ICMP for silent hosts, and
  discovers devices that announce themselves via mDNS/DNS-SD and SSDP/UPnP.
  Devices are named from UPnP descriptions, mDNS TXT records, NetBIOS,
  reverse DNS and mDNS host names, and categorized (router, phone, computer,
  printer, TV, speaker, storage, camera, smart home). Results stay available
  while the app is open; scans can be stopped.
- Device details with model, host names, NetBIOS workgroup and MAC (when the
  device reports it), mDNS services, open discovery ports, and shortcuts to
  Ping, Port Scanner and the device's web interface.
- Port Scanner: TCP connect scan of a common-ports preset, 1–1024 or a custom
  list/range, in batches of 256 with a 1 s timeout, showing open ports with
  service names and closed/no-reply counts.
- `NativeLanModule` (Kotlin): batched NIO connect prober, NetBIOS node status,
  mDNS legacy-unicast and SSDP discovery without a multicast lock.
- Network tools (milestone 5), all reachable from the Tools tab:
  - **Ping** — repeated or continuous ICMP echo via the system `ping`, with
    loss, min/avg/max, jitter and a latency chart; IPv4/IPv6 selection; falls
    back to TCP connect time on devices that block ICMP for apps (and says so).
  - **Traceroute** — TTL-limited pings, per-hop round-trip time and reverse DNS
    names (IPv4).
  - **DNS Lookup** — A, AAAA, CNAME, MX, TXT, NS, SOA, SRV and CAA via the
    Android resolver (`DnsResolver`, honours Private DNS) or Cloudflare, Google
    and Quad9; shows status (NOERROR/NXDOMAIN/…), TTLs, timing and authority
    records.
  - **Reverse DNS** — PTR lookups for IPv4 and IPv6 addresses.
  - **Internet Reachability** — checks gateway, DNS, TCP to 1.1.1.1, captive
    portal (Android's `generate_204` check), HTTPS and IPv6 in order.
  - **IP Information** — public IPv4/IPv6, country and Cloudflare location from
    `1.1.1.1/cdn-cgi/trace`, and ASN, prefix and network name from Team Cymru's
    DNS service; nothing is sent until the user taps the button.
  - **HTTP Headers** — HEAD or GET with every redirect hop, response headers,
    negotiated protocol and a security-header summary.
  - **TLS Certificate** — protocol, cipher suite, handshake time, trust and
    hostname verdicts, and the full chain with validity, SANs, key, signature
    and SHA-256 fingerprints, also for untrusted or expired certificates.
- `NativeNetToolsModule` (Kotlin) with a dependency-free DNS wire-format codec
  and unit-tested ping-output parser.

### Changed

- The app now allows cleartext HTTP through a network security config, so the
  HTTP Headers tool can inspect `http://` URLs and the reachability check can
  use Android's captive-portal probe.

- Wi-Fi Analyzer: scans nearby networks on 2.4, 5 and 6 GHz and shows a
  channel graph (each network drawn across the spectrum it occupies, including
  40/80/160 MHz channels), a list sorted by signal with channel, width,
  frequency, security (WPA/WPA2/WPA3/Enterprise/OWE, WPS), Wi-Fi standard and
  BSSID, the connected access point, and a per-network signal history for the
  session.
- Channel recommendations: ranks 1/6/11 on 2.4 GHz, all common 5 GHz channels
  (DFS marked) and 6 GHz preferred scanning channels by overlap with visible
  networks, plus the load on your own network's channel.
- Automatic scan every 30 seconds while the analyzer is open (within Android's
  4-scans-per-2-minutes limit), with a clear message when Android throttles a
  scan, and explanations when location or Wi-Fi is off.

- Live Dashboard: connection type, internet status (validated / captive
  portal / no internet), VPN and metered badges, Wi-Fi name, BSSID, signal
  strength meter, band, channel, frequency, link speeds, Wi-Fi standard and
  security, IP addresses, gateway, DNS servers, Private DNS, MTU, search
  domain, bandwidth estimate and mobile operator. Updates every 3 seconds
  while visible and supports pull-to-refresh.
- Bulgarian translation of the whole interface, with a language setting
  (System / English / Български).
- Native bridge: first Turbo Native Module (`NetworkModule`, Kotlin) with
  data validated by Zod before it reaches the UI; documented in docs/API.md.
- Location permission requested only from the Wi-Fi card, with an in-app
  explanation, "don't ask again" handling and a shortcut to location settings
  when location services are off.
- Kotlin unit tests for network value normalization.

### Fixed

- Release builds failed while bundling JavaScript: Zod 4 uses
  `export * as … from`, which the React Native Babel preset does not
  transform. Added `@babel/plugin-transform-export-namespace-from`, and CI now
  bundles the release JavaScript on every pull request so this is caught
  before tagging.

## [0.1.0-alpha.1] - 2026-11-15

> **Test pre-release.** This build verifies the signed release pipeline. It
> contains only the app shell — no diagnostic tool is functional yet. Not
> intended for everyday use.

### Added

- Project foundation: React Native 0.88 (New Architecture) with TypeScript and
  Kotlin, Android 8.0 (API 26) minimum.
- App shell with bottom-tab navigation: Dashboard, Wi-Fi, Tools and Settings.
- Own visual identity with light and dark themes, a custom icon set and an
  adaptive launcher icon; theme follows the system or a manual choice.
- Tools catalog showing the planned diagnostic tools and the milestone each
  one ships in.
- Jest and React Native Testing Library tests, including WCAG contrast checks
  for both themes.
- CI (type check, ESLint, Prettier, Jest, Kotlin unit tests, Android build),
  CodeQL, dependency review and Dependabot.
- Tag-driven release workflow that builds, signs, verifies and publishes the
  APK, AAB and SHA-256 checksums.

[Unreleased]: https://github.com/Krumqnkata/network-toolkit/compare/v1.4.1...HEAD
[1.4.1]: https://github.com/Krumqnkata/network-toolkit/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/Krumqnkata/network-toolkit/compare/v1.3.1...v1.4.0
[1.3.1]: https://github.com/Krumqnkata/network-toolkit/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/Krumqnkata/network-toolkit/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/Krumqnkata/network-toolkit/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/Krumqnkata/network-toolkit/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/Krumqnkata/network-toolkit/compare/v1.1.0-rc.1...v1.1.0
[1.1.0-rc.1]: https://github.com/Krumqnkata/network-toolkit/compare/v1.0.0...v1.1.0-rc.1
[1.0.0]: https://github.com/Krumqnkata/network-toolkit/compare/v1.0.0-rc.5...v1.0.0
[1.0.0-rc.5]: https://github.com/Krumqnkata/network-toolkit/compare/v1.0.0-rc.4...v1.0.0-rc.5
[1.0.0-rc.4]: https://github.com/Krumqnkata/network-toolkit/compare/v1.0.0-rc.3...v1.0.0-rc.4
[1.0.0-rc.3]: https://github.com/Krumqnkata/network-toolkit/compare/v1.0.0-rc.2...v1.0.0-rc.3
[1.0.0-rc.2]: https://github.com/Krumqnkata/network-toolkit/compare/v1.0.0-rc.1...v1.0.0-rc.2
[1.0.0-rc.1]: https://github.com/Krumqnkata/network-toolkit/compare/v0.2.0-beta.2...v1.0.0-rc.1
[0.2.0-beta.2]: https://github.com/Krumqnkata/network-toolkit/compare/v0.1.0-alpha.1...v0.2.0-beta.2
[0.1.0-alpha.1]: https://github.com/Krumqnkata/network-toolkit/releases/tag/v0.1.0-alpha.1
