import { useEffect, useState } from 'react';
import { useNavigation } from '../../navigation/NavigationContext';
/** Historical independent menu proposal. Never connected to the S4 workflow. */
import { Pressable, ScrollView, View, type ImageSourcePropType } from 'react-native';
import { Chip } from '../../components/ui/Chip';
import { v3Colors as c } from '../../theme/tokens';

import { Action, Art, Card, Copy, Header, Overlay, ui } from '../preview/PreviewUI';

const menuAssets: Record<string, ImageSourcePropType> = {
  want: require('../preview/assets/want.svg'), wantOn: require('../preview/assets/wantOn.svg'),
  okay: require('../preview/assets/okay.svg'), okayOn: require('../preview/assets/okayOn.svg'),
  pass: require('../preview/assets/pass.svg'), passOn: require('../preview/assets/passOn.svg'),
};
const menuNames = ['삼겹살', '돼지국밥', '라멘', '돈카츠', '샤브샤브', '파스타', '닭갈비', '비빔밥'];
function MenuContent({ scene, onBack, onScene, notify, onRestaurant }: { scene: string; onBack: () => void; onScene: (id: string) => void; notify: (message: string) => void; onRestaurant: (menu: string) => void }) {
  const [chips, setChips] = useState(['고기', '국물']);
  const [votes, setVotes] = useState<Record<string, number>>({ 삼겹살: 0, 돼지국밥: 1 });
  const [newCandidates, setNewCandidates] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState('삼겹살');
  const candidates = newCandidates ? ['샤브샤브', '파스타', '닭갈비', '돈카츠'] : menuNames;
  const startNewEvaluation = () => { setNewCandidates(true); setSelectedMenu('샤브샤브'); setVotes({}); setAll(false); onScene('menu-evaluate'); };
  const [all, setAll] = useState(false);
  const [modal, setModal] = useState(true);
  const craving = scene === 'menu-craving', change = scene === 'menu-change', loading = scene === 'menu-loading', error = scene === 'menu-error', evaluate = scene === 'menu-evaluate', split = scene === 'menu-split';
  useEffect(() => { setModal(true); }, [scene]);
  const close = onBack;
  const counts = (values: number[]) => <View style={[ui.row, { flexWrap: 'wrap', gap: 10 }]}>{(['want', 'okay', 'pass'] as const).map((kind, i) => <View key={kind} style={[ui.row, { gap: 4 }]}><Art source={menuAssets[kind]} width={14} /><Copy size={13}>{['먹고 싶어요', '괜찮아요', '별로예요'][i]} {values[i]}</Copy></View>)}</View>;
  return <View style={ui.screen}><Copy size={10} sub style={{ paddingHorizontal: 20 }}>로컬 메뉴 예시 · 서버 연결 대기</Copy>
    {craving || change ? <Header title="메뉴 정하기" onBack={onBack} /> : <><Header title="메뉴 정하기" onBack={onBack} /><ScrollView contentContainerStyle={[ui.body, { gap: 12 }]}>
      <Copy bold size={22}>{loading ? '메뉴 후보를 고르는 중이에요' : error ? '메뉴 후보' : evaluate ? newCandidates ? '모두 괜찮다고 한 새 후보 4개' : '우리에게 잘 맞는 메뉴 8개' : '우리 뭐 먹지?'}</Copy>
      {loading ? <><Copy sub>모두의 음식 프로필과 오늘 당기는 음식을 모아 보고 있어요. 보통 몇 초면 끝나요.</Copy>{[1, 0.75, 0.5].map(opacity => <View key={opacity} style={{ height: 147, borderRadius: 16, backgroundColor: c.mutedBg, opacity }} />)}</>
        : error ? <View style={{ alignItems: 'center', paddingTop: 40, gap: 12 }}><Art source={require('../preview/assets/errorAlert.svg')} width={28} /><Copy size={18} bold>후보를 불러오지 못했어요</Copy><Copy sub style={{ textAlign: 'center' }}>인터넷 연결이나 추천 서버 문제로 잠시 실패했어요. 다시 시도하거나 오늘 당기는 음식을 다시 골라 주세요.</Copy><View style={[ui.row, { alignSelf: 'stretch' }]}><Action label="다시 시도" onPress={() => onScene('menu-loading')} /></View><View style={[ui.row, { alignSelf: 'stretch' }]}><Action secondary label="오늘 당기는 음식 다시 고르기" onPress={() => onScene('menu-craving')} /></View></View>
          : evaluate ? <><Copy sub>먹고 싶은 메뉴에 표시해 주세요. 표시하지 않은 메뉴는 &quot;보통&quot;으로 계산해요.</Copy><Card style={{ backgroundColor: c.safeBg }}><View style={ui.row}><Art source={require('../preview/assets/safeInfo.svg')} width={18} /><Copy size={13} style={[ui.grow, { color: c.safeText }]}>로컬 예시 · 실제 알레르기와 식단 정보는 반영되지 않았어요</Copy></View></Card><Copy size={13} sub>로컬 예시 평가 현황 · 4명 중 {newCandidates ? 0 : 3}명 완료</Copy><View style={{ height: 6, backgroundColor: c.border }}><View style={{ height: 6, width: newCandidates ? '0%' : '75%', backgroundColor: c.primary }} /></View>{candidates.slice(0, all ? candidates.length : 5).map((name, index) => <Card key={name} style={{ gap: 10 }}><View style={ui.row}><Copy bold size={18}>{name}</Copy><Copy sub size={13}>{({ 삼겹살: '한식 · 고기', 돼지국밥: '한식 · 국물', 라멘: '일식 · 면', 돈카츠: '일식 · 튀김', 샤브샤브: '일식 · 국물', 파스타: '양식 · 면', 닭갈비: '한식 · 고기', 비빔밥: '한식 · 밥' }[name])}</Copy></View><View style={[ui.row, { flexWrap: 'wrap' }]}>{newCandidates ? <><Copy size={12}>지난 평가 별로예요 0명</Copy><Copy size={12}>새 후보</Copy></> : <><Copy size={12}>평소 선호 {index ? 3 : 4}명</Copy><Copy size={12}>오늘 &quot;{index ? '국물' : '고기'}&quot; {index ? 4 : 3}명</Copy></>}<Copy size={12} style={{ color: c.safeText }}>예시 평가</Copy></View><View style={ui.row}>{(['want', 'okay', 'pass'] as const).map((kind, i) => <Pressable accessibilityRole="radio" accessibilityLabel={`${name} ${['먹고 싶어요', '괜찮아요', '별로예요'][i]}`} accessibilityState={{ checked: votes[name] === i }} aria-checked={votes[name] === i} key={kind} onPress={() => setVotes(old => ({ ...old, [name]: i }))} style={[ui.row, { flex: 1, minHeight: 44, justifyContent: 'center', gap: 4, borderRadius: 12, backgroundColor: votes[name] === i ? c.selectedBg : c.mutedBg, borderWidth: votes[name] === i ? 1.5 : 0, borderColor: c.primary }]}><Art source={menuAssets[votes[name] === i ? `${kind}On` : kind]} width={16} /><Copy size={11} bold={votes[name] === i}>{['먹고 싶어요', '괜찮아요', '별로예요'][i]}</Copy></Pressable>)}</View></Card>)}{!all && candidates.length > 5 && <Pressable accessibilityRole="button" onPress={() => setAll(true)} style={{ minHeight: 44, justifyContent: 'center' }}><Copy sub>+ 후보 3개 더 보기</Copy></Pressable>}</>
            : split ? <><Card><View style={ui.row}><Art source={require('../preview/assets/split.svg')} width={20} /><Copy bold size={17}>의견이 조금 갈리고 있어요</Copy></View><Copy sub>삼겹살과 라멘은 먹고 싶은 사람과 별로인 사람이 2명씩이라 바로 정하지 않았어요.</Copy>{['삼겹살', '라멘'].map(name => <View key={name} style={{ padding: 10, gap: 8, borderRadius: 10, backgroundColor: c.mutedBg }}><Copy bold>{name}</Copy>{counts([2, 0, 2])}</View>)}</Card><Copy bold size={15}>모두가 괜찮다고 한 메뉴를 다시 골라 봤어요</Copy>{['샤브샤브', '파스타', '닭갈비', '돈카츠'].map(name => <Card key={name}><Copy bold size={16}>{name}</Copy><Copy size={12}>별로예요 0명　　예시 평가</Copy></Card>)}</>
              : <><Copy sub>4명 모두 평가했어요. 먹고 싶은 사람이 많고 별로인 사람이 적은 순서예요.</Copy><Card style={{ borderColor: c.primary, borderWidth: 1.5, padding: 18, gap: 12 }}><Copy size={12} style={{ color: c.selectedText }}>가장 의견이 잘 맞는 메뉴</Copy><Copy bold size={26}>{selectedMenu}</Copy>{counts([3, 1, 0])}<Copy size={12} style={{ color: c.safeText }}>4명 예시 평가</Copy><View style={ui.row}><Action label={`${selectedMenu}로 정하기`} onPress={() => onScene('menu-confirm')} /></View></Card><Copy bold size={15}>다른 후보</Copy>{candidates.filter(name => name !== selectedMenu).slice(0, 2).map((name, i) => <Pressable key={name} accessibilityRole="button" onPress={() => { setSelectedMenu(name); onScene('menu-confirm'); }}><Card><Copy bold size={16}>{name}</Copy>{counts([i ? 1 : 2, i ? 3 : 2, 0])}</Card></Pressable>)}</>}
    </ScrollView>{scene === 'menu-result' && <View style={ui.row}><Action label="식당 찾기" onPress={() => onRestaurant(selectedMenu)} /></View>}{!loading && !error && <View style={ui.row}><Action secondary label="메뉴 변경" onPress={() => onScene('menu-change')} /></View>}{!error && <View style={ui.footer}><View style={ui.row}><Action label={loading || evaluate ? '평가 완료' : split ? '새 후보로 다시 평가하기' : '다시 평가하기'} secondary={!evaluate && !loading && !split} disabled={loading} onPress={() => split ? startNewEvaluation() : onScene(evaluate ? Object.values(votes).some(v => v === 2) ? 'menu-split' : 'menu-result' : 'menu-evaluate')} /></View></View>}</>}
    {modal && craving && <Overlay onClose={close} title="오늘은 어떤 음식이 당기세요?" subtitle="이번 밥약에만 적용돼요 · 여러 개 골라도 돼요"><Card style={{ backgroundColor: c.safeBg }}><Copy size={13} style={{ color: c.safeText }}>로컬 예시 후보예요. 실제 알레르기·식단 정보는 아직 연결되지 않았어요</Copy></Card><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{['밥', '면', '고기', '해산물', '국물', '구이', '튀김', '매운 음식', '가볍게', '술과 함께', '아무거나'].map(label => <Chip key={label} label={label} selected={chips.includes(label)} onChange={selected => setChips(old => label === '아무거나' ? selected ? [label] : [] : selected ? [...old.filter(item => item !== '아무거나'), label] : old.filter(item => item !== label))} />)}</View><Copy sub size={12}>&quot;아무거나&quot;를 고르면 다른 선택은 해제돼요</Copy><View style={ui.row}><Action label="메뉴 후보 보기" onPress={() => onScene('menu-loading')} /></View></Overlay>}
    {modal && (scene === 'menu-confirm' || change) && <Overlay dialog onClose={close}><Art source={change ? require('../preview/assets/menuChange.svg') : require('../preview/assets/menuConfirm.svg')} /><Copy bold size={19}>{change ? '다시 메뉴를 정할까요?' : `${selectedMenu}로 정할까요?`}</Copy><Copy sub style={{ textAlign: 'center' }}>{change ? `지금 선택한 메뉴는 ${selectedMenu}예요.\n다시 정하면 평가를 새로 시작해요.` : '로컬 예시 메뉴예요.\n실제 식단 적합성은 확인되지 않았어요'}</Copy><View style={[ui.row, { alignSelf: 'stretch' }]}><Action label={change ? '다시 정하기' : `${selectedMenu}로 확정`} onPress={() => { onScene(change ? 'menu-craving' : 'menu-result'); if (change) { setNewCandidates(false); setSelectedMenu('삼겹살'); setVotes({}); setAll(false); } else notify(`로컬 메뉴를 ${selectedMenu}로 골랐어요 · 서버 연결 대기`); }} /></View><View style={[ui.row, { alignSelf: 'stretch' }]}><Action secondary label={change ? '취소' : '다른 메뉴 보기'} onPress={() => onScene('menu-result')} /></View></Overlay>}
  </View>;
}

/** Loader boundary for future server integration. Local candidates do not represent other members. */
export default function LocalMenuScreen({ loadCandidates }: { loadCandidates?: () => Promise<void> }) {
  const { goBack, navigate, current } = useNavigation();
  const [scene, setScene] = useState('menu-craving'), [note, setNote] = useState('');
  useEffect(() => {
    if (scene !== 'menu-loading') return;
    let active = true;
    const timer = setTimeout(() => {
      if (!loadCandidates) { if (active) setScene('menu-error'); return; }
      void loadCandidates().then(() => { if (active) setScene('menu-evaluate'); }).catch(() => { if (active) setScene('menu-error'); });
    }, 600);
    return () => { active = false; clearTimeout(timer); };
  }, [scene, loadCandidates]);
  return <View style={ui.screen}><MenuContent scene={scene} onBack={goBack} onScene={setScene} notify={setNote} onRestaurant={menu => {
    const roomId = current.params?.roomId;
    if (typeof roomId !== 'string' || !roomId) { setNote('밥약 채팅에서 메뉴를 골라 주세요.'); return; }
    navigate('ChatRoom', { roomId, openSheet: 'menu', localMenuName: menu });
  }} />
    {scene === 'menu-error' && <Action secondary label="로컬 예시 후보로 계속하기" onPress={() => setScene('menu-evaluate')} />}
    {!!note && <Copy>{note}</Copy>}
  </View>;
}
