# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
The release workflow publishes the section matching the tag as the GitHub
Release notes.

## [Unreleased]

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
