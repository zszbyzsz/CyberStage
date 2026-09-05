import { access, copyFile, cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(repositoryRoot, 'dist');
const sourceDirectory = path.join(repositoryRoot, 'src', 'composer');
const outputDirectory = path.join(outputRoot, 'src', 'composer');

await mkdir(outputDirectory, { recursive: true });
await copyFile(path.join(repositoryRoot, 'composer.html'), path.join(outputRoot, 'composer.html'));
await cp(sourceDirectory, outputDirectory, { recursive: true, force: true });

await Promise.all([
  access(path.join(outputRoot, 'composer.html')),
  access(path.join(outputDirectory, 'composer-entry.js')),
  access(path.join(outputDirectory, 'composer.css')),
]);

process.stdout.write('Scene Composer copied to dist/composer.html\n');
