// Read-only gate. Default is strict deployment mode; no network or credentials.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedIsCurrent } from '../tests/s1_seed.mjs';
const here=dirname(fileURLToPath(import.meta.url)), root=resolve(here,'../..');
export const m7Name='20261017100000_s1_activate_terms.sql';
const firstPrivacyEffective=Date.parse('2026-09-30T15:00:00Z'); // 1st edition: 2026-10-01 00:00 KST.
const testPrivacy=JSON.parse(readFileSync(new URL('../tests/s1_m7_test_values.json',import.meta.url),'utf8'));
const fail=message=>{throw new Error(message);};
function block(sql,name) {
 const match=sql?.match(new RegExp('\\$'+name+'\\$([\\s\\S]*?)\\$'+name+'\\$::jsonb;'));
 if(!match)fail('S1_RELEASE_INVALID_CONSTANT_BLOCK: '+name);
 return JSON.parse(match[1]);
}
function verifiedDocument(doc) {
 if(!doc||typeof doc.version!=='string'||/local-dev|s1-test|synthetic|pending|placeholder|__/.test(doc.version)||!Number.isInteger(doc.edition)||doc.edition<1||typeof doc.canonical_content!=='string'||!doc.canonical_content.endsWith('\n')||!/^[a-f0-9]{64}$/.test(doc.content_hash??'')||createHash('sha256').update(doc.canonical_content).digest('hex')!==doc.content_hash)fail('S1_RELEASE_UNFINALIZED_DOCUMENT');
 const data=JSON.parse(doc.canonical_content);
 if(data.edition!==doc.edition)fail('S1_RELEASE_EDITION_MISMATCH');
 return data;
}
export function checkState(state,{deployment=true,now=Date.now()}={}) {
 if(state.migrations.some(s=>/local-dev|supabase\/seed\.sql|s1_m7_test_values|m7-test\.sql/.test(s)))fail('S1_RELEASE_TEST_DATA_IN_MIGRATIONS');
 if(!state.m6) {if(state.m7)fail('S1_RELEASE_M6_REQUIRED');return {ready:true,reason:'No S1 M6 gate present'};}
 if(!deployment) {
  const seedConfig=state.config.match(/\[db\.seed\]([\s\S]*?)(?=\n\[|$)/)?.[1]??'';
  if(!/enabled\s*=\s*true/.test(seedConfig)||!/sql_paths\s*=\s*\[\s*['"]\.\/seed\.sql['"]\s*\]/.test(seedConfig)||!state.seedCurrent)fail('S1_LOCAL_SEED_MISSING_OR_STALE');
 }
 if(!state.m7) {
  if(deployment)fail('S1_RELEASE_M7_REQUIRED: M6 cannot be deployed without finalized M7');
  return {ready:false,reason:'M7 held outside migrations; deployment is BLOCKED'};
 }
 if(!state.m7.includes('S1_ACTIVATION_CONFIGURATION_REQUIRED')||!state.m7.includes('S1_ACTIVATION_NOT_EFFECTIVE'))fail('S1_RELEASE_M7_GUARD_REQUIRED');
 const privacy=block(state.m7,'s1_privacy'), fixed=block(state.m7,'s1_documents');
 const data=verifiedDocument(privacy), effective=Date.parse(privacy.effective_from);
 if(privacy.edition!==2||!/^privacy-.+-v2$/.test(privacy.version)||!Number.isFinite(effective))fail('S1_RELEASE_PRIVACY_NOT_EFFECTIVE_OR_FINAL');
 const kst=new Date(effective+9*60*60*1000).toISOString();
 const [year,month,day]=kst.slice(0,10).split('-');
 if(kst.slice(11,23)!=='00:00:00.000'||data.id!=='privacy'||data.effectiveDate!==year+'년 '+Number(month)+'월 '+Number(day)+'일')fail('S1_RELEASE_PRIVACY_DATE_MISMATCH');
 if(effective<=firstPrivacyEffective)fail('S1_RELEASE_PRIVACY_NOT_AFTER_EDITION_ONE');
 if(privacy.version===testPrivacy.version||privacy.content_hash===testPrivacy.content_hash||privacy.canonical_content===testPrivacy.canonical_content||/synthetic|never publish|local test only|local.dev/i.test(data.title))fail('S1_RELEASE_TEST_PRIVACY_FORBIDDEN');
 if(privacy.version!=='privacy-'+kst.slice(0,10)+'-v2')fail('S1_RELEASE_PRIVACY_DATE_MISMATCH');
 const bundle='mealchat-'+kst.slice(0,10)+'-r2';
 for(const kind of ['service','health','marketing']) verifiedDocument(fixed[kind]);
 if(!deployment)return {ready:false,reason:'M7 constants are complete; deployment readiness is not checked'};
 if(state.held)fail('S1_RELEASE_DUPLICATE_M7: move the template, do not copy it');
 if(effective>now)fail('S1_RELEASE_PRIVACY_NOT_EFFECTIVE_OR_FINAL');
 const approved=state.privacyRelease;
 if(!approved?.release||!approved?.privacy||approved.release.effective_from!==privacy.effective_from||approved.release.bundle_version!==bundle)fail('S1_RELEASE_APPROVED_PRIVACY_REQUIRED');
 for(const key of ['version','edition','content_hash','canonical_content'])if(approved.privacy[key]!==privacy[key])fail('S1_RELEASE_APPROVED_PRIVACY_MISMATCH');
 for(const kind of ['service','health','marketing']) {
  verifiedDocument(fixed[kind]);
  if(!Number.isFinite(Date.parse(fixed[kind].effective_from))||Date.parse(fixed[kind].effective_from)>now)fail('S1_RELEASE_DOCUMENT_NOT_EFFECTIVE');
  for(const key of ['version','edition','content_hash','canonical_content'])if(fixed[kind][key]!==state.appDocuments[kind][key])fail('S1_RELEASE_APP_DOCUMENT_MISMATCH: '+kind);
 }
 return {ready:true,reason:'Finalized M7 and generated app documents match'};
}
export function repositoryState() {
 const read=p=>readFileSync(resolve(root,p),'utf8');
 const optional=p=>existsSync(resolve(root,p))?read(p):null;
 const names=readdirSync(resolve(root,'supabase/migrations')).filter(n=>n.endsWith('.sql'));
 const seed=read('supabase/seed.sql');
 return {m6:names.includes('20261017095000_s1_terms_access_gate.sql'),m7:optional('supabase/migrations/'+m7Name),held:optional('supabase/release/'+m7Name),migrations:names.map(n=>read('supabase/migrations/'+n)),config:read('supabase/config.toml'),seedCurrent:seedIsCurrent(seed),appDocuments:JSON.parse(read('src/legal/documents.generated.json')),privacyRelease:JSON.parse(read('src/legal/privacy-release.generated.json'))};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 try {
  if(process.argv.length>3||process.argv[2]&&!['--development','--release'].includes(process.argv[2]))fail('Use --development or --release (strict default)');
  const development=process.argv[2]==='--development';
  const result=checkState(repositoryState(),{deployment:!development});
  console.log(result.ready?'S1 RELEASE READY: '+result.reason:'S1 LOCAL CHECK PASS: '+result.reason+'; use npm run release:check before deployment.');
 } catch(error) { console.error(error.message);process.exitCode=1; }
}
