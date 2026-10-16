import { Component } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import type { TmapMapProps } from '../../components/TmapMap';
import { buildTmapHtml } from '../../lib/tmapHtml';
import { v3Colors as colors } from '../../theme/tokens';
import { profileStyles } from './ProfileFrame';

/** Decorative preview. Reuses Tmap's HTML and SDK-failure placeholder, adding
 * document/HTTP/render failure handling without changing the shared map API. */
export default class ProfileOriginMap extends Component<TmapMapProps & { onUnavailable?: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onUnavailable?.(); }
  render() {
    const { marker } = this.props;
    if (this.state.failed || !marker) return <View style={styles.fallback}>
      <Text style={profileStyles.sub}>{this.state.failed ? '지도를 불러오지 못했어요. 선택한 위치는 저장할 수 있어요.' : '검색해서 위치를 고르면 지도에 표시돼요.'}</Text>
    </View>;
    const html = buildTmapHtml(process.env.EXPO_PUBLIC_TMAP_APP_KEY ?? '', marker);
    const fail = () => { this.setState({ failed: true }); this.props.onUnavailable?.(); };
    return Platform.OS === 'web'
      ? <iframe title="선택한 출발지 지도" srcDoc={html} onError={fail} style={{ width: '100%', height: '100%', border: 0, background: colors.mutedBg }} />
      : <WebView style={styles.web} originWhitelist={['*']} source={{ html }} scrollEnabled={false} javaScriptEnabled onError={fail} onHttpError={fail} />;
  }
}
const styles = StyleSheet.create({
  fallback: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mutedBg },
  web: { flex: 1, backgroundColor: colors.mutedBg },
});
