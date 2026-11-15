import type { ScannedNetwork } from '../models/wifiScan';
import { frequencyToBand, frequencyToChannel, type WifiBand } from './wifi';

export type ScanSecurity =
  | 'open'
  | 'owe'
  | 'wep'
  | 'wpa'
  | 'wpa2'
  | 'wpa2-wpa3'
  | 'wpa3'
  | 'enterprise';

/**
 * Derives the strongest advertised security mode from ScanResult.capabilities.
 * The string lists every supported mode in brackets, e.g.
 * "[WPA2-PSK-CCMP][RSN-SAE+PSK-CCMP][ESS]".
 */
export function parseSecurity(capabilities: string): ScanSecurity {
  const caps = capabilities.toUpperCase();
  if (caps.includes('EAP')) return 'enterprise';
  const sae = caps.includes('SAE');
  const psk = caps.includes('PSK');
  if (sae && psk) return 'wpa2-wpa3';
  if (sae) return 'wpa3';
  if (caps.includes('OWE')) return 'owe';
  if (psk) return caps.includes('RSN') || caps.includes('WPA2') ? 'wpa2' : 'wpa';
  if (caps.includes('WEP')) return 'wep';
  return 'open';
}

export function supportsWps(capabilities: string): boolean {
  return capabilities.toUpperCase().includes('[WPS]');
}

export interface ChannelSpan {
  band: WifiBand;
  /** Primary 20 MHz channel. */
  primaryChannel: number | null;
  /** Occupied spectrum in MHz. */
  lowMhz: number;
  highMhz: number;
  centerMhz: number;
  widthMhz: number;
}

/**
 * Spectrum occupied by a network. For channels wider than 20 MHz Android
 * reports the center of the whole channel in centerFreq0. The second segment
 * of 80+80 MHz channels is ignored (rare in practice).
 */
export function channelSpan(network: ScannedNetwork): ChannelSpan | null {
  const band = frequencyToBand(network.frequencyMhz);
  if (!band) return null;
  const widthMhz = network.channelWidthMhz ?? 20;
  const centerMhz =
    widthMhz > 20 && network.centerFreq0Mhz > 0 ? network.centerFreq0Mhz : network.frequencyMhz;
  return {
    band,
    primaryChannel: frequencyToChannel(network.frequencyMhz),
    lowMhz: centerMhz - widthMhz / 2,
    highMhz: centerMhz + widthMhz / 2,
    centerMhz,
    widthMhz,
  };
}

export function spansOverlap(a: ChannelSpan, b: ChannelSpan): boolean {
  return a.band === b.band && a.lowMhz < b.highMhz && b.lowMhz < a.highMhz;
}

/**
 * How much a network contributes to channel load, from 0 (≤ -90 dBm, inaudible)
 * to 60 (-30 dBm). Linear in dB, which is a deliberate simplification.
 */
export function interferenceWeight(rssi: number): number {
  return Math.max(0, Math.min(60, rssi + 90));
}

export type ChannelLoad = 'clear' | 'light' | 'moderate' | 'busy';

export function loadLevel(score: number): ChannelLoad {
  if (score <= 0) return 'clear';
  if (score < 30) return 'light';
  if (score < 80) return 'moderate';
  return 'busy';
}

export function channelToFrequency(band: WifiBand, channel: number): number | null {
  switch (band) {
    case '2.4':
      return channel === 14 ? 2484 : 2407 + channel * 5;
    case '5':
      return 5000 + channel * 5;
    case '6':
      return channel === 2 ? 5935 : 5950 + channel * 5;
    default:
      return null;
  }
}

/** 5 GHz channels that require radar detection (DFS) in most regulatory domains. */
export function isDfsChannel(channel: number): boolean {
  return channel >= 52 && channel <= 144;
}

/**
 * 20 MHz candidate channels per band: the non-overlapping 1/6/11 on 2.4 GHz,
 * all common 5 GHz channels, and the 6 GHz preferred scanning channels (PSC).
 */
export const CANDIDATE_CHANNELS: Record<'2.4' | '5' | '6', readonly number[]> = {
  '2.4': [1, 6, 11],
  '5': [
    36, 40, 44, 48, 52, 56, 60, 64, 100, 104, 108, 112, 116, 120, 124, 128, 132, 136, 140, 144, 149,
    153, 157, 161, 165,
  ],
  '6': [5, 21, 37, 53, 69, 85, 101, 117, 133, 149, 165, 181, 197, 213, 229],
};

export interface ChannelScore {
  channel: number;
  score: number;
  load: ChannelLoad;
  networkCount: number;
  dfs: boolean;
}

/** Ranks candidate channels by how much the visible networks overlap them (lower is better). */
export function rankChannels(
  band: '2.4' | '5' | '6',
  networks: readonly ScannedNetwork[],
): ChannelScore[] {
  const spans = networks
    .map(network => ({ network, span: channelSpan(network) }))
    .filter((item): item is { network: ScannedNetwork; span: ChannelSpan } => item.span !== null);

  return CANDIDATE_CHANNELS[band]
    .map(channel => {
      const center = channelToFrequency(band, channel) ?? 0;
      const candidate: ChannelSpan = {
        band,
        primaryChannel: channel,
        lowMhz: center - 10,
        highMhz: center + 10,
        centerMhz: center,
        widthMhz: 20,
      };
      const overlapping = spans.filter(({ span }) => spansOverlap(span, candidate));
      const score = overlapping.reduce(
        (sum, { network }) => sum + interferenceWeight(network.rssi),
        0,
      );
      return {
        channel,
        score,
        load: loadLevel(score),
        networkCount: overlapping.length,
        dfs: band === '5' && isDfsChannel(channel),
      };
    })
    .sort((a, b) => a.score - b.score || Number(a.dfs) - Number(b.dfs) || a.channel - b.channel);
}

/** Load caused by other networks on the spectrum used by `target`. */
export function congestionFor(
  target: ScannedNetwork,
  networks: readonly ScannedNetwork[],
): { score: number; load: ChannelLoad; overlapping: number } | null {
  const targetSpan = channelSpan(target);
  if (!targetSpan) return null;
  let score = 0;
  let overlapping = 0;
  for (const network of networks) {
    if (network.bssid !== null && network.bssid === target.bssid) continue;
    const span = channelSpan(network);
    if (span && spansOverlap(span, targetSpan)) {
      overlapping += 1;
      score += interferenceWeight(network.rssi);
    }
  }
  return { score, load: loadLevel(score), overlapping };
}

export function networksInBand(
  networks: readonly ScannedNetwork[],
  band: WifiBand,
): ScannedNetwork[] {
  return networks
    .filter(network => frequencyToBand(network.frequencyMhz) === band)
    .sort((a, b) => b.rssi - a.rssi);
}

export interface RssiSample {
  timestamp: number;
  rssi: number;
}

/** Appends a scan to per-BSSID signal history, keeping the last `limit` samples. */
export function appendHistory(
  history: Readonly<Record<string, readonly RssiSample[]>>,
  timestamp: number,
  networks: readonly ScannedNetwork[],
  limit = 20,
): Record<string, RssiSample[]> {
  const next: Record<string, RssiSample[]> = {};
  for (const [bssid, samples] of Object.entries(history)) {
    next[bssid] = [...samples];
  }
  for (const network of networks) {
    if (!network.bssid) continue;
    const samples = next[network.bssid] ?? [];
    const last = samples[samples.length - 1];
    if (last?.timestamp === timestamp) continue;
    samples.push({ timestamp, rssi: network.rssi });
    next[network.bssid] = samples.slice(-limit);
  }
  return next;
}
