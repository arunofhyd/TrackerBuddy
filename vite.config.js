import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    sourcemap: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          lit: ['lit-html'],
          vendor: ['date-fns']
        }
      }
    }
  },
});
