const React = require('react');
const { act, create } = require('react-test-renderer');

jest.mock('expo-font', () => ({ useFonts: jest.fn() }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../src/auth/AuthProvider', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: jest.fn(),
}));
jest.mock('../src/auth/SignupDraftProvider', () => ({
  SignupDraftProvider: ({ children }) => children,
}));
jest.mock('../src/components/DialogHost', () => () => null);
jest.mock('../src/components/NotificationsProvider', () => ({
  NotificationsProvider: ({ children }) => children,
}));
jest.mock('../src/consents/useConsentGate', () => ({ useConsentGate: jest.fn() }));
jest.mock('../src/lifecycle/AppLifecycleContext', () => ({
  AppLifecycleProvider: ({ children }) => children,
}));
jest.mock('../src/navigation/AppNavigator', () => () => 'navigator');
jest.mock('../src/navigation/NavigationContext', () => ({
  NavigationProvider: jest.fn(({ children }) => children),
}));
jest.mock('../src/screens/auth/NewPasswordScreen', () => () => 'password-reset');
jest.mock('../src/screens/auth/ReConsentScreen', () => () => 'consent-required');
jest.mock('../src/screens/settings/NotificationPermissionGate', () => ({ __esModule: true, default: ({ children }) => children }));

const App = require('../App').default;
const { useFonts } = require('expo-font');
const { useAuth } = require('../src/auth/AuthProvider');
const { useConsentGate } = require('../src/consents/useConsentGate');
const { NavigationProvider } = require('../src/navigation/NavigationContext');
const NewPasswordScreen = require('../src/screens/auth/NewPasswordScreen');
const Toast = require('../src/components/ui/Toast').default;
let renderer;

beforeEach(() => {
  jest.clearAllMocks();
  useFonts.mockReturnValue([true, null]);
  useConsentGate.mockReturnValue({ checked: true, needsConsent: false, markConsented: jest.fn() });
});

afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = undefined;
  jest.useRealTimers();
});

it.each([
  [null, 'SignupStart'],
  [{ user: { id: 'fixture-user' } }, 'Home'],
])('chooses the entry route for session %s', async (session, expected) => {
  useAuth.mockReturnValue({ isReady: true, session, passwordResetPending: false });
  await act(async () => { renderer = create(React.createElement(App)); });
  expect(NavigationProvider.mock.calls[0][0].initialRoute).toBe(expected);
});

it('waits for auth restoration before mounting navigation', async () => {
  useAuth.mockReturnValue({ isReady: false, session: null, passwordResetPending: false });
  await act(async () => { renderer = create(React.createElement(App)); });
  expect(NavigationProvider).not.toHaveBeenCalled();
});

it('keeps a password recovery session on the reset screen', async () => {
  useAuth.mockReturnValue({ isReady: true, session: { user: { id: 'fixture-user' } }, passwordResetPending: true });
  await act(async () => { renderer = create(React.createElement(App)); });
  expect(JSON.stringify(renderer.toJSON())).toContain('password-reset');
  expect(NavigationProvider).not.toHaveBeenCalled();
});

it('returns to login after canceling password recovery instead of the first-run welcome screen', async () => {
  useAuth.mockReturnValue({ isReady: true, session: { user: { id: 'fixture-user' } }, passwordResetPending: true });
  await act(async () => { renderer = create(React.createElement(App)); });
  await act(async () => renderer.root.findByType(NewPasswordScreen).props.onCancelRequested());
  useAuth.mockReturnValue({ isReady: true, session: null, passwordResetPending: false });
  await act(async () => renderer.update(React.createElement(App)));
  expect(NavigationProvider.mock.calls[0][0].initialRoute).toBe('Login');
});

it.each([
  [false, false, false],
  [true, true, true],
])('keeps navigation behind the consent gate checked=%s needsConsent=%s', async (checked, needsConsent, showsConsent) => {
  useAuth.mockReturnValue({ isReady: true, session: { user: { id: 'fixture-user' } }, passwordResetPending: false });
  useConsentGate.mockReturnValue({ checked, needsConsent, markConsented: jest.fn() });
  await act(async () => { renderer = create(React.createElement(App)); });
  expect(NavigationProvider).not.toHaveBeenCalled();
  expect(JSON.stringify(renderer.toJSON()).includes('consent-required')).toBe(showsConsent);
});

it('shows loading only after one second across the font and auth startup stages', async () => {
  jest.useFakeTimers();
  useFonts.mockReturnValue([false, null]);
  useAuth.mockReturnValue({ isReady: false, session: null, passwordResetPending: false });
  await act(async () => { renderer = create(React.createElement(App)); });
  await act(async () => jest.advanceTimersByTime(700));
  expect(JSON.stringify(renderer.toJSON())).not.toContain('밥약을 불러오는 중이에요');
  useFonts.mockReturnValue([true, null]);
  await act(async () => renderer.update(React.createElement(App)));
  await act(async () => jest.advanceTimersByTime(299));
  expect(JSON.stringify(renderer.toJSON())).not.toContain('밥약을 불러오는 중이에요');
  await act(async () => jest.advanceTimersByTime(1));
  expect(JSON.stringify(renderer.toJSON())).toContain('밥약을 불러오는 중이에요');
  useAuth.mockReturnValue({ isReady: true, session: null, passwordResetPending: false });
  await act(async () => renderer.update(React.createElement(App)));
  expect(JSON.stringify(renderer.toJSON())).not.toContain('밥약을 불러오는 중이에요');
  expect(NavigationProvider.mock.calls[0][0].initialRoute).toBe('SignupStart');
});

it('clears the canceled-reset redirect after signOut fails', async () => {
  const session = { user: { id: 'fixture-user' } };
  useAuth.mockReturnValue({ isReady: true, session, passwordResetPending: true });
  await act(async () => { renderer = create(React.createElement(App)); });
  await act(async () => renderer.root.findByType(NewPasswordScreen).props.onCancelRequested());
  await act(async () => renderer.root.findByType(NewPasswordScreen).props.onCancelFailed());
  useAuth.mockReturnValue({ isReady: true, session: null, passwordResetPending: false });
  await act(async () => renderer.update(React.createElement(App)));
  expect(NavigationProvider.mock.calls.at(-1)[0].initialRoute).toBe('SignupStart');
});

it('clears the canceled-reset redirect when a new authenticated session arrives', async () => {
  useAuth.mockReturnValue({ isReady: true, session: { user: { id: 'fixture-user' } }, passwordResetPending: true });
  await act(async () => { renderer = create(React.createElement(App)); });
  await act(async () => renderer.root.findByType(NewPasswordScreen).props.onCancelRequested());
  useAuth.mockReturnValue({ isReady: true, session: null, passwordResetPending: false });
  await act(async () => renderer.update(React.createElement(App)));
  expect(NavigationProvider.mock.calls.at(-1)[0].initialRoute).toBe('Login');
  useAuth.mockReturnValue({ isReady: true, session: { user: { id: 'next-user' } }, passwordResetPending: false });
  await act(async () => renderer.update(React.createElement(App)));
  useAuth.mockReturnValue({ isReady: true, session: null, passwordResetPending: false });
  await act(async () => renderer.update(React.createElement(App)));
  expect(NavigationProvider.mock.calls.at(-1)[0].initialRoute).toBe('SignupStart');
});

it('keeps password completion feedback visible after navigating home and dismisses it after its duration', async () => {
  jest.useFakeTimers();
  const session = { user: { id: 'fixture-user' } };
  useAuth.mockReturnValue({ isReady: true, session, passwordResetPending: true });
  await act(async () => { renderer = create(React.createElement(App)); });
  const onPasswordChanged = renderer.root.findByType(NewPasswordScreen).props.onPasswordChanged;
  useAuth.mockReturnValue({ isReady: true, session, passwordResetPending: false });
  await act(async () => renderer.update(React.createElement(App)));
  expect(renderer.root.findAllByType(NewPasswordScreen)).toHaveLength(0);
  await act(async () => onPasswordChanged());
  expect(JSON.stringify(renderer.toJSON())).toContain('navigator');
  expect(renderer.root.findByType(Toast).props.toast.message).toBe('비밀번호를 바꿨어요');
  await act(async () => jest.advanceTimersByTime(3000));
  expect(renderer.root.findByType(Toast).props.toast).toBeNull();
});
