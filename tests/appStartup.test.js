const React = require('react');
const { act, create } = require('react-test-renderer');

jest.mock('expo-font', () => ({ useFonts: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }) => children,
}));
jest.mock('../src/auth/AuthProvider', () => ({ AuthProvider: () => 'application-ready' }));
jest.mock('../src/auth/SignupDraftProvider', () => ({}));
jest.mock('../src/components/DialogHost', () => () => null);
jest.mock('../src/components/NotificationsProvider', () => ({}));
jest.mock('../src/consents/useConsentGate', () => ({}));
jest.mock('../src/lifecycle/AppLifecycleContext', () => ({}));
jest.mock('../src/navigation/AppNavigator', () => ({}));
jest.mock('../src/navigation/NavigationContext', () => ({}));
jest.mock('../src/screens/auth/NewPasswordScreen', () => ({}));
jest.mock('../src/screens/auth/ReConsentScreen', () => ({}));

const App = require('../App').default;
const { useFonts } = require('expo-font');

it.each([
  [false, null, false],
  [true, null, true],
  [false, new Error('font unavailable'), true],
])('font readiness %s with error %s controls the startup screen', async (loaded, error, ready) => {
  useFonts.mockReturnValue([loaded, error]);
  let renderer;
  await act(async () => { renderer = create(React.createElement(App)); });
  expect(JSON.stringify(renderer.toJSON()).includes('application-ready')).toBe(ready);
  await act(async () => renderer.unmount());
});
