import { TextStyle } from 'react-native';

/**
 * Figma 는 42dot Sans 를 쓴다. expo-font 로 배포되는 여섯 굵기(300~800)를 모두
 * 번들해 두고 ([App.tsx](../../App.tsx)), 굵기마다 파일이 다르므로 fontWeight 가 아니라
 * fontFamily 로 고른다 — React Native 는 커스텀 폰트에서 fontWeight 로 파일을
 * 골라 주지 않는다.
 *
 * 이름이 숫자로 시작하면 안 된다. CSS 식별자 규칙상 `42dotSans-Regular` 는
 * 따옴표 없이 쓸 수 없는데 React Native Web 은 따옴표 없이 내보내서, 웹에서
 * 폰트 지정이 통째로 무시된다. 그래서 `Dot42Sans-` 로 시작한다.
 */
export const fontFamily = {
  light: 'Dot42Sans-Light',
  regular: 'Dot42Sans-Regular',
  medium: 'Dot42Sans-Medium',
  semibold: 'Dot42Sans-SemiBold',
  bold: 'Dot42Sans-Bold',
  extrabold: 'Dot42Sans-ExtraBold',

  /** 본문 기본 굵기 */
  body: 'Dot42Sans-Regular',
  /**
   * 로고 워드마크. 시안(AppHeader I2111:15295;46:16)은 Iosevka Charon Bold 다.
   * 배포본이 없는 줄 알고 42dot ExtraBold 로 때웠는데, jul-sh/iosevka-charon
   * 에 OFL 로 공개돼 있어 그대로 번들했다.
   */
  wordmark: 'IosevkaCharon-Bold',
} as const;

/**
 * 굵기 값은 웹에서만 의미가 있다. 네이티브에서는 위 fontFamily 가 굵기를
 * 결정하므로, 이미 굵은 파일에 fontWeight 를 또 얹지 않는다.
 */
export const weight = {
  light: '300',
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const satisfies Record<string, TextStyle['fontWeight']>;
