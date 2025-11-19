import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: 'src/main/code.ts',
        ui: 'src/ui/index.html',
      },
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
});
