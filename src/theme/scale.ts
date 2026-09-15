import { Dimensions, PixelRatio } from 'react-native';

/**
 * Figma `mealchat` 파일의 화면 프레임 크기. 모든 화면이 220 x 486 으로 통일돼 있다.
 */
export const DESIGN_WIDTH = 220;
export const DESIGN_HEIGHT = 486;

/**
 * 프레임 상단의 상태바(노치) 영역 높이.
 * 노치 ellipse 가 y7~20 에 있고 헤더/타이틀이 y48 부터 시작한다.
 * Figma y좌표에서 이 값을 빼면 SafeArea 기준 오프셋이 된다.
 */
export const DESIGN_STATUS_BAR = 28;

/** Figma 절대 y좌표 → SafeArea 상단 기준 거리 */
export const fromTop = (figmaY: number) => figmaY - DESIGN_STATUS_BAR;

const ratio = Dimensions.get('window').width / DESIGN_WIDTH;

/** Figma 좌표·크기·간격을 기기 폭에 비례해 변환한다. */
export const s = (n: number) => PixelRatio.roundToNearestPixel(n * ratio);

/** Figma 폰트 크기를 변환한다. */
export const fs = (n: number) => PixelRatio.roundToNearestPixel(n * ratio);

/** Figma 백분율 inset을 실제 값으로 변환할 때 사용. */
export const pct = (percent: number, base: number) => s((percent / 100) * base);

/**
 * 새 시안 프레임 (412 x 892).
 *
 * 홈부터 시안이 Android 기준 폭인 412 로 옮겨 갔다. 220 짜리 화면이 아직
 * 많아서 DESIGN_WIDTH 를 바꾸지 않고 변환기를 하나 더 둔다 — 둘 다 화면 폭에
 * 비례하므로 s412(412 기준 값) 과 s(220 기준 값) 은 같은 픽셀을 낸다.
 * 시안 숫자를 그대로 적을 수 있어야 나중에 Figma 와 대조하기 쉽다.
 */
export const DESIGN_WIDTH_WIDE = 412;
export const DESIGN_HEIGHT_WIDE = 892;

const wideRatio = Dimensions.get('window').width / DESIGN_WIDTH_WIDE;

/** 412 프레임의 좌표·크기·간격을 기기 폭에 비례해 변환한다. */
export const s412 = (n: number) => PixelRatio.roundToNearestPixel(n * wideRatio);

/** 412 프레임의 폰트 크기를 변환한다. */
export const fs412 = (n: number) => PixelRatio.roundToNearestPixel(n * wideRatio);
