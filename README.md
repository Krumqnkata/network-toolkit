<div align="center">

<img src="docs/assets/logo.svg" alt="Network Toolkit logo" width="112" height="112" />

# Network Toolkit

**An open source network diagnostics toolkit for Android** — Wi-Fi analysis,
internet diagnostics, LAN discovery and network administration tools in one
native app.

[![CI](https://github.com/Krumqnkata/network-toolkit/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Krumqnkata/network-toolkit/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Krumqnkata/network-toolkit/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/Krumqnkata/network-toolkit/actions/workflows/codeql.yml)
[![License: AGPL-3.0-only](https://img.shields.io/badge/license-AGPL--3.0--only-blue.svg)](LICENSE)
![Platform: Android 8.0+](https://img.shields.io/badge/platform-Android%208.0%2B-3DDC84.svg)
![React Native 0.88](https://img.shields.io/badge/React%20Native-0.88-61DAFB.svg)

</div>

<!-- prettier-ignore -->
> [!NOTE]
> **Status: early development (milestones 1–4 of 9).** The live network
> dashboard and the Wi-Fi Analyzer work; the network tools are next — see the
> [roadmap](#roadmap). Only a test pre-release has been published so far.

## Features

Planned feature modules. The **Status** column reflects what is actually
implemented in the current code.

| Module                   | Highlights                                                                                    | Status    |
| ------------------------ | --------------------------------------------------------------------------------------------- | --------- |
| **Dashboard**            | Connection type, IP, gateway, DNS, Wi-Fi signal, internet reachability, quick access to tools | Available |
| **Wi-Fi Analyzer**       | 2.4 / 5 / 6 GHz scans, SSID/BSSID, RSSI, channels, overlap analysis, signal history           | Available |
| **Network Tools**        | Ping, traceroute, DNS & reverse DNS, port scanner, HTTP headers, TLS certificates, IP info    | Planned   |
| **LAN Scanner**          | TCP-based host discovery, hostnames, MAC vendors (where available), open ports                | Planned   |
| **Internet Diagnostics** | Download / upload speed, latency, jitter, packet loss, DNS timing, history                    | Planned   |
| **Advanced Diagnostics** | Connection monitoring, outage tracking, automatic problem detection, PDF/JSON reports         | Planned   |

Design principles:

- **Native and honest.** Built on official Android APIs and their real
  limits — scan throttling, MAC randomization, permission requirements — and
  never shows data the OS does not actually provide.
- **Local first.** Diagnostics run on the phone; no account, no cloud service.
- **English and Bulgarian.** The whole interface is available in both
  languages and follows the device language by default.
- **Permissions in context.** Nothing is requested on first launch; each
  permission is requested when the feature that needs it is used
  ([details](docs/PERMISSIONS.md)).
- **For networks you manage.** Scanning tools are intended for networks you
  own or are authorized to test.

## Screenshots

Screenshots will be added once the first functional screens are available.

## Tech stack

| Area       | Technology                                                         |
| ---------- | ------------------------------------------------------------------ |
| UI         | React Native 0.88 (New Architecture, Hermes), TypeScript (strict)  |
| Navigation | React Navigation 7 (native stack + bottom tabs)                    |
| State      | Zustand                                                            |
| Native     | Kotlin, Android SDK, Turbo Native Modules                          |
| Graphics   | react-native-svg (icons, channel graph, sparklines)                |
| Storage    | SQLite (planned)                                                   |
| Testing    | Jest, React Native Testing Library, JUnit; Maestro planned for E2E |
| Quality    | ESLint, Prettier, CodeQL, Dependabot, dependency review            |
| CI/CD      | GitHub Actions — checks on every PR, signed releases from Git tags |

## Installation

Once the first version is released, signed APKs will be available on the
[Releases](https://github.com/Krumqnkata/network-toolkit/releases) page:

1. Download `NetworkToolkit-vX.Y.Z.apk` and `checksums.txt` from the latest release.
2. Optionally verify the download: `sha256sum -c checksums.txt`.
3. Open the APK on your phone and allow installation from that source when
   Android asks.

Requires Android 8.0 (API 26) or newer.

## Building from source

Prerequisites: Node.js 24 LTS, JDK 17, Android SDK (platform 37, build-tools
37.0.0, NDK 27.1.12297006) — see the
[React Native environment setup](https://reactnative.dev/docs/set-up-your-environment).

```sh
git clone https://github.com/Krumqnkata/network-toolkit.git
cd network-toolkit
npm ci
npm start           # Metro bundler, in one terminal
npm run android     # build + install the debug app, in another
```

Run the checks that CI runs:

```sh
npm run verify                                   # types, lint, format, Jest
cd android && ./gradlew testDebugUnitTest assembleDebug
```

Release builds and signing are described in [docs/RELEASING.md](docs/RELEASING.md).

## Architecture

The app is split into presentation, application, domain and infrastructure
layers. Screens never talk to Android directly: all native work goes through
typed Turbo Native Modules written in Kotlin, which run off the UI thread.
Each feature lives in its own folder under `src/features` and can be developed
and tested independently.

Read more in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Roadmap

| #   | Milestone           | Scope                                                          | Status  |
| --- | ------------------- | -------------------------------------------------------------- | ------- |
| 1   | Foundation          | Project setup, architecture, navigation, theme, CI/CD          | Done    |
| 2   | Native bridge       | Turbo Native Module infrastructure, typed and validated bridge | Done    |
| 3   | Network information | Connection, IP, gateway, DNS, Wi-Fi signal on the dashboard    | Done    |
| 4   | Wi-Fi Analyzer      | Scanning, channels, RSSI, charts, overlap analysis             | Done    |
| 5   | Network diagnostics | Ping, DNS lookup, traceroute, HTTP and TLS tools               | Planned |
| 6   | LAN Scanner         | Device discovery, vendor lookup, port scanning                 | Planned |
| 7   | Speed test          | Download, upload, latency, jitter, packet loss                 | Planned |
| 8   | Advanced features   | History, monitoring, automatic diagnostics, reports            | Planned |
| 9   | Optimization        | Performance, battery, compatibility, 1.0 release               | Planned |

The first public version (MVP) covers milestones 1–5: dashboard, network
information, Wi-Fi Analyzer, ping and DNS lookup.

Ideas for after 1.0: MikroTik RouterOS integration, network topology map,
device identification and smarter diagnostics.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## Contributing

Contributions are welcome — please read [CONTRIBUTING.md](CONTRIBUTING.md) and
the [Code of Conduct](CODE_OF_CONDUCT.md). Security issues should be reported
privately as described in [SECURITY.md](SECURITY.md).

## License

Network Toolkit is free software, licensed under the
[GNU Affero General Public License v3.0 only](LICENSE) (`AGPL-3.0-only`).
