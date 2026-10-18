module.exports = function createSecureStoreMock() {
  const items = new Map();
  const store = {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6,
    isAvailableAsync: jest.fn(), getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn(),
    reset() {
      items.clear();
      store.isAvailableAsync.mockReset().mockResolvedValue(true);
      store.getItemAsync.mockReset().mockImplementation(async key => items.get(key) ?? null);
      store.setItemAsync.mockReset().mockImplementation(async (key, value) => { items.set(key, value); });
      store.deleteItemAsync.mockReset().mockImplementation(async key => { items.delete(key); });
    },
  };
  store.reset(); return store;
};
