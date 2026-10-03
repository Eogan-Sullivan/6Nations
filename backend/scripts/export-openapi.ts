import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../src/api/app.js';
const app = await buildApp();
await app.ready();
const contents = JSON.stringify(app.swagger(), null, 2) + '\n';
const path = fileURLToPath(new URL('../contracts/openapi.json', import.meta.url));
if (process.argv.includes('--check')) {
  if ((await readFile(path, 'utf8')) !== contents)
    throw new Error('OpenAPI contract drift; run contract:generate');
} else await writeFile(path, contents);
await app.close();
