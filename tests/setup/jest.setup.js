/* global jest */

// Safe-area insets are provided by native code; use the library's own mock.
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
