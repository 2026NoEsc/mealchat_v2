import { eun, hasFinalConsonant, i, ro } from '../src/lib/particle';

describe('hasFinalConsonant', () => {
  it('받침을 가려낸다', () => {
    expect(hasFinalConsonant('소노')).toBe(false);
    expect(hasFinalConsonant('국밥')).toBe(true);
  });

  it('한글이 아니면 판단하지 않는다', () => {
    expect(hasFinalConsonant('Sono')).toBeNull();
    expect(hasFinalConsonant('')).toBeNull();
  });
});

describe('ro', () => {
  it('받침이 없으면 로', () => {
    expect(ro('소노')).toBe('로');
    expect(ro('코지하우스')).toBe('로');
  });

  it('받침이 있으면 으로', () => {
    expect(ro('국밥')).toBe('으로');
    expect(ro('명륜진사갈비집')).toBe('으로');
  });

  it('ㄹ 받침은 로 — "서울으로" 가 아니다', () => {
    expect(ro('서울')).toBe('로');
  });

  it('한글이 아니면 로로 둔다', () => {
    expect(ro('Sono')).toBe('로');
    expect(ro('')).toBe('로');
  });
});

describe('eun / i', () => {
  it('받침에 따라 갈린다', () => {
    expect(eun('소노')).toBe('는');
    expect(eun('국밥')).toBe('은');
    expect(i('소노')).toBe('가');
    expect(i('국밥')).toBe('이');
  });
});
