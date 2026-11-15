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
