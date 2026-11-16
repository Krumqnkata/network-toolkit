import { z } from 'zod';

import { speedResults } from '../../../database/repositories';
import { Repository } from '../../../database/storage';
import { diagnose, type Finding } from '../../../domain/algorithms/diagnosis';
import { getNetworkSnapshot } from '../../../native/network';
import { useWifiScanStore } from '../../../stores/wifiScanStore';
import { logError } from '../../../utils/errors';
import { CHECK_ORDER, runCheck, type CheckResult } from '../../network-tools/services/reachability';
import { locateProblem, type ProblemLocation } from './problemLocator';

/** Speed results older than this are not used for the diagnosis. */
export const SPEED_MAX_AGE_MS = 24 * 3600_000;

const findingSchema = z.object({
  id: z.string(),
  severity: z.enum(['problem', 'warning', 'info', 'ok']),
  values: z.record(z.string(), z.union([z.string(), z.number()])),
});

export const healthReportSchema = z.object({
  createdAt: z.number(),
  transport: z.string(),
  ssid: z.string().nullable(),
  findings: z.array(findingSchema),
  checks: z.array(z.object({ id: z.string(), state: z.enum(['pass', 'warn', 'fail', 'skip']) })),
  /** "Where is the problem?" — absent in reports saved before it existed. */
  location: z
    .object({
      verdict: z.string(),
      gateway: z.string().nullable(),
      provider: z.string().nullable(),
      internet: z.string(),
      segments: z.array(
        z.object({
          id: z.enum(['local', 'access', 'internet']),
          state: z.enum(['good', 'warn', 'bad', 'unknown']),
          addedMs: z.number().nullable(),
          lossPercent: z.number().nullable(),
          jitterMs: z.number().nullable(),
        }),
      ),
    })
    .nullable()
    .optional(),
});

export type HealthReport = Omit<z.infer<typeof healthReportSchema>, 'findings' | 'location'> & {
  findings: Finding[];
  location?: ProblemLocation | null;
};

export const healthReports = new Repository('health-report', healthReportSchema, 50);

/**
 * Runs every reachability check, combines them with the network state, the
 * latest Wi-Fi scan and a recent speed test, and saves the resulting report.
 */
export async function runHealthCheck(
  onCheck?: (result: CheckResult) => void,
): Promise<HealthReport> {
  const snapshot = await getNetworkSnapshot();
  // The segment probes take a few seconds; they run alongside the checks.
  const locationPromise: Promise<ProblemLocation | null> =
    snapshot.transport === 'none'
      ? Promise.resolve(null)
      : locateProblem(snapshot).catch(error => {
          logError('health', error);
          return null;
        });
  const checks: CheckResult[] = [];
  for (const id of CHECK_ORDER) {
    const result = await runCheck(id);
    checks.push(result);
    onCheck?.(result);
  }
  const location = await locationPromise;
  let speed = null;
  try {
    const [latest] = await speedResults.list(1);
    if (latest && Date.now() - latest.createdAt < SPEED_MAX_AGE_MS) {
      const loaded = [latest.data.downloadLatencyMs, latest.data.uploadLatencyMs].filter(
        (value): value is number => value !== null,
      );
      speed = {
        packetLossPercent: latest.data.packetLossPercent,
        idleLatencyMs: latest.data.idleLatencyMs,
        loadedLatencyMs: loaded.length ? Math.max(...loaded) : null,
      };
    }
  } catch (error) {
    logError('health', error);
  }
  const findings = diagnose({
    snapshot,
    checks,
    scan: useWifiScanStore.getState().result?.networks ?? null,
    speed,
  });
  const report: HealthReport = {
    createdAt: Date.now(),
    transport: snapshot.transport,
    ssid: snapshot.wifi?.ssid ?? null,
    findings,
    checks: checks.map(result => ({ id: result.id, state: result.state })),
    location,
  };
  healthReports.add(report, report.createdAt).catch(error => logError('health', error));
  return report;
}
