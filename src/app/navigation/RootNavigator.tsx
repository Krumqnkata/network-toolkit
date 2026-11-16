import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';

import { BluetoothDeviceScreen } from '../../features/bluetooth/screens/BluetoothDeviceScreen';
import { LanDeviceScreen } from '../../features/lan-scanner/screens/LanDeviceScreen';
import { ToolHostScreen } from '../../features/network-tools/screens/ToolHostScreen';
import { SettingsScreen } from '../../features/settings/screens/SettingsScreen';
import { useTheme } from '../theme';
import { MainTabs } from './MainTabs';
import { toNavigationTheme } from './navigationTheme';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const theme = useTheme();
  const navigationTheme = useMemo(() => toNavigationTheme(theme), [theme]);

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="Tool" component={ToolHostScreen} />
        <Stack.Screen name="LanDevice" component={LanDeviceScreen} />
        <Stack.Screen name="BluetoothDevice" component={BluetoothDeviceScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
