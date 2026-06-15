import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Core React runtime — always needed
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router/') || id.includes('node_modules/scheduler/')) {
            return 'vendor';
          }
          // Icon library — large but widely used; split so it can cache independently
          if (id.includes('node_modules/lucide-react/')) {
            return 'icons';
          }
          // Radix UI primitives — used across storefront and admin
          if (id.includes('node_modules/@radix-ui/')) {
            return 'ui';
          }
          // Admin-only: page builder (only loads when /admin/builder is visited)
          if (id.includes('node_modules/@craftjs/')) {
            return 'builder';
          }
          // Admin-only: charts (only loads when /admin/analytics is visited)
          if (id.includes('node_modules/recharts/') || id.includes('node_modules/d3-') || id.includes('node_modules/victory-')) {
            return 'charts';
          }
        },
      },
    },
  },
})
