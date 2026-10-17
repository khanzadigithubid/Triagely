import { rmSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const dataDir = path.join(process.cwd(), 'data');
const storePath = path.join(dataDir, 'store.json');

if (existsSync(storePath)) {
  rmSync(storePath);
  console.log(`Removed ${storePath}`);
} else {
  console.log(`No store found at ${storePath}; nothing to reset.`);
}

if (existsSync(dataDir) && readdirSync(dataDir).length === 0) {
  rmSync(dataDir);
}

if (process.env.DATABASE_URL) {
  const { default: postgres } = await import('postgres');
  const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
  try {
    await sql`delete from triagely_store where id = 'default'`;
    console.log('Cleared Postgres store row (triagely_store#default)');
  } finally {
    await sql.end({ timeout: 5 });
  }
} else {
  console.log('DATABASE_URL not set; skipped Postgres reset.');
}
