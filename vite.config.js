import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // Make environment variables available at build time
      'process.env.NEXT_PUBLIC_PRIVY_APP_ID': JSON.stringify(env.NEXT_PUBLIC_PRIVY_APP_ID || 'cmex2ejkj00psjx0bodrlnx6d')
    },
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      rollupOptions: {
        output: {
          manualChunks: {
            'phaser': ['phaser'],
            'react-vendor': ['react', 'react-dom'],
            'privy': ['@privy-io/react-auth']
          }
        }
      }
    },
    server: {
      port: 3000,
      open: true
    }
  };
});