/** Offline visual fixtures only. No remote clients or real financial data. */
import { useCallback } from 'react';
import { fixtureRoom, useRoomMessages as useOriginalMessages } from './chatE.fixtures';
import type { RoomMessage } from '../../src/lib/rooms';
import type { Settlement } from '../../src/lib/settlements';
export { useAuth, useRoom, useKeyboardOverlap, sendRoomMessage, sendRoomSticker, leaveRoom, buildPlaceCandidates, supabase, fetchRoomVoting, addVotingItem, removeVotingItem, confirmRoomVote, toggleVote, searchPlaces, advanceRoomStage } from './chatE.fixtures';
export { canEditSettlement, settlementMutationErrorMessage } from '../../src/lib/settlementAccess';
const scene = new URLSearchParams(globalThis.location?.search).get('scene') ?? 'invite';
const calls: unknown[] = [];
Object.assign(globalThis, { __s3bCalls: calls });
const record = (name: string, args?: unknown) => calls.push({ name, args });
if (scene === 'invite-missing-code') fixtureRoom.code = '';
fixtureRoom.stage = 'confirmed'; fixtureRoom.isConfirmed = true; fixtureRoom.locationName = '돼지집 서면점';
let hasAccount = scene !== 'settlement-no-account';
export const fixtureBill: Settlement = { id: 'bill', roomId: 'room', creatorId: scene === 'more-requester' || scene === 'settlement-existing' ? 'me' : 'mate', roomTitle: '오늘 저녁팟', title: '식사 정산', totalAmount: 52000, splitCount: 4, bankName: '카카오뱅크', accountNumber: '3333-01-2345678', accountHolder: '모아', createdAt: '2026-09-25T00:00:00Z', members: fixtureRoom.participants.map((person, index) => ({ id: 'member-' + person.profileId, profileId: person.profileId, name: person.name, isCompleted: scene === 'more-requester' || scene === 'settlement-existing' ? person.profileId === 'me' : index === 1 })) };
export function useMyProfile() {
  const reload = useCallback(() => { record('reloadProfile'); }, []);
  return { status: 'ready', bundle: { profile: { name: '나야나' }, privateProfile: { bankName: hasAccount ? '카카오뱅크' : null, accountNumber: hasAccount ? scene === 'settlement-short-account' ? '123' : '3333-01-2345678' : null } }, reload };
}
export function registerFixtureAccount() { hasAccount = true; record('fixtureProfileAccountSaved'); }
export async function fetchRoomSettlements() { record('fetchRoomSettlements'); return { data: scene === 'settlement-existing' || scene === 'settlement-sender' || scene === 'settlement-returned-existing' ? [fixtureBill] : [], error: null }; }
export async function fetchMySettlementsDetailed() { record('fetchMySettlementsDetailed'); return { data: [fixtureBill], error: null }; }
export async function createRoomSettlement(input: unknown) { record('createRoomSettlement', input); return { billId: 'fixture-created', error: null }; }
export async function setSettlementCompleted(id: string, completed: boolean) { record('setSettlementCompleted', { id, completed }); const member = fixtureBill.members.find(item => item.id === id); if (member) member.isCompleted = completed; return null; }

// Consecutive short messages exercise visual spacing independently of touch bounds.
const groupedMessages: RoomMessage[] = ['첫 번째', '두 번째', '세 번째', '네 번째'].map((text, index) => ({ id: 'group-' + index, roomId: 'room', senderId: index < 2 ? 'me' : 'mate', senderName: index < 2 ? '나야나' : '모아', senderColor: '', kind: 'user', text, createdAt: '2026-09-25T10:03:00Z' }));
const normalMessages = groupedMessages.map((message, index) => ({ ...message, createdAt: '2026-09-25T10:0' + index + ':00Z' }));
export function useRoomMessages() { const original = useOriginalMessages(); return scene === 'message-grouped' || scene === 'message-normal' ? { ...original, messages: scene === 'message-normal' ? normalMessages : groupedMessages } : original; }
