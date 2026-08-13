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
  | 'Profile';

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
  Home: 'home',
  Schedule: 'schedule',
  // 일정 추가 3단계와 확정 화면도 하단 탭을 유지한다 (Figma 309:1065 / 160:733 / 159:491 / 160:827)
  ScheduleDetail: 'schedule',
  ScheduleTime: 'schedule',
  ScheduleRecommend: 'schedule',
  ScheduleConfirmed: 'schedule',
  Chat: 'chat',
  Profile: 'profile',
};
