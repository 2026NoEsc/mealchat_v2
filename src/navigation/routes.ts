import type { TabKey } from '../components/BottomNav';

export type RouteName =
  | 'Login'
  | 'SignupStart'
  | 'SignupPersonal'
  | 'SignupCalendar'
  | 'SignupTaste'
  | 'TasteGame'
  | 'SignupTerms'
  | 'Home'
  | 'Schedule'
  | 'ScheduleDetail'
  | 'ScheduleTime'
  | 'ScheduleRecommend'
  | 'ScheduleConfirmed'
  | 'Chat'
  | 'ChatRoom'
  | 'RoomDetail'
  | 'Profile'
  | 'Friends'
  | 'Privacy'
  | 'Origin'
  | 'ProfileEdit'
  | 'Settlements';

export type Route = {
  name: RouteName;
  params?: Record<string, unknown>;
};

/** 하단 탭이 노출되는 루트 화면 */
export const TAB_ROUTES: Record<TabKey, RouteName> = {
  home: 'Home',
  schedule: 'Schedule',
  chat: 'Chat',
  profile: 'Profile',
};

export const ROUTE_TO_TAB: Partial<Record<RouteName, TabKey>> = {
  // 프로필 하위 화면도 Figma 상 하단 탭이 유지된다 (프로필 탭 활성)
  Friends: 'profile',
  Privacy: 'profile',
  Origin: 'profile',
  ProfileEdit: 'profile',
  Home: 'home',
  Schedule: 'schedule',
  // 일정 추가 3단계와 확정 화면도 하단 탭을 유지한다 (Figma 309:1065 / 160:733 / 159:491 / 160:827)
  ScheduleDetail: 'schedule',
  ScheduleTime: 'schedule',
  ScheduleRecommend: 'schedule',
  ScheduleConfirmed: 'schedule',
  // 정산은 홈에서 들어가므로 홈 탭을 유지한다
  Settlements: 'home',
  Chat: 'chat',
  Profile: 'profile',
};
