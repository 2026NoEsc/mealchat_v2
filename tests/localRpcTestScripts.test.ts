import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const scripts = join(process.cwd(), 'scripts');
const additiveScript = readFileSync(
  join(scripts, 'test-rpc-additive-compat.ps1'),
  'utf8',
);
const concurrencyScript = readFileSync(
  join(scripts, 'test-rpc-concurrency.ps1'),
  'utf8',
);

describe('local RPC verification scripts', () => {
  it('accepts a later local migration when additive hardening exists in history', () => {
    expect(additiveScript).toMatch(
      /from supabase_migrations\.schema_migrations\s+where version = '20260823072701'/i,
    );
    expect(additiveScript).not.toMatch(/order by version desc limit 1/i);
  });

  it('passes SQL to containerized psql through stdin', () => {
    for (const script of [additiveScript, concurrencyScript]) {
      expect(script).toMatch(/exec -i \$\w+ psql[\s\S]*?-f -/i);
    }

    expect(concurrencyScript).toMatch(
      /\$Statement \| & \$DockerPath exec -i \$ContainerName psql[\s\S]*?-f -/i,
    );
    expect(additiveScript).not.toMatch(/-c \$Sql/i);
    expect(concurrencyScript).not.toMatch(/-c \$(?:Sql|Statement)/i);
  });
});
