import { Platform, TextStyle } from 'react-native';

/**
 * Figma는 Pretendard / 42dot Sans / Iosevka Charon 을 쓰지만
 * 원본 저장소 의존성에 expo-font 가 없어 웨이트만 맞춘 시스템 폰트로 대응한다.
 * 웹폰트를 번들링하려면 expo-font 추가 후 이 파일의 fontFamily만 교체하면 된다.
 */
const sans = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });

export const weight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const satisfies Record<string, TextStyle['fontWeight']>;

export const fontFamily = {
  /** 본문 (Pretendard / 42dot Sans 대응) */
  body: sans,
  /**
   * 로고 워드마크 (Iosevka Charon 대응).
   * monospace 폴백은 자간이 크게 벌어져 원본과 어긋나므로 굵은 산세리프를 쓴다.
   */
  wordmark: sans,
} as const;
