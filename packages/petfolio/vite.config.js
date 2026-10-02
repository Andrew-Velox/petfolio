import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  // ── Dev server (npm run dev) — uses index.html sandbox ──
  if (mode !== 'lib' && mode !== 'global') {
    return {
      root: '.',
      publicDir: 'public',
      server: { open: true },
      build: { outDir: 'dist-sandbox' },
    };
  }

  // ── Library builds ──────────────────────────────────────
  //   mode "lib"    → dist/petfolio.mjs + dist/petfolio.cjs (npm / bundlers)
  //   mode "global" → dist/petfolio.global.js (<script> tag / CDN: window.Petfolio)
  const isGlobal = mode === 'global';
  return {
    publicDir: false,           // sprites are already inlined into the JS bundle
    // Emit ASCII only (\uXXXX escapes): the bundle then loads correctly even
    // when a server sends it without a UTF-8 charset.
    esbuild: { charset: 'ascii' },
    build: {
      outDir: 'dist',
      emptyOutDir: !isGlobal,
      lib: isGlobal
        ? { entry: 'src/global.js', name: 'Petfolio', formats: ['iife'], fileName: () => 'petfolio.global.js' }
        : {
            entry: 'src/index.js',
            name: 'Petfolio',
            fileName: (format) => `petfolio.${format === 'es' ? 'mjs' : 'cjs'}`,
            formats: ['es', 'cjs'],
          },
      // Inline all assets as base64
      assetsInlineLimit: 1024 * 1024 * 5,
    },
  };
});
