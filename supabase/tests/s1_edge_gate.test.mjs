import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { runEdgeVm } from './edge_vm.mjs';
import ts from 'typescript';

const gateSource = await fs.readFile(new URL('../functions/schedule-recommend/consentGate.ts', import.meta.url), 'utf8');
const handlerSource = await fs.readFile(new URL('../functions/schedule-recommend/index.ts', import.meta.url), 'utf8');
const gateModule = { exports: {} };
const gateDiagnostics = [];
runEdgeVm(ts.transpileModule(gateSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: gateModule.exports, module: gateModule, Response, AbortSignal, console: { error: (message) => gateDiagnostics.push(message) } });
const { checkRequiredConsent, checkRoomPermission } = gateModule.exports;
const accepted = { contract_version: 1, bundle_version: 'synthetic', required: { status: 'accepted', service_agreed: true, privacy_agreed: true } };
for (const [label, payload, status] of [
  ['pending', { ...accepted, required: { ...accepted.required, status: 'required', privacy_agreed: false } }, 403],
  ['empty', null, 503],
  ['missing flags', { ...accepted, required: { status: 'accepted' } }, 503],
  ['contradictory', { ...accepted, required: { ...accepted.required, privacy_agreed: false } }, 403],
]) {
  test(label + ' blocks actual handler before admin and provider calls', async () => {
    let adminCalls = 0, providerCalls = 0;
    const module = { exports: {} };
    const mockFetch = async (url) => {
      if (String(url).includes('/rpc/get_my_consent_status')) return Response.json(payload);
      providerCalls++; throw new Error('Unexpected provider call');
    };
    const requireMock = (id) => {
      if (id === '@supabase/server') return { withSupabase: (_options, handler) => handler };
      if (id === './consentGate.ts') return { checkRequiredConsent: (...args) => checkRequiredConsent(...args, mockFetch) };
      if (id === './pipeline.ts') return {
        validateRequest: () => ({ ok: true, data: { roomId: 'synthetic', placeCandidates: [] } }),
        validateUserClaims: () => ({ ok: true, data: { userId: 'synthetic-user' } }),
        callGeminiWithRetry: () => { providerCalls++; throw new Error('Unexpected provider call'); },
      };
      if (id.startsWith('@supabase/functions-js')) return {};
      throw new Error('Unexpected import');
    };
    runEdgeVm(ts.transpileModule(handlerSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
      exports: module.exports, module, require: requireMock,
      Deno: { env: { get: (name) => name === 'GEMINI_API_KEY' ? undefined : name === 'SUPABASE_URL' ? 'http://127.0.0.1:55321' : 'synthetic-test-value' } },
      Response, Request, TextEncoder, AbortSignal, console: { error() {}, warn() {} },
      fetch: mockFetch,
    });
    const response = await module.exports.default.fetch(new Request('http://127.0.0.1/test', { method: 'POST', headers: { Authorization: 'Bearer synthetic-noncredential' }, body: '{}' }), {
      jwtClaims: {}, userClaims: { id: 'synthetic-user' }, supabaseAdmin: { from() { adminCalls++; throw new Error('Unexpected admin read'); } },
    });
    assert.equal(response.status, status);
    assert.equal(adminCalls, 0); assert.equal(providerCalls, 0);
  });
}
test('accepted passes and sends only empty control payload using original user authorization', async () => {
  const result = await checkRequiredConsent('http://127.0.0.1:55321', 'synthetic-public', 'Bearer synthetic-noncredential', async (_url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer synthetic-noncredential');
    assert.equal(options.body, '{}'); return Response.json(accepted);
  });
  assert.equal(result, null);
});
test('RPC rejection and transport error fail closed', async () => {
  for (const fn of [async () => new Response('', { status: 500 }), async () => { throw new Error('offline'); }]) {
    assert.equal((await checkRequiredConsent('http://127.0.0.1', 'synthetic', 'Bearer synthetic', fn)).status, 503);
  }
});

test('legacy room permission is resolved with user-scoped RPC before privileged access', async () => {
  let calls = 0;
  assert.equal(await checkRoomPermission('http://127.0.0.1', 'synthetic', 'Bearer synthetic', 'room', async (url, options) => {
    calls++; assert.ok(url.endsWith('/rpc/room_availability_status'));
    assert.equal(options.headers.Authorization, 'Bearer synthetic');
    assert.deepEqual(JSON.parse(options.body), { target_room: 'room' });
    return Response.json([{ participant_id: 'synthetic' }]);
  }), null);
  assert.equal(calls, 1);
  assert.equal((await checkRoomPermission('http://127.0.0.1', 'synthetic', 'Bearer synthetic', 'room', async () => Response.json([]))).status, 403);
  assert.equal((await checkRoomPermission('http://127.0.0.1', 'synthetic', 'Bearer synthetic', 'room', async () => Response.json({ code: 'S1001' }, { status: 400 }))).status, 403);
  assert.equal((await checkRoomPermission('http://127.0.0.1', 'synthetic', 'Bearer synthetic', 'room', async () => Response.json({}, { status: 500 }))).status, 503);
  const legacySource=handlerSource.slice(handlerSource.indexOf('const legacy ='));
  assert.ok(legacySource.indexOf('const roomPermissionFailure')>=0 && legacySource.indexOf('const roomPermissionFailure') < legacySource.indexOf('ctx.supabaseAdmin'));
});

test('missing public key fails closed and logs only the configuration field name', async () => {
  gateDiagnostics.length = 0;
  let calls = 0;
  const response = await checkRequiredConsent('http://127.0.0.1', undefined, 'Bearer synthetic-never-log', async () => { calls++; throw new Error('must not call'); });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { code: 'S1006', error: 'CONSENT_STATUS_UNAVAILABLE' });
  assert.equal(calls, 0);
  assert.deepEqual(gateDiagnostics, ['S1_GATE_CONFIG_MISSING: SUPABASE_ANON_KEY']);
  assert.ok(!JSON.stringify(gateDiagnostics).includes('Bearer'));
});

test('gate helper typechecks strictly without emitting runtime artifacts', () => {
  const file = new URL('../functions/schedule-recommend/consentGate.ts', import.meta.url);
  const program = ts.createProgram([file.pathname.replace(/^\/([A-Za-z]:)/, '$1')], { strict: true, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022, lib: ['lib.es2022.d.ts','lib.dom.d.ts'], types: [] });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0, diagnostics.map((d)=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join('\n'));
});
