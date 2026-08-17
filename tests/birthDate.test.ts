import { toBirthDate } from '../src/lib/birthDate';

describe('toBirthDate', () => {
  it('세 칸 입력을 date 컬럼용 문자열로 바꾼다', () => {
    expect(toBirthDate({ year: '2002', month: '12', day: '20' })).toBe('2002-12-20');
  });

  it('한 자리 월·일에 0 을 채운다', () => {
    expect(toBirthDate({ year: '1999', month: '3', day: '7' })).toBe('1999-03-07');
  });

  it('앞뒤 공백을 무시한다', () => {
    expect(toBirthDate({ year: ' 2000 ', month: ' 1 ', day: ' 2 ' })).toBe('2000-01-02');
  });

  it('비어 있으면 저장하지 않는다', () => {
    expect(toBirthDate({ year: '', month: '', day: '' })).toBeNull();
    expect(toBirthDate({ year: '2002', month: '12', day: '' })).toBeNull();
  });

  it('숫자가 아니면 저장하지 않는다', () => {
    expect(toBirthDate({ year: '이천이', month: '12', day: '20' })).toBeNull();
    expect(toBirthDate({ year: '2002.5', month: '12', day: '20' })).toBeNull();
  });

  it('범위를 벗어난 값을 거른다', () => {
    expect(toBirthDate({ year: '1800', month: '1', day: '1' })).toBeNull();
    expect(toBirthDate({ year: '2002', month: '13', day: '1' })).toBeNull();
    expect(toBirthDate({ year: '2002', month: '0', day: '1' })).toBeNull();
    expect(toBirthDate({ year: '2002', month: '1', day: '32' })).toBeNull();
  });

  it('달력에 없는 날짜를 거른다', () => {
    // Date 가 조용히 다음 달로 넘기는 값들이라 되돌려 확인해야 걸린다
    expect(toBirthDate({ year: '2002', month: '2', day: '31' })).toBeNull();
    expect(toBirthDate({ year: '2001', month: '2', day: '29' })).toBeNull();
    expect(toBirthDate({ year: '2002', month: '4', day: '31' })).toBeNull();
  });

  it('윤년 2월 29일은 통과시킨다', () => {
    expect(toBirthDate({ year: '2000', month: '2', day: '29' })).toBe('2000-02-29');
  });
});
