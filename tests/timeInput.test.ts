import { formatTimeInput, isCompleteTime } from '../src/lib/timeInput';

describe('formatTimeInput', () => {
  it('숫자를 치는 대로 콜론을 넣어 준다', () => {
    expect(formatTimeInput('0')).toBe('0');
    expect(formatTimeInput('09')).toBe('09');
    expect(formatTimeInput('093')).toBe('09:3');
    expect(formatTimeInput('0930')).toBe('09:30');
  });

  it('글자는 걸러 낸다 — 시간 칸에 말이 들어가던 문제', () => {
    expect(formatTimeInput('아무때나')).toBe('');
    expect(formatTimeInput('ab12cd34')).toBe('12:34');
    expect(formatTimeInput('오전 9')).toBe('9');
  });

  it('숫자는 앞에서부터 자리로 읽는다 — 시, 분 순서다', () => {
    /*
     * "930" 은 9시 30분일 수도, 93분일 수도 있다. 자리로 읽어 시(93)를 23 으로
     * 자른다. 숫자 키패드로 치면 "0930" 처럼 네 자리를 채우게 되어 있다.
     */
    expect(formatTimeInput('930')).toBe('23:0');
    expect(formatTimeInput('0930')).toBe('09:30');
  });

  it('콜론을 사람이 쳐도 한 번만 들어간다', () => {
    expect(formatTimeInput('09:30')).toBe('09:30');
    expect(formatTimeInput('0::9:3:0')).toBe('09:30');
  });

  it('네 자리를 넘겨 쳐도 잘라 낸다', () => {
    expect(formatTimeInput('093012')).toBe('09:30');
  });

  it('시는 23, 분은 59 를 넘지 못한다', () => {
    expect(formatTimeInput('99')).toBe('23');
    expect(formatTimeInput('2599')).toBe('23:59');
    expect(formatTimeInput('1275')).toBe('12:59');
  });

  it('지울 때 숫자가 딸려 사라지지 않는다', () => {
    /* "09:30" 에서 0 을 지우면 "09:3" 이 들어온다 */
    expect(formatTimeInput('09:3')).toBe('09:3');
    expect(formatTimeInput('09:')).toBe('09');
    expect(formatTimeInput('')).toBe('');
  });
});

describe('isCompleteTime', () => {
  it('네 자리가 다 찬 시각만 통과한다', () => {
    expect(isCompleteTime('09:30')).toBe(true);
    expect(isCompleteTime('23:59')).toBe(true);
    expect(isCompleteTime('00:00')).toBe(true);
  });

  it('덜 친 값과 범위를 벗어난 값은 막는다', () => {
    expect(isCompleteTime('09:3')).toBe(false);
    expect(isCompleteTime('9:30')).toBe(false);
    expect(isCompleteTime('24:00')).toBe(false);
    expect(isCompleteTime('12:60')).toBe(false);
    expect(isCompleteTime('')).toBe(false);
  });
});
