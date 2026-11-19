// THE GODPOSTER entrypoint: copies app/ (and screenshots/ if present) into the output
// directory, then writes dossier.json built by the vendored buildDossier.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const out = process.env.MAKEFUN_OUTPUT_DIR || '/output';

mkdirSync(out, { recursive: true });
for (const name of ['app', 'screenshots']) {
  const src = join(root, name);
  if (existsSync(src)) cpSync(src, join(out, name), { recursive: true });
}

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
});
writeFileSync(join(out, 'dossier.json'), dossier);
console.log(`dossier.json written to ${out} (${dossier.length} bytes)`);
