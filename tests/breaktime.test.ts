import { hasBreaktimeRisk, hourOf } from '../src/lib/breaktime';
import { dedupeLabels } from '../src/lib/labels';
import { dedupeById, formatPoiCategory } from '../src/lib/tmap';


describe('hourOf', () => {
  it('시각을 시로 읽는다', () => {
    expect(hourOf('18:00')).toBe(18);
    expect(hourOf('09:30')).toBe(9);
    expect(hourOf('9:30')).toBe(9);
  });

  it('형식이 어긋나면 null', () => {
    expect(hourOf('저녁')).toBeNull();
    expect(hourOf('')).toBeNull();
    expect(hourOf('25:00')).toBeNull();
  });
});

describe('hasBreaktimeRisk', () => {
  it('점심·저녁 시간은 경고하지 않는다', () => {
    expect(hasBreaktimeRisk('12:00')).toBe(false);
    expect(hasBreaktimeRisk('18:00')).toBe(false);
  });

  it('15~17시 시작은 경고한다', () => {
    expect(hasBreaktimeRisk('15:00')).toBe(true);
    expect(hasBreaktimeRisk('16:00')).toBe(true);
  });

  it('17시부터는 저녁 영업이라 경고하지 않는다', () => {
    expect(hasBreaktimeRisk('17:00')).toBe(false);
  });

  it('읽을 수 없는 시각은 경고하지 않는다', () => {
    expect(hasBreaktimeRisk('아무때나')).toBe(false);
  });
});

describe('dedupeById', () => {
  const place = (id: string) => ({ id, name: id, address: '', lat: 0, lng: 0, category: '' });

  it('같은 가게가 여러 검색어에 걸려도 한 번만 남는다', () => {
    const result = dedupeById([place('a'), place('b'), place('a')]);
    expect(result.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('먼저 나온 쪽을 남긴다', () => {
    const first = { ...place('a'), name: '먼저' };
    const later = { ...place('a'), name: '나중' };
    expect(dedupeById([first, later])[0].name).toBe('먼저');
  });
});

describe('formatPoiCategory', () => {
  it('가장 구체적인 업종을 쓴다', () => {
    expect(
      formatPoiCategory({ middleBizName: '음식점', lowerBizName: '한식', detailBizName: '갈비' }),
    ).toBe('갈비');
  });

  it('구체적인 값이 없으면 위 단계로 떨어진다', () => {
    expect(formatPoiCategory({ middleBizName: '음식점', lowerBizName: '한식' })).toBe('한식');
    expect(formatPoiCategory({ middleBizName: '음식점' })).toBe('음식점');
    expect(formatPoiCategory({})).toBe('');
  });

  it('Tmap 이 섞어 보내는 역슬래시를 없앤다', () => {
    expect(formatPoiCategory({ detailBizName: '갈비\\/고깃집' })).toBe('갈비/고깃집');
  });
});

describe('dedupeLabels', () => {
  it('같은 가게가 여러 시간대에 추천돼도 후보는 하나다', () => {
    expect(dedupeLabels(['명륜진사갈비', '화덕연밥', '명륜진사갈비'])).toEqual([
      '명륜진사갈비',
      '화덕연밥',
    ]);
  });

  it('앞뒤 공백은 다듬고, 다듬은 뒤 같으면 하나로 본다', () => {
    expect(dedupeLabels(['  명륜진사갈비 ', '명륜진사갈비'])).toEqual(['명륜진사갈비']);
  });

  it('빈 이름은 후보가 될 수 없다', () => {
    expect(dedupeLabels(['', '   ', '화덕연밥'])).toEqual(['화덕연밥']);
  });
});
