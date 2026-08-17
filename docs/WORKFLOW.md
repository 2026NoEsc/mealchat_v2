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
| 백엔드 | Supabase Auth 기반 구현 완료, 데이터 CRUD 보안 마이그레이션 대기 |

`.npmrc` 에 `legacy-peer-deps=true` 가 필요하다.
`lucide-react-native@0.300.0` 이 React 19 를 peer 로 허용하지 않아서 없으면 설치가 실패한다.

### Supabase 진행 상태 (2026-08-17)

- `src/lib/supabase.ts` 는 publishable key, AsyncStorage 세션, AppState 토큰 갱신을 구성한다.
- `src/auth/` 는 이메일 로그인·회원가입·비밀번호 재설정·딥링크 세션 교환과 가입 초안을 담당한다.
- 원격 `public` 테이블은 권한 상승 문제가 확인되어 직접 CRUD를 연결하지 않는다.
  `supabase/migrations/20260817131934_security_auth_foundation.sql` 에 RLS·권한·프로필
  bootstrap 보정안을 준비했지만, 운영 DB에 적용하려면 별도 명시 승인이 필요하다.

#### 환경 변수는 반드시 정적으로 읽는다 ⚠️

`babel-preset-expo` 는 `process.env.EXPO_PUBLIC_X` **형태의 정적 접근만** 번들에 인라인한다.
`@expo/metro-config` 는 런타임 `process.env` 를 **개발 모드에서만** 채운다.
따라서 `process.env` 를 객체째 넘기거나 동적으로 읽으면 `expo start` 에서는 정상 동작하고
릴리스 빌드에서만 `undefined` 가 되어 앱이 시작조차 못 한다.
`tests/expoPublicEnv.test.ts` 가 이 형태를 소스 레벨에서 막는다.

#### 딥링크와 Dashboard 설정

- 클라이언트는 `flowType: 'pkce'` 여야 한다. auth-js 기본값 `implicit` 에서는
  `signUp` / `resetPasswordForEmail` 이 `code_challenge` 를 보내지 않아
  `exchangeCodeForSession` 이 절대 성공하지 않는다.
- 가입 확인과 비밀번호 재설정은 경로로 구분한다. PKCE 교환 결과가 두 경우 모두
  `SIGNED_IN` 이라 이벤트로는 구분할 수 없다.

  | 흐름 | redirect URL |
  |---|---|
  | 가입 이메일 확인 | `mealchat://auth/callback` |
  | 비밀번호 재설정 | `mealchat://auth/reset` |

  둘 다 Dashboard 의 Auth Redirect URLs 에 등록해야 하고, Expo Go 개발용
  `exp://…/--/auth/callback`·`exp://…/--/auth/reset` 도 함께 등록한다.
- 재설정 링크로 들어오면 `App.tsx` 가 네비게이터 대신
  [NewPasswordScreen](../src/screens/auth/NewPasswordScreen.tsx) 을 띄운다.
  새 비밀번호를 정하기 전에는 본문으로 통과시키지 않는다 — 그러지 않으면
  재설정 링크가 그냥 매직링크 로그인이 되어 버린다.
- Dashboard 에서 leaked-password protection 을 켜야 한다.

#### 마이그레이션 상태

Docker Desktop 이 있으면 `npx supabase start` 로 로컬 스택을 띄우고
`npx supabase db reset` 으로 마이그레이션 전체를 처음부터 재적용해 검증할 수 있다.
`db reset` 에 **`--linked` 를 붙이면 운영 DB가 지워진다.** 로컬 검증에는 절대 붙이지 않는다.

| 파일 | 원격 적용 |
|---|---|
| `20260817000000_remote_schema.sql` (baseline) | 적용됨 (repair 로 기록) |
| `20260817131934_security_auth_foundation.sql` | 적용됨 |
| `20260817144252_terms_consent_records.sql` | 적용됨 |
| `20260817172900_room_invitations.sql` | 적용됨 |
| `20260817173500_private_profile_split.sql` | 적용됨 |

운영 적용 전에 `db dump --data-only` 로 받은 실제 데이터를 로컬 baseline DB 에 복원하고
그 위에 네 건을 `migration up` 으로 돌려 리허설했다. 테이블이 비어 있지 않았기 때문에
(프로필 2, 방 4, 메시지 3, 인증 사용자 4) 반드시 필요한 단계였다.
특히 `profiles.personal_data` 에 키 16 개가 들어 있어서, 컬럼 이동 없이 설계했다면
그대로 사라졌을 값이다. **파괴적 마이그레이션 전에는 이 리허설을 반복한다.**

baseline 은 원격에 이미 존재하던 스키마를 `db dump` 로 보존한 것이라
`migration repair --status applied` 로 실행 없이 기록만 했다.
**대기 중인 네 개는 같은 방식으로 repair 하면 안 된다** — 아직 적용되지 않았으므로
적용됨으로 기록하면 영구히 push 할 수 없게 된다.

`db pull` 은 Docker 가 필요하지만 `db push` 는 필요 없다.

#### 프로필 테이블 세 개의 역할

| 테이블 | 보이는 범위 | 담는 것 |
|---|---|---|
| `public_profiles` | 로그인한 모든 사용자 | `name`, `tag`, `avatar_color`, `avatar_url` |
| `profiles` | 본인만 | 위의 원본 + `created_at`, `updated_at` |
| `profile_private` | 본인만 | 계좌·생년월일·취향·`push_token`·위치·`personal_data` JSONB |

`profile_private` 은 INSERT·DELETE 권한이 없다. 행은 가입 트리거가 만들고
`profiles` 삭제 시 cascade 로 지워진다. UPDATE 도 컬럼 단위로만 열려 있어
`id` 를 바꿔 남의 행을 가져오는 것이 막힌다.

#### 방 참가는 RPC 로만

`participants` 직접 INSERT 권한은 없다. `public.join_room_by_code(code)` 가 코드와
`expires_at` 를 서버에서 검증하고, 호출자 `profiles` 에서 `name` 을 채워 넣는다
(`participants.name` 은 기본값 없는 NOT NULL 이다). 방을 만들면 트리거가 방장을
자동으로 참가자에 넣는다. 나가기는 자기 행 DELETE 정책으로 가능하고,
남을 내보내는 기능은 아직 없다.

#### Dashboard 에서만 되는 설정 ⚠️ 미완

마이그레이션으로도, `supabase config push` 로도 안전하게 할 수 없다.
`config push` 는 설정 하나만 고르는 방법이 없어 `[auth]` 전체를 밀어 넣는데,
그러면 로컬 기준인 `site_url`(localhost)과 `enable_confirmations = false` 가
운영을 덮어써 로그인 자체가 망가진다. 그래서 Dashboard 에서 직접 바꾼다.

**1. Auth Redirect URLs** — Authentication → URL Configuration → Redirect URLs

```
mealchat://auth/callback
mealchat://auth/reset
```

Expo Go 로 개발할 때는 `exp://<주소>:8081/--/auth/callback` 형태도 함께 넣는다.
`npx expo start` 가 찍어 주는 주소를 쓰면 된다.

**이게 없으면 신규 가입의 이메일 확인 링크와 비밀번호 재설정이 동작하지 않는다.**
기존 계정 로그인은 영향이 없어서 증상이 늦게 드러난다.

**2. 유출 비밀번호 차단** — Authentication → Policies → Password Protection 에서
"Check against HaveIBeenPwned" 를 켠다. Security Advisor 가 지적한 항목이다.

두 가지 모두 바꾼 뒤에는 실제로 신규 가입을 해서 확인 메일 링크가 앱으로 돌아오는지
확인한다. 등록된 URL 과 앱이 만드는 URL 이 한 글자라도 다르면 조용히 실패한다.

#### 운영 DB 현재 상태

`anon` 의 테이블 권한은 0 이다 (baseline 에서는 10 개 테이블 전부에 `GRANT ALL`).
남은 `GRANT USAGE ON SCHEMA public TO anon` 은 PostgREST 가 스키마에 닿기 위해
필요한 것이고, 테이블 권한이 없으므로 그것만으로는 아무것도 읽지 못한다.

기존 사용자에게는 `profile_consents` 행이 없다. 어떤 버전에 동의했는지 기록이 없어
일부러 만들지 않았다 — 행이 없는 상태가 "동의 기록 없음"이라는 정확한 사실이다.
로그인 후 현재 버전 동의가 없으면 재동의를 받는 화면이 후속 작업이다.

#### 아직 남은 일

- **Dashboard 설정 두 가지가 남았다.** 아래 "Dashboard 에서만 되는 설정" 참고.
- **이메일 확인이 켜져 있으면 가입 시점에 계좌·생년월일이 저장되지 않는다.**
  `profile_private` 쓰기는 세션을 요구하는데 확인 대기 중에는 세션이 없다.
  사용자 메타데이터로 넘기면 JWT 에 실려 나가므로 그 방법은 쓰지 않는다.
  프로필 수정 화면에서 입력받는 경로를 붙여야 한다.
- `participants` 는 방 참가 시점의 `personal_data` / `schedule` 사본을 갖고 있고
  같은 방 멤버 전원에게 보인다. `dutch_pay_bills` 와 `notifications` 도 계좌번호를
  각자 들고 있다. 무엇을 복사할지 정하는 별도 작업이 필요하다.
- 초대 코드는 대소문자를 구분한다. 무시하게 하려면 `lower(code)` UNIQUE 인덱스가
  먼저 필요한데 기존 코드끼리 충돌하면 생성이 실패하므로 별도 작업이다.
- `EXPO_PUBLIC_GEMINI_API_KEY`, `EXPO_PUBLIC_KAKAO_REST_API_KEY` 는 `.env` 에 있지만
  코드에서 아직 쓰지 않는다. 쓰는 순간 번들에 공개되므로 Edge Function 뒤로 옮긴다.
- `.env` 의 변수명이 `EXPO_PUBLIC_SUPABASE_ANON_KEY` 인데 값은 `sb_publishable_…` 이다.
  fallback 이 있어 동작하지만 `.env.example` 대로 `..._PUBLISHABLE_KEY` 로 바꾸는 편이 맞다.

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

Figma 에 남아 있는 미구현 화면은 **프로필 수정 `309:1086`** 하나뿐이다.
화면별 구성은 [figma-specs.md](./figma-specs.md) 에 정리돼 있다.

추천 순서:

1. **프로필 수정 `309:1086`** — 회원가입 개인정보 입력(`150:121`)과 필드 구성이 거의 같아
   [SignupPersonalScreen](../src/screens/signup/SignupPersonalScreen.tsx) 을 참고하면 된다.
2. **은행 드롭다운 `549:3366`** — 회원가입·프로필 수정이 공유하는 공용 오버레이.
3. **Supabase 데이터 연동** — RLS 하드닝 마이그레이션 승인·적용 후 프로필부터 연결한다.

### 아직 눌러도 아무 일 없는 버튼

| 위치 | 버튼 | 필요한 것 |
|---|---|---|
| 회원가입·프로필 수정 | 은행 칩 | 은행 드롭다운 `549:3366` |
| 로그인 | `아이디 비밀번호 찾기` | Figma 에도 화면 없음 |
| 이모티콘 패널 | `전체 보기 →` | 전체 스티커 목록 화면 없음 |

### 남아 있는 품질 이슈

- `assets/ad/banner-1.png` 가 저해상도 (위 3절 참고)
- Auth 외 Supabase 데이터 미연동 — 모든 도메인 화면은 파일 안 상수 배열로 동작한다
- 일정 추가 STEP 1~3 에 뒤로가기가 없다
