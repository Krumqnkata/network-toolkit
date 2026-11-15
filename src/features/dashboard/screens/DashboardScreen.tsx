import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { MainTabParamList } from '../../../app/navigation/types';
import { useTheme } from '../../../app/theme';
import { AppText, Card, EmptyState, Screen, SectionHeader } from '../../../components/common';
import { Icon, type IconName } from '../../../components/icons/Icon';

interface QuickAction {
  label: string;
  icon: IconName;
  target: keyof MainTabParamList;
}

const QUICK_ACTIONS: readonly QuickAction[] = [
  { label: 'Wi-Fi Analyzer', icon: 'wifi', target: 'WifiAnalyzer' },
  { label: 'Network Tools', icon: 'terminal', target: 'Tools' },
];

export function DashboardScreen() {
  const theme = useTheme();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();

  return (
    <Screen title="Network Toolkit" subtitle="Your connection at a glance.">
      <Card>
        <EmptyState
          icon={<Icon name="dashboard" color={theme.colors.accent} size={28} />}
          title="Connection overview"
          description="Connection type, IP address, gateway, DNS servers and signal strength will appear here in milestone 3."
        />
      </Card>

      <SectionHeader title="Quick access" />
      <View style={[styles.grid, { gap: theme.spacing.md }]}>
        {QUICK_ACTIONS.map(action => (
          <Pressable
            key={action.target}
            accessibilityRole="button"
            accessibilityLabel={`Open ${action.label}`}
            onPress={() => navigation.navigate(action.target)}
            style={styles.tile}
          >
            <Card style={{ gap: theme.spacing.md }}>
              <Icon name={action.icon} color={theme.colors.accent} />
              <AppText variant="heading">{action.label}</AppText>
            </Card>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
  },
  tile: {
    flex: 1,
  },
});
