import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { participantMeta, roomStatus, timeLabel } from '../lib/roomFormat';
import { previewText } from '../lib/emoticon';
import type { RoomStage, RoomSummary } from '../lib/rooms';
import { roomColor } from '../lib/roomTheme';
import { fs, s } from '../theme/scale';
import { colors } from '../theme/tokens';
import { fontFamily } from '../theme/typography';

/** 아바타 자리에 쓸 첫 글자. 이모지·한글 모두 한 글자로 잘리게 배열로 자른다. */
function initialOf(name: string): string {
  return [...name.trim()][0] ?? '?';
}

/*
 * 방 썸네일에 쓸 기본 캐릭터 — 시안 2154:709(moa) / 2154:663(ddori).
 * 방 사진을 올리는 기능이 아직 없어서, 넷 중 하나를 방마다 고정해서 보여 준다.
 * id 로 고르므로 같은 방은 언제 봐도 같은 캐릭터가 나온다.
 */
const CHARACTERS = [
  require('../../assets/brand/moa.png'),
  require('../../assets/brand/ddori.png'),
  require('../../assets/brand/dudu.png'),
  require('../../assets/brand/welling2.png'),
];

function characterFor(id: string) {
  let sum = 0;
  for (const char of id) sum += char.charCodeAt(0);
  return CHARACTERS[sum % CHARACTERS.length];
}

type Tone = {
  label: string;
  card: object;
  chip: object;
  chipText: string;
  meta: string;
};

/* 끝난 방은 어느 단계였든 눌러 둔다 — 목록에서 살아 있는 방과 섞이면 안 된다 */
const EXPIRED: Tone = {
  label: '종료',
  card: { backgroundColor: colors.card, borderColor: colors.border },
  chip: { backgroundColor: '#EDEDED' },
  chipText: '#9E9E9E',
  meta: '#9E9E9E',
};

/*
 * 약속 단계마다 카드 톤이 다르다. 시안이 준 것은 둘뿐이라 —
 * 진행중(2154:706, 주황)과 확정(2154:660, 청록) — 나머지 셋은 그 흐름에
 * 맞춰 골랐다. 아직 내가 움직여야 하는 단계일수록 진하고, 끝난 단계는 옅다.
 */
const TONE: Record<RoomStage, Tone> = {
  scheduling: {
    label: '일정 조율',
    card: { backgroundColor: '#FFF5EB', borderColor: colors.primaryBorder },
    chip: { backgroundColor: colors.primaryVivid },
    chipText: colors.textOnAccent,
    meta: colors.primaryVivid,
  },
  place: {
    label: '식당 선택',
    card: { backgroundColor: '#FFF8E6', borderColor: '#FFE3A3' },
    chip: { backgroundColor: '#F5A623' },
    chipText: colors.textOnAccent,
    meta: '#D9891A',
  },
  confirmed: {
    label: '확정',
    card: { backgroundColor: colors.card, borderColor: colors.border },
    chip: { backgroundColor: '#ECFBFA' },
    chipText: '#1BBBAD',
    meta: '#9E9E9E',
  },
  settling: {
    label: '정산 중',
    card: { backgroundColor: '#EEF5FF', borderColor: '#C9DEFF' },
    chip: { backgroundColor: '#4A90D9' },
    chipText: colors.textOnAccent,
    meta: '#4A90D9',
  },
  done: {
    label: '정산 완료',
    card: { backgroundColor: colors.card, borderColor: colors.border },
    chip: { backgroundColor: '#EDEDED' },
    chipText: '#9E9E9E',
    meta: '#9E9E9E',
  },
};

/**
 * 홈의 밥약 한 줄 — 시안 2154:706 / 2154:660 (196 x 54).
 *
 * 예전에는 채팅방 탭에만 있었는데 탭을 셋으로 줄이면서 홈으로 옮겼다.
 */
export default function RoomRow({
  room,
  onPress,
}: {
  room: RoomSummary;
  onPress: () => void;
}) {
  /* 기한이 지난 방은 단계와 상관없이 눌러 둔다 */
  const tone = roomStatus(room) === 'expired' ? EXPIRED : TONE[room.stage];
  /* 왼쪽 막대와 캐릭터 칩은 방마다 다른 테마 색을 쓴다 */
  const theme = roomColor(room);

  return (
    <Pressable style={[styles.card, tone.card]} onPress={onPress}>
      <View style={[styles.themeBar, { backgroundColor: theme }]} />

      <View style={[styles.avatar, { backgroundColor: `${theme}24` }]}>
        <Image source={characterFor(room.id)} style={styles.character} resizeMode="contain" />
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {room.title}
          </Text>
          <View style={[styles.chip, tone.chip]}>
            <Text style={[styles.chipText, { color: tone.chipText }]}>{tone.label}</Text>
          </View>
        </View>

        <Text style={styles.preview} numberOfLines={1}>
          {room.lastMessage ? previewText(room.lastMessage.text) : '아직 대화가 없어요'}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.stack}>
            {room.participants.slice(0, 3).map((participant, i) => (
              <View
                key={participant.id}
                style={[
                  styles.stackItem,
                  i > 0 && styles.stackOverlap,
                  { backgroundColor: participant.avatarColor },
                ]}>
                <Text style={styles.stackInitial}>{initialOf(participant.name)}</Text>
              </View>
            ))}
          </View>
          <Text style={[styles.meta, { color: tone.meta }]} numberOfLines={1}>
            {participantMeta(room.participants.length, room.expiresAt)}
          </Text>
        </View>
      </View>

      <View style={styles.right}>
        <Text style={styles.time}>
          {room.lastMessage ? timeLabel(room.lastMessage.createdAt) : ''}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    height: s(54),
    borderRadius: s(10),
    borderWidth: s(1),
    flexDirection: 'row',
    paddingLeft: s(7.89),
    paddingTop: s(9),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  themeBar: {
    width: s(3.379),
    height: s(36),
    borderRadius: s(999),
  },
  avatar: {
    // 카드 왼쪽에서 18 — 테마바(7.89+3.379) 다음 자리
    marginLeft: s(6.73),
    /*
     * 정사각. 시안은 36 x 32 로 되어 있는데 캐릭터가 가로로 눌려 보인다.
     * 카드 높이 54 에서 위아래 여백 9 씩 빼면 36 이라 정사각이 딱 들어맞는다.
     */
    width: s(36),
    height: s(36),
    borderRadius: s(9),
    alignItems: 'center',
    justifyContent: 'center',
  },
  /*
   * 캐릭터마다 가로세로 비가 크게 다르다 (dudu 1.37 ~ ddori 0.78). 상자를
   * 21 x 25 로 두면 가로로 넓은 두두·모아가 폭에 걸려 작게 들어간다. 정사각
   * 상자에 contain 으로 담아, 어떤 비율이든 상자를 꽉 채우게 한다.
   *
   * 30 은 36 x 36 / radius 9 마스크에 모서리가 안 닿는 최대 정사각이다 —
   * 31 부터는 둥근 모서리에 걸린다.
   */
  character: {
    width: s(30),
    height: s(30),
  },
  content: {
    flex: 1,
    marginLeft: s(6.83),
    marginTop: s(-1),
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
  },
  title: {
    flexShrink: 1,
    fontFamily: fontFamily.bold,
    fontSize: fs(8),
    lineHeight: fs(10.8),
    color: colors.textPrimary,
  },
  chip: {
    paddingHorizontal: s(5),
    paddingVertical: s(2),
    borderRadius: s(4),
  },
  chipText: {
    fontFamily: fontFamily.semibold,
    fontSize: fs(5.6),
    lineHeight: fs(7.56),
  },
  preview: {
    marginTop: s(2.9),
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8.1),
    color: '#AEAEAE',
  },
  metaRow: {
    marginTop: s(1.9),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
  },
  stack: {
    flexDirection: 'row',
  },
  stackItem: {
    width: s(14.644),
    height: s(13),
    borderRadius: s(999),
    borderWidth: s(1),
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackOverlap: {
    // 시안은 10.1 간격으로 겹친다
    marginLeft: s(-4.5),
  },
  stackInitial: {
    fontFamily: fontFamily.bold,
    fontSize: fs(6),
    lineHeight: fs(8),
    color: colors.textOnAccent,
  },
  meta: {
    flexShrink: 1,
    fontFamily: fontFamily.semibold,
    fontSize: fs(5.6),
    lineHeight: fs(7.56),
  },
  right: {
    paddingRight: s(6),
    paddingLeft: s(4),
  },
  time: {
    fontFamily: fontFamily.body,
    fontSize: fs(5.8),
    lineHeight: fs(7.83),
    color: '#9E9E9E',
  },
});
