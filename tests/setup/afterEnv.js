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
