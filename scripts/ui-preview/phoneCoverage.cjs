/** Read-only source audit; does not run Figma, Supabase, or fabricate render evidence. */
const fs = require('node:fs');
const crypto = require('node:crypto');
const prototype = JSON.parse(fs.readFileSync('tmp/figma-proto/prototype.json', 'utf8'));
const inventory = JSON.parse(fs.readFileSync('tmp/figma-audit/inventory.json', 'utf8').replace(/^\uFEFF/, ''));
const audit = fs.readFileSync('tmp/figma-audit/REPORT.md', 'utf8');
const captures = fs.existsSync('tmp/local-app-render/review-metrics.json') ? JSON.parse(fs.readFileSync('tmp/local-app-render/review-metrics.json', 'utf8')).evidence : [];
const fixes = [
  [/정산.*송금.*계좌 등록/, 'src/screens/settlement/SettlementAccountForm.tsx', '채팅 → N빵 정산 → 계좌 등록하기 → 은행/계좌번호/예금주 로컬 초안', 'tests/chatE.test.js'],
  [/메뉴 정하기|메뉴 변경 확인/, 'src/screens/chat/LocalMenuScreen.tsx', '채팅 + → 메뉴 정하기 · 로컬 → 선택/평가/의견 갈림/새 후보/확정/변경', 'tests/localAppFlows.test.js'],
  [/밥약 기록.*영수증/, 'src/screens/history/MealReceiptScreen.tsx', '프로필 → 밥약 기록 → 로컬 예시 기록 보기 → 해당 영수증', 'tests/localAppFlows.test.js'],
  [/밥약 기록/, 'src/screens/history/MealHistoryScreen.tsx', '프로필 → 밥약 기록 → 검색/월/예시 목록', 'tests/historyContact.test.js'],
  [/알림 설정/, 'src/screens/settings/NotificationPreferencesScreen.tsx', '프로필 → 설정 → 알림 설정', 'tests/localAppFlows.test.js'],
  [/계정 삭제|비밀번호 확인|탈퇴 완료/, 'src/screens/settings/AccountDeletionScreen.tsx', '프로필 → 설정 → 계정 삭제 → 확인 → 요청 준비 (실제 삭제 아님)', 'tests/localAppFlows.test.js'],
  [/문의하기/, 'src/screens/settings/ContactScreen.tsx', '프로필 → 설정 → 문의하기', 'tests/historyContact.test.js'],
  [/메시지.*신고|신고하기|차단 확인|신고 접수|차단한 뒤/, 'src/screens/chat/MessageSafetySheet.tsx', '채팅 타인 메시지 길게 → 신고/차단 → 요청 (연결 대기)', 'tests/localAppFlows.test.js'],
  [/답장 쓰기|메시지 전송 실패/, 'src/screens/chat/ChatRoomScreen.tsx', '채팅 메시지 길게 → 답장/전송 실패 → 재시도', 'tests/chatE.test.js'],
  [/영수증 촬영|영수증 인식 실패|영수증 인식 결과/, 'src/screens/settlement/ReceiptCaptureFlow.tsx', '정산 상세 → 영수증 찍어서 올리기 → 권한/앨범/직접 입력', 'tests/localAppFlows.test.js'],
  [/정산\/더보기|정산 취소 확인/, 'src/components/ui/SettlementMoreSheet.tsx', '정산 상세 → 더보기 → 요청자/송금자/취소 확인 (연결 대기)', 'tests/settlementDetail.test.js'],
  [/^정산\//, 'src/screens/settlement/SettlementDetailScreen.tsx', '홈 정산/채팅 정산 → 정산 상세 → 역할/멤버/로컬 지출 펼침/재알림 준비', 'tests/settlementDetail.test.js'],
  [/식당 정하기|식당 직접 추가|식당 추천 실패|약속 확정 확인/, 'src/screens/chat/VotingSheet.tsx', '채팅 → 식당 정하기 → 후보/더 받기/직접 추가/방장 확정 (기존 S4 계약)', 'tests/chatE.test.js'],
];
const sections = {
  '01': ['시작 → 로그인/회원가입/재설정/약관', 'tests/authUi.integration.test.js'],
  '02': ['회원가입 또는 프로필 → 음식 프로필 → 단계/선택', 'tests/s5FoodScreens.test.js'],
  '03': ['홈 + → 초대 코드 또는 채팅 멤버 → 초대', 'tests/roomLifecycle.test.js'],
  '04': ['홈 → +/알림/정산 또는 방 생명주기 성공 후 홈', 'tests/homeC.test.js'],
  '05': ['일정 탭 → 날짜/개인 일정 또는 새 밥약 → 시간 선택', 'tests/scheduleV3.test.js'],
  '06': ['프로필 → 편집/메이트/공개 범위/출발지/설정', 'tests/profileD.integration.test.js'],
  '08': ['채팅 → 메시지/식당/정산 (샤브샤브는 데이터 분기)', 'tests/chatE.test.js'],
  '09': ['채팅 → +/메시지 길게/방 상세/멤버', 'tests/chatE.test.js'],
  '10': ['채팅 → 식당 → 확정 → 정산', 'tests/chatE.test.js'],
};
const rows = prototype.frames.map(frame => {
  const old = audit.split('\n').find(line => line.startsWith('| ') && line.includes(`node-id=${frame.id.replace(':', '-')})`));
  const oldFile = old?.match(/\[(src\/[^\]:]+):\d+\]/)?.[1];
  const section = frame.sectionName.slice(0, 2);
  const fix = fixes.find(([pattern]) => pattern.test(frame.name));
  const file = fix?.[1] ?? oldFile;
  if (!file || !fs.existsSync(file)) throw Error('Missing current source: ' + frame.id + ' ' + file);
  const entry = fix?.[2] ?? sections[section]?.[0] ?? 'AppNavigator → 해당 화면';
  const suite = fix?.[3] ?? sections[section]?.[1];
  const evidence = captures.filter(capture => capture.node === frame.id).map(capture => capture.name);
  const capture = `tmp/figma-audit/captures/figma/${frame.id.replace(':', '-')}.png`;
  return { ...frame, file, entry, suite: suite && fs.existsSync(suite) ? suite : null, evidence, sourceCapture: fs.existsSync(capture), hash: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') };
});
const missingInventory = inventory.filter(frame => !rows.some(row => row.id === frame.id));
const missingPrototype = rows.filter(row => !inventory.some(frame => row.id === frame.id));
if (missingInventory.length || missingPrototype.length) throw Error('Inventory mismatch');
const lines = [
  '# Phone 원본 → 현재 앱 대응표', '',
  '기준: 2026-10-28 현재 로컬 소스. Figma euLZpuvJsmuOhVKwtDkdhJ / Phone 478:9398의 **2026-10-20 추출본**. 최신 원격 Figma 조회는 수행하지 못했다.', '',
  `원본 frames ${rows.length}개와 inventory ${inventory.length}개 ID 집합 일치, 대응 파일 누락 0. **이 수치는 구현·동작·시각 누락 0을 뜻하지 않는다.** 기존 REPORT의 일치/누락 분류를 현재 판정으로 복사하지 않았다.`, '',
  '추출기는 01~11 섹션 직하 FRAME 중 너비 390 이상·높이 700 이상을 reactions 유무와 무관하게 수집했다. 00 컴포넌트, 작은 프레임, 중첩 화면, Tablet/Page 1/취향게임은 이 완전성 수치에 포함되지 않는다. phone-metadata.xml 및 inventory.json은 같은 시점 자료이므로 최신성의 독립 증거가 아니다.', '',
  '진입 열은 현재 route/컴포넌트 기준 정적 대응이다. 캡처가 없는 행은 화면별 브라우저 검증 미완료다. 테스트 열은 관련 회귀 검증 위치이며 해당 원본 프레임의 픽셀 검증을 의미하지 않는다. `미확보`는 원본 캡처가 없는 행이다.', '',
  '서버 없는 처리(삭제/신고/차단/재알림/저장)는 실제 완료 대신 준비·연결 대기로 표시한다. S4 식당 투표 계약은 유지한다. 샤브샤브 메뉴→식당→정산 이동은 실제 AppNavigator와 전송 대역으로 검증했으며, 상태별 실행 근거는 figma-phone-state-evidence.md를 따른다. 실제 서버 연속 성공은 검증하지 않았다. 건강/출발지 미결 및 D01~D04 차이는 승인 완료로 판정하지 않는다.', '',
  '| 노드 | 원본 화면 | 앱 진입 / 상태 | 현재 파일 | 관련 테스트 | 실제 앱 캡처 | 원본 캡처 |',
  '|---|---|---|---|---|---|---|',
  ...rows.map(row => `| ${row.id} | ${row.name} | ${row.entry} | ${row.file} | ${row.suite ?? '개별 검증 미확인'} | ${row.evidence.join(', ') || '미검증'} | ${row.sourceCapture ? '확보' : '미확보'} |`), '',
  '생성: `node scripts/ui-preview/phoneCoverage.cjs`. 실행 산출물 `tmp/phone-coverage.json`에 파일 SHA-256을 보존한다. 표를 새로 생성해도 캡처나 테스트가 새로 실행되는 것은 아니다.',
];
fs.writeFileSync('docs/figma-phone-app-coverage.md', lines.join('\n') + '\n');
fs.writeFileSync('tmp/phone-coverage.json', JSON.stringify({ count: rows.length, unmapped: 0, rows }, null, 2));
console.log(JSON.stringify({ frames: rows.length, inventory: inventory.length, sourceCaptures: rows.filter(row => row.sourceCapture).length, appCapturedNodes: rows.filter(row => row.evidence.length).length, unmappedFiles: 0 }));
