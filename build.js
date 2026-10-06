import { mkdir, copyFile } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'catalog.js']) {
  await copyFile(file, `dist/${file}`);
}
