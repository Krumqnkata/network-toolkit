import { render, screen, userEvent } from '@testing-library/react-native';
import React from 'react';

import { App } from '../src/app/App';
import { useSettingsStore } from '../src/stores/settingsStore';

describe('App shell', () => {
  const initialSettings = useSettingsStore.getState();

  beforeEach(() => {
    // Reset before rendering so no mounted component observes the change.
    useSettingsStore.setState(initialSettings, true);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts on the dashboard with all main tabs available', async () => {
    await render(<App />);

    expect(screen.getByRole('header', { name: 'Network Toolkit' })).toBeOnTheScreen();
    for (const tab of ['Dashboard', 'Wi-Fi', 'Tools', 'Settings']) {
      // Tab buttons are announced as "<label>, tab, n of m".
      expect(screen.getByRole('button', { name: new RegExp(`^${tab}`) })).toBeOnTheScreen();
    }
  });

  it('opens the tools list from the dashboard quick actions', async () => {
    const user = userEvent.setup();
    await render(<App />);

    await user.press(screen.getByRole('button', { name: 'Open Network Tools' }));

    expect(await screen.findByRole('header', { name: 'Tools' })).toBeOnTheScreen();
    expect(screen.getByText('Ping')).toBeOnTheScreen();
    expect(screen.getByText('DNS Lookup')).toBeOnTheScreen();
  });

  it('changes the theme preference from settings', async () => {
    const user = userEvent.setup();
    await render(<App />);

    await user.press(screen.getByRole('button', { name: /Settings/ }));
    await user.press(await screen.findByRole('radio', { name: 'Light' }));

    expect(useSettingsStore.getState().themePreference).toBe('light');
    expect(screen.getByRole('radio', { name: 'Light' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'System' })).not.toBeChecked();
  });
});
