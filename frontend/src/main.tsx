import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from '@/auth/AuthContext'
import { queryClient } from '@/lib/queryClient'
import ErrorBoundary from '@/components/ErrorBoundary'
import { ConfirmProvider } from '@/components/ui/ConfirmDialog'
import ToastContainer from '@/components/ui/ToastContainer'
import { installOfflineSync } from '@/lib/offlineQueue'

// Hors ligne léger : service worker (cache de l'app et des lectures du planning, notifications push)
// + file d'attente des saisies faites sans réseau (pointages, imprévus).
// Enregistré aussi en développement pour les notifications (le cache y est désactivé, voir sw.js).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // pas bloquant : l'app fonctionne sans cache hors ligne
    })
  })
}
installOfflineSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <ConfirmProvider>
              <App />
            </ConfirmProvider>
            <ToastContainer />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
