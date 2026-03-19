import { useNavigate } from 'react-router-dom'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import ShortcutsPanel from '../ShortcutsPanel'
import { useShortcutAction, useShortcuts } from '../../utils/shortcuts'
import { useTheme } from '../../utils/theme'

export default function AppLayout() {
  const navigate = useNavigate()
  const { closePanel } = useShortcuts()
  const { toggleTheme } = useTheme()

  // Global navigation shortcuts
  useShortcutAction('goto_dashboard', () => navigate('/dashboard'))
  useShortcutAction('goto_search',    () => navigate('/search'))
  useShortcutAction('go_back',        () => navigate(-1))
  useShortcutAction('toggle_theme',   toggleTheme)
  useShortcutAction('close_modal',    closePanel)

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--c-bg)' }}>
      <Sidebar />
      <main
        id="main-content"
        className="flex-1 overflow-auto"
        style={{ backgroundColor: 'var(--c-bg)' }}
      >
        <Outlet />
      </main>
      <ShortcutsPanel />
    </div>
  )
}
