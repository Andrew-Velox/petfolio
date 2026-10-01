import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  // ── Dev server (npm run dev) — uses index.html sandbox ──
  if (mode !== 'lib') {
    return {
      root: '.',
      publicDir: 'public',
      server: { open: true },
      build: { outDir: 'dist-sandbox' },
    };
  }

  // ── Library build (npm run build:lib) ───────────────────
  return {
    publicDir: false,           // sprites are already inlined into the JS bundle
    build: {
      outDir: 'dist',
      emptyDir: true,
      lib: {
        entry: 'src/index.js',
        name: 'Petfolio',
        fileName: (format) => `petfolio.${format === 'es' ? 'mjs' : 'cjs'}`,
        formats: ['es', 'cjs'],
      },
      rollupOptions: {
        output: {
          // CJS bundle uses module.exports = { ... } pattern
        },
      },
      // Inline all assets as base64
      assetsInlineLimit: 1024 * 1024 * 5,
    },
  };
});
