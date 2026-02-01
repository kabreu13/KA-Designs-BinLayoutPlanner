import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import istanbul from 'vite-plugin-istanbul';

// https://vitejs.dev/config/
const enableE2eCoverage = process.env.E2E_COVERAGE === '1';

export default defineConfig({
  plugins: [
    react(),
    visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true, template: 'treemap', emitFile: true }),
    enableE2eCoverage &&
      istanbul({
        include: 'src/**/*',
        exclude: ['node_modules', 'tests', 'dist'],
        extension: ['.js', '.ts', '.jsx', '.tsx'],
        requireEnv: false
      })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage'
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          pdf: ['jspdf']
        }
      }
    }
  }
});
