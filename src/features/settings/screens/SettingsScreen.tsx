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
} from '../../../components/common';
import { useStrings } from '../../../i18n';
import {
  LANGUAGE_PREFERENCES,
  THEME_PREFERENCES,
  useSettingsStore,
} from '../../../stores/settingsStore';

function SettingGroup({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.md }}>
      <View style={{ gap: theme.spacing.xxs }}>
        <AppText variant="heading">{title}</AppText>
        <AppText variant="caption" color="textMuted">
          {hint}
        </AppText>
      </View>
      {children}
    </View>
  );
}

export function SettingsScreen() {
  const theme = useTheme();
  const s = useStrings();
  const themePreference = useSettingsStore(state => state.themePreference);
  const setThemePreference = useSettingsStore(state => state.setThemePreference);
  const languagePreference = useSettingsStore(state => state.languagePreference);
  const setLanguagePreference = useSettingsStore(state => state.setLanguagePreference);

  return (
    <Screen title={s.settings.title}>
      <SectionHeader title={s.settings.appearance} />
      <Card style={{ gap: theme.spacing.xl }}>
        <SettingGroup title={s.settings.theme} hint={s.settings.themeHint}>
          <SegmentedControl
            accessibilityLabel={s.settings.theme}
            testID="theme-options"
            options={THEME_PREFERENCES.map(value => ({
              value,
              label: s.settings.themeOptions[value],
            }))}
            value={themePreference}
            onChange={setThemePreference}
          />
        </SettingGroup>
        <SettingGroup title={s.settings.language} hint={s.settings.languageHint}>
          <SegmentedControl
            accessibilityLabel={s.settings.language}
            testID="language-options"
            options={LANGUAGE_PREFERENCES.map(value => ({
              value,
              label: s.settings.languageOptions[value],
            }))}
            value={languagePreference}
            onChange={setLanguagePreference}
          />
        </SettingGroup>
      </Card>

      <SectionHeader title={s.settings.about} />
      <Card padded={false}>
        <ListRow
          title={APP_NAME}
          subtitle={s.settings.version(APP_VERSION)}
          showDivider
          testID="about-version"
        />
        <ListRow
          title={s.settings.license}
          subtitle={s.settings.licenseValue(APP_LICENSE)}
          testID="about-license"
        />
      </Card>
    </Screen>
  );
}
