import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/operational-api': {
        target: 'https://comunicate-registros-v2.netlify.app',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/operational-api/, ''),
      },
    },
  },
});
