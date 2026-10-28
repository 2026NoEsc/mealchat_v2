import type { ReactNode } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View, type ImageSourcePropType, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { Button } from '../../components/ui/Button';
import { v3Colors as c } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import { previewAssets as a } from './previewAssets';

export function Copy({ children, size = 14, bold = false, sub = false, style }: { children: ReactNode; size?: number; bold?: boolean; sub?: boolean; style?: StyleProp<TextStyle> }) {
  return <Text style={[{ fontFamily: bold ? fontFamily.bold : fontFamily.regular, fontSize: size, lineHeight: size * 1.45, color: sub ? c.sub : c.ink }, style]}>{children}</Text>;
}
export function Art({ source, width = 24, height = width, svg = true, resizeMode = 'contain' }: { source: ImageSourcePropType; width?: number; height?: number; svg?: boolean; resizeMode?: 'contain' | 'cover' }) {
  if (svg && Platform.OS !== 'web') return <View style={{ width, height }}><SvgUri uri={Image.resolveAssetSource(source).uri} /></View>;
  return <Image source={source} resizeMode={resizeMode} style={{ width, height }} />;
}
export function IconAction({ label, source, onPress, size = 24 }: { label: string; source: ImageSourcePropType; onPress: () => void; size?: number }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={ui.touch}><Art source={source} width={size} /></Pressable>;
}
export function Header({ title, onBack, onMore, dark = false }: { title: string; onBack: () => void; onMore?: () => void; dark?: boolean }) {
  return <View style={ui.header}><IconAction label="뒤로가기" source={dark ? a.cameraClose : a.back} onPress={onBack} /><Copy size={17} bold style={[ui.grow, dark && { color: 'white', textAlign: 'center' }]}>{title}</Copy>{onMore ? <IconAction label="더보기" source={a.more} onPress={onMore} /> : <View style={ui.touch} />}</View>;
}
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) { return <View style={[ui.card, style]}>{children}</View>; }
export function Action({ label, onPress, secondary = false, danger = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; danger?: boolean; disabled?: boolean }) {
  if (danger) return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} accessibilityState={{ disabled }} onPress={onPress} style={[ui.danger, disabled && { opacity: 0.4 }]}><Copy size={16} bold style={{ color: 'white' }}>{label}</Copy></Pressable>;
  return <Button label={label} variant={secondary ? 'secondary' : 'primary'} disabled={disabled} onPress={onPress} style={{ flex: 1 }} />;
}
export function Overlay({ children, onClose, dialog = false, title, subtitle }: { children: ReactNode; onClose: () => void; dialog?: boolean; title?: string; subtitle?: string }) {
  return <View style={ui.overlay}><Pressable accessibilityRole="button" accessibilityLabel="미리보기 닫기" style={StyleSheet.absoluteFill} onPress={onClose} /><View accessibilityViewIsModal style={dialog ? ui.dialog : ui.sheet}>
    {!dialog && <View style={ui.handle} />}
    {title && <View style={ui.row}><View style={ui.grow}><Copy size={20} bold>{title}</Copy>{subtitle && <Copy sub>{subtitle}</Copy>}</View><IconAction label="닫기" source={a.close} onPress={onClose} /></View>}{children}
  </View></View>;
}
export const ui = StyleSheet.create({
  screen: { flex: 1, minHeight: 0, backgroundColor: c.bg }, grow: { flex: 1, minWidth: 0 },
  header: { padding: 8, gap: 4, flexDirection: 'row', alignItems: 'center', minHeight: 60 }, touch: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' }, body: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 120, gap: 16 },
  card: { padding: 16, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, gap: 8 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, gap: 8, backgroundColor: c.bg },
  danger: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: '#C62828', borderRadius: 14, paddingHorizontal: 8 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(28,26,23,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: c.surface, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 14 },
  dialog: { position: 'absolute', top: '35.87%', left: 36, right: 36, borderRadius: 20, backgroundColor: c.surface, paddingTop: 24, paddingBottom: 20, paddingHorizontal: 20, gap: 14, alignItems: 'center' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, alignSelf: 'center' },
  badge: { backgroundColor: c.selectedBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
});
