# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
The release workflow publishes the section matching the tag as the GitHub
Release notes.

## [Unreleased]

## [0.2.0-beta.2] - 2026-11-16

First feature pre-release: the MVP (milestones 1–5). It has not yet been
tested on physical devices; please report problems in the issue tracker.
`v0.2.0-beta.1` was tagged but never published because its release build
failed (see Fixed).

### Added

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

[Unreleased]: https://github.com/Krumqnkata/network-toolkit/compare/v0.2.0-beta.2...HEAD
[0.2.0-beta.2]: https://github.com/Krumqnkata/network-toolkit/compare/v0.1.0-alpha.1...v0.2.0-beta.2
[0.1.0-alpha.1]: https://github.com/Krumqnkata/network-toolkit/releases/tag/v0.1.0-alpha.1
