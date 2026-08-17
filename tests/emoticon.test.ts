import {
  isEmoticonMessage,
  normalizeStickerId,
  parseEmoticonToken,
  previewText,
  toEmoticonToken,
} from '../src/lib/emoticon';

describe('parseEmoticonToken', () => {
  it('토큰에서 이름을 뽑는다', () => {
    expect(parseEmoticonToken('[emoticon:dudu-shock]')).toBe('dudu-shock');
  });

  it('운영 데이터의 언더스코어를 앱 규칙인 하이픈으로 맞춘다', () => {
    // 실제 운영 메시지가 이 형태로 들어 있다
    expect(parseEmoticonToken('[emoticon:dudu_shock]')).toBe('dudu-shock');
    expect(parseEmoticonToken('[emoticon:welling_thumbs]')).toBe('welling-thumbs');
  });

  it('앞뒤 공백을 허용한다', () => {
    expect(parseEmoticonToken('  [emoticon:moa-busy]  ')).toBe('moa-busy');
  });

  it('일반 메시지는 null', () => {
    expect(parseEmoticonToken('안녕하세요')).toBeNull();
    expect(parseEmoticonToken('')).toBeNull();
  });

  it('토큰이 문장에 섞여 있으면 이모티콘으로 보지 않는다', () => {
    expect(parseEmoticonToken('이거 [emoticon:dudu-love] 봐')).toBeNull();
  });

  it('닫히지 않았거나 형식이 틀리면 null', () => {
    expect(parseEmoticonToken('[emoticon:dudu-love')).toBeNull();
    expect(parseEmoticonToken('[emoticon:]')).toBeNull();
    expect(parseEmoticonToken('[sticker:dudu-love]')).toBeNull();
  });
});

describe('normalizeStickerId', () => {
  it('대문자와 언더스코어를 정리한다', () => {
    expect(normalizeStickerId('DUDU_Shock')).toBe('dudu-shock');
  });
});

describe('previewText', () => {
  it('목록에서는 토큰 대신 사람이 읽는 말로', () => {
    expect(previewText('[emoticon:dudu_shock]')).toBe('이모티콘을 보냈어요');
  });

  it('일반 메시지는 그대로', () => {
    expect(previewText('점심 뭐 먹지')).toBe('점심 뭐 먹지');
  });
});

describe('toEmoticonToken', () => {
  it('보낼 때 쓰는 형태를 만든다', () => {
    expect(toEmoticonToken('moa-sleep')).toBe('[emoticon:moa-sleep]');
  });

  it('만든 토큰을 다시 읽을 수 있다', () => {
    expect(parseEmoticonToken(toEmoticonToken('ttori-angry'))).toBe('ttori-angry');
  });

  it('isEmoticonMessage 와 일관된다', () => {
    expect(isEmoticonMessage(toEmoticonToken('welling-eat'))).toBe(true);
    expect(isEmoticonMessage('밥 먹자')).toBe(false);
  });
});
