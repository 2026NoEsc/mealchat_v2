import { effectiveInvitationStatus } from '../src/lib/roomInvitationState';

describe('effectiveInvitationStatus', () => {
  const now = Date.parse('2026-08-23T12:00:00.000Z');

  it('hides an expired pending invitation before the next server refresh', () => {
    expect(effectiveInvitationStatus('pending', '2026-08-23T11:59:59.000Z', now)).toBe('expired');
  });

  it('keeps a future pending invitation actionable', () => {
    expect(effectiveInvitationStatus('pending', '2026-08-23T12:00:01.000Z', now)).toBe('pending');
  });

  it('does not reinterpret terminal server states', () => {
    expect(effectiveInvitationStatus('accepted', '2026-08-23T11:00:00.000Z', now)).toBe('accepted');
    expect(effectiveInvitationStatus('declined', '2026-08-23T11:00:00.000Z', now)).toBe('declined');
  });
});
