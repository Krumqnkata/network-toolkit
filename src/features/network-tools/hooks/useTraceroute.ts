import { useCallback, useEffect, useRef, useState } from 'react';

import { DNS_RECORD_TYPES } from '../../../domain/algorithms/dns';
import { reverseDnsName } from '../../../domain/algorithms/ip';
import type { PingStatus } from '../../../domain/models/netTools';
import { dnsQuery, ping } from '../../../native/netTools';
import { logError, toAppError, type AppError } from '../../../utils/errors';

export const MAX_HOPS = 30;
export const HOP_TIMEOUT_MS = 2000;
/** Stop when this many hops in a row did not answer. */
export const MAX_SILENT_HOPS = 5;

export interface TraceHop {
  ttl: number;
  address: string | null;
  hostname: string | null;
  rttMs: number | null;
  status: PingStatus;
}

export type TraceOutcome = 'reached' | 'not-reached' | 'stopped-early';

export interface TracerouteState {
  running: boolean;
  hops: TraceHop[];
  target: string | null;
  outcome: TraceOutcome | null;
  error: AppError | null;
  start: (host: string) => void;
  stop: () => void;
}

/** Finds the PTR name of an address; failures just leave the hop unnamed. */
async function lookupHostname(address: string): Promise<string | null> {
  const name = reverseDnsName(address);
  if (!name) return null;
  try {
    const result = await dnsQuery(name, DNS_RECORD_TYPES.PTR, null, 3000);
    return result.answers.find(record => record.type === DNS_RECORD_TYPES.PTR)?.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Traceroute on top of the system ping: a probe with TTL = n makes the n-th
 * router answer "time to live exceeded". Its round-trip time is then measured
 * with a direct ping to that router, because ping does not time ICMP errors.
 */
export function useTraceroute(): TracerouteState {
  const [running, setRunning] = useState(false);
  const [hops, setHops] = useState<TraceHop[]>([]);
  const [target, setTarget] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<TraceOutcome | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const runId = useRef(0);

  useEffect(
    () => () => {
      runId.current += 1;
    },
    [],
  );

  const stop = useCallback(() => {
    runId.current += 1;
    setRunning(false);
  }, []);

  const start = useCallback((host: string) => {
    const id = ++runId.current;
    setHops([]);
    setTarget(null);
    setOutcome(null);
    setError(null);
    setRunning(true);

    const active = () => id === runId.current;
    const updateHop = (ttl: number, patch: Partial<TraceHop>) =>
      setHops(previous => previous.map(hop => (hop.ttl === ttl ? { ...hop, ...patch } : hop)));

    const loop = async () => {
      let silent = 0;
      for (let ttl = 1; ttl <= MAX_HOPS; ttl++) {
        let hop: TraceHop;
        try {
          const probe = await ping(host, { family: 'ipv4', ttl, timeoutMs: HOP_TIMEOUT_MS });
          if (!active()) return;
          setTarget(probe.address);
          hop = {
            ttl,
            address: probe.from,
            hostname: null,
            rttMs: probe.status === 'reply' ? probe.rttMs : null,
            status: probe.status,
          };
        } catch (caught) {
          logError('traceroute', caught);
          if (!active()) return;
          setError(toAppError(caught));
          setRunning(false);
          return;
        }
        setHops(previous => [...previous, hop]);

        const router = hop.address;
        if (router) {
          lookupHostname(router).then(hostname => {
            if (active() && hostname) updateHop(ttl, { hostname });
          });
          if (hop.status === 'ttl-exceeded') {
            try {
              const direct = await ping(router, { timeoutMs: 1500 });
              if (!active()) return;
              if (direct.status === 'reply') updateHop(ttl, { rttMs: direct.rttMs });
            } catch (caught) {
              logError('traceroute', caught);
            }
          }
        }

        if (hop.status === 'reply') {
          setOutcome('reached');
          setRunning(false);
          return;
        }
        if (hop.status === 'unreachable') break;
        silent = hop.status === 'timeout' ? silent + 1 : 0;
        if (silent >= MAX_SILENT_HOPS) {
          setOutcome('stopped-early');
          setRunning(false);
          return;
        }
      }
      if (!active()) return;
      setOutcome('not-reached');
      setRunning(false);
    };
    loop();
  }, []);

  return { running, hops, target, outcome, error, start, stop };
}
