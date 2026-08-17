import { fromBirthDate, toBirthDate } from '../src/lib/birthDate';
import {
  countLikedTastes,
  formatAccount,
  formatBirthDate,
  maskAccountNumber,
} from '../src/lib/format';

describe('fromBirthDate', () => {
  it('date 값을 세 칸으로 되돌린다', () => {
    expect(fromBirthDate('2002-12-20')).toEqual({ year: '2002', month: '12', day: '20' });
  });

  it('앞의 0 을 지운다', () => {
    expect(fromBirthDate('1999-03-07')).toEqual({ year: '1999', month: '3', day: '7' });
  });

  it('값이 없으면 빈 칸을 준다', () => {
    for (const value of [null, undefined, '', '  ']) {
      expect(fromBirthDate(value)).toEqual({ year: '', month: '', day: '' });
    }
  });

  it('형식이 다르면 빈 칸을 준다', () => {
    expect(fromBirthDate('2002/12/20')).toEqual({ year: '', month: '', day: '' });
    expect(fromBirthDate('2002-12-20T00:00:00Z')).toEqual({ year: '', month: '', day: '' });
  });

  it('toBirthDate 와 왕복해도 값이 유지된다', () => {
    const original = { year: '2002', month: '12', day: '20' };
    expect(fromBirthDate(toBirthDate(original))).toEqual(original);
  });
});

describe('maskAccountNumber', () => {
  it('뒤 네 자리만 남긴다', () => {
    expect(maskAccountNumber('2467332464666')).toBe('••••4666');
  });

  it('숫자가 아닌 문자는 무시하고 센다', () => {
    expect(maskAccountNumber('246-733-246-4666')).toBe('••••4666');
  });

  it('네 자리 이하는 그대로 둔다', () => {
    expect(maskAccountNumber('1234')).toBe('1234');
  });

  it('비었으면 null', () => {
    expect(maskAccountNumber(null)).toBeNull();
    expect(maskAccountNumber('')).toBeNull();
    expect(maskAccountNumber('----')).toBeNull();
  });
});

describe('formatBirthDate', () => {
  it('한국어 표기로 바꾼다', () => {
    expect(formatBirthDate('2002-12-20')).toBe('2002년 12월 20일');
    expect(formatBirthDate('1999-03-07')).toBe('1999년 3월 7일');
  });

  it('값이 없거나 형식이 다르면 null', () => {
    expect(formatBirthDate(null)).toBeNull();
    expect(formatBirthDate('2002/12/20')).toBeNull();
  });
});

describe('formatAccount', () => {
  it('은행과 마스킹한 계좌를 합친다', () => {
    expect(formatAccount('농협', '2467332464666')).toBe('농협 ••••4666');
  });

  it('한쪽만 있어도 보여준다', () => {
    expect(formatAccount('농협', null)).toBe('농협');
    expect(formatAccount(null, '2467332464666')).toBe('••••4666');
  });

  it('둘 다 없으면 null', () => {
    expect(formatAccount(null, null)).toBeNull();
    expect(formatAccount('   ', '')).toBeNull();
  });
});

describe('countLikedTastes', () => {
  it('true 인 것만 센다', () => {
    expect(countLikedTastes({ spicy: true, sweet: false, sour: true })).toBe(2);
  });

  it('비었거나 없으면 0', () => {
    expect(countLikedTastes({})).toBe(0);
    expect(countLikedTastes(null)).toBe(0);
    expect(countLikedTastes(undefined)).toBe(0);
  });
});
