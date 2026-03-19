import { memo, useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Search, FolderOpen, LogOut, Layers, Cpu, Cloud, AlertCircle } from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import { useQuery } from '@tanstack/react-query'
import api from '../../utils/api'
import type { Project } from '../../types'
import clsx from 'clsx'

// Sekme görünürlüğünü izle — gizli sekmelerde polling durur
function usePageVisible() {
  const [visible, setVisible] = useState(!document.hidden)
  useEffect(() => {
    const handler = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])
  return visible
}

export default memo(function Sidebar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const pageVisible = usePageVisible()

  const { data: projects } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects/').then((r) => r.data),
  })

  const { data: aiStatus } = useQuery<any>({
    queryKey: ['aiStatus'],
    queryFn: () => api.get('/ai/status').then((r) => r.data),
    // Sekme görünürse 5 dakikada bir kontrol et, gizliyse dur
    refetchInterval: pageVisible ? 5 * 60 * 1000 : false,
    // Pencere odaklanınca yenile (tab switching)
    refetchOnWindowFocus: false,
    // Başarısız istekte retry yapma — AI opsiyonel özellik
    retry: false,
    // Eski veriyi 10 dk cache'de tut
    staleTime: 10 * 60 * 1000,
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
        <NavItem to="/dashboard" icon={<LayoutDashboard size={16} />} label="Dashboard" />
        <NavItem to="/search" icon={<Search size={16} />} label="AI Arama" />

        <div className="pt-4 pb-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3">Projeler</p>
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
          <p className="text-xs text-slate-500 px-3 py-2">Henüz proje yok</p>
        )}
      </nav>

      {/* AI Durumu */}
      {aiStatus && (
        <div className="px-3 py-2 mx-2 mb-1 rounded-lg bg-surface-100 border border-surface-300">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">AI Backend</p>
          {aiStatus.ollama?.available ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <Cpu size={11} />
              <span>Yerel · {aiStatus.ollama.vision_model}</span>
            </div>
          ) : aiStatus.anthropic?.available ? (
            <div className="flex items-center gap-1.5 text-xs text-brand-400">
              <Cloud size={11} />
              <span>Anthropic API</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-amber-400">
              <AlertCircle size={11} />
              <span>Mock (AI yok)</span>
            </div>
          )}
        </div>
      )}

      {/* Kullanıcı */}
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
          Çıkış Yap
        </button>
      </div>
    </aside>
  )
})

// NavItem ayrı bileşen — React.memo ile link değişmediğinde yeniden render olmaz
const NavItem = memo(function NavItem({
  to, icon, label, badge,
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
})
