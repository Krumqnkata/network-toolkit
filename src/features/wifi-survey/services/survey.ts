import { z } from 'zod';
import { create } from 'zustand';

import { Repository } from '../../../database/storage';
import { isIPv4 } from '../../../domain/algorithms/ip';
import { median, type RoomMeasurement, type Survey } from '../../../domain/algorithms/survey';
import { macVendor } from '../../../domain/algorithms/vendor';
import { getNetworkSnapshot } from '../../../native/network';
import { ping } from '../../../native/netTools';
import { getCachedWifiScan } from '../../../native/wifi';
import {
  hasLocalNetwork,
  requestLocalNetwork,
} from '../../../services/permissions/localNetworkPermission';
import { AppError, logError, toAppError } from '../../../utils/errors';

/** Signal samples per room, spaced so the phone's RSSI reading refreshes. */
export const SAMPLES = 8;
export const surveyTiming = { spacingMs: 900 };

const roomSchema = z.object({
  room: z.string(),
  measuredAt: z.number(),
  rssi: z.number().nullable(),
  rssiMin: z.number().nullable(),
  rssiMax: z.number().nullable(),
  samples: z.number(),
  frequencyMhz: z.number().nullable(),
  bssid: z.string().nullable(),
  apVendor: z.string().nullable(),
  linkSpeedMbps: z.number().nullable(),
  routerMs: z.number().nullable(),
  routerLossPercent: z.number().nullable(),
  bestOtherBssid: z.string().nullable(),
  bestOtherRssi: z.number().nullable(),
});

export const surveySchema = z.object({
  createdAt: z.number(),
  ssid: z.string().nullable(),
  rooms: z.array(roomSchema),
});

export const surveys = new Repository<Survey>('wifi-survey', surveySchema, 20);

interface SurveyState {
  survey: Survey | null;
  /** Room being measured, and 0–1 progress. */
  measuring: string | null;
  progress: number;
  error: AppError | null;
  set: (patch: Partial<Omit<SurveyState, 'set'>>) => void;
}

export const useSurveyStore = create<SurveyState>()(set => ({
  survey: null,
  measuring: null,
  progress: 0,
  error: null,
  set: patch => set(patch),
}));

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** The access point a BSSID belongs to: radios of one AP differ only in the first/last octet. */
const apKey = (bssid: string) => bssid.toLowerCase().split(':').slice(1, 5).join(':');

/**
 * Measures the room the phone is in: Wi-Fi signal and link rate several times,
 * a ping to the router with each sample (when local network access is
 * allowed), and the strongest other access point of the same network.
 */
export async function measureRoom(room: string): Promise<RoomMeasurement> {
  const { set } = useSurveyStore.getState();
  set({ measuring: room, progress: 0, error: null });
  try {
    const first = await getNetworkSnapshot();
    if (first.transport !== 'wifi' || !first.wifi) {
      throw new AppError('unsupported', 'not-wifi');
    }
    // The router ping needs local network access on Android 17; the signal does not.
    const local = (await hasLocalNetwork()) || (await requestLocalNetwork()) === 'granted';
    const gateway = local ? first.gateways.find(isIPv4) ?? null : null;

    const rssi: number[] = [];
    const rates: number[] = [];
    const routerTimes: number[] = [];
    let routerSent = 0;
    let snapshot = first;
    for (let i = 0; i < SAMPLES; i++) {
      if (i > 0) snapshot = await getNetworkSnapshot();
      if (snapshot.wifi?.rssi != null) rssi.push(snapshot.wifi.rssi);
      if (snapshot.wifi?.linkSpeedMbps != null) rates.push(snapshot.wifi.linkSpeedMbps);
      if (gateway) {
        routerSent++;
        try {
          const reply = await ping(gateway, { family: 'ipv4', timeoutMs: 800 });
          if (reply.status === 'reply' && reply.rttMs !== null) routerTimes.push(reply.rttMs);
        } catch (error) {
          logError('survey', error);
        }
      }
      set({ progress: (i + 1) / (SAMPLES + 1) });
      if (i < SAMPLES - 1) await wait(surveyTiming.spacingMs);
    }

    const bssid = snapshot.wifi?.bssid ?? first.wifi.bssid ?? null;
    let bestOtherBssid: string | null = null;
    let bestOtherRssi: number | null = null;
    try {
      const scan = await getCachedWifiScan();
      const ssid = snapshot.wifi?.ssid ?? null;
      for (const network of scan.networks) {
        if (!ssid || network.ssid !== ssid || !network.bssid || !bssid) continue;
        if (apKey(network.bssid) === apKey(bssid)) continue;
        if (bestOtherRssi === null || network.rssi > bestOtherRssi) {
          bestOtherRssi = network.rssi;
          bestOtherBssid = network.bssid;
        }
      }
    } catch (error) {
      // Without location access Android hides scan results; the rest still works.
      logError('survey', error);
    }

    const result: RoomMeasurement = {
      room,
      measuredAt: Date.now(),
      rssi: median(rssi),
      rssiMin: rssi.length ? Math.min(...rssi) : null,
      rssiMax: rssi.length ? Math.max(...rssi) : null,
      samples: rssi.length,
      frequencyMhz: snapshot.wifi?.frequencyMhz ?? null,
      bssid,
      apVendor: macVendor(bssid),
      linkSpeedMbps: median(rates),
      routerMs: median(routerTimes),
      routerLossPercent: routerSent
        ? Math.round(((routerSent - routerTimes.length) / routerSent) * 100)
        : null,
      bestOtherBssid,
      bestOtherRssi,
    };

    const current = useSurveyStore.getState().survey;
    const survey: Survey = current
      ? {
          ...current,
          // Measuring a room again replaces the earlier result.
          rooms: [...current.rooms.filter(item => item.room !== room), result],
        }
      : { createdAt: Date.now(), ssid: snapshot.wifi?.ssid ?? null, rooms: [result] };
    set({ survey, measuring: null, progress: 1 });
    return result;
  } catch (error) {
    logError('survey', error);
    set({ measuring: null, progress: 0, error: toAppError(error) });
    throw error;
  }
}

export function removeRoom(room: string): void {
  const { survey, set } = useSurveyStore.getState();
  if (!survey) return;
  const rooms = survey.rooms.filter(item => item.room !== room);
  set({ survey: rooms.length ? { ...survey, rooms } : null });
}

/** Saves the current survey to the history and clears it for a new one. */
export async function finishSurvey(): Promise<void> {
  const { survey, set } = useSurveyStore.getState();
  if (survey?.rooms.length) await surveys.add(survey, survey.createdAt);
  set({ survey: null, error: null, progress: 0 });
}
