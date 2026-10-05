import { ROUTE_TO_TAB, TAB_ROUTES } from '../routes';

describe('navigation route mappings', () => {
  it('maps each bottom tab to its root route', () => {
    // 채팅방 탭은 홈에 합쳤다 — 시안 2154:584 부터 탭이 셋이다
    expect(TAB_ROUTES).toEqual({
      home: 'Home',
      schedule: 'Schedule',
      profile: 'Profile',
    });
  });

  it('maps every root route to the expected active tab', () => {
    expect(ROUTE_TO_TAB).toEqual({
      // 예전 경로로 들어와도 홈 탭이 켜져 있어야 한다
      Chat: 'home',
      Friends: 'profile',
      Home: 'home',
      Origin: 'profile',
      Privacy: 'profile',
      Profile: 'profile',
      ProfileEdit: 'profile',
      Schedule: 'schedule',
      ScheduleConfirmed: 'schedule',
      ScheduleDetail: 'schedule',
      ScheduleTime: 'schedule',
      Settlements: 'home',
    });
  });
});
