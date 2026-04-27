import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  optimizeDeps: {
    include: ['exceljs'],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    commonjsOptions: {
      include: [/exceljs/, /node_modules/],
      transformMixedEsModules: true,
    },
  },
});
