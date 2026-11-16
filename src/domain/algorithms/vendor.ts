/**
 * Manufacturer of a network interface from the first three bytes of its MAC
 * address or BSSID (IEEE MA-L registry, see src/domain/data/oui.ts).
 */

let table: { vendors: string[]; entries: string } | null = null;

function load() {
  if (!table) {
    // Loaded on first use: the registry is large and most screens never need it.
    const data = require('../data/oui') as typeof import('../data/oui');
    table = { vendors: data.OUI_VENDORS.split('|'), entries: data.OUI_TABLE };
  }
  return table;
}

/** The second-lowest bit of the first byte marks a locally administered (random) address. */
export function isLocallyAdministered(mac: string): boolean {
  const first = parseInt(mac.replace(/[^0-9a-f]/gi, '').slice(0, 2), 16);
  return !Number.isNaN(first) && Math.floor(first / 2) % 2 === 1;
}

/** `aa:bb:cc:…`, `AA-BB-CC-…` or `aabbcc…` → `AABBCC`, or null. */
export function ouiPrefix(mac: string): string | null {
  const hex = mac.replace(/[^0-9a-f]/gi, '').toUpperCase();
  return hex.length >= 6 ? hex.slice(0, 6) : null;
}

/**
 * Vendor registered for this MAC address, or null when the address is
 * random (locally administered) or the prefix is not in the registry.
 */
export function macVendor(mac: string | null | undefined): string | null {
  if (!mac) return null;
  const prefix = ouiPrefix(mac);
  if (!prefix || isLocallyAdministered(mac)) return null;
  const { vendors, entries } = load();
  let low = 0;
  let high = entries.length / 9 - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const key = entries.slice(middle * 9, middle * 9 + 6);
    if (key === prefix) {
      return vendors[parseInt(entries.slice(middle * 9 + 6, middle * 9 + 9), 36)] ?? null;
    }
    if (key < prefix) low = middle + 1;
    else high = middle - 1;
  }
  return null;
}
