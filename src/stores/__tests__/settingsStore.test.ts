import { THEME_PREFERENCES, useSettingsStore } from '../settingsStore';

describe('settingsStore', () => {
  const initialState = useSettingsStore.getState();

  afterEach(() => {
    useSettingsStore.setState(initialState, true);
  });

  it('defaults to following the system theme', () => {
    expect(useSettingsStore.getState().themePreference).toBe('system');
  });

  it.each(THEME_PREFERENCES)('can switch the theme preference to %s', preference => {
    useSettingsStore.getState().setThemePreference(preference);
    expect(useSettingsStore.getState().themePreference).toBe(preference);
  });
});
