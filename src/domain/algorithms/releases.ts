/** SemVer 2.0 parsing and comparison (build metadata ignored). */
export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease: (string | number)[];
}

const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

export function parseSemVer(value: string): SemVer | null {
  const match = value.trim().match(SEMVER);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4]
      ? match[4].split('.').map(part => (/^\d+$/.test(part) ? Number(part) : part))
      : [],
  };
}

/** Negative when a < b, positive when a > b, 0 when equal (SemVer §11). */
export function compareSemVer(a: SemVer, b: SemVer): number {
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (a[key] !== b[key]) return a[key] - b[key];
  }
  if (a.prerelease.length === 0 || b.prerelease.length === 0) {
    // A release has higher precedence than any of its pre-releases.
    return b.prerelease.length - a.prerelease.length;
  }
  const length = Math.max(a.prerelease.length, b.prerelease.length);
  for (let i = 0; i < length; i++) {
    const x = a.prerelease[i];
    const y = b.prerelease[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    if (typeof x === 'number' && typeof y === 'number') return x - y;
    if (typeof x === 'number') return -1;
    if (typeof y === 'number') return 1;
    return x < y ? -1 : 1;
  }
  return 0;
}

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface GitHubRelease {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  html_url: string;
  published_at: string | null;
  body: string | null;
  assets: ReleaseAsset[];
}

export interface AvailableUpdate {
  version: string;
  prerelease: boolean;
  releaseUrl: string;
  notes: string;
  apk: ReleaseAsset;
  checksumsUrl: string;
}

/** APK file for the device: the first supported ABI with its own APK, else the universal APK. */
export function pickApk(
  release: GitHubRelease,
  version: string,
  abis: readonly string[],
): ReleaseAsset | null {
  for (const abi of abis) {
    const asset = release.assets.find(a => a.name === `NetworkToolkit-v${version}-${abi}.apk`);
    if (asset) return asset;
  }
  return release.assets.find(a => a.name === `NetworkToolkit-v${version}.apk`) ?? null;
}

/**
 * The newest release that is newer than `current` and has an APK for this
 * device and a checksums file. Pre-releases count only when allowed.
 */
export function findUpdate(
  releases: readonly GitHubRelease[],
  current: string,
  abis: readonly string[],
  includePrereleases: boolean,
): AvailableUpdate | null {
  const installed = parseSemVer(current);
  if (!installed) return null;
  let best: { semver: SemVer; update: AvailableUpdate } | null = null;
  for (const release of releases) {
    if (release.draft || (release.prerelease && !includePrereleases)) continue;
    const semver = parseSemVer(release.tag_name);
    if (!semver || compareSemVer(semver, installed) <= 0) continue;
    if (best && compareSemVer(semver, best.semver) <= 0) continue;
    const version = release.tag_name.replace(/^v/, '');
    const apk = pickApk(release, version, abis);
    const checksums = release.assets.find(asset => asset.name === 'checksums.txt');
    if (!apk || !checksums) continue;
    best = {
      semver,
      update: {
        version,
        prerelease: release.prerelease,
        releaseUrl: release.html_url,
        notes: release.body ?? '',
        apk,
        checksumsUrl: checksums.browser_download_url,
      },
    };
  }
  return best?.update ?? null;
}

/** SHA-256 for `fileName` from a `sha256sum` output file, or null. */
export function checksumFor(checksums: string, fileName: string): string | null {
  for (const line of checksums.split(/\r?\n/)) {
    const match = line.trim().match(/^([0-9a-fA-F]{64})\s+\*?(.+)$/);
    if (match && match[2] === fileName) return (match[1] ?? '').toLowerCase();
  }
  return null;
}
