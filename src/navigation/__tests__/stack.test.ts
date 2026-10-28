import type { Route } from '../routes';
import { popStack } from '../stack';

const stack = (): Route[] => [
  { name: 'Schedule' },
  { name: 'ScheduleDetail', params: { name: '점심 번개팅' } },
  { name: 'ScheduleTime', params: { name: '점심 번개팅', invitees: ['a'] } },
];

describe('popStack', () => {
  it('drops the top route', () => {
    expect(popStack(stack()).map((route) => route.name)).toEqual(['Schedule', 'ScheduleDetail']);
  });

  it('keeps the root route so the app never empties the stack', () => {
    const root: Route[] = [{ name: 'Home' }];
    expect(popStack(root)).toBe(root);
    expect(popStack(root, { name: '무시된다' })).toBe(root);
  });

  it('merges the returned params into the revealed route', () => {
    const next = popStack(stack(), { place: { name: '조선칼국수 하단점' } });

    expect(next[next.length - 1]).toEqual({
      name: 'ScheduleDetail',
      params: { name: '점심 번개팅', place: { name: '조선칼국수 하단점' } },
    });
  });

  it('leaves the revealed route untouched without params', () => {
    const before = stack();
    const next = popStack(before);

    expect(next[next.length - 1]).toBe(before[1]);
  });

  it('does not mutate the given stack', () => {
    const before = stack();
    popStack(before, { name: '바뀐 이름' });

    expect(before[1].params).toEqual({ name: '점심 번개팅' });
    expect(before).toHaveLength(3);
  });
});
