import {
  noticePreviewText,
  parseRoomNotice,
  toRoomNoticeToken,
} from '../src/lib/roomNotice';

describe('parseRoomNotice', () => {
  it('종류에서 제목과 버튼 문구를 끌어낸다', () => {
    expect(parseRoomNotice('[notice:schedule]8월 15일 (금) 18:30')).toEqual({
      kind: 'schedule',
      title: '일정이 확정됐어요',
      detail: '8월 15일 (금) 18:30',
      action: '캘린더에 저장',
    });
  });

  it('식당과 정산도 각자 문구를 가진다', () => {
    expect(parseRoomNotice('[notice:place]조선칼국수 하단점')?.title).toBe('식당이 정해졌어요');
    expect(parseRoomNotice('[notice:settlement]1인당 12,000원')?.action).toBe('정산하기');
  });

  it('상세가 비어도 카드로 그린다', () => {
    expect(parseRoomNotice('[notice:place]')?.detail).toBe('');
  });

  it('토큰이 없는 예전 시스템 메시지는 카드로 만들지 않는다', () => {
    expect(parseRoomNotice('두두님이 초대 코드로 입장했어요')).toBeNull();
    expect(parseRoomNotice('[notice:unknown]뭐지')).toBeNull();
    expect(parseRoomNotice('[emoticon:dudu_shock]')).toBeNull();
  });
});

describe('toRoomNoticeToken', () => {
  it('parse 와 왕복한다', () => {
    const token = toRoomNoticeToken('settlement', '  1인당 12,000원  ');
    expect(token).toBe('[notice:settlement]1인당 12,000원');
    expect(parseRoomNotice(token)?.detail).toBe('1인당 12,000원');
  });
});

describe('noticePreviewText', () => {
  it('카드를 못 그리는 자리에서는 한 줄로 편다', () => {
    expect(noticePreviewText('[notice:schedule]8월 15일 (금) 18:30')).toBe(
      '일정이 확정됐어요 · 8월 15일 (금) 18:30',
    );
    expect(noticePreviewText('[notice:place]')).toBe('식당이 정해졌어요');
  });

  it('토큰이 아니면 원문 그대로', () => {
    expect(noticePreviewText('국밥 어때요 국밥')).toBe('국밥 어때요 국밥');
  });
});
