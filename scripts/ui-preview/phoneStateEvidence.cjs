/** Bind executed UI assertions to original nodes. Never substitutes file existence for execution. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const resultPath = 'tmp/phone-state-test-results.json';
const results = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
const source = JSON.parse(fs.readFileSync('tmp/phone-coverage.json', 'utf8'));
const root = process.cwd();
const executed = results.testResults.flatMap(suite => suite.assertionResults.map(test => ({ ...test, file: path.relative(root, suite.name).replaceAll('\\', '/') })));
const rows = source.rows.map(node => {
  const tests = executed.filter(test => test.fullName.includes(`[phone ${node.id}]`));
  const passed = tests.length > 0 && tests.every(test => test.status === 'passed');
  return { id: node.id, name: node.name, component: node.file, entry: node.entry, captures: node.evidence,
    verified: passed,
    assertions: tests.map(test => {
      const code = fs.readFileSync(test.file, 'utf8');
      let offset = code.indexOf(`[phone ${node.id}]`);
      if (offset < 0) offset = code.indexOf(`'${node.id}'`);
      if (offset < 0) throw Error('Missing explicit test binding: ' + node.id);
      return { fixtureAndAssertion: test.fullName.replace(/\[phone [\d:]+\]/g, '').trim(), file: test.file, line: code.slice(0, offset).split('\n').length, status: test.status, sourceHash: crypto.createHash('sha256').update(code).digest('hex') };
    }),
  };
});
const missing = rows.filter(row => !row.verified);
if (missing.length) { console.error('Missing or failed state assertions:', missing.map(row => row.id).join(', ')); process.exitCode = 1; }
const chain = executed.find(test => test.fullName === 'real AppNavigator carries shabu local selection through restaurant confirmation and the returned bill');
const report = { originalNodes: rows.length, verifiedNodes: rows.length - missing.length, missingNodes: missing.map(row => row.id), resultPath, testResultsHash: crypto.createHash('sha256').update(fs.readFileSync(resultPath)).digest('hex'), shabuNavigatorChain: chain?.status ?? 'not-run', rows };
fs.writeFileSync('tmp/phone-state-evidence.json', JSON.stringify(report, null, 2));
const lines = [
  '# Phone 163노드 상태별 실행 근거', '',
  `원본: 2026-10-20 로컬 Phone 01~11 추출본. 전체 ${rows.length}개, 상태별 assertion 통과 ${report.verifiedNodes}개, 누락/실패 ${missing.length}개. 아래 근거는 실제 src 컴포넌트를 렌더한 테스트 결과이며, 파일 존재나 동일 이미지 복제로 집계하지 않았다.`, '',
  '각 행은 원본 ID → 앱 진입 → 실제 컴포넌트 → fixture 조건과 assertion이 있는 테스트에 연결한다. 한 테스트가 여러 노드를 검증한 경우에는 해당 전후 상태를 각각 연결한다(예: 이모티콘 패널 열기/전송 후 표시, 메이트 검색 결과/추가 후 토스트). 테스트 소스의 해당 줄과 실행 결과를 함께 확인한다.', '',
  '지정된 로컬 상태와 승인 차이 D01~D04, 서버 연결 대기 대응을 검증한 수치다. 원본 완료 문구와 처리 결과가 동일하다는 의미가 아니다. 신고/차단/문의/탈퇴/재알림/저장/취소는 연결되지 않은 경우 성공을 주장하지 않는 assertion을 포함한다. 개인정보 공개는 현재 서버 계약을 기준으로 최소 노출한다.', '',
  '전체 원본과의 픽셀 일치 검수·실제 서버 E2E·배포는 검증하지 않았다. 원본 PNG 70개 확보/93개 미확보, 실제 앱 브라우저 캡처는 17고유노드/34장이다. 최신 원격 Figma 도구는 현재 세션에 없어 새 조회를 수행하지 못했다.', '',
  `샤브샤브 단계별 UI·route 검증: **${report.shabuNavigatorChain}**. LocalMenu → ChatRoom/VotingSheet → 약속 확인 → N빵 SettlementSheet → 반환 bill의 SettlementDetail을 실제 navigator로 이동하되 전송과 서버 상태는 단계별로 테스트 대역/fixture를 주입한다. 실제 서버 E2E 성공이나 자연스러운 서버 상태 전파를 검증한 것은 아니다. 실제 서버 변경은 하지 않는다.`, '',
  '| 노드 | 원본 상태 | 앱 진입 | 실제 컴포넌트 | fixture 조건 / assertion 실행 근거 |',
  '|---|---|---|---|---|',
  ...rows.map(row => `| ${row.id} | ${row.name} | ${row.entry} | ${row.component} | ${row.assertions.map(assertion => `[${assertion.fixtureAndAssertion.replaceAll('|', '/')}](../${assertion.file}#L${assertion.line}) — ${assertion.status}`).join('<br>') || '미검증'} |`), '',
  '실행 결과: `tmp/phone-state-test-results.json`, 검증 manifest: `tmp/phone-state-evidence.json`. manifest에는 테스트 소스와 실행 결과 SHA-256을 보존했다. 생성 명령: `node scripts/ui-preview/phoneCoverage.cjs` 후 `node scripts/ui-preview/phoneStateEvidence.cjs`. 생성 명령은 테스트를 새로 실행하지 않는다.',
];
fs.writeFileSync('docs/figma-phone-state-evidence.md', lines.join('\n') + '\n');
console.log(JSON.stringify({ originalNodes: rows.length, verifiedNodes: report.verifiedNodes, missing: missing.length, chain: report.shabuNavigatorChain }));
