jest.mock('../src/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../src/lib/consents', () => ({ fetchConsentStatus: jest.fn() }));

import { isConsentCheckCompleteForUser } from '../src/consents/useConsentGate';
import {
  shouldRefreshAfterAppStateChange,
} from '../src/lifecycle/AppLifecycleContext';
import { handleHardwareBackPress } from '../src/navigation/NavigationContext';

describe('Android custom navigation back handling', () => {
  it('consumes hardware back only when a nested route can pop', () => {
    const goBack = jest.fn();

    expect(handleHardwareBackPress(true, goBack)).toBe(true);
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('lets Android exit normally at the root route', () => {
    const goBack = jest.fn();

    expect(handleHardwareBackPress(false, goBack)).toBe(false);
    expect(goBack).not.toHaveBeenCalled();
  });
});

describe('consent gate identity binding', () => {
  it('does not treat a different user\'s completed check as current', () => {
    expect(isConsentCheckCompleteForUser('user-a', 'user-a')).toBe(true);
    expect(isConsentCheckCompleteForUser('user-b', 'user-a')).toBe(false);
    expect(isConsentCheckCompleteForUser('user-a', null)).toBe(false);
  });
});

describe('foreground refresh token', () => {
  it('only refreshes after a real background or inactive resume', () => {
    expect(shouldRefreshAfterAppStateChange('active', 'active')).toBe(false);
    expect(shouldRefreshAfterAppStateChange('background', 'active')).toBe(true);
    expect(shouldRefreshAfterAppStateChange('inactive', 'active')).toBe(true);
    expect(shouldRefreshAfterAppStateChange(null, 'active')).toBe(false);
  });
});
