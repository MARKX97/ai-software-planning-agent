import { defineConfig } from 'tsup';

/**
 * Database package build.
 *
 * The Prisma-generated client uses TS `import =` namespace syntax that
 * tsup's bundled DTS transformer (jiti) cannot parse. We therefore emit
 * declarations with `tsc` (see tsconfig.build.json) and let tsup handle
 * only the ESM JS bundle here.
 *
 * @internal
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,
  clean: true,
  external: ['./generated/prisma/client.js', './generated/prisma/index.js'],
});