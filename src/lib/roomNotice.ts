/**
 * 채팅방 알림 카드가 실려 오는 규약.
 *
 * messages 는 텍스트 컬럼 하나뿐이라, 이모티콘([emoticon:...])과 같은 방식으로
 * `[notice:종류]상세` 형태를 실어 보낸다. 컬럼을 늘리지 않는 쪽을 택한 이유는
 * 운영 데이터에 이미 평문 시스템 메시지가 쌓여 있어서다 — 토큰이 없는 예전
 * 메시지는 그대로 회색 알약으로 남아야 한다.
 *
 * 제목과 버튼 문구는 저장하지 않고 종류에서 끌어낸다. 문구를 고칠 때 지나간
 * 메시지까지 같이 바뀌어야 하기 때문이다.
 *
 * supabase 를 import 하지 않는다 — 네이티브 모듈 없이 테스트할 수 있어야 한다.
 */

export type NoticeKind = 'schedule' | 'place' | 'settlement';

const TOKEN = /^\s*\[notice:(schedule|place|settlement)\]([\s\S]*)$/;

type NoticeCopy = {
  /** 시안 2111:16086 — 앞뒤로 🎉 가 붙는다 */
  title: string;
  /** 시안 2111:16089 의 배지 */
  action: string;
};

const COPY: Record<NoticeKind, NoticeCopy> = {
  schedule: { title: '일정이 확정됐어요', action: '캘린더에 저장' },
  place: { title: '식당이 정해졌어요', action: '위치 보기' },
  settlement: { title: '정산이 시작됐어요', action: '정산하기' },
};

export type RoomNotice = {
  kind: NoticeKind;
  title: string;
  /** 확정된 시각·식당 이름·1인당 금액처럼 종류마다 다른 한 줄 */
  detail: string;
  action: string;
};

/** 시스템 메시지를 카드로 그릴 수 있으면 내용을, 아니면 null 을 준다. */
export function parseRoomNotice(text: string): RoomNotice | null {
  const match = TOKEN.exec(text);
  if (!match) return null;

  const kind = match[1] as NoticeKind;
  return { kind, detail: match[2].trim(), ...COPY[kind] };
}

export function toRoomNoticeToken(kind: NoticeKind, detail: string): string {
  return `[notice:${kind}]${detail.trim()}`;
}

/**
 * 방 목록 미리보기처럼 카드를 그릴 수 없는 자리에서 쓸 한 줄.
 * 토큰이 아니면 원문을 그대로 돌려준다.
 */
export function noticePreviewText(text: string): string {
  const notice = parseRoomNotice(text);
  if (!notice) return text;
  return notice.detail ? `${notice.title} · ${notice.detail}` : notice.title;
}

/*
 * 서버가 쓰는 평문 이벤트 문장.
 *
 * 알림 카드는 [notice:...] 토큰을 전제로 만들었지만, 실제로 방에 줄을 남기는
 * 것은 서버 RPC(confirm_room_vote, create_room_settlement_impl)이고 이들은
 * 평문을 쓴다. 그래서 토큰은 한 번도 쓰이지 않았고 카드는 늘 회색 알약으로
 * 떨어졌다.
 *
 * 서버 문장을 토큰으로 바꾸는 대신 여기서 알아본다. 마이그레이션 없이 되고,
 * 이미 쌓인 평문도 같이 카드가 된다. 문장이 서버에서 바뀌면 여기 매칭이
 * 빗나가는데, 그때는 카드가 아니라 회색 알약으로 돌아갈 뿐이라 안전하다.
 *
 * `(.+)` 를 greedy 로 두는 것이 맞다. 뒤가 `로 확정했어요` 로 고정돼 있어서
 * 이름 안에 "로" 가 들어가도 (예: "서울로") 마지막 것만 조사로 떼어 낸다.
 */
type PlainRule = {
  pattern: RegExp;
  kind: NoticeKind;
  /** 종류 기본 제목으로 부족할 때만 덮어쓴다 */
  title?: string;
  detail: (match: RegExpExecArray) => string;
};

/** "32000" → "32,000". 서버는 콤마 없이 쓰는데 금액은 끊어 줘야 읽힌다. */
function withThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const PLAIN_RULES: PlainRule[] = [
  {
    pattern: /^일정을 (.+)로 확정했어요$/,
    kind: 'schedule',
    detail: (m) => m[1],
  },
  {
    pattern: /^오늘 메뉴를 (.+)로 확정했어요$/,
    kind: 'place',
    detail: (m) => m[1],
  },
  {
    pattern: /^정산 요청을 시작했어요 · 1인당 (\d+)원$/,
    kind: 'settlement',
    detail: (m) => `1인당 ${withThousands(m[1])}원`,
  },
  {
    pattern: /^정산 요청 내용을 수정했어요 · 1인당 (\d+)원$/,
    kind: 'settlement',
    /* 두 번째 요청을 "시작됐어요" 로 부르면 새 정산이 하나 더 생긴 줄 안다 */
    title: '정산 내용이 바뀌었어요',
    detail: (m) => `1인당 ${withThousands(m[1])}원`,
  },
];

/**
 * 채팅방에서 쓰는 카드 변환. 토큰을 먼저 보고, 없으면 서버 평문을 알아본다.
 *
 * parseRoomNotice 와 나눠 둔 이유는 방 목록 미리보기 때문이다. 거기서는
 * "오늘 메뉴를 조선칼국수 하단점로 확정했어요" 라는 원문이 그대로 읽히는 편이
 * 낫지, "식당이 정해졌어요 · 조선칼국수 하단점" 으로 접힐 이유가 없다.
 */
export function roomNoticeOf(text: string): RoomNotice | null {
  const token = parseRoomNotice(text);
  if (token) return token;

  const trimmed = text.trim();
  for (const rule of PLAIN_RULES) {
    const match = rule.pattern.exec(trimmed);
    if (!match) continue;
    return {
      kind: rule.kind,
      ...COPY[rule.kind],
      ...(rule.title ? { title: rule.title } : null),
      detail: rule.detail(match),
    };
  }

  return null;
}
