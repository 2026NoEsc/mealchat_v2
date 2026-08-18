import { buildTmapHtml } from '../src/lib/tmapHtml';

const KEY = 'test-app-key';

describe('buildTmapHtml', () => {
  describe('좌표가 없을 때', () => {
    const html = buildTmapHtml(KEY, null);

    it('SDK 를 불러오지 않는다 — 띄울 지도가 없다', () => {
      expect(html).not.toContain('apis.openapi.sk.com');
    });

    it('임의의 기본 좌표를 찍지 않는다', () => {
      expect(html).not.toContain('Tmapv2.LatLng');
    });

    it('무엇을 해야 하는지 알려준다', () => {
      expect(html).toContain('검색해서 위치를 고르면');
    });
  });

  describe('좌표가 있을 때', () => {
    const html = buildTmapHtml(KEY, {
      lat: 35.11371468,
      lng: 128.96593994,
      label: '동아대학교 승학캠퍼스',
    });

    it('jsv2 SDK 를 앱키와 함께 불러온다', () => {
      expect(html).toContain('tmap/jsv2?version=1&appKey=test-app-key');
    });

    it('좌표를 그대로 넣는다', () => {
      expect(html).toContain('var lat = 35.11371468;');
      expect(html).toContain('var lng = 128.96593994;');
    });

    it('마커를 만든다', () => {
      expect(html).toContain('new Tmapv2.Marker(');
    });
  });

  describe('라벨 이스케이프', () => {
    it('따옴표가 들어가도 스크립트가 깨지지 않는다', () => {
      const html = buildTmapHtml(KEY, { lat: 1, lng: 2, label: `오'브라이언 "카페"` });
      expect(html).toContain(String.raw`var label = "오'브라이언 \"카페\"";`);
    });

    it('라벨로 스크립트 태그를 닫을 수 없다', () => {
      const html = buildTmapHtml(KEY, { lat: 1, lng: 2, label: '</script><script>alert(1)</script>' });
      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).toContain('\\u003c/script>');
    });
  });

  it('앱키에 특수문자가 있어도 URL 로 안전하게 넣는다', () => {
    const html = buildTmapHtml('a&b c', { lat: 1, lng: 2, label: 'x' });
    expect(html).toContain('appKey=a%26b%20c');
  });
});
