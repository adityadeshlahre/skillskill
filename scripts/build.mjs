import { build } from 'esbuild';
import { rmSync } from 'fs';

rmSync('dist', { recursive: true, force: true });

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  minify: true,
  treeShaking: true,
  legalComments: 'none',
  packages: 'external',
};

await Promise.all([
  build({ ...shared, entryPoints: ['src/main.ts'], outfile: 'dist/main.js' }),
  build({ ...shared, entryPoints: ['src/index.ts'], outfile: 'dist/index.js' }),
]);
