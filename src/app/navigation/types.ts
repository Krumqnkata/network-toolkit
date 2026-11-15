import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Dashboard: undefined;
  WifiAnalyzer: undefined;
  Tools: undefined;
  Settings: undefined;
};

/**
 * Root stack. Tool detail screens (Ping, DNS Lookup, …) are pushed here on top
 * of the tab bar as they are implemented.
 */
export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList>;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
