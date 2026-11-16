/**
 * Wi-Fi signal by room: what each room measured and what to do about the
 * weak ones. Pure, unit-tested.
 */
import { classifySignal, frequencyToBand, type SignalQuality, type WifiBand } from './wifi';

export interface RoomMeasurement {
  room: string;
  measuredAt: number;
  /** Median RSSI of the samples taken in the room (dBm). */
  rssi: number | null;
  rssiMin: number | null;
  rssiMax: number | null;
  samples: number;
  frequencyMhz: number | null;
  /** Access point the phone used (BSSID), when Android reveals it. */
  bssid: string | null;
  /** Maker of that access point (IEEE registry). */
  apVendor: string | null;
  /** Physical link rate reported by Android (Mbps). */
  linkSpeedMbps: number | null;
  /** Median round trip to the router and the share of lost pings. */
  routerMs: number | null;
  routerLossPercent: number | null;
  /** Strongest other access point of the same network heard in the room. */
  bestOtherBssid: string | null;
  bestOtherRssi: number | null;
}

export interface Survey {
  createdAt: number;
  ssid: string | null;
  rooms: RoomMeasurement[];
}

export type RoomRating = SignalQuality | 'unknown';

export type AdviceId =
  | 'all-good'
  | 'dead-zone'
  | 'weak-rooms'
  | 'add-access-point'
  | 'move-router'
  | 'sticky-client'
  | 'use-5ghz'
  | 'interference'
  | 'measure-more';

export interface Advice {
  id: AdviceId;
  /** Rooms the advice is about. */
  rooms: string[];
}

export interface SurveyAnalysis {
  ratings: Record<string, RoomRating>;
  best: string | null;
  worst: string | null;
  /** Number of different access points the phone used. */
  accessPoints: number;
  advice: Advice[];
}

export function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
}

export function rateRoom(room: Pick<RoomMeasurement, 'rssi'>): RoomRating {
  return room.rssi === null ? 'unknown' : classifySignal(room.rssi);
}

export function roomBand(room: Pick<RoomMeasurement, 'frequencyMhz'>): WifiBand | null {
  return room.frequencyMhz ? frequencyToBand(room.frequencyMhz) : null;
}

/** A neighbouring AP this much stronger means the phone held on to a worse one. */
const STICKY_MARGIN_DB = 10;
/** Router replies slower than this with a good signal point to interference. */
const SLOW_ROUTER_MS = 30;

export function analyzeSurvey(survey: Survey): SurveyAnalysis {
  const rooms = survey.rooms.filter(room => room.rssi !== null);
  const ratings = Object.fromEntries(survey.rooms.map(room => [room.room, rateRoom(room)]));
  const sorted = [...rooms].sort((a, b) => b.rssi! - a.rssi!);
  const best = sorted[0]?.room ?? null;
  const worst = sorted.length > 1 ? sorted[sorted.length - 1]!.room : null;
  // Access points of this network: the ones the phone used and the others it heard.
  const apKey = (bssid: string | null) => bssid?.toLowerCase().split(':').slice(1, 5).join(':');
  const accessPoints = new Set(
    survey.rooms.flatMap(room => [apKey(room.bssid), apKey(room.bestOtherBssid)]).filter(Boolean),
  ).size;

  const advice: Advice[] = [];
  const named = (predicate: (room: RoomMeasurement) => boolean) =>
    rooms.filter(predicate).map(room => room.room);

  if (rooms.length < 2) {
    advice.push({ id: 'measure-more', rooms: [] });
  }
  const dead = named(room => ratings[room.room] === 'poor');
  const weak = named(room => ratings[room.room] === 'weak');
  if (dead.length) advice.push({ id: 'dead-zone', rooms: dead });
  if (weak.length) advice.push({ id: 'weak-rooms', rooms: weak });

  const problems = [...dead, ...weak];
  if (problems.length) {
    // One access point for the whole home: a second one (mesh) or a better spot helps.
    if (accessPoints <= 1) {
      const good = rooms.filter(
        room => ratings[room.room] === 'excellent' || ratings[room.room] === 'good',
      );
      advice.push({ id: good.length ? 'add-access-point' : 'move-router', rooms: problems });
    }
  }

  // Strong rooms on 2.4 GHz while the network also has 5 GHz: 5 GHz would be
  // faster there. (In weak rooms 2.4 GHz is often the better band.)
  const any5 = rooms.some(room => roomBand(room) === '5' || roomBand(room) === '6');
  const strongOn24 = named(
    room =>
      roomBand(room) === '2.4' &&
      (ratings[room.room] === 'excellent' || ratings[room.room] === 'good'),
  );
  if (any5 && strongOn24.length) advice.push({ id: 'use-5ghz', rooms: strongOn24 });

  const sticky = named(
    room =>
      room.bestOtherRssi !== null &&
      room.rssi !== null &&
      room.bestOtherRssi - room.rssi >= STICKY_MARGIN_DB,
  );
  if (sticky.length) advice.push({ id: 'sticky-client', rooms: sticky });

  const interference = named(
    room =>
      (ratings[room.room] === 'excellent' || ratings[room.room] === 'good') &&
      ((room.routerMs !== null && room.routerMs >= SLOW_ROUTER_MS) ||
        (room.routerLossPercent !== null && room.routerLossPercent >= 10)),
  );
  if (interference.length) advice.push({ id: 'interference', rooms: interference });

  if (!advice.length) advice.push({ id: 'all-good', rooms: [] });
  return { ratings, best, worst, accessPoints, advice };
}
