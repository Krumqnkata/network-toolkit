import { render, screen, userEvent, waitFor, within } from '@testing-library/react-native';
import React from 'react';

import { App } from '../src/app/App';
import NativeLanModule from '../src/native/specs/NativeLanModule';
import NativeNetToolsModule from '../src/native/specs/NativeNetToolsModule';
import NativeNetworkModule from '../src/native/specs/NativeNetworkModule';
import NativeStorageModule from '../src/native/specs/NativeStorageModule';
import { useLanStore } from '../src/stores/lanStore';
import { useTopologyStore } from '../src/stores/topologyStore';
import { offlineSnapshot, wifiSnapshot } from './fixtures/networkSnapshot';

const lan = NativeLanModule as jest.Mocked<typeof NativeLanModule>;
const tools = NativeNetToolsModule as jest.Mocked<typeof NativeNetToolsModule>;
const network = NativeNetworkModule as jest.Mocked<typeof NativeNetworkModule>;

const RTT: Record<string, number> = {
  '192.168.1.1': 3,
  '192.168.0.1': 4,
  '85.11.0.1': 12,
  '1.1.1.1': 18,
};

async function openMap() {
  const user = userEvent.setup();
  await render(<App />);
  await user.press(screen.getByRole('button', { name: /^Devices, tab/ }));
  await user.press(screen.getByRole('radio', { name: 'Map' }));
  return user;
}

describe('Network map', () => {
  const initial = { lan: useLanStore.getState(), topology: useTopologyStore.getState() };

  beforeEach(() => {
    useLanStore.setState(initial.lan, true);
    useTopologyStore.setState(initial.topology, true);
    NativeStorageModule.setSetting('update.auto', 'false');
    network.getNetworkSnapshot.mockResolvedValue(wifiSnapshot);
    tools.ping.mockReset().mockImplementation(async (host, _family, ttl) => {
      const base = { address: host, family: 'ipv4', method: 'icmp', ttl: 57 };
      if (host === '1.1.1.1' && ttl > 0 && ttl < 4) {
        const from = ['192.168.1.1', '192.168.0.1', '85.11.0.1'][ttl - 1];
        return { ...base, status: 'ttl-exceeded', rttMs: null, from };
      }
      return { ...base, status: 'reply', rttMs: RTT[host] ?? 5, from: host };
    });
    tools.dnsQuery.mockReset().mockResolvedValue({
      server: 'system',
      durationMs: 2,
      rcode: 3,
      authoritative: false,
      truncated: false,
      answers: [],
      authority: [],
    });
    lan.probeHosts.mockReset().mockImplementation(async hosts => ({
      hosts: hosts.map(address => ({
        address,
        alive: address === '192.168.1.1' || address === '192.168.1.40',
        method: 'tcp',
        rttMs: address === '192.168.1.40' ? 90 : 3,
        openPorts: address === '192.168.1.40' ? [9100] : [80],
      })),
    }));
    lan.mdnsQuery.mockReset().mockResolvedValue({ replies: [] });
    lan.ssdpSearch.mockReset().mockResolvedValue({ replies: [] });
    lan.netbiosQuery.mockReset().mockResolvedValue({ hosts: [] });
  });

  it('builds the map from the path, the router and the devices on the network', async () => {
    const user = await openMap();
    await user.press(screen.getByTestId('topology-build'));

    expect(await screen.findByTestId('topo-node-lan-192.168.1.40')).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByTestId('topology-build')).toBeOnTheScreen());

    for (const id of ['internet', 'hop-3', 'hop-2', 'router', 'self']) {
      expect(screen.getByTestId(`topo-node-${id}`)).toBeOnTheScreen();
    }
    // The gateway (TTL 1) is the router node, not a separate hop.
    expect(screen.queryByTestId('topo-node-hop-1')).toBeNull();
    expect(screen.getByTestId('topo-node-self')).toHaveTextContent(/This phone/);
    expect(screen.getByTestId('topo-node-lan-192.168.1.40')).toHaveTextContent(/Printer/);
    expect(screen.getByTestId('topology-note-double-nat')).toHaveTextContent(/double NAT/);
    expect(screen.getByTestId('topology-status')).toHaveTextContent(/^Built at/);

    await user.press(screen.getByTestId('topo-node-hop-3'));
    const details = screen.getByTestId('topology-details');
    expect(within(details).getByText('85.11.0.1')).toBeOnTheScreen();
    expect(
      within(details).getByText('Router of your provider or on the internet'),
    ).toBeOnTheScreen();
    expect(within(details).getByText('+6 ms')).toBeOnTheScreen();

    await user.press(screen.getByTestId('topo-node-lan-192.168.1.40'));
    expect(
      within(screen.getByTestId('topology-details')).getByTestId('topology-link'),
    ).toHaveTextContent(/Local network · Very slow/);
    await user.press(screen.getByTestId('topology-open-device'));
    expect(await screen.findByTestId('device-ports')).toBeOnTheScreen();
  });

  it('asks to connect when there is no network', async () => {
    network.getNetworkSnapshot.mockResolvedValue(offlineSnapshot);
    const user = await openMap();
    await user.press(screen.getByTestId('topology-build'));
    expect(await screen.findByTestId('topology-offline')).toHaveTextContent(
      'Connect to a network to build its map.',
    );
    expect(screen.queryByTestId('topology-map')).toBeNull();
  });
});
