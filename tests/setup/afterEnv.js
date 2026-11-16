/* global beforeEach, jest */

// Each test starts with an empty database.
beforeEach(() => {
  jest.requireMock('../../src/native/specs/NativeStorageModule').default.resetStorage();
});
