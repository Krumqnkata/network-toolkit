import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../app/theme';
import { Icon } from '../icons/Icon';
import { AppText } from './AppText';

export interface ScreenProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Set to false for screens that manage their own scrolling (e.g. lists). */
  scrollable?: boolean;
  /** Enables pull-to-refresh on scrollable screens. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Shows a back button above the title (screens pushed on the root stack). */
  onBack?: () => void;
  backLabel?: string;
  /** Small label above the title (e.g. the app name on the home screen). */
  overline?: string;
  /** Element shown to the right of the title, e.g. a settings button. */
  headerAction?: React.ReactNode;
}

/**
 * Standard screen frame used by every tab: safe-area aware, themed background
 * and a large title header that is consistent across feature modules.
 */
export function Screen({
  title,
  subtitle,
  children,
  scrollable = true,
  onRefresh,
  refreshing = false,
  onBack,
  backLabel,
  overline,
  headerAction,
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const header = (
    <View style={{ marginBottom: theme.spacing.xl, gap: theme.spacing.xs }}>
      {onBack ? (
        <Pressable
          testID="screen-back"
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          onPress={onBack}
          hitSlop={12}
          style={[styles.back, { marginBottom: theme.spacing.sm, gap: theme.spacing.xs }]}
        >
          <Icon name="chevronLeft" color={theme.colors.accent} size={20} />
          {backLabel ? (
            <AppText variant="caption" color="accent">
              {backLabel}
            </AppText>
          ) : null}
        </Pressable>
      ) : null}
      {overline ? (
        <AppText variant="overline" color="accent">
          {overline}
        </AppText>
      ) : null}
      <View style={[styles.titleRow, { gap: theme.spacing.md }]}>
        <AppText variant="display" accessibilityRole="header" style={styles.title}>
          {title}
        </AppText>
        {headerAction}
      </View>
      {subtitle ? (
        <AppText variant="body" color="textSecondary">
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );

  const contentStyle = {
    paddingTop: insets.top + theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.lg,
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      {scrollable ? (
        <ScrollView
          contentContainerStyle={contentStyle}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[theme.colors.accent]}
                progressBackgroundColor={theme.colors.surface}
                progressViewOffset={insets.top}
              />
            ) : undefined
          }
        >
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.root, contentStyle]}>
          {header}
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
  },
  root: {
    flex: 1,
  },
  title: {
    flex: 1,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});
