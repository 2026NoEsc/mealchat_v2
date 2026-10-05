import {
  noticePreviewText,
  parseRoomNotice,
  roomNoticeOf,
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

describe('roomNoticeOf', () => {
  it('토큰이 있으면 토큰을 쓴다', () => {
    expect(roomNoticeOf('[notice:place]조선칼국수 하단점')?.title).toBe('식당이 정해졌어요');
  });

  it('서버가 쓰는 일정·메뉴 확정 평문을 카드로 세운다', () => {
    expect(roomNoticeOf('일정을 8월 15일 (금) 18:30로 확정했어요')).toEqual({
      kind: 'schedule',
      title: '일정이 확정됐어요',
      detail: '8월 15일 (금) 18:30',
      action: '캘린더에 저장',
    });
    expect(roomNoticeOf('오늘 메뉴를 조선칼국수 하단점로 확정했어요')).toEqual({
      kind: 'place',
      title: '식당이 정해졌어요',
      detail: '조선칼국수 하단점',
      action: '위치 보기',
    });
  });

  it('이름 끝에 "로" 가 있어도 조사만 떼어 낸다', () => {
    expect(roomNoticeOf('오늘 메뉴를 서울로로 확정했어요')?.detail).toBe('서울로');
  });

  it('정산 금액에 천 단위를 넣는다', () => {
    expect(roomNoticeOf('정산 요청을 시작했어요 · 1인당 32000원')).toEqual({
      kind: 'settlement',
      title: '정산이 시작됐어요',
      detail: '1인당 32,000원',
      action: '정산하기',
    });
  });

  it('정산 수정은 제목이 다르다 — 새 정산이 하나 더 생긴 것으로 읽히면 안 된다', () => {
    const notice = roomNoticeOf('정산 요청 내용을 수정했어요 · 1인당 7500원');
    expect(notice?.title).toBe('정산 내용이 바뀌었어요');
    expect(notice?.detail).toBe('1인당 7,500원');
    expect(notice?.kind).toBe('settlement');
  });

  it('알아보지 못한 안내는 회색 알약으로 남긴다', () => {
    expect(roomNoticeOf('두두님이 초대 코드로 입장했어요')).toBeNull();
    expect(roomNoticeOf('일정을 확정했어요')).toBeNull();
    expect(roomNoticeOf('정산 요청을 시작했어요')).toBeNull();
  });
});
