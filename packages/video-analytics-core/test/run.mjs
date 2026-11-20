// Bundles the TypeScript runner in memory with esbuild (no build output) and runs it.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const result = await build({
  entryPoints: [here('./run-fixtures.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  logLevel: 'warning',
});
process.env.FIXTURES_DIR = here('./fixtures');
await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
