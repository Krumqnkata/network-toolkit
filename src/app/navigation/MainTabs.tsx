import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';

import { Icon, type IconName } from '../../components/icons/Icon';
import { DashboardScreen } from '../../features/dashboard/screens/DashboardScreen';
import { ToolsScreen } from '../../features/network-tools/screens/ToolsScreen';
import { SettingsScreen } from '../../features/settings/screens/SettingsScreen';
import { WifiAnalyzerScreen } from '../../features/wifi-analyzer/screens/WifiAnalyzerScreen';
import { useStrings } from '../../i18n';
import { useTheme } from '../theme';
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

const TAB_ICONS: Record<keyof MainTabParamList, (props: TabIconProps) => React.ReactNode> = {
  Dashboard: makeTabIcon('dashboard'),
  WifiAnalyzer: makeTabIcon('wifi'),
  Tools: makeTabIcon('terminal'),
  Settings: makeTabIcon('sliders'),
};

export function MainTabs() {
  const theme = useTheme();
  const s = useStrings();

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
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
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
      <Tab.Screen name="Tools" component={ToolsScreen} options={{ title: s.tabs.tools }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: s.tabs.settings }} />
    </Tab.Navigator>
  );
}
