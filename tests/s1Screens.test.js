const React = require('react');
const { act, create } = require('react-test-renderer');
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaProvider: ({ children }) => children, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../src/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../src/navigation/NavigationContext', () => ({ useNavigation: () => ({ goBack: jest.fn(), resetTo: jest.fn(), navigate: jest.fn() }) }));
jest.mock('../src/lib/profile', () => ({ saveMyPrivateProfile: jest.fn(async () => null) }));
jest.mock('../src/lib/confirm', () => ({ notify: jest.fn() }));
const { useAuth } = require('../src/auth/AuthProvider');
const { configureS1RpcTransport } = require('../src/lib/consents');
const { setConsentAccess, registerSensitiveConsentClearer } = require('../src/consents/access');
const { createS1Fixture } = require('./fixtures/s1');
const OptionalConsentControls = require('../src/screens/settings/OptionalConsentControls').default;
const OptionalConsentsScreen = require('../src/screens/settings/OptionalConsentsScreen').default;
const ReConsentScreen = require('../src/screens/auth/ReConsentScreen').default;
const { Checkbox } = require('../src/components/ui/Checkbox');
let fixture, renderer, auth;
const output = () => JSON.stringify(renderer.toJSON());
const button = label => renderer.root.findAll(node => typeof node.props.style === 'function' && node.props.accessibilityLabel === label && node.props.accessibilityRole === 'button')[0];
async function press(label) { await act(async () => button(label).props.onPress()); }
async function render(Screen, props) { await act(async () => { renderer = create(React.createElement(Screen, props)); }); }
beforeEach(() => {
  jest.clearAllMocks(); fixture = createS1Fixture(true); configureS1RpcTransport(fixture.rpc, require('./fixtures/s1').isolatedCapabilityStorage()); setConsentAccess('self', 'accepted');
  auth = { user: { id: 'self', email: 'fixture@example.test' }, signOut: jest.fn(async () => null) }; useAuth.mockReturnValue(auth);
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = undefined; configureS1RpcTransport(); setConsentAccess(null, 'loading'); });
it('shows actual optional grant dates and renewal deadlines while advertising remains disabled', async () => {
  await render(OptionalConsentControls, { manifest: fixture.manifest, status: fixture.status });
  await press('건강정보 동의하기');
  expect(output()).toContain('2027'); expect(output()).toContain('동의일');
  await press('마케팅 정보 수신 동의하기');
  expect(output()).toContain('2028'); expect(output()).toContain('현재 광고성 발송은 비활성');
});
it('does not announce deletion before a confirmed withdrawal and clears cache only after success', async () => {
  let complete;
  configureS1RpcTransport((name, args) => new Promise(resolve => { complete = () => fixture.rpc(name, args).then(resolve); }));
  const clear = jest.fn(), unsubscribe = registerSensitiveConsentClearer(clear);
  await render(OptionalConsentControls, { manifest: null, status: null, withdrawalOnly: true });
  await press('건강정보 동의 철회');
  expect(output()).not.toContain('삭제했어요'); expect(clear).not.toHaveBeenCalled();
  await act(async () => complete()); expect(output()).toContain('동의를 철회하고 건강정보를 삭제했어요'); expect(clear).toHaveBeenCalledTimes(1);
  expect(fixture.calls[0].args).toMatchObject({ p_document_version: null, p_content_hash: null, p_expected_revision: null }); unsubscribe();
});
it('keeps the same request id after an uncertain failure without a false withdrawal toast', async () => {
  const calls = []; let first = true;
  configureS1RpcTransport(async (name, args) => { calls.push(args); if (first) { first = false; throw new Error('private failure'); } return fixture.rpc(name, args); });
  await render(OptionalConsentControls, { manifest: null, status: null, withdrawalOnly: true });
  await press('건강정보 동의 철회'); expect(output()).not.toContain('삭제했어요'); expect(output()).not.toContain('private failure');
  await press('건강정보 동의 철회'); expect(calls[1].p_request_id).toBe(calls[0].p_request_id); expect(output()).toContain('삭제했어요');
});
it('keeps withdrawal feedback visible while the settings screen reloads the confirmed server state', async () => {
  await render(OptionalConsentsScreen);
  await press('건강정보 동의 철회');
  expect(output()).toContain('동의를 철회하고 건강정보를 삭제했어요');
  expect(output()).toContain('철회');
  expect(fixture.calls.filter(call => call.name === 'get_my_consent_status')).toHaveLength(2);
});
it('reconsent sends only two required documents and preserves optional choices/revisions', async () => {
  fixture.status = { ...fixture.status, required: { status: 'required', service_agreed: false, privacy_agreed: false }, health: { ...fixture.status.health, status: 'withdrawn', revision: '3' }, marketing: { ...fixture.status.marketing, status: 'declined', revision: '5' } };
  const onDone = jest.fn();
  await render(ReConsentScreen, { manifest: fixture.manifest, status: fixture.status, onDone });
  const root = renderer.root;
  expect(root.findAllByType(Checkbox)).toHaveLength(3);
  await act(async () => root.findAllByType(Checkbox)[0].props.onChange(true));
  await press('동의하고 계속하기');
  const call = fixture.calls.find(call => call.name === 'record_required_consents');
  expect(Object.keys(call.args.p_documents)).toEqual(['service', 'privacy']);
  expect(call.args.p_choices).toEqual({ service: true, privacy: true });
  expect(fixture.status.health.revision).toBe('3'); expect(fixture.status.marketing.revision).toBe('5'); expect(onDone).toHaveBeenCalledTimes(1);
});
it('shows both unchecked optional choices again for expired signup pending with zero revisions', async () => {
  fixture.status = require('./fixtures/s1').s1Status(false);
  await render(ReConsentScreen, { manifest: fixture.manifest, status: fixture.status, signupReview: true, onDone: jest.fn() });
  const checks = renderer.root.findAllByType(Checkbox);
  expect(checks).toHaveLength(5); expect(checks[3].props.checked).toBe(false); expect(checks[4].props.checked).toBe(false);
  await act(async () => { checks[1].props.onChange(true); });
  await act(async () => { renderer.root.findAllByType(Checkbox)[2].props.onChange(true); });
  await press('동의하고 계속하기');
  expect(fixture.calls.find(call => call.name === 'complete_signup_consents').args.p_choices).toEqual({ service: true, privacy: true, health: false, marketing: false });
});
it('resets required choices and displays new server text after DOCUMENT_CHANGED', async () => {
  let first = true;
  configureS1RpcTransport(async (name, args) => {
    if (name === 'record_required_consents' && first) { first = false; return { data: null, error: { code: 'S1002' } }; }
    return fixture.rpc(name, args);
  });
  await render(ReConsentScreen, { manifest: fixture.manifest, onDone: jest.fn() });
  await act(async () => renderer.root.findAllByType(Checkbox)[0].props.onChange(true));
  await press('동의하고 계속하기');
  expect(renderer.root.findAllByType(Checkbox)[1].props.checked).toBe(false);
  expect(button('동의하고 계속하기').props.disabled).toBe(true);
  expect(output()).toContain('문서가 바뀌었어요');
});
it('resets reconsent choices and the open document when a new manifest prop arrives', async () => {
  const props = { manifest: fixture.manifest, onDone: jest.fn() };
  await render(ReConsentScreen, props);
  await act(async () => renderer.root.findAllByType(Checkbox)[0].props.onChange(true));
  await press('[필수] 서비스 이용약관 동의 보기');
  const LegalSheet = require('../src/screens/settings/LegalDocumentSheet').default;
  expect(renderer.root.findAllByType(LegalSheet).some(node => node.props.view !== null)).toBe(true);
  await act(async () => renderer.update(React.createElement(ReConsentScreen, { ...props, manifest: { ...fixture.manifest, bundle_version: 'updated' } })));
  expect(renderer.root.findAllByType(Checkbox).every(node => !node.props.checked)).toBe(true);
  expect(renderer.root.findAllByType(LegalSheet).every(node => node.props.view === null)).toBe(true);
  expect(button('동의하고 계속하기').props.disabled).toBe(true);
});
it('shows only gate-exempt controls on status failure and exposes an honest S2 deletion placeholder', async () => {
  configureS1RpcTransport(async () => ({ data: null, error: { code: 'S1006' } }));
  await render(ReConsentScreen, { gateError: true, onDone: jest.fn() });
  expect(output()).toContain('동의 상태를 확인하지 못했어요');
  expect(button('동의하고 계속하기').props.disabled).toBe(true);
  expect(button('건강정보 동의하기')).toBeUndefined(); expect(button('건강정보 동의 철회')).toBeDefined();
  expect(button('나중에 하기 (로그아웃)')).toBeDefined();
  await press('계정 삭제 안내'); expect(output()).toContain('아직 계정을 삭제하지 않았어요'); expect(button('계정 삭제')).toBeUndefined();
});
