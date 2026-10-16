/** Local E evidence only: no production clients, secrets, or remote provider calls. */
import { useState } from 'react';
import type { RoomMessage, RoomSummary } from '../../src/lib/rooms';
const scene = new URLSearchParams(globalThis.location?.search).get('scene') ?? 'chat';
const calls: unknown[] = [];
Object.assign(globalThis, { __chatEFixtureCalls: calls });
const record = (name: string, args?: unknown) => { calls.push({ name, args }); };
export function useAuth() { return { user: { id: scene === 'detail-mate' ? 'mate' : 'me' } }; }
export function useMyProfile() { return { bundle: null }; }
export const fixtureRoom: RoomSummary = {
  id: 'room', code: 'VF4HLD', title: '오늘 저녁팟', color: '#FF9900', ownerId: 'me',
  stage: scene === 'time-unset' ? 'scheduling' : scene === 'settled' ? 'done' : scene === 'settling' ? 'settling' : scene === 'place-confirmed' ? 'confirmed' : 'place',
  isConfirmed: scene === 'place-confirmed', confirmedSlot: scene === 'time-unset' || scene === 'place-unset' ? null : '9월 25일 (금) 19:00',
  expiresAt: '2026-09-28T01:30:00Z', meetingDate: '2099-12-31', locationName: scene === 'place-confirmed' ? '조선칼국수 하단점' : null,
  participants: [
    { id:'p1',profileId:'me',name:'나야나',avatarColor:'#FF9900',avatarUrl:null },
    { id:'p2',profileId:'mate',name:'모아',avatarColor:'#FF9900',avatarUrl:null },
    { id:'p3',profileId:'ttori',name:'또리',avatarColor:'#FF9900',avatarUrl:null },
    { id:'p4',profileId:'welling',name:'웰링',avatarColor:'#FF9900',avatarUrl:null },
  ], lastMessage: null,
};
let rows: RoomMessage[] = [
  {id:'system',roomId:'room',senderId:null,senderName:'',senderColor:'',kind:'system',text:'9월 25일 (금) 19:00로 일정이 확정됐어요',createdAt:'2026-09-25T10:00:00Z'},
  {id:'m1',roomId:'room',senderId:'ttori',senderName:'또리',senderColor:'',kind:'user',text:'다들 뭐 먹고 싶어요?',createdAt:'2026-09-25T10:02:00Z'},
  {id:'m2',roomId:'room',senderId:'me',senderName:'나야나',senderColor:'',kind:'user',text:'고기 땡겨요',createdAt:'2026-09-25T10:03:00Z'},
  {id:'m3',roomId:'room',senderId:'mate',senderName:'모아',senderColor:'',kind:'user',text:'저는 국물 있는 거면 다 좋아요',createdAt:'2026-09-25T10:03:30Z'},
];
if(scene==='sticker') rows.push({id:'sticker',roomId:'room',senderId:'me',senderName:'나야나',senderColor:'',kind:'user',text:'[emoticon:dudu-love]',createdAt:'2026-09-25T10:05:00Z'});
export function useRoom() {
  const [room,setRoom]=useState(scene==='detail-loading'||scene==='detail-failure'?null:fixtureRoom);
  const [status,setStatus]=useState(scene==='detail-failure'?'error':scene==='detail-loading'?'loading':'ready');
  return {room,status,reload:()=>{record('reloadRoom');setRoom({...fixtureRoom});setStatus('ready');}};
}
export function useKeyboardOverlap() { return {overlap:scene==='keyboard'?240:0,remeasure:()=>{}}; }
export function useRoomMessages() {
  const [messages, setMessages] = useState(rows.slice());
  const [status, setStatus] = useState(scene === 'message-failure' ? 'error' : 'ready');
  return { messages, status, reload: () => { record('reloadMessages'); setMessages(rows.slice()); setStatus('ready'); } };
}
export async function sendRoomMessage(roomId: string, text: string) { record('sendMessage',{roomId,text}); rows=[...rows,{id:'new-'+rows.length,roomId,senderId:'me',senderName:'나야나',senderColor:'',kind:'user',text,createdAt:'2026-09-25T10:06:00Z'}]; return null; }
export async function sendRoomSticker(roomId: string, id: string) { record('sendSticker',{roomId,id}); return sendRoomMessage(roomId,'[emoticon:'+id+']'); }
export async function leaveRoom(roomId: string) { record('leaveRoom',roomId); return null; }
export async function buildPlaceCandidates() { throw Error('Provider calls are not allowed in this preview'); }
export const supabase = { functions: { invoke: async () => { throw Error('Remote calls are not allowed in this preview'); } } };

export async function fetchRoomVoting() { record('fetchVoting'); return { data: [{id:'restaurant',kind:'menu',label:'돼지집 서면점',createdBy:'me',mine:true,voters:[{name:'나야나',color:'#FF9900'},{name:'모아',color:'#FF9900'},{name:'또리',color:'#FF9900'}]}], memberCount: 4, error: null }; }
export async function addVotingItem() { record('addVotingItem'); return null; }
export async function removeVotingItem() { record('removeVotingItem'); return null; }
export async function confirmRoomVote() { record('confirmRoomVote'); return null; }
export async function toggleVote() { record('toggleVote'); return null; }

let advances=0;export async function advanceRoomStage(roomId:string,stage:RoomSummary['stage']){record('advanceRoomStage',{roomId,stage});if(scene==='confirm-retry'&&advances++===0)return{stage:null,error:Error('offline fixture')};fixtureRoom.stage=stage;return{stage,error:null};}
if(scene==='notice')rows.unshift({id:'notice-place',roomId:'room',senderId:null,senderName:'',senderColor:'',kind:'system',text:'[notice:place]식당 투표가 열렸어요',createdAt:'2026-09-25T10:00:00Z'});
