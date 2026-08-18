/**
 * Tmap 지도(JS SDK v2)를 담는 HTML.
 *
 * Tmap 지도는 웹 SDK 로만 제공돼서 RN 뷰로 직접 그릴 수 없다. 그래서 같은 HTML 을
 * 웹에서는 iframe, 네이티브에서는 WebView 에 넣는다 — 지도 구현은 한 벌만 둔다.
 *
 * jsv3 는 우리 앱키에 등록돼 있지 않아 403 이 난다. jsv2 를 쓴다.
 */

export type MapMarker = {
  lat: number;
  lng: number;
  label: string;
};

/** `<script>` 안 문자열 리터럴로 들어가는 값 — 따옴표와 태그 종료를 막는다 */
function toJsString(value: string): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/**
 * 좌표가 없으면 지도를 띄우지 않고 안내 문구만 보여준다.
 * 임의의 기본 좌표(예: 서울시청)를 찍으면 사용자가 그걸 자기 위치로 오해한다.
 */
export function buildTmapHtml(appKey: string, marker: MapMarker | null): string {
  const empty = !marker;

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: #E8EBE6; }
  #map { width: 100%; height: 100%; }
  #placeholder {
    display: flex; align-items: center; justify-content: center;
    height: 100%; color: #8F8F8F;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px; text-align: center; padding: 0 24px; box-sizing: border-box;
  }
</style>
${empty ? '' : `<script src="https://apis.openapi.sk.com/tmap/jsv2?version=1&appKey=${encodeURIComponent(appKey)}"></script>`}
</head>
<body>
${empty ? '<div id="placeholder">검색해서 위치를 고르면<br />지도에 표시돼요</div>' : '<div id="map"></div>'}
${
  empty
    ? ''
    : `<script>
  (function () {
    var lat = ${marker.lat};
    var lng = ${marker.lng};
    var label = ${toJsString(marker.label)};

    function fail(message) {
      document.body.innerHTML =
        '<div id="placeholder">' + message + '</div>';
    }

    if (typeof Tmapv2 === 'undefined') {
      fail('지도를 불러오지 못했어요');
      return;
    }

    try {
      var center = new Tmapv2.LatLng(lat, lng);
      var map = new Tmapv2.Map('map', {
        center: center,
        width: '100%',
        height: '100%',
        zoom: 17,
        zoomControl: false,
        scrollwheel: true
      });
      new Tmapv2.Marker({ position: center, map: map, title: label });
    } catch (error) {
      fail('지도를 불러오지 못했어요');
    }
  })();
</script>`
}
</body>
</html>`;
}
