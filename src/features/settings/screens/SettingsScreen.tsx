import React from 'react';
import { View } from 'react-native';

import { APP_LICENSE, APP_NAME, APP_VERSION } from '../../../app/config/appInfo';
import { useTheme } from '../../../app/theme';
import {
  AppText,
  Card,
  ListRow,
  Screen,
  SectionHeader,
  SegmentedControl,
  type SegmentOption,
} from '../../../components/common';
import { useSettingsStore, type ThemePreference } from '../../../stores/settingsStore';

const THEME_OPTIONS: readonly SegmentOption<ThemePreference>[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function SettingsScreen() {
  const theme = useTheme();
  const themePreference = useSettingsStore(state => state.themePreference);
  const setThemePreference = useSettingsStore(state => state.setThemePreference);

  return (
    <Screen title="Settings">
      <SectionHeader title="Appearance" />
      <Card style={{ gap: theme.spacing.md }}>
        <View style={{ gap: theme.spacing.xxs }}>
          <AppText variant="heading">Theme</AppText>
          <AppText variant="caption" color="textMuted">
            System follows your device setting.
          </AppText>
        </View>
        <SegmentedControl
          accessibilityLabel="Theme"
          options={THEME_OPTIONS}
          value={themePreference}
          onChange={setThemePreference}
        />
      </Card>

      <SectionHeader title="About" />
      <Card padded={false}>
        <ListRow
          title={APP_NAME}
          subtitle={`Version ${APP_VERSION}`}
          showDivider
          testID="about-version"
        />
        <ListRow
          title="License"
          subtitle={`${APP_LICENSE} — free and open source software`}
          testID="about-license"
        />
      </Card>
    </Screen>
  );
}
