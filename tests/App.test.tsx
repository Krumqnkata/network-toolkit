import { render, screen, userEvent, within } from '@testing-library/react-native';
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

  it('starts on the home screen with all main tabs available', async () => {
    await render(<App />);

    expect(await screen.findByRole('header', { name: 'Wi-Fi' })).toBeOnTheScreen();
    for (const tab of ['Home', 'Wi-Fi', 'Speed', 'Devices', 'Tools']) {
      // Tab buttons are announced as "<label>, tab, n of m".
      expect(screen.getByRole('button', { name: new RegExp(`^${tab}, tab`) })).toBeOnTheScreen();
    }
    expect(screen.getByRole('button', { name: 'Settings' })).toBeOnTheScreen();
  });

  it('opens the speed test and the LAN scanner from the home screen', async () => {
    const user = userEvent.setup();
    await render(<App />);

    await user.press(await screen.findByTestId('home-run-speed'));
    expect(await screen.findByRole('header', { name: 'Speed Test' })).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: /^Home, tab/ }));
    await user.press(screen.getByRole('button', { name: 'Open Devices' }));
    expect(await screen.findByRole('header', { name: 'LAN Scanner' })).toBeOnTheScreen();
  });

  it('opens the tools list', async () => {
    const user = userEvent.setup();
    await render(<App />);

    await user.press(screen.getByRole('button', { name: /^Tools, tab/ }));

    expect(await screen.findByRole('header', { name: 'Tools' })).toBeOnTheScreen();
    expect(screen.getByText('Ping')).toBeOnTheScreen();
    expect(screen.getByText('DNS Lookup')).toBeOnTheScreen();
  });

  it('changes the theme preference from settings', async () => {
    const user = userEvent.setup();
    await render(<App />);

    await user.press(screen.getByRole('button', { name: /^Settings/ }));
    const themeGroup = await screen.findByTestId('theme-options');
    await user.press(within(themeGroup).getByRole('radio', { name: 'Light' }));

    expect(useSettingsStore.getState().themePreference).toBe('light');
    expect(within(themeGroup).getByRole('radio', { name: 'Light' })).toBeChecked();
    expect(within(themeGroup).getByRole('radio', { name: 'System' })).not.toBeChecked();

    await user.press(screen.getByTestId('screen-back'));
    expect(await screen.findByTestId('home-run-speed')).toBeOnTheScreen();
  });

  it('switches the whole interface to Bulgarian', async () => {
    const user = userEvent.setup();
    await render(<App />);

    await user.press(screen.getByRole('button', { name: /^Settings/ }));
    const languageGroup = await screen.findByTestId('language-options');
    await user.press(within(languageGroup).getByRole('radio', { name: 'Български' }));

    expect(useSettingsStore.getState().languagePreference).toBe('bg');
    expect(await screen.findByRole('header', { name: 'Настройки' })).toBeOnTheScreen();
    await user.press(screen.getByTestId('screen-back'));
    for (const tab of ['Начало', 'Wi-Fi', 'Скорост', 'Устройства', 'Инструменти']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${tab}, `) })).toBeOnTheScreen();
    }
  });
});
