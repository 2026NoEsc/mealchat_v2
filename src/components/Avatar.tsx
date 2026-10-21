import {
  Image,
  StyleSheet,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { characterIndexOf } from '../lib/defaultAvatar';

/*
 * 사진을 안 올린 사람에게 보여 줄 기본 캐릭터 — 시안 2179:642 (노랑·주황·파랑·초록).
 * 사람마다 하나가 정해져 계속 같은 얼굴이 나온다 (characterIndexOf).
 */
const DEFAULT_CHARACTERS = [
  require('../../assets/profile/profile-yellow.png'),
  require('../../assets/profile/profile-orange.png'),
  require('../../assets/profile/profile-blue.png'),
  require('../../assets/profile/profile-green.png'),
];

/**
 * 기본 캐릭터 하나를 골라 준다.
 *
 * Avatar 로 그리기 어려운 자리(홈 카드의 겹친 얼굴 칩처럼 동그라미가 아닌 칸)
 * 에서도 같은 얼굴을 쓰기 위해 내보낸다. seed 는 사람을 가리키는 값이어야 한다 —
 * 방마다 다른 값(멤버 행 id)을 주면 같은 사람이 방마다 다른 얼굴로 보인다.
 */
export function defaultCharacterFor(seed: string) {
  return DEFAULT_CHARACTERS[characterIndexOf(seed, DEFAULT_CHARACTERS.length)];
}

type Props = {
  name: string;
  url?: string | null;
  size: number;
  radius?: number;
  /**
   * 기본 캐릭터를 고를 씨앗. 사람을 가리키는 값(프로필 id)을 넣으면 이름을 바꿔도
   * 얼굴이 그대로다. 없으면 이름으로 고른다.
   */
  seed?: string;
  style?: StyleProp<ViewStyle & ImageStyle>;
};

/**
 * 아바타 하나를 그리는 곳.
 *
 * 사진이 있으면 사진, 없으면 기본 캐릭터다. 화면마다 따로 만들던 것을 모아 둔다 —
 * 업로드가 생기면서 두 갈래를 모든 곳에서 다뤄야 한다.
 *
 * 뒤에 바탕색을 깔지 않는다. 사진도 기본 캐릭터도 귀퉁이가 투명해서, 색을 깔면
 * 그 색이 귀퉁이로 비쳐 테두리처럼 보인다 (avatar_color 가 초록인 계정에서 초록
 * 테두리로 보였다). 칸에 바탕이 필요한 화면은 style 로 직접 넘긴다.
 */
export default function Avatar({ name, url, size, radius, seed, style }: Props) {
  const box = {
    width: size,
    height: size,
    borderRadius: radius ?? size / 2,
  };

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={[styles.image, box, style as StyleProp<ImageStyle>]}
        resizeMode="cover"
        // 사진이 뜨기 전까지 색이 보여 빈 사각형이 깜빡이지 않는다
        accessibilityLabel={`${name} 프로필 사진`}
      />
    );
  }

  /*
   * 예전에는 avatar_color 원에 이름 첫 글자를 넣었다. 시안이 기본 캐릭터로 바뀌어
   * 그림을 쓴다 — 그림에 옅은 원이 이미 들어 있다.
   */
  const character = DEFAULT_CHARACTERS[characterIndexOf(seed ?? name, DEFAULT_CHARACTERS.length)];

  return (
    <Image
      source={character}
      style={[styles.image, box, style as StyleProp<ImageStyle>]}
      resizeMode="cover"
      accessibilityLabel={`${name} 기본 프로필 그림`}
    />
  );
}

const styles = StyleSheet.create({
  image: {
    overflow: 'hidden',
  },
});
