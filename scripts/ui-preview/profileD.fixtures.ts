/** Isolated render fixtures. Never imports dotenv, the backend client, or real users. */
import type { Friend } from '../../src/lib/friends';
import type { MyProfileBundle } from '../../src/lib/profile';
import type { Place } from '../../src/lib/tmap';

const calls: string[] = [];
Reflect.set(globalThis, '__profileFixtureCalls', calls);
const record = (name: string) => { calls.push(name); };
const bundle: MyProfileBundle = {
  profile: { id: 'fixture-self', name: '밀챗', tag: 'user-00000000', avatarColor: '', avatarUrl: null },
  privateProfile: { bankName: null, accountNumber: null, birthDate: '2000-01-02',
    personalData: { gender: 'male', bio: '오늘도 맛있는 하루' }, privacySettings: {},
    tastes: { spicy: true }, startLocationName: '서면역', startLat: 35.157, startLng: 129.059 },
};
export const useAuth = () => ({
  user: { id: 'fixture-self', email: 'fixture@example.test' },
  signOut: async () => { record('signOut'); return null; },
  updatePassword: async () => { record('updatePassword'); return null; },
});
export const useMyProfile = () => ({ status: 'ready', bundle, userId: 'fixture-self', reload: () => record('reload') });
export const useNotifications = () => ({ hasUnread: false, open: () => record('notifications.open') });
let friends: Friend[] = ['모아', '또리', '웰링'].map((name, index) => ({ id: 'follow-' + index, profileId: 'fixture-' + index, name, tag: 'user-0000000' + index, avatarColor: '', role: 'mate' }));
export async function fetchMyFriends() { record('fetchMyFriends'); return { data: [...friends], error: null }; }
export async function searchProfilesByTag() {
  record('searchProfilesByTag');
  return { data: [{ id: 'fixture-new', name: '지우', tag: 'user-abcdef12', avatar_color: '' }], error: null };
}
export async function addFriend(userId: string, targetId: string) {
  record('addFriend:' + targetId);
  const original = ['모아', '또리', '웰링'][Number(targetId.split('-')[1])];
  friends.push({ id: 'restored-' + targetId, profileId: targetId, name: original || '지우', tag: original ? 'user-0000000' + targetId.split('-')[1] : 'user-abcdef12', avatarColor: '', role: 'mate' });
  return null;
}
export async function removeFriend(id: string) { record('removeFriend:' + id); friends = friends.filter((friend) => friend.id !== id); return null; }
export async function updateMyName() { record('updateMyName'); return null; }
export async function saveMyPrivateProfile() { record('saveMyPrivateProfile'); return null; }
export async function saveMyGender() { record('saveMyGender'); return null; }
export async function savePrivacySettings() { record('savePrivacySettings'); return null; }
export async function saveStartLocation() { record('saveStartLocation'); return null; }
export async function removeAvatar() { record('removeAvatar'); return null; }
export async function uploadAvatar() { record('uploadAvatar'); return { url: null, error: null }; }
export async function requestMediaLibraryPermissionsAsync() { record('album.permission'); return { granted: true }; }
export async function requestCameraPermissionsAsync() { record('camera.permission'); return { granted: false }; }
export async function launchImageLibraryAsync() { record('album.launch'); return { canceled: true }; }
export async function launchCameraAsync() { record('camera.launch'); return { canceled: true }; }
export async function searchPlaces(): Promise<Place[]> { record('searchPlaces'); return [
  { id: 'p1', name: '서면역 1호선', address: '부산 부산진구 중앙대로 지하 730', lat: 35.157, lng: 129.059, category: '' },
  { id: 'p2', name: '전포역', address: '부산 부산진구 전포동', lat: 35.15, lng: 129.06, category: '' },
  { id: 'p3', name: '부산역', address: '부산 동구 중앙대로 206', lat: 35.115, lng: 129.042, category: '' },
]; }
