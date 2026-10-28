# 최신 Phone 프론트 구현 현황

## 후속 완료: 로컬 원본 163개 상태별 검증

- [상태별 실행 근거](figma-phone-state-evidence.md): 원본 **163개 고유 ID 모두 실제 UI assertion 통과**, 상태 근거 누락 0. 기존 상호작용 테스트를 재사용하고 메뉴/영수증/정산/인물/월별 분기에는 노드별 fixture를 추가했다. 정적 파일 대응이나 같은 캡처 복제로 집계하지 않았다.
- 최종 `npm run quality` **1회 실행, 종료 코드 1**. Jest **84 suites / 1,642 tests 전부 통과**, license 24개 확인, development release gate 15/15, 에셋 형식·TypeScript·전체 ESLint 통과. Expo 의존성 검사는 `Dependencies are up to date`로 통과했지만 OFFLINE 경고가 있어 최신 온라인 메타데이터 확인을 뜻하지 않는다. 마지막 `security:audit`만 기존 신규 권고 6개·해결 allowlist 2개로 실패했다. 의존성/allowlist는 수정하지 않았다. 로그: `tmp/phone-app-quality-complete.log`. `EXPO_NO_DOTENV=1`, workspace/tmp의 `__UNSAFE_EXPO_HOME_DIRECTORY`로 격리했다. 전체 quality는 반복하지 않았다.
- 샤브샤브는 로컬 선택을 채팅의 `localMenuName`으로 전달하고 식당 시트와 메뉴 변경에 표시한다. 선택값을 서버 추천 결과나 실제 방 메뉴로 저장하지 않는다. **단계별 UI·route 검증**에서 실제 AppNavigator를 사용하되, 식당 확정 응답·다음 방 상태·반환 bill은 fixture를 주입했다. 단일 서버 E2E 성공으로 주장하지 않는다.
- 정산 취소/수정 준비 콜백은 실제 정산 변경 없이 채팅의 명시적인 준비 안내로 연결했다. 계좌 폼은 `onDraft({bank,account,holder})`로 부모에게 로컬 초안을 전달한 뒤 원래 정산 시트로 돌아온다. 부모에는 은행·끝 4자리만 표시하며 실제 `hasAccount`와 정산 요청 가능 여부는 바꾸지 않는다. 닫기·계정/방 변경 시 초안을 비우고 오래된 콜백을 무시한다. 기존 프로필 계좌 등록 경로 유지.
- 독립 검토의 빈 상태 중복은 실제 총 정산 0건일 때 필터 빈 문구를 숨겨 수정했다. 새 후보 목록 순서는 의견 갈림/재평가에서 통일했다.
- 브라우저는 최신 UI로 375/412 폭 **34장·17고유 노드** 재검증, runtimeErrors/externalRequests/backendRequests 0. 나머지는 캡처 대신 상태별 renderer·상호작용 assertion으로 검증했다. 원본 PNG 미확보 93개와 픽셀 일치 검수 한계는 유지한다.
- 메인 조회 담당의 최신 Figma `get_metadata`/`get_design_context`/screenshot 실제 호출 성공 보고를 수신했다. 최신 전체 XML과 로컬 `tmp/figma-audit/phone-metadata.xml`의 SHA-256은 `de2a291d2e1bbe7f06076fd4e5993fb0ce20a5c498a99c2817090fc94ab21a7d`로 일치하며, 이 작업자가 로컬 해시를 다시 확인했다. 메인 보고 기준 163개 ID/이름/크기의 추가·삭제·변경 0. 최신 시각 context 점검은 메인의 별도 조회 작업에서 진행 중이다. 이번 quality 후속에서는 MCP를 조회하거나 설정하지 않았다.
- 미연결 신고/차단/문의의 성공 문구 추가는 자동 승인 검토가 거절하여 적용하지 않았다. 해당 노드는 실제 처리 성공이 아닌 **연결 대기·요청 미처리·재시도 대응**으로 검증했다. 서버 작업, 의존성, Auth/RLS/RPC, 실제 정산 처리는 변경하지 않았다.
- 메인이 전달한 최종 Gemini 검토는 차단 0이며 163개 상태 근거의 실효 검증도 확인했다. 이 quality 실행에서는 구현 코드를 변경하지 않았으므로 기존 검토와 163개 고유 노드/누락 0 근거를 유지한다. 아래 첫 점검의 ‘146개 미검증’은 후속 상태 검증 이전 기록이다. 최신 Figma에서 확인된 위치 권한 시각 차이는 정확한 context 수신 후 별도 focused 변경/검증으로 구분할 예정이다.

## 2026-10-28 후속 전수대조 — 전체 완료 판정 보류

- 최신 상태별 표는 [Phone 앱 대응표](figma-phone-app-coverage.md)다. 2026-10-20 원본 inventory/frames **163개 ID 집합 일치**, 원본 PNG **70개 확보/93개 미확보**. 원격 Figma 최신 조회는 하지 못했다. 아래 과거 gallery/통합 기록은 과거 검증으로 구분한다.
- 163개 모두 현재 소스 파일에 대응하지만 **상태별 앱 캡처는 17노드/34장(375·412), 나머지 146노드는 이 harness에서 미검증**이다. 큰 섹션 단위 진입과 파일 존재를 화면 완성·누락 0의 증거로 인정하지 않는다.
- 새 후보 `591:2159/2319/2401`: 기존 후보·평가 유지 버그를 수정했다. 샤브샤브·파스타·닭갈비·돈카츠 4개로 교체하고 평가를 초기화하며, 결과·확정에 고른 메뉴를 유지한다. 원본의 건강정보 적용 주장은 연결되지 않아 표시하지 않는다.
- 기록 `542:1633/589:2147/631:6196`: 점심/저녁/샤브샤브의 날짜·장소·4인·품목·금액을 inventory 텍스트에 맞췄다. 모든 항목은 사용자가 켠 로컬 예시다. 샤브샤브 사진은 기존 저녁 예시 사진을 재사용하므로 원본 사진 일치로 판정하지 않는다.
- 정산 목록에 전체/진행 중/완료 필터와 필터 빈 상태를 추가했다. 정산 상세는 직접 입력한 로컬 영수증 초안을 펼침/접기하며, 실제 정산 합계·송금 상태는 변경하지 않는다.
- `590:1869`: 채팅 N빵 정산 → 계좌 등록하기에서 은행·계좌번호·예금주 3필드 전용 폼을 연다. 입력 형태 검증 후 **준비 완료·미저장**으로 표시한다. 기존 프로필 계좌 저장 경로는 별도 버튼으로 보존했다. 초안은 route/로그/서버로 보내지 않고 폼을 닫으면 버린다. 예금주 저장/RPC는 추가하지 않았다.
- 현재 소스 재확인: X01 시작 캐릭터/주황 워드마크/빨간 알림점, X06 초대 6칸/미리보기, 방 나가기 성공→홈 토스트는 이미 구현돼 있어 재작성하지 않았다. X07은 실제 서버가 최신 30건만 조회하므로 ‘최근 30일’ 보장을 새로 넣지 않았다. X11 출발지 공개 원문은 실제 비공개 계약과 충돌하므로 바꾸지 않았다.
- **남은 구현/검증**: 샤브샤브 메뉴→식당→정산의 연속 데이터 전달 및 전체 631 분기 검증, 신고/차단/정산 취소 후 화면의 실제 처리 경계 연결, 모든 163행의 구체적 상태별 진입·렌더·상호작용 증거. 준비 안내를 원본 완료 상태와 동일하다고 판정하지 않는다. 독립 검토는 메인에게 인계할 상태이며 완료되지 않았다.
- 검증: 집중 87개 통과, 전용 계좌 추가 후 chat/settlement 156개 및 localAppFlows 8개 통과. `npm run quality`는 **84 suites/1520 tests 통과**, 에셋/타입/린트 통과 후 기존 `security:audit`의 신규 6개/해결 allowlist 2개로 종료 코드 1. 실행 중 뒤늦게 추가한 계좌 UI의 마지막 타입·린트도 별도로 통과했다. 의존성·allowlist는 수정하지 않았다. Expo 의존성 검사는 OFFLINE 환경이므로 최신 온라인 메타데이터 확인을 보장하지 않는다.
- 브라우저 cold bundle 첫 시도는 빈 화면 시간 초과, 번들 생성 후 재실행 **34장 통과**, runtimeErrors/externalRequests/backendRequests 0. 증거 `tmp/local-app-render/review-metrics.json`, `tmp/phone-coverage.json`, `tmp/phone-app-quality-final.log`. Impeccable 변경 UI 4개 정적 검출 결과 `[]`.
- 작업자 상태 보고 도구는 자동 승인 검토가 ‘재위임’으로 판단해 2회 거절했다. 새 작업자를 생성하지 않았고 이후 해당 전송을 중단했다. 코드·문서 수정과 로컬 검증은 계속했다.

기준: 2026-10-28, HEAD `4f347f7` 위의 로컬 변경. 최신 Figma 파일 `euLZpuvJsmuOhVKwtDkdhJ`, Phone `478:9398`. 메인이 전달한 최신 top-level 목록과 고정밀 `get_design_context` 응답을 사용했다. 메인 보고에 따르면 원본과 로컬 `412-history`, `412-receipt`, `375-contact` 스크린샷의 기본 구조·텍스트·이미지를 확인했다. 픽셀 완전 일치 검수는 아니다. 이 문서는 배포·원격 migration 적용·서버 완성을 주장하지 않는다.

## 전체 목록 기준과 누락

화면은 route 수와 일치하지 않는다. 동일 화면의 시트·선택·오류·완료 상태는 별도 Figma 프레임이지만 하나의 구현으로 표현될 수 있다. 아래는 전달받은 **모든 Phone 섹션** 기준 대조이며, 주석 프레임·토큰 프레임은 화면 수에 넣지 않는다. 기존 화면은 파일·route 존재를 확인한 것으로, 모든 노드의 렌더 일치를 검증한 의미는 아니다.

| 섹션 | 현재 로컬 구현/연결 | 남은 화면·상태 및 구분 |
|---|---|---|
| 00 `493:1038` 토큰·컴포넌트 | `src/components/ui`, 테마 재사용 | 전체 variant별 시각 일치 검수 미완료 |
| 01 `519:1215` 시작·로그인·회원가입 | SignupStart/Login/SignupPersonal/SignupCalendar/SignupTerms, 암호 재설정·재동의·권한 안내 | 이메일 중복 `599:4206` 등 실제 실패 상태의 노드별 검수 필요. 인증 계약 변경 없음 |
| 02 `495:1025` 음식 프로필 | FoodProfileScreen/Form의 단계·선택 상태 | 기존 S5 명세 범위. 서버 동의·저장은 이번 변경 제외 |
| 03 `543:1608` 초대·로딩 | JoinCodeSheet, StartupLoading | 웹 랜딩 `543:1609`는 gallery fixture 구현·최종 캡처 확인. 실제 링크/플랫폼 연결은 별도 제품결정 필요 |
| 04 `521:1247` 홈·알림·정산 | HomeScreen, NotificationsProvider, SettlementsScreen | 알림 모두 읽음/정산 필터 및 삭제·나가기 토스트 노드별 검수 필요 |
| 05 `524:1317` 일정·새 밥약 | ScheduleHome/Detail/Time/Confirmed, PersonalEventSheet | 시간 추천 실패 `683:13139`, 위치 권한 꺼짐 `683:18201`는 gallery fixture 구현·최종 캡처 확인. 실제 실패 경로의 Figma 검수는 별도 |
| 06 `530:1402` 프로필 | ProfileHome/Edit/Friends/Privacy/Origin, Settings/법률/앱정보 | 이번에 Contact `601:3208`, 알림 설정 `564:1875` 준비 중 화면 연결. 계정 삭제 단계 `601:3371/3416/3473`는 gallery fixture 구현·최종 캡처 확인. 실제 삭제는 서버 대기 |
| 07 `542:1533` 밥약 기록 | 이번에 목록 `542:1534`, 영수증 `542:1633` 구현 | 운영은 서버 미연결 빈 상태. 전체 목록·상세는 preview fixture로만 표시. 저장 완료 시안 `601:3701/3797`는 gallery fixture 구현·최종 캡처 확인. 실제 저장/공유는 미구현. 저녁팟 상세 `589:2147`, 샤브샤브 `631:6196` 별도 상태 검수 미완료 |
| 08 `496:1125` 메뉴 정하기 | 현재 앱은 S4 식당 투표 흐름 유지 | `498:1191`, `497:1127/1287/1369`, `498:1312/1404`, 로딩 `683:12744`·실패 `683:12855`는 gallery fixture 구현·최종 캡처 확인. 음식 메뉴 독립 투표는 S4와 충돌하는 과거안이므로 실제 연결은 별도 제품결정. 새 후보 분기의 개별 검수 미완료 |
| 09 `527:1392` 채팅·패널·방 상세 | ChatRoom, 이모티콘, ScheduleSheet, SettlementSheet, MembersSheet, MateProfileSheet, RoomDetail, 초대·나가기·위임 | 메시지 메뉴는 복사만 지원. 답장 `628:2259`, 신고 `562:2142`, 차단 `628:2477`, 인라인 전송실패 `683:13388`는 gallery fixture 구현·최종 캡처 확인. 실제 답장·신고·차단 및 성공 상태 연결은 서버 대기 |
| 10 `540:1523` 식당·확정 | VotingSheet, 직접 추가, 추천 실패 UI, 약속 확정 | 추천 더 받음·비방장·실패 `683:12975` 등 노드별 시각 검수 필요. 독립 메뉴 변경과 분리 |
| 11 `541:1616` 정산 상세 | SettlementDetail, 송금확인, 요청자/송금자·완료·빈 지출 상태 | 촬영 `589:1867`, 인식 `589:1890`, 카메라권한 `683:13311`, 인식실패 `683:13350`, 더보기 `629:1858/1993`, 취소 `629:2128`, 알림 보냄 `629:2362/2461`은 gallery fixture 구현·최종 캡처 확인. 실제 촬영·인식·취소·알림 및 지출 펼침은 서버 대기 |

병렬 담당의 **gallery 30노드 fixture 구현과 60개 캡처**를 메인이 확인했다. `tmp/figma-remaining-render/summary.json`에서 412×892/375×892 각각 30개, runtimeErrors 0, externalRequests 0, backendRequests 0을 재확인했다. 병렬 최종 보고를 수신했으며 카메라 이미지 cover 수정 후 메인이 스크린샷을 직접 확인했다. 아래 매핑은 현재 `FigmaRemainingGallery.tsx`의 `remainingScenes`를 읽어 반영했다. 실제 앱 연결 4종과 fixture 30상태는 별개이며, gallery의 완료·저장·전송 표시는 실제 서버 처리 결과가 아니다.

## Gallery node ↔ scene

모든 행은 preview-only fixture다. 카메라 이미지 cover 수정 후 30노드·60개 최종 캡처 확인을 마쳤으며 실제 서버 기능 완료를 뜻하지 않는다.

| Figma node | scene | 화면 |
|---|---|---|
| `564:1875` | `notifications` | 프로필 / 알림 설정 |
| `601:3371` | `delete` | 프로필 / 계정 삭제 |
| `601:3416` | `password` | 프로필 / 비밀번호 확인 |
| `601:3473` | `deleted` | 프로필 / 탈퇴 완료 예시 |
| `589:1867` | `camera` | 정산 / 영수증 촬영 |
| `589:1890` | `receipt-result` | 정산 / 영수증 인식 결과 |
| `683:13311` | `camera-denied` | 정산 / 카메라 권한 꺼짐 |
| `683:13350` | `camera-failure` | 정산 / 영수증 인식 실패 |
| `628:2477` | `block` | 채팅방 / 차단 확인 |
| `628:2259` | `reply` | 채팅방 / 답장 쓰기 |
| `562:2142` | `report` | 채팅방 / 신고하기 |
| `629:1858` | `settlement-requester` | 정산 / 더보기 · 요청자 |
| `629:1993` | `settlement-sender` | 정산 / 더보기 · 보내는 사람 |
| `629:2128` | `settlement-cancel` | 정산 / 정산 취소 확인 |
| `498:1191` | `menu-craving` | 과거 메뉴 투표 시안 / 오늘 당기는 음식 |
| `497:1127` | `menu-evaluate` | 과거 메뉴 투표 시안 / 후보 평가 |
| `497:1287` | `menu-result` | 과거 메뉴 투표 시안 / 결과 |
| `497:1369` | `menu-split` | 과거 메뉴 투표 시안 / 의견 갈림 |
| `498:1312` | `menu-confirm` | 과거 메뉴 투표 시안 / 확정 확인 |
| `498:1404` | `menu-change` | 과거 메뉴 투표 시안 / 메뉴 변경 확인 |
| `683:12744` | `menu-loading` | 과거 메뉴 투표 시안 / 후보 고르는 중 |
| `683:12855` | `menu-error` | 과거 메뉴 투표 시안 / 후보 불러오기 실패 |
| `543:1609` | `invite` | 초대 링크 / 웹 랜딩 |
| `683:13139` | `time-failure` | 새 밥약 / 시간 추천 실패 |
| `683:18201` | `location-denied` | 새 밥약 / 위치 권한 꺼짐 |
| `683:13388` | `message-failure` | 채팅방 / 메시지 전송 실패 |
| `601:3701` | `history-saved-lunch` | 밥약 기록 / 팀 점심 이미지 저장됨 예시 |
| `601:3797` | `history-saved-dinner` | 밥약 기록 / 저녁팟 이미지 저장됨 예시 |
| `629:2362` | `reminder-all` | 정산 / 3명 알림 보냄 예시 |
| `629:2461` | `reminder-one` | 정산 / 웰링 알림 보냄 예시 |

## 이번 연결

- 프로필 → 밥약 기록: 검색·월 필터·목록 행·상세 레이아웃. production은 빈 기록을 사용하고 fixture를 route에서 받지 않는다.
- 기록 → 영수증 → 닫기: preview에서 선택한 record를 주입한다. 상세 열기 handler가 없는 경우 준비 중 안내를 표시하며 재무 내역을 route에 넣지 않는다.
- 설정 → 문의하기: 분류·본문·기기 정보 체크 반응. 전송 시 준비 중 안내이며 접수 완료로 표시하지 않는다. 기존 코드에서 지원 이메일/메일 열기 함수를 찾지 못해 mailto를 새로 만들지 않았다.
- 설정 → 알림 설정: production 스위치는 비활성이고 현재 수신 상태가 아님을 표시한다. 실제 마케팅 동의는 기존 OptionalConsents로 연결한다. preview 스위치는 화면 안에서만 반응한다.
- 계정 삭제 production 차단과 인증·개인정보·정산 계약은 그대로 둔다.

## 검증과 실행

- `npm run ts:check`: 통과.
- 변경 화면·navigation·history preview 대상 ESLint: 통과.
- 자산 확장자 후속 수정: JPEG 헤더인 `history-assets` 5개(`brunch/dinner/korean/meat/soup`)와 `preview/assets` 3개(`guide/receipt/receiptPhoto`) 모두 `.png` → `.jpg`로 이름과 참조를 수정했다. 담당 5개는 변경 전후 SHA-256 동일하며 재인코딩하지 않았다. 메인 최종 보고 기준 전체 `security:assets` 및 범위 lint·타입 검사 통과.
- 기존 `settingsS3.test.js`, `profileD.integration.test.js`: 98개 통과.
- `historyContact.test.js`: 4개 통과. production 빈 상태/비활성 동작, 검색·필터 교집합, 문의의 미전송 안내를 확인.
- 메인 최종 보고: 전체 Jest **83 suites / 1510 tests 모두 통과**, 최종 타입·린트·에셋 검사 통과. Expo 검사도 `EXPO_NO_DOTENV=1`과 로컬 임시 home 지원 환경변수로 격리해 통과했다. 의존성 설치·변경은 없었다.
- **`npm run quality` 전체는 `security:audit` 정책 실패로 미통과**다. 신규 권고 6개(`deepmerge` low 1개, `undici` moderate 2개/high 3개) 검토와, 해결된 `braces`·`sprintf-js` 2개 항목의 허용 목록 정리가 필요하다. lockfile·allowlist는 수정하지 않았다. 화면 연결 4종·gallery fixture 30상태·최종 60개 캡처 결과는 유지하며, 메인이 전달한 독립 Flash 검토의 새 코드 차단 사항은 0개다. 이번 문서 정리에서 검증을 다시 실행하지 않았다.
- 브라우저: Chrome CDP, 412×892/375×812, 캡처 12장. 검색→상세→뒤로가기, 빈 상태, 문의 입력→준비 안내, 가로 넘침/터치 영역 검사 통과. 실행 오류 0, 외부 요청 0.
- 증거: `tmp/history-render/metrics.json`, `412-history.png`, `412-receipt.png`, `412-contact.png` 및 동일한 375 크기. `tmp`는 로컬 증거이며 커밋 대상 아님.

```powershell
$env:EXPO_NO_DOTENV='1'
$env:EXPO_OFFLINE='1'
node scripts/ui-preview/history.serve.cjs
# 다른 터미널
node scripts/ui-preview/history.browser.cjs
```

preview 진입: `/`(기록), `/?scene=receipt`, `/?scene=contact`, `/?scene=empty`. 포트 8104 Metro를 사용하며 browser harness가 임시 localhost HTML 서버를 연다. Figma 음식/아바타 원본은 `scripts/ui-preview/history-assets`에만 두며 production에는 예시 내역을 번들링하지 않는다.

gallery는 `node scripts/ui-preview/figmaRemaining.serve.cjs` 단일 명령으로 Metro `127.0.0.1:8123`과 지속 HTML/프록시 `127.0.0.1:8125`를 함께 실행한다. 브라우저에서 `http://127.0.0.1:8125/`로 목록을, `http://127.0.0.1:8125/?scene=camera`처럼 위 표의 scene으로 직접 열 수 있다. 메인이 HTTP 200을 확인했다. `browser.cjs`는 자동 검사용이며 별도 임시 HTML 서버 8124를 열었다가 검사 종료 후 닫는다.

```powershell
node scripts/ui-preview/figmaRemaining.serve.cjs
# 자동 브라우저 검사가 필요할 때 다른 터미널에서 실행
node scripts/ui-preview/figmaRemaining.browser.cjs
```

gallery 증거는 `tmp/figma-remaining-render/summary.json`, `review-metrics.json` 및 `{scene}-{width}x892.png`다. 카메라 이미지 cover 수정 후 최종 60개 캡처(각 폭 30개), runtimeErrors/externalRequests/backendRequests 모두 0을 메인이 확인했다. 이 문서 정리에서는 브라우저나 quality를 다시 실행하지 않았다.

## 시각 검수의 한계

기존 공용 헤더·아이콘·버튼을 재사용했다. 영수증 톱니 하단은 Figma 원본 SVG(364×12)를 Chrome canvas로 PNG로 변환해 표시한다. 날짜 문구·필터 터치 높이·헤더 정렬에 원본과 차이가 있다. 앱 연결 4종(기록 목록·영수증 상세·문의·알림 설정)을 구현했으며, 별도 30노드 preview-only gallery 구현·60개 캡처는 메인이 확인했다. 카메라 이미지 cover 수정 후 최종 캡처와 메인 시각 확인을 마쳤다. 픽셀 일치 또는 모든 Phone 화면 완성으로 판정하지 않는다. 실제 보관 API, 이미지 저장, 영수증 공유, 앱 내 문의 접수는 미구현이다.


## 2026-10-28 실제 앱 로컬 흐름 통합

갤러리 30노드의 실제 앱 진입점은 아래와 같다. 기존 갤러리와 S4 식당 투표는 보존했다.
서버가 없는 기능은 연결 대기/로컬 예시로 표시하며 Auth/RLS/RPC/송금/계정삭제를 추가하지 않았다.
기록은 비어 있는 실제 목록에서 사용자가 **로컬 예시 기록 보기**를 눌러야 예시 두 건이 나타난다.

| 노드 | 상태 | 실제 앱 진입 / 조작 |
|---|---|---|
| 564:1875 | 알림 설정 | 프로필 → 설정 → 알림 설정. 알림 받기·항목별 로컬 토글, 전체 OFF 시 하위 비활성 |
| 601:3371 | 계정 삭제 안내 | 설정 → 계정 삭제. 안내 확인 체크 후 다음 |
| 601:3416 | 본인 확인 | 계정 삭제 → 본인 확인 시트. 실제 비밀번호 입력 없음 |
| 601:3473 | 완료 대응 | 본인 확인 → 삭제 요청 준비. 계정 삭제가 아닌 준비 완료/연결 대기 표시 |
| 589:1867 | 영수증 촬영 | 정산 상세 → 영수증 찍어서 올리기. Figma 가이드·플래시 로컬 토글·촬영 |
| 589:1890 | 인식 결과 대응 | 촬영 → 권한 대기/앨범 실패 → 직접 입력. 가게·합계 검증 후 로컬 초안으로 넣기. recognize 연결 시 인식 결과도 같은 폼 |
| 683:13311 | 카메라 권한 | 영수증 촬영 → 촬영. 장치 연결 전 권한 안내, 재확인·앨범·직접 입력 |
| 683:13350 | 영수증 실패 | 영수증 촬영 → 앨범에서 선택. 인식 연결 대기, 다시 찍기·직접 입력 |
| 628:2477 | 차단 확인 | 채팅 타인 메시지 길게 누르기 → 차단하기 → 차단 요청. 연결 대기/실패 및 취소 |
| 628:2259 | 답장 쓰기 | 채팅 메시지 길게 누르기 → 답장. 실제 선택 메시지 인용, 취소 가능. 답장 전송은 연결 대기 |
| 562:2142 | 신고 | 채팅 타인 메시지 길게 누르기 → 신고하기. 사유·상세 입력, 요청 시 연결 대기 |
| 629:1858 | 요청자 더보기 | 실제 요청자 정산 상세 → 더보기. 채팅, 수정 요청 준비, 취소 확인 |
| 629:1993 | 송금자 더보기 | 실제 송금자 정산 상세 → 더보기. 채팅, 채팅방에서 금액 묻기 |
| 629:2128 | 정산 취소 | 요청자 더보기 → 정산 취소 → 확인/돌아가기. 실제 취소 없음 |
| 498:1191 | 오늘 당기는 음식 | 채팅 + 메뉴 → 메뉴 정하기 · 로컬. 다중 선택, 아무거나 선택 시 나머지 해제 |
| 497:1127 | 후보 평가 | 메뉴 후보 보기 → 로딩 → 오류 → 로컬 예시 후보로 계속하기. 8개 후보 평가 |
| 497:1287 | 결과 | 후보 평가 → 별로예요 없이 평가 완료. 예시 후보 결과 |
| 497:1369 | 의견 갈림 | 후보에서 별로예요 선택 → 평가 완료. 대안 후보와 재평가 |
| 498:1312 | 메뉴 확정 확인 | 결과 → 삼겹살로 정하기 → 로컬 확정 안내. 실제 방 메뉴 변경 없음 |
| 498:1404 | 메뉴 변경 확인 | 메뉴 결과 → 메뉴 변경 → 다시 정하기/취소 |
| 683:12744 | 후보 로딩 | 오늘 당기는 음식 → 메뉴 후보 보기, 또는 오류 → 다시 시도 |
| 683:12855 | 후보 오류 | 후보 로딩 후 loader 미연결/실패. 재시도·음식 재선택·명시적 예시로 계속 |
| 543:1609 | 초대 랜딩 | 채팅 + → 멤버 → 메이트 초대 → 초대받는 화면 보기. 실제 초대코드만 사용, 복사·앱으로 돌아가기·설치 연결 대기 |
| 683:13139 | 시간 추천 실패 | 기존 새 밥약 → 일정 제출 → 시간 추천 실패. 기존 ScheduleConfirmedScreen 실패 UI의 다시 시도·날짜 직접 고르기 유지. S4도 실패 안내와 수동 격자 유지 |
| 683:18201 | 위치 권한 | 새 밥약 STEP1 → 내가 출발하는 곳 → 현재 위치로. 기기 연결 대기·직접 입력. 기존 공용 만남 지역/S4에 반영하지 않음 |
| 683:13388 | 메시지 전송 실패 | 채팅 텍스트 전송 실패 또는 답장 작성 후 전송. 입력 보존·다시 시도. 이모티콘 실패는 기존 안내 사용 |
| 601:3701 | 점심 영수증 저장 대응 | 프로필 → 밥약 기록 → 로컬 예시 기록 보기 → 팀 점심 → 이미지로 저장. 저장 준비됨 표시, 실제 파일 저장 주장 없음 |
| 601:3797 | 저녁 영수증 저장 대응 | 위 목록 → 저녁팟 → 이미지로 저장. 동일한 로컬 준비 상태 |
| 629:2362 | 전체 재알림 대응 | 실제 요청자 정산 상세 → 미완료 메이트 모두에게 알리기. 전체 재알림 요청 준비/서버 연결 대기 |
| 629:2461 | 개별 재알림 대응 | 실제 요청자 정산 상세 → 해당 미완료 메이트에게 알리기. 실제 이름으로 요청 준비/서버 연결 대기 |

### 연결 담당자 경계

- `NotificationPreferencesScreen.onDraftChange(boolean[])`: 로컬 알림 초안. OS 권한·실제 동의와 분리.
- `ContactScreen.onSubmit({category,content,includeDevice})`: 문의 초안. 기본값은 전송하지 않고 안내.
- `AccountDeletionScreen.onRequest()`: 준비 요청 경계. 비밀번호나 실제 삭제 API 없음.
- `LocalMenuScreen.loadCandidates()`: 후보 준비의 비동기 성공/실패 경계. 현재 후보와 집계는 명시적 로컬 예시이며 서버 데이터 모델은 별도 연결 필요.
- `ReceiptCaptureFlow.requestPermission/recognize/onDraft`: 장치 권한, 인식, `{merchant,amount}` 초안. 기본값은 권한/인식 연결 대기. 실제 정산 금액과 분리.
- `MessageSafetySheet.onSubmit(SafetyRequest)`: 타인 ID·신고/차단·사유·상세. 기본값은 처리하지 않고 재시도 안내.
- `SettlementMoreSheet.onLocalAction({billId,action})`: 수정/취소 초안. 기본값은 요청 준비 표시만. 재알림은 SettlementDetailView의 로컬 상태 경계로 현재 미완료 멤버에서 구성하며 transport는 미연결.
- 답장 UI의 `reply` 상태는 선택한 실제 메시지와 본문을 유지하며, 계약이 없어 기존 일반 메시지 RPC로 답장을 위장 전송하지 않는다.
- 로컬 기록은 `localMealExamples`의 고정 자료이며 route에는 `exampleId`만 전달한다. 계좌/사용자 실제 기록은 route로 전달하지 않는다.

### 검증 증거

- `tests/localAppFlows.test.js`: 실제 AppNavigator에서 기록→두 영수증→뒤로가기, 탈퇴 3단계, 메뉴 8상태; 촬영/권한/실패/직접입력과 신고·차단 실패도 검증.
- `scripts/ui-preview/localApp.*`: 실제 AppNavigator 사용. Auth/Notifications만 오프라인 stub, Supabase 접근 fail-closed. 갤러리를 렌더하지 않는다.
- `tmp/local-app-render`: 375/412 × 7상태 = 14캡처. 런타임 오류·백엔드 호출·외부 요청 0. 기록→영수증 저장준비, 메뉴 선택→실패→평가→확인, 위치권한, 알림 토글 검증.
- 이 증거는 로컬 화면/이동 검증이며 원격 배포·provider/E2E 성공을 의미하지 않는다.


### 최종 검증 결과

- `npm run quality`: 종료 코드 **1**. release development gate 15/15, asset check, TypeScript, ESLint, Jest **84 suites / 1,516 tests 전부 통과**, Expo dependency check 통과 후 마지막 `security:audit`에서 실패.
- audit: 새 검토 필요 `GHSA-GCQX-W48M-W2H4`, `GHSA-4QV8-2P9J-2685`, `GHSA-XJJ6-F33Q-929C`, `GHSA-2M5V-PCH6-74HX`, `GHSA-QRXM-FQHP-JWVM`, `GHSA-9FM3-97PX-RJF6`; 기존 allowlist의 해결된 항목 `GHSA-VFJ7-8CJW-P6XM`, `GHSA-HP3W-G68C-FV3C` 정리 필요. 의존성/allowlist는 이번 범위에서 변경하지 않았다.
- 실행 로그: `tmp/local-app-quality-final.log`. 별도 AppNavigator/관련 focused 46 tests 및 후속 사양 갱신 focused 검증도 통과.
- Impeccable detect: 변경 UI 6개 대상 결과 `[]`.
- 메인 전달 독립 Gemini 최종 검토: 차단 0. 메뉴 진입은 채팅 `+`의 로컬 보조 메뉴로 분리했고, 이모티콘 실패가 텍스트를 재전송하지 않도록 기존 안내를 유지했으며, 정산 더보기의 취소/안내 상태는 대상/역할/열림 변경 시 초기화한다.
- 원격 Supabase/Figma 상태는 변경하거나 배포했다고 주장하지 않았다. 커밋·푸시·스테이징 없음. 기존 `docs/S2-design.md` 보존.

### 최신 Figma 상세 대조 후속 (2026-10-28)

최신 원격 metadata는 로컬 추출본과 SHA-256이 일치했다(163개 화면 ID·이름·크기 동일). 상세 design context 대조에서 나온 구조 차이 5곳 중 이번에 보정한 것과 남은 것을 구분한다. Figma 호출 한도 도달로 추가 원격 조회는 하지 않았다.

보정함:
- `683:18201`/`599:3969` 위치 권한: 흰 카드(테두리 `#E8E3DC`, 반경 16), 권한 카드(`#FFF3E0`, “위치 권한이 꺼져 있어요” + 원문 설명 + 설정 열기), 선택 위치 카드. “직접 검색” 버튼은 실제 검색이 없어 만들지 않았다(`tests/scheduleV3.test.js:345`).
- `543:1609` 초대 랜딩: 정보 카드, 코드·복사 카드, 2단계 안내, 하단 고정 앱 열기·설치 안내.
- `589:1890`/`541:1714`/`588:2166` 영수증·지출 펼침: `ReceiptDraft`에 선택 항목 `items`/`uncertain` 추가. 인식 결과에 품목이 있으면 수량·금액 목록과 불확실 경고를 보이고, 지출 펼침에도 같은 목록을 보인다. 취소·다시 찍기 CTA는 가로 배치. 로컬 수동 입력에는 품목이 없어 가게·합계만 보인다. 품목은 인식 연결 담당이 `recognize`로 채운다.

남은 격차(미구현):
- `590:1869` 계좌 등록: 원본은 전체 화면·상단 뒤로가기·하단 고정 CTA 1개(“등록하고 정산으로 돌아가기”)이나 현재는 정산 시트 안 폼이며 버튼 3개(`SettlementAccountForm.tsx`, `ChatRoomSheets.tsx`). 기존 테스트 라벨 의존이 있어 이번에 바꾸지 않았다.
- `589:1890` 인식 결과: 원본은 정산 화면 위 바텀시트(가게 사진·정보 포함)이나 현재는 전체 화면이다.
- 원본 PNG 20개(`629:1858` 등) 미확보, 전 화면 픽셀 일치 검수 미수행.
