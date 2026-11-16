import { z } from 'zod';

import { speedResults } from '../../../database/repositories';
import { Repository } from '../../../database/storage';
import { diagnose, type Finding } from '../../../domain/algorithms/diagnosis';
import { getNetworkSnapshot } from '../../../native/network';
import { useWifiScanStore } from '../../../stores/wifiScanStore';
import { logError } from '../../../utils/errors';
import { CHECK_ORDER, runCheck, type CheckResult } from '../../network-tools/services/reachability';

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
});

export type HealthReport = Omit<z.infer<typeof healthReportSchema>, 'findings'> & {
  findings: Finding[];
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
  const checks: CheckResult[] = [];
  for (const id of CHECK_ORDER) {
    const result = await runCheck(id);
    checks.push(result);
    onCheck?.(result);
  }
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
  };
  healthReports.add(report, report.createdAt).catch(error => logError('health', error));
  return report;
}
