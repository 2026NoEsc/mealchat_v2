/**
 * Figma 변수(get_variable_defs)와 실제 화면에서 추출한 값.
 *
 * 주의: Figma의 `Design System` 페이지에는 Teal 계열 팔레트가 남아 있으나
 * 실제 Application UI 화면은 전부 오렌지/앰버 계열을 쓰고 있어 후자를 기준으로 한다.
 */
export const colors = {
  /** 브랜드 메인 (#f90) */
  primary: '#FF9900',

  /** AccentButton 그라디언트 */
  accentGradient: ['#F66F3E', '#F6C53E'] as const,
  accentGradientLocations: [0.25962, 0.9375] as const,

  /** Figma 변수 warning/200 — RoomCard 좌측 보더, 상태 배지 */
  warning200: '#EF9F27',
  /** Figma 변수 danger/solid — 미읽음 배지, DangerButton */
  danger: '#F53942',

  /** Figma 변수 text/primary */
  textPrimary: '#000000',
  /** Figma 변수 text/muted */
  textMuted: '#9C9C9C',
  /** Figma 변수 text/onAccent */
  textOnAccent: '#FFFFFF',

  /** Figma 변수 border/default */
  border: '#E6E6E6',
  /** Figma 변수 bg/card */
  card: '#FFFFFF',

  /** 헤더 / 하단 네비 / 카드 배경 */
  surface: '#F3F3F3',
  /** 프로필 화면처럼 카드가 얹히는 한 단계 어두운 배경 */
  surfaceSunken: '#E6E6E6',
  /** 오렌지 틴트 (프로필 아바타 박스, "설정하기" 배지) */
  primarySoft: '#F7EFE6',
  /** 로고 칩, 프로필 썸네일 배경 */
  surfaceStrong: '#E6E6E6',
  /** 알림 벨 글리프 */
  iconMuted: '#8F8F8F',

  screen: '#FFFFFF',
} as const;

/** Figma radius 값 (스케일 전 원본) */
export const radii = {
  button: 10,
  buttonOutline: 8,
  card: 9.936,
  badge: 3.726,
  chip: 5,
  pill: 999,
} as const;

/**
 * Figma drop shadow → RN 스타일.
 * elevation은 Android 대응용 근사치.
 */
export const shadows = {
  /** 0px 4px 4px rgba(0,0,0,0.1) — AppHeader, BottomNav */
  bar: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  /** 0px 1px 4px rgba(0,0,0,0.1) — CompleteButton, AddButton */
  button: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  /** 0px 0px 4px rgba(169,169,169,0.25) — AccentButton */
  accent: {
    shadowColor: '#A9A9A9',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  /** 0px 0px 1.242px rgba(169,169,169,0.25) — RoomCard */
  card: {
    shadowColor: '#A9A9A9',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 1.242,
    elevation: 1,
  },
} as const;
