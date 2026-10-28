import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import { profileStyles } from './ProfileFrame';

/** A's BottomSheet has no onDismiss API. Keep this photo-only modal mounted until
 * native iOS dismissal completes before presenting a system picker. No inputs. */
export default function ProfilePhotoSheet({ visible, onDismiss, ...props }: {
  visible: boolean; title: string; children: ReactNode; onClose: () => void; onDismiss: () => void;
}) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={props.onClose} onDismiss={onDismiss}>
    <SafeAreaProvider><Content {...props} /></SafeAreaProvider>
  </Modal>;
}
function Content({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.root, { paddingTop: insets.top }]}>
    <Pressable accessible={false} importantForAccessibility="no" aria-hidden={true} onPress={onClose} style={styles.scrim} />
    <View accessibilityViewIsModal aria-modal style={[styles.sheet, { paddingBottom: 24 + insets.bottom }]}>
      <View style={styles.handle} accessible={false} />
      <View style={styles.heading}><Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={onClose}
          style={({ pressed }) => [profileStyles.iconButton, pressed && profileStyles.pressed]}><X size={24} color={colors.ink} aria-hidden={true} /></Pressable>
      </View>
      {children}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.ink, opacity: 0.5 },
  sheet: { maxHeight: '95%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, paddingHorizontal: 20, gap: 14, backgroundColor: colors.surface },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center' },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 28, color: colors.ink },
});
