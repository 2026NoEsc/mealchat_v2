import {
  buildScheduleRecommendRequest,
  parseScheduleRecommendations,
} from '../src/screens/schedule/scheduleRecommendContract';

const recommendation = {
  slotId: '2026-08-25-12',
  rank: 1,
  score: 92,
  reason: '모두 참석할 수 있어요.',
  availableCount: 2,
  totalCount: 2,
  attendanceRate: 1,
};

describe('buildScheduleRecommendRequest', () => {
  it('운영 v7과 레거시 함수가 읽는 장소 필드를 함께 만든다', () => {
    const place = {
      id: 'poi-123',
      name: '  테스트 식당  ',
      address: ' 부산시 사하구 ',
      latitude: 35,
      longitude: 129,
    };

    const request = buildScheduleRecommendRequest({
      meetingName: '점심',
      inviteeIds: ['friend-id'],
      place,
      candidateSlots: [],
    });

    expect(request.place).toBe(place);
    expect(request.placeCandidates).toEqual([
      {
        id: 'poi-123',
        name: '테스트 식당',
        address: '부산시 사하구',
        category: '',
      },
    ]);
  });

  it('이전 화면 params에 id가 없어도 운영 v7에 유효한 식별자를 보낸다', () => {
    const request = buildScheduleRecommendRequest({
      meetingName: '점심',
      inviteeIds: [],
      place: { name: '테스트 식당' },
      candidateSlots: [],
    });

    expect(request.placeCandidates[0].id).toBe('selected-place');
  });
});

describe('parseScheduleRecommendations', () => {
  it('운영 v7의 slotRecommendations를 읽고 빠진 이동 시간을 null로 채운다', () => {
    expect(parseScheduleRecommendations({ slotRecommendations: [recommendation] })).toEqual([
      { ...recommendation, averageTravelMinutes: null },
    ]);
  });

  it('레거시 recommendations도 계속 읽는다', () => {
    expect(
      parseScheduleRecommendations({
        recommendations: [{ ...recommendation, averageTravelMinutes: 12 }],
      }),
    ).toEqual([{ ...recommendation, averageTravelMinutes: 12 }]);
  });

  it('필수 필드가 빠진 응답은 화면으로 넘기지 않는다', () => {
    expect(parseScheduleRecommendations({ slotRecommendations: [{ slotId: 'slot-1' }] })).toBeNull();
  });
});
