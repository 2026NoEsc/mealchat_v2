# Phone 원본 → 현재 앱 대응표

기준: 2026-10-28 현재 로컬 소스. 최신 상세 대조 후속은 figma-frontend-progress.md 끝 절 참고. Figma euLZpuvJsmuOhVKwtDkdhJ / Phone 478:9398의 **2026-10-20 추출본**. 메인 조회 담당의 최신 원격 metadata/design context/screenshot 조회 성공 보고를 수신했다. 최신 전체 XML과 로컬 XML의 SHA-256은 de2a291d2e1bbe7f06076fd4e5993fb0ce20a5c498a99c2817090fc94ab21a7d로 일치하며, 163개 ID/이름/크기 변경은 0이다. 상세 시각 대조는 별도 조회 작업에서 진행 중이다.

원본 frames 163개와 inventory 163개 ID 집합 일치, 대응 파일 누락 0. **이 수치는 구현·동작·시각 누락 0을 뜻하지 않는다.** 기존 REPORT의 일치/누락 분류를 현재 판정으로 복사하지 않았다.

추출기는 01~11 섹션 직하 FRAME 중 너비 390 이상·높이 700 이상을 reactions 유무와 무관하게 수집했다. 00 컴포넌트, 작은 프레임, 중첩 화면, Tablet/Page 1/취향게임은 이 완전성 수치에 포함되지 않는다. phone-metadata.xml 및 inventory.json은 같은 시점 자료이므로 최신성의 독립 증거가 아니다.

진입 열은 현재 route/컴포넌트 기준 정적 대응이다. 캡처가 없는 행은 화면별 브라우저 검증 미완료다. 테스트 열은 관련 회귀 검증 위치이며 해당 원본 프레임의 픽셀 검증을 의미하지 않는다. `미확보`는 원본 캡처가 없는 행이다.

서버 없는 처리(삭제/신고/차단/재알림/저장)는 실제 완료 대신 준비·연결 대기로 표시한다. S4 식당 투표 계약은 유지한다. 샤브샤브 메뉴→식당→정산 이동은 실제 AppNavigator와 전송 대역으로 검증했으며, 상태별 실행 근거는 figma-phone-state-evidence.md를 따른다. 실제 서버 연속 성공은 검증하지 않았다. 건강/출발지 미결 및 D01~D04 차이는 승인 완료로 판정하지 않는다.

| 노드 | 원본 화면 | 앱 진입 / 상태 | 현재 파일 | 관련 테스트 | 실제 앱 캡처 | 원본 캡처 |
|---|---|---|---|---|---|---|
| 495:1026 | 가입/음식 프로필 STEP 1 | 회원가입 또는 프로필 → 음식 프로필 → 단계/선택 | src/screens/food/FoodProfileForm.tsx | tests/s5FoodScreens.test.js | 미검증 | 확보 |
| 495:1163 | 가입/음식 프로필 STEP 2 · 알레르기 | 회원가입 또는 프로필 → 음식 프로필 → 단계/선택 | src/screens/food/FoodProfileForm.tsx | tests/s5FoodScreens.test.js | 미검증 | 확보 |
| 495:1248 | 가입/음식 프로필 STEP 2 · 못 먹는 음식 | 회원가입 또는 프로필 → 음식 프로필 → 단계/선택 | src/screens/food/FoodProfileForm.tsx | tests/s5FoodScreens.test.js | 미검증 | 확보 |
| 495:1325 | 가입/음식 프로필 STEP 2 · 식단 제한 | 회원가입 또는 프로필 → 음식 프로필 → 단계/선택 | src/screens/food/FoodProfileForm.tsx | tests/s5FoodScreens.test.js | 미검증 | 확보 |
| 590:2282 | 가입/음식 프로필 STEP 1 · 상관없음 선택 | 회원가입 또는 프로필 → 음식 프로필 → 단계/선택 | src/screens/food/FoodProfileForm.tsx | tests/s5FoodScreens.test.js | 미검증 | 확보 |
| 496:1126 | 채팅방/메뉴 미정 | 채팅 → 메시지/식당/정산 (샤브샤브는 데이터 분기) | src/components/ui/MeetingCard.tsx | tests/chatE.test.js | 미검증 | 확보 |
| 496:1202 | 채팅방/메뉴 확정 | 채팅 → 메시지/식당/정산 (샤브샤브는 데이터 분기) | src/components/ui/MeetingCard.tsx | tests/chatE.test.js | 미검증 | 확보 |
| 497:1127 | 메뉴 정하기/후보 평가 | 채팅 + → 메뉴 정하기 · 로컬 → 선택/평가/의견 갈림/새 후보/확정/변경 | src/screens/chat/LocalMenuScreen.tsx | tests/localAppFlows.test.js | app-menu-evaluate-412, app-menu-evaluate-375 | 확보 |
| 497:1287 | 메뉴 정하기/결과 | 채팅 + → 메뉴 정하기 · 로컬 → 선택/평가/의견 갈림/새 후보/확정/변경 | src/screens/chat/LocalMenuScreen.tsx | tests/localAppFlows.test.js | 미검증 | 확보 |
| 497:1369 | 메뉴 정하기/의견 갈림 | 채팅 + → 메뉴 정하기 · 로컬 → 선택/평가/의견 갈림/새 후보/확정/변경 | src/screens/chat/LocalMenuScreen.tsx | tests/localAppFlows.test.js | app-menu-split-412, app-menu-split-375 | 확보 |
| 498:1191 | 메뉴 정하기/오늘 당기는 음식 | 채팅 + → 메뉴 정하기 · 로컬 → 선택/평가/의견 갈림/새 후보/확정/변경 | src/screens/chat/LocalMenuScreen.tsx | tests/localAppFlows.test.js | app-menu-craving-412, app-menu-craving-375 | 확보 |
| 498:1312 | 메뉴 정하기/확정 확인 | 채팅 + → 메뉴 정하기 · 로컬 → 선택/평가/의견 갈림/새 후보/확정/변경 | src/screens/chat/LocalMenuScreen.tsx | tests/localAppFlows.test.js | app-menu-confirm-412, app-menu-confirm-375 | 확보 |
| 498:1404 | 채팅방/메뉴 변경 확인 | 채팅 + → 메뉴 정하기 · 로컬 → 선택/평가/의견 갈림/새 후보/확정/변경 | src/screens/chat/LocalMenuScreen.tsx | tests/localAppFlows.test.js | 미검증 | 확보 |
| 591:2159 | 메뉴 정하기/후보 평가 · 새 후보 | 채팅 + → 메뉴 정하기 · 로컬 → 선택/평가/의견 갈림/새 후보/확정/변경 | src/screens/chat/LocalMenuScreen.tsx | tests/localAppFlows.test.js | app-menu-new-candidates-412, app-menu-new-candidates-375 | 확보 |
| 591:2319 | 메뉴 정하기/결과 · 새 후보 | 채팅 + → 메뉴 정하기 · 로컬 → 선택/평가/의견 갈림/새 후보/확정/변경 | src/screens/chat/LocalMenuScreen.tsx | tests/localAppFlows.test.js | app-menu-shabu-result-412, app-menu-shabu-result-375 | 확보 |
| 591:2401 | 메뉴 정하기/확정 확인 · 새 후보 | 채팅 + → 메뉴 정하기 · 로컬 → 선택/평가/의견 갈림/새 후보/확정/변경 | src/screens/chat/LocalMenuScreen.tsx | tests/localAppFlows.test.js | app-menu-shabu-confirm-412, app-menu-shabu-confirm-375 | 확보 |
| 591:2495 | 채팅방/메뉴 확정 · 샤브샤브 | 채팅 → 메시지/식당/정산 (샤브샤브는 데이터 분기) | src/components/ui/MeetingCard.tsx | tests/chatE.test.js | 미검증 | 확보 |
| 631:4253 | 채팅방/메뉴 변경 확인 · 샤브샤브 | 채팅 + → 메뉴 정하기 · 로컬 → 선택/평가/의견 갈림/새 후보/확정/변경 | src/screens/chat/LocalMenuScreen.tsx | tests/localAppFlows.test.js | 미검증 | 확보 |
| 631:4344 | 채팅방/식당 정하기 시트 · 샤브샤브 | 채팅 → 식당 정하기 → 후보/더 받기/직접 추가/방장 확정 (기존 S4 계약) | src/screens/chat/VotingSheet.tsx | tests/chatE.test.js | 미검증 | 확보 |
| 631:4490 | 채팅방/식당 정하기 · AI 추천 더 받음 · 샤브샤브 | 채팅 → 식당 정하기 → 후보/더 받기/직접 추가/방장 확정 (기존 S4 계약) | src/screens/chat/VotingSheet.tsx | tests/chatE.test.js | 미검증 | 확보 |
| 631:4653 | 채팅방/식당 직접 추가 · 샤브샤브 | 채팅 → 식당 정하기 → 후보/더 받기/직접 추가/방장 확정 (기존 S4 계약) | src/screens/chat/VotingSheet.tsx | tests/chatE.test.js | 미검증 | 확보 |
| 631:4782 | 채팅방/약속 확정 확인 · 샤브샤브 | 채팅 → 식당 정하기 → 후보/더 받기/직접 추가/방장 확정 (기존 S4 계약) | src/screens/chat/VotingSheet.tsx | tests/chatE.test.js | 미검증 | 확보 |
| 631:4874 | 채팅방/약속 확정 · 샤브샤브 | 채팅 → 메시지/식당/정산 (샤브샤브는 데이터 분기) | src/components/ui/MeetingCard.tsx | tests/chatE.test.js | 미검증 | 확보 |
| 631:4955 | 채팅방/N빵 정산 시트 · 샤브샤브 | 채팅 → 메시지/식당/정산 (샤브샤브는 데이터 분기) | src/screens/chat/ChatRoomSheets.tsx | tests/chatE.test.js | 미검증 | 확보 |
| 631:5095 | 채팅방/영수증 인식 결과 · 샤브샤브 | 정산 상세 → 영수증 찍어서 올리기 → 권한/앨범/직접 입력 | src/screens/settlement/ReceiptCaptureFlow.tsx | tests/localAppFlows.test.js | 미검증 | 확보 |
| 631:5227 | 정산/요청자 · 지출 내역 없음 · 샤브샤브 | 홈 정산/채팅 정산 → 정산 상세 → 역할/멤버/로컬 지출 펼침/재알림 준비 | src/screens/settlement/SettlementDetailScreen.tsx | tests/settlementDetail.test.js | 미검증 | 확보 |
| 631:5296 | 정산/요청자 · 알림 보냄 · 샤브샤브 | 홈 정산/채팅 정산 → 정산 상세 → 역할/멤버/로컬 지출 펼침/재알림 준비 | src/screens/settlement/SettlementDetailScreen.tsx | tests/settlementDetail.test.js | 미검증 | 확보 |
| 631:5369 | 정산/영수증 촬영 · 샤브샤브 | 정산 상세 → 영수증 찍어서 올리기 → 권한/앨범/직접 입력 | src/screens/settlement/ReceiptCaptureFlow.tsx | tests/localAppFlows.test.js | 미검증 | 확보 |
| 631:5390 | 정산/영수증 인식 결과 · 샤브샤브 | 정산 상세 → 영수증 찍어서 올리기 → 권한/앨범/직접 입력 | src/screens/settlement/ReceiptCaptureFlow.tsx | tests/localAppFlows.test.js | 미검증 | 확보 |
| 631:5534 | 정산/요청자 · 지출 내역 있음 · 샤브샤브 | 홈 정산/채팅 정산 → 정산 상세 → 역할/멤버/로컬 지출 펼침/재알림 준비 | src/screens/settlement/SettlementDetailScreen.tsx | tests/settlementDetail.test.js | 미검증 | 확보 |
| 631:5634 | 정산/요청자 · 웰링에게 알림 보냄 · 샤브샤브 | 홈 정산/채팅 정산 → 정산 상세 → 역할/멤버/로컬 지출 펼침/재알림 준비 | src/screens/settlement/SettlementDetailScreen.tsx | tests/settlementDetail.test.js | 미검증 | 확보 |
| 631:5738 | 정산/요청자 · 모두 완료 · 샤브샤브 | 홈 정산/채팅 정산 → 정산 상세 → 역할/멤버/로컬 지출 펼침/재알림 준비 | src/screens/settlement/SettlementDetailScreen.tsx | tests/settlementDetail.test.js | 미검증 | 확보 |
| 631:5851 | 정산/더보기 · 요청자 · 샤브샤브 | 정산 상세 → 더보기 → 요청자/송금자/취소 확인 (연결 대기) | src/components/ui/SettlementMoreSheet.tsx | tests/settlementDetail.test.js | 미검증 | 확보 |
| 631:5940 | 정산/정산 취소 확인 · 샤브샤브 | 정산 상세 → 더보기 → 요청자/송금자/취소 확인 (연결 대기) | src/components/ui/SettlementMoreSheet.tsx | tests/settlementDetail.test.js | 미검증 | 확보 |
| 631:6021 | 채팅방/정산 취소한 뒤 · 샤브샤브 | 채팅 → 메시지/식당/정산 (샤브샤브는 데이터 분기) | src/components/ui/SettlementMoreSheet.tsx | tests/chatE.test.js | 미검증 | 확보 |
| 631:6106 | 채팅방/정산 완료 · 방 종료 안내 · 샤브샤브 | 채팅 → 메시지/식당/정산 (샤브샤브는 데이터 분기) | src/components/ui/MeetingCard.tsx | tests/chatE.test.js | 미검증 | 확보 |
| 631:6196 | 밥약 기록/영수증 · 오늘 저녁팟 · 샤브샤브 | 프로필 → 밥약 기록 → 로컬 예시 기록 보기 → 해당 영수증 | src/screens/history/MealReceiptScreen.tsx | tests/localAppFlows.test.js | app-receipt-shabu-412, app-receipt-shabu-375 | 확보 |
| 683:12744 | 메뉴 정하기/후보 고르는 중 | 채팅 + → 메뉴 정하기 · 로컬 → 선택/평가/의견 갈림/새 후보/확정/변경 | src/screens/chat/LocalMenuScreen.tsx | tests/localAppFlows.test.js | 미검증 | 확보 |
| 683:12855 | 메뉴 정하기/후보 불러오기 실패 | 채팅 + → 메뉴 정하기 · 로컬 → 선택/평가/의견 갈림/새 후보/확정/변경 | src/screens/chat/LocalMenuScreen.tsx | tests/localAppFlows.test.js | app-menu-error-412, app-menu-error-375 | 확보 |
| 519:1216 | 시작/첫 화면 | 시작 → 로그인/회원가입/재설정/약관 | src/screens/signup/SignupStartScreen.tsx | tests/authUi.integration.test.js | 미검증 | 확보 |
| 519:1229 | 시작/로그인 | 시작 → 로그인/회원가입/재설정/약관 | src/screens/LoginScreen.tsx | tests/authUi.integration.test.js | 미검증 | 확보 |
| 519:1262 | 회원가입/개인정보 입력 | 시작 → 로그인/회원가입/재설정/약관 | src/screens/signup/SignupPersonalScreen.tsx | tests/authUi.integration.test.js | 미검증 | 확보 |
| 520:1244 | 회원가입/구글 캘린더 연동 | 시작 → 로그인/회원가입/재설정/약관 | src/screens/signup/SignupCalendarScreen.tsx | tests/authUi.integration.test.js | 미검증 | 확보 |
| 520:1285 | 회원가입/약관 동의 | 시작 → 로그인/회원가입/재설정/약관 | src/screens/signup/SignupTermsScreen.tsx | tests/authUi.integration.test.js | 미검증 | 확보 |
| 558:1631 | 로그인/비밀번호 재설정 메일 | 시작 → 로그인/회원가입/재설정/약관 | src/screens/auth/PasswordResetSheet.tsx | tests/authUi.integration.test.js | 미검증 | 확보 |
| 558:1686 | 비밀번호/새 비밀번호 설정 | 시작 → 로그인/회원가입/재설정/약관 | src/screens/auth/NewPasswordScreen.tsx | tests/authUi.integration.test.js | 미검증 | 확보 |
| 558:1712 | 약관/다시 동의 | 시작 → 로그인/회원가입/재설정/약관 | src/screens/auth/ReConsentScreen.tsx | tests/authUi.integration.test.js | 미검증 | 확보 |
| 563:2071 | 시작/알림 권한 안내 | 시작 → 로그인/회원가입/재설정/약관 | src/screens/settings/NotificationPermissionGate.tsx | tests/authUi.integration.test.js | 미검증 | 확보 |
| 590:2447 | 회원가입/약관 동의 · 건강정보 미동의 | 시작 → 로그인/회원가입/재설정/약관 | src/screens/signup/SignupTermsScreen.tsx | tests/authUi.integration.test.js | 미검증 | 확보 |
| 599:4206 | 회원가입/개인정보 입력 · 이메일 중복 | 시작 → 로그인/회원가입/재설정/약관 | src/screens/signup/SignupPersonalScreen.tsx | tests/authUi.integration.test.js | 미검증 | 확보 |
| 521:1248 | 홈/메인 | 홈 → +/알림/정산 또는 방 생명주기 성공 후 홈 | src/screens/HomeScreen.tsx | tests/homeC.test.js | 미검증 | 확보 |
| 521:1331 | 홈/새 밥약 메뉴 | 홈 → +/알림/정산 또는 방 생명주기 성공 후 홈 | src/screens/HomeScreen.tsx | tests/homeC.test.js | 미검증 | 확보 |
| 521:1429 | 홈/알림 | 홈 → +/알림/정산 또는 방 생명주기 성공 후 홈 | src/components/NotificationPanel.tsx | tests/homeC.test.js | 미검증 | 확보 |
| 521:1575 | 홈/정산 | 홈 → +/알림/정산 또는 방 생명주기 성공 후 홈 | src/screens/settlement/SettlementsScreen.tsx | tests/homeC.test.js | 미검증 | 확보 |
| 559:1805 | 홈/밥약 없음 | 홈 → +/알림/정산 또는 방 생명주기 성공 후 홈 | src/screens/HomeScreen.tsx | tests/homeC.test.js | 미검증 | 확보 |
| 563:2123 | 홈/불러오기 실패 | 홈 → +/알림/정산 또는 방 생명주기 성공 후 홈 | src/screens/HomeScreen.tsx | tests/homeC.test.js | 미검증 | 확보 |
| 590:2077 | 홈/방을 없앤 뒤 | 홈 → +/알림/정산 또는 방 생명주기 성공 후 홈 | src/screens/HomeScreen.tsx | tests/homeC.test.js | 미검증 | 확보 |
| 590:2164 | 홈/방에서 나간 뒤 | 홈 → +/알림/정산 또는 방 생명주기 성공 후 홈 | src/screens/HomeScreen.tsx | tests/homeC.test.js | 미검증 | 확보 |
| 599:2425 | 홈/알림 · 모두 읽음 | 홈 → +/알림/정산 또는 방 생명주기 성공 후 홈 | src/components/NotificationPanel.tsx | tests/homeC.test.js | 미검증 | 확보 |
| 599:2587 | 홈/알림 · 정산만 보기 | 홈 → +/알림/정산 또는 방 생명주기 성공 후 홈 | src/components/NotificationPanel.tsx | tests/homeC.test.js | 미검증 | 확보 |
| 527:1393 | 채팅방/+ 메뉴 열림 | 채팅 → +/메시지 길게/방 상세/멤버 | src/screens/chat/ChatRoomScreen.tsx | tests/chatE.test.js | 미검증 | 확보 |
| 527:1507 | 채팅방/이모티콘 | 채팅 → +/메시지 길게/방 상세/멤버 | src/screens/chat/EmoticonPanel.tsx | tests/chatE.test.js | 미검증 | 확보 |
| 527:1613 | 채팅방/일정 조율 시트 | 채팅 → +/메시지 길게/방 상세/멤버 | src/screens/chat/S4ScheduleSheet.tsx | tests/chatE.test.js | 미검증 | 확보 |
| 527:1747 | 채팅방/N빵 정산 시트 | 채팅 → +/메시지 길게/방 상세/멤버 | src/screens/chat/ChatRoomSheets.tsx | tests/chatE.test.js | 미검증 | 확보 |
| 528:1399 | 채팅방/멤버 시트 | 채팅 → +/메시지 길게/방 상세/멤버 | src/screens/chat/ChatRoomSheets.tsx | tests/chatE.test.js | 미검증 | 확보 |
| 528:1525 | 채팅방/방 상세정보 | 채팅 → +/메시지 길게/방 상세/멤버 | src/screens/chat/RoomDetailScreen.tsx | tests/chatE.test.js | 미검증 | 확보 |
| 528:1604 | 채팅방/방 없애기 확인 | 채팅 → +/메시지 길게/방 상세/멤버 | src/components/ui/DestructiveDialog.tsx | tests/chatE.test.js | 미검증 | 확보 |
| 561:1734 | 채팅방/방 상세정보 · 메이트로 볼 때 | 채팅 → +/메시지 길게/방 상세/멤버 | src/screens/chat/RoomDetailScreen.tsx | tests/chatE.test.js | 미검증 | 미확보 |
| 561:1815 | 채팅방/방 나가기 확인 | 채팅 → +/메시지 길게/방 상세/멤버 | src/screens/chat/RoomDetailScreen.tsx | tests/chatE.test.js | 미검증 | 확보 |
| 561:1945 | 채팅방/메이트 초대 시트 | 채팅 → +/메시지 길게/방 상세/멤버 | src/components/ui/MateInviteSheet.tsx | tests/chatE.test.js | 미검증 | 미확보 |
| 562:1736 | 채팅방/영수증 인식 결과 | 정산 상세 → 영수증 찍어서 올리기 → 권한/앨범/직접 입력 | src/screens/settlement/ReceiptCaptureFlow.tsx | tests/localAppFlows.test.js | 미검증 | 미확보 |
| 562:1879 | 채팅방/N빵 정산 시트 · 계좌 없음 | 채팅 → +/메시지 길게/방 상세/멤버 | src/screens/chat/ChatRoomSheets.tsx | tests/chatE.test.js | 미검증 | 미확보 |
| 562:2031 | 채팅방/메시지 길게 누름 | 채팅 → +/메시지 길게/방 상세/멤버 | src/components/ui/MessageActionsSheet.tsx | tests/chatE.test.js | 미검증 | 미확보 |
| 562:2142 | 채팅방/신고하기 | 채팅 타인 메시지 길게 → 신고/차단 → 요청 (연결 대기) | src/screens/chat/MessageSafetySheet.tsx | tests/localAppFlows.test.js | 미검증 | 미확보 |
| 590:1869 | 정산/송금 계좌 등록 | 채팅 → N빵 정산 → 계좌 등록하기 → 은행/계좌번호/예금주 로컬 초안 | src/screens/settlement/SettlementAccountForm.tsx | tests/chatE.test.js | 미검증 | 확보 |
| 590:1896 | 채팅방/N빵 정산 시트 · 계좌 등록 완료 | 채팅 → +/메시지 길게/방 상세/멤버 | src/screens/chat/ChatRoomSheets.tsx | tests/chatE.test.js | 미검증 | 미확보 |
| 628:1829 | 채팅방/이모티콘 보냄 | 채팅 → +/메시지 길게/방 상세/멤버 | src/screens/chat/ChatRoomScreen.tsx | tests/chatE.test.js | 미검증 | 미확보 |
| 628:1934 | 채팅방/메이트 초대 · 링크 복사됨 | 채팅 → +/메시지 길게/방 상세/멤버 | src/components/ui/MateInviteSheet.tsx | tests/chatE.test.js | 미검증 | 확보 |
| 628:2083 | 채팅방/시스템 공유 시트 | 채팅 → +/메시지 길게/방 상세/멤버 | src/components/ui/MateInviteSheet.tsx | tests/chatE.test.js | 미검증 | 미확보 |
| 628:2259 | 채팅방/답장 쓰기 | 채팅 메시지 길게 → 답장/전송 실패 → 재시도 | src/screens/chat/ChatRoomScreen.tsx | tests/chatE.test.js | 미검증 | 미확보 |
| 628:2371 | 채팅방/메시지 복사됨 | 채팅 → +/메시지 길게/방 상세/멤버 | src/components/ui/MessageActionsSheet.tsx | tests/chatE.test.js | 미검증 | 미확보 |
| 628:2477 | 채팅방/차단 확인 | 채팅 타인 메시지 길게 → 신고/차단 → 요청 (연결 대기) | src/screens/chat/MessageSafetySheet.tsx | tests/localAppFlows.test.js | 미검증 | 미확보 |
| 628:2600 | 채팅방/차단한 뒤 | 채팅 타인 메시지 길게 → 신고/차단 → 요청 (연결 대기) | src/screens/chat/MessageSafetySheet.tsx | tests/localAppFlows.test.js | 미검증 | 미확보 |
| 628:2726 | 채팅방/신고 접수 | 채팅 타인 메시지 길게 → 신고/차단 → 요청 (연결 대기) | src/screens/chat/MessageSafetySheet.tsx | tests/localAppFlows.test.js | 미검증 | 미확보 |
| 628:2832 | 채팅방/메이트 프로필 | 채팅 → +/메시지 길게/방 상세/멤버 | src/components/ui/MessageActionsSheet.tsx | tests/chatE.test.js | 미검증 | 미확보 |
| 630:1954 | 채팅방/회사 팀 점심 | 채팅 → +/메시지 길게/방 상세/멤버 | src/components/ui/MeetingCard.tsx | tests/chatE.test.js | 미검증 | 미확보 |
| 630:2060 | 채팅방/동아리 뒤풀이 | 채팅 → +/메시지 길게/방 상세/멤버 | src/components/ui/MeetingCard.tsx | tests/chatE.test.js | 미검증 | 미확보 |
| 638:12499 | 채팅방/메이트 프로필 · 또리 | 채팅 → +/메시지 길게/방 상세/멤버 | src/components/ui/MessageActionsSheet.tsx | tests/chatE.test.js | 미검증 | 미확보 |
| 638:12611 | 채팅방/메이트 프로필 · 웰링 | 채팅 → +/메시지 길게/방 상세/멤버 | src/components/ui/MessageActionsSheet.tsx | tests/chatE.test.js | 미검증 | 미확보 |
| 638:12723 | 채팅방/메이트 프로필 · 나야나 | 채팅 → +/메시지 길게/방 상세/멤버 | src/components/ui/MessageActionsSheet.tsx | tests/chatE.test.js | 미검증 | 미확보 |
| 638:12835 | 채팅방/메이트 프로필 · 하늘 | 채팅 → +/메시지 길게/방 상세/멤버 | src/components/ui/MessageActionsSheet.tsx | tests/chatE.test.js | 미검증 | 미확보 |
| 683:13388 | 채팅방/메시지 전송 실패 | 채팅 메시지 길게 → 답장/전송 실패 → 재시도 | src/screens/chat/ChatRoomScreen.tsx | tests/chatE.test.js | 미검증 | 미확보 |
| 530:1403 | 프로필/프로필 홈 | 프로필 → 편집/메이트/공개 범위/출발지/설정 | src/screens/profile/ProfileHomeScreen.tsx | tests/profileD.integration.test.js | 미검증 | 미확보 |
| 530:1513 | 프로필/프로필 수정 | 프로필 → 편집/메이트/공개 범위/출발지/설정 | src/screens/profile/ProfileEditScreen.tsx | tests/profileD.integration.test.js | 미검증 | 미확보 |
| 530:1594 | 프로필/내 친구 관리 | 프로필 → 편집/메이트/공개 범위/출발지/설정 | src/screens/profile/FriendsScreen.tsx | tests/profileD.integration.test.js | 미검증 | 미확보 |
| 530:1656 | 프로필/정보 공개 범위 | 프로필 → 편집/메이트/공개 범위/출발지/설정 | src/screens/profile/PrivacyScreen.tsx | tests/profileD.integration.test.js | 미검증 | 미확보 |
| 530:1736 | 프로필/출발지 설정 | 프로필 → 편집/메이트/공개 범위/출발지/설정 | src/screens/profile/OriginScreen.tsx | tests/profileD.integration.test.js | 미검증 | 미확보 |
| 564:1791 | 프로필/설정 | 프로필 → 편집/메이트/공개 범위/출발지/설정 | src/screens/settings/SettingsScreen.tsx | tests/profileD.integration.test.js | 미검증 | 미확보 |
| 564:1875 | 프로필/알림 설정 | 프로필 → 설정 → 알림 설정 | src/screens/settings/NotificationPreferencesScreen.tsx | tests/localAppFlows.test.js | app-notifications-412, app-notifications-375 | 미확보 |
| 564:1961 | 프로필/서비스 이용약관 | 프로필 → 편집/메이트/공개 범위/출발지/설정 | src/screens/settings/CurrentLegalScreen.tsx | tests/profileD.integration.test.js | 미검증 | 미확보 |
| 564:1985 | 프로필/계정 삭제 | 프로필 → 설정 → 계정 삭제 → 확인 → 요청 준비 (실제 삭제 아님) | src/screens/settings/AccountDeletionScreen.tsx | tests/localAppFlows.test.js | 미검증 | 미확보 |
| 567:1909 | 프로필/개인정보 처리방침 | 프로필 → 편집/메이트/공개 범위/출발지/설정 | src/screens/settings/CurrentLegalScreen.tsx | tests/profileD.integration.test.js | 미검증 | 미확보 |
| 601:2603 | 프로필 수정 · 사진 바꾸기 | 프로필 → 편집/메이트/공개 범위/출발지/설정 | src/screens/profile/ProfilePhotoSheet.tsx | tests/profileD.integration.test.js | 미검증 | 미확보 |
| 601:2733 | 프로필/비밀번호 변경 | 프로필 → 편집/메이트/공개 범위/출발지/설정 | src/screens/profile/PasswordChangeScreen.tsx | tests/profileD.integration.test.js | 미검증 | 미확보 |
| 601:2759 | 프로필 수정 · 비밀번호 바뀜 | 프로필 → 편집/메이트/공개 범위/출발지/설정 | src/screens/profile/ProfileEditScreen.tsx | tests/profileD.integration.test.js | 미검증 | 미확보 |
| 601:2884 | 내 친구 관리 · 찾기 결과 | 프로필 → 편집/메이트/공개 범위/출발지/설정 | src/screens/profile/FriendsScreen.tsx | tests/profileD.integration.test.js | 미검증 | 미확보 |
| 601:2954 | 내 친구 관리 · 추가됨 | 프로필 → 편집/메이트/공개 범위/출발지/설정 | src/screens/profile/FriendsScreen.tsx | tests/profileD.integration.test.js | 미검증 | 미확보 |
| 601:3028 | 내 친구 관리 · 삭제됨 | 프로필 → 편집/메이트/공개 범위/출발지/설정 | src/screens/profile/FriendsScreen.tsx | tests/profileD.integration.test.js | 미검증 | 미확보 |
| 601:3156 | 프로필/앱 정보 | 프로필 → 편집/메이트/공개 범위/출발지/설정 | src/screens/settings/AppInfoScreen.tsx | tests/profileD.integration.test.js | 미검증 | 미확보 |
| 601:3208 | 프로필/문의하기 | 프로필 → 설정 → 문의하기 | src/screens/settings/ContactScreen.tsx | tests/historyContact.test.js | app-contact-412, app-contact-375 | 미확보 |
| 601:3243 | 프로필/설정 · 문의 보냄 | 프로필 → 편집/메이트/공개 범위/출발지/설정 | src/screens/settings/SettingsScreen.tsx | tests/profileD.integration.test.js | 미검증 | 미확보 |
| 601:3371 | 프로필/계정 삭제 · 삭제할 수 있음 | 프로필 → 설정 → 계정 삭제 → 확인 → 요청 준비 (실제 삭제 아님) | src/screens/settings/AccountDeletionScreen.tsx | tests/localAppFlows.test.js | app-deletion-412, app-deletion-375 | 미확보 |
| 601:3416 | 프로필/계정 삭제 · 비밀번호 확인 | 프로필 → 설정 → 계정 삭제 → 확인 → 요청 준비 (실제 삭제 아님) | src/screens/settings/AccountDeletionScreen.tsx | tests/localAppFlows.test.js | app-deletion-identity-412, app-deletion-identity-375 | 미확보 |
| 601:3473 | 프로필/탈퇴 완료 | 프로필 → 설정 → 계정 삭제 → 확인 → 요청 준비 (실제 삭제 아님) | src/screens/settings/AccountDeletionScreen.tsx | tests/localAppFlows.test.js | app-deletion-pending-412, app-deletion-pending-375 | 미확보 |
| 601:3541 | 프로필/출발지 설정 · 다른 위치 | 프로필 → 편집/메이트/공개 범위/출발지/설정 | src/screens/profile/OriginScreen.tsx | tests/profileD.integration.test.js | 미검증 | 미확보 |
| 540:1524 | 채팅방/식당 정하기 시트 | 채팅 → 식당 정하기 → 후보/더 받기/직접 추가/방장 확정 (기존 S4 계약) | src/screens/chat/VotingSheet.tsx | tests/chatE.test.js | 미검증 | 미확보 |
| 540:1682 | 채팅방/식당 직접 추가 | 채팅 → 식당 정하기 → 후보/더 받기/직접 추가/방장 확정 (기존 S4 계약) | src/screens/chat/VotingSheet.tsx | tests/chatE.test.js | 미검증 | 미확보 |
| 540:1812 | 채팅방/약속 확정 확인 | 채팅 → 식당 정하기 → 후보/더 받기/직접 추가/방장 확정 (기존 S4 계약) | src/screens/chat/VotingSheet.tsx | tests/chatE.test.js | 미검증 | 미확보 |
| 540:1907 | 채팅방/약속 확정 | 채팅 → 식당 → 확정 → 정산 | src/components/ui/MeetingCard.tsx | tests/chatE.test.js | 미검증 | 미확보 |
| 548:1675 | 채팅방/정산 완료 · 방 종료 안내 | 채팅 → 식당 → 확정 → 정산 | src/components/ui/MeetingCard.tsx | tests/chatE.test.js | 미검증 | 미확보 |
| 563:1755 | 채팅방/식당 정하기 시트 · 방장이 아닐 때 | 채팅 → 식당 정하기 → 후보/더 받기/직접 추가/방장 확정 (기존 S4 계약) | src/screens/chat/VotingSheet.tsx | tests/chatE.test.js | 미검증 | 미확보 |
| 628:3074 | 채팅방/식당 정하기 · AI 추천 더 받음 | 채팅 → 식당 정하기 → 후보/더 받기/직접 추가/방장 확정 (기존 S4 계약) | src/screens/chat/VotingSheet.tsx | tests/chatE.test.js | 미검증 | 미확보 |
| 683:12975 | 채팅방/식당 추천 실패 | 채팅 → 식당 정하기 → 후보/더 받기/직접 추가/방장 확정 (기존 S4 계약) | src/screens/chat/VotingSheet.tsx | tests/chatE.test.js | 미검증 | 미확보 |
| 541:1617 | 정산/상세 | 홈 정산/채팅 정산 → 정산 상세 → 역할/멤버/로컬 지출 펼침/재알림 준비 | src/screens/settlement/SettlementDetailScreen.tsx | tests/settlementDetail.test.js | 미검증 | 미확보 |
| 541:1714 | 정산/상세 · 지출 내역 펼침 | 홈 정산/채팅 정산 → 정산 상세 → 역할/멤버/로컬 지출 펼침/재알림 준비 | src/screens/settlement/SettlementDetailScreen.tsx | tests/settlementDetail.test.js | 미검증 | 미확보 |
| 563:1936 | 정산/송금했어요 확인 | 홈 정산/채팅 정산 → 정산 상세 → 역할/멤버/로컬 지출 펼침/재알림 준비 | src/screens/settlement/SettlementDetailScreen.tsx | tests/settlementDetail.test.js | 미검증 | 미확보 |
| 588:1860 | 정산/상세 · 내 송금 완료 | 홈 정산/채팅 정산 → 정산 상세 → 역할/멤버/로컬 지출 펼침/재알림 준비 | src/screens/settlement/SettlementDetailScreen.tsx | tests/settlementDetail.test.js | 미검증 | 미확보 |
| 588:2024 | 정산/요청자 · 지출 내역 없음 | 홈 정산/채팅 정산 → 정산 상세 → 역할/멤버/로컬 지출 펼침/재알림 준비 | src/screens/settlement/SettlementDetailScreen.tsx | tests/settlementDetail.test.js | 미검증 | 미확보 |
| 588:2166 | 정산/요청자 · 지출 내역 있음 | 홈 정산/채팅 정산 → 정산 상세 → 역할/멤버/로컬 지출 펼침/재알림 준비 | src/screens/settlement/SettlementDetailScreen.tsx | tests/settlementDetail.test.js | 미검증 | 미확보 |
| 588:2320 | 정산/요청자 · 모두 완료 | 홈 정산/채팅 정산 → 정산 상세 → 역할/멤버/로컬 지출 펼침/재알림 준비 | src/screens/settlement/SettlementDetailScreen.tsx | tests/settlementDetail.test.js | 미검증 | 미확보 |
| 589:1867 | 정산/영수증 촬영 | 정산 상세 → 영수증 찍어서 올리기 → 권한/앨범/직접 입력 | src/screens/settlement/ReceiptCaptureFlow.tsx | tests/localAppFlows.test.js | 미검증 | 미확보 |
| 589:1890 | 정산/영수증 인식 결과 | 정산 상세 → 영수증 찍어서 올리기 → 권한/앨범/직접 입력 | src/screens/settlement/ReceiptCaptureFlow.tsx | tests/localAppFlows.test.js | 미검증 | 미확보 |
| 629:1858 | 정산/더보기 · 요청자 | 정산 상세 → 더보기 → 요청자/송금자/취소 확인 (연결 대기) | src/components/ui/SettlementMoreSheet.tsx | tests/settlementDetail.test.js | 미검증 | 미확보 |
| 629:1993 | 정산/더보기 · 보내는 사람 | 정산 상세 → 더보기 → 요청자/송금자/취소 확인 (연결 대기) | src/components/ui/SettlementMoreSheet.tsx | tests/settlementDetail.test.js | 미검증 | 미확보 |
| 629:2128 | 정산/정산 취소 확인 | 정산 상세 → 더보기 → 요청자/송금자/취소 확인 (연결 대기) | src/components/ui/SettlementMoreSheet.tsx | tests/settlementDetail.test.js | 미검증 | 미확보 |
| 629:2256 | 채팅방/정산 취소한 뒤 | AppNavigator → 해당 화면 | src/components/ui/SettlementMoreSheet.tsx | 개별 검증 미확인 | 미검증 | 미확보 |
| 629:2362 | 정산/요청자 · 알림 보냄 | 홈 정산/채팅 정산 → 정산 상세 → 역할/멤버/로컬 지출 펼침/재알림 준비 | src/screens/settlement/SettlementDetailScreen.tsx | tests/settlementDetail.test.js | 미검증 | 미확보 |
| 629:2461 | 정산/요청자 · 웰링에게 알림 보냄 | 홈 정산/채팅 정산 → 정산 상세 → 역할/멤버/로컬 지출 펼침/재알림 준비 | src/screens/settlement/SettlementDetailScreen.tsx | tests/settlementDetail.test.js | 미검증 | 미확보 |
| 683:13311 | 정산/영수증 촬영 · 카메라 권한 꺼짐 | 정산 상세 → 영수증 찍어서 올리기 → 권한/앨범/직접 입력 | src/screens/settlement/ReceiptCaptureFlow.tsx | tests/localAppFlows.test.js | 미검증 | 미확보 |
| 683:13350 | 정산/영수증 인식 실패 | 정산 상세 → 영수증 찍어서 올리기 → 권한/앨범/직접 입력 | src/screens/settlement/ReceiptCaptureFlow.tsx | tests/localAppFlows.test.js | 미검증 | 미확보 |
| 542:1534 | 밥약 기록/목록 | 프로필 → 밥약 기록 → 검색/월/예시 목록 | src/screens/history/MealHistoryScreen.tsx | tests/historyContact.test.js | 미검증 | 미확보 |
| 542:1633 | 밥약 기록/영수증 | 프로필 → 밥약 기록 → 로컬 예시 기록 보기 → 해당 영수증 | src/screens/history/MealReceiptScreen.tsx | tests/localAppFlows.test.js | 미검증 | 미확보 |
| 589:2147 | 밥약 기록/영수증 · 오늘 저녁팟 | 프로필 → 밥약 기록 → 로컬 예시 기록 보기 → 해당 영수증 | src/screens/history/MealReceiptScreen.tsx | tests/localAppFlows.test.js | app-receipt-dinner-412, app-receipt-dinner-375 | 미확보 |
| 601:3701 | 밥약 기록/영수증 · 이미지 저장됨 | 프로필 → 밥약 기록 → 로컬 예시 기록 보기 → 해당 영수증 | src/screens/history/MealReceiptScreen.tsx | tests/localAppFlows.test.js | app-receipt-412, app-receipt-375 | 미확보 |
| 601:3797 | 밥약 기록/영수증 · 오늘 저녁팟 · 저장됨 | 프로필 → 밥약 기록 → 로컬 예시 기록 보기 → 해당 영수증 | src/screens/history/MealReceiptScreen.tsx | tests/localAppFlows.test.js | 미검증 | 미확보 |
| 543:1609 | 초대 링크/웹 랜딩 | 홈 + → 초대 코드 또는 채팅 멤버 → 초대 | src/navigation/routes.ts | 개별 검증 미확인 | 미검증 | 미확보 |
| 543:1665 | 홈/초대 코드 입력 | 홈 + → 초대 코드 또는 채팅 멤버 → 초대 | src/components/JoinCodeSheet.tsx | 개별 검증 미확인 | 미검증 | 미확보 |
| 543:1777 | 시작/로딩 | 홈 + → 초대 코드 또는 채팅 멤버 → 초대 | src/components/ui/StartupLoading.tsx | 개별 검증 미확인 | 미검증 | 미확보 |
| 559:1657 | 홈/초대 코드 입력 · 오류 | 홈 + → 초대 코드 또는 채팅 멤버 → 초대 | src/components/JoinCodeSheet.tsx | 개별 검증 미확인 | 미검증 | 미확보 |
| 590:2533 | 홈/초대 코드 입력 · 6자리 완료 | 홈 + → 초대 코드 또는 채팅 멤버 → 초대 | src/components/JoinCodeSheet.tsx | 개별 검증 미확인 | 미검증 | 미확보 |
| 524:1318 | 일정 조율/캘린더 | 일정 탭 → 날짜/개인 일정 또는 새 밥약 → 시간 선택 | src/screens/schedule/ScheduleHomeScreen.tsx | tests/scheduleV3.test.js | 미검증 | 미확보 |
| 524:1572 | 새 밥약/어떻게 만날까요 | 일정 탭 → 날짜/개인 일정 또는 새 밥약 → 시간 선택 | src/screens/schedule/ScheduleDetailScreen.tsx | tests/scheduleV3.test.js | 미검증 | 미확보 |
| 524:1675 | 새 밥약/언제 만날까요 | 일정 탭 → 날짜/개인 일정 또는 새 밥약 → 시간 선택 | src/screens/schedule/S4ScheduleFlow.tsx | tests/scheduleV3.test.js | 미검증 | 미확보 |
| 524:1830 | 새 밥약/언제가 좋을까요 | 일정 탭 → 날짜/개인 일정 또는 새 밥약 → 시간 선택 | src/screens/schedule/S4ScheduleFlow.tsx | tests/scheduleV3.test.js | 미검증 | 미확보 |
| 559:1916 | 일정 조율/일정 추가 시트 | 일정 탭 → 날짜/개인 일정 또는 새 밥약 → 시간 선택 | src/screens/schedule/PersonalEventSheet.tsx | tests/scheduleV3.test.js | 미검증 | 미확보 |
| 599:2781 | 일정 조율/캘린더 · 10월 | 일정 탭 → 날짜/개인 일정 또는 새 밥약 → 시간 선택 | src/screens/schedule/ScheduleHomeScreen.tsx | tests/scheduleV3.test.js | 미검증 | 미확보 |
| 599:3036 | 일정 조율/캘린더 · 8월 | 일정 탭 → 날짜/개인 일정 또는 새 밥약 → 시간 선택 | src/screens/schedule/ScheduleHomeScreen.tsx | tests/scheduleV3.test.js | 미검증 | 미확보 |
| 599:3326 | 일정 조율/캘린더 · 27일 선택 | 일정 탭 → 날짜/개인 일정 또는 새 밥약 → 시간 선택 | src/screens/schedule/ScheduleHomeScreen.tsx | tests/scheduleV3.test.js | 미검증 | 미확보 |
| 599:3641 | 일정 조율/일정 수정 시트 | 일정 탭 → 날짜/개인 일정 또는 새 밥약 → 시간 선택 | src/screens/schedule/PersonalEventSheet.tsx | tests/scheduleV3.test.js | 미검증 | 미확보 |
| 599:3969 | 새 밥약/출발지 검색 | 일정 탭 → 날짜/개인 일정 또는 새 밥약 → 시간 선택 | src/screens/schedule/ScheduleDetailScreen.tsx | tests/scheduleV3.test.js | 미검증 | 미확보 |
| 599:4067 | 새 밥약/언제가 좋을까요 · 2순위 선택 | 일정 탭 → 날짜/개인 일정 또는 새 밥약 → 시간 선택 | src/screens/schedule/S4ScheduleFlow.tsx | tests/scheduleV3.test.js | 미검증 | 미확보 |
| 683:13139 | 새 밥약/시간 추천 실패 | 일정 탭 → 날짜/개인 일정 또는 새 밥약 → 시간 선택 | src/screens/schedule/S4ScheduleFlow.tsx | tests/scheduleV3.test.js | 미검증 | 미확보 |
| 683:18201 | 새 밥약/어떻게 만날까요 · 위치 권한 꺼짐 | 일정 탭 → 날짜/개인 일정 또는 새 밥약 → 시간 선택 | src/screens/schedule/ScheduleDetailScreen.tsx | tests/scheduleV3.test.js | app-location-412, app-location-375 | 미확보 |

생성: `node scripts/ui-preview/phoneCoverage.cjs`. 실행 산출물 `tmp/phone-coverage.json`에 파일 SHA-256을 보존한다. 표를 새로 생성해도 캡처나 테스트가 새로 실행되는 것은 아니다.
