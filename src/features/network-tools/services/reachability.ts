import { DNS_RECORD_TYPES, rcodeName } from '../../../domain/algorithms/dns';
import { dnsQuery, httpRequest, ping, tcpConnect } from '../../../native/netTools';
import { getNetworkSnapshot } from '../../../native/network';
import { toAppError } from '../../../utils/errors';

export type CheckId = 'gateway' | 'dns' | 'internet' | 'captive' | 'https' | 'ipv6';
export type CheckState = 'pass' | 'warn' | 'fail' | 'skip';

export interface CheckResult {
  id: CheckId;
  state: CheckState;
  /** Structured detail; the screen turns it into localized text. */
  detail:
    | { kind: 'latency'; target: string; ms: number }
    | { kind: 'portal'; status: number }
    | { kind: 'no-portal' }
    | { kind: 'no-gateway' }
    | { kind: 'error'; message: string };
}

export const CHECK_ORDER: readonly CheckId[] = [
  'gateway',
  'dns',
  'internet',
  'captive',
  'https',
  'ipv6',
];

/** Targets match the ones Android's own connectivity checks use. */
export const TARGETS = {
  dnsName: 'example.com',
  tcpV4: '1.1.1.1',
  tcpV6: '2606:4700:4700::1111',
  captiveUrl: 'http://connectivitycheck.gstatic.com/generate_204',
  httpsUrl: 'https://www.google.com/generate_204',
} as const;

const errorDetail = (error: unknown): CheckResult['detail'] => ({
  kind: 'error',
  message: toAppError(error).message,
});

async function checkGateway(): Promise<CheckResult> {
  const snapshot = await getNetworkSnapshot();
  const gateway = snapshot.gateways[0];
  if (!gateway) return { id: 'gateway', state: 'skip', detail: { kind: 'no-gateway' } };
  const probe = await ping(gateway, { timeoutMs: 2000 });
  if (probe.status === 'reply' && probe.rttMs !== null) {
    return {
      id: 'gateway',
      state: 'pass',
      detail: { kind: 'latency', target: gateway, ms: probe.rttMs },
    };
  }
  // Many routers ignore ping, so a timeout alone is not a failure.
  return {
    id: 'gateway',
    state: probe.status === 'unreachable' ? 'fail' : 'warn',
    detail: { kind: 'error', message: `${gateway}: ${probe.status}` },
  };
}

async function checkDns(): Promise<CheckResult> {
  const result = await dnsQuery(TARGETS.dnsName, DNS_RECORD_TYPES.A);
  if (result.rcode === 0 && result.answers.length > 0) {
    return {
      id: 'dns',
      state: 'pass',
      detail: { kind: 'latency', target: TARGETS.dnsName, ms: result.durationMs },
    };
  }
  return { id: 'dns', state: 'fail', detail: { kind: 'error', message: rcodeName(result.rcode) } };
}

async function checkTcp(id: CheckId, host: string, failState: CheckState): Promise<CheckResult> {
  const result = await tcpConnect(host, 443, id === 'ipv6' ? 'ipv6' : 'any', 3000);
  if (result.status === 'open' && result.connectMs !== null) {
    return {
      id,
      state: 'pass',
      detail: { kind: 'latency', target: `${host}`, ms: result.connectMs },
    };
  }
  return { id, state: failState, detail: { kind: 'error', message: result.status } };
}

async function checkCaptive(): Promise<CheckResult> {
  const result = await httpRequest(TARGETS.captiveUrl, 'GET', 0, 5000);
  const status = result.hops[0]?.status ?? 0;
  return status === 204
    ? { id: 'captive', state: 'pass', detail: { kind: 'no-portal' } }
    : { id: 'captive', state: 'warn', detail: { kind: 'portal', status } };
}

async function checkHttps(): Promise<CheckResult> {
  const result = await httpRequest(TARGETS.httpsUrl, 'GET', 0, 5000);
  const hop = result.hops[0];
  if (hop && hop.status >= 200 && hop.status < 400) {
    return {
      id: 'https',
      state: 'pass',
      detail: { kind: 'latency', target: 'www.google.com', ms: hop.durationMs },
    };
  }
  return {
    id: 'https',
    state: 'fail',
    detail: { kind: 'error', message: `HTTP ${hop?.status ?? '?'}` },
  };
}

const RUNNERS: Record<CheckId, () => Promise<CheckResult>> = {
  gateway: checkGateway,
  dns: checkDns,
  internet: () => checkTcp('internet', TARGETS.tcpV4, 'fail'),
  captive: checkCaptive,
  https: checkHttps,
  // Many networks have no IPv6 yet, so missing IPv6 is a warning.
  ipv6: () => checkTcp('ipv6', TARGETS.tcpV6, 'warn'),
};

/** Runs one check; exceptions become a failed (or, for IPv6, warning) result. */
export async function runCheck(id: CheckId): Promise<CheckResult> {
  try {
    return await RUNNERS[id]();
  } catch (error) {
    return { id, state: id === 'ipv6' ? 'warn' : 'fail', detail: errorDetail(error) };
  }
}
