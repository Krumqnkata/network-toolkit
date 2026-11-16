import { z } from 'zod';

import { speedStatusSchema } from '../native/speedTest';
import { Repository } from './storage';

export const speedResultSchema = speedStatusSchema.extend({ finishedAt: z.number() });
export type SpeedResult = z.infer<typeof speedResultSchema>;

export const monitorSampleSchema = z.object({
  t: z.number(),
  /** Round-trip time in ms, or null for a lost probe. */
  rtt: z.number().nullable(),
});
export type MonitorSample = z.infer<typeof monitorSampleSchema>;

export const outageSchema = z.object({
  start: z.number(),
  /** null while the outage is still ongoing. */
  end: z.number().nullable(),
});
export type Outage = z.infer<typeof outageSchema>;

export const monitorSessionSchema = z.object({
  target: z.string(),
  startedAt: z.number(),
  endedAt: z.number().nullable(),
  intervalMs: z.number(),
  sent: z.number(),
  received: z.number(),
  minMs: z.number().nullable(),
  avgMs: z.number().nullable(),
  maxMs: z.number().nullable(),
  jitterMs: z.number().nullable(),
  outages: z.array(outageSchema),
  /** Downsampled for storage (at most `MAX_STORED_SAMPLES`). */
  samples: z.array(monitorSampleSchema),
});
export type MonitorSession = z.infer<typeof monitorSessionSchema>;

export const MAX_STORED_SAMPLES = 720;

export const speedResults = new Repository('speed-result', speedResultSchema, 200);
export const monitorSessions = new Repository('monitor-session', monitorSessionSchema, 100);
