import { render, screen, userEvent, within } from '@testing-library/react-native';
import React from 'react';
import { Share } from 'react-native';

import { App } from '../src/app/App';
import NativeLanModule from '../src/native/specs/NativeLanModule';
import NativeNetworkModule from '../src/native/specs/NativeNetworkModule';
import NativeStorageModule from '../src/native/specs/NativeStorageModule';
import { useLanStore } from '../src/stores/lanStore';
import { cellularSnapshot, wifiSnapshot } from './fixtures/networkSnapshot';
import { FAULT_REPLY, IGD_DESCRIPTION, MAPPING_REPLY } from './fixtures/upnp';

const lan = NativeLanModule as jest.Mocked<typeof NativeLanModule>;
const network = NativeNetworkModule as jest.Mocked<typeof NativeNetworkModule>;

async function openCheck() {
  const user = userEvent.setup();
  await render(<App />);
  await user.press(screen.getByRole('button', { name: /^Tools, tab/ }));
  await user.press(screen.getByRole('button', { name: /^Security Check/ }));
  return user;
}

describe('Security check', () => {
  const initialLan = useLanStore.getState();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    useLanStore.setState(initialLan, true);
    NativeStorageModule.setSetting('update.auto', 'false');
    network.getNetworkSnapshot.mockResolvedValue({
      ...wifiSnapshot,
      wifi: { ...wifiSnapshot.wifi!, security: 'wpa-personal' },
      privateDnsActive: false,
    });
    lan.scanPorts.mockReset().mockImplementation(async (host, ports) => ({
      address: host,
      ports: ports.map(port => ({
        port,
        status: port === 23 || port === 80 ? 'open' : 'refused',
        connectMs: 2,
      })),
    }));
    lan.ssdpSearch.mockReset().mockResolvedValue({
      replies: [
        {
          from: '192.168.1.1',
          server: 'Linux UPnP/1.1 MiniUPnPd/2.3',
          location: 'http://192.168.1.1:5000/rootDesc.xml',
          st: 'urn:schemas-upnp-org:device:InternetGatewayDevice:1',
          usn: 'uuid:1::urn:schemas-upnp-org:device:InternetGatewayDevice:1',
        },
      ],
    });
    lan.readBanner.mockReset().mockImplementation(async (host, port, payload) => {
      const text = payload.includes('<NewPortMappingIndex>0<') ? MAPPING_REPLY : FAULT_REPLY;
      return { address: host, port, text, bytes: text.length, connectMs: 2 };
    });
    lan.probeHosts.mockReset().mockImplementation(async hosts => ({
      hosts: hosts.map(address => ({
        address,
        alive: true,
        method: 'tcp',
        rttMs: 2,
        openPorts: address === '192.168.1.70' ? [23] : [],
      })),
    }));
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => IGD_DESCRIPTION,
    })) as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it('finds risks on the router, in UPnP and on devices, and explains them', async () => {
    useLanStore.setState({
      devices: [
        {
          address: '192.168.1.70',
          isSelf: false,
          isGateway: false,
          source: 'tcp',
          rttMs: 3,
          openPorts: [554],
          hostname: null,
          mdnsHost: null,
          services: [],
          netbiosName: null,
          workgroup: null,
          mac: null,
          upnp: {
            friendlyName: 'Garden camera',
            manufacturer: null,
            modelName: null,
            deviceType: null,
            server: null,
          },
          fingerprint: null,
        },
      ],
    });
    const user = await openCheck();

    await user.press(screen.getByTestId('security-run'));

    expect(await screen.findByTestId('security-score')).toHaveTextContent(
      /Your network is at risk/,
    );
    expect(screen.getByTestId('security-router-telnet')).toHaveTextContent(
      /Risk.*Telnet is open on the router/,
    );
    expect(screen.getByTestId('security-devices-telnet')).toHaveTextContent(
      /1 device has Telnet open.*Garden camera \(192\.168\.1\.70\)/,
    );
    expect(screen.getByTestId('security-port-forwards')).toHaveTextContent(
      /1 port is open to the internet.*TCP 51413 → 192\.168\.1\.20:51413 \(Transmission at 51413\)/,
    );
    expect(screen.getByTestId('security-wps')).toHaveTextContent(/WPS is on/);
    expect(screen.getByTestId('security-router-admin')).toHaveTextContent(/without HTTPS/);
    expect(screen.getByTestId('security-encryption')).toHaveTextContent(
      /Wi-Fi is encrypted \(WPA3\)/,
    );
    // The port list is read with the router's own UPnP interface, and only from the router.
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://192.168.1.1:5000/rootDesc.xml',
      expect.anything(),
    );
    expect(lan.readBanner).toHaveBeenCalledTimes(2);
    expect(lan.readBanner.mock.calls[0]?.[0]).toBe('192.168.1.1');

    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    await user.press(screen.getByTestId('security-share'));
    const message = (share.mock.calls[0]?.[0] as { message: string }).message;
    expect(message).toContain('Network Toolkit — security check');
    expect(message).toContain('[Risk] Telnet is open on the router');
  });

  it('asks for a network scan before checking devices', async () => {
    const user = await openCheck();
    await user.press(screen.getByTestId('security-run'));
    const devices = await screen.findByTestId('security-devices-telnet');
    expect(devices).toHaveTextContent(/Not checked.*Devices not checked/);
    await user.press(within(devices).getByTestId('security-scan-first'));
    expect(await screen.findByTestId('lan-scan')).toBeOnTheScreen();
  });

  it('needs a home network', async () => {
    network.getNetworkSnapshot.mockResolvedValue(cellularSnapshot);
    const user = await openCheck();
    await user.press(screen.getByTestId('security-run'));
    expect(await screen.findByTestId('security-not-local')).toBeOnTheScreen();
  });
});
