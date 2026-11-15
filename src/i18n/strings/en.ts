/**
 * English strings — the source of truth for the shape of every translation.
 * Other languages are typed as `Strings`, so a missing or extra key is a
 * compile error. Functions are used for strings with parameters.
 */
export const en = {
  common: {
    retry: 'Try again',
    unknown: 'Unknown',
    yes: 'Yes',
    no: 'No',
    loading: 'Loading…',
    updatedAt: (time: string) => `Updated ${time}`,
    planned: 'Planned',
    milestone: (n: number) => `M${n}`,
  },
  tabs: {
    dashboard: 'Dashboard',
    wifi: 'Wi-Fi',
    tools: 'Tools',
    settings: 'Settings',
  },
  dashboard: {
    title: 'Network Toolkit',
    subtitle: 'Your connection at a glance.',
    quickAccess: 'Quick access',
    openAction: (label: string) => `Open ${label}`,
    errorTitle: 'Could not read the network state',
    connectedVia: (transport: string) => `Connected via ${transport}`,
    notConnected: 'Not connected',
    notConnectedHint: 'Turn on Wi-Fi or mobile data to see connection details.',
    internet: {
      ok: 'Internet OK',
      checking: 'Checking internet…',
      none: 'No internet access',
      captivePortal: 'Sign-in required',
    },
    badges: {
      vpn: 'VPN',
      metered: 'Metered',
    },
    sections: {
      wifi: 'Wi-Fi',
      ip: 'IP configuration',
      cellular: 'Mobile network',
    },
    fields: {
      ssid: 'Network name',
      hiddenNetwork: 'Hidden network',
      bssid: 'BSSID',
      band: 'Band',
      channel: 'Channel',
      frequency: 'Frequency',
      linkSpeed: 'Link speed',
      txRx: 'Tx / Rx',
      maxLinkSpeed: 'Max supported',
      standard: 'Standard',
      security: 'Security',
      interface: 'Interface',
      ipv4: 'IPv4 address',
      ipv6: 'IPv6 address',
      gateway: 'Gateway',
      dns: 'DNS servers',
      privateDns: 'Private DNS',
      mtu: 'MTU',
      domain: 'Search domain',
      operator: 'Operator',
      bandwidth: 'Estimated bandwidth',
    },
    privateDnsOn: (server: string | null) => (server ? `On · ${server}` : 'On (automatic)'),
    privateDnsOff: 'Off',
    notAvailable: 'Not available',
    signal: 'Signal',
  },
  permissions: {
    ssidTitle: 'Show the network name',
    ssidBody:
      'Android only reveals the Wi-Fi name (SSID) and access point (BSSID) to apps with precise location access. Network Toolkit does not read, store or send your location.',
    scanTitle: 'Allow Wi-Fi scanning',
    scanBody:
      'Android requires precise location access to scan for nearby Wi-Fi networks, on every Android version. Network Toolkit does not read, store or send your location.',
    allow: 'Allow access',
    blockedBody:
      'Location access was denied permanently. You can enable it in the app settings under Permissions → Location → Allow while using the app, with precise location on.',
    openSettings: 'Open app settings',
    locationOffTitle: 'Location is turned off',
    locationOffBody:
      'Android hides Wi-Fi names and scan results while location services are off, even when the app has permission.',
    openLocationSettings: 'Open location settings',
  },
  transport: {
    wifi: 'Wi-Fi',
    cellular: 'Mobile data',
    ethernet: 'Ethernet',
    bluetooth: 'Bluetooth',
    vpn: 'VPN',
    other: 'Other',
    none: 'None',
  },
  signalQuality: {
    excellent: 'Excellent',
    good: 'Good',
    fair: 'Fair',
    weak: 'Weak',
    poor: 'Poor',
  },
  security: {
    open: 'Open (no encryption)',
    wep: 'WEP (insecure)',
    'wpa-personal': 'WPA/WPA2 Personal',
    'wpa3-personal': 'WPA3 Personal',
    'wpa-enterprise': 'WPA/WPA2 Enterprise',
    'wpa3-enterprise': 'WPA3 Enterprise',
    'wpa3-enterprise-192': 'WPA3 Enterprise 192-bit',
    owe: 'Enhanced Open (OWE)',
    wapi: 'WAPI',
    passpoint: 'Passpoint',
  },
  wifiAnalyzer: {
    title: 'Wi-Fi Analyzer',
    subtitle: 'Nearby networks, channels and signal strength.',
    scan: 'Scan now',
    scanning: 'Scanning…',
    autoScan: 'Auto-scan every 30 s',
    autoScanHint: 'Android allows 4 scans per 2 minutes.',
    summary: (count: number, time: string) =>
      `${count} ${count === 1 ? 'network' : 'networks'} · ${time}`,
    throttled: 'Android limited scanning — showing the most recent results.',
    wifiOffTitle: 'Wi-Fi is turned off',
    wifiOffBody: 'Turn on Wi-Fi to scan for nearby networks.',
    errorTitle: 'Scan failed',
    emptyBand: 'No networks found on this band.',
    bands: { '2.4': '2.4 GHz', '5': '5 GHz', '6': '6 GHz' },
    bandWithCount: (band: string, count: number) => `${band} (${count})`,
    graphTitle: 'Channel graph',
    graphLabel: (count: number, band: string) =>
      `Channel graph: ${count} networks on ${band}. Details are listed below.`,
    channelAxis: 'Channel',
    recommendationsTitle: 'Best channels',
    recommendationsHint:
      'Ranked by how strongly visible networks overlap each 20 MHz channel. Lower load is better.',
    dfs: 'DFS',
    yourNetwork: 'Your network',
    yourNetworkLoad: (channel: string, overlapping: number) =>
      `Channel ${channel} · ${overlapping} overlapping ${
        overlapping === 1 ? 'network' : 'networks'
      }`,
    networksTitle: 'Networks',
    connected: 'Connected',
    hidden: 'Hidden network',
    channelShort: (channel: string) => `ch ${channel}`,
    load: { clear: 'Clear', light: 'Light', moderate: 'Moderate', busy: 'Busy' },
    security: {
      open: 'Open',
      owe: 'Enhanced Open',
      wep: 'WEP',
      wpa: 'WPA',
      wpa2: 'WPA2',
      'wpa2-wpa3': 'WPA2/WPA3',
      wpa3: 'WPA3',
      enterprise: 'Enterprise',
    },
    wps: 'WPS',
  },
  tools: {
    title: 'Tools',
    subtitle: 'Diagnostics for networks you own or manage.',
    categories: {
      diagnostics: 'Diagnostics',
      discovery: 'Discovery',
      web: 'Web & TLS',
      performance: 'Performance',
    },
    items: {
      ping: { name: 'Ping', description: 'Round-trip latency and packet loss to a host' },
      'dns-lookup': {
        name: 'DNS Lookup',
        description: 'Resolve A, AAAA, CNAME, MX, TXT and NS records',
      },
      'reverse-dns': { name: 'Reverse DNS', description: 'Find the hostname behind an IP address' },
      traceroute: { name: 'Traceroute', description: 'Hop-by-hop path to a destination' },
      reachability: {
        name: 'Internet Reachability',
        description: 'Check DNS, HTTP and captive-portal status',
      },
      'ip-info': { name: 'IP Information', description: 'Public IP, ASN and provider details' },
      'lan-scanner': { name: 'LAN Scanner', description: 'Discover devices on your local network' },
      'port-scanner': {
        name: 'Port Scanner',
        description: 'Find open TCP ports on a host you manage',
      },
      'http-headers': {
        name: 'HTTP Headers',
        description: 'Inspect status, redirects and response headers',
      },
      'tls-certificate': {
        name: 'TLS Certificate',
        description: 'Certificate chain, validity and protocol details',
      },
      'speed-test': { name: 'Speed Test', description: 'Download, upload, latency and jitter' },
      'connection-monitor': {
        name: 'Connection Monitor',
        description: 'Track latency, loss and outages over time',
      },
    },
  },
  settings: {
    title: 'Settings',
    appearance: 'Appearance',
    theme: 'Theme',
    themeHint: 'System follows your device setting.',
    themeOptions: { system: 'System', light: 'Light', dark: 'Dark' },
    language: 'Language',
    languageHint: 'System uses your device language when it is supported.',
    languageOptions: { system: 'System', en: 'English', bg: 'Български' },
    about: 'About',
    version: (version: string) => `Version ${version}`,
    license: 'License',
    licenseValue: (license: string) => `${license} — free and open source software`,
  },
};

type Widen<T> = T extends (...args: infer A) => string
  ? (...args: A) => string
  : T extends string
  ? string
  : { [K in keyof T]: Widen<T[K]> };

export type Strings = Widen<typeof en>;
