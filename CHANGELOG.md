# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
The release workflow publishes the section matching the tag as the GitHub
Release notes.

## [Unreleased]

### Added

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

[Unreleased]: https://github.com/Krumqnkata/network-toolkit/compare/v0.1.0-alpha.1...HEAD
[0.1.0-alpha.1]: https://github.com/Krumqnkata/network-toolkit/releases/tag/v0.1.0-alpha.1
