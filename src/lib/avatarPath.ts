/**
 * 아바타 경로 계산. supabase 클라이언트를 import 하지 않는다 —
 * 네이티브 모듈 없이 테스트할 수 있어야 한다.
 */

export const AVATAR_BUCKET = 'avatars';

/** 버킷의 allowed_mime_types 와 맞춰 둔다 — 서버가 한 번 더 거른다 */
const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/**
 * 업로드 경로. 첫 칸이 uid 여야 Storage 정책을 통과한다.
 *
 * 파일명에 시각을 넣어 매번 새 경로가 되게 한다. 같은 이름을 덮어쓰면 CDN 과
 * 기기 캐시에 옛 사진이 남아, 바꿨는데 안 바뀐 것처럼 보인다.
 */
export function avatarPath(userId: string, mimeType: string, now: number = Date.now()): string {
  const extension = EXTENSION_BY_MIME[mimeType] ?? 'jpg';
  return `${userId}/${now}.${extension}`;
}

export function isSupportedAvatarType(mimeType: string | null | undefined): boolean {
  return typeof mimeType === 'string' && mimeType in EXTENSION_BY_MIME;
}

/** 공개 URL 에서 버킷 내부 경로를 되찾는다. 내 폴더가 아니면 건드리지 않는다. */
export function avatarPathFromUrl(url: string | null, userId: string): string | null {
  if (!url) return null;

  const marker = `/${AVATAR_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;

  const path = url.slice(index + marker.length).split('?')[0];
  return path.startsWith(`${userId}/`) ? path : null;
}
