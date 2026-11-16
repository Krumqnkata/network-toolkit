import type { NavigatorScreenParams } from '@react-navigation/native';

import type { ToolId } from '../../features/network-tools/toolCatalog';

export type MainTabParamList = {
  Dashboard: undefined;
  WifiAnalyzer: undefined;
  Tools: undefined;
  Settings: undefined;
};

/** Root stack. Tool screens (Ping, DNS Lookup, …) are pushed on top of the tab bar. */
export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList>;
  /** `host` pre-fills the tool's target (e.g. when opened from a LAN device). */
  Tool: { toolId: ToolId; host?: string };
  LanDevice: { address: string };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
