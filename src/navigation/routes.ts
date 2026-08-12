import type { TabKey } from '../components/BottomNav';

export type RouteName =
  | 'Login'
  | 'SignupStart'
  | 'SignupPersonal'
  | 'SignupCalendar'
  | 'SignupTaste'
  | 'SignupTerms'
  | 'Home'
  | 'Schedule'
  | 'Chat'
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
  Chat: 'chat',
  Profile: 'profile',
};
