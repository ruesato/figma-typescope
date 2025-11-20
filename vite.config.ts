import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { figmaPlugin } from './vite-plugin-figma';

// Vite configuration for Figma plugin dual-context build
export default defineConfig({
  plugins: [react(), figmaPlugin()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  build: {
    outDir: 'build',
    emptyOutDir: true,
    minify: false, // Disable for easier debugging

    // Target ES2017 for Figma compatibility (main context)
    target: 'es2017',

    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/main/code.ts'),
        ui: path.resolve(__dirname, 'src/ui/index.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
});
