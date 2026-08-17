/**
 * 메시지에 담기는 이모티콘 토큰.
 *
 * messages 는 텍스트 컬럼 하나뿐이라 스티커를 `[emoticon:이름]` 형태로 실어 보낸다.
 * 운영 데이터에 이미 이 규약으로 들어간 메시지가 있어서 그 형태를 그대로 따른다.
 *
 * 다만 저장된 이름은 `dudu_shock` 처럼 언더스코어인데 앱의 스티커 id 는
 * `dudu-shock` 처럼 하이픈이라 정규화가 필요하다. 앱에 없는 이름
 * (`welling_thumbs` 등)도 실제로 들어 있으므로 못 찾는 경우를 반드시 다뤄야 한다.
 *
 * supabase 를 import 하지 않는다 — 네이티브 모듈 없이 테스트할 수 있어야 한다.
 */

const TOKEN = /^\s*\[emoticon:([A-Za-z0-9_-]+)\]\s*$/;

/** 메시지 전체가 이모티콘 하나면 그 이름을, 아니면 null 을 준다. */
export function parseEmoticonToken(text: string): string | null {
  const match = TOKEN.exec(text);
  return match ? normalizeStickerId(match[1]) : null;
}

/** 저장된 이름을 앱의 스티커 id 규칙(하이픈)으로 맞춘다. */
export function normalizeStickerId(name: string): string {
  return name.trim().toLowerCase().replace(/_/g, '-');
}

export function isEmoticonMessage(text: string): boolean {
  return parseEmoticonToken(text) !== null;
}

/** 목록 미리보기에서는 토큰 대신 사람이 읽을 수 있는 말로 바꾼다. */
export function previewText(text: string): string {
  return isEmoticonMessage(text) ? '이모티콘을 보냈어요' : text;
}

export function toEmoticonToken(stickerId: string): string {
  return `[emoticon:${stickerId}]`;
}
