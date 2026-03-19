import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // İlk başarısız istekte 1 kez yeniden dene
      retry: 1,
      // Veri 5 dk boyunca "taze" sayılır — gereksiz ağ isteklerini önler
      staleTime: 5 * 60 * 1000,
      // Veri 10 dk cache'de kalır (bileşen unmount sonrası)
      gcTime: 10 * 60 * 1000,
      // Pencere odaklanınca otomatik yenilemeyi kapat (fazla ağ trafiği)
      // Sayfalar kendi staleTime'larına göre yenilenecek
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: '#1e2130',
              color: '#e2e8f0',
              border: '1px solid #2e3145',
              fontSize: '13px',
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
