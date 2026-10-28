/** Isolated manual fixtures only. The resolver never loads a real backend client. */
import type { CalendarNote } from '../../src/lib/calendarNotes';
import type { Friend } from '../../src/lib/friends';
import type { Place } from '../../src/lib/tmap';

const params = new URLSearchParams(globalThis.location?.search);
const scene = params.get('scene');
const calls: string[] = [];
Reflect.set(globalThis, '__scheduleFixtureCalls', calls);
const record = (name: string) => { calls.push(name); };
export const fixtureOrigin = { name: '부산 서면역 7번 출구 근처', address: '', lat: 35.157, lng: 129.059, fromGps: true };
const profile = { profile: { name: '나야나' }, privateProfile: { startLocationName: fixtureOrigin.name, startLat: fixtureOrigin.lat, startLng: fixtureOrigin.lng } };
export const useAuth = () => ({ user: { id: 'fixture-user', created_at: '2026-08-01T00:00:00+09:00' } });
export const useMyProfile = () => ({ bundle: profile });
export const useForegroundRefreshToken = () => 0;
export const useNotifications = () => ({ hasUnread: true, open: () => record('notifications.open') });
export class LocationDeniedError extends Error {}
export async function locateMe() { record('locateMe'); if (scene === 'detail-denied' || scene === 'detail-requestable') throw new LocationDeniedError('오프라인 권한 거부 시나리오'); return fixtureOrigin; }
export async function getForegroundPermissionsAsync() { return { status: 'denied', canAskAgain: scene === 'detail-requestable' }; }
export async function fetchMyFriends() {
  return { data: ['모아', '또리', '웰링'].map((name, index): Friend => ({ id: 'friend-' + index, profileId: 'fixture-' + index, name, tag: name, avatarColor: '', role: 'mate' })), error: null };
}
const notes: CalendarNote[] = [
  { id: 'e1', date: '2026-09-25', title: '알바', time: '10:00', endTime: '15:00', color: '#1D4ED8', content: '' },
  { id: 'e2', date: '2026-09-25', title: '오늘 저녁팟', time: '19:00', endTime: '21:00', color: '#FF9900', content: '' },
  { id: 'e3', date: '2026-09-25', title: 'Medive 스터디', time: '21:30', endTime: '23:00', color: '#5B9BD5', content: '' },
  { id: 'e4', date: '2026-09-27', title: '회사 팀 점심', time: '12:00', endTime: '13:00', color: '#1E6B34', content: '' },
  { id: 'e5', date: '2026-08-25', title: '지난 밥약', time: '19:00', endTime: '21:00', color: '#FF9900', content: '' },
];
export async function fetchMonthNotes(year: number, month: number) {
  record('fetchMonthNotes:' + month);
  return { data: notes.filter((note) => note.date.startsWith(year + '-' + String(month).padStart(2, '0'))), error: null };
}
export async function createEvent(input: { date: string; title: string; time: string; endTime: string; color: string }) { record('createEvent'); const note = { ...input, id: 'new-' + notes.length, content: '' }; notes.push(note); return { data: note, error: null }; }
export async function updateEvent(id: string, patch: Partial<CalendarNote>) { record('updateEvent'); const note = notes.find((item) => item.id === id); if (note) Object.assign(note, patch); return null; }
export async function deleteNote(id: string) { record('deleteNote'); const index = notes.findIndex((note) => note.id === id); if (index >= 0) notes.splice(index, 1); return null; }
export async function saveMemo() { record('saveMemo'); return null; }
export async function searchPlaces(): Promise<Place[]> { record('searchPlaces'); return [
  { id: 'p1', name: '서면역 1호선', address: '부산 부산진구 중앙대로 지하 730', lat: 35.157, lng: 129.059, category: '' },
  { id: 'p2', name: '서면역 2호선', address: '부산 부산진구 서면로 지하 2', lat: 35.158, lng: 129.059, category: '' },
  { id: 'p3', name: '서면시장', address: '부산 부산진구 중앙대로 680번가길 40', lat: 35.155, lng: 129.058, category: '' },
]; }
export async function createRoom() { record('createRoom'); return { roomId: 'fixture-room', error: null }; }
export async function createRoomInvitation() { record('createRoomInvitation'); return { error: null }; }
export async function leaveRoom() { record('leaveRoom'); deletedRoom = true; return null; }
export async function fetchRoom() { record('fetchRoom'); if (scene === 'prereq-room-error') return { data: null, error: new Error('Fixture room failure') }; if (scene === 'prereq-room-missing') return { data: null, error: null }; return { data: { participants: [{ profileId: 'fixture-user' }, { profileId: 'fixture-1' }] }, error: null }; }
export async function advanceRoomStage() { record('advanceRoomStage'); return { error: null }; }
export async function fetchRoomAvailability() { record('fetchRoomAvailability'); return { data: { members: [], mySlots: ['2026-09-25-12', '2026-09-25-13', '2026-09-25-18', '2026-09-25-19', '2026-09-25-20', '2026-09-26-12', '2026-09-26-13', '2026-09-27-18', '2026-09-27-19', '2026-09-28-18', '2026-09-28-19', '2026-09-28-20'], othersSlots: ['2026-09-27-11', '2026-09-29-12'] }, error: null }; }
export async function saveMyAvailability() { record('saveMyAvailability'); return null; }
export async function buildPlaceCandidates() { record('buildPlaceCandidates'); if (scene === 'prereq-midpoint') return null; if (scene === 'prereq-candidates') return { candidates: [] }; return { candidates: [{ id: 'p1', name: '오프라인 후보' }] }; }
let failed = false;
export const supabase = { functions: { invoke: async () => {
  record('schedule-recommend');
  if (scene === 'failure' && !failed) { failed = true; return { data: null, error: new Error('오프라인 추천 실패 시나리오') }; }
  return { data: { slotRecommendations: [
    { rank: 1, score: 92, availableCount: 4, totalCount: 4, rainChance: 10, reason: '퇴근 후 서면에서 다 같이 모이기 좋아요', slot: { id: 's1', date: '2026-09-25', startTime: '19:00', endTime: '21:00', label: '' } },
    { rank: 2, score: 78, availableCount: 3, totalCount: 4, rainChance: 40, reason: '주말 저녁, 이동 시간이 가장 짧아요', slot: { id: 's2', date: '2026-09-27', startTime: '18:00', endTime: '20:00', label: '' } },
    { rank: 3, score: 72, availableCount: 3, totalCount: 4, rainChance: 10, reason: '점심 시간대, 짧게 만나기 좋아요', slot: { id: 's3', date: '2026-09-25', startTime: '12:00', endTime: '14:00', label: '' } },
  ] }, error: null };
} } };

let deletedRoom = false;
const previewRooms = [
  { id: 'fixture-room', title: '오늘 저녁팟', stage: 'place', locationName: '서면역' },
  { id: 'fixture-room-2', title: '회사 팀 점심', stage: 'confirmed', locationName: '조선칼국수 하단점' },
  { id: 'fixture-room-3', title: '동아리 뒤풀이', stage: 'scheduling', locationName: null },
].map(room => ({ ...room, code: 'ABC123', color: '#FF9900', ownerId: 'fixture-user', isConfirmed: room.stage === 'confirmed', confirmedSlot: null, expiresAt: '2099-01-01T00:00:00Z', meetingDate: '2026-10-02', participants: [{ id: 'member-1', profileId: 'fixture-user', name: '나야나', avatarColor: '#FF9900', avatarUrl: null }], lastMessage: null }));
export function useMyRooms() { return { rooms: previewRooms.filter(room => !deletedRoom || room.id !== 'fixture-room'), status: 'ready', reload: () => {} }; }
export function useMySettlements() { return [{ settled: false }]; }
export function useRoom() { return { room: previewRooms[0], status: 'ready', reload: () => {} }; }
export function useRoomMessages() { return { messages: [], status: 'ready', reload: () => {} }; }
export async function joinRoomByCode() { return { roomId: 'fixture-room', error: null }; }
