import type { SpeedResult } from '../../src/database/repositories';

export const doneResult: SpeedResult = {
  phase: 'done',
  progress: 1,
  currentMbps: null,
  downloadMbps: 100,
  uploadMbps: 20,
  idleLatencyMs: 10,
  jitterMs: 1,
  downloadLatencyMs: null,
  uploadLatencyMs: null,
  packetLossPercent: 0,
  bytesDownloaded: 1,
  bytesUploaded: 1,
  serverColo: null,
  serverCity: null,
  serverCountry: null,
  error: null,
  finishedAt: 1,
};
