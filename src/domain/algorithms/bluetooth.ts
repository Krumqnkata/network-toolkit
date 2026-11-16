import companies from '../data/bluetoothCompanies.json';
import uuids from '../data/bluetoothUuids.json';

/**
 * Bluetooth assigned numbers from the Bluetooth SIG
 * (bitbucket.org/bluetooth-SIG/public, assigned_numbers): company identifiers,
 * standard GATT services and member service UUIDs. See src/domain/data/README.md.
 */
const COMPANIES = companies as Record<string, string>;
const SERVICES = uuids.services as Record<string, string>;
const MEMBERS = uuids.members as Record<string, string>;

/** Company that registered a manufacturer-data identifier, e.g. 0x004C → "Apple, Inc.". */
export function companyName(id: number): string | null {
  return COMPANIES[String(id)] ?? null;
}

/** Standard service name, or the company that owns a member UUID. */
export function serviceName(uuid16: number): string | null {
  return SERVICES[String(uuid16)] ?? MEMBERS[String(uuid16)] ?? null;
}

/** Short brand from a registered company name: "Apple, Inc." → "Apple". */
export function brandName(company: string): string {
  return company
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(
      /,?\s+(Inc\.?|Incorporated|Corporation|Corp\.?|Co\.,? ?Ltd\.?|Ltd\.?|LLC|GmbH|AG|ASA|A\/S|AB|B\.V\.|S\.A\.|SE|Oy|Limited|International|Industries|Technologies|Electronics|Semiconductor)\b\.?/gi,
      '',
    )
    .replace(/[,\s]+$/, '')
    .trim();
}

/** Maker of a device from its advertisement, if it says. */
export function deviceMaker(device: {
  manufacturerIds: readonly number[];
  serviceUuids: readonly number[];
}): string | null {
  for (const id of device.manufacturerIds) {
    const name = companyName(id);
    if (name) return brandName(name);
  }
  for (const uuid of device.serviceUuids) {
    const name = MEMBERS[String(uuid)];
    if (name) return brandName(name);
  }
  return null;
}

export type BluetoothKind =
  | 'headphones'
  | 'speaker'
  | 'watch'
  | 'fitness'
  | 'phone'
  | 'computer'
  | 'keyboard'
  | 'tv'
  | 'tracker'
  | 'car'
  | 'unknown';

// Words may be followed by a model number ("Watch6", "Buds2"), hence (?=\b|\d).
const NAME_RULES: [RegExp, BluetoothKind][] = [
  [
    /\b(airpods|buds|earbuds|headphones?|headset|earphones?|wh-1000|wf-1000)(?=\b|\d)/i,
    'headphones',
  ],
  [
    /\b(speaker|soundbar|soundlink|sonos|homepod|echo|jbl flip|jbl charge|boom)(?=\b|\d)/i,
    'speaker',
  ],
  [/\b(watch|gear s|amazfit|forerunner|fenix|venu)(?=\b|\d)/i, 'watch'],
  [/\b(band|fitbit|mi band|whoop|oura)(?=\b|\d)/i, 'fitness'],
  [/\b(tv|bravia|chromecast|fire ?tv|roku)(?=\b|\d)/i, 'tv'],
  [/\b(keyboard|keys|mouse|trackpad|mx master)(?=\b|\d)/i, 'keyboard'],
  [/\b(iphone|galaxy s|galaxy a|galaxy z|pixel|redmi|oneplus|phone)(?=\b|\d)/i, 'phone'],
  [/\b(macbook|imac|laptop|desktop|thinkpad|surface)(?=\b|\d)/i, 'computer'],
  [/\b(tile|airtag|smarttag|tracker|chipolo)(?=\b|\d)/i, 'tracker'],
  [/\b(carplay|android auto|my car|bmw|audi|tesla|toyota)(?=\b|\d)/i, 'car'],
];

/** Standard services that tell the kind of device. */
const SERVICE_RULES: [number, BluetoothKind][] = [
  [0x180d, 'fitness'], // Heart Rate
  [0x1816, 'fitness'], // Cycling Speed and Cadence
  [0x1818, 'fitness'], // Cycling Power
  [0x1826, 'fitness'], // Fitness Machine
  [0x1812, 'keyboard'], // Human Interface Device
  [0x184e, 'headphones'], // Audio Stream Control (LE Audio)
];

/** Best-effort type of a nearby device from its name and advertised services. */
export function guessBluetoothKind(device: {
  name: string | null;
  serviceUuids: readonly number[];
}): BluetoothKind {
  if (device.name) {
    for (const [pattern, kind] of NAME_RULES) {
      if (pattern.test(device.name)) return kind;
    }
  }
  for (const [uuid, kind] of SERVICE_RULES) {
    if (device.serviceUuids.includes(uuid)) return kind;
  }
  return 'unknown';
}

export type Proximity = 'very-close' | 'near' | 'room' | 'far';

/** Plain-language distance from signal strength (rough: walls and bodies weaken it). */
export function proximity(rssi: number): Proximity {
  if (rssi >= -55) return 'very-close';
  if (rssi >= -70) return 'near';
  if (rssi >= -85) return 'room';
  return 'far';
}

/**
 * Very rough distance in metres from the log-distance path-loss model,
 * using the advertised TX power (RSSI at 1 m) or -59 dBm when unknown.
 */
export function estimateDistance(rssi: number, txPower: number | null): number {
  const reference = txPower !== null && txPower < 0 ? txPower : -59;
  const meters = 10 ** ((reference - rssi) / (10 * 2.5));
  return Math.round(Math.min(meters, 50) * 10) / 10;
}

/** Signal trend over the last readings: rising means the device is getting closer. */
export function signalTrend(history: readonly number[]): 'closer' | 'farther' | 'steady' {
  if (history.length < 6) return 'steady';
  const recent = history.slice(-3);
  const before = history.slice(-6, -3);
  const avg = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
  const delta = avg(recent) - avg(before);
  if (delta >= 3) return 'closer';
  if (delta <= -3) return 'farther';
  return 'steady';
}
