import { ChevronDown, ChevronLeft, ChevronUp, Info } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, TextButton } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { Radio } from '../../components/ui/Radio';
import type { FoodCatalog, FoodGroup, FoodPreferences, HealthInput } from '../../lib/foodProfile';
import { toggleFoodCode, unansweredHealth } from '../../lib/foodProfile';
import { v3Colors as colors } from '../../theme/tokens';
import { v3Layout } from '../../theme/scale';
import { fontFamily } from '../../theme/typography';

export type { HealthInput } from '../../lib/foodProfile';
export { unansweredHealth } from '../../lib/foodProfile';
export const emptyFood = (): FoodPreferences => ({ cuisines: [], ingredients: [], forms: [], spice: null });
export const emptyHealth = (): HealthInput => ({ allergy_codes: [], avoided_food_codes: [], diet_type_code: null, additional_avoid_codes: [] });
export default function FoodProfileForm({ step, editing, signupProgress = true, catalog, food, health, onFood, onHealth, expanded, onExpand, onBack, onNext, onSkip, busy, error, onHealthStep, children }: {
  step: 1 | 2; editing?: boolean; signupProgress?: boolean; catalog: FoodCatalog; food: FoodPreferences; health: HealthInput; onFood: (value: FoodPreferences) => void; onHealth: (value: HealthInput) => void;
  expanded: string; onExpand: (value: string) => void; onBack: () => void; onNext: () => void; onSkip: () => void; busy?: boolean; error?: string; onHealthStep?: () => void; children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const unanswered = unansweredHealth(health);
  const group = (code: string) => [...catalog.food_groups, ...catalog.health_groups].find(g => g.group_code === code)!;
  const chips = (g: FoodGroup, selected: string[], change: (values: string[]) => void, options = g.options) => <View style={styles.chips}>{options.map(o => <Chip key={o.code} label={o.label} selected={selected.includes(o.code)} disabled={busy || !o.enabled} accessibilityLabel={o.label + (!o.enabled ? ', 준비 중' : '')} onChange={() => change(toggleFoodCode(selected, o.code, g.sentinel))} style={selected.includes(o.code) ? styles.selectedChip : undefined} />)}</View>;
  const title = (number: string, name: string, note: string) => <View style={styles.cardHeader}><View style={styles.row}><Text style={styles.kicker}>{number}</Text><Text style={styles.cardTitle}>{name}</Text></View><Text style={styles.note}>{note}</Text></View>;
  const additional = () => { const g = group('additional_avoid'); return { ...g, sentinel: 'none', options: g.options.some(o => o.code === 'none') ? g.options : [...g.options, { code: 'none', label: '상관없음', enabled: true }] }; };
  const healthPanels = [{ code: 'allergy', number: '05', name: '알레르기', key: 'allergy_codes' }, { code: 'avoided_food', number: '06', name: '못 먹는 음식', key: 'avoided_food_codes' }, { code: 'diet_type', number: '07', name: '식단 제한', key: 'diet_type_code' }] as const;
  return <View style={[styles.screen, { paddingTop: insets.top }]}>
    <View style={styles.header}><View style={styles.top}><Pressable style={styles.icon} accessibilityRole="button" accessibilityLabel="뒤로" onPress={onBack}><ChevronLeft size={24} color={colors.ink} /></Pressable><TextButton label="건너뛰기" disabled={busy} onPress={onSkip} style={styles.skip} />{!editing && signupProgress ? <Text style={styles.kicker}>STEP 3 / 4</Text> : null}</View>
      {!editing && signupProgress ? <View style={styles.progress}>{[1, 2, 3, 4].map(n => <View key={n} style={[styles.progressPart, n < 4 && styles.progressOn]} />)}</View> : null}
      <View style={[styles.heading, !editing && styles.onboardingHeading]}>{!editing ? <Text style={styles.kicker}>음식 프로필 {step} / 2 · {step === 1 ? '좋아하는 음식' : '피해야 할 음식'}</Text> : null}<Text accessibilityRole="header" style={styles.title}>{editing ? '음식 취향 수정' : step === 1 ? '어떤 음식을 좋아하세요?' : '피해야 할 음식이 있나요?'}</Text><Text style={styles.subtitle}>{step === 1 ? '밥약 메뉴를 추천할 때 기본으로 써요. 나중에 프로필에서 바꿀 수 있어요.' : '나만 볼 수 있는 선택 정보예요. 공동 식당 추천에는 사용하지 않아요.'}</Text>{editing && step === 1 && onHealthStep ? <TextButton label="건강정보 수정" disabled={busy} onPress={onHealthStep} /> : null}</View>
    </View>
    <ScrollView key={step} style={styles.scroll} contentContainerStyle={styles.body}>
      {step === 1 ? <>
        <View style={styles.card}>{title('01', '선호 음식 종류', '여러 개 골라도 돼요 · ‘상관없음’을 고르면 나머지는 해제돼요')}{chips(group('cuisine'), food.cuisines, cuisines => onFood({ ...food, cuisines }))}</View>
        <View style={styles.card}>{title('02', '선호 주재료', '여러 개 골라도 돼요')}{[{ label: '육류', start: 0, end: 4 }, { label: '해산물', start: 4, end: 8 }, { label: '기타', start: 8, end: 12 }].map(s => <View key={s.label} style={styles.section}><Text style={styles.note}>{s.label}</Text>{chips(group('preferred_ingredient'), food.ingredients, ingredients => onFood({ ...food, ingredients }), group('preferred_ingredient').options.slice(s.start, s.end))}</View>)}</View>
        <View style={styles.card}>{title('03', '선호 음식 형태', '여러 개 골라도 돼요')}{chips(group('food_form'), food.forms, forms => onFood({ ...food, forms }))}</View>
        <View style={styles.card}>{title('04', '매운맛 선호도', '하나만 골라 주세요 · 고르지 않아도 돼요')}<View>{group('spice').options.map(o => <Radio key={o.code} label={o.label} selected={food.spice === o.code} disabled={busy} onSelect={() => onFood({ ...food, spice: food.spice === o.code ? null : o.code })} />)}</View></View>
      </> : healthPanels.map(panel => {
        const open = expanded === panel.code, g = group(panel.code);
        const values = panel.code === 'diet_type' ? [...(health.diet_type_code === null ? [] : [health.diet_type_code]), ...health.additional_avoid_codes] : health[panel.key] as string[];
        const summaryOptions = panel.code === 'diet_type' ? [...g.options.filter(o => o.code === health.diet_type_code), ...additional().options.filter(o => health.additional_avoid_codes.includes(o.code))] : g.options.filter(o => values.includes(o.code));
        const summary = summaryOptions.map(o => o.label).join(', ') || '아직 고르지 않았어요';
        return <View key={panel.code} style={[styles.card, styles.accordionCard, open && styles.openCard]}><Pressable accessibilityRole="button" accessibilityLabel={panel.name + ', ' + summary} accessibilityState={{ expanded: open }} onPress={() => onExpand(open ? '' : panel.code)} style={styles.accordion}><Text style={styles.kicker}>{panel.number}</Text><View style={[styles.grow, styles.accordionText]}><Text style={styles.cardTitle}>{panel.name}</Text><Text style={[styles.note, values.length > 0 && styles.selectedText]}>{summary}</Text></View>{open ? <ChevronUp size={20} color={colors.sub} /> : <ChevronDown size={20} color={colors.sub} />}</Pressable>
          {open ? <View style={styles.accordionBody}><Text style={styles.note}>{panel.code === 'diet_type' ? '식단 유형은 하나만, 추가로 피할 것은 여러 개 고를 수 있어요' : '여러 개 골라도 돼요 · ‘없음’을 고르면 나머지는 해제돼요'}</Text>
            {panel.code === 'diet_type' ? <><Text style={styles.note}>식단 유형 (하나만)</Text><View>{g.options.map(o => <Radio key={o.code} label={o.label} selected={health.diet_type_code === o.code} disabled={busy || !o.enabled} onSelect={() => onHealth({ ...health, diet_type_code: o.code })} />)}</View><Text style={styles.note}>추가로 피할 것 (여러 개)</Text>{chips(additional(), health.additional_avoid_codes, additional_avoid_codes => onHealth({ ...health, additional_avoid_codes }))}</> : chips(g, health[panel.key] as string[], selected => onHealth({ ...health, [panel.key]: selected }))}
            <View style={styles.info}><Info size={16} color={colors.sub} /><Text style={[styles.note, styles.grow]}>현재 알레르기·기피 음식·식단 정보는 공동 추천에 반영하지 않아요. 소스·밑반찬까지 확인할 수 없으니 주문 전에 꼭 확인해 주세요.</Text></View></View> : null}</View>;
      })}
      {children}{error ? <Text accessibilityRole="alert" style={styles.note}>{error}</Text> : null}
    </ScrollView>
    <View style={[styles.footer, { paddingBottom: Math.max(23, insets.bottom) }]}>{step === 2 && unanswered.length ? <Text accessibilityRole="alert" style={styles.note}>{unanswered.join(' · ')} 항목을 골라 주세요. 없음도 직접 골라야 해요. 입력하지 않으려면 건너뛰기를 눌러 주세요.</Text> : null}<Button label={step === 2 ? '완료' : editing ? '저장' : '다음'} loading={busy} disabled={busy || (step === 2 && unanswered.length > 0)} style={styles.cta} onPress={onNext} /></View>
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg }, skip: { minHeight: v3Layout.minTouchTarget, height: v3Layout.minTouchTarget, paddingVertical: 0 }, cta: { minHeight: 52, height: 52, paddingVertical: 0 }, onboardingHeading: { minHeight: 111 }, header: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 20, gap: 12 }, top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, icon: { width: v3Layout.minTouchTarget, height: v3Layout.minTouchTarget, justifyContent: 'center' }, progress: { flexDirection: 'row', gap: 6 }, progressPart: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border }, progressOn: { backgroundColor: colors.primary }, heading: { paddingTop: 8, gap: 6 }, title: { fontFamily: fontFamily.bold, fontSize: 22, lineHeight: 32, color: colors.ink }, kicker: { fontFamily: fontFamily.bold, fontSize: 13, lineHeight: 19, color: colors.selectedText }, subtitle: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20.3, color: colors.sub }, scroll: { flex: 1 }, body: { paddingHorizontal: 20, paddingBottom: 16, gap: 12 }, card: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, padding: 16, gap: 12 }, cardHeader: { gap: 2 }, row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, cardTitle: { fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 23.2, color: colors.ink }, note: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, color: colors.sub }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, selectedChip: { borderColor: colors.primary }, section: { gap: 12 }, accordionCard: { padding: 0, gap: 0 }, accordionText: { gap: 2 }, accordionBody: { paddingTop: 4, paddingHorizontal: 16, paddingBottom: 16, gap: 12 }, accordion: { flexDirection: 'row', minHeight: 72, paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center', gap: 12 }, grow: { flex: 1 }, openCard: { borderWidth: 1.5, borderColor: colors.primary, padding: 0 }, selectedText: { color: colors.selectedText }, info: { padding: 12, gap: 8, borderRadius: 12, backgroundColor: colors.mutedBg, flexDirection: 'row', alignItems: 'flex-start' }, footer: { gap: 8, paddingTop: 12, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
});
