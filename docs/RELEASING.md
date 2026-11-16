# Releasing

Releases are built, signed and published by
[`.github/workflows/release.yml`](../.github/workflows/release.yml) when a tag
of the form `vMAJOR.MINOR.PATCH` (optionally `-prerelease`) is pushed.

## One-time setup: signing key

1. Create an upload/release keystore **outside the repository** and keep a
   backup — losing it means users cannot update to new releases:

   ```sh
   keytool -genkeypair -v -storetype PKCS12 \
     -keystore network-toolkit-release.keystore \
     -alias network-toolkit -keyalg RSA -keysize 4096 -validity 10000
   ```

2. Add these repository secrets (**Settings → Secrets and variables → Actions**):

   | Secret                        | Value                                                                                                                                                |
   | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `ANDROID_KEYSTORE_BASE64`     | `base64 -w0 network-toolkit-release.keystore` (PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("network-toolkit-release.keystore"))`) |
   | `ANDROID_KEYSTORE_PASSWORD`   | Keystore password                                                                                                                                    |
   | `ANDROID_KEY_ALIAS`           | `network-toolkit` (or the alias you chose)                                                                                                           |
   | `ANDROID_KEY_PASSWORD`        | Key password                                                                                                                                         |
   | `ANDROID_SIGNING_CERT_SHA256` | Optional. Certificate SHA-256 from `keytool -list -v -keystore …`. When set, the workflow refuses to publish an APK signed by any other certificate. |

Keystores (`*.keystore`, except the public debug keystore) are ignored by Git.

## Cutting a release

1. Make sure `main` is green in CI.
2. Update the version in `package.json` (this drives `versionName` and
   `versionCode` in the Android build).
3. In `CHANGELOG.md`, rename **Unreleased** to `## [X.Y.Z] - YYYY-MM-DD` and
   start a new empty **Unreleased** section.
4. Commit (`chore(release): vX.Y.Z`), merge to `main`, then tag and push:

   ```sh
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin vX.Y.Z
   ```

## What the workflow does

1. **Validate** — the tag is SemVer, matches `package.json`, has a CHANGELOG
   section, and points at a commit on `main`.
2. **Checks** — runs the full CI workflow (types, lint, format, Jest, Kotlin
   tests, debug build).
3. **Build & sign** — `assembleRelease` and `bundleRelease` with the release
   key from secrets.
4. **Verify** — `apksigner verify` on the APK (rejects the debug key and,
   if configured, any unexpected certificate) and `jarsigner -verify` on the AAB.
5. **Package** — the universal `NetworkToolkit-vX.Y.Z.apk`, one APK per ABI
   (`-arm64-v8a`, `-armeabi-v7a`, `-x86_64`, `-x86`; all five are signature
   checked), `NetworkToolkit-vX.Y.Z.aab` and `checksums.txt` (SHA-256).
6. **Publish** — creates the GitHub Release with the CHANGELOG section as
   release notes. Versions with a pre-release suffix are marked as pre-releases.

If any step fails, nothing is published.

## Local release build

For testing a signed build locally, put the same four values in
`~/.gradle/gradle.properties` (never in the repository):

```properties
ANDROID_KEYSTORE_FILE=/absolute/path/to/network-toolkit-release.keystore
ANDROID_KEYSTORE_PASSWORD=…
ANDROID_KEY_ALIAS=network-toolkit
ANDROID_KEY_PASSWORD=…
```

then run `cd android && ./gradlew assembleRelease`. Without these values the
release build is produced unsigned.
