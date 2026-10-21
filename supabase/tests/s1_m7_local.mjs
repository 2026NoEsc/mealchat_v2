// Test-only copy transformation. Never imported or executed by a production migration.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
export const migrationName='20261017100000_s1_activate_terms.sql';
const heldPath=resolve(here,'../release',migrationName);
const activePath=resolve(here,'../migrations',migrationName);
export const templatePath=existsSync(heldPath)?heldPath:activePath;
export function m7WithTestValues(overrides={}) {
 const source=readFileSync(templatePath,'utf8');
 const values={...JSON.parse(readFileSync(join(here,'s1_m7_test_values.json'),'utf8')),...overrides};
 const pattern=/privacy_release constant jsonb := \$s1_privacy\$[\s\S]*?\$s1_privacy\$::jsonb;/g;
 if ([...source.matchAll(pattern)].length!==1) throw new Error('M7 must have exactly one privacy constants block');
 return source.replace(pattern,()=> 'privacy_release constant jsonb := $s1_privacy$\n'+JSON.stringify(values,null,2)+'\n$s1_privacy$::jsonb;');
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 if (process.argv.length!==3 || process.argv[2]!=='--prepare') throw new Error('Only --prepare for the isolated local workdir is allowed');
 const context=execFileSync('docker',['context','inspect','--format','{{.Endpoints.docker.Host}}'],{encoding:'utf8',windowsHide:true});
 if (!/^(npipe|unix):\/\//.test(context)) throw new Error('Local Docker endpoint required');
 const local=join(tmpdir(),'mealchat-s1-a-20261017','supabase');
 // Remove only the old disposable M7 copy; it must never remain in migration input.
 if(!existsSync(activePath))rmSync(join(local,'migrations',migrationName),{force:true});
 mkdirSync(join(local,'tests'),{recursive:true});
 writeFileSync(join(local,'tests','m7-test.sql'),m7WithTestValues(),'utf8');
 writeFileSync(join(local,'seed.sql'),readFileSync(resolve(here,'../seed.sql'),'utf8'),'utf8');
 console.log('Local seed copied unchanged; synthetic M7 SQL is outside migration input.');
}
