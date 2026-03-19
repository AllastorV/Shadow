import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--c-bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto" style={{ backgroundColor: 'var(--c-bg)' }}>
        <Outlet />
      </main>
    </div>
  )
}
