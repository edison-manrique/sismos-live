import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import solid from 'vite-plugin-solid';

const fromHere = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = env.VITE_BASE_PATH || '/';

  return {
    base,
    root: fromHere('.'),
    plugins: [solid()],
    resolve: {
      alias: {
        '@sismos/seismic': fromHere('../../packages/seismic/src/index.ts'),
        '@sismos/geomap': fromHere('../../packages/geomap/src/index.ts'),
      },
    },
    server: {
      port: 5173,
      host: true,
    },
    preview: {
      port: 4173,
    },
    build: {
      target: 'es2022',
      sourcemap: false,
    },
  };
});
