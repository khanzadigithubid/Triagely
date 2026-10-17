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