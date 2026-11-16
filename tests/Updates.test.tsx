import { act, fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import React from 'react';

import { App } from '../src/app/App';
import {
  checksumFor,
  compareSemVer,
  findUpdate,
  parseSemVer,
  pickApk,
  type GitHubRelease,
} from '../src/domain/algorithms/releases';
import {
  autoUpdateOnStart,
  checkForUpdates,
  CHECK_INTERVAL_MS,
  downloadAndInstall,
  RELEASES_URL,
} from '../src/features/updates/services/updater';
import NativeNetworkModule from '../src/native/specs/NativeNetworkModule';
import NativeStorageModule from '../src/native/specs/NativeStorageModule';
import NativeUpdateModule from '../src/native/specs/NativeUpdateModule';
import { useSettingsStore } from '../src/stores/settingsStore';
import { useUpdateStore } from '../src/stores/updateStore';
import { wifiSnapshot } from './fixtures/networkSnapshot';

const native = NativeUpdateModule as jest.Mocked<typeof NativeUpdateModule>;
const network = NativeNetworkModule as jest.Mocked<typeof NativeNetworkModule>;
const BASE = 'https://github.com/Krumqnkata/network-toolkit/releases/download';
const SHA = 'ab'.repeat(32);

function release(version: string, prerelease: boolean, abis = ['arm64-v8a']): GitHubRelease {
  return {
    tag_name: `v${version}`,
    draft: false,
    prerelease,
    html_url: `https://github.com/Krumqnkata/network-toolkit/releases/tag/v${version}`,
    published_at: null,
    body: `Notes for ${version}`,
    assets: [
      ...abis.map(abi => ({
        name: `NetworkToolkit-v${version}-${abi}.apk`,
        browser_download_url: `${BASE}/v${version}/NetworkToolkit-v${version}-${abi}.apk`,
        size: 27_000_000,
      })),
      {
        name: `NetworkToolkit-v${version}.apk`,
        browser_download_url: `${BASE}/v${version}/NetworkToolkit-v${version}.apk`,
        size: 73_000_000,
      },
      {
        name: 'checksums.txt',
        browser_download_url: `${BASE}/v${version}/checksums.txt`,
        size: 600,
      },
    ],
  };
}

const releases = [
  release('1.0.0', false),
  release('1.0.0-rc.3', true),
  release('1.0.0-rc.2', true),
];

function mockFetch(list: GitHubRelease[], checksums = '') {
  const fetchMock = jest.fn(async (url: string) => ({
    ok: true,
    status: 200,
    text: async () => (url === RELEASES_URL ? JSON.stringify(list) : checksums),
  }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('versions and releases', () => {
  it('orders SemVer versions, including pre-releases', () => {
    const order = [
      '1.0.0-alpha.1',
      '1.0.0-beta.2',
      '1.0.0-rc.2',
      '1.0.0-rc.10',
      '1.0.0',
      '1.0.1',
      '1.1.0',
    ];
    const parsed = order.map(version => parseSemVer(version)!);
    for (let i = 1; i < parsed.length; i++) {
      expect(compareSemVer(parsed[i - 1]!, parsed[i]!)).toBeLessThan(0);
    }
    expect(compareSemVer(parseSemVer('v2.0.0')!, parseSemVer('2.0.0+build.5')!)).toBe(0);
    expect(parseSemVer('1.0')).toBeNull();
  });

  it('finds the newest applicable release', () => {
    const abis = ['arm64-v8a'];
    expect(findUpdate(releases, '1.0.0-rc.2', abis, true)?.version).toBe('1.0.0');
    expect(findUpdate([release('1.0.0-rc.3', true)], '1.0.0-rc.2', abis, true)?.version).toBe(
      '1.0.0-rc.3',
    );
    expect(findUpdate([release('1.0.0-rc.3', true)], '0.9.0', abis, false)).toBeNull();
    expect(findUpdate(releases, '1.0.0', abis, false)).toBeNull();
    expect(
      findUpdate([{ ...release('2.0.0', false), draft: true }], '1.0.0', abis, false),
    ).toBeNull();
  });

  it('picks the APK for the device ABI, else the universal one', () => {
    const r = release('1.0.0', false, ['arm64-v8a', 'x86_64']);
    expect(pickApk(r, '1.0.0', ['x86_64', 'x86'])?.name).toBe('NetworkToolkit-v1.0.0-x86_64.apk');
    expect(pickApk(r, '1.0.0', ['mips'])?.name).toBe('NetworkToolkit-v1.0.0.apk');
  });

  it('reads checksums', () => {
    const text = `${SHA}  NetworkToolkit-v1.0.0-arm64-v8a.apk\n${'cd'.repeat(
      32,
    )}  NetworkToolkit-v1.0.0.apk\n`;
    expect(checksumFor(text, 'NetworkToolkit-v1.0.0-arm64-v8a.apk')).toBe(SHA);
    expect(checksumFor(text, 'missing.apk')).toBeNull();
  });
});

describe('updater', () => {
  const initialUpdate = useUpdateStore.getState();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    useUpdateStore.setState(initialUpdate, true);
    network.getNetworkSnapshot.mockResolvedValue(wifiSnapshot);
    native.startDownload.mockClear();
    native.install.mockClear();
    native.getDownloadStatus.mockResolvedValue({
      state: 'done',
      bytes: 10,
      total: 10,
      path: '/data/cache/updates/NetworkToolkit-v1.0.0-arm64-v8a.apk',
      error: null,
    });
    native.canRequestInstalls.mockResolvedValue(true);
    native.getInstallStatus.mockResolvedValue({ state: 'success', message: null });
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('downloads the right APK with its checksum and installs it on Wi-Fi', async () => {
    mockFetch(releases, `${SHA}  NetworkToolkit-v1.0.0-arm64-v8a.apk\n`);

    await autoUpdateOnStart();

    expect(native.startDownload).toHaveBeenCalledWith(
      `${BASE}/v1.0.0/NetworkToolkit-v1.0.0-arm64-v8a.apk`,
      SHA,
      'NetworkToolkit-v1.0.0-arm64-v8a.apk',
    );
    expect(native.install).toHaveBeenCalledWith(
      '/data/cache/updates/NetworkToolkit-v1.0.0-arm64-v8a.apk',
    );
    expect(await NativeStorageModule.getSetting('update.lastCheck')).not.toBeNull();
  });

  it('only offers the update on metered networks', async () => {
    mockFetch(releases);
    network.getNetworkSnapshot.mockResolvedValue({ ...wifiSnapshot, isMetered: true });

    await autoUpdateOnStart();

    expect(useUpdateStore.getState()).toMatchObject({ phase: 'available' });
    expect(native.startDownload).not.toHaveBeenCalled();
  });

  it('respects the setting and the check interval', async () => {
    const fetchMock = mockFetch(releases);
    await NativeStorageModule.setSetting('update.auto', 'false');
    await autoUpdateOnStart();
    expect(fetchMock).not.toHaveBeenCalled();

    await NativeStorageModule.setSetting('update.auto', 'true');
    await NativeStorageModule.setSetting(
      'update.lastCheck',
      String(Date.now() - CHECK_INTERVAL_MS / 2),
    );
    await autoUpdateOnStart();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('asks for the install permission first when it is missing', async () => {
    mockFetch(releases, `${SHA}  NetworkToolkit-v1.0.0-arm64-v8a.apk\n`);
    native.canRequestInstalls.mockResolvedValue(false);
    await checkForUpdates();

    await downloadAndInstall();

    expect(useUpdateStore.getState().phase).toBe('needs-permission');
    expect(native.install).not.toHaveBeenCalled();
  });

  it('refuses to install without a checksum', async () => {
    mockFetch(releases, 'nothing here');
    await checkForUpdates();

    await downloadAndInstall();

    expect(useUpdateStore.getState()).toMatchObject({ phase: 'error' });
    expect(useUpdateStore.getState().error).toMatch(/checksums.txt has no entry/);
    expect(native.startDownload).not.toHaveBeenCalled();
  });

  it('reports up to date and skips development builds', async () => {
    mockFetch([release('1.0.0-rc.2', true)]);
    await checkForUpdates();
    expect(useUpdateStore.getState().phase).toBe('up-to-date');

    native.getInstallInfo.mockResolvedValueOnce({
      versionName: '1.0.0-rc.2-debug',
      versionCode: 1000000,
      abis: ['arm64-v8a'],
      sdkInt: 34,
      canRequestInstalls: true,
      silentUpdates: true,
      debuggable: true,
    });
    await checkForUpdates();
    expect(useUpdateStore.getState().phase).toBe('unsupported');
  });
});

describe('update UI', () => {
  const initial = { settings: useSettingsStore.getState(), update: useUpdateStore.getState() };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    useSettingsStore.setState(initial.settings, true);
    useUpdateStore.setState(initial.update, true);
    network.getNetworkSnapshot.mockResolvedValue({ ...wifiSnapshot, isMetered: true });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('shows an available update on the home screen', async () => {
    mockFetch(releases);
    await render(<App />);

    expect(await screen.findByTestId('update-banner')).toHaveTextContent(
      /Version 1.0.0 is available/,
    );
    expect(screen.getByTestId('update-install')).toBeOnTheScreen();
  });

  it('turns automatic updates off and checks manually in settings', async () => {
    mockFetch([]);
    const user = userEvent.setup();
    await render(<App />);
    await user.press(screen.getByRole('button', { name: 'Settings' }));

    await user.press(await screen.findByTestId('check-updates'));
    expect(await screen.findByText('You have the latest version.')).toBeOnTheScreen();

    await act(async () => {
      fireEvent(screen.getByTestId('auto-update'), 'valueChange', false);
    });
    expect(useUpdateStore.getState().autoUpdate).toBe(false);
    expect(await NativeStorageModule.getSetting('update.auto')).toBe('false');
  });
});
