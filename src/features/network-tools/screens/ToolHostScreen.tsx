import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';

import type { RootStackParamList } from '../../../app/navigation/types';
import { EmptyState } from '../../../components/common';
import { useStrings } from '../../../i18n';
import { ToolFrame } from '../components/ToolFrame';
import type { ToolId } from '../toolCatalog';
import { DnsLookupScreen } from './DnsLookupScreen';
import { HttpHeadersScreen } from './HttpHeadersScreen';
import { IpInfoScreen } from './IpInfoScreen';
import { PingScreen } from './PingScreen';
import { ReachabilityScreen } from './ReachabilityScreen';
import { TlsCertificateScreen } from './TlsCertificateScreen';
import { LanScannerScreen } from '../../lan-scanner/screens/LanScannerScreen';
import { SpeedTestScreen } from '../../speed-test/screens/SpeedTestScreen';
import { PortScannerScreen } from './PortScannerScreen';
import { TracerouteScreen } from './TracerouteScreen';

export interface ToolScreenProps {
  /** Target to pre-fill, e.g. a device picked in the LAN scanner. */
  initialHost?: string;
}

function DnsLookup() {
  return <DnsLookupScreen mode="lookup" />;
}

function ReverseDns() {
  return <DnsLookupScreen mode="reverse" />;
}

/** Screens of implemented tools. A tool is `available` in the catalog only if it is listed here. */
export const TOOL_SCREENS: Partial<Record<ToolId, React.ComponentType<ToolScreenProps>>> = {
  ping: PingScreen,
  traceroute: TracerouteScreen,
  'dns-lookup': DnsLookup,
  'reverse-dns': ReverseDns,
  reachability: ReachabilityScreen,
  'ip-info': IpInfoScreen,
  'http-headers': HttpHeadersScreen,
  'tls-certificate': TlsCertificateScreen,
  'lan-scanner': LanScannerScreen,
  'port-scanner': PortScannerScreen,
  'speed-test': SpeedTestScreen,
};

function NotAvailable({ toolId }: { toolId: ToolId }) {
  const s = useStrings();
  return (
    <ToolFrame toolId={toolId}>
      <EmptyState title={s.common.planned} />
    </ToolFrame>
  );
}

export function ToolHostScreen({ route }: NativeStackScreenProps<RootStackParamList, 'Tool'>) {
  const { toolId, host } = route.params;
  const Tool = TOOL_SCREENS[toolId];
  return Tool ? <Tool initialHost={host} /> : <NotAvailable toolId={toolId} />;
}
