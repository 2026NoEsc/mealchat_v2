const React = require('react');
const { act, create } = require('react-test-renderer');
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-linking', () => ({ getInitialURL: jest.fn().mockResolvedValue(null), addEventListener: jest.fn(() => ({ remove: jest.fn() })), createURL: path => path }));
jest.mock('../src/lib/profile', () => ({ saveMyPrivateProfile: jest.fn() }));
jest.mock('../src/lib/supabase', () => ({ supabase: { auth: { getSession: jest.fn(), onAuthStateChange: jest.fn(), signOut: jest.fn() } } }));
const { AuthProvider, useAuth } = require('../src/auth/AuthProvider');
const { supabase } = require('../src/lib/supabase');
const { setRestaurantRecommendationUser, createRestaurantRecommendation, getRestaurantRecommendation, updateRestaurantRecommendation, removeRestaurantRecommendation } = require('../src/lib/restaurantRecommendationCache');
let renderer, authContext, authChanged;
function Probe() { authContext = useAuth(); return null; }
const state = { key: 'room', roomId: 'room', status: 'ready', items: [{ label: 'A 식당' }], receivedMore: false };
const seed = () => createRestaurantRecommendation('account-a', 'room', 0, state);
beforeEach(() => {
  jest.clearAllMocks(); setRestaurantRecommendationUser(null);
  supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'account-a' } } } });
  supabase.auth.onAuthStateChange.mockImplementation(callback => { authChanged = callback; return { data: { subscription: { unsubscribe: jest.fn() } } }; });
  supabase.auth.signOut.mockResolvedValue({ error: null });
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = undefined; setRestaurantRecommendationUser(null); jest.useRealTimers(); });
async function mount() { await act(async () => { renderer = create(React.createElement(AuthProvider, null, React.createElement(Probe))); }); }
it('clears all room caches on an external signed-out event with no chat screen mounted', async () => {
  await mount(); seed(); createRestaurantRecommendation('account-a', 'other-room', 0, { ...state, key: 'other-room' });
  await act(async () => authChanged('SIGNED_OUT', null));
  expect(authContext.user).toBeNull();
  await act(async () => authChanged('SIGNED_IN', { user: { id: 'account-a' } }));
  expect(getRestaurantRecommendation('account-a', 'room')).toBeUndefined();
  expect(getRestaurantRecommendation('account-a', 'other-room')).toBeUndefined();
});
it('preserves results on token refresh but clears them on an id change', async () => {
  await mount(); const old = seed();
  await act(async () => authChanged('TOKEN_REFRESHED', { user: { id: 'account-a' } }));
  expect(getRestaurantRecommendation('account-a', 'room')).toBe(old);
  await act(async () => authChanged('SIGNED_IN', { user: { id: 'account-b' } }));
  expect(authContext.user.id).toBe('account-b');
  expect(getRestaurantRecommendation('account-b', 'room')).toBeUndefined();
  await act(async () => authChanged('SIGNED_IN', { user: { id: 'account-a' } }));
  updateRestaurantRecommendation('account-a', 'room', old, { ...state, status: 'error' });
  expect(getRestaurantRecommendation('account-a', 'room')).toBeUndefined();
});
it.each([false, true])('clears on successful signOut even without an auth event, preserving cache on failure=%s', async fail => {
  await mount(); const cached = seed();
  const error = fail ? Error('offline') : null;
  supabase.auth.signOut.mockResolvedValueOnce({ error });
  let result; await act(async () => { result = await authContext.signOut(); });
  expect(result).toBe(error);
  expect(getRestaurantRecommendation('account-a', 'room')).toBe(fail ? cached : undefined);
});
it('clears a previous in-memory account when restoring a different session', async () => {
  setRestaurantRecommendationUser('account-a'); const old = seed();
  supabase.auth.getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'account-b' } } } });
  await mount();
  expect(authContext.user.id).toBe('account-b');
  expect(getRestaurantRecommendation('account-b', 'room')).toBeUndefined();
  setRestaurantRecommendationUser('account-a');
  updateRestaurantRecommendation('account-a', 'room', old, state);
  expect(getRestaurantRecommendation('account-a', 'room')).toBeUndefined();
});

it.each(['completion', 'account-change', 'saved-restaurant'])('clears pending timeout on %s', action => {
  jest.useFakeTimers(); setRestaurantRecommendationUser('account-a');
  const entry = createRestaurantRecommendation('account-a', 'room', 0, { ...state, status: 'loading' });
  expect(jest.getTimerCount()).toBe(1);
  if (action === 'completion') updateRestaurantRecommendation('account-a', 'room', entry, state);
  else if (action === 'account-change') setRestaurantRecommendationUser('account-b');
  else removeRestaurantRecommendation('account-a', 'room');
  expect(jest.getTimerCount()).toBe(0);
});
