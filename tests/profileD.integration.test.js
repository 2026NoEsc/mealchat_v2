const React = require('react');
const { act, create } = require('react-test-renderer');
const { AccessibilityInfo, Alert, Modal, Platform, TextInput } = require('react-native');
const defaultPlatform = Platform.OS;

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../src/theme/keyboard', () => ({ useKeyboardOverlap: () => ({ overlap: 0, remeasure: jest.fn() }) }));
jest.mock('../src/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../src/lib/passwordReauthentication', () => ({ verifyCurrentPassword: jest.fn() }));
jest.mock('../src/profile/useMyProfile', () => ({ useMyProfile: jest.fn() }));
jest.mock('../src/navigation/NavigationContext', () => ({ useNavigation: jest.fn() }));
jest.mock('../src/components/NotificationsProvider', () => ({ useNotifications: () => ({ hasUnread: false, open: jest.fn() }) }));
jest.mock('../src/components/TmapMap', () => () => null);
jest.mock('react-native-webview', () => ({ WebView: (props) => require('react').createElement('ProfileWebView', props) }));
jest.mock('../src/lib/profile', () => ({
  updateMyName: jest.fn(async () => null), saveMyPrivateProfile: jest.fn(async () => null),
  saveMyGender: jest.fn(async () => null), saveStartLocation: jest.fn(async () => null),
  savePrivacySettings: jest.fn(async () => null),
  fetchProfileVisibility: jest.fn(), setProfileVisibility: jest.fn(),
}));
jest.mock('../src/lib/avatar', () => ({ uploadAvatar: jest.fn(), removeAvatar: jest.fn(async () => null) }));
jest.mock('../src/lib/friends', () => ({ fetchMyFriends: jest.fn(), searchProfilesByTag: jest.fn(), addFriend: jest.fn(), removeFriend: jest.fn() }));
jest.mock('../src/lib/tmap', () => ({ searchPlaces: jest.fn() }));
jest.mock('../src/lib/confirm', () => ({ notify: jest.fn() }));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(), requestCameraPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(), launchCameraAsync: jest.fn(),
}));
const { useAuth } = require('../src/auth/AuthProvider');
const { verifyCurrentPassword } = require('../src/lib/passwordReauthentication');
const { useMyProfile } = require('../src/profile/useMyProfile');
const { useNavigation } = require('../src/navigation/NavigationContext');
const api = require('../src/lib/profile');
const friendsApi = require('../src/lib/friends');
const avatarApi = require('../src/lib/avatar');
const picker = require('expo-image-picker');
const { searchPlaces } = require('../src/lib/tmap');
const { notify } = require('../src/lib/confirm');
const Toast = require('../src/components/ui/Toast').default;
const { useToast } = require('../src/components/ui/Toast');
const { Switch } = require('../src/components/ui/Switch');
const ProfileEditScreen = require('../src/screens/profile/ProfileEditScreen').default;
const PasswordChangeScreen = require('../src/screens/profile/PasswordChangeScreen').default;
const ProfileHomeScreen = require('../src/screens/profile/ProfileHomeScreen').default;
const FriendsScreen = require('../src/screens/profile/FriendsScreen').default;
const OriginScreen = require('../src/screens/profile/OriginScreen').default;
const PrivacyScreen = require('../src/screens/profile/PrivacyScreen').default;

let renderer;
let bundle;
let auth;
let navigation;
let store;
let profileState;
const mate = { id: 'follow-old', profileId: 'friend-1', name: '모아', tag: 'user-12345678', avatarColor: '', role: 'mate' };
beforeEach(() => {
  jest.clearAllMocks();
  verifyCurrentPassword.mockResolvedValue(null);
  Object.values(api).forEach((method) => method.mockResolvedValue(null));
  api.fetchProfileVisibility.mockResolvedValue({ data: { settings: { birthdate: 'public', gender: 'public', bio: 'private', bank_account: 'private', origin: 'private' }, revision: '2' }, error: null });
  api.setProfileVisibility.mockResolvedValue({ data: { settings: { birthdate: 'private', gender: 'public', bio: 'private', bank_account: 'private', origin: 'private' }, revision: '3' }, error: null });
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  bundle = {
    profile: { id: 'self', name: '밀챗', tag: 'user-00000000', avatarUrl: null, avatarColor: '' },
    privateProfile: { birthDate: '2000-01-02', bankName: null, accountNumber: null,
      personalData: { gender: 'male' }, privacySettings: {}, tastes: {}, foodProfileAvailable: true, foodProfileCompleted: true,
      startLocationName: '서면역', startLat: 35.15, startLng: 129.05 },
  };
  auth = { user: { id: 'self', email: 'fixture@example.test' }, updatePassword: jest.fn(async () => null), signOut: jest.fn(async () => null) };
  navigation = { current: { name: 'ProfileEdit' }, goBack: jest.fn(), goBackWith: jest.fn(), resetTo: jest.fn(), navigate: jest.fn(), replace: jest.fn(), canGoBack: true };
  profileState = { status: 'ready', userId: 'self', bundle, reload: jest.fn() };
  useAuth.mockImplementation(() => auth);
  useMyProfile.mockImplementation(() => profileState);
  useNavigation.mockImplementation(() => navigation);
  store = [{ ...mate }];
  friendsApi.fetchMyFriends.mockImplementation(async () => ({ data: [...store], error: null }));
  friendsApi.removeFriend.mockImplementation(async (id) => { store = store.filter((friend) => friend.id !== id); return null; });
  friendsApi.addFriend.mockImplementation(async (userId, targetId) => { store.push({ ...mate, id: 'follow-new', profileId: targetId }); return null; });
  friendsApi.searchProfilesByTag.mockResolvedValue({ data: [], error: null });
  avatarApi.uploadAvatar.mockResolvedValue({ url: 'fixture://avatar', error: null });
  avatarApi.removeAvatar.mockResolvedValue(null);
  picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
  picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true });
  picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true });
  picker.launchCameraAsync.mockResolvedValue({ canceled: true });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = undefined;
  jest.restoreAllMocks();
  jest.useRealTimers();
  Platform.OS = defaultPlatform;
});
async function render(Component) { await act(async () => { renderer = create(React.createElement(Component)); }); return renderer.root; }
function action(root, label) {
  return root.findAll((node) => typeof node.props.style === 'function' && typeof node.props.onPress === 'function' && node.props.accessibilityLabel === label)[0];
}
async function press(root, label) { await act(async () => action(root, label).props.onPress()); }
async function continuePhoto(root) {
  let pending;
  await act(async () => { pending = action(root, '계속').props.onPress(); });
  const modal = root.findAllByType(Modal).find((node) => typeof node.props.onDismiss === 'function');
  if (Platform.OS === 'ios' && !modal.props.visible) await act(async () => modal.props.onDismiss());
  await act(async () => pending);
}
function input(root, label) { return root.findAllByType(TextInput).find((node) => node.props.accessibilityLabel === label); }
const output = () => JSON.stringify(renderer.toJSON());

it('announces toast without focusing, expires at 3s/5s, and runs Undo only once', async () => {
  jest.useFakeTimers();
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  let show;
  const undo = jest.fn();
  function Harness() { const { showToast, toastProps } = useToast(); show = showToast; return React.createElement(Toast, toastProps); }
  const root = await render(Harness);
  await act(async () => show({ message: '완료했어요' }));
  expect(output()).toContain('완료했어요');
  expect(announce).toHaveBeenCalledWith('완료했어요');
  expect(focus).not.toHaveBeenCalled();
  await act(async () => jest.advanceTimersByTime(2999));
  expect(output()).toContain('완료했어요');
  await act(async () => jest.advanceTimersByTime(1));
  expect(renderer.toJSON()).toBe(null);
  await act(async () => show({ message: '삭제했어요', actionLabel: '되돌리기', onAction: undo }));
  await act(async () => jest.advanceTimersByTime(4999));
  const undoPress = action(root, '되돌리기').props.onPress;
  await act(async () => { undoPress(); undoPress(); });
  expect(undo).toHaveBeenCalledTimes(1);
  expect(renderer.toJSON()).toBe(null);
  await act(async () => show({ message: '마지막', actionLabel: '되돌리기', onAction: undo }));
  await act(async () => jest.advanceTimersByTime(5000));
  expect(renderer.toJSON()).toBe(null);
});

it('[phone 530:1594][phone 601:3028] removes immediately, persists before the undo window, restores with a new follow id, and can delete again', async () => {
  jest.useFakeTimers();
  const root = await render(FriendsScreen);
  await press(root, '모아 삭제');
  expect(friendsApi.removeFriend).toHaveBeenCalledWith('follow-old');
  expect(store).toEqual([]);
  expect(action(root, '모아 삭제')).toBeUndefined();
  expect(output()).toContain('모아님을 메이트에서 뺐어요');
  await act(async () => jest.advanceTimersByTime(4900));
  await press(root, '되돌리기');
  expect(friendsApi.addFriend).toHaveBeenCalledWith('self', 'friend-1');
  expect(action(root, '모아 삭제')).toBeDefined();
  await press(root, '모아 삭제');
  expect(friendsApi.removeFriend).toHaveBeenLastCalledWith('follow-new');
  await act(async () => renderer.unmount());
  renderer = undefined;
  expect(store).toEqual([]);
  await act(async () => jest.advanceTimersByTime(6000));
  expect(friendsApi.removeFriend).toHaveBeenCalledTimes(2);
  expect(friendsApi.addFriend).toHaveBeenCalledTimes(1);
});

it('reloads the list after failed removal and reports failed Undo without pretending to restore', async () => {
  friendsApi.removeFriend.mockResolvedValueOnce(new Error('fixture failed'));
  const root = await render(FriendsScreen);
  await press(root, '모아 삭제');
  expect(action(root, '모아 삭제')).toBeDefined();
  expect(notify).toHaveBeenCalledWith('삭제 실패', 'fixture failed');
  await press(root, '모아 삭제');
  friendsApi.addFriend.mockResolvedValueOnce(new Error('fixture restore failed'));
  await press(root, '되돌리기');
  expect(notify).toHaveBeenCalledWith('복구 실패', 'fixture restore failed');
  expect(action(root, '모아 삭제')).toBeUndefined();
});

it('[phone 601:2884][phone 601:2954] searches and adds a real candidate and shows the completion toast', async () => {
  friendsApi.searchProfilesByTag.mockResolvedValue({ data: [{ id: 'friend-2', name: '또리', tag: 'user-abcdef12', avatar_color: '' }], error: null });
  const root = await render(FriendsScreen);
  await act(async () => input(root, '닉네임 또는 유저 코드').props.onChangeText('@user-abcdef12'));
  await press(root, '찾기');
  expect(friendsApi.searchProfilesByTag).toHaveBeenCalledWith('@user-abcdef12', 'self');
  await press(root, '또리 메이트 추가');
  expect(friendsApi.addFriend).toHaveBeenCalledWith('self', 'friend-2');
  expect(output()).toContain('또리님을 메이트로 추가했어요');
});

it('[phone 530:1513] selects one gender segment and preserves existing profile saving APIs', async () => {
  const root = await render(ProfileEditScreen);
  expect(action(root, '남성').props.accessibilityState.checked).toBe(true);
  await press(root, '여성');
  expect(action(root, '남성').props.accessibilityState.checked).toBe(false);
  expect(action(root, '여성').props.accessibilityState.checked).toBe(true);
  expect(input(root, '이메일').props.readOnly).toBe(true);
  await press(root, '저장하기');
  expect(api.updateMyName).toHaveBeenCalledWith('self', '밀챗');
  expect(api.saveMyPrivateProfile).toHaveBeenCalledWith('self', { bank: null, account: '', birth: { year: '2000', month: '1', day: '2' } });
  expect(api.saveMyGender).toHaveBeenCalledWith('self', 'female', 'male');
  expect(navigation.resetTo).toHaveBeenCalledWith('Profile');
});

it.each(['앨범에서 고르기', '사진 찍기'])('[phone 601:2603] explains permission before requesting it and uploads the selected photo (%s)', async (label) => {
  const camera = label === '사진 찍기';
  const permission = camera ? picker.requestCameraPermissionsAsync : picker.requestMediaLibraryPermissionsAsync;
  const launch = camera ? picker.launchCameraAsync : picker.launchImageLibraryAsync;
  launch.mockResolvedValue({ canceled: false, assets: [{ uri: 'fixture://image', mimeType: 'image/png' }] });
  const root = await render(ProfileEditScreen);
  await press(root, '사진 바꾸기');
  await press(root, label);
  expect(permission).not.toHaveBeenCalled();
  expect(output()).toContain('사진 접근 안내');
  await continuePhoto(root);
  expect(permission).toHaveBeenCalledTimes(1);
  expect(launch).toHaveBeenCalledTimes(1);
  expect(avatarApi.uploadAvatar).toHaveBeenCalledWith({ userId: 'self', uri: 'fixture://image', mimeType: 'image/png' });
});

it('does not launch a denied camera, does not upload a cancelled album, and supports default/delete branches', async () => {
  const root = await render(ProfileEditScreen);
  picker.requestCameraPermissionsAsync.mockResolvedValueOnce({ granted: false });
  await press(root, '프로필 사진 바꾸기'); await press(root, '사진 찍기'); await continuePhoto(root);
  expect(picker.launchCameraAsync).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith('권한 필요', expect.any(String));
  await press(root, '사진 바꾸기'); await press(root, '앨범에서 고르기'); await continuePhoto(root);
  expect(avatarApi.uploadAvatar).not.toHaveBeenCalled();
  await press(root, '사진 바꾸기');
  expect(action(root, '기본 캐릭터로 바꾸기').props.disabled).toBe(true);
  expect(action(root, '사진 지우기')).toBeUndefined();
  await press(root, '기본 캐릭터로 바꾸기'); // Handler also guards stale/programmatic presses.
  expect(avatarApi.removeAvatar).not.toHaveBeenCalled();
});

it('opens the separate password route and preserves unsaved profile edits without password params', async () => {
  const root = await render(ProfileEditScreen);
  await act(async () => input(root, '닉네임').props.onChangeText('수정 중 이름'));
  await press(root, '비밀번호 변경');
  expect(navigation.navigate).toHaveBeenCalledWith('PasswordChange');
  expect(navigation.replace).toHaveBeenCalledWith('ProfileEdit', expect.objectContaining({ profileEditDraft: expect.objectContaining({ nickname: '수정 중 이름' }) }));
  expect(root.findAllByType(TextInput).some((node) => node.props.secureTextEntry)).toBe(false);
});

it('[phone 530:1736][phone 601:3541] selects an origin result, saves its coordinates, and clears stale coordinates after editing', async () => {
  const places = [
    { id: 'p1', name: '서면역 1호선', address: '부산 부산진구', lat: 35.157, lng: 129.059, category: '' },
    { id: 'p2', name: '전포역', address: '부산 부산진구 전포동', lat: 35.15, lng: 129.06, category: '' },
  ];
  searchPlaces.mockResolvedValue(places);
  const root = await render(OriginScreen);
  await act(async () => input(root, '출발지 검색').props.onChangeText('서면'));
  await press(root, '검색');
  await press(root, '전포역, 부산 부산진구 전포동');
  expect(action(root, '전포역, 부산 부산진구 전포동').props.accessibilityState.checked).toBe(true);
  expect(output()).toContain('선택한 위치');
  await press(root, '이 위치로 저장');
  expect(api.saveStartLocation).toHaveBeenCalledWith('self', '전포역', places[1]);
  await act(async () => input(root, '출발지 검색').props.onChangeText('직접 입력한 주소'));
  await press(root, '이 위치로 저장');
  expect(api.saveStartLocation).toHaveBeenLastCalledWith('self', '직접 입력한 주소', null);
});

it('[phone 530:1656] writes one canonical privacy field with its current server revision', async () => {
  const root = await render(PrivacyScreen);
  await act(async () => root.findAllByType(Switch)[0].props.onChange(false));
  expect(api.setProfileVisibility).toHaveBeenCalledWith('birthdate', 'private', '2');
  expect(api.savePrivacySettings).not.toHaveBeenCalled();
});

it('[phone 530:1403] uses actual data and a three-item completion denominator without unavailable menu entries', async () => {
  await render(ProfileHomeScreen);
  const text = output();
  expect(text).toContain('계정 완성하기');
  expect(text).toContain('음식 취향 매칭');
  expect(text).not.toContain('일정 입력하기');
  expect(text).toContain('밥약 기록');
  expect(text).toContain('음식 취향 다시 고르기');
});

it.each(['앨범에서 고르기', '사진 찍기'])('waits for iOS native dismissal before opening a system picker (%s)', async (label) => {
  Platform.OS = 'ios';
  const launch = label === '사진 찍기' ? picker.launchCameraAsync : picker.launchImageLibraryAsync;
  const root = await render(ProfileEditScreen);
  await press(root, '사진 바꾸기'); await press(root, label);
  await act(async () => action(root, '계속').props.onPress());
  const modal = root.findAllByType(Modal).find((node) => typeof node.props.onDismiss === 'function');
  expect(modal.props.visible).toBe(false);
  expect(launch).not.toHaveBeenCalled();
  await act(async () => modal.props.onDismiss());
  expect(launch).toHaveBeenCalledTimes(1);
});

it('does not open a system picker after leaving during modal dismissal', async () => {
  Platform.OS = 'ios';
  const root = await render(ProfileEditScreen);
  await press(root, '사진 바꾸기'); await press(root, '앨범에서 고르기');
  await act(async () => action(root, '계속').props.onPress());
  expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled();
  await act(async () => renderer.unmount()); renderer = undefined;
  expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled();
  expect(avatarApi.uploadAvatar).not.toHaveBeenCalled();
});

it('opens the Android picker after the hidden-sheet effect without a native dismissal callback', async () => {
  Platform.OS = 'android';
  picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'fixture://android-photo', mimeType: 'image/png' }] });
  const root = await render(ProfileEditScreen);
  await press(root, '사진 바꾸기'); await press(root, '앨범에서 고르기');
  await press(root, '계속');
  const modal = root.findAllByType(Modal).find((node) => typeof node.props.onDismiss === 'function');
  expect(modal.props.visible).toBe(false);
  expect(picker.requestMediaLibraryPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(picker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
  expect(avatarApi.uploadAvatar).toHaveBeenCalledWith({ userId: 'self', uri: 'fixture://android-photo', mimeType: 'image/png' });
});

it('aborts a missing iOS dismissal after 1.5s, unlocks saving, and ignores a late callback', async () => {
  Platform.OS = 'ios'; jest.useFakeTimers();
  const root = await render(ProfileEditScreen);
  await press(root, '사진 바꾸기'); await press(root, '앨범에서 고르기');
  await press(root, '계속');
  const lateDismiss = root.findAllByType(Modal).find((node) => typeof node.props.onDismiss === 'function').props.onDismiss;
  expect(output()).toContain('사진 저장 중');
  await act(async () => jest.advanceTimersByTime(1499));
  expect(action(root, '저장하기').props.disabled).toBe(true);
  await act(async () => jest.advanceTimersByTime(1));
  expect(output()).toContain('사진 선택 화면을 열지 못했어요. 다시 시도해 주세요.');
  expect(output()).not.toContain('사진 저장 중');
  expect(action(root, '저장하기').props.disabled).toBe(false);
  await act(async () => { lateDismiss(); lateDismiss(); });
  expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled();
  expect(avatarApi.uploadAvatar).not.toHaveBeenCalled();
  await press(root, '저장하기');
  expect(api.updateMyName).toHaveBeenCalledTimes(1);
});

it.each(['기본 캐릭터로 바꾸기', '사진 지우기'])('removes an uploaded photo once then hides redundant removal (%s)', async (label) => {
  bundle.profile.avatarUrl = 'fixture://existing-photo';
  const root = await render(ProfileEditScreen);
  await press(root, '사진 바꾸기');
  expect(action(root, '사진 지우기')).toBeDefined();
  await press(root, label);
  expect(avatarApi.removeAvatar).toHaveBeenCalledWith('self', 'fixture://existing-photo');
  await press(root, '사진 바꾸기');
  expect(action(root, '사진 지우기')).toBeUndefined();
  expect(action(root, '기본 캐릭터로 바꾸기').props.disabled).toBe(true);
});

it.each([0, 2, 3])('renders only persisted completion progress (%s of 3)', async (count) => {
  bundle.privateProfile.foodProfileCompleted = count >= 2;
  bundle.privateProfile.startLocationName = count >= 2 ? '서면역' : null;
  bundle.privateProfile.bankName = count === 3 ? '국민은행' : null;
  bundle.privateProfile.accountNumber = count === 3 ? '1234567890' : null;
  const root = await render(ProfileHomeScreen);
  const progress = root.findAll((node) => node.props.accessibilityRole === 'progressbar')[0];
  expect(progress.props.accessibilityValue).toEqual({ min: 0, max: 3, now: count });
  expect(Boolean(action(root, '송금 계좌 등록 등록하기'))).toBe(count < 3);
});

it('shows a skeleton without invented completion values while loading', async () => {
  profileState.status = 'loading'; profileState.bundle = null;
  const root = await render(ProfileHomeScreen);
  expect(root.findAll((node) => node.props.testID === 'profile-loading').length).toBeGreaterThan(0);
  expect(root.findAll((node) => node.props.accessibilityRole === 'progressbar')).toHaveLength(0);
  expect(output()).not.toContain('계정 완성하기');
  expect(output()).not.toContain('설정하기');
  expect(action(root, '프로필 수정')).toBeUndefined();
});

it('shows a retry card instead of incomplete profile content on load failure', async () => {
  profileState.status = 'error'; profileState.bundle = null;
  const root = await render(ProfileHomeScreen);
  expect(output()).toContain('프로필을 불러오지 못했어요');
  expect(output()).not.toContain('계정 완성하기');
  await press(root, '다시 시도');
  expect(profileState.reload).toHaveBeenCalledTimes(1);
});

it('makes the last-only Undo rule explicit for consecutive deletions and keeps server state on exit', async () => {
  jest.useFakeTimers();
  store.push({ ...mate, id: 'follow-second', profileId: 'friend-2', name: '또리' });
  const root = await render(FriendsScreen);
  await press(root, '모아 삭제'); await press(root, '또리 삭제');
  expect(store).toEqual([]);
  expect(output()).toContain('또리님을 메이트에서 뺐어요');
  expect(output()).toContain('되돌리기는 마지막 삭제만 가능해요');
  await press(root, '되돌리기');
  expect(friendsApi.addFriend).toHaveBeenLastCalledWith('self', 'friend-2');
  expect(store.map((item) => item.profileId)).toEqual(['friend-2']);
  await act(async () => renderer.unmount()); renderer = undefined;
  await act(async () => jest.advanceTimersByTime(12000));
  expect(friendsApi.removeFriend).toHaveBeenCalledTimes(2);
  expect(friendsApi.addFriend).toHaveBeenCalledTimes(1);
});

it.each(['returned', 'thrown'])('blocks duplicate privacy writes and rolls back a failed save (%s error)', async (kind) => {
  let complete, fail;
  api.setProfileVisibility.mockImplementationOnce(() => new Promise((resolve, reject) => { complete = resolve; fail = reject; }));
  const root = await render(PrivacyScreen);
  const first = root.findAllByType(Switch)[0].props.onChange;
  await act(async () => { first(false); first(false); });
  expect(api.setProfileVisibility).toHaveBeenCalledTimes(1);
  expect(root.findAllByType(Switch).every((node) => node.props.disabled)).toBe(true);
  expect(root.findAllByType(Switch)[0].props.value).toBe(false);
  expect(action(root, '저장하기').props.disabled).toBe(true);
  await act(async () => {
    if (kind === 'returned') complete({ data: null, error: new Error('fixture failure') });
    else fail(new Error('fixture failure'));
  });
  expect(root.findAllByType(Switch)[0].props.value).toBe(true);
  expect(root.findAllByType(Switch).every((node) => !node.props.disabled)).toBe(true);
  expect(profileState.reload).not.toHaveBeenCalled();
  expect(output()).toContain(kind === 'returned' ? '처리하지 못했어요.' : '저장하지 못했어요.');
  expect(output()).toContain('꺼 둔 정보는 방장에게도 보이지 않아요.');
});

it.each([
  ['1234567', '1234567', '8자 이상으로 만들어 주세요.'],
  ['fixture-pass', 'other-pass', '비밀번호가 서로 달라요.'],
  ['current-pass', 'current-pass', '지금 비밀번호와 다르게 입력해 주세요.'],
])('rejects invalid password input before invoking updatePassword (%s)', async (password, confirm, message) => {
  const root = await render(PasswordChangeScreen);
  await act(async () => input(root, '현재 비밀번호').props.onChangeText('current-pass'));
  await act(async () => input(root, '새 비밀번호').props.onChangeText(password));
  await act(async () => input(root, '새 비밀번호 확인').props.onChangeText(confirm));
  expect(action(root, '비밀번호 바꾸기').props.disabled).toBe(true);
  await press(root, '비밀번호 바꾸기');
  expect(auth.updatePassword).not.toHaveBeenCalled();
  expect(output()).toContain(message);
});

it.each([
  [{ message: 'private diagnostic', code: 'same_password' }, '이전 비밀번호와 다른 비밀번호를 입력해 주세요.'],
  [{ message: 'private diagnostic', code: 'weak_password' }, '비밀번호가 보안 기준에 맞지 않아요.'],
  [{ message: 'private diagnostic', code: 'invalid_credentials' }, '현재 비밀번호가 맞지 않아요.'],
  [{ message: 'private diagnostic', name: 'AuthRetryableFetchError', status: 0 }, '네트워크 연결을 확인한 뒤 다시 시도해 주세요.'],
  [{ message: 'New password should be different from the old password.' }, '이전 비밀번호와 다른 비밀번호를 입력해 주세요.'],
  [{ message: 'unregistered internal server diagnostic' }, '잠시 후 다시 시도해 주세요.'],
])('maps password update errors without exposing the original server message (%j)', async (error, friendly) => {
  auth.updatePassword.mockResolvedValue(error);
  const root = await render(PasswordChangeScreen);
  await act(async () => input(root, '현재 비밀번호').props.onChangeText('current-pass'));
  await act(async () => input(root, '새 비밀번호').props.onChangeText('fixture-pass'));
  await act(async () => input(root, '새 비밀번호 확인').props.onChangeText('fixture-pass'));
  await press(root, '비밀번호 바꾸기');
  expect(auth.updatePassword).toHaveBeenCalledTimes(1);
  expect(output()).toContain(friendly);
  expect(output()).not.toContain(error.message);
  expect(output()).not.toContain('비밀번호를 바꿨어요');
  expect(navigation.goBackWith).not.toHaveBeenCalled();
  await act(async () => input(root, '새 비밀번호 확인').props.onChangeText('fixture-pass'));
  expect(output()).not.toContain(friendly);
});

it('[phone 601:2733] keeps all password inputs secure and requires the current field before enabling submission', async () => {
  const root = await render(PasswordChangeScreen);
  expect(root.findAllByType(TextInput).every((node) => node.props.secureTextEntry)).toBe(true);
  await act(async () => {
    input(root, '새 비밀번호').props.onChangeText('fixture-pass');
    input(root, '새 비밀번호 확인').props.onChangeText('fixture-pass');
  });
  expect(action(root, '비밀번호 바꾸기').props.disabled).toBe(true);
  expect(output()).toContain('비밀번호가 일치해요.');
});

it('[phone 601:2759] submits once, returns with a completion flag, and renders the destination Toast once', async () => {
  let finish;
  auth.updatePassword.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const root = await render(PasswordChangeScreen);
  await act(async () => {
    input(root, '현재 비밀번호').props.onChangeText('current-pass');
    input(root, '새 비밀번호').props.onChangeText('new-pass');
    input(root, '새 비밀번호 확인').props.onChangeText('new-pass');
  });
  const submit = action(root, '비밀번호 바꾸기').props.onPress;
  await act(async () => { submit(); submit(); });
  expect(auth.updatePassword).toHaveBeenCalledTimes(1);
  expect(auth.updatePassword).toHaveBeenCalledWith('new-pass');
  expect(verifyCurrentPassword).toHaveBeenCalledWith('self', 'current-pass');
  expect(verifyCurrentPassword.mock.invocationCallOrder[0]).toBeLessThan(auth.updatePassword.mock.invocationCallOrder[0]);
  expect(action(root, '비밀번호 바꾸기').props.disabled).toBe(true);
  await act(async () => finish(null));
  expect(navigation.goBackWith).toHaveBeenCalledWith({ passwordChanged: true });
  await act(async () => renderer.unmount()); renderer = undefined;
  navigation.current = { name: 'ProfileEdit', params: { passwordChanged: true, profileEditDraft: { userId: 'self', nickname: '보존 이름', bank: null, account: '', birth: { year: '2001', month: '02', day: '03' }, gender: 'none', avatarUrl: null } } };
  const destination = await render(ProfileEditScreen);
  expect(input(destination, '닉네임').props.value).toBe('보존 이름');
  expect(output()).toContain('비밀번호를 바꿨어요');
  expect(navigation.replace).toHaveBeenCalledWith('ProfileEdit', expect.objectContaining({ passwordChanged: undefined }));
});

it.each([
  [{ code: 'invalid_credentials', message: 'private rejection' }, '현재 비밀번호가 맞지 않아요'],
  [{ status: 429, message: 'private rejection' }, '요청이 많아요. 잠시 후 다시 시도해 주세요.'],
  [{ code: 'over_request_rate_limit', message: 'private rejection' }, '요청이 많아요. 잠시 후 다시 시도해 주세요.'],
  [{ status: 0, message: 'private rejection' }, '네트워크 연결을 확인한 뒤 다시 시도해 주세요.'],
  [{ code: 'reauth_identity_mismatch', message: 'private rejection' }, '잠시 후 다시 시도해 주세요.'],
  [{ message: 'private rejection' }, '잠시 후 다시 시도해 주세요.'],
])('does not update a password after failed current-password verification (%j)', async (error, message) => {
  verifyCurrentPassword.mockResolvedValue(error);
  const root = await render(PasswordChangeScreen);
  await act(async () => {
    input(root, '현재 비밀번호').props.onChangeText('current-pass');
    input(root, '새 비밀번호').props.onChangeText('new-pass');
    input(root, '새 비밀번호 확인').props.onChangeText('new-pass');
  });
  await press(root, '비밀번호 바꾸기');
  expect(auth.updatePassword).not.toHaveBeenCalled();
  expect(navigation.goBackWith).not.toHaveBeenCalled();
  expect(output()).toContain(message);
  expect(output()).not.toContain('private rejection');
});

it.each(['social', 'no-email'])('blocks unsupported password-change accounts (%s)', async kind => {
  auth.user = kind === 'social' ? { id: 'self', email: 'fixture@example.test', app_metadata: { providers: ['google'] }, identities: [{ provider: 'google' }] } : { id: 'self' };
  const root = await render(PasswordChangeScreen);
  expect(output()).toContain('이 로그인 방법에서는 비밀번호를 바꿀 수 없어요.');
  expect(action(root, '비밀번호 바꾸기').props.disabled).toBe(true);
  await press(root, '비밀번호 바꾸기');
  expect(verifyCurrentPassword).not.toHaveBeenCalled();
  expect(auth.updatePassword).not.toHaveBeenCalled();
});

it('does not update when leaving during current-password verification', async () => {
  let finish;
  verifyCurrentPassword.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const root = await render(PasswordChangeScreen);
  await act(async () => {
    input(root, '현재 비밀번호').props.onChangeText('current-pass');
    input(root, '새 비밀번호').props.onChangeText('new-pass');
    input(root, '새 비밀번호 확인').props.onChangeText('new-pass');
  });
  await press(root, '비밀번호 바꾸기');
  await act(async () => renderer.unmount()); renderer = undefined;
  await act(async () => finish(null));
  expect(auth.updatePassword).not.toHaveBeenCalled();
});

it.each([false, true])('returns to settlement only after a successful profile save, failure=%s', async fail => {
  navigation.current.params = { returnAfterSave: 'settlement' };
  api.saveMyPrivateProfile.mockResolvedValue(fail ? new Error('fixture failure') : null);
  const root = await render(ProfileEditScreen);
  await press(root, '저장하기');
  expect(api.saveMyPrivateProfile).toHaveBeenCalled();
  expect(navigation.resetTo).not.toHaveBeenCalled();
  expect(navigation.goBack).toHaveBeenCalledTimes(fail ? 0 : 1);
});

it('keeps the existing profile-home destination for ordinary profile saves', async () => {
  const root = await render(ProfileEditScreen);
  await press(root, '저장하기');
  expect(navigation.resetTo).toHaveBeenCalledWith('Profile');
  expect(navigation.goBack).not.toHaveBeenCalled();
});

it('restores the original settlement route and amount after registering an account', async () => {
  const real = jest.requireActual('../src/navigation/NavigationContext');
  useNavigation.mockImplementation(real.useNavigation);
  let nav;
  function Flow() {
    nav = real.useNavigation();
    if (nav.current.name === 'ProfileEdit') return React.createElement(ProfileEditScreen);
    if (nav.current.name === 'PasswordChange') return React.createElement(PasswordChangeScreen);
    return null;
  }
  await render(() => React.createElement(real.NavigationProvider, { initialRoute: 'ChatRoom' }, React.createElement(Flow)));
  await act(async () => {
    nav.replace('ChatRoom', { roomId: 'original-room', openSheet: 'settlement', settlementAmountText: '70000', awaitingSettlementAccount: true });
    nav.navigate('ProfileEdit');
  });
  expect(nav.current.params.returnAfterSave).toBe('settlement');
  await press(renderer.root, '비밀번호 변경');
  await act(async () => {
    input(renderer.root, '현재 비밀번호').props.onChangeText('current-pass');
    input(renderer.root, '새 비밀번호').props.onChangeText('new-pass');
    input(renderer.root, '새 비밀번호 확인').props.onChangeText('new-pass');
  });
  await press(renderer.root, '비밀번호 바꾸기');
  expect(nav.current.params.returnAfterSave).toBe('settlement');
  await press(renderer.root, '저장하기');
  expect(nav.current).toEqual({ name: 'ChatRoom', params: { roomId: 'original-room', openSheet: 'settlement', settlementAmountText: '70000', awaitingSettlementAccount: true } });
});

it.each([
  { openSheet: 'settlement', awaitingSettlementAccount: false },
  { openSheet: 'members', awaitingSettlementAccount: true },
  {},
])('does not enable settlement return for unrelated chat entries (%j)', async params => {
  const real = jest.requireActual('../src/navigation/NavigationContext');
  let nav;
  function Probe() { nav = real.useNavigation(); return null; }
  await render(() => React.createElement(real.NavigationProvider, { initialRoute: 'ChatRoom' }, React.createElement(Probe)));
  await act(async () => { nav.replace('ChatRoom', params); nav.navigate('ProfileEdit'); });
  expect(nav.current.params?.returnAfterSave).toBeUndefined();
});

it.each(['returned', 'thrown'])('ignores a password request completing after exit (%s)', async (kind) => {
  let finish, fail;
  auth.updatePassword.mockImplementation(() => new Promise((resolve, reject) => { finish = resolve; fail = reject; }));
  const root = await render(PasswordChangeScreen);
  await act(async () => {
    input(root, '현재 비밀번호').props.onChangeText('current-pass');
    input(root, '새 비밀번호').props.onChangeText('fixture-pass');
    input(root, '새 비밀번호 확인').props.onChangeText('fixture-pass');
  });
  await press(root, '비밀번호 바꾸기');
  await press(root, '뒤로');
  expect(navigation.goBack).toHaveBeenCalledTimes(1);
  await act(async () => renderer.unmount()); renderer = undefined;
  await act(async () => kind === 'returned' ? finish(null) : fail(new Error('private diagnostics')));
  expect(navigation.goBackWith).not.toHaveBeenCalled();
  expect(navigation.resetTo).not.toHaveBeenCalled();
});

it('round-trips through the real navigation stack, preserving the draft and showing the returned Toast', async () => {
  const real = jest.requireActual('../src/navigation/NavigationContext');
  useNavigation.mockImplementation(real.useNavigation);
  function Flow() {
    const { current } = real.useNavigation();
    return React.createElement(current.name === 'PasswordChange' ? PasswordChangeScreen : ProfileEditScreen);
  }
  const root = await render(() => React.createElement(real.NavigationProvider, { initialRoute: 'ProfileEdit' }, React.createElement(Flow)));
  await act(async () => input(root, '닉네임').props.onChangeText('돌아와도 보존'));
  await press(root, '비밀번호 변경');
  expect(input(root, '현재 비밀번호')).toBeDefined();
  await act(async () => {
    input(root, '현재 비밀번호').props.onChangeText('current-pass');
    input(root, '새 비밀번호').props.onChangeText('new-pass');
    input(root, '새 비밀번호 확인').props.onChangeText('new-pass');
  });
  await press(root, '비밀번호 바꾸기');
  expect(input(root, '닉네임').props.value).toBe('돌아와도 보존');
  expect(output()).toContain('비밀번호를 바꿨어요');
  await press(root, '비밀번호 변경');
  expect(input(root, '현재 비밀번호').props.value).toBe('');
  expect(output()).not.toContain('비밀번호를 바꿨어요');
  await press(root, '뒤로');
  expect(input(root, '닉네임').props.value).toBe('돌아와도 보존');
  expect(output()).not.toContain('비밀번호를 바꿨어요');
});

it('clears the persisted origin, removes its pin, and groups result radios', async () => {
  searchPlaces.mockResolvedValue([{ id: 'p1', name: '서면역', address: '부산', lat: 35.15, lng: 129.05, category: '' }]);
  const root = await render(OriginScreen);
  expect(root.findAll((node) => node.props.testID === 'profile-origin-pin').length).toBeGreaterThan(0);
  await press(root, '검색어 지우기');
  expect(root.findAll((node) => node.props.testID === 'profile-origin-pin')).toHaveLength(0);
  expect(action(root, '이 위치로 저장').props.disabled).toBe(false);
  await press(root, '이 위치로 저장');
  expect(api.saveStartLocation).toHaveBeenCalledWith('self', '', null);
  await act(async () => input(root, '출발지 검색').props.onChangeText('서면'));
  await press(root, '검색');
  expect(root.findAll((node) => node.props.accessibilityRole === 'radiogroup' && node.props.accessibilityLabel === '출발지 검색 결과').length).toBeGreaterThan(0);
});

it('shows a decorative fallback when the map document fails', async () => {
  const root = await render(OriginScreen);
  await act(async () => renderer.root.findByType('ProfileWebView').props.onError({ nativeEvent: {} }));
  expect(output()).toContain('지도를 불러오지 못했어요. 선택한 위치는 저장할 수 있어요.');
  expect(root.findAll((node) => node.props.testID === 'profile-origin-pin')).toHaveLength(0);
  await press(root, '이 위치로 저장');
  expect(api.saveStartLocation).toHaveBeenCalledWith('self', '서면역', expect.objectContaining({ lat: 35.15, lng: 129.05 }));
});

it('remounts a failed map when the same result is selected again without overlapping its fallback and pin', async () => {
  searchPlaces.mockResolvedValue([{ id: 'p1', name: '서면역', address: '부산', lat: 35.15, lng: 129.05, category: '' }]);
  const root = await render(OriginScreen);
  await press(root, '검색'); await press(root, '서면역, 부산');
  const failedMap = root.findByType('ProfileWebView');
  await act(async () => failedMap.props.onError({ nativeEvent: {} }));
  expect(output()).toContain('지도를 불러오지 못했어요.');
  expect(root.findAll((node) => node.props.testID === 'profile-origin-pin')).toHaveLength(0);
  await press(root, '서면역, 부산');
  const retriedMap = root.findByType('ProfileWebView');
  expect(retriedMap).not.toBe(failedMap);
  expect(output()).not.toContain('지도를 불러오지 못했어요.');
  expect(root.findAll((node) => node.props.testID === 'profile-origin-pin').length).toBeGreaterThan(0);
  await act(async () => retriedMap.props.onError({ nativeEvent: {} }));
  expect(output()).toContain('지도를 불러오지 못했어요.');
  expect(root.findAll((node) => node.props.testID === 'profile-origin-pin')).toHaveLength(0);
});

it.each(['sync', 'async'])('catches rejected Toast actions and shows a generic failure (%s)', async (kind) => {
  let show;
  function Harness() { const { showToast, toastProps } = useToast(); show = showToast; return React.createElement(Toast, toastProps); }
  const root = await render(Harness);
  await act(async () => show({ message: '삭제했어요', actionLabel: '되돌리기', onAction: () => {
    if (kind === 'sync') throw new Error('private diagnostics');
    return Promise.reject(new Error('private diagnostics'));
  } }));
  await press(root, '되돌리기');
  expect(output()).toContain('작업을 완료하지 못했어요. 다시 시도해 주세요.');
  expect(output()).not.toContain('private diagnostics');
});

it('announces on Android and keeps an Undo toast for at least ten seconds with a screen reader', async () => {
  Platform.OS = 'android'; jest.useFakeTimers();
  AccessibilityInfo.isScreenReaderEnabled.mockResolvedValue(true);
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  let show;
  function Harness() { const { showToast, toastProps } = useToast(); show = showToast; return React.createElement(Toast, toastProps); }
  await render(Harness);
  await act(async () => show({ message: '삭제했어요', actionLabel: '되돌리기', onAction: jest.fn(), durationMs: 5000 }));
  expect(announce).toHaveBeenCalledWith(expect.stringContaining('삭제했어요. 되돌리기'));
  expect(focus).not.toHaveBeenCalled();
  await act(async () => jest.advanceTimersByTime(9999));
  expect(output()).toContain('삭제했어요');
  await act(async () => jest.advanceTimersByTime(1));
  expect(renderer.toJSON()).toBe(null);
});

it('extends a visible Undo toast when the screen reader is enabled mid-toast', async () => {
  jest.useFakeTimers();
  let readerChange, show;
  const unsubscribe = jest.fn();
  AccessibilityInfo.addEventListener.mockImplementation((name, callback) => {
    if (name === 'screenReaderChanged') readerChange = callback;
    return { remove: unsubscribe };
  });
  function Harness() { const { showToast, toastProps } = useToast(); show = showToast; return React.createElement(Toast, toastProps); }
  await render(Harness);
  await act(async () => show({ message: '삭제했어요', actionLabel: '되돌리기', onAction: jest.fn() }));
  await act(async () => { jest.advanceTimersByTime(4000); readerChange(true); });
  await act(async () => jest.advanceTimersByTime(9999));
  expect(output()).toContain('삭제했어요');
  await act(async () => jest.advanceTimersByTime(1));
  expect(renderer.toJSON()).toBe(null);
  await act(async () => renderer.unmount()); renderer = undefined;
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});
