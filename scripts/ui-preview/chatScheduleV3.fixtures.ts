/** Synthetic preview fixtures, never imported by the production Metro configuration. */
const scene = () => new URLSearchParams(globalThis.location?.search).get('scene') ?? 'confirmed';
const names = ['밀챗', '모아', '두두', '또리'];
const participants = names.map((name, index) => ({ id: 'participant-' + index, profileId: 'profile-' + index, name, avatarColor: '', avatarUrl: null }));
let saved: string[] | null = null;
export function useAuth() { return { user: { id: 'profile-0' } }; }
export function useKeyboardOverlap() { return { overlap: 0, remeasure: () => undefined }; }
export async function fetchRoom() {
  return { error: null, data: { id: 'preview-room', stage: scene() === 'confirmed' ? 'confirmed' : scene() === 'pending-place' ? 'place' : 'scheduling', confirmedSlot: scene() === 'confirmed' ? '2026-10-16T18:00:00+09:00' : null, meetingDate: '2099-12-31', participants } };
}
export async function fetchRoomAvailability() {
  if (scene() === 'failure') return { data: null, error: new Error('Offline fixture error') };
  const mySlots = saved ?? (scene() === 'editing' ? [] : ['2026-10-16-18']);
  return { error: null, data: {
    members: participants.map((person, index) => ({ id: person.id, name: person.name, avatarColor: '', submitted: index === 0 ? mySlots.length > 0 : ['all-submitted', 'mate', 'confirmed', 'pending-place'].includes(scene()) || index !== 2 })),
    mySlots, othersSlots: ['2026-10-16-19'],
  } };
}
export async function saveMyAvailability(_roomId: string, slots: string[]) { saved = slots; return null; }
export async function advanceRoomStage() { return { error: null }; }
