import { X } from 'lucide-react-native';
import { useRef, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle, type TextStyle } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardOverlap } from '../../theme/keyboard';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import { authStyles } from './AuthLayout';

/** 558:1631: keyboard-safe sheet with a separate, non-nested scrim target. */
type Props = {
  visible: boolean; title: string; subtitle?: string; onClose: () => void; children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>; titleStyle?: StyleProp<TextStyle>; headingStyle?: StyleProp<ViewStyle>;
};

export default function BottomSheet({ visible, ...props }: Props) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={props.onClose}>
    {/* Android Modal has its own window; measure its system bars inside this provider. */}
    <SafeAreaProvider><SheetFrame {...props} /></SafeAreaProvider>
  </Modal>;
}

function SheetFrame({ title, subtitle, onClose, children, contentStyle, titleStyle, headingStyle }: Omit<Props, 'visible'>) {
  const insets = useSafeAreaInsets();
  const rootRef = useRef<View>(null);
  const { overlap: keyboard, remeasure } = useKeyboardOverlap(rootRef);
  const systemBar = keyboard > 0 ? 0 : insets.bottom;
  return <View ref={rootRef} testID="auth-sheet-root" onLayout={remeasure}
    style={[styles.root, { paddingTop: insets.top, paddingBottom: keyboard }]}>
      <Pressable accessible={false} importantForAccessibility="no" aria-hidden={true}
        testID="auth-sheet-scrim" onPress={onClose} style={styles.scrim} />
      <View testID="auth-sheet-surface" accessibilityViewIsModal aria-modal style={[styles.sheet, { paddingBottom: 24 + systemBar }, contentStyle]}>
        <View style={styles.handle} accessible={false} />
        {title ? <View style={[styles.heading, headingStyle]}>
          <View style={styles.headingText}>
            <Text accessibilityRole="header" style={[styles.title, titleStyle]}>{title}</Text>
            {subtitle ? <Text style={authStyles.subtitle}>{subtitle}</Text> : null}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={onClose}
            style={({ pressed }) => [authStyles.iconButton, pressed && authStyles.pressed]}>
            <X size={24} color={colors.ink} aria-hidden={true} />
          </Pressable>
        </View> : null}
        {children}
      </View>
    </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.ink, opacity: 0.5 },
  sheet: { maxHeight: '95%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, paddingHorizontal: 20, paddingBottom: 24, gap: 16, backgroundColor: colors.surface },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center' },
  heading: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  headingText: { flex: 1, gap: 2 },
  title: { fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 28, color: colors.ink },
});
