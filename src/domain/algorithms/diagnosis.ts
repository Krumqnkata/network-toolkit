import type { NetworkSnapshot } from '../models/network';
import type { ScannedNetwork } from '../models/wifiScan';
import type { CheckResult } from '../../features/network-tools/services/reachability';
import { frequencyToBand } from './wifi';
import { congestionFor } from './wifiAnalysis';

export type Severity = 'problem' | 'warning' | 'info' | 'ok';

export type FindingId =
  | 'offline'
  | 'captive-portal'
  | 'not-validated'
  | 'vpn'
  | 'weak-signal'
  | 'fair-signal'
  | 'insecure-wifi'
  | 'band-2g'
  | 'congested-channel'
  | 'gateway-unreachable'
  | 'gateway-no-ping'
  | 'dns-failed'
  | 'dns-slow'
  | 'internet-unreachable'
  | 'high-latency'
  | 'https-failed'
  | 'no-ipv6'
  | 'packet-loss'
  | 'bufferbloat'
  | 'all-good';

export interface Finding {
  id: FindingId;
  severity: Severity;
  /** Values for the localized text, e.g. the RSSI or a duration. */
  values: Record<string, string | number>;
}

export interface DiagnosisInput {
  snapshot: NetworkSnapshot;
  checks: readonly CheckResult[];
  /** Latest scan, used for channel congestion of the connected access point. */
  scan: readonly ScannedNetwork[] | null;
  /** Latest speed test, if it is recent enough to be relevant. */
  speed: {
    packetLossPercent: number | null;
    idleLatencyMs: number | null;
    loadedLatencyMs: number | null;
  } | null;
}

export const THRESHOLDS = {
  weakRssi: -75,
  fairRssi: -67,
  slowDnsMs: 150,
  highLatencyMs: 100,
  lossPercent: 1,
  bloatMs: 100,
} as const;

const SEVERITY_ORDER: Record<Severity, number> = { problem: 0, warning: 1, info: 2, ok: 3 };

function check(checks: readonly CheckResult[], id: CheckResult['id']): CheckResult | undefined {
  return checks.find(result => result.id === id);
}

/**
 * Turns the current state of the connection into a prioritized list of
 * findings. Pure: every input is passed in, so the rules are unit-tested.
 */
export function diagnose(input: DiagnosisInput): Finding[] {
  const { snapshot, checks, scan, speed } = input;
  const findings: Finding[] = [];
  const add = (id: FindingId, severity: Severity, values: Finding['values'] = {}) =>
    findings.push({ id, severity, values });

  if (snapshot.transport === 'none') {
    add('offline', 'problem');
    return findings;
  }
  if (snapshot.isCaptivePortal) add('captive-portal', 'problem');
  else if (snapshot.hasInternet && !snapshot.isValidated) add('not-validated', 'warning');
  if (snapshot.isVpn) add('vpn', 'info');

  const wifi = snapshot.wifi;
  if (wifi) {
    if (wifi.rssi !== null && wifi.rssi <= THRESHOLDS.weakRssi) {
      add('weak-signal', 'problem', { rssi: wifi.rssi });
    } else if (wifi.rssi !== null && wifi.rssi <= THRESHOLDS.fairRssi) {
      add('fair-signal', 'warning', { rssi: wifi.rssi });
    }
    if (wifi.security === 'open' || wifi.security === 'wep') {
      add('insecure-wifi', 'problem', { security: wifi.security });
    }
    if (wifi.frequencyMhz !== null && frequencyToBand(wifi.frequencyMhz) === '2.4') {
      add('band-2g', 'info');
    }
    const own = wifi.bssid && scan ? scan.find(network => network.bssid === wifi.bssid) : undefined;
    if (own && scan) {
      const congestion = congestionFor(own, scan);
      if (congestion && congestion.load === 'busy') {
        add('congested-channel', 'warning', { overlapping: congestion.overlapping });
      }
    }
  }

  const gateway = check(checks, 'gateway');
  if (gateway?.state === 'fail') add('gateway-unreachable', 'problem');
  else if (gateway?.state === 'warn') add('gateway-no-ping', 'info');

  const dns = check(checks, 'dns');
  if (dns?.state === 'fail') add('dns-failed', 'problem');
  else if (dns?.detail.kind === 'latency' && dns.detail.ms > THRESHOLDS.slowDnsMs) {
    add('dns-slow', 'warning', { ms: Math.round(dns.detail.ms) });
  }

  const internet = check(checks, 'internet');
  if (internet?.state === 'fail') add('internet-unreachable', 'problem');
  else if (internet?.detail.kind === 'latency' && internet.detail.ms > THRESHOLDS.highLatencyMs) {
    add('high-latency', 'warning', { ms: Math.round(internet.detail.ms) });
  }

  if (check(checks, 'captive')?.state === 'warn' && !snapshot.isCaptivePortal) {
    add('captive-portal', 'problem');
  }
  if (check(checks, 'https')?.state === 'fail') add('https-failed', 'problem');
  if (check(checks, 'ipv6')?.state === 'warn') add('no-ipv6', 'info');

  if (speed?.packetLossPercent !== null && speed?.packetLossPercent !== undefined) {
    if (speed.packetLossPercent >= THRESHOLDS.lossPercent) {
      add('packet-loss', 'warning', { percent: speed.packetLossPercent });
    }
  }
  if (speed?.idleLatencyMs != null && speed.loadedLatencyMs != null) {
    const increase = speed.loadedLatencyMs - speed.idleLatencyMs;
    if (increase >= THRESHOLDS.bloatMs) add('bufferbloat', 'warning', { ms: Math.round(increase) });
  }

  // De-duplicate (e.g. captive portal from both sources) and sort by severity.
  const unique = findings.filter(
    (finding, index) => findings.findIndex(other => other.id === finding.id) === index,
  );
  if (!unique.some(finding => finding.severity === 'problem' || finding.severity === 'warning')) {
    unique.push({ id: 'all-good', severity: 'ok', values: {} });
  }
  return unique.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
