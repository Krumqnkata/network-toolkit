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
  back: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
  },
  root: {
    flex: 1,
  },
});
