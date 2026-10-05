# 2026-10-02 Android 에뮬레이터 검증

## 환경과 범위

- Android Studio SDK의 `Pixel_7` AVD, Android 15/API 35, x86_64, 1080×2400.
- 이전 작업에서 생성·설치한 `com.mealchat.app` 디버그 APK로 실행했다.
- 실제 `src/screens/chat/ChatRoomScreen.tsx`, 키보드 처리, 폰트, 말풍선, 이모티콘 컴포넌트를 사용했다. Auth·방 데이터·송수신은 `tmp/android-verification/`의 로컬 fixture로 대체했다.
- 초기 메시지 1,000개, 전송 지연 6초, 다음 요청 실패를 주입했다. 원격 Supabase 접근은 fixture에서 예외를 발생시키도록 차단했다. 운영 데이터에는 쓰지 않았다.
- 개발 서버는 테스트 프로세스의 loopback 바인딩과 `adb reverse tcp:8091 tcp:8091`로 연결했다. `.env` 자동 로드는 껐다. 에뮬레이터의 React Native 개발 서버 주소만 `localhost:8091`로 설정했다.

## 확인한 동작

| 시나리오 | 관찰 결과 | 로컬 증거 |
|---|---|---|
| 시작·긴 대화 | 화면이 열리고 최신 `history-0999`가 보임. 과거 `history-0972`까지 스크롤하고 최신으로 돌아옴 | `loaded.png`, `incoming-scrolled.xml`, `incoming-latest.png` |
| 키보드 | Gboard 첫 실행 안내를 닫은 뒤 입력창·전송 버튼이 키보드 위에 표시됨. 입력 필드의 화면 좌표는 `[215,1404][773,1443]` | `keyboard-clean.png`, `send-ready.xml` |
| 연속 전송·입력 보존 | `preserve` 전송 버튼을 두 번 누르고 `next`를 입력. 요청 수는 2→3 한 건만 증가. 완료 후 말풍선은 `preserve`, 입력은 `preservenext`로 보존됨 | `preserve-pending.xml`, `preserve-result.xml`, `preserve-result.png` |
| 실패·재시도 | `retrycase` 전송 실패 안내가 표시되고 입력 유지. 안내를 닫고 두 번 눌러 재시도해 한 건만 성공. 최종 요청 2, 성공 1, 실패 1, 대기 0 | `failure-result.png`, `retry-draft.xml`, `retry-success.xml` |
| 과거 대화 중 수신 | `incoming-1`, `incoming-2` 추가 후 과거 `history-0972`~`0982`를 계속 보고 있음. 최신으로 이동한 뒤 수신한 `incoming-3`는 최신 위치에 표시됨 | `incoming-scrolled.xml`, `incoming-away.xml`, `incoming-latest.xml` |
| 이모티콘 | 두 선택을 연속 입력했을 때 요청은 한 건만 증가. 완료 후 이미지가 렌더되고 기존 초안은 유지됨 | `sticker-pending.xml`, `sticker-result.xml`, `sticker-visible.png` |
| 개발 서버 파일 변경 | fixture 파일을 수정한 뒤 재번들 및 화면 재시작 성공. Expo CLI가 종료되지 않음 | 이 세션의 Metro 출력: `Android Bundled 73ms index.js (1 module)` |

위 증거 파일은 Git에서 제외된 `tmp/android-verification/` 아래에 있다. 서버 호출과 네트워크 지연은 모의 응답이므로 Auth·RLS·실제 송수신·네트워크 재연결 E2E 성공을 의미하지 않는다.

## 발견한 제한과 후속 확인

- 최초 검증에서 **키보드가 열린 상태에서 이모티콘을 전송하고, 완료 전에 키보드를 닫으면 새 스티커가 화면 아래에 일부만 보이는 문제**를 관찰했다. `sticker-result.png`와 `sticker-visible.png`는 최초 문제의 증거다. 이후 아래 수정·재검증으로 해당 조건에서 해결을 확인했다.
- 개발 모드에서 `VirtualizedList: You have a large list that is slow to update` 경고가 한 번 기록됐다(`runtime-log.txt`). `dt=18538`, `prevDt=55811`은 이벤트 간격이며 프레임 처리 시간이나 FPS 측정치가 아니다. 이 실행만으로 성능 향상률·안정적인 60FPS를 주장하지 않는다.
- 이번 실행은 디버그 APK와 로컬 fixture에 한정한다. 전체 앱 로그인·AI 추천·정산, 실제 기기, iOS 실행과 릴리스 성능 검증은 포함하지 않는다.

## Metro 호환 처리와 검사

이전 작업에서 추가한 `metro.config.js`와 `scripts/metro-watch-compat.cjs`를 확인했다. `@expo/cli@54.0.27`와 `metro-file-map@0.83.8` 조합에만 이전 `eventsQueue` 뷰를 공급하며, 새 `changes` 객체는 보존한다. 관련 회귀 테스트는 새 형식 변환, 기존 형식 보존, 반복 설치, CLI 관찰자·리스너 해제를 검증한다. Expo/Metro 업그레이드 시 이 임시 처리도 재검토해야 한다.

- `npm run quality`: 최종 종료 코드 0. **41개 모음, 357개 테스트**, 타입·린트·에셋·Expo 버전 검사 통과.
- 첫 실행은 Expo 사용자 캐시 접근 제한 `EPERM`으로 멈췄다. 동일 검사를 캐시 접근 권한으로 재실행해 전체 통과했다.
- 감사는 `node-forge` 권고의 취약점 기록 4건을 **2026-10-09 만료 임시 예외 1개**로 처리해 통과했다. 취약점 0건이 아니다.
- `git diff --check`: 통과. 기존 문서·SQL·테스트 수정은 보존했다.
- 저장된 UI XML에 대한 증거 검사 12개도 통과했다. 이는 해당 실행 결과의 일치 검사이며, 앱 자동 E2E 테스트를 새로 구축한 것은 아니다.

이번 재개에서는 검증 fixture의 표시 순서만 조정하고 이 문서를 추가했다. 앱 코드·의존성·감사 예외는 추가 변경하지 않았다. 커밋·푸시·배포·원격 데이터 변경은 하지 않았다.

검증 후 이 세션의 Metro 서버는 종료했다. 다시 실행하려면 로컬 fixture 서버와 ADB reverse 연결이 필요하다.

## 후속 수정과 재검증

사용자의 남은 문제 처리 요청에 따라 `ChatRoomScreen.tsx`와 `tests/chatRoom.test.js`를 수정했다. 기존 `onScroll`은 native 목록 위치 보정까지 사용자의 과거 대화 이동으로 처리했고, 키보드가 닫힐 때 최신 위치를 복원하지 않았다. 이제 드래그·관성 스크롤 중에만 최신 위치 여부를 갱신한다. 사용자 스크롤 중에는 강제 이동하지 않으며, 최신 대화를 보던 상태라면 키보드·목록 크기 변경 후 offset 0을 유지한다.

- 회귀 테스트: native 위치 보정 후 최신 위치 유지, 드래그로 이동한 과거 대화 보존, 관성 스크롤 이후 과거 대화 보존. 채팅 테스트 15개 통과.
- 에뮬레이터 재현: 키보드와 이모티콘 패널을 열고 스티커 전송 후 6초 지연 완료 전에 키보드를 닫았다. `fix-pending3.xml`에서 요청 1·대기 1을 확인했다. 완료 후 추가 스크롤 없이 스티커 전체가 표시됐다(`fix-result3.png`, 성공 1·대기 0).
- 과거 대화 보존: 과거 대화로 이동한 뒤 키보드를 열고 닫고 `INCOMING`으로 메시지를 추가했다. `fix-history-before.xml`과 `fix-history-after.xml`의 `history-0975`~`0985` 텍스트·좌표가 모두 동일했다. 예: `history-0984`는 `[218,1816][425,1865]`로 유지됐다. 키보드가 열린 중간 상태에서도 최신 메시지로 강제 이동하지 않았다.
- 최종 `npm run quality`: 종료 코드 0, **41개 모음·359개 테스트** 및 타입·린트·에셋·Expo·감사 검사 통과. 감사 예외는 기존 2026-10-09 만료 항목 그대로다.
- `git diff --check` 통과. 원격 데이터·설정·의존성·감사 예외는 변경하지 않았다. 커밋·푸시·배포하지 않았다.

이 재검증은 Android 디버그 실행과 로컬 fixture 범위다. 위 개발 모드 성능 경고는 프레임 성능의 결함 판정 근거로 사용하지 않으며, 릴리스 FPS 측정은 여전히 별도 과제다.
