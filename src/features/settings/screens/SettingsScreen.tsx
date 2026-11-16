import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { Alert, Linking, StyleSheet, Switch, View } from 'react-native';

import {
  APP_LICENSE,
  APP_NAME,
  APP_VERSION,
  PRIVACY_URL,
  SOURCE_URL,
} from '../../../app/config/appInfo';
import { useTheme } from '../../../app/theme';
import {
  AppText,
  Button,
  Card,
  ListRow,
  Screen,
  SectionHeader,
  SegmentedControl,
} from '../../../components/common';
import { clearHistory } from '../../../database/clearHistory';
import { Icon } from '../../../components/icons/Icon';
import { formatDateTime, useLanguage, useStrings } from '../../../i18n';
import { useUpdateStore } from '../../../stores/updateStore';
import { UpdatePanel } from '../../updates/components/UpdatePanel';
import { checkForUpdates, setAutoUpdate } from '../../updates/services/updater';
import { logError } from '../../../utils/errors';
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
  const [cleared, setCleared] = useState(false);
  const language = useLanguage();
  const autoUpdate = useUpdateStore(state => state.autoUpdate);
  const lastCheckedAt = useUpdateStore(state => state.lastCheckedAt);
  const updatePhase = useUpdateStore(state => state.phase);
  const hasUpdate = useUpdateStore(state => state.update !== null);
  const navigation = useNavigation();

  const confirmClear = () =>
    Alert.alert(s.settings.clearTitle, s.settings.clearBody, [
      { text: s.settings.cancel, style: 'cancel' },
      {
        text: s.settings.clearConfirm,
        style: 'destructive',
        onPress: () => {
          clearHistory()
            .then(() => setCleared(true))
            .catch(error => logError('settings', error));
        },
      },
    ]);

  return (
    <Screen
      title={s.settings.title}
      onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      backLabel={s.tabs.dashboard}
    >
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

      <SectionHeader title={s.updates.title} />
      <Card style={{ gap: theme.spacing.md }}>
        <View style={[styles.switchRow, { gap: theme.spacing.md }]}>
          <View style={[styles.flex, { gap: theme.spacing.xxs }]}>
            <AppText variant="heading">{s.updates.auto}</AppText>
            <AppText variant="caption" color="textMuted">
              {s.updates.autoHint}
            </AppText>
          </View>
          <Switch
            testID="auto-update"
            accessibilityLabel={s.updates.auto}
            value={autoUpdate}
            onValueChange={setAutoUpdate}
            trackColor={{ true: theme.colors.accent, false: theme.colors.surfaceRaised }}
            thumbColor={theme.colors.textPrimary}
          />
        </View>
        <AppText variant="caption" color="textSecondary">
          {[
            s.updates.current(APP_VERSION),
            lastCheckedAt ? s.updates.lastChecked(formatDateTime(lastCheckedAt, language)) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </AppText>
        <UpdatePanel />
        {updatePhase === 'idle' ||
        updatePhase === 'up-to-date' ||
        (updatePhase === 'error' && !hasUpdate) ? (
          <Button
            testID="check-updates"
            label={s.updates.checkNow}
            variant="secondary"
            onPress={() => checkForUpdates()}
          />
        ) : null}
      </Card>

      <SectionHeader title={s.settings.data} />
      <Card style={{ gap: theme.spacing.md }}>
        <AppText variant="caption" color="textSecondary">
          {s.settings.dataHint}
        </AppText>
        <Button
          testID="clear-history"
          label={s.settings.clearHistory}
          variant="secondary"
          onPress={confirmClear}
        />
        {cleared ? (
          <AppText testID="history-cleared" variant="caption" color="success">
            {s.settings.cleared}
          </AppText>
        ) : null}
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
          showDivider
          testID="about-license"
        />
        <ListRow
          title={s.settings.privacy}
          subtitle={s.settings.privacyValue}
          showDivider
          testID="about-privacy"
          onPress={() => Linking.openURL(PRIVACY_URL)}
          trailing={<Icon name="chevronRight" color={theme.colors.textMuted} size={20} />}
        />
        <ListRow
          title={s.settings.source}
          subtitle={SOURCE_URL.replace('https://', '')}
          testID="about-source"
          onPress={() => Linking.openURL(SOURCE_URL)}
          trailing={<Icon name="chevronRight" color={theme.colors.textMuted} size={20} />}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});
