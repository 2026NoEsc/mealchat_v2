const React = require('react');
const { act, create } = require('react-test-renderer');
const { Alert, Platform, Text } = require('react-native');
jest.mock('../src/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'A' } }) }));
jest.mock('../src/navigation/NavigationContext', () => ({ useNavigation: jest.fn() }));
jest.mock('../src/components/AppHeader', () => () => null);
jest.mock('../src/theme/insets', () => ({ useTopInset: () => 0 }));
jest.mock('../src/lifecycle/AppLifecycleContext', () => ({ useForegroundRefreshToken: () => 0 }));
jest.mock('../src/rooms/useMyRooms', () => ({ useMyRooms: jest.fn() }));
jest.mock('../src/lib/rooms', () => ({ fetchMyPendingRoomInvitations: jest.fn(), acceptRoomInvitation: jest.fn(), declineRoomInvitation: jest.fn(), joinRoomByCode: jest.fn() }));
const { isRoomMembershipClosed, membershipClosedMessage, canInviteToRoom } = require('../src/lib/roomMembership');
const { roomDecisionErrorMessage } = require('../src/lib/roomDecisions');
const { useNavigation } = require('../src/navigation/NavigationContext');
const { useMyRooms } = require('../src/rooms/useMyRooms');
const { fetchMyPendingRoomInvitations, acceptRoomInvitation } = require('../src/lib/rooms');
const ChatHomeScreen = require('../src/screens/chat/ChatHomeScreen').default;
const DialogHost = require('../src/components/DialogHost').default;
const originalPlatform = Platform.OS;
let renderer;
beforeEach(() => jest.clearAllMocks());
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = undefined; Platform.OS = originalPlatform; jest.restoreAllMocks(); });
it('recognizes only the membership hint and preserves generic stage guidance for other operations', () => {
  const error = { code: 'S4003', hint: 'operation=membership', message: 'private SQL' };
  expect(isRoomMembershipClosed(error)).toBe(true); expect(roomDecisionErrorMessage(error)).toBe(membershipClosedMessage);
  for (const hint of [undefined, 'operation=unknown', 'operation=vote_confirmation']) {
    expect(isRoomMembershipClosed({ ...error, hint })).toBe(false);
    expect(roomDecisionErrorMessage({ ...error, hint })).not.toBe(membershipClosedMessage);
  }
  expect(['scheduling', 'place', 'confirmed'].every(canInviteToRoom)).toBe(true);
  expect(['settling', 'done', null].some(canInviteToRoom)).toBe(false);
});
it.each(['ios', 'android', 'web'])('shows the membership rejection on %s, refreshes state and removes the failed acceptance without navigating', async platform => {
  Platform.OS = platform;
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {}), reload = jest.fn(), navigate = jest.fn();
  useMyRooms.mockReturnValue({ rooms: [], status: 'ready', reload }); useNavigation.mockReturnValue({ navigate });
  const invitation = { id: 'invitation', roomId: 'room', roomTitle: '초대받은 밥약', expiresAt: '2099-01-01T00:00:00Z', status: 'pending' };
  fetchMyPendingRoomInvitations.mockResolvedValue({ data: [invitation], error: null });
  acceptRoomInvitation.mockResolvedValue({ roomId: null, error: { code: 'S4003', hint: 'operation=membership', message: 'private SQL' } });
  await act(async () => { renderer = create(React.createElement(React.Fragment, null, React.createElement(ChatHomeScreen), React.createElement(DialogHost))); });
  const accept = renderer.root.findAll(node => typeof node.props?.onPress === 'function' && node.findAllByType(Text).some(child => child.props.children === '수락'))[0];
  expect(accept).toBeDefined(); await act(async () => accept.props.onPress());
  if (platform === 'web') {
    const labels = renderer.root.findAllByType(Text).map(node => node.props.children);
    expect(labels).toContain('초대를 수락할 수 없어요'); expect(labels).toContain(membershipClosedMessage);
    expect(labels.join(' ')).not.toContain('private SQL'); expect(alert).not.toHaveBeenCalled();
    const confirm = renderer.root.findAll(node => node.props?.accessibilityRole === 'button' && typeof node.props?.onPress === 'function' && node.findAllByType(Text).some(child => child.props.children === '확인'))[0];
    expect(confirm).toBeDefined(); await act(async () => confirm.props.onPress());
    expect(renderer.root.findAllByType(Text).some(node => node.props.children === membershipClosedMessage)).toBe(false);
  } else {
    expect(alert).toHaveBeenCalledWith('초대를 수락할 수 없어요', membershipClosedMessage);
  }
  expect(fetchMyPendingRoomInvitations).toHaveBeenCalledTimes(2); expect(reload).toHaveBeenCalled(); expect(navigate).not.toHaveBeenCalled();
  expect(renderer.root.findAllByType(Text).some(node => node.props.children === invitation.roomTitle)).toBe(false);
});
