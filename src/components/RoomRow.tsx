import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { roomCharacterFor } from '../lib/roomCharacter';

import { defaultCharacterFor } from './Avatar';

import { remainingLabel, roomStatus, timeLabel } from '../lib/roomFormat';
import { previewText } from '../lib/emoticon';
import type { RoomStage, RoomSummary } from '../lib/rooms';
import { roomColor } from '../lib/roomTheme';
import { fs412, s412 } from '../theme/scale';
import { colors } from '../theme/tokens';
import { fontFamily } from '../theme/typography';

/** 겹쳐 보여 주는 참가자 얼굴 수. 넘치는 사람은 "+N" 으로 센다. */
const STACK_LIMIT = 3;

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
 * 약속 단계마다 카드 톤이 다르다. 시안이 준 것은 진행중(2169:803, 주황)
 * 하나뿐이라 나머지는 그 흐름에 맞춰 골랐다. 아직 내가 움직여야 하는
 * 단계일수록 진하고, 끝난 단계는 옅다.
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
 * 홈의 밥약 한 줄 — 시안 2169:802 (390 x 100).
 *
 * 크기는 새 시안을 따르되, 글 배치는 예전 흐름 배치를 그대로 쓴다. 시안의
 * 절대 좌표를 옮기면 제목(y11) 이 얼굴 윗선(y19) 보다 위에서 시작해 글
 * 덩어리가 떠 보였다. 글 열을 얼굴 높이에 맞춰 위아래로 채우면 제목은
 * 얼굴 윗선에, 얼굴 줄은 얼굴 아랫선에 맞는다.
 */
export default function RoomRow({
  room,
  unreadCount = 0,
  onPress,
}: {
  room: RoomSummary;
  /**
   * 안 읽은 메시지 수. 아직 방별 읽음 표시를 저장하는 곳이 없어 아무도
   * 넘기지 않는다 — 0 이면 배지를 그리지 않으므로 없는 수를 지어내지 않는다.
   */
  unreadCount?: number;
  onPress: () => void;
}) {
  /* 기한이 지난 방은 단계와 상관없이 눌러 둔다 */
  const tone = roomStatus(room) === 'expired' ? EXPIRED : TONE[room.stage];
  /* 왼쪽 막대와 얼굴 칩은 방마다 다른 테마 색을 쓴다 */
  const theme = roomColor(room);

  const shown = room.participants.slice(0, STACK_LIMIT);
  const overflow = room.participants.length - shown.length;
  const remaining = remainingLabel(room.expiresAt, room.stage === 'done');
  /*
   * 시안은 "+1 · 12시간 남음". 사람이 셋을 넘지 않으면 "+N" 이 없어 줄이 비는데,
   * 그러면 몇 명인지 알 수가 없다 — 넘치지 않을 때는 전체 인원을 적는다.
   */
  const count = overflow > 0 ? `+${overflow}` : `${room.participants.length}명`;
  const meta = [count, remaining].filter(Boolean).join(' · ');

  return (
    <Pressable style={[styles.card, tone.card]} onPress={onPress}>
      <View style={[styles.themeBar, { backgroundColor: theme }]} />

      {/* 큰 얼굴은 방마다 고정된 캐릭터다 — 사진은 아래 참가자 줄에만 쓴다 */}
      <View style={[styles.avatar, { backgroundColor: `${theme}24` }]}>
        <Image source={roomCharacterFor(room.id)} style={styles.character} resizeMode="contain" />
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

        <View style={styles.stackRow}>
          {shown.map((participant, i) => (
            <View key={participant.id} style={[styles.stack, i > 0 && styles.stackOverlap]}>
              {participant.avatarUrl ? (
                <Image
                  source={{ uri: participant.avatarUrl }}
                  style={styles.photo}
                  resizeMode="cover"
                  accessibilityLabel={`${participant.name} 프로필 사진`}
                />
              ) : (
                /*
                 * 사진을 안 올린 사람은 프로필 기본 캐릭터다 — 프로필·채팅방과
                 * 같은 얼굴이어야 같은 사람으로 보인다. 멤버 행 id 는 방마다
                 * 달라 사람을 가리키는 profileId 로 고른다.
                 */
                <Image
                  source={defaultCharacterFor(participant.profileId ?? participant.id)}
                  style={styles.stackFace}
                  resizeMode="contain"
                />
              )}
            </View>
          ))}
          {meta ? (
            <Text style={[styles.meta, { color: tone.meta }]} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.right}>
        <Text style={styles.time} numberOfLines={1}>
          {room.lastMessage ? timeLabel(room.lastMessage.createdAt) : ''}
        </Text>

        {unreadCount > 0 ? (
          <View style={[styles.unread, { backgroundColor: theme }]}>
            <Text style={styles.unreadText} numberOfLines={1}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /* 위아래 여백 18 씩 — 100 에서 얼굴 64 를 빼면 딱 나뉜다 */
  card: {
    height: s412(100),
    borderRadius: s412(10),
    borderWidth: s412(1),
    flexDirection: 'row',
    paddingLeft: s412(15.69),
    paddingTop: s412(18),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  /* 막대(66.67) 가 얼굴(64) 보다 조금 길다 — 위아래로 반씩 넘겨 가운데를 맞춘다 */
  themeBar: {
    width: s412(6.72),
    height: s412(66.67),
    marginTop: s412(-1.33),
    borderRadius: s412(999),
  },
  avatar: {
    // 카드 왼쪽에서 36 — 막대(15.69 + 6.72) 다음 자리
    marginLeft: s412(13.59),
    width: s412(64),
    height: s412(64),
    borderRadius: s412(9),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  /*
   * 캐릭터마다 가로세로 비가 크게 다르다 (dudu 1.39 ~ welling 0.61). 정사각
   * 상자에 contain 으로 담아, 어떤 비율이든 잘리지 않으면서 긴 쪽이 같은
   * 크기로 선다. 시안은 53 x 47 인데 여백 넓은 원본에 맞춰 잰 값이라,
   * 여백을 떼어낸 그림에는 칸(64)의 3/4 인 48 이 맞는다.
   */
  character: {
    width: s412(48),
    height: s412(48),
  },
  /* 올린 사진은 상자를 꽉 채운다 — 캐릭터처럼 여백을 둘 이유가 없다 */
  photo: {
    width: '100%',
    height: '100%',
  },
  /*
   * 글 열은 얼굴과 같은 높이를 차지하고 세 줄을 위아래로 벌린다. 줄이
   * 빠져도 (남은 시간이 없는 방) 제목과 얼굴 줄의 자리는 그대로다.
   */
  content: {
    flex: 1,
    height: s412(64),
    marginLeft: s412(12.8),
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s412(4),
  },
  title: {
    flexShrink: 1,
    fontFamily: fontFamily.bold,
    fontSize: fs412(16),
    lineHeight: fs412(20.37),
    color: colors.textPrimary,
  },
  chip: {
    height: s412(18),
    borderRadius: s412(4),
    paddingHorizontal: s412(5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontFamily: fontFamily.semibold,
    fontSize: fs412(10),
    lineHeight: fs412(13.5),
  },
  preview: {
    fontFamily: fontFamily.body,
    fontSize: fs412(10),
    lineHeight: fs412(14.81),
    color: '#AEAEAE',
  },
  stackRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stack: {
    width: s412(29.14),
    height: s412(24.07),
    borderRadius: s412(999),
    borderWidth: s412(1),
    borderColor: colors.card,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  /* 칩 간격 20.17 — 폭 29.14 라 8.97 씩 겹친다 */
  stackOverlap: {
    marginLeft: s412(-8.97),
  },
  stackFace: {
    width: s412(19),
    height: s412(19),
  },
  /*
   * 시안 값(5.6)을 그대로 쓰면 기기에서 5px 도 안 돼 읽을 수가 없다. 시안의
   * 이 글자는 줄어든 컴포넌트 안에 들어 있어 크기가 같이 줄어든 것으로 보고,
   * 옆줄(미리보기·시각)과 같은 10 으로 맞춘다.
   */
  meta: {
    marginLeft: s412(8.96),
    flexShrink: 1,
    fontFamily: fontFamily.semibold,
    fontSize: fs412(10),
    lineHeight: fs412(14.81),
  },
  /* 시각은 제목과 같은 윗선에 둔다 */
  right: {
    paddingLeft: s412(7.5),
    paddingRight: s412(11.2),
    alignItems: 'center',
  },
  time: {
    fontFamily: fontFamily.body,
    fontSize: fs412(10),
    lineHeight: fs412(14.81),
    color: '#9E9E9E',
  },
  unread: {
    marginTop: s412(12),
    width: s412(30),
    height: s412(30),
    borderRadius: s412(999),
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    fontFamily: fontFamily.bold,
    fontSize: fs412(12),
    lineHeight: fs412(14.81),
    color: colors.textOnAccent,
  },
});
