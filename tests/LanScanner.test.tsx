import { act, render, screen, userEvent } from '@testing-library/react-native';
import React from 'react';

import { App } from '../src/app/App';
import NativeLanModule from '../src/native/specs/NativeLanModule';
import NativeNetToolsModule from '../src/native/specs/NativeNetToolsModule';
import NativeNetworkModule from '../src/native/specs/NativeNetworkModule';
import { useLanStore } from '../src/stores/lanStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { offlineSnapshot, wifiSnapshot } from './fixtures/networkSnapshot';

const lan = NativeLanModule as jest.Mocked<typeof NativeLanModule>;
const tools = NativeNetToolsModule as jest.Mocked<typeof NativeNetToolsModule>;
const network = NativeNetworkModule as jest.Mocked<typeof NativeNetworkModule>;

const dnsResult = (answers: { name: string; type: number; ttl: number; data: string }[] = []) => ({
  server: 'system',
  durationMs: 2,
  rcode: answers.length ? 0 : 3,
  authoritative: false,
  truncated: false,
  answers,
  authority: [],
});

async function openTool(name: RegExp) {
  const user = userEvent.setup();
  await render(<App />);
  await user.press(screen.getByRole('button', { name: /^Tools/ }));
  await user.press(screen.getByRole('button', { name }));
  return user;
}

describe('LAN scanner', () => {
  const initial = { settings: useSettingsStore.getState(), lan: useLanStore.getState() };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    useSettingsStore.setState(initial.settings, true);
    useLanStore.setState(initial.lan, true);
    network.getNetworkSnapshot.mockResolvedValue(wifiSnapshot);
    lan.probeHosts.mockReset().mockImplementation(async hosts => ({
      hosts: hosts.map(address => ({
        address,
        alive: address === '192.168.1.1' || address === '192.168.1.20',
        method: address === '192.168.1.20' ? 'icmp' : 'tcp',
        rttMs: 2,
        openPorts: address === '192.168.1.1' ? [80, 443] : [],
      })),
    }));
    lan.mdnsQuery.mockReset().mockImplementation(async (_local, names) => ({
      replies: names.includes('_googlecast._tcp.local')
        ? [
            {
              from: '192.168.1.30',
              records: [
                {
                  name: '_googlecast._tcp.local',
                  type: 12,
                  ttl: 120,
                  data: 'Chromecast-1._googlecast._tcp.local',
                },
                {
                  name: 'Chromecast-1._googlecast._tcp.local',
                  type: 33,
                  ttl: 120,
                  data: '0 0 8009 cc1.local',
                },
                {
                  name: 'Chromecast-1._googlecast._tcp.local',
                  type: 16,
                  ttl: 120,
                  data: '"fn=Living Room TV" "md=Chromecast"',
                },
                { name: 'cc1.local', type: 1, ttl: 120, data: '192.168.1.30' },
              ],
            },
          ]
        : [],
    }));
    lan.ssdpSearch.mockReset().mockResolvedValue({
      replies: [
        {
          from: '192.168.1.1',
          server: 'Linux UPnP/1.1 MiniUPnPd/2.3',
          location: 'http://192.168.1.1:5000/rootDesc.xml',
          st: 'upnp:rootdevice',
          usn: 'uuid:1',
        },
        // A description URL that points elsewhere must not be fetched.
        {
          from: '192.168.1.50',
          server: null,
          location: 'http://203.0.113.9/desc.xml',
          st: 'upnp:rootdevice',
          usn: 'uuid:2',
        },
      ],
    });
    lan.scanPorts.mockReset();
    lan.netbiosQuery.mockReset().mockResolvedValue({
      hosts: [
        {
          address: '192.168.1.20',
          name: 'DESKTOP-1',
          workgroup: 'WORKGROUP',
          mac: '3C:52:82:01:02:03',
        },
      ],
    });
    tools.dnsQuery
      .mockReset()
      .mockImplementation(async name =>
        dnsResult(
          name === '1.1.168.192.in-addr.arpa'
            ? [{ name, type: 12, ttl: 60, data: 'router.lan' }]
            : [],
        ),
      );
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      text: async () =>
        '<root><device><deviceType>urn:schemas-upnp-org:device:InternetGatewayDevice:1</deviceType><friendlyName>Home Router</friendlyName><manufacturer>Acme</manufacturer><modelName>R-1</modelName></device></root>',
    })) as unknown as typeof fetch;
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it('finds devices by probes, mDNS, SSDP and NetBIOS and names them', async () => {
    const user = await openTool(/^LAN Scanner/);

    await user.press(screen.getByTestId('lan-scan'));

    expect(await screen.findByText(/^Last scan /)).toBeOnTheScreen();
    expect(lan.probeHosts).toHaveBeenCalledTimes(8); // 253 other hosts in batches of 32
    expect(lan.probeHosts.mock.calls[0]?.[1]).toEqual([80, 443, 22, 445, 139, 62078, 8080, 554]);
    expect(screen.getByText('5 devices')).toBeOnTheScreen();
    expect(screen.getByText('Home Router')).toBeOnTheScreen();
    expect(screen.getByText('192.168.1.1 · Acme R-1')).toBeOnTheScreen();
    expect(screen.getByText('Living Room TV')).toBeOnTheScreen();
    expect(screen.getByText('DESKTOP-1')).toBeOnTheScreen();
    expect(screen.getByTestId('lan-device-192.168.1.23')).toHaveTextContent(/This device/);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://192.168.1.1:5000/rootDesc.xml',
      expect.anything(),
    );
  });

  it('opens device details and starts a port scan for it', async () => {
    lan.scanPorts.mockReset().mockImplementation(async (host, ports) => ({
      address: host,
      ports: ports.map(port => ({
        port,
        status: port === 22 || port === 445 ? 'open' : port === 80 ? 'timeout' : 'refused',
        connectMs: port === 80 ? null : 4,
      })),
    }));
    const user = await openTool(/^LAN Scanner/);
    await user.press(screen.getByTestId('lan-scan'));
    await screen.findByText(/^Last scan /);

    await user.press(screen.getByTestId('lan-device-192.168.1.20'));
    expect(await screen.findByLabelText('NetBIOS name: DESKTOP-1')).toBeOnTheScreen();
    expect(screen.getByLabelText('MAC address: 3C:52:82:01:02:03')).toBeOnTheScreen();
    expect(screen.getByLabelText('Found by: ICMP')).toBeOnTheScreen();

    await user.press(screen.getByTestId('device-ports'));
    await user.press(screen.getByTestId('ports-start'));

    expect(await screen.findByTestId('open-port-22')).toBeOnTheScreen();
    expect(lan.scanPorts.mock.calls[0]?.[0]).toBe('192.168.1.20');
    expect(screen.getByLabelText('445 SMB')).toBeOnTheScreen();
    expect(screen.getByTestId('ports-summary')).toHaveTextContent(
      /2 open · \d+ closed · 1 no reply/,
    );
  });

  it('explains that a scan needs Wi-Fi or Ethernet', async () => {
    network.getNetworkSnapshot.mockResolvedValue(offlineSnapshot);
    const user = await openTool(/^LAN Scanner/);

    await user.press(screen.getByTestId('lan-scan'));

    expect(await screen.findByTestId('tool-error')).toHaveTextContent(
      /Connect to Wi-Fi or Ethernet/,
    );
    expect(lan.probeHosts).not.toHaveBeenCalled();
  });

  it('stops a running scan between batches', async () => {
    let release: () => void = () => {};
    lan.probeHosts.mockImplementationOnce(
      hosts =>
        new Promise(resolve => {
          release = () =>
            resolve({
              hosts: hosts.map(address => ({
                address,
                alive: false,
                method: null,
                rttMs: null,
                openPorts: [],
              })),
            });
        }),
    );
    const user = await openTool(/^LAN Scanner/);
    await user.press(screen.getByTestId('lan-scan'));
    await user.press(await screen.findByTestId('lan-stop'));
    await act(async () => release());

    expect(lan.probeHosts).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('lan-scan')).toBeOnTheScreen();
  });

  it('validates custom port lists', async () => {
    const user = await openTool(/^Port Scanner/);
    await user.type(screen.getByTestId('ports-host'), '192.168.1.1');
    await user.press(screen.getByRole('radio', { name: 'Custom' }));
    await user.type(screen.getByTestId('ports-custom'), '80-20');
    await user.press(screen.getByTestId('ports-start'));

    expect(screen.getByText(/Enter ports from 1 to 65535/)).toBeOnTheScreen();
    expect(lan.scanPorts).not.toHaveBeenCalled();
  });
});
