import type { TabKey } from '../components/BottomNav';

export type RouteName =
  | 'Login'
  | 'SignupStart'
  | 'SignupPersonal'
  | 'SignupCalendar'
  | 'SignupTaste'
  | 'FoodProfile'
  | 'SignupTerms'
  | 'Home'
  | 'Schedule'
  | 'ScheduleDetail'
  | 'ScheduleTime'
  | 'ScheduleConfirmed'
  | 'Chat'
  | 'ChatRoom'
  | 'RoomDetail'
  | 'Profile'
  | 'Friends'
  | 'Privacy'
  | 'Origin'
  | 'ProfileEdit'
  | 'PasswordChange'
  | 'Settings'
  | 'OptionalConsents'
  | 'AccountDeletion'
  | 'ServiceTerms'
  | 'PrivacyPolicy'
  | 'PrivacyRevision'
  | 'AppInfo'
  | 'Settlements'
  | 'SettlementDetail';

/** Notifications and list entries pass IDs only; account data never enters route state. */
export function settlementDetailRoute(billId: string): Route {
  return { name: 'SettlementDetail', params: { billId } };
}

/** P06 E0803/E0816 -> list, E0818/E0825/E0831 -> requester chat. */
export function settlementDetailBackRoute(requester: boolean, roomId: string | null): Route {
  return requester && roomId ? { name: 'ChatRoom', params: { roomId } } : { name: 'Settlements' };
}

export type Route = {
  name: RouteName;
  params?: Record<string, unknown>;
};

/** 하단 탭이 노출되는 루트 화면 */
export const TAB_ROUTES: Record<TabKey, RouteName> = {
  home: 'Home',
  schedule: 'Schedule',
  profile: 'Profile',
};

export const ROUTE_TO_TAB: Partial<Record<RouteName, TabKey>> = {
  Settings: 'profile',
  OptionalConsents: 'profile',
  ServiceTerms: 'profile',
  PrivacyPolicy: 'profile',
  PrivacyRevision: 'profile',
  AppInfo: 'profile',
  // 프로필 하위 화면도 Figma 상 하단 탭이 유지된다 (프로필 탭 활성)
  Friends: 'profile',
  Privacy: 'profile',
  Origin: 'profile',
  ProfileEdit: 'profile',
  Home: 'home',
  Schedule: 'schedule',
  // 새 밥약 3단계와 출발지 검색에서는 하단 탭을 숨긴다.
  // 정산은 홈에서 들어가므로 홈 탭을 유지한다
  Settlements: 'home',
  /* 채팅방 목록은 홈으로 합쳤다. 예전 경로로 들어와도 홈 탭이 켜져 있어야 한다 */
  Chat: 'home',
  Profile: 'profile',
};
