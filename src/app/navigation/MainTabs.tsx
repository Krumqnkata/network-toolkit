import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { Icon, type IconName } from '../../components/icons/Icon';
import { DashboardScreen } from '../../features/dashboard/screens/DashboardScreen';
import { ToolsScreen } from '../../features/network-tools/screens/ToolsScreen';
import { DevicesScreen } from '../../features/devices/screens/DevicesScreen';
import { SpeedTestScreen } from '../../features/speed-test/screens/SpeedTestScreen';
import { WifiAnalyzerScreen } from '../../features/wifi-analyzer/screens/WifiAnalyzerScreen';
import { useStrings } from '../../i18n';
import { useTheme } from '../theme';
import { fontFamilies } from '../theme/tokens';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

interface TabIconProps {
  color: string;
  size: number;
}

// Defined at module level so React sees a stable component type per tab.
function makeTabIcon(name: IconName) {
  return function TabIcon({ color, size }: TabIconProps) {
    return <Icon name={name} color={color} size={size} />;
  };
}

interface TabLabelProps {
  color: string;
  children: string;
}

/**
 * Tab names use the full width of the tab and shrink a little when a word is
 * long (Bulgarian "Инструменти"); the default label cut them with "…".
 */
function TabLabel({ color, children }: TabLabelProps) {
  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.75}
      // Follows the user's text size up to 1.2×, then shrinks to fit the tab.
      maxFontSizeMultiplier={1.2}
      style={[styles.label, { color }]}
    >
      {children}
    </Text>
  );
}

const ORDER: (keyof MainTabParamList)[] = [
  'Dashboard',
  'WifiAnalyzer',
  'SpeedTest',
  'Devices',
  'Tools',
];

const TAB_ICONS: Record<keyof MainTabParamList, (props: TabIconProps) => React.ReactNode> = {
  Dashboard: makeTabIcon('home'),
  WifiAnalyzer: makeTabIcon('wifi'),
  SpeedTest: makeTabIcon('gauge'),
  Devices: makeTabIcon('lan'),
  Tools: makeTabIcon('terminal'),
};

export function MainTabs() {
  const theme = useTheme();
  const s = useStrings();
  const titles: Record<keyof MainTabParamList, string> = {
    Dashboard: s.tabs.dashboard,
    WifiAnalyzer: s.tabs.wifi,
    SpeedTest: s.tabs.speed,
    Devices: s.tabs.devices,
    Tools: s.tabs.tools,
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.tabInactive,
        tabBarStyle: {
          backgroundColor: theme.colors.tabBar,
          borderTopColor: theme.colors.border,
        },
        tabBarLabel: TabLabel,
        // A custom label needs its own accessible name, as the default one had.
        tabBarAccessibilityLabel: `${titles[route.name]}, tab, ${
          ORDER.indexOf(route.name) + 1
        } of ${ORDER.length}`,
        tabBarItemStyle: { paddingHorizontal: 0 },
        tabBarIcon: TAB_ICONS[route.name],
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: s.tabs.dashboard }}
      />
      <Tab.Screen
        name="WifiAnalyzer"
        component={WifiAnalyzerScreen}
        options={{ title: s.tabs.wifi }}
      />
      <Tab.Screen name="SpeedTest" component={SpeedTestScreen} options={{ title: s.tabs.speed }} />
      <Tab.Screen name="Devices" component={DevicesScreen} options={{ title: s.tabs.devices }} />
      <Tab.Screen name="Tools" component={ToolsScreen} options={{ title: s.tabs.tools }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  label: {
    alignSelf: 'stretch',
    fontFamily: fontFamilies.sans,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
    paddingHorizontal: 2,
    textAlign: 'center',
  },
});
