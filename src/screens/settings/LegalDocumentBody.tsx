import { useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { LegalDocument } from '../../legal/terms';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

export default function LegalDocumentBody({ document, initialSection }: { document: LegalDocument; initialSection?: string }) {
  const scroll = useRef<ScrollView>(null);
  const positioned = useRef(false);
  // TODO(서버 단계): 이전 판 원문이 제공되면 이전 판 보기를 연결한다.
  return <ScrollView ref={scroll} testID={`legal-${document.id}`} contentContainerStyle={styles.body}>
    <View style={styles.meta}><Text style={styles.metaText}>시행일 {document.effectiveDate} · {document.edition}판</Text></View>
    {document.sections.map((section) => <View key={section.id} testID={`legal-section-${section.id}`} style={styles.section}
      onLayout={(event) => {
        if (initialSection === section.id && !positioned.current) {
          positioned.current = true;
          scroll.current?.scrollTo({ y: event.nativeEvent.layout.y, animated: false });
        }
      }}>
      <Text accessibilityRole="header" style={styles.title}>{section.title}</Text>
      {section.paragraphs.map((paragraph, index) => <Text key={index} selectable style={styles.paragraph}>{paragraph}</Text>)}
    </View>)}
  </ScrollView>;
}

const styles = StyleSheet.create({
  body: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 40, gap: 24 },
  meta: { borderRadius: 10, backgroundColor: colors.mutedBg, paddingVertical: 12, paddingHorizontal: 14 },
  metaText: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 20, color: colors.sub },
  section: { gap: 8 },
  title: { fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 24, color: colors.ink },
  paragraph: { fontFamily: fontFamily.body, fontSize: 15, lineHeight: 22.5, color: colors.ink },
});
