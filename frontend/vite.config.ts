import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    proxy: {
      '/api':   'http://localhost:8000',
      '/files': 'http://localhost:8000',
      '/ws': {
        target:    'ws://localhost:8000',
        ws:        true,
        changeOrigin: true,
      },
    },
  },

  build: {
    // Hedef: modern tarayıcılar — gereksiz polyfill üretme
    target: 'es2020',
    // Chunk uyarı eşiği (kB)
    chunkSizeWarningLimit: 600,
    // Rollup optimizasyonları
    rollupOptions: {
      output: {
        // Manuel vendor chunk'ları — tekrar ziyarette cache'den gelir
        manualChunks: {
          // React runtime — tüm sayfalarda ortak
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Veri katmanı — sık değişmez
          'vendor-query': ['@tanstack/react-query'],
          // İkonlar — büyük ama tree-shakeable
          'vendor-icons': ['lucide-react'],
          // Form/UI yardımcıları
          'vendor-ui': ['clsx', 'react-hot-toast', 'react-dropzone'],
        },
        // Asset dosyalarını türe göre grupla
        assetFileNames: (assetInfo) => {
          const ext = assetInfo.name?.split('.').pop() ?? ''
          if (/png|jpe?g|svg|gif|webp|avif|ico/.test(ext)) return 'assets/img/[hash][extname]'
          if (/woff2?|ttf|eot/.test(ext)) return 'assets/fonts/[hash][extname]'
          if (/css/.test(ext)) return 'assets/css/[hash][extname]'
          return 'assets/[hash][extname]'
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
      },
    },
  },

  // Tree-shaking için optimize import çözümü
  resolve: {
    mainFields: ['module', 'main'],
  },
})
