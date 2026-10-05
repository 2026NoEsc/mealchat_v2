/**
 * Tmap (SK open API) 연동.
 *
 * - 장소 검색: POI 통합검색으로 "동아대", "하단역" 같은 이름과 주소를 함께 다룬다.
 * - 보행자 경로: 두 좌표 사이의 도보 거리·소요시간.
 *
 * 좌표는 전부 WGS84 경위도다. Tmap 은 X=경도, Y=위도 순서를 쓰는데
 * 흔히 뒤집어 쓰는 실수가 나므로 이 파일 밖으로는 `lat`/`lng` 이름만 내보낸다.
 */

const BASE = 'https://apis.openapi.sk.com/tmap';

export type Place = {
  id: string;
  name: string;
  /** 도로명 주소가 없으면 지번 주소 */
  address: string;
  lat: number;
  lng: number;
  /** Tmap 업종 분류 — "한식", "갈비/고깃집" 처럼 온다. 없으면 빈 문자열 */
  category: string;
};

export type WalkRoute = {
  /** 미터 */
  distance: number;
  /** 초 */
  duration: number;
};

export class TmapError extends Error {}

function appKey(): string {
  const key = process.env.EXPO_PUBLIC_TMAP_APP_KEY?.trim();
  if (!key) {
    /*
     * 사용자에게는 환경변수명을 보여 주지 않는다. 앱을 처음 쓰는 사람에게
     * `EXPO_PUBLIC_...` 은 앱이 고장 났다는 신호로만 읽힌다. 원인은 로그로 남긴다.
     */
    console.warn('EXPO_PUBLIC_TMAP_APP_KEY 가 설정되지 않아 장소 검색을 할 수 없습니다.');
    throw new TmapError('장소 검색을 지금 쓸 수 없어요. 잠시 후 다시 시도해 주세요.');
  }
  return key;
}

/* ------------------------------------------------------------------ 파싱 */

type PoiRow = {
  id?: string;
  name?: string;
  upperAddrName?: string;
  middleAddrName?: string;
  lowerAddrName?: string;
  detailAddrName?: string;
  roadName?: string;
  buildingNo1?: string;
  buildingNo2?: string;
  frontLat?: string;
  frontLon?: string;
  noorLat?: string;
  noorLon?: string;
  middleBizName?: string;
  lowerBizName?: string;
  detailBizName?: string;
};

/** 시/구/동 + 도로명 + 건물번호를 사람이 읽는 한 줄로 합친다 */
export function formatPoiAddress(poi: PoiRow): string {
  const area = [poi.upperAddrName, poi.middleAddrName, poi.lowerAddrName].filter(Boolean).join(' ');
  const building = [poi.buildingNo1, poi.buildingNo2].filter((n) => n && n !== '0').join('-');
  const road = [poi.roadName, building].filter(Boolean).join(' ');
  return [area, road || poi.detailAddrName].filter(Boolean).join(' ').trim();
}

/**
 * 업종을 한 줄로. 가장 구체적인 이름을 앞세운다.
 *
 * 취향 매칭에 쓰는 값이라 "음식점" 보다 "갈비/고깃집" 이 쓸모 있다.
 */
export function formatPoiCategory(poi: PoiRow): string {
  /* Tmap 은 "갈비\/고깃집" 처럼 역슬래시를 섞어 보낸다 — 그대로 두면 화면에 보인다 */
  const raw = poi.detailBizName || poi.lowerBizName || poi.middleBizName || '';
  return raw.replace(/\\/g, '').trim();
}

/**
 * POI 응답을 화면에서 쓰는 형태로 바꾼다.
 *
 * 좌표는 `frontLat`(입구) 우선, 없으면 `noorLat`(중심)을 쓴다. 도보 경로에는
 * 건물 중심보다 입구 좌표가 맞다. 좌표가 없는 행은 지도에 찍을 수 없어 버린다.
 */
export function parsePoiSearch(body: unknown): Place[] {
  const rows = (body as { searchPoiInfo?: { pois?: { poi?: PoiRow[] } } })?.searchPoiInfo?.pois?.poi;
  if (!Array.isArray(rows)) return [];

  return rows.flatMap((poi, i) => {
    const lat = Number(poi.frontLat ?? poi.noorLat);
    const lng = Number(poi.frontLon ?? poi.noorLon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];

    return [
      {
        id: poi.id ?? `poi-${i}`,
        name: poi.name?.trim() || formatPoiAddress(poi),
        address: formatPoiAddress(poi),
        lat,
        lng,
        category: formatPoiCategory(poi),
      },
    ];
  });
}

/** 보행자 경로 응답에서 총거리·총시간을 뽑는다 (첫 feature 의 properties 에 담겨 온다) */
export function parseWalkRoute(body: unknown): WalkRoute | null {
  const features = (body as {
    features?: { properties?: { totalDistance?: number; totalTime?: number } }[];
  })?.features;
  if (!Array.isArray(features)) return null;

  for (const feature of features) {
    const distance = feature?.properties?.totalDistance;
    const duration = feature?.properties?.totalTime;
    if (typeof distance === 'number' && typeof duration === 'number') {
      return { distance, duration };
    }
  }
  return null;
}

/** 같은 가게가 여러 검색어에 걸릴 수 있어 id 로 한 번 거른다. 먼저 나온 쪽을 남긴다. */
export function dedupeById(places: Place[]): Place[] {
  const seen = new Set<string>();
  return places.filter((place) => {
    if (seen.has(place.id)) return false;
    seen.add(place.id);
    return true;
  });
}

/** 초 → "도보 8분" (1분 미만은 올려서 0분을 만들지 않는다) */
export function formatWalkDuration(seconds: number): string {
  return `도보 ${Math.max(1, Math.round(seconds / 60))}분`;
}

/* ------------------------------------------------------------------ 요청 */

async function request(path: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { appKey: appKey(), Accept: 'application/json', ...init.headers },
  });

  if (!response.ok) {
    throw new TmapError(`Tmap 요청 실패 (${response.status})`);
  }
  return response.json();
}

/** 장소·주소 검색 */
export async function searchPlaces(keyword: string, count = 8): Promise<Place[]> {
  const query = keyword.trim();
  if (!query) return [];

  const params = new URLSearchParams({
    version: '1',
    searchKeyword: query,
    count: String(count),
  });

  return parsePoiSearch(await request(`/pois?${params}`, { method: 'GET' }));
}

/** 두 지점 사이 도보 경로 */
export async function walkRoute(
  from: { lat: number; lng: number; name: string },
  to: { lat: number; lng: number; name: string },
): Promise<WalkRoute | null> {
  const body = await request('/routes/pedestrian?version=1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startX: from.lng,
      startY: from.lat,
      endX: to.lng,
      endY: to.lat,
      startName: encodeURIComponent(from.name),
      endName: encodeURIComponent(to.name),
    }),
  });

  return parseWalkRoute(body);
}

/**
 * 중간 지점 둘레에서 찾는다.
 *
 * `/pois/search/around` 는 searchKeyword 를 무시하고 반경 안의 모든 POI(버스정류장까지)
 * 를 거리순으로 돌려준다. 그래서 같은 `/pois` 에 center 와 radius 를 얹는 쪽을 쓴다.
 * radius 는 km 이고 Tmap 최대는 33 이다.
 */
export async function searchPlacesAround(
  center: { lat: number; lng: number },
  keyword: string,
  { radiusKm = 2, count = 8 }: { radiusKm?: number; count?: number } = {},
): Promise<Place[]> {
  const query = keyword.trim();
  if (!query) return [];

  const params = new URLSearchParams({
    version: '1',
    searchKeyword: query,
    centerLon: String(center.lng),
    centerLat: String(center.lat),
    radius: String(Math.min(Math.max(radiusKm, 1), 33)),
    count: String(count),
  });

  return parsePoiSearch(await request(`/pois?${params}`, { method: 'GET' }));
}
