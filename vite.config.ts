import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      // Stub packages that have undeclared/broken deps in their real dist bundles.
      // These aliases ensure both Replit dev and Vercel production builds always
      // resolve to our safe stubs — never to the real npm packages.
      "jspdf": path.resolve(import.meta.dirname, "local-packages", "jspdf", "index.js"),
      "fast-xml-parser": path.resolve(import.meta.dirname, "local-packages", "fast-xml-parser", "index.js"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  optimizeDeps: {
    // lodash — pre-bundle for fast dev startup
    // fflate — jspdf peer dep (belt-and-suspenders; jspdf itself is aliased to stub)
    include: ['lodash', 'fflate'],
    // canvg — imported by real jspdf; stubbed out via alias so exclude prevents
    // esbuild from trying to pre-bundle a package that may not exist on Vercel
    exclude: ['canvg', 'jspdf'],
    esbuildOptions: {
      plugins: [
        {
          name: 'ignore-core-js-modules',
          setup(build) {
            build.onResolve({ filter: /^core-js\// }, (args) => ({
              path: args.path,
              external: true,
            }));
          },
        },
      ],
    },
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    commonjsOptions: {
      include: [/node_modules/],
      ignoreDynamicRequires: true,
    },
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress known noisy-but-harmless warnings
        if (
          warning.message?.includes('core-js') ||
          warning.message?.includes('internals/function-call') ||
          warning.message?.includes('fast-png') ||
          warning.message?.includes('jspdf') ||
          warning.message?.includes('canvg')
        ) {
          return;
        }
        warn(warning);
      },
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'query-vendor': ['@tanstack/react-query'],
          'radix-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-popover',
            '@radix-ui/react-scroll-area',
          ],
          'radix-ui-forms': [
            '@radix-ui/react-label',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-slider',
            '@radix-ui/react-switch',
          ],
          'radix-ui-misc': [
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-avatar',
            '@radix-ui/react-hover-card',
            '@radix-ui/react-navigation-menu',
            '@radix-ui/react-progress',
            '@radix-ui/react-separator',
            '@radix-ui/react-tooltip',
          ],
          'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'icons': ['lucide-react', 'react-icons'],
          'animation': ['framer-motion', 'canvas-confetti'],
          'charts': ['recharts'],
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  define: {
    // Auto-configure API URL based on environment
    // Development (Replit/Localhost): Use empty string for same-origin requests
    // Production (Vercel): Use VITE_API_URL env var (set to Render backend URL)
    'import.meta.env.VITE_API_URL': JSON.stringify(
      process.env.VITE_API_URL || ''
    ),
  },
});
