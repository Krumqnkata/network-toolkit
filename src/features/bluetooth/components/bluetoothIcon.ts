import type { IconName } from '../../../components/icons/Icon';
import type { BluetoothKind, Proximity } from '../../../domain/algorithms/bluetooth';
import type { ThemeColors } from '../../../app/theme';

export const BT_KIND_ICON: Record<BluetoothKind, IconName> = {
  headphones: 'headphones',
  speaker: 'speaker',
  watch: 'watch',
  fitness: 'pulse',
  phone: 'phone',
  computer: 'computer',
  keyboard: 'keyboard',
  tv: 'tv',
  tracker: 'tag',
  car: 'car',
  unknown: 'bluetooth',
};

export const PROXIMITY_COLOR: Record<Proximity, keyof ThemeColors> = {
  'very-close': 'success',
  near: 'success',
  room: 'warning',
  far: 'textMuted',
};

/** 0–1 bar fill for an RSSI between -100 and -40 dBm. */
export function rssiFill(rssi: number): number {
  return Math.min(1, Math.max(0, (rssi + 100) / 60));
}
