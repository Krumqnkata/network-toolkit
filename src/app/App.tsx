import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootNavigator } from './navigation/RootNavigator';
import { ThemeProvider, useTheme } from './theme';

function ThemedStatusBar() {
  const theme = useTheme();
  // The app is edge-to-edge (see android/gradle.properties), so only the icon
  // style needs to follow the theme.
  return <StatusBar barStyle={theme.scheme === 'dark' ? 'light-content' : 'dark-content'} />;
}

export function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedStatusBar />
        <RootNavigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
