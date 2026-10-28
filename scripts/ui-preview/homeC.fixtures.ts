/** Deterministic local evidence only. This module is never imported by the app entry. */
import { useState } from 'react';
import { v3Colors } from '../../src/theme/tokens';
const scene = new URLSearchParams(globalThis.location?.search).get('scene') ?? 'main';
const calls: unknown[] = [];
Object.assign(globalThis, { __homeCFixtureCalls: calls });
const record = (name: string, args?: unknown) => { calls.push({ name, args }); };
const base = { code: 'ABC123', color: v3Colors.primary, ownerId: 'mate', expiresAt: '2099-01-01T00:00:00Z', meetingDate: '2026-09-27', participants: [] };
export const fixtureRooms = [
  { ...base, id: 'room-0', title: '오늘 저녁팟', stage: 'place' as const, isConfirmed: false, confirmedSlot: null, locationName: '서면역', lastMessage: { text: '여기 어때?', senderName: '모아', createdAt: '2026-09-27T01:24:00Z' } },
  { ...base, id: 'room-1', title: '회사 팀 점심', stage: 'confirmed' as const, isConfirmed: true, confirmedSlot: '2026-09-27T03:00:00Z', locationName: '조선칼국수 하단점', lastMessage: { text: '일요일에 봐요~', senderName: '나야나', createdAt: '2026-09-26T01:00:00Z' } },
  { ...base, id: 'room-3', title: '동아리 뒤풀이', stage: 'scheduling' as const, isConfirmed: false, confirmedSlot: null, locationName: null, lastMessage: { text: '다들 언제 돼?', senderName: '웰링', createdAt: '2026-09-25T01:00:00Z' } },
];
export function useMyRooms() {
  const [status, setStatus] = useState<'ready' | 'error' | 'loading'>(scene === 'refreshing' ? 'loading' : scene === 'failure' || scene === 'stale' ? 'error' : 'ready');
  const rooms = scene === 'empty' || (scene === 'failure' && status === 'error') ? [] : scene === 'deleted' || scene === 'left' ? fixtureRooms.slice(1) : fixtureRooms;
  return { rooms, status, error: null, reload: () => { record('reloadRooms'); setStatus('ready'); } };
}
export function useMyProfile() { return { bundle: { profile: { name: '나야나' } } }; }
export function useAuth() { return { user: { id: 'me' } }; }
export function useForegroundRefreshToken() { return 0; }
export function useMySettlements() { return scene === 'empty' || scene === 'failure' ? [] : [{ settled: false }]; }
const members = [
  { id: 'member-0', profileId: 'me', name: '나야나', isCompleted: false },
  { id: 'member-1', profileId: 'mate', name: '모아', isCompleted: true },
  { id: 'member-2', profileId: 'ddori', name: '또리', isCompleted: false },
  { id: 'member-3', profileId: 'welling', name: '웰링', isCompleted: true },
];
const bill = { id: 'bill-0', roomId: 'room-1', creatorId: 'mate', roomTitle: '조선칼국수 하단점', title: '회사 팀 점심', totalAmount: 52000, splitCount: 4, bankName: '카카오뱅크', accountNumber: '3333-01-2345678', accountHolder: '박모아', createdAt: '2026-09-27T00:00:00Z', members };
const bills = [bill, { ...bill, id: 'bill-1', title: '오늘 저녁팟', roomTitle: '돼지집 서면점', createdAt: '2026-09-25T00:00:00Z', members: members.map(member => ({ ...member, id: member.id + '-done', isCompleted: true })) }];
let billFailure = scene === 'settlement-failure';
export async function fetchMySettlementsDetailed() { record('fetchSettlements'); if (billFailure) { billFailure = false; return { data: null, error: new Error('Fixture fetch rejected') }; } return { data: bills, error: null }; }
export async function setSettlementCompleted(id: string, completed: boolean) { record('setCompleted', { id, completed }); if (scene === 'settlement-stale') billFailure = true; return null; }
export async function joinRoomByCode(code: string) { record('joinRoom', code); return { roomId: 'joined-room', error: null }; }
const notices = [
  { id: 'notice-0', roomId: 'room-0', title: '일정이 확정됐어요!', message: '오늘 저녁팟 · 9월 25일 (금) 19:00', amount: 0, createdAt: '2026-09-27T01:30:00Z' },
  { id: 'notice-1', roomId: 'room-1', title: 'N빵 정산 요청이 도착했어요', message: '회사 팀 점심 · 1인당', amount: 13000, createdAt: '2026-09-27T01:20:00Z' },
  { id: 'notice-2', roomId: 'room-0', title: '새 메이트가 들어왔어요', message: '오늘 저녁팟에 모아가 들어왔어요', amount: 0, createdAt: '2026-09-26T23:30:00Z' },
  { id: 'notice-3', roomId: 'room-0', title: '메뉴 정하기가 시작됐어요', message: '오늘 저녁팟 · 1분이면 끝나요', amount: 0, createdAt: '2026-09-26T01:30:00Z' },
].map(notice => ({ ...notice, bankName: '', accountNumber: '' }));
export async function fetchMyNotifications() { record('fetchNotifications'); return { data: notices, error: null }; }
export async function fetchNotificationsReadAt() { return { data: '2026-09-27T00:00:00Z', error: null }; }
export async function markNotificationsRead(id: string) { record('markRead', id); return null; }
