/* global jest */

// Safe-area insets are provided by native code; use the library's own mock.
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

// Turbo Native Modules do not exist under Jest. Tests override the resolved
// value per case with `mockResolvedValue`.
jest.mock('../../src/native/specs/NativeNetworkModule', () => ({
  __esModule: true,
  default: {
    getNetworkSnapshot: jest.fn(() =>
      Promise.resolve(require('../fixtures/networkSnapshot').wifiSnapshot),
    ),
  },
}));

jest.mock('../../src/native/specs/NativeWifiModule', () => ({
  __esModule: true,
  default: {
    scan: jest.fn(() => Promise.resolve(require('../fixtures/wifiScan').scanResult)),
    getCachedScanResults: jest.fn(() =>
      Promise.resolve({ ...require('../fixtures/wifiScan').scanResult, fresh: false }),
    ),
  },
}));

jest.mock('../../src/native/specs/NativeNetToolsModule', () => ({
  __esModule: true,
  default: {
    ping: jest.fn(),
    dnsQuery: jest.fn(),
    tcpConnect: jest.fn(),
    httpRequest: jest.fn(),
    tlsInspect: jest.fn(),
  },
}));

jest.mock('../../src/native/specs/NativeLanModule', () => ({
  __esModule: true,
  default: {
    probeHosts: jest.fn(),
    netbiosQuery: jest.fn(),
    mdnsQuery: jest.fn(),
    ssdpSearch: jest.fn(),
    scanPorts: jest.fn(),
  },
}));

jest.mock('../../src/native/specs/NativeSpeedTestModule', () => ({
  __esModule: true,
  default: {
    start: jest.fn(),
    // Idle by default: the Speed tab reads the status when it is first shown.
    getStatus: jest.fn(() =>
      Promise.resolve({
        phase: 'idle',
        progress: 0,
        currentMbps: null,
        downloadMbps: null,
        uploadMbps: null,
        idleLatencyMs: null,
        jitterMs: null,
        downloadLatencyMs: null,
        uploadLatencyMs: null,
        packetLossPercent: null,
        bytesDownloaded: 0,
        bytesUploaded: 0,
        serverColo: null,
        serverCity: null,
        serverCountry: null,
        error: null,
      }),
    ),
    cancel: jest.fn(() => Promise.resolve()),
  },
}));

// In-memory stand-in for the SQLite storage module, reset by `resetStorage()`.
jest.mock('../../src/native/specs/NativeStorageModule', () => {
  const state = { records: [], settings: new Map(), nextId: 1 };
  const api = {
    insertRecord: jest.fn(async (kind, createdAt, data) => {
      const id = state.nextId++;
      state.records.push({ id, kind, createdAt, data });
      return id;
    }),
    updateRecord: jest.fn(async (id, data) => {
      const record = state.records.find(candidate => candidate.id === id);
      if (record) record.data = data;
      return Boolean(record);
    }),
    listRecords: jest.fn(async (kind, limit, before) =>
      state.records
        .filter(record => record.kind === kind && (before <= 0 || record.createdAt < before))
        .sort((a, b) => b.createdAt - a.createdAt || b.id - a.id)
        .slice(0, limit)
        .map(record => ({ ...record })),
    ),
    deleteRecord: jest.fn(async id => {
      const before = state.records.length;
      state.records = state.records.filter(record => record.id !== id);
      return state.records.length < before;
    }),
    clearRecords: jest.fn(async kind => {
      const before = state.records.length;
      state.records = state.records.filter(record => record.kind !== kind);
      return before - state.records.length;
    }),
    pruneRecords: jest.fn(async (kind, keep) => {
      const keepIds = new Set(
        state.records
          .filter(record => record.kind === kind)
          .sort((a, b) => b.createdAt - a.createdAt || b.id - a.id)
          .slice(0, keep)
          .map(record => record.id),
      );
      const before = state.records.length;
      state.records = state.records.filter(
        record => record.kind !== kind || keepIds.has(record.id),
      );
      return before - state.records.length;
    }),
    getSetting: jest.fn(async key => (state.settings.has(key) ? state.settings.get(key) : null)),
    setSetting: jest.fn(async (key, value) => {
      if (value === null) state.settings.delete(key);
      else state.settings.set(key, value);
    }),
    resetStorage: () => {
      state.records = [];
      state.settings = new Map();
      state.nextId = 1;
    },
  };
  return { __esModule: true, default: api };
});
