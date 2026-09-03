import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'dist');

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const path of ['index.html', 'site.webmanifest', 'robots.txt', 'assets', 'src']) {
  await cp(resolve(root, path), resolve(output, path), { recursive: true });
}

await writeFile(resolve(output, '.nojekyll'), '', 'utf8');
console.log('Built static CyberStage site in dist/.');
