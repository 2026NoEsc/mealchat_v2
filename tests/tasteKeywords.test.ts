import {
  DEFAULT_KEYWORD,
  describeBasis,
  keywordsByPopularity,
} from '../src/lib/tasteKeywords';

describe('keywordsByPopularity', () => {
  it('많이 겹치는 취향부터 돌려준다', () => {
    expect(keywordsByPopularity({ korean: 3, japanese: 1, meat: 2 })).toEqual([
      '한식',
      '고기집',
      '일식',
    ]);
  });

  it('limit 만큼만 자른다', () => {
    const counts = { korean: 5, meat: 4, seafood: 3, western: 2 };
    expect(keywordsByPopularity(counts, 2)).toEqual(['한식', '고기집']);
  });

  it('0 인 취향은 버린다', () => {
    expect(keywordsByPopularity({ korean: 1, chinese: 0 })).toEqual(['한식']);
  });

  it('동점이면 정해진 순서를 따라 결과가 흔들리지 않는다', () => {
    const a = keywordsByPopularity({ japanese: 2, korean: 2, chinese: 2 });
    const b = keywordsByPopularity({ chinese: 2, japanese: 2, korean: 2 });
    expect(a).toEqual(b);
    expect(a).toEqual(['한식', '중식', '일식']);
  });

  it('고른 취향이 없으면 기본 검색어로 떨어진다', () => {
    expect(keywordsByPopularity({})).toEqual([DEFAULT_KEYWORD]);
    expect(keywordsByPopularity(null)).toEqual([DEFAULT_KEYWORD]);
    expect(keywordsByPopularity(undefined)).toEqual([DEFAULT_KEYWORD]);
  });

  it('모르는 취향 키는 무시한다', () => {
    expect(keywordsByPopularity({ dessert: 9 })).toEqual([DEFAULT_KEYWORD]);
  });
});

describe('describeBasis', () => {
  it('혼자면 중간 지점이라고 하지 않는다', () => {
    expect(describeBasis(1, '한식')).toBe('내 출발지에서 가까운 한식');
    expect(describeBasis(0, '한식')).toBe('내 출발지에서 가까운 한식');
  });

  it('여럿이면 좌표를 보탠 인원수를 밝힌다', () => {
    expect(describeBasis(3, '고기집')).toBe('3명의 중간 지점 근처 고기집');
  });
});
