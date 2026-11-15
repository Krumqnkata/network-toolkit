import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../app/theme';
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
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const header = (
    <View style={{ marginBottom: theme.spacing.xl, gap: theme.spacing.xs }}>
      <AppText variant="display" accessibilityRole="header">
        {title}
      </AppText>
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
  root: {
    flex: 1,
  },
});
