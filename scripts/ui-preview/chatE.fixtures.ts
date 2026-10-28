/** Local E evidence only: no production clients, secrets, or remote provider calls. */
import { useState } from 'react';
import type { RoomMessage, RoomSummary } from '../../src/lib/rooms';
const scene = new URLSearchParams(globalThis.location?.search).get('scene') ?? 'chat';
const calls: unknown[] = [];
Object.assign(globalThis, { __chatEFixtureCalls: calls });
const record = (name: string, args?: unknown) => { calls.push({ name, args }); };
const fixtureUser = {id:scene === 'detail-mate' || scene.includes('voting-locked-mate') || scene === 'voting-mate' ? 'mate' : 'me'};
export function useAuth() { return {user:fixtureUser}; }
export function useMyProfile() { return { bundle: scene.startsWith('voting-') ? {privateProfile:{startLat:35,startLng:129,startLocationName:'서면'}} : null }; }
export const fixtureRoom: RoomSummary = {
  confirmedMenu: scene==='voting-recovered'||scene==='voting-locked-mate'?'원래 저장한 식당':null,
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
const candidates = ['돼지집 서면점','육전식당 서면','서면 연탄구이'].map((name,index)=>({id:'candidate-'+index,name,address:'실제 검색 결과 주소',latitude:35,longitude:129,category:'한식'}));
export async function buildPlaceCandidates() { record('buildPlaceCandidates'); return {candidates:scene==='voting-empty'?[]:candidates}; }
let recommendations=0;
export const supabase = { functions: { invoke: async (name:string,args:unknown) => {
  record('invoke',{name,args});
  if(scene==='voting-failure'&&recommendations++===0)return{data:null,error:Error('offline fixture')};
  const picks=scene==='voting-more'&&recommendations++>0?candidates.slice(2):candidates.slice(0,2);
  return {data:{placeRecommendations:picks.map((place,index)=>({place,rank:index+1,score:80}))},error:null};
} } };
type Vote = {id:string;kind:'menu';label:string;createdBy:string;mine:boolean;voters:{name:string;color:string}[]};
let votingItems:Vote[]=scene==='voting-failure'?[]:[{id:'restaurant',kind:'menu',label:scene==='voting-recovered'?'바뀐 1위':'돼지집 서면점',createdBy:'me',mine:!scene.includes('mate'),voters:[{name:'나야나',color:'#FF9900'},{name:'모아',color:'#FF9900'},{name:'또리',color:'#FF9900'}]}];
if(scene.startsWith('voting-')&&scene!=='voting-failure')votingItems.push({id:'second',kind:'menu',label:'육전식당 서면',createdBy:'mate',mine:false,voters:[{name:'웰링',color:'#FF9900'}]},{id:'third',kind:'menu',label:'고기굽는 오빠들',createdBy:'mate',mine:false,voters:[]});
export async function fetchRoomVoting() { record('fetchVoting'); return { data: votingItems.slice(), memberCount: 4, error: null }; }
export async function addVotingItem(roomId:string,kind:'menu',label:string) { record('addVotingItem',{roomId,kind,label});if(!votingItems.some(item=>item.label===label))votingItems.push({id:'added-'+votingItems.length,kind,label,createdBy:'me',mine:false,voters:[]}); return null; }
export async function removeVotingItem(roomId:string,id:string) { record('removeVotingItem',{roomId,id});votingItems=votingItems.filter(item=>item.id!==id); return null; }
export async function confirmRoomVote(roomId:string,id:string) { record('confirmRoomVote',{roomId,id});fixtureRoom.confirmedMenu=votingItems.find(item=>item.id===id)?.label??null; return null; }
export async function toggleVote(roomId:string,id:string) { record('toggleVote',{roomId,id});votingItems=votingItems.map(item=>item.id!==id?item:{...item,mine:!item.mine,voters:item.mine?item.voters.filter(voter=>voter.name!=='나야나'):[...item.voters,{name:'나야나',color:'#FF9900'}]});return null; }
export async function searchPlaces(query:string) {record('searchPlaces',query);return [{id:'existing',name:'돼지집 서면점',address:'부산 부산진구 서면로 68',lat:35,lng:129,category:'한식'},{id:'found',name:'하남돼지집 서면점',address:'부산 부산진구 중앙대로 692',lat:35,lng:129,category:'한식'},{id:'found2',name:'서면 연탄구이',address:'부산 부산진구 전포대로 210',lat:35,lng:129,category:'한식'}];}
let advances=0;export async function advanceRoomStage(roomId:string,stage:RoomSummary['stage']){record('advanceRoomStage',{roomId,stage});if(scene==='confirm-retry'&&advances++===0)return{stage:null,error:Error('offline fixture')};fixtureRoom.stage=stage;return{stage,error:null};}
if(scene==='notice')rows.unshift({id:'notice-place',roomId:'room',senderId:null,senderName:'',senderColor:'',kind:'system',text:'[notice:place]식당 투표가 열렸어요',createdAt:'2026-09-25T10:00:00Z'});
