import React, { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { autoUpdateOnStart } from '../features/updates/services/updater';
import { hydrateSettings } from '../stores/settingsStore';
import { logError } from '../utils/errors';
import { RootNavigator } from './navigation/RootNavigator';
import { ThemeProvider, useTheme } from './theme';

function ThemedStatusBar() {
  const theme = useTheme();
  // The app is edge-to-edge (see android/gradle.properties), so only the icon
  // style needs to follow the theme.
  return <StatusBar barStyle={theme.scheme === 'dark' ? 'light-content' : 'dark-content'} />;
}

export function App() {
  // Saved theme and language are read before the first frame so the UI does
  // not flash the defaults; the native splash screen covers this short wait.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    hydrateSettings().finally(() => setReady(true));
    autoUpdateOnStart().catch(error => logError('update', error));
  }, []);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedStatusBar />
        <RootNavigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
