import { ROOM_COLORS, randomRoomColor, roomColor } from '../src/lib/roomTheme';

describe('roomColor', () => {
  it('저장된 색이 있으면 그것을 쓴다', () => {
    expect(roomColor({ id: 'a', color: '#04CDA3' })).toBe('#04CDA3');
  });

  it('예전 기본값이면 id 로 고른다 — 방마다 갈린다', () => {
    const one = roomColor({ id: 'room-1', color: '#FF9900' });
    const two = roomColor({ id: 'room-2', color: '#FF9900' });
    expect(ROOM_COLORS).toContain(one);
    expect(ROOM_COLORS).toContain(two);
    expect(one).not.toBe(two);
  });

  it('같은 방은 언제 봐도 같은 색', () => {
    expect(roomColor({ id: 'room-1', color: '#ff9900' })).toBe(
      roomColor({ id: 'room-1', color: '#FF9900' }),
    );
  });
});

describe('randomRoomColor', () => {
  it('팔레트 안에서 고른다', () => {
    for (let i = 0; i < 20; i += 1) {
      expect(ROOM_COLORS).toContain(randomRoomColor());
    }
  });
});
