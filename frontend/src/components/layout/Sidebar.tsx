import { memo, useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Search, FolderOpen, LogOut, Layers,
  Cpu, Cloud, AlertCircle, Sun, Moon, ChevronRight, Keyboard,
} from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import { useQuery } from '@tanstack/react-query'
import api from '../../utils/api'
import { useTheme } from '../../utils/theme'
import { useShortcuts } from '../../utils/shortcuts'
import type { Project } from '../../types'
import clsx from 'clsx'

function usePageVisible() {
  const [visible, setVisible] = useState(!document.hidden)
  useEffect(() => {
    const handler = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])
  return visible
}

// Project color palette — cycles through accent colors
const PROJECT_COLORS = [
  'from-brand-500 to-violet-500',
  'from-cyan-500 to-teal-500',
  'from-rose-500 to-pink-500',
  'from-amber-500 to-orange-500',
  'from-emerald-500 to-green-500',
  'from-sky-500 to-blue-500',
]

export default memo(function Sidebar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const { openPanel } = useShortcuts()
  const pageVisible = usePageVisible()

  const { data: projects } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects/').then((r) => r.data),
  })

  const { data: aiStatus } = useQuery<any>({
    queryKey: ['aiStatus'],
    queryFn: () => api.get('/ai/status').then((r) => r.data),
    refetchInterval: pageVisible ? 5 * 60 * 1000 : false,
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 10 * 60 * 1000,
  })

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const userInitial = user?.full_name?.charAt(0).toUpperCase() ?? '?'

  return (
    <aside
      className="w-64 flex flex-col shrink-0"
      style={{
        backgroundColor: 'var(--c-surface)',
        borderRight: '1px solid var(--c-surface-3)',
      }}
    >
      {/* ── Logo ── */}
      <div
        className="px-5 py-4 flex items-center gap-3"
        style={{ borderBottom: '1px solid var(--c-surface-3)' }}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-glow-sm"
          style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
        >
          <Layers size={17} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-bold text-base tracking-tight text-white" style={{ color: 'inherit' }}>
            Shadow
          </span>
          <span
            className="ml-2 text-[10px] font-semibold tracking-widest uppercase rounded-md px-1.5 py-0.5"
            style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}
          >
            DAM
          </span>
        </div>
        {/* Shortcuts panel button */}
        <button
          onClick={openPanel}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 shrink-0"
          style={{ color: '#8b9ab8' }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = 'var(--c-surface-2)'
            e.currentTarget.style.color = 'inherit'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = '#8b9ab8'
          }}
          title="Klavye kısayolları (Shift+?)"
          aria-label="Klavye kısayollarını göster"
        >
          <Keyboard size={14} />
        </button>
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 shrink-0"
          style={{ color: '#8b9ab8' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--c-surface-2)'
            e.currentTarget.style.color = 'inherit'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = '#8b9ab8'
          }}
          title={theme === 'dark' ? 'Aydınlık mod' : 'Karanlık mod'}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {/* Main nav */}
        <NavItem to="/dashboard" icon={<LayoutDashboard size={15} />} label="Dashboard" />
        <NavItem to="/search" icon={<Search size={15} />} label="AI Arama" />

        {/* Projects section */}
        <div className="pt-5 pb-1.5 px-2">
          <p
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: '#4a5a72' }}
          >
            Projeler
          </p>
        </div>

        {projects?.map((project, idx) => (
          <NavItem
            key={project.id}
            to={`/projects/${project.id}`}
            icon={
              <span
                className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold text-white bg-gradient-to-br ${PROJECT_COLORS[idx % PROJECT_COLORS.length]} shrink-0`}
              >
                {project.name.charAt(0).toUpperCase()}
              </span>
            }
            label={project.name}
            badge={project.asset_count}
          />
        ))}

        {projects?.length === 0 && (
          <p className="text-xs px-3 py-2" style={{ color: '#4a5a72' }}>
            Henüz proje yok
          </p>
        )}
      </nav>

      {/* ── AI Status ── */}
      {aiStatus && (
        <div
          className="mx-3 mb-2 px-3 py-2 rounded-xl flex items-center gap-2"
          style={{ backgroundColor: 'var(--c-surface-1)', border: '1px solid var(--c-surface-3)' }}
        >
          {aiStatus.ollama?.available ? (
            <>
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span className="text-[11px] text-emerald-400 font-medium truncate">
                Yerel · {aiStatus.ollama.vision_model}
              </span>
            </>
          ) : aiStatus.anthropic?.available ? (
            <>
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-400" />
              </span>
              <span className="text-[11px] text-brand-400 font-medium">Anthropic API</span>
            </>
          ) : (
            <>
              <AlertCircle size={11} className="text-amber-400 shrink-0" />
              <span className="text-[11px] text-amber-400 font-medium">AI bağlantısı yok</span>
            </>
          )}
        </div>
      )}

      {/* ── User ── */}
      <div
        className="px-3 py-3 space-y-0.5"
        style={{ borderTop: '1px solid var(--c-surface-3)' }}
      >
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl mb-1">
          {/* Avatar */}
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            {userInitial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate text-white" style={{ color: 'inherit' }}>
              {user?.full_name}
            </p>
            <p className="text-[11px] capitalize" style={{ color: '#6b7a96' }}>
              {user?.role}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="btn-ghost w-full justify-start text-rose-400 hover:text-rose-300"
          style={{}}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(244,63,94,0.08)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          <LogOut size={13} />
          Çıkış Yap
        </button>
      </div>
    </aside>
  )
})

// ── NavItem ───────────────────────────────────────────────────────────────────
const NavItem = memo(function NavItem({
  to,
  icon,
  label,
  badge,
}: {
  to: string
  icon: React.ReactNode
  label: string
  badge?: number
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-150 relative group',
          isActive
            ? 'font-semibold'
            : 'font-medium'
        )
      }
      style={({ isActive }) =>
        isActive
          ? {
              background: 'linear-gradient(90deg, rgba(99,102,241,0.18) 0%, rgba(139,92,246,0.06) 100%)',
              color: '#a5b4fc',
              boxShadow: 'inset 2px 0 0 #6366f1',
            }
          : { color: '#8b9ab8' }
      }
    >
      {({ isActive }) => (
        <>
          <span className={clsx('shrink-0 transition-colors', isActive ? 'text-brand-400' : '')}>
            {icon}
          </span>
          <span className="flex-1 truncate">{label}</span>
          {badge !== undefined && badge > 0 && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{
                backgroundColor: isActive ? 'rgba(99,102,241,0.2)' : 'var(--c-surface-3)',
                color: isActive ? '#a5b4fc' : '#6b7a96',
              }}
            >
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
})
