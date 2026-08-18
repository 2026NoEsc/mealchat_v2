import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { buildTmapHtml, type MapMarker } from '../lib/tmapHtml';

export type TmapMapProps = {
  marker: MapMarker | null;
};

/**
 * Tmap 지도 (네이티브).
 *
 * Tmap 은 웹 SDK 만 제공해서 WebView 로 감싼다. 웹에서는 같은 HTML 을 iframe 에
 * 넣는 [TmapMap.web.tsx](./TmapMap.web.tsx) 가 대신 쓰인다.
 */
export default function TmapMap({ marker }: TmapMapProps) {
  const appKey = process.env.EXPO_PUBLIC_TMAP_APP_KEY ?? '';

  return (
    <View style={styles.container}>
      <WebView
        style={styles.web}
        originWhitelist={['*']}
        source={{ html: buildTmapHtml(appKey, marker) }}
        scrollEnabled={false}
        javaScriptEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8EBE6',
  },
  web: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
