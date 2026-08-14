# 작업 인계 문서

새 세션에서 이 프로젝트를 이어받을 때 먼저 읽는 문서.
**화면별 좌표·구현 현황은 [figma-specs.md](./figma-specs.md)** 에 있고, 여기에는
**어떻게 작업하는가**(Figma 데이터 확보 방법, 검증 방법, 이미 밟은 지뢰)를 적는다.

---

## 1. 프로젝트 한 줄 요약

Figma 디자인(`xBf3b09D6Bj1dTiCixt25e`)을 React Native 앱으로 옮기는 작업.
기술 스택은 [2026NoEsc/mealchat](https://github.com/2026NoEsc/mealchat) 원본 저장소를 그대로 따른다.

| 항목 | 값 |
|---|---|
| 런타임 | Expo SDK 54.0.36 / React Native 0.81.5 / React 19.1.0 |
| 언어 | TypeScript 5.9 (strict) |
| 아이콘 | `lucide-react-native` + `react-native-svg` |
| 네비게이션 | **라이브러리 없음** — 원본에 react-navigation 계열이 없어 Context 기반으로 직접 구현 |
| 백엔드 | Supabase (아직 미연동) |

`.npmrc` 에 `legacy-peer-deps=true` 가 필요하다.
`lucide-react-native@0.300.0` 이 React 19 를 peer 로 허용하지 않아서 없으면 설치가 실패한다.

---

## 2. Figma 데이터를 얻는 방법 ⚠️ 가장 중요

### 페이지 전체 조회는 실패한다

`get_metadata(nodeId='0:1')` 은 **항상 88279 바이트 지점에서 SSE 응답이 잘려 실패**한다.
재시도해도 동일하다. 서버 측 크기 제한이라 우회할 수 없다.

### 대신 섹션 단위로 조회한다

섹션 ID 7개는 [figma-specs.md](./figma-specs.md) 에 적혀 있다.
`get_design_context(nodeId=<섹션ID>)` 를 호출하면 sparse metadata 로
**하위 프레임의 절대 좌표·크기가 전부** 나온다. 이게 구현의 1차 자료다.

```
get_design_context(fileKey='xBf3b09D6Bj1dTiCixt25e', nodeId='309:1429',
                   excludeScreenshot=true, skillNames='resource:figma-design-to-code')
```

> `get_design_context` 호출 전에 `figma-design-to-code` 스킬을 반드시 먼저 읽어야 한다.
> (`get_figma_skill(uri='skill://figma/figma-design-to-code/SKILL.md')`)

### 섹션 ID 를 잃어버렸다면

Figma 데스크톱 앱에서 `Application UI` 페이지를 열고 **캔버스 클릭 → Ctrl+A** 한 뒤
`get_metadata(fileKey)` 를 호출하면 응답 맨 위에 선택된 노드 목록이 붙어 나온다.
(사용자에게 부탁해야 한다.)

### 색상·텍스트는 렌더 크롭으로 확인한다

metadata 에는 좌표만 있고 **색상·실제 텍스트 내용이 없다**. 그래서 페이지를 통째로
렌더한 뒤 화면별로 잘라서 눈으로 본다.

```
get_screenshot(fileKey='xBf3b09D6Bj1dTiCixt25e', nodeId='0:1', maxDimension=8676)
→ 반환된 URL 을 .figma/full.png 로 다운로드 (git 에서 제외됨)
```

이 렌더는 **Figma 좌표와 1:1** 이다. 따라서 좌표 변환은 덧셈 하나로 끝난다.

```
렌더 좌표 = 캔버스 좌표 + (2816, 1846)
캔버스 좌표 = 섹션의 x/y + 프레임의 x/y
```

검증 예시 — 홈 프레임: 섹션 `2_홈`(-1328, -1208) + 프레임 `309:1064`(22, 49)
= 캔버스 (-1306, -1159) → 렌더 (1510, 687). 실측 (1512.8, 686) 과 일치.

그다음 저장소의 스크립트를 쓴다.

```powershell
# 화면 하나 잘라서 확대 저장 → Read 로 열어본다
./scripts/crop-figma.ps1 -X 1512 -Y 1277 -W 220 -H 486 -Out sched.png -Zoom 3

# 특정 지점 색 뽑기 (가로 스캔해서 최빈색 2개 — 안티에일리어싱 대응)
./scripts/sample-color.ps1 -X0 1665 -X1 1677 -Y 1435
```

---

## 3. 구현 규칙

### 좌표 → 코드

모든 화면 프레임은 **220 × 486**. 상태바(노치) 영역이 상단 28.

- `s(n)` / `fs(n)` ([src/theme/scale.ts](../src/theme/scale.ts)) 이 기기 폭에 비례 변환한다.
  Figma 값을 그대로 넣으면 된다.
- Figma 의 y 좌표에서 **28 을 빼면** SafeArea 기준 오프셋이 된다.
- 절대 배치보다 flex + margin 을 쓰되, **margin 값은 Figma 좌표 차이에서 계산**한다.
  주석으로 근거를 남긴다. 예: `// y230, 광고카드 하단(y222) 에서 8`

### 폰트 크기 추정법

metadata 의 텍스트 박스 `width` 를 글자 수로 나누면 대략 fontSize 가 나온다.
한글은 1글자 ≈ 1em 이다.

> `"오늘 점심팟"` w37, 5글자+공백 → 37 / 5.5 ≈ **6.7** → fontSize 7~7.5

눈대중으로 키우면 반드시 텍스트가 잘린다. 실제로 채팅방 목록에서 한 번 겪었다.

### 색상

[src/theme/tokens.ts](../src/theme/tokens.ts) 에 모은다.
Figma 변수(`get_variable_defs`)로 나오는 건 그대로 쓰고, 나머지는 렌더에서 샘플링한다.

> ⚠️ Figma 의 `Design System` 페이지에는 **Teal 팔레트가 남아 있지만 실제 화면은 전부
> 오렌지/앰버 계열**이다. 디자인 시스템 페이지를 믿으면 안 된다.

### 폰트

디자인은 Pretendard / 42dot Sans / Iosevka Charon 을 쓰지만 원본 저장소에 `expo-font`
가 없어 **웨이트만 맞춘 시스템 폰트**로 대체했다.
번들링하려면 `expo-font` 추가 후 [typography.ts](../src/theme/typography.ts) 의
`fontFamily` 만 바꾸면 된다.

### 에셋

아이콘·이미지는 **반드시 Figma export 를 쓴다**. 직접 그리지 않는다.
- 벡터 아이콘은 export SVG 의 `d` 를 `react-native-svg` `Path` 로 이식
- 이미지는 `get_design_context` 로 URL 을 받아 `assets/` 에 다운로드 (URL 은 7일 만료)

> 예외 1건: `assets/ad/banner-1.png` 는 node ID 접근이 안 돼서 렌더에서 잘라낸 것이라
> 저해상도다. 나중에 Figma 에서 직접 export 해야 한다.

---

## 4. 검증 방법

```powershell
npx tsc --noEmit          # 반드시 통과시킬 것
```

브라우저 확인은 Expo web 을 쓴다. `.claude/launch.json` 에 설정돼 있다.

```
preview_start(name='expo-web')   # 포트 8090, 첫 번들링 60~90초
resize_window(preset='mobile')   # 375x812
```

### 브라우저 조작 시 알아야 할 함정 4가지

1. **스크린샷이 2배로 잘려 보인다.** 좌상단만 나온다.
   → `#root` 에 `transform: scale(0.5)` 를 걸면 전체가 보인다. 아래 `zoom()` 헬퍼 참고.

2. **`computer` 의 ref 클릭이 RNW Pressable 에 안 먹는다.**
   → `javascript_tool` 로 pointerdown/pointerup/click 을 직접 dispatch 해야 한다.

3. **tap 직후 innerText 를 읽으면 이전 화면이 나온다.** React 리렌더 전이다.
   → `await sleep(400)` 후 읽는다.

4. **스크린샷도 한 박자 늦을 때가 있다.** 이상하면 한 번 더 찍어본다.

```js
// 브라우저 콘솔에 붙여넣어 쓰는 헬퍼
window.hit=(n)=>{const r=n.getBoundingClientRect();
  const o={bubbles:true,cancelable:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2,
           pointerId:1,isPrimary:true,pointerType:'mouse',button:0};
  n.dispatchEvent(new PointerEvent('pointerdown',o));
  n.dispatchEvent(new PointerEvent('pointerup',o));
  n.dispatchEvent(new MouseEvent('click',o));};
window.tapText=(t)=>{const el=document.getElementById('root'); if(el) el.style.transform='';
  const n=[...document.querySelectorAll('div,span')]
    .filter(e=>e.children.length===0&&(e.textContent||'').trim()===t).pop();
  if(!n) return 'nf:'+t; hit(n.parentElement); return 'ok';};
window.zoom=()=>{const el=document.getElementById('root');
  el.style.transformOrigin='top left'; el.style.transform='scale(0.5)';
  return document.body.innerText.slice(0,60);};
```

---

## 5. 이미 밟은 지뢰

| 증상 | 원인 / 해결 |
|---|---|
| `flex:1` TextInput 이 211px 로 삐져나옴 | 웹에서 input 의 `min-width:auto` 때문. `minWidth: 0` 추가 |
| 오버레이가 AppHeader 에 가림 | `AppHeader` 가 `zIndex: 2`. 오버레이는 `zIndex: 10` 이상 |
| 워드마크가 "MEAL CHAT" 처럼 벌어짐 | monospace 폴백 자간 문제. 굵은 산세리프 + `letterSpacing: -0.1` |
| npm install ERESOLVE 실패 | `.npmrc` 의 `legacy-peer-deps=true` 누락 |
| 텍스트가 잘리거나 줄바꿈됨 | 폰트를 눈대중으로 키운 것. 텍스트 박스 width 로 역산할 것 |

---

## 6. 날짜 기준 (2026년 8월) — **실제 달력**

요일은 [src/lib/calendar.ts](../src/lib/calendar.ts) 한 곳에서만 계산한다.
화면에 요일을 새로 적을 일이 있으면 **반드시** `weekdayOf(day)` / `formatDate(day)` 를 쓴다.
문자열로 직접 쓰면 또 어긋난다.

기준은 **실제 달력** — `2026-08-01 = 토요일` (`FIRST_COLUMN = 6`).

| 날짜 | 요일 |
|---|---|
| 8/1, 8/8, 8/15, 8/22, 8/29 | 토 |
| 8/12 | 수 |
| 8/13 | 목 |
| 8/21 | 금 |

> ⚠️ Figma 원본은 같은 파일 안에서 요일 표기가 **세 갈래**로 갈려 있다.
> 채팅 구분선 `8/12 (수)` 와 일정 헤더 `8/13 (목)` 만 실제 달력과 맞고,
> 확정 카드·AI 추천의 `8/15 (금)` 과 STEP 2 그리드 `13수` 는 하루 빠르며,
> 일정 캘린더가 1일을 수요일 열에 놓은 건 사흘 빠르다.
> **Figma 의 요일 라벨은 신뢰하지 말고 날짜만 가져와서 계산할 것.**

---

## 7. 다음 할 일

남은 미구현 화면 7개와 각각의 구성은 [figma-specs.md 의 "미구현 화면"](./figma-specs.md) 절에
Figma 렌더 기준으로 정리돼 있다.

추천 순서:

1. **참여 멤버 시트 `553:768`** — 채팅방 액션바의 `멤버` 버튼 핸들러가 비어 있다.
   기존 `BottomSheet` 셸을 그대로 쓰면 되므로 가장 빠르다.
2. **이모티콘 패널 `555:416`** — 입력바 Smile 아이콘에 연결. 스티커 8종 에셋을 새로 받아야 한다.
3. **방 상세정보 `159:604`** — 채팅방 헤더 `⋮` 에 연결.
4. **프로필 하위 3화면** — 프로필 수정 / 정보 공개 범위 / 출발지 설정.
   프로필 홈의 링크 카드 3개가 아직 아무 데도 연결돼 있지 않다.
5. **은행 드롭다운 `549:3366`** — 회원가입·프로필 수정이 공유하는 공용 오버레이.

### 아직 눌러도 아무 일 없는 버튼

화면이 없어서 연결하지 못한 것들. 해당 화면을 만들 때 같이 이어주면 된다.

| 위치 | 버튼 | 필요한 화면 |
|---|---|---|
| 채팅방 헤더 | `⋮` | 방 상세정보 `159:604` |
| 채팅방 액션바 | `멤버` | 참여 멤버 시트 `553:768` |
| 채팅방 입력바 | 스마일 아이콘 | 이모티콘 패널 `555:416` |
| 프로필 | `정보 공개 범위 설정` | 정보 공개 범위 `256:2494` |
| 프로필 | `내 친구 관리` | Figma 에도 화면 없음 |
| 프로필 | `계정 삭제` | 확인 다이얼로그 필요 (파괴적) |
| 회원가입·프로필 수정 | 은행 칩 | 은행 드롭다운 `549:3366` |
| 로그인 | `아이디 비밀번호 찾기` | Figma 에도 화면 없음 |
| 일정 조율 | 월 이동 `‹ ›`, 연필, 메모 박스 | 8월 외 데이터 / 편집 화면 없음 |

> 프로필의 미구현 링크는 `route` 가 없으면 회색 + `disabled` 로 보이게 해 두었다.
> 눌리는데 아무 일도 안 일어나는 것보다 낫다.

### 남아 있는 품질 이슈

- `assets/ad/banner-1.png` 가 저해상도 (위 3절 참고)
- Supabase 미연동 — 모든 화면이 파일 안의 상수 배열로 동작한다
- 일정 추가 STEP 1~3 에 뒤로가기가 없다
