# Architecture

Network Toolkit is a native Android app: the UI is React Native (TypeScript,
New Architecture), and everything that touches Android networking APIs is
Kotlin. This document describes how the code is layered and where new code
belongs.

## Layers

```text
┌──────────────────────────────────────────────────────────────┐
│ Presentation     src/app, src/components, src/features/*/screens │
│                  screens, components, navigation, theme      │
├──────────────────────────────────────────────────────────────┤
│ Application      src/features/*/hooks, src/services, src/stores │
│                  use cases, orchestration, state (Zustand)   │
├──────────────────────────────────────────────────────────────┤
│ Domain           src/domain                                  │
│                  models, interfaces, algorithms — pure TS    │
├──────────────────────────────────────────────────────────────┤
│ Infrastructure   src/native, src/database, android/          │
│                  Turbo Native Modules (Kotlin), SQLite       │
└──────────────────────────────────────────────────────────────┘
```

Dependency rule: a layer may only import from the layers **below** it.

- **Screens never call native modules.** They use hooks/services, which use
  the typed bridge in `src/native`.
- **`src/domain` has no React, React Native or native imports.** Channel
  math, signal classification, subnet calculation, report generation and
  similar logic live here and are tested with plain Jest.
- **`src/native` is the only bridge to Kotlin.** Each native module has a
  TypeScript spec (used by React Native codegen) and a thin wrapper that
  validates results with Zod before they reach the rest of the app.

## Source layout

```text
src/
├── app/                 App root, navigation, theme, app config
├── components/          Shared UI: common/, icons/ (charts/, indicators/ later)
├── features/            One folder per module, developed independently
│   ├── dashboard/
│   ├── wifi-analyzer/
│   ├── network-tools/
│   └── settings/
├── domain/              Pure models and algorithms
├── native/              Typed native-module bridge (specs + Zod wrappers)
├── services/            Application services (permissions, …)
├── i18n/                Translations (en, bg) and language selection
├── database/            Storage wrapper and typed repositories
├── stores/              Zustand stores
└── utils/               Small generic helpers
tests/                   App-level integration tests and Jest setup
android/                 Android app and Kotlin native modules
```

A feature folder contains its `screens/`, feature-specific `hooks/` and
logic, and `__tests__/`. Folders marked with a milestone are created when the
first code that belongs there is written.

## Native modules

Native modules are implemented as **Turbo Native Modules** in Kotlin. All
methods are asynchronous: they run on background executors and resolve
promises, so the JS and UI threads are never blocked. Each native call is one
bounded operation (one ping probe, one DNS query, one traceroute hop); series
such as continuous ping or traceroute are scheduled in TypeScript hooks, which
also own cancellation, so no event channel is needed so far.

| Module            | Milestone | Responsibility                                         |
| ----------------- | --------- | ------------------------------------------------------ |
| `NetworkModule`   | 3         | Active network, capabilities, link properties, changes |
| `InterfaceModule` | 3         | `NetworkInterface` enumeration and addresses           |
| `WifiModule`      | 4         | Connection info, scans, scan results                   |
| `NetToolsModule`  | 5         | Ping, traceroute hops, DNS, TCP connect, HTTP and TLS  |
| `LanModule`       | 6         | Host probes, NetBIOS, mDNS, SSDP, port scanning        |
| `SpeedTestModule` | 7         | Multi-stream download/upload, latency under load       |

The bridge contract for each module is documented in `docs/API.md` as the
module is implemented.

## State and storage

- **UI state** lives in components.
- **App state** that several screens share lives in small Zustand stores in
  `src/stores` (settings, Wi-Fi scan, LAN scan, speed-test history, monitor).
- **Persistent data** is stored in SQLite through `NativeStorageModule`
  (Android's built-in SQLite, `storage/AppDatabase.kt`). Migrations are an
  append-only list in Kotlin. Records are JSON documents in one `records`
  table keyed by kind and time; `src/database/repositories.ts` defines a Zod
  schema per kind, so documents are validated on read and invalid ones are
  skipped. Settings live in a `settings` key/value table and are loaded
  before the first frame (`hydrateSettings`).
- **Server state** (e.g. speed-test server lists) may use TanStack Query once
  such a remote source exists.

## Theming

`src/app/theme` defines raw tokens (`tokens.ts`) and semantic light/dark
themes (`themes.ts`). Components read colors only through `useTheme()` and
semantic names (`textPrimary`, `accent`, …). The theme tests check WCAG AA
contrast for every text/background pair in both themes, so color changes that
hurt readability fail CI.

## Charts

Charts are drawn with `react-native-svg` (`src/components/charts`). The Wi-Fi
channel graph is a custom shape (each network spans the spectrum it occupies)
that general charting libraries do not model well, so Victory Native XL, which
would add Skia, Reanimated and Gesture Handler as native dependencies, is
deferred until a time-series chart needs interaction that SVG cannot do cheaply.

## Localization

The UI is available in English and Bulgarian. Strings live in
`src/i18n/strings/<lang>.ts`; English (`en.ts`) defines the shape and every
other language is typed against it, so a missing or extra key fails the type
check. Strings with parameters are functions. Components read strings with
`useStrings()`; the language follows the device locale unless the user
picks one in Settings. Technical values (addresses, units such as dBm, MHz,
Mbps) are not translated.

## Testing strategy

| Level                  | Tool                         | Location                     |
| ---------------------- | ---------------------------- | ---------------------------- |
| Domain logic           | Jest                         | `src/**/__tests__`           |
| Components and screens | React Native Testing Library | `src/**/__tests__`, `tests/` |
| Kotlin logic           | JUnit (`testDebugUnitTest`)  | `android/app/src/test`       |
| Device / E2E           | Maestro (planned)            | `.maestro/`                  |

Network-facing logic is written so it can be tested without a device: Kotlin
modules keep parsing and calculations in plain classes, and the TypeScript
bridge is mocked at the `src/native` boundary.
