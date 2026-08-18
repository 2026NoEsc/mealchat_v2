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
    throw new TmapError('EXPO_PUBLIC_TMAP_APP_KEY 가 설정되지 않았습니다.');
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
};

/** 시/구/동 + 도로명 + 건물번호를 사람이 읽는 한 줄로 합친다 */
export function formatPoiAddress(poi: PoiRow): string {
  const area = [poi.upperAddrName, poi.middleAddrName, poi.lowerAddrName].filter(Boolean).join(' ');
  const building = [poi.buildingNo1, poi.buildingNo2].filter((n) => n && n !== '0').join('-');
  const road = [poi.roadName, building].filter(Boolean).join(' ');
  return [area, road || poi.detailAddrName].filter(Boolean).join(' ').trim();
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
