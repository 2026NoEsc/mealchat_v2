import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { checkState, repositoryState } from '../release/check.mjs';
import { m7WithTestValues } from './s1_m7_local.mjs';
const current=repositoryState();
const base={...current,m7:null,held:m7WithTestValues({version:null,effective_from:null,content_hash:null,canonical_content:null})};
const now=Date.parse('2026-10-17T12:00:00Z');
const testFixture=JSON.parse(readFileSync(new URL('./s1_m7_test_values.json',import.meta.url),'utf8'));
function privacyAt(date) {
 const [year,month,day]=date.split('-');
 // Pure in-memory approval fixture. No release artifact or SQL file is changed.
 const doc=JSON.parse(current.appDocuments.privacy.canonical_content);
 doc.edition=2;doc.effectiveDate=year+'년 '+Number(month)+'월 '+Number(day)+'일';
 const canonical_content=JSON.stringify(doc)+'\n';
 return {version:'privacy-'+date+'-v2',edition:2,effective_from:new Date(Date.parse(date+'T00:00:00+09:00')).toISOString(),canonical_content,content_hash:createHash('sha256').update(canonical_content).digest('hex')};
}
const fixture=privacyAt('2026-10-08');
const approvedState=privacy=>({...base,m7:m7WithTestValues(privacy),held:null,privacyRelease:{release:{effective_from:privacy.effective_from,bundle_version:privacy.version.replace('privacy-','mealchat-').replace('-v2','-r2')},privacy}});
const ready=approvedState(fixture);
test('development check accepts held M7 while reporting deployment blocked',()=>assert.equal(checkState(base,{deployment:false,now}).ready,false));
test('deployment blocks M6 without M7',()=>assert.throws(()=>checkState(base,{now}),/M7_REQUIRED/));
test('placeholder M7 in migrations fails even during development quality',()=>assert.throws(()=>checkState({...base,m7:base.held,held:null},{deployment:false,now}),/UNFINALIZED_DOCUMENT/));
test('verified finalized M7 matching approved generated data can pass',()=>assert.equal(checkState(ready,{now}).ready,true));
test('duplicated release template and migration are rejected',()=>assert.throws(()=>checkState({...ready,held:base.held},{now}),/DUPLICATE_M7/));
test('seed content cannot be copied into migration input',()=>assert.throws(()=>checkState({...ready,migrations:[...base.migrations,'privacy-local-dev-v2']},{now}),/TEST_DATA_IN_MIGRATIONS/));
test('disabled or stale local seeding fails development quality',()=>{assert.throws(()=>checkState({...base,config:base.config.replace(/(\[db\.seed\][\s\S]*?)enabled\s*=\s*true/,(_all,prefix)=>prefix+'enabled = false')},{deployment:false,now}),/LOCAL_SEED/);assert.throws(()=>checkState({...base,seedCurrent:false},{deployment:false,now}),/LOCAL_SEED/);});
test('canonical and effective date mismatch blocks deployment',()=>assert.throws(()=>checkState({...ready,m7:m7WithTestValues({effective_from:'2099-12-31T15:00:00Z'})},{now}),/PRIVACY_DATE_MISMATCH/));
test('missing generated privacy approval fails deployment',()=>assert.throws(()=>checkState({...ready,privacyRelease:{release:null,privacy:null}},{now}),/APPROVED_PRIVACY_REQUIRED/));
test('app canonical mismatch and broken privacy hash fail deployment',()=>{assert.throws(()=>checkState({...ready,appDocuments:{...base.appDocuments,health:{...base.appDocuments.health,version:'changed'}}},{now}),/APP_DOCUMENT_MISMATCH/);assert.throws(()=>checkState({...ready,m7:m7WithTestValues({content_hash:'0'.repeat(64)})},{now}),/UNFINALIZED_DOCUMENT/);});

test('development M7 audit does not require approved release artifact or deployment date to arrive',()=>{
 const doc=JSON.parse(fixture.canonical_content);doc.effectiveDate='2100년 1월 1일';const canonical_content=JSON.stringify(doc)+'\n';
 const future=m7WithTestValues({...fixture,version:'privacy-2100-01-01-v2',effective_from:'2099-12-31T15:00:00Z',canonical_content,content_hash:createHash('sha256').update(canonical_content).digest('hex')});
 assert.equal(checkState({...ready,m7:future,privacyRelease:{release:null,privacy:null}},{deployment:false,now}).ready,false);
 assert.throws(()=>checkState({...ready,m7:future},{now}),/NOT_EFFECTIVE_OR_FINAL/);
});


test('privacy edition two must take effect strictly after edition one in KST',()=>{
 for(const date of ['2026-09-30','2026-10-01'])assert.throws(()=>checkState(approvedState(privacyAt(date)),{now}),/NOT_AFTER_EDITION_ONE/);
 assert.equal(checkState(approvedState(privacyAt('2026-10-02')),{now}).ready,true);
});

test('the historical M7 test privacy fixture cannot be released',()=>assert.throws(()=>checkState(approvedState(testFixture),{now}),/NOT_AFTER_EDITION_ONE|TEST_PRIVACY_FORBIDDEN/));

test('retiming the synthetic test document does not make it publishable',()=>{
 const retimed={...fixture};const doc=JSON.parse(testFixture.canonical_content);doc.effectiveDate='2026년 10월 8일';
 retimed.canonical_content=JSON.stringify(doc)+'\n';retimed.content_hash=createHash('sha256').update(retimed.canonical_content).digest('hex');
 assert.throws(()=>checkState(approvedState(retimed),{now}),/TEST_PRIVACY_FORBIDDEN/);
 assert.throws(()=>checkState(approvedState(retimed),{deployment:false,now}),/TEST_PRIVACY_FORBIDDEN/);
});

test('privacy version date must match its effective KST date',()=>assert.throws(()=>checkState(approvedState({...fixture,version:'privacy-2026-10-09-v2'}),{now}),/PRIVACY_DATE_MISMATCH/));
