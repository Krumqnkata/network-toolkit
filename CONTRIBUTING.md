# Contributing to Network Toolkit

Thanks for your interest in improving Network Toolkit! This document explains
how to set up the project and what we expect from contributions.

By contributing you agree that your contributions are licensed under the
[GNU AGPL-3.0-only](LICENSE), the same license as the project.

## Development setup

Requirements:

| Tool        | Version                                             |
| ----------- | --------------------------------------------------- |
| Node.js     | 24 LTS (see `.nvmrc`; ≥ 22.11 works)                |
| JDK         | 17 (what CI uses)                                   |
| Android SDK | Platform 37, Build-Tools 37.0.0, NDK 27.1.12297006  |
| Device      | Android 8.0 (API 26) or newer, physical or emulator |

Follow the official
[React Native environment setup](https://reactnative.dev/docs/set-up-your-environment)
for Android, then:

```sh
npm ci
npm start          # Metro bundler
npm run android    # build and install the debug app
```

Debug builds are installed as `io.github.krumqnkata.networktoolkit.debug`, so
they can live next to a release build on the same device.

## Checks

Run everything CI runs on the JavaScript side with:

```sh
npm run verify     # typecheck + ESLint + Prettier + Jest
```

Kotlin unit tests and the Android build:

```sh
cd android
./gradlew testDebugUnitTest assembleDebug
```

## Project structure

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). In short:

- `src/features/<module>` — one folder per feature module (screens, hooks,
  feature-specific logic and its tests).
- `src/domain` — pure models and algorithms, no React or React Native imports.
- `src/native` — the only place that talks to native modules.
- `android/` — Kotlin native modules and the Android app.

## Branches and commits

- `main` is always releasable and protected; work happens on short-lived
  branches such as `feat/wifi-scan`, `fix/dns-timeout` or `docs/readme`.
- Use [Conventional Commits](https://www.conventionalcommits.org/):
  `feat: add DNS lookup screen`, `fix(ping): handle timeouts`,
  `docs: describe permissions`, `ci: cache Gradle`, `refactor: …`, `test: …`.
- Open a pull request against `main`; CI must be green before merging.
- Add a line under **Unreleased** in [CHANGELOG.md](CHANGELOG.md) for
  user-visible changes.

## Guidelines

- TypeScript is strict. Avoid `any`; validate data crossing the native bridge.
- Never block the UI thread — native work runs on background threads and
  returns promises.
- Request Android permissions only when the feature that needs them is used,
  and document them in [docs/PERMISSIONS.md](docs/PERMISSIONS.md).
- Do not mark a tool as available until it is implemented and tested.
- Every new dependency needs a clear purpose and an AGPL-compatible license.
- Network scanning features must be aimed at networks the user owns or is
  authorized to test.

## Releases

Maintainers release by tagging `main`; see [docs/RELEASING.md](docs/RELEASING.md).
