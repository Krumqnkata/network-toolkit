/// <reference types="node" />
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Mirrors the versionCode formula of android/app/build.gradle (Gradle cannot
 * run under Jest) and checks that the Gradle file still uses it.
 */
const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta|rc)\.(\d+))?$/;
const STAGE: Record<string, number> = { alpha: 100, beta: 300, rc: 500 };

function versionCode(version: string): number {
  const match = version.match(SEMVER);
  if (!match) throw new Error(`invalid version ${version}`);
  const [major, minor, patch] = match.slice(1, 4).map(Number) as [number, number, number];
  const stage = match[4];
  const rank = stage ? (STAGE[stage] as number) + Number(match[5]) : 999;
  return major * 10_000_000 + minor * 100_000 + patch * 1_000 + rank;
}

/** Scheme used up to 1.0.0-rc.4: pre-releases shared their release's code. */
function legacyVersionCode(version: string): number {
  const [major, minor, patch] = version.split('-')[0]!.split('.').map(Number) as [
    number,
    number,
    number,
  ];
  return major * 1_000_000 + minor * 1_000 + patch;
}

describe('versionCode', () => {
  it('increases with every pre-release and release', () => {
    const order = [
      '1.0.0-alpha.1',
      '1.0.0-beta.2',
      '1.0.0-rc.5',
      '1.0.0-rc.10',
      '1.0.0',
      '1.0.1-rc.1',
      '1.0.1',
      '1.1.0',
      '2.0.0',
    ];
    for (let i = 1; i < order.length; i++) {
      expect(versionCode(order[i]!)).toBeGreaterThan(versionCode(order[i - 1]!));
    }
  });

  it('stays above the codes of already installed builds', () => {
    expect(legacyVersionCode('1.0.0-rc.3')).toBe(legacyVersionCode('1.0.0-rc.4'));
    expect(versionCode('1.0.0-rc.5')).toBeGreaterThan(legacyVersionCode('1.0.0-rc.4'));
    expect(versionCode('1.0.0-rc.5')).toBe(10_000_505);
    expect(versionCode('200.99.99')).toBeLessThanOrEqual(2_100_000_000);
  });

  it('matches the formula in build.gradle and the current version', () => {
    const gradle = readFileSync(join(__dirname, '../android/app/build.gradle'), 'utf8');
    expect(gradle).toContain('major * 10_000_000 + minor * 100_000 + patch * 1_000 + stageRank');
    expect(gradle).toContain('[alpha: 100, beta: 300, rc: 500][stage] + stageNumber : 999');
    const { version } = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8')) as {
      version: string;
    };
    expect(() => versionCode(version)).not.toThrow();
  });
});
