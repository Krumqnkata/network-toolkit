import { act, render, screen, userEvent, within } from '@testing-library/react-native';
import React from 'react';
import { Share } from 'react-native';

import { App } from '../src/app/App';
import { useSurveyStore } from '../src/features/wifi-survey/services/survey';
import NativeNetToolsModule from '../src/native/specs/NativeNetToolsModule';
import NativeNetworkModule from '../src/native/specs/NativeNetworkModule';
import { offlineSnapshot, wifiSnapshot } from './fixtures/networkSnapshot';

const tools = NativeNetToolsModule as jest.Mocked<typeof NativeNetToolsModule>;
const network = NativeNetworkModule as jest.Mocked<typeof NativeNetworkModule>;

const withRssi = (rssi: number) => ({ ...wifiSnapshot, wifi: { ...wifiSnapshot.wifi!, rssi } });

async function openSurvey() {
  const user = userEvent.setup();
  await render(<App />);
  await user.press(screen.getByRole('button', { name: /^Tools, tab/ }));
  await user.press(screen.getByRole('button', { name: /^Wi-Fi by Room/ }));
  return user;
}

describe('Wi-Fi by room', () => {
  beforeEach(() => {
    useSurveyStore.setState({ survey: null, measuring: null, progress: 0, error: null });
    tools.ping.mockReset().mockImplementation(async host => ({
      address: host,
      family: 'ipv4',
      method: 'icmp',
      status: 'reply',
      rttMs: 4,
      ttl: 64,
      from: host,
    }));
  });

  afterEach(() => jest.restoreAllMocks());

  it('measures rooms, compares them and explains what to do', async () => {
    network.getNetworkSnapshot.mockResolvedValue(withRssi(-48));
    const user = await openSurvey();

    // An empty name is not measured.
    await user.press(screen.getByTestId('survey-measure'));
    expect(screen.getByText('Type the name of the room first.')).toBeOnTheScreen();

    await user.press(screen.getByTestId('survey-suggestion-Living room'));
    await user.press(screen.getByTestId('survey-measure'));
    expect(await screen.findByTestId('survey-room-Living room')).toBeOnTheScreen();
    expect(screen.getByTestId('survey-advice-measure-more')).toBeOnTheScreen();
    // Measured rooms leave the suggestions.
    expect(screen.queryByTestId('survey-suggestion-Living room')).toBeNull();

    network.getNetworkSnapshot.mockResolvedValue(withRssi(-84));
    await user.type(screen.getByTestId('survey-room'), 'Balcony');
    await user.press(screen.getByTestId('survey-measure'));
    await screen.findByTestId('survey-room-Balcony');

    const balcony = screen.getByTestId('survey-room-Balcony');
    expect(balcony.props.accessibilityLabel).toMatch(/^Balcony: Very weak, -84 dBm · 5 GHz/);
    expect(within(balcony).getByText('Weakest')).toBeOnTheScreen();
    expect(screen.getByTestId('survey-advice-dead-zone')).toHaveTextContent(
      /Almost no signal.*In Balcony calls and videos will drop/,
    );
    expect(screen.getByTestId('survey-advice-add-access-point')).toBeOnTheScreen();
    expect(tools.ping).toHaveBeenCalledWith('192.168.1.1', 'ipv4', 0, 800);

    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    await user.press(screen.getByTestId('survey-share'));
    const message = (share.mock.calls[0]?.[0] as { message: string }).message;
    expect(message).toContain('Network Toolkit — Wi-Fi by room');
    expect(message).toContain('Balcony: Very weak — -84 dBm · 5 GHz');

    await user.press(screen.getByTestId('survey-finish'));
    await act(async () => {
      await new Promise<void>(resolve => setTimeout(resolve, 50));
    });
    expect(screen.queryByTestId('survey-room-Balcony')).toBeNull();
    expect(screen.getByText('Previous checks')).toBeOnTheScreen();
    expect(screen.getByText('2 rooms · 1 weak')).toBeOnTheScreen();
  });

  it('removes a room', async () => {
    network.getNetworkSnapshot.mockResolvedValue(withRssi(-60));
    const user = await openSurvey();
    await user.press(screen.getByTestId('survey-suggestion-Kitchen'));
    await user.press(screen.getByTestId('survey-measure'));
    await screen.findByTestId('survey-room-Kitchen');

    await user.press(screen.getByTestId('survey-remove-Kitchen'));
    expect(screen.queryByTestId('survey-room-Kitchen')).toBeNull();
  });

  it('asks to connect to Wi-Fi first', async () => {
    network.getNetworkSnapshot.mockResolvedValue(offlineSnapshot);
    const user = await openSurvey();
    await user.press(screen.getByTestId('survey-suggestion-Office'));
    await user.press(screen.getByTestId('survey-measure'));
    expect(await screen.findByTestId('survey-not-wifi')).toBeOnTheScreen();
  });
});
