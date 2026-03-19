import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Search, FolderOpen, Settings, LogOut, Shield, Layers } from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import { useQuery } from '@tanstack/react-query'
import api from '../../utils/api'
import type { Project } from '../../types'
import clsx from 'clsx'

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const { data: projects } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects/').then((r) => r.data),
  })

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="w-60 flex flex-col bg-surface-50 border-r border-surface-300 shrink-0">
      {/* Logo */}
      <div className="p-5 flex items-center gap-3 border-b border-surface-300">
        <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
          <Layers size={16} className="text-white" />
        </div>
        <span className="font-bold text-lg tracking-tight text-white">Shadow</span>
        <span className="text-xs text-brand-400 font-medium ml-auto">DAM</span>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {/* Main nav */}
        <NavItem to="/dashboard" icon={<LayoutDashboard size={16} />} label="Dashboard" />
        <NavItem to="/search" icon={<Search size={16} />} label="AI Search" />

        {/* Projects */}
        <div className="pt-4 pb-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3">Projects</p>
        </div>
        {projects?.map((project) => (
          <NavItem
            key={project.id}
            to={`/projects/${project.id}`}
            icon={<FolderOpen size={16} />}
            label={project.name}
            badge={project.asset_count}
          />
        ))}
        {projects?.length === 0 && (
          <p className="text-xs text-slate-500 px-3 py-2">No projects yet</p>
        )}
      </nav>

      {/* Bottom section */}
      <div className="p-3 border-t border-surface-300 space-y-0.5">
        <div className="flex items-center gap-2 px-3 py-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-brand-700 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-brand-200">
              {user?.full_name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">{user?.full_name}</p>
            <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="btn-ghost w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </aside>
  )
}

function NavItem({
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
          'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
          isActive
            ? 'bg-brand-600/20 text-brand-300 font-medium'
            : 'text-slate-400 hover:text-slate-200 hover:bg-surface-200'
        )
      }
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="text-xs bg-surface-300 text-slate-400 px-1.5 py-0.5 rounded-full">{badge}</span>
      )}
    </NavLink>
  )
}
