import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import AppLayout from './components/layout/AppLayout'

// Lazy-loaded sayfalar — her sayfa ayrı JS chunk olarak derlenir.
// İlk yükleme sadece aktif sayfayı indirir; diğerleri ihtiyaç olunca gelir.
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ProjectPage = lazy(() => import('./pages/ProjectPage'))
const AssetDetailPage = lazy(() => import('./pages/AssetDetailPage'))
const SearchPage = lazy(() => import('./pages/SearchPage'))
const ShareViewPage = lazy(() => import('./pages/ShareViewPage'))

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

// Sayfa geçişlerinde tam ekran spinner
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/share/:token" element={<ShareViewPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="projects/:projectId" element={<ProjectPage />} />
          <Route path="projects/:projectId/assets/:assetId" element={<AssetDetailPage />} />
          <Route path="search" element={<SearchPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
