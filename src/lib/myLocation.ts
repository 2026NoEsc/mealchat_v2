import * as Location from 'expo-location';

/**
 * 일정 추가 STEP 1 에서 잡는 "이번 약속의 내 위치".
 *
 * 프로필의 사는 곳과는 별개다. 회사에서 밥약을 잡는데 집 주소로 중간 지점이
 * 계산되면 안 되고, 그렇다고 한 번 다른 데서 잡았다고 기본 출발지가 덮여도
 * 곤란하다. 그래서 저장하지 않고 이 약속에만 실어 보낸다.
 */
export type MyLocation = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  /** GPS 로 잡았는지 — 화면에서 출처를 밝히는 데 쓴다 */
  fromGps: boolean;
};

export class LocationDeniedError extends Error {}

/**
 * 현재 위치를 좌표로 잡는다.
 *
 * 좌표만으로는 화면에 보여줄 이름이 없어서 역지오코딩까지 한다. 실패해도
 * 좌표는 쓸 수 있으므로 이름만 비워 두고 넘어간다 — 중간 지점 계산에 필요한
 * 것은 좌표지 이름이 아니다.
 */
export async function locateMe(): Promise<MyLocation> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== Location.PermissionStatus.GRANTED) {
    throw new LocationDeniedError('위치 권한이 없어요. 직접 검색으로 정할 수 있어요.');
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const { latitude, longitude } = position.coords;
  const label = await describeCoords(latitude, longitude);

  return {
    name: label.name,
    address: label.address,
    lat: latitude,
    lng: longitude,
    fromGps: true,
  };
}

/** 좌표를 사람이 읽는 주소로. 실패는 삼키고 좌표만 살린다. */
async function describeCoords(
  lat: number,
  lng: number,
): Promise<{ name: string; address: string }> {
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (!place) return { name: '현재 위치', address: '' };

    const address = [place.region, place.city, place.district, place.street]
      .filter((part): part is string => Boolean(part))
      .join(' ');

    return { name: place.name?.trim() || '현재 위치', address };
  } catch {
    /* 역지오코딩은 있으면 좋은 정보라, 없다고 위치 잡기를 실패시키지 않는다 */
    return { name: '현재 위치', address: '' };
  }
}
