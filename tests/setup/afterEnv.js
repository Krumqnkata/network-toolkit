/* global beforeEach, jest */

// Each test starts with an empty database.
beforeEach(() => {
  jest.requireMock('../../src/native/specs/NativeStorageModule').default.resetStorage();
});

// Home-screen background probes (latency row, public IP) are off unless a test
// turns them on, so that tool tests only see their own native calls.
beforeEach(() => {
  jest.requireActual('../../src/features/dashboard/services/homeData').homeProbes.enabled = false;
});

// The problem locator spaces its pings a quarter second apart; not in tests.
beforeEach(() => {
  jest.requireActual(
    '../../src/features/health-check/services/problemLocator',
  ).locatorTiming.spacingMs = 0;
});

// The Wi-Fi survey waits between signal samples; not in tests.
beforeEach(() => {
  jest.requireActual('../../src/features/wifi-survey/services/survey').surveyTiming.spacingMs = 0;
});
