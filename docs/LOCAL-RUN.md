# 로컬 실행 가이드

앱을 로컬에서 실행하고, 서버 단계(Supabase)를 로컬 스택에서 개발·검증하는 방법입니다.
운영 Supabase 프로젝트에는 이 문서의 어떤 명령도 실행하지 마세요.

## 1. 준비 사항

| 항목 | 요구 사항 | 확인 명령 |
| --- | --- | --- |
| Node.js | 20.19.4 이상 | `node -v` |
| npm | 함께 설치됨 | `npm -v` |
| Git | 저장소 복제용 | `git --version` |
| Docker Desktop | Supabase 로컬 스택 실행용 (서버 단계 작업 시) | Docker 실행 후 `docker info` |
| Supabase CLI | 로컬 DB·함수 실행용 (서버 단계 작업 시) | `npx supabase --version` |
| Android Studio / Xcode | 네이티브 실행 시에만 | — |

Windows에서는 PowerShell과 Git Bash 명령을 섞지 않도록 주의하세요. 아래 명령은 Git Bash 기준입니다.

## 2. 앱 설치와 실행 (UI 확인용)

```bash
git clone https://github.com/2026NoEsc/mealchat_v2.git
cd mealchat_v2
git checkout Develop
npm ci
npm start
```

`npm start`는 실행 전에 `scripts/generate-licenses.mjs`로 라이선스 목록을 자동으로 다시 만듭니다. 결과 파일 `src/legal/licenses.generated.json`이 바뀌면 커밋 전에 확인하세요.

실행 방법:

| 명령 | 용도 |
| --- | --- |
| `npm run web` | 브라우저에서 빠르게 확인 (UI·레이아웃 확인에 가장 편함) |
| `npm run android` | Android 기기 또는 에뮬레이터 (네이티브 모듈 포함 확인) |
| `npm run ios` | iOS 시뮬레이터 (macOS 필요) |
| `npm run tunnel` | 실기기에서 QR 코드로 열 때 (같은 Wi-Fi가 아닐 때) |

웹에서 확인할 때 참고:
- 네이티브 전용 기능(알림 권한, 카메라, 위치, 클립보드 실제 동작)은 웹에서 일부만 동작합니다.
- 실기기 확인이 필요한 항목은 보고서나 PR 설명에 "미검증"으로 따로 적어 두세요.

## 3. 환경 변수 (`.env`)

`.env.example`을 복사해 `.env`를 만듭니다. `.env` 파일은 이미 저장소 로컬에 있으므로 값을 확인만 하고, 절대 커밋하지 마세요.

```bash
cp .env.example .env   # 이미 있으면 덮어쓰지 말 것
```

| 변수 | 설명 | 로컬 서버 단계 작업 시 |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase API 주소 (기본 `https://`) | 개발 빌드에서 아래 opt-in을 켠 경우에만 로컬 HTTP 허용 (4-1 참고) |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 공개 가능한 키(anon 대체) | `npx supabase status`에 나오는 publishable 키 |
| `EXPO_PUBLIC_SUPABASE_ALLOW_LOCAL_HTTP` | 로컬 HTTP 명시적 허용 (기본 `0`) | 로컬 스택에 연결할 개발 빌드에서만 `1` |
| `EXPO_PUBLIC_TMAP_APP_KEY` | Tmap 장소 검색 키 | 실제 키가 있을 때만 장소 검색이 동작 |

규칙:
- `EXPO_PUBLIC_` 접두사가 붙은 값은 앱 번들에 들어갑니다. 공개되어도 되는 값만 넣으세요.
- `service_role` 키, 비밀번호, 토큰, 외부 API의 비밀 키는 `.env`에 넣지 마세요.
- 값을 바꾼 뒤에는 Metro를 재시작하세요(`Ctrl+C` 후 `npm start`). 캐시가 남으면 `npx expo start -c`.

## 4. 로컬 Supabase 스택 (서버 단계 작업)

서버 단계 작업은 반드시 로컬 스택에서 진행합니다. 운영 프로젝트에 마이그레이션을 적용하려면 별도의 명시적 승인이 필요합니다(프로젝트 규칙).

### 4-1. 시작

```bash
docker info                 # Docker가 실행 중이어야 함
npx supabase start          # 첫 실행은 이미지 다운로드로 수 분 걸림
npx supabase status         # API URL, publishable 키 확인
```

`npx supabase status`에서 확인할 값:
- `API URL` → `EXPO_PUBLIC_SUPABASE_URL`에 넣기 (보통 `http://127.0.0.1:54321`)
- `Publishable key` → `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`에 넣기

앱의 `.env`에는 로컬 연결용 변수 3개를 함께 설정하세요. 키 값은 문서에 적거나 공유하지 마세요.

1. `EXPO_PUBLIC_SUPABASE_URL`: PC 웹에서는 `http://127.0.0.1:54321` 또는 `http://localhost:54321`, Android 에뮬레이터에서는 `http://10.0.2.2:54321`을 사용합니다. 실기기는 PC의 사설 LAN IPv4 주소를 사용합니다(예: `http://192.168.0.10:54321`). PC와 기기가 같은 네트워크에 있고 방화벽이 로컬 API 포트 접근을 허용해야 합니다. 기기에서 `localhost`는 PC가 아니라 기기 자신입니다.
2. `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: **같은 로컬 스택**의 공개 키를 넣습니다. 운영 프로젝트 URL·키와 로컬 URL·키를 섞지 마세요.
3. `EXPO_PUBLIC_SUPABASE_ALLOW_LOCAL_HTTP=1`: HTTP 연결을 명시적으로 켭니다. Metro를 재시작하고 개발 빌드(`__DEV__ === true`)로 실행하세요.

HTTP 예외는 개발 빌드 + 정확히 `1`인 opt-in + 승인된 호스트를 모두 만족해야 합니다. 허용 호스트는 `127.0.0.1`, `localhost`, `10.0.2.2`와 사설 IPv4 대역 `10/8`, `172.16/12`, `192.168/16`뿐입니다. 사용자정보가 들어간 URL과 공용 호스트 HTTP는 거부됩니다. 개발 예외를 쓰면 암호화되지 않은 연결임을 콘솔에 한 번 알립니다. 릴리스/운영 빌드는 opt-in과 관계없이 HTTPS만 허용합니다. 로컬 작업을 마치면 opt-in을 `0`으로 되돌리세요.

사설 IP로 연결할 때는 같은 네트워크의 다른 기기로 평문 토큰이 오갈 수 있으니 로컬 테스트 계정만 사용하세요.

### 4-2. 마이그레이션과 로컬 S1 seed 적용

연결 대상이 폐기 가능한 로컬 컨테이너인지 먼저 확인하세요. 다음 명령은 로컬 DB 데이터를 지우고 저장소의 migrations와 seed를 차례로 적용합니다.

~~~bash
npx supabase db reset --local
~~~

- M1~M6 적용 후 config.toml의 [db.seed] enabled=true, sql_paths=["./seed.sql"]에 따라 supabase/seed.sql이 실행됩니다. 별도 M7 주입 플래그가 필요하지 않습니다.
- seed는 네 문서와 번들 version에 local-dev를 표시하며, 로컬 가입·재동의 등 S1 모드 검증용입니다. 동의를 자동 생성하지 않으므로 새 로컬 계정은 앱에서 명시적으로 약관에 동의해야 합니다.
- 배포 전 M7은 supabase/release/20261017100000_s1_activate_terms.sql에 보관합니다. 미확정 파일은 migrations에 넣지 않습니다. 최종 값 확정·이동·배포 검사는 [S1-release.md](S1-release.md)를 따릅니다.
- --no-seed로 reset하면 M7도 없는 현재 개발 상태에서는 문서가 없어 S1006으로 닫힙니다. 일반 앱 확인에는 seed를 생략하지 마세요.
- 일반 원격 push에는 로컬 seed가 포함되지 않습니다. 운영 --include-seed, --linked reset, 원격 --db-url은 사용하지 마세요.
- supabase/deferred_migrations/와 supabase/deferred_tests/는 적용하지 않는 보류 항목입니다. 기존 로컬 데이터가 필요하면 reset 전에 별도로 보관하세요.

현재 저장소의 개발/배포 경계를 읽기 전용으로 확인할 수 있습니다.

~~~bash
node supabase/release/check.mjs --development
npm run quality
~~~

M7이 보류되어 있으면 개발 검사는 통과하면서 배포는 BLOCKED 상태임을 표시합니다. quality에는 M7 존재를 강제하는 검사를 넣지 않습니다. 운영 배포 검사인 npm run release:check는 확정 M7이 없으므로 실패하는 것이 정상입니다. 개발 quality 통과만으로 서버 migration을 운영에 적용하지 마세요.

### 4-3. Edge Function 로컬 실행

추천 기능(`schedule-recommend`)은 외부 AI 키가 필요합니다. 키 값은 채팅이나 문서에 적지 말고 로컬 파일로만 관리하세요.

```bash
npx supabase functions serve schedule-recommend --env-file supabase/functions/.env
```

- `supabase/functions/.env`에는 로컬 테스트용 키만 넣습니다. 이 파일이 `.gitignore`에 들어 있는지 커밋 전에 확인하세요(`git check-ignore -v supabase/functions/.env`).
- 키가 없으면 추천 호출은 실패하고, 앱은 "추천을 불러오지 못했어요" 안내를 보여 줍니다. 이 경우가 정상 동작인지 확인하는 데도 쓸 수 있습니다.

### 4-4. 종료와 초기화

```bash
npx supabase stop                 # 컨테이너 종료 (데이터는 유지)
npx supabase stop --no-backup     # 컨테이너와 로컬 데이터 모두 삭제
```

## 5. 검증 명령

커밋 전에는 다음을 실행합니다.

```bash
npm run quality
```

`quality`가 실행하는 항목:
1. 자산 형식 검사 (`security:assets`)
2. 라이선스 목록 검사 (`prequality`, 쓰지 않고 검사만 함)
3. 타입 검사 (`ts:check`)
4. 린트 (`lint`, 경고도 실패로 처리)
5. 테스트 (`jest`, 현재 약 824개)
6. Expo 패키지 호환성 (`expo install --check`)
7. 의존성 감사 게이트 (`security:audit`, 임시 예외 3건 적용)

개별 실행:

```bash
npx tsc --noEmit
npx eslint src scripts --max-warnings=0
npx jest tests/<파일명>.test.js     # 특정 테스트만
```

## 6. 자주 만나는 문제

| 증상 | 원인과 해결 |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` 검증 오류 | URL 문법·사용자정보 여부를 확인하세요. 로컬 HTTP라면 4-1의 개발 빌드, opt-in `1`, 승인된 로컬 호스트 조건을 모두 확인하세요. 운영 빌드는 HTTPS가 필요합니다. |
| 환경 변수를 바꿨는데 반영 안 됨 | `npx expo start -c`로 캐시 지우고 재시작 |
| `Cannot connect to the Docker daemon` | Docker Desktop 실행 후 재시도 |
| `supabase start` 포트 충돌 | 다른 프로세스가 54321 등을 쓰는 중. `npx supabase stop` 후 재시도 |
| `db reset` 중 마이그레이션 오류 | 해당 파일 번호와 메시지를 보고 알려 주세요. 원격에는 영향 없음 |
| Jest 실패 (AsyncStorage 등) | 테스트 모킹 누락. 해당 테스트 파일과 메시지를 알려 주세요 |
| 웹에서 카메라·알림 동작 안 함 | 웹 한계. 네이티브에서 확인 |

## 7. 커밋 전 체크리스트

- [ ] `npm run quality` 전체 통과
- [ ] `.env`, `supabase/functions/.env`, 키 값이 스테이징 목록에 없음 (`git status`로 확인)
- [ ] `src/legal/licenses.generated.json` 변경 여부 확인 (의존성을 바꾼 경우에만 바뀜)
- [ ] 운영 프로젝트에 명령을 실행하지 않았음
- [ ] 실기기에서만 확인되는 항목은 "미검증"으로 기록

## 8. 참고 파일

| 파일 | 내용 |
| --- | --- |
| `package.json` | 실행·검사 스크립트 |
| `.env.example` | 환경 변수 이름 목록 (값 없음) |
| `supabase/config.toml` | 로컬 Supabase 설정 |
| `supabase/migrations/` | 적용 대상 마이그레이션 |
| `src/lib/supabaseConfig.ts` | 환경 변수 검증 |
| `AGENTS.md` | 프로젝트 작업 규칙 (원격·커밋 승인 규정) |
