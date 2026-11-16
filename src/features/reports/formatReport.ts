import type { MonitorSession, SpeedResult } from '../../database/repositories';
import type { Finding } from '../../domain/algorithms/diagnosis';
import { formatDuration, uptimePercent } from '../../domain/algorithms/monitor';
import { formatMbps } from '../../domain/algorithms/speed';
import { formatDateTime, type Language, type Strings } from '../../i18n';
import type { HealthReport } from '../health-check/services/healthCheck';

/** Replaces `{name}` placeholders with values. */
export function fillTemplate(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

export function findingText(finding: Finding, s: Strings): { title: string; advice: string } {
  const item = s.health.items[finding.id];
  return { title: item.title, advice: fillTemplate(item.advice, finding.values) };
}

/** Plain-text health report for sharing (email, chat, support tickets). */
export function formatHealthReport(report: HealthReport, s: Strings, language: Language): string {
  const lines = [
    s.health.reportTitle,
    formatDateTime(report.createdAt, language),
    report.ssid ? `${s.dashboard.fields.ssid}: ${report.ssid}` : null,
    '',
    ...report.findings.flatMap(finding => {
      const text = findingText(finding, s);
      return [`[${s.health.severity[finding.severity]}] ${text.title}`, `  ${text.advice}`];
    }),
    '',
    ...report.checks.map(
      check =>
        `${
          s.netTools.reachability.checks[check.id as keyof typeof s.netTools.reachability.checks] ??
          check.id
        }: ${s.netTools.reachability.state[check.state]}`,
    ),
  ];
  return lines.filter(line => line !== null).join('\n');
}

export function formatSpeedResult(result: SpeedResult, s: Strings, language: Language): string {
  const t = s.speed;
  const ms = (value: number | null) => (value === null ? '—' : `${value.toFixed(1)} ms`);
  return [
    `Network Toolkit — ${s.tools.items['speed-test'].name}`,
    formatDateTime(result.finishedAt, language),
    `${t.download}: ${formatMbps(result.downloadMbps)} Mbps`,
    `${t.upload}: ${formatMbps(result.uploadMbps)} Mbps`,
    `${t.ping}: ${ms(result.idleLatencyMs)} · ${t.jitter}: ${ms(result.jitterMs)}`,
    `${t.duringDownload}: ${ms(result.downloadLatencyMs)} · ${t.duringUpload}: ${ms(
      result.uploadLatencyMs,
    )}`,
    `${t.loss}: ${
      result.packetLossPercent === null ? t.lossUnavailable : `${result.packetLossPercent}%`
    }`,
    [result.serverColo, result.serverCity, result.serverCountry].filter(Boolean).join(' · '),
  ]
    .filter(line => line !== '')
    .join('\n');
}

export function formatMonitorSession(
  session: MonitorSession,
  s: Strings,
  language: Language,
): string {
  const t = s.monitor;
  const end = session.endedAt ?? Date.now();
  const loss = session.sent === 0 ? 0 : ((session.sent - session.received) / session.sent) * 100;
  return [
    `Network Toolkit — ${s.tools.items['connection-monitor'].name}`,
    `${t.target}: ${session.target}`,
    `${formatDateTime(session.startedAt, language)} · ${formatDuration(end - session.startedAt)}`,
    `${s.netTools.ping.sent} / ${s.netTools.ping.received}: ${session.sent} / ${
      session.received
    } (${loss.toFixed(1)}%)`,
    `${s.netTools.ping.min} / ${s.netTools.ping.avg} / ${s.netTools.ping.max}: ${
      session.minMs ?? '—'
    } / ${session.avgMs ?? '—'} / ${session.maxMs ?? '—'} ms`,
    `${t.uptime}: ${uptimePercent(session.outages, session.startedAt, end)}%`,
    `${t.outages}: ${session.outages.length}`,
    ...session.outages.map(
      outage =>
        `  ${formatDateTime(outage.start, language)} · ${
          outage.end === null ? t.ongoing : formatDuration(outage.end - outage.start)
        }`,
    ),
  ].join('\n');
}
