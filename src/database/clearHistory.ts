import { healthReports } from '../features/health-check/services/healthCheck';
import { useMonitorStore } from '../stores/monitorStore';
import { useSpeedTestStore } from '../stores/speedTestStore';
import { monitorSessions, speedResults } from './repositories';

/** Deletes every saved speed test, monitor session and health report. Settings are kept. */
export async function clearHistory(): Promise<void> {
  await Promise.all([speedResults.clear(), monitorSessions.clear(), healthReports.clear()]);
  useSpeedTestStore.setState({ results: [] });
  useMonitorStore.setState({ history: [] });
}
