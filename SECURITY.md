# Security Policy

## Supported versions

Security fixes are made for the latest released version only. Pre-1.0 releases
may change behavior between minor versions.

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report vulnerabilities privately through GitHub's
[private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability):
open the repository's **Security** tab and choose **Report a vulnerability**.

Please include:

- the affected version and Android version,
- steps to reproduce or a proof of concept,
- the impact you expect (e.g. data exposure, code execution, permission bypass).

You can expect an acknowledgement within 7 days. Once a fix is released, the
advisory is published with credit to the reporter unless you prefer otherwise.

## Scope

In scope: the Android app in this repository, its native modules and the
release pipeline (for example, a way to get an unsigned or tampered APK
published as a release).

Out of scope: vulnerabilities in third-party networks or devices that the app
merely detects. The scanning tools are intended only for networks you own or
are authorized to test.

## Verifying releases

Every GitHub Release contains `checksums.txt` with SHA-256 hashes of the APK
and AAB. Verify a download with:

```sh
sha256sum -c checksums.txt
```

The APK signing certificate can be inspected with
`apksigner verify --print-certs NetworkToolkit-vX.Y.Z.apk`.
