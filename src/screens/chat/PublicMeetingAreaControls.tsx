import { useState } from 'react';
import { Text, View } from 'react-native';
import { authStyles } from '../../components/ui/AuthLayout';
import { TextButton } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { Radio } from '../../components/ui/Radio';
import { toggleFoodCode } from '../../lib/foodProfile';
import type { useRestaurantRecommendations } from './useRestaurantRecommendations';

export default function PublicMeetingAreaControls({ recommendation: r, isOwner }: { recommendation: ReturnType<typeof useRestaurantRecommendations>; isOwner: boolean }) {
  const [open, setOpen] = useState(false), [cuisines, setCuisines] = useState(false);
  if (!r.available) return <Text style={authStyles.helper}>{r.settingsError} 식당을 직접 추가해 주세요.</Text>;
  return <View style={{ gap: 8 }}>
    <Text style={authStyles.label}>공용 만남 지역 · {r.settings?.area?.label ?? '아직 고르지 않았어요'}</Text>
    <Text style={authStyles.helper}>개인 출발지 대신 모두에게 보이는 지역을 기준으로 찾아요. 건강정보는 공동 추천에 쓰지 않아요.</Text>
    {r.settings?.area ? <TextButton label="다시 추천받기" disabled={r.saving || r.status === 'loading'} onPress={() => void r.request()} /> : null}
    {r.settingsError ? <><Text accessibilityRole="alert" style={authStyles.helper}>{r.settingsError}</Text><TextButton label="지역 다시 불러오기" onPress={r.reload} /></> : null}
    {isOwner && r.settings ? <><TextButton label={open ? '지역 선택 접기' : '공용 만남 지역 고르기'} disabled={r.saving} onPress={() => setOpen(v => !v)} />
      {open ? r.areas.length ? r.areas.map(area => <Radio key={area.id} label={area.label} selected={r.settings?.public_area_id === area.id} disabled={r.saving} onSelect={() => void r.saveArea(area.id)} />) : <Text style={authStyles.helper}>선택할 공용 지역이 아직 없어요. 식당을 직접 추가해 주세요.</Text> : null}
      <TextButton label={cuisines ? '음식 종류 접기' : '이번 밥약 음식 종류 (선택)'} disabled={r.saving} onPress={() => setCuisines(v => !v)} />
      {cuisines ? <><Text style={authStyles.helper}>선택하지 않으면 각자의 STEP 1 취향을 내부에서 합쳐 추천해요. 개인별 값을 표시하지 않지만, 2인 밥약에서는 추천으로 상대의 취향을 짐작할 수 있어요.</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{r.catalog?.food_groups.find(g => g.group_code === 'cuisine')?.options.filter(o => o.code !== 'any' && o.enabled).map(o => <Chip key={o.code} label={o.label} selected={r.settings!.public_cuisines.includes(o.code)} disabled={r.saving} onChange={() => void r.saveCuisines(toggleFoodCode(r.settings!.public_cuisines, o.code))} />)}</View></> : null}
    </> : !r.settings?.area ? <Text style={authStyles.helper}>방장이 공용 만남 지역을 선택할 수 있어요.</Text> : null}
  </View>;
}
