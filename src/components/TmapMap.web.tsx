import { buildTmapHtml } from '../lib/tmapHtml';
import type { TmapMapProps } from './TmapMap';

/**
 * Tmap 지도 (웹).
 *
 * `react-native-webview` 는 웹을 지원하지 않아서 iframe 에 같은 HTML 을 넣는다.
 * Metro 가 `.web.tsx` 를 자동으로 골라 주므로 화면 쪽 코드는 그대로다.
 */
export default function TmapMap({ marker }: TmapMapProps) {
  const appKey = process.env.EXPO_PUBLIC_TMAP_APP_KEY ?? '';

  return (
    <iframe
      title="지도"
      srcDoc={buildTmapHtml(appKey, marker)}
      style={{ width: '100%', height: '100%', border: 0, background: '#E8EBE6' }}
    />
  );
}
