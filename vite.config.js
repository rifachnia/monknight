import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [
      react({
        // Add error recovery for React
        jsxRuntime: 'automatic',
        jsxImportSource: 'react'
      })
    ],
    define: {
      // Make environment variables available at build time
      'process.env.NEXT_PUBLIC_PRIVY_APP_ID': JSON.stringify(env.NEXT_PUBLIC_PRIVY_APP_ID || 'cmex2ejkj00psjx0bodrlnx6d'),
      'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development'),
      // Add global for debugging
      'global': 'globalThis'
    },
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      // Improve error handling in build
      minify: mode === 'production' ? 'esbuild' : false,
      sourcemap: mode !== 'production',
      rollupOptions: {
        output: {
          manualChunks: {
            'phaser': ['phaser'],
            'react-vendor': ['react', 'react-dom'],
            'privy': ['@privy-io/react-auth']
          }
        },
        // Handle potential import errors
        onwarn(warning, warn) {
          // Skip certain warnings that might be related to Privy SDK
          if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
            return;
          }
          warn(warning);
        }
      }
    },
    server: {
      port: 3000,
      open: true,
      // Add CORS headers for local development
      cors: true
    },
    // Optimize dependencies, especially for Privy SDK
    optimizeDeps: {
      include: ['react', 'react-dom', '@privy-io/react-auth'],
      exclude: []
    },
    // Handle potential module resolution issues
    resolve: {
      alias: {
        // Add any necessary aliases here if module resolution fails
      }
    }
  };
});