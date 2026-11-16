/**
 * Network topology map — built only from what the app can measure without
 * root: the path to the internet (TTL-limited pings), access points that
 * broadcast this network's name (Wi-Fi scan), devices found by the LAN
 * scanner and nearby Bluetooth devices. Pure, unit-tested.
 *
 * Android cannot tell which access point another device uses, so LAN devices
 * are drawn under the router; only this phone is attached to its own AP.
 */
import { isPrivateIPv4 } from './ip';
import { macVendor } from './vendor';
import { frequencyToBand, type WifiBand } from './wifi';

export type TopoNodeType =
  | 'internet'
  | 'hop'
  | 'more'
  | 'operator'
  | 'router'
  | 'ap'
  | 'self'
  | 'lan'
  | 'bluetooth';

/** How a node is connected to the node above it. */
export type TopoLink = 'path' | 'wired' | 'wireless' | 'mesh' | 'cellular' | 'bluetooth' | 'lan';
export type LinkState = 'good' | 'warn' | 'bad' | 'unknown';

/** What a traceroute hop is, judged from its address. */
export type HopRole = 'private' | 'cgnat' | 'public' | 'silent';

export interface TopoNode {
  id: string;
  type: TopoNodeType;
  /** Device kind for icons (`DeviceKind` / `BluetoothKind`), or the node type. */
  kind: string;
  /** Name found by a scan; null = the UI shows a generic label for the type. */
  name: string | null;
  address: string | null;
  /** Extra line: model, Wi-Fi bands, hop count… */
  detail: string | null;
  /** Round-trip time from this phone, when measured. */
  rttMs: number | null;
  parent: string | null;
  link: TopoLink | null;
  linkState: LinkState;
  /** Delay this link adds (ms), when it can be told apart. */
  linkMs: number | null;
  hopRole?: HopRole;
  /** Hidden hops (`more` node), devices or Wi-Fi bands. */
  count?: number;
  bands?: WifiBand[];
  /** The access point this phone is connected to. */
  connected?: boolean;
  signalDbm?: number | null;
  /** Maker of the access point, from its BSSID (IEEE registry). */
  vendor?: string | null;
}

export interface TopologyHop {
  ttl: number;
  address: string | null;
  rttMs: number | null;
  status: 'reply' | 'timeout' | 'ttl-exceeded' | 'unreachable';
}

export interface TopologyInput {
  transport: string;
  gateway: string | null;
  localAddress: string | null;
  deviceName: string | null;
  wifi: {
    ssid: string | null;
    bssid: string | null;
    frequencyMhz: number | null;
    rssi: number | null;
  } | null;
  operator: string | null;
  /** Round-trip time to the gateway. */
  gatewayRttMs: number | null;
  target: string;
  hops: readonly TopologyHop[];
  /** Nearby Wi-Fi networks (scan results). */
  networks: readonly {
    ssid: string | null;
    bssid: string | null;
    frequencyMhz: number;
    rssi: number;
  }[];
  lan: readonly {
    address: string;
    name: string | null;
    kind: string;
    model: string | null;
    rttMs: number | null;
    isSelf: boolean;
    isGateway: boolean;
  }[];
  bluetooth: readonly { address: string; name: string | null; kind: string; rssi: number }[];
}

export interface Topology {
  nodes: TopoNode[];
  /** Hops between the router and the internet that were not drawn. */
  hiddenHops: number;
  /** LAN devices left out because the map would get too big. */
  hiddenDevices: number;
  /** A private router answered after the gateway: two routers doing NAT. */
  doubleNat: boolean;
  cgnat: boolean;
  reached: boolean;
}

/** Path hops drawn between the router and the internet; the rest collapse. */
export const MAX_PATH_HOPS = 4;
export const MAX_LAN_DEVICES = 40;
export const MAX_BLUETOOTH = 6;
/** Access points weaker than this are probably a neighbour's network with the same name. */
export const AP_MIN_RSSI = -85;

const LINK_LIMITS: Record<'local' | 'path' | 'internet', [number, number]> = {
  local: [20, 60],
  path: [30, 80],
  internet: [80, 200],
};

export function rateLink(ms: number | null, limits: [number, number]): LinkState {
  if (ms === null) return 'unknown';
  if (ms >= limits[1]) return 'bad';
  if (ms >= limits[0]) return 'warn';
  return 'good';
}

export function hopRole(address: string | null): HopRole {
  if (!address) return 'silent';
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(address)) return 'cgnat';
  if (isPrivateIPv4(address)) return 'private';
  return 'public';
}

const normalizeBssid = (bssid: string) => bssid.toLowerCase();

/**
 * Groups BSSIDs into physical access points: one radio per band usually
 * differs only in the first (locally administered bit) or last octet.
 */
export function groupAccessPoints(
  ssid: string,
  networks: TopologyInput['networks'],
  connectedBssid: string | null,
): { key: string; bssids: string[]; bands: WifiBand[]; rssi: number | null; connected: boolean }[] {
  const groups = new Map<
    string,
    { key: string; bssids: string[]; bands: Set<WifiBand>; rssi: number | null; connected: boolean }
  >();
  const connected = connectedBssid ? normalizeBssid(connectedBssid) : null;
  const add = (bssid: string, frequencyMhz: number | null, rssi: number | null) => {
    const normalized = normalizeBssid(bssid);
    const octets = normalized.split(':');
    const key = octets.length === 6 ? octets.slice(1, 5).join(':') : normalized;
    const group = groups.get(key) ?? {
      key,
      bssids: [],
      bands: new Set<WifiBand>(),
      rssi: null,
      connected: false,
    };
    if (!group.bssids.includes(normalized)) group.bssids.push(normalized);
    const band = frequencyMhz ? frequencyToBand(frequencyMhz) : null;
    if (band) group.bands.add(band);
    if (rssi !== null && (group.rssi === null || rssi > group.rssi)) group.rssi = rssi;
    if (normalized === connected) group.connected = true;
    groups.set(key, group);
  };
  for (const network of networks) {
    if (network.ssid !== ssid || !network.bssid) continue;
    if (network.rssi < AP_MIN_RSSI && normalizeBssid(network.bssid) !== connected) continue;
    add(network.bssid, network.frequencyMhz, network.rssi);
  }
  if (connected && ![...groups.values()].some(group => group.connected)) {
    add(connected, null, null);
  }
  const order: WifiBand[] = ['2.4', '5', '6', '60'];
  return [...groups.values()]
    .map(group => ({
      ...group,
      bands: order.filter(band => group.bands.has(band)),
    }))
    .sort(
      (a, b) => Number(b.connected) - Number(a.connected) || (b.rssi ?? -200) - (a.rssi ?? -200),
    );
}

function node(partial: Partial<TopoNode> & Pick<TopoNode, 'id' | 'type'>): TopoNode {
  return {
    kind: partial.type,
    name: null,
    address: null,
    detail: null,
    rttMs: null,
    parent: null,
    link: null,
    linkState: 'unknown',
    linkMs: null,
    ...partial,
  };
}

/** Difference of two round-trip times, or null when either is unknown. */
const added = (outer: number | null, inner: number | null) =>
  outer === null || inner === null ? null : Math.max(0, Math.round((outer - inner) * 10) / 10);

export function buildTopology(input: TopologyInput): Topology {
  const nodes: TopoNode[] = [];
  const cellular = input.transport === 'cellular';
  const reached = input.hops.some(hop => hop.status === 'reply');
  const finalRtt = input.hops.find(hop => hop.status === 'reply')?.rttMs ?? null;

  // Path beyond the gateway: drop the gateway itself and the final reply,
  // and merge runs of silent hops into one.
  const path: TopologyHop[] = [];
  for (const hop of [...input.hops].sort((a, b) => a.ttl - b.ttl)) {
    if (hop.status === 'reply') break;
    if (hop.address && hop.address === input.gateway) continue;
    const previous = path[path.length - 1];
    if (!hop.address && previous && !previous.address) continue;
    path.push(hop);
  }
  // A trailing silent hop says nothing when the target answered.
  while (reached && path.length && !path[path.length - 1]!.address) path.pop();

  const doubleNat = !cellular && path.some(hop => hopRole(hop.address) === 'private');
  const cgnat = path.some(hop => hopRole(hop.address) === 'cgnat');

  // On mobile data the first answering hop is the operator's network.
  let operatorHop: TopologyHop | null = null;
  if (cellular) {
    const index = path.findIndex(hop => hop.address);
    // Silent hops before it are inside the operator's radio network too.
    if (index >= 0) operatorHop = path.splice(0, index + 1)[index] ?? null;
  }

  let shown = path;
  let hiddenHops = 0;
  if (path.length > MAX_PATH_HOPS) {
    hiddenHops = path.length - (MAX_PATH_HOPS - 1);
    shown = [...path.slice(0, MAX_PATH_HOPS - 2), ...path.slice(path.length - 1)];
  }

  const internet = node({
    id: 'internet',
    type: 'internet',
    address: input.target,
    rttMs: finalRtt,
  });
  nodes.push(internet);

  // Top-down: internet ← last hop ← … ← first hop ← router.
  let above: TopoNode = internet;
  const chain = [...shown].reverse();
  chain.forEach((hop, index) => {
    if (hiddenHops > 0 && index === 1) {
      const more = node({
        id: 'more',
        type: 'more',
        parent: above.id,
        link: 'path',
        count: hiddenHops,
      });
      nodes.push(more);
      above = more;
    }
    const hopNode = node({
      id: `hop-${hop.ttl}`,
      type: 'hop',
      kind: hopRole(hop.address) === 'private' ? 'router' : 'hop',
      address: hop.address,
      detail: `TTL ${hop.ttl}`,
      rttMs: hop.rttMs,
      parent: above.id,
      link: 'path',
      hopRole: hopRole(hop.address),
    });
    nodes.push(hopNode);
    above = hopNode;
  });

  const rateUp = (child: TopoNode, parent: TopoNode, limits: [number, number]) => {
    child.linkMs = parent.type === 'more' ? null : added(parent.rttMs, child.rttMs);
    child.linkState = rateLink(child.linkMs, limits);
  };

  let local: TopoNode;
  if (cellular) {
    local = node({
      id: 'operator',
      type: 'operator',
      kind: 'operator',
      name: input.operator,
      address: operatorHop?.address ?? null,
      rttMs: operatorHop?.rttMs ?? null,
      parent: above.id,
      link: 'path',
    });
    nodes.push(local);
  } else {
    local = node({
      id: 'router',
      type: 'router',
      kind: 'router',
      name: input.lan.find(device => device.isGateway)?.name ?? null,
      address: input.gateway,
      detail: input.wifi?.ssid ?? null,
      rttMs: input.gatewayRttMs,
      parent: above.id,
      link: 'path',
    });
    nodes.push(local);
  }

  // Rate the path links now that every node has its round-trip time.
  for (const item of nodes) {
    const parent = nodes.find(other => other.id === item.parent);
    if (!parent) continue;
    rateUp(item, parent, parent.type === 'internet' ? LINK_LIMITS.internet : LINK_LIMITS.path);
  }
  if (!reached) {
    const top = nodes.find(item => item.parent === 'internet');
    if (top) {
      top.linkState = 'bad';
      top.linkMs = null;
    }
  }

  // Access points: only drawn when the network has more than one.
  let phoneParent = local;
  const ssid = input.wifi?.ssid ?? null;
  if (input.transport === 'wifi' && ssid) {
    const groups = groupAccessPoints(ssid, input.networks, input.wifi?.bssid ?? null);
    if (groups.length > 1) {
      groups.forEach((group, index) => {
        const ap = node({
          id: `ap-${index}`,
          type: 'ap',
          kind: 'ap',
          name: groupVendor(group.bssids),
          vendor: groupVendor(group.bssids),
          address: group.bssids[0] ?? null,
          detail: group.bands.map(band => `${band} GHz`).join(' · ') || null,
          parent: local.id,
          link: 'mesh',
          bands: group.bands,
          count: group.bssids.length,
          connected: group.connected,
          signalDbm: group.rssi,
        });
        nodes.push(ap);
        if (group.connected) phoneParent = ap;
      });
    } else if (groups[0]) {
      local.bands = groups[0].bands;
      local.vendor = groupVendor(groups[0].bssids);
    }
  }

  const selfLink: TopoLink = cellular
    ? 'cellular'
    : input.transport === 'wifi'
    ? 'wireless'
    : 'wired';
  const self = node({
    id: 'self',
    type: 'self',
    kind: 'phone',
    name: input.deviceName,
    address: input.localAddress,
    parent: phoneParent.id,
    link: selfLink,
    signalDbm: input.wifi?.rssi ?? null,
  });
  if (cellular) {
    self.linkMs = local.rttMs;
    self.linkState = rateLink(local.rttMs, LINK_LIMITS.path);
  } else {
    self.linkMs = input.gatewayRttMs;
    self.linkState = rateLink(input.gatewayRttMs, LINK_LIMITS.local);
  }
  nodes.push(self);

  let hiddenDevices = 0;
  if (!cellular) {
    const devices = input.lan
      .filter(device => !device.isSelf && !device.isGateway && device.address !== input.gateway)
      .sort((a, b) => a.kind.localeCompare(b.kind) || compareAddress(a.address, b.address));
    hiddenDevices = Math.max(0, devices.length - MAX_LAN_DEVICES);
    for (const device of devices.slice(0, MAX_LAN_DEVICES)) {
      nodes.push(
        node({
          id: `lan-${device.address}`,
          type: 'lan',
          kind: device.kind,
          name: device.name,
          address: device.address,
          detail: device.model,
          rttMs: device.rttMs,
          parent: local.id,
          link: 'lan',
          linkMs: device.rttMs,
          linkState: rateLink(device.rttMs, LINK_LIMITS.local),
        }),
      );
    }
  }

  const nearby = [...input.bluetooth].sort((a, b) => b.rssi - a.rssi).slice(0, MAX_BLUETOOTH);
  for (const device of nearby) {
    nodes.push(
      node({
        id: `bt-${device.address}`,
        type: 'bluetooth',
        kind: device.kind,
        name: device.name,
        address: device.address,
        parent: 'self',
        link: 'bluetooth',
        signalDbm: device.rssi,
      }),
    );
  }

  return { nodes, hiddenHops, hiddenDevices, doubleNat, cgnat, reached };
}

/** First registered maker among an access point's BSSIDs (random ones have none). */
function groupVendor(bssids: readonly string[]): string | null {
  for (const bssid of bssids) {
    const vendor = macVendor(bssid);
    if (vendor) return vendor;
  }
  return null;
}

function compareAddress(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 4; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return a.localeCompare(b);
}

// ── Layout ──────────────────────────────────────────────────────────────────

export const NODE_WIDTH = 84;
export const NODE_HEIGHT = 92;
export const ROW_GAP = 28;

export interface TopoLayout {
  width: number;
  height: number;
  /** Centre of each node's icon. */
  positions: Record<string, { x: number; y: number }>;
}

/** Row of each node type, top to bottom. */
const TIER_OF: Record<TopoNodeType, number> = {
  internet: 0,
  hop: 1,
  more: 1,
  operator: 2,
  router: 2,
  ap: 3,
  self: 4,
  lan: 5,
  bluetooth: 6,
};

/**
 * Rows top to bottom: internet, each path hop, router, access points, this
 * phone, LAN devices (wrapped), Bluetooth devices. Nodes in a row are spread
 * evenly across `width`.
 */
export function layoutTopology(topology: Topology, width: number): TopoLayout {
  const perRow = Math.max(2, Math.floor(width / NODE_WIDTH));
  const rows: TopoNode[][] = [];
  // Hops keep their own row each, in path order (internet at the top).
  const pathOrder = topology.nodes.filter(item => item.type === 'hop' || item.type === 'more');
  const tiers = new Map<number, TopoNode[]>();
  for (const item of topology.nodes) {
    if (item.type === 'hop' || item.type === 'more') continue;
    const tier = TIER_OF[item.type];
    tiers.set(tier, [...(tiers.get(tier) ?? []), item]);
  }
  const pushWrapped = (items: TopoNode[]) => {
    for (let i = 0; i < items.length; i += perRow) rows.push(items.slice(i, i + perRow));
  };
  pushWrapped(tiers.get(0) ?? []);
  for (const hop of pathOrder) rows.push([hop]);
  for (const tier of [2, 3, 4, 5, 6]) pushWrapped(tiers.get(tier) ?? []);

  const positions: TopoLayout['positions'] = {};
  rows.forEach((row, rowIndex) => {
    const y = rowIndex * (NODE_HEIGHT + ROW_GAP) + NODE_HEIGHT / 2 - 14;
    // An odd number of access points would put one right on the router's
    // line down to the devices; leave the centre free instead.
    const isAccessPoints = row[0]?.type === 'ap' && row.length % 2 === 1 && row.length < perRow;
    const slots = isAccessPoints ? row.length + 1 : row.length;
    const step = width / slots;
    let slot = 0;
    for (const item of row) {
      if (isAccessPoints && slot === Math.floor(slots / 2)) slot++;
      positions[item.id] = { x: Math.round(step * (slot + 0.5)), y };
      slot++;
    }
  });
  return {
    width,
    height: rows.length * (NODE_HEIGHT + ROW_GAP) - ROW_GAP + 8,
    positions,
  };
}
