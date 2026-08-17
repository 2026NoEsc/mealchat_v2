import { ROUTE_TO_TAB, TAB_ROUTES } from '../routes';

describe('navigation route mappings', () => {
  it('maps each bottom tab to its root route', () => {
    expect(TAB_ROUTES).toEqual({
      home: 'Home',
      schedule: 'Schedule',
      chat: 'Chat',
      profile: 'Profile',
    });
  });

  it('maps every root route to the expected active tab', () => {
    expect(ROUTE_TO_TAB).toEqual({
      Chat: 'chat',
      Friends: 'profile',
      Home: 'home',
      Origin: 'profile',
      Privacy: 'profile',
      Profile: 'profile',
      ProfileEdit: 'profile',
      Schedule: 'schedule',
      ScheduleConfirmed: 'schedule',
      ScheduleDetail: 'schedule',
      ScheduleRecommend: 'schedule',
      ScheduleTime: 'schedule',
    });
  });
});
