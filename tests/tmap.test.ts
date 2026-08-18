import {
  formatPoiAddress,
  formatWalkDuration,
  parsePoiSearch,
  parseWalkRoute,
} from '../src/lib/tmap';

describe('formatPoiAddress', () => {
  it('시·구·동에 도로명과 건물번호를 붙인다', () => {
    expect(
      formatPoiAddress({
        upperAddrName: '부산',
        middleAddrName: '사하구',
        lowerAddrName: '하단동',
        roadName: '낙동대로550번길',
        buildingNo1: '37',
        buildingNo2: '0',
      }),
    ).toBe('부산 사하구 하단동 낙동대로550번길 37');
  });

  it('건물 부번이 있으면 하이픈으로 잇는다', () => {
    expect(
      formatPoiAddress({ upperAddrName: '부산', roadName: '중앙대로', buildingNo1: '12', buildingNo2: '3' }),
    ).toBe('부산 중앙대로 12-3');
  });

  it('도로명이 없으면 상세주소로 대신한다', () => {
    expect(
      formatPoiAddress({ upperAddrName: '부산', middleAddrName: '사하구', detailAddrName: '1234-5' }),
    ).toBe('부산 사하구 1234-5');
  });
});

describe('parsePoiSearch', () => {
  const body = {
    searchPoiInfo: {
      pois: {
        poi: [
          {
            id: '1',
            name: '동아대학교 승학캠퍼스',
            upperAddrName: '부산',
            middleAddrName: '사하구',
            lowerAddrName: '하단동',
            roadName: '낙동대로550번길',
            buildingNo1: '37',
            frontLat: '35.1180',
            frontLon: '128.9660',
            noorLat: '35.1181',
            noorLon: '128.9661',
          },
        ],
      },
    },
  };

  it('POI 를 화면용 형태로 바꾼다', () => {
    expect(parsePoiSearch(body)).toEqual([
      {
        id: '1',
        name: '동아대학교 승학캠퍼스',
        address: '부산 사하구 하단동 낙동대로550번길 37',
        lat: 35.118,
        lng: 128.966,
      },
    ]);
  });

  it('중심 좌표보다 입구 좌표를 쓴다', () => {
    const [place] = parsePoiSearch(body);
    expect(place.lat).toBe(35.118);
  });

  it('입구 좌표가 없으면 중심 좌표로 넘어간다', () => {
    const noFront = {
      searchPoiInfo: { pois: { poi: [{ id: '2', name: 'X', noorLat: '35.2', noorLon: '129.0' }] } },
    };
    expect(parsePoiSearch(noFront)[0]).toMatchObject({ lat: 35.2, lng: 129.0 });
  });

  it('좌표가 없는 행은 버린다 — 지도에 찍을 수 없다', () => {
    const broken = { searchPoiInfo: { pois: { poi: [{ id: '3', name: '좌표없음' }] } } };
    expect(parsePoiSearch(broken)).toEqual([]);
  });

  it('예상과 다른 응답에도 빈 배열을 준다', () => {
    expect(parsePoiSearch(null)).toEqual([]);
    expect(parsePoiSearch({})).toEqual([]);
    expect(parsePoiSearch({ searchPoiInfo: { pois: {} } })).toEqual([]);
  });
});

describe('parseWalkRoute', () => {
  it('총거리와 총시간을 담은 feature 에서 값을 뽑는다', () => {
    const body = {
      features: [
        { properties: { name: '출발' } },
        { properties: { totalDistance: 620, totalTime: 480 } },
      ],
    };
    expect(parseWalkRoute(body)).toEqual({ distance: 620, duration: 480 });
  });

  it('총계 feature 가 없으면 null', () => {
    expect(parseWalkRoute({ features: [{ properties: {} }] })).toBeNull();
    expect(parseWalkRoute({})).toBeNull();
  });
});

describe('formatWalkDuration', () => {
  it('분 단위로 반올림한다', () => {
    expect(formatWalkDuration(480)).toBe('도보 8분');
    expect(formatWalkDuration(510)).toBe('도보 9분');
  });

  it('1분 미만도 0분으로 표시하지 않는다', () => {
    expect(formatWalkDuration(20)).toBe('도보 1분');
  });
});
