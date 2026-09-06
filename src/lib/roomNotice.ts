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
