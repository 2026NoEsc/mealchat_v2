# 밀챗 (MealChat)

함께 먹을 사람을 찾고, 가능한 시간을 조율하고, 약속 이후의 정산까지 한 흐름으로 연결하는 식사 모임 앱입니다. 
> 현재 화면과 내비게이션은 로컬 데이터로 동작합니다. Supabase 백엔드와 실제 인증·동기화 기능은 아직 연결되지 않았습니다.

## 주요 화면

- 로그인과 단계별 회원가입
- 홈, 알림 패널, 모임 카드
- 개인 일정과 모임 일정 조율
- 일정 추천 및 확정
- 채팅방, 이모티콘 패널, 모임 상세
- 프로필, 친구, 개인정보 설정
- 캘린더·위치·사진·알림 권한을 위한 Expo 플러그인 구성

## 기술 구성

| 구분 | 사용 기술 |
| --- | --- |
| 앱 프레임워크 | Expo SDK 54, React Native 0.81 |
| UI | React 19, TypeScript strict mode |
| 웹 | React Native Web, Metro |
| 아이콘·그래픽 | Lucide React Native, React Native SVG |
| 상태·화면 이동 | React Context 기반 자체 내비게이션 |
| 백엔드 계획 | Supabase — 현재 미연동 |
| 품질 관리 | ESLint 9, Jest, TypeScript, GitHub Actions |

## 시작하기

### 준비 사항

- Node.js 20.19.4 이상
- npm
- 네이티브 Android 실행 시 Android Studio와 Android SDK
- 네이티브 iOS 실행 시 macOS와 Xcode

### 설치 및 실행

```bash
git clone https://github.com/2026NoEsc/mealchat_v2.git
cd mealchat_v2
npm ci
npm start
```

Expo 개발 서버에서 원하는 플랫폼을 선택하거나 다음 명령을 사용할 수 있습니다.

```bash
npm run web       # 웹 개발 서버
npm run android   # Android 네이티브 실행
npm run ios       # iOS 네이티브 실행
npm run tunnel    # 터널 모드 개발 서버
```

## 품질 및 보안 검사

커밋 전에는 다음 통합 검사를 실행합니다.

```bash
npm run quality
```

이 명령은 다음 항목을 순서대로 검사합니다.

1. 취약한 이미지 형식 유입 차단
2. TypeScript 타입 검사
3. ESLint 오류·경고 검사
4. Jest 단위 테스트
5. Expo SDK 의존성 호환성
6. npm 보안 감사 정책

ICNS, JXL, HEIF/HEIC, AVIF 파일은 확장자뿐 아니라 파일 서명으로도 차단합니다. 현재 상위 패키지에서 패치되지 않은 세 GHSA만 만료일이 있는 임시 예외로 관리하며, 새로운 취약점이나 만료된 예외가 발견되면 CI가 실패합니다.

개별 명령은 다음과 같습니다.

```bash
npm run ts:check
npm run lint
npm test -- --ci --runInBand
npm run security:assets
npm run security:audit
```

## 프로젝트 구조

```text
assets/                 이미지와 브랜드 자산
src/components/         공통 UI와 패널
src/lib/                달력 등 순수 로직
src/navigation/         화면 경로와 내비게이션 상태
src/screens/            기능별 앱 화면
src/theme/              색상·크기·타이포그래피 토큰
scripts/                품질·보안 검사 및 Figma 보조 도구
security/               npm 감사 예외 정책
docs/                   구현 인계·Figma·의존성 보안 문서
.github/workflows/      GitHub Actions 품질 게이트
```

## 개발 문서

- [작업 인계 및 구현 규칙](docs/WORKFLOW.md)
- [Figma 화면 명세](docs/figma-specs.md)
- [의존성 보안 정책과 Expo 업그레이드 계획](docs/dependency-security.md)

## 현재 개발 범위

- 구현됨: 주요 화면, 자체 내비게이션, 반응형 스케일, 달력 계산, 로컬 UI 상호작용
- 검증됨: 웹·iOS·Android 번들, Android 디버그 APK, 타입·린트·단위 테스트
- 남은 작업: Supabase 인증·데이터 연동, 실제 사용자·모임 동기화, 기기별 통합 테스트

Expo SDK 업그레이드는 `npm audit fix --force`로 건너뛰지 않고 54 → 55 → 56 → 57 순서로 진행합니다. 자세한 절차는 [의존성 보안 정책](docs/dependency-security.md)에 기록되어 있습니다.
