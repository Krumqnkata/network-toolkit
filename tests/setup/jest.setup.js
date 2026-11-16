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
