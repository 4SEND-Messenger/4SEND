import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'pwa-sw.ts',
      includeAssets: ['ico.png', 'notify.mp3', 'calling.mp3', 'calling2.mp3'],
      manifest: {
        name: '4SEND Messenger',
        short_name: '4SEND',
        description: '4SEND — бесплатный и безопасный мессенджер с шифрованием данных',
        theme_color: '#0a0a0c',
        background_color: '#0a0a0c',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'ico.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        share_target: {
          action: '/share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            files: [
              {
                name: 'media',
                accept: ['image/*', 'video/*', 'audio/*', 'application/pdf', 'text/plain']
              }
            ]
          }
        }
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,mp3,woff2}']
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'libsodium-wrappers': path.resolve(__dirname, './node_modules/libsodium-wrappers/dist/modules/libsodium-wrappers.js')
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/auth': {
        target: 'https://4send-messenger.hf.space',
        changeOrigin: true,
        secure: true
      },
      '/api': {
        target: 'https://4send-messenger.hf.space',
        changeOrigin: true,
        secure: true
      },
      '/upload': {
        target: 'https://4send-messenger.hf.space',
        changeOrigin: true,
        secure: true
      },
      '/history': {
        target: 'https://4send-messenger.hf.space',
        changeOrigin: true,
        secure: true
      },
      '/chats-extended': {
        target: 'https://4send-messenger.hf.space',
        changeOrigin: true,
        secure: true
      },

      '/socket.io': {
        target: 'https://4send-messenger.hf.space',
        changeOrigin: true,
        secure: true,
        ws: false
      }
    }
  },
  build: {
    target: 'es2023',
    minify: 'oxc',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/react-router')) {
            return 'vendor';
          }
          if (id.includes('node_modules/socket.io-client')) {
            return 'socket';
          }
          if (id.includes('node_modules/chart.js') || id.includes('node_modules/react-chartjs-2')) {
            return 'charts';
          }
          return undefined;
        }
      }
    }
  },
  define: {
    'process.env': {}
  }
})