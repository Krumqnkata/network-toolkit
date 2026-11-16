import { render, screen, userEvent } from '@testing-library/react-native';
import React from 'react';
import { Alert, Linking } from 'react-native';

import { App } from '../src/app/App';
import { PRIVACY_URL } from '../src/app/config/appInfo';
import { monitorSessions, speedResults } from '../src/database/repositories';
import NativeStorageModule from '../src/native/specs/NativeStorageModule';
import { useSettingsStore } from '../src/stores/settingsStore';
import { doneResult } from './fixtures/speed';

async function openSettings() {
  const user = userEvent.setup();
  await render(<App />);
  await user.press(screen.getByRole('button', { name: /^Settings/ }));
  return user;
}

describe('Settings data and about', () => {
  const initialSettings = useSettingsStore.getState();

  beforeEach(() => useSettingsStore.setState(initialSettings, true));
  afterEach(() => jest.restoreAllMocks());

  it('deletes saved history after confirmation but keeps settings', async () => {
    await NativeStorageModule.setSetting('theme', 'dark');
    await speedResults.add(doneResult);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _body, buttons) => {
      buttons?.find(button => button.style === 'destructive')?.onPress?.();
    });
    const user = await openSettings();

    await user.press(screen.getByTestId('clear-history'));

    expect(alert).toHaveBeenCalledWith(
      'Delete saved history?',
      expect.any(String),
      expect.any(Array),
    );
    expect(await screen.findByTestId('history-cleared')).toBeOnTheScreen();
    expect(await speedResults.list()).toEqual([]);
    expect(await monitorSessions.list()).toEqual([]);
    expect(await NativeStorageModule.getSetting('theme')).toBe('dark');
  });

  it('keeps history when the dialog is cancelled', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await speedResults.add(doneResult);
    const user = await openSettings();

    await user.press(screen.getByTestId('clear-history'));

    expect(screen.queryByTestId('history-cleared')).toBeNull();
    expect(await speedResults.list()).toHaveLength(1);
  });

  it('opens the privacy statement', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const user = await openSettings();

    await user.press(screen.getByTestId('about-privacy'));

    expect(open).toHaveBeenCalledWith(PRIVACY_URL);
  });

  it('starts in the saved language', async () => {
    await NativeStorageModule.setSetting('language', 'bg');
    await render(<App />);

    expect(await screen.findByRole('button', { name: /^Настройки/ })).toBeOnTheScreen();
    expect(useSettingsStore.getState().languagePreference).toBe('bg');
  });
});
