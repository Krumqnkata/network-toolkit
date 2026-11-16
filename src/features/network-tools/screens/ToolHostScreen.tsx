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
import { TracerouteScreen } from './TracerouteScreen';

function DnsLookup() {
  return <DnsLookupScreen mode="lookup" />;
}

function ReverseDns() {
  return <DnsLookupScreen mode="reverse" />;
}

/** Screens of implemented tools. A tool is `available` in the catalog only if it is listed here. */
export const TOOL_SCREENS: Partial<Record<ToolId, React.ComponentType>> = {
  ping: PingScreen,
  traceroute: TracerouteScreen,
  'dns-lookup': DnsLookup,
  'reverse-dns': ReverseDns,
  reachability: ReachabilityScreen,
  'ip-info': IpInfoScreen,
  'http-headers': HttpHeadersScreen,
  'tls-certificate': TlsCertificateScreen,
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
  const { toolId } = route.params;
  const Tool = TOOL_SCREENS[toolId];
  return Tool ? <Tool /> : <NotAvailable toolId={toolId} />;
}
