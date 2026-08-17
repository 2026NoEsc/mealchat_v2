import {
  dayKey,
  dayLabel,
  participantMeta,
  remainingLabel,
  ROOM_STATUS_LABEL,
  roomStatus,
  timeLabel,
} from '../src/lib/roomFormat';

/** 테스트가 시계에 흔들리지 않도록 기준 시각을 고정한다 */
const NOW = new Date('2026-08-18T12:00:00');

describe('roomStatus', () => {
  it('확정이 만료보다 우선한다', () => {
    const expired = { isConfirmed: true, expiresAt: '2026-08-01T00:00:00Z' };
    expect(roomStatus(expired, NOW)).toBe('confirmed');
  });

  it('만료 전이면 진행중', () => {
    expect(roomStatus({ isConfirmed: false, expiresAt: '2026-08-19T00:00:00' }, NOW)).toBe('open');
  });

  it('만료됐으면 종료', () => {
    expect(roomStatus({ isConfirmed: false, expiresAt: '2026-08-17T00:00:00' }, NOW)).toBe(
      'expired',
    );
  });

  it('날짜를 못 읽으면 진행중으로 둔다', () => {
    expect(roomStatus({ isConfirmed: false, expiresAt: 'nope' }, NOW)).toBe('open');
  });

  it('상태마다 표시 문구가 있다', () => {
    expect(ROOM_STATUS_LABEL.confirmed).toBe('확정');
    expect(ROOM_STATUS_LABEL.open).toBe('진행중');
    expect(ROOM_STATUS_LABEL.expired).toBe('종료');
  });
});

describe('remainingLabel', () => {
  it('한 시간 미만은 분으로', () => {
    expect(remainingLabel('2026-08-18T12:30:00', NOW)).toBe('30분 남음');
  });

  it('하루 미만은 시간으로', () => {
    expect(remainingLabel('2026-08-18T20:00:00', NOW)).toBe('8시간 남음');
  });

  it('하루가 넘으면 일로', () => {
    expect(remainingLabel('2026-08-21T12:00:00', NOW)).toBe('3일 남음');
  });

  it('이미 지났으면 종료됨', () => {
    expect(remainingLabel('2026-08-17T12:00:00', NOW)).toBe('종료됨');
  });

  it('1분 미만도 최소 1분으로 보여준다', () => {
    expect(remainingLabel('2026-08-18T12:00:30', NOW)).toBe('1분 남음');
  });

  it('읽을 수 없으면 null', () => {
    expect(remainingLabel('nope', NOW)).toBeNull();
  });
});

describe('timeLabel', () => {
  it('오전과 오후를 나눈다', () => {
    expect(timeLabel('2026-08-18T09:05:00')).toBe('오전 9:05');
    expect(timeLabel('2026-08-18T15:30:00')).toBe('오후 3:30');
  });

  it('정오와 자정을 12 로 쓴다', () => {
    expect(timeLabel('2026-08-18T12:00:00')).toBe('오후 12:00');
    expect(timeLabel('2026-08-18T00:10:00')).toBe('오전 12:10');
  });

  it('읽을 수 없으면 빈 문자열', () => {
    expect(timeLabel('nope')).toBe('');
  });
});

describe('dayKey / dayLabel', () => {
  it('같은 날은 같은 키', () => {
    expect(dayKey('2026-08-18T01:00:00')).toBe(dayKey('2026-08-18T23:00:00'));
  });

  it('다른 날은 다른 키', () => {
    expect(dayKey('2026-08-18T23:00:00')).not.toBe(dayKey('2026-08-19T01:00:00'));
  });

  it('표시 문구를 만든다', () => {
    expect(dayLabel('2026-08-18T10:00:00')).toBe('2026년 8월 18일');
  });
});

describe('participantMeta', () => {
  it('인원과 남은 시간을 합친다', () => {
    expect(participantMeta(3, '2026-08-18T20:00:00', NOW)).toBe('3명 · 8시간 남음');
  });

  it('시간을 못 읽으면 인원만', () => {
    expect(participantMeta(2, 'nope', NOW)).toBe('2명');
  });
});
