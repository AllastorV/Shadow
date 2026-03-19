import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FolderOpen, Image, Clock, CheckCircle, X, Sparkles } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../utils/api'
import type { Project } from '../types'
import { formatRelative } from '../utils/format'
import { useAuthStore } from '../store/auth'

// Stat card accent configs
const STAT_COLORS = [
  { gradient: 'from-brand-500 to-violet-500', glow: 'rgba(99,102,241,0.25)' },
  { gradient: 'from-emerald-500 to-teal-500', glow: 'rgba(16,185,129,0.25)' },
  { gradient: 'from-amber-500 to-orange-400', glow: 'rgba(245,158,11,0.25)' },
  { gradient: 'from-sky-500 to-cyan-400',     glow: 'rgba(14,165,233,0.25)' },
]

const PROJECT_COLORS = [
  'from-brand-500 to-violet-500',
  'from-cyan-500 to-teal-500',
  'from-rose-500 to-pink-500',
  'from-amber-500 to-orange-500',
  'from-emerald-500 to-green-500',
  'from-sky-500 to-blue-500',
]

export default function DashboardPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showNewProject, setShowNewProject] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [projectDesc, setProjectDesc] = useState('')

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects/').then((r) => r.data),
  })

  const createProject = useMutation({
    mutationFn: (data: { name: string; description: string }) =>
      api.post('/projects/', data).then((r) => r.data),
    onSuccess: (project: Project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Proje oluşturuldu!')
      setShowNewProject(false)
      setProjectName('')
      setProjectDesc('')
      navigate(`/projects/${project.id}`)
    },
    onError: () => toast.error('Proje oluşturulamadı'),
  })

  const totalAssets = projects?.reduce((s, p) => s + p.asset_count, 0) ?? 0

  // Greeting based on time of day
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar'
  const firstName = user?.full_name?.split(' ')[0] ?? ''

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-sm font-medium mb-0.5" style={{ color: '#6366f1' }}>
            {greeting}, {firstName} 👋
          </p>
          <h1 className="text-2xl font-bold text-white" style={{ color: 'inherit' }}>
            Medya Arşiviniz
          </h1>
          <p className="text-sm mt-0.5 text-slate-400">
            Tüm projelerinizi ve varlıklarınızı buradan yönetin
          </p>
        </div>
        <button onClick={() => setShowNewProject(true)} className="btn-primary">
          <Plus size={15} />
          Yeni Proje
        </button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Toplam Proje',   value: projects?.length ?? 0, icon: <FolderOpen size={17} /> },
          { label: 'Toplam Varlık',  value: totalAssets,            icon: <Image size={17} /> },
          { label: 'Bekleyen',       value: '—',                    icon: <Clock size={17} /> },
          { label: 'Onaylandı',      value: '—',                    icon: <CheckCircle size={17} /> },
        ].map((stat, i) => {
          const col = STAT_COLORS[i]
          return (
            <div
              key={stat.label}
              className="rounded-2xl p-4 relative overflow-hidden"
              style={{
                backgroundColor: 'var(--c-surface)',
                border: '1px solid var(--c-surface-3)',
              }}
            >
              {/* Subtle glow spot */}
              <div
                className="absolute -top-4 -right-4 w-20 h-20 rounded-full blur-2xl pointer-events-none"
                style={{ background: col.glow }}
              />
              <div
                className={`w-9 h-9 rounded-xl bg-gradient-to-br ${col.gradient} flex items-center justify-center text-white mb-3 shadow-glow-sm`}
              >
                {stat.icon}
              </div>
              <p className="text-2xl font-bold text-white" style={{ color: 'inherit' }}>
                {stat.value}
              </p>
              <p className="text-xs mt-0.5 text-slate-400">{stat.label}</p>
            </div>
          )
        })}
      </div>

      {/* ── Projects Grid ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-[11px] font-bold uppercase tracking-widest"
            style={{ color: '#4a5a72' }}
          >
            Projeler
          </h2>
          {(projects?.length ?? 0) > 0 && (
            <span className="text-xs text-slate-500">
              {projects!.length} proje
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton h-36" />
            ))}
          </div>
        ) : projects?.length === 0 ? (
          <div
            className="rounded-2xl p-12 text-center"
            style={{
              backgroundColor: 'var(--c-surface)',
              border: '1px dashed var(--c-surface-3)',
            }}
          >
            <div
              className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
            >
              <Sparkles size={22} className="text-brand-400" />
            </div>
            <p className="font-semibold text-white mb-1" style={{ color: 'inherit' }}>
              İlk projenizi oluşturun
            </p>
            <p className="text-sm text-slate-500 mb-5 max-w-xs mx-auto">
              Medya varlıklarınızı organize etmek ve AI ile analiz ettirmek için bir proje başlatın
            </p>
            <button onClick={() => setShowNewProject(true)} className="btn-primary mx-auto">
              <Plus size={15} />
              Yeni Proje
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects?.map((project, idx) => (
              <ProjectCard
                key={project.id}
                project={project}
                colorClass={PROJECT_COLORS[idx % PROJECT_COLORS.length]}
                onClick={() => navigate(`/projects/${project.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── New Project Modal ── */}
      {showNewProject && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div
            className="w-full max-w-md rounded-2xl p-6 shadow-elevated"
            style={{
              backgroundColor: 'var(--c-surface)',
              border: '1px solid var(--c-surface-3)',
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white" style={{ color: 'inherit' }}>
                Yeni Proje
              </h3>
              <button
                onClick={() => setShowNewProject(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: '#6b7a96' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--c-surface-2)'
                  e.currentTarget.style.color = 'inherit'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = '#6b7a96'
                }}
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                  Proje Adı
                </label>
                <input
                  className="input"
                  placeholder="Kampanya Q1 2025"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && projectName.trim() && !createProject.isPending) {
                      createProject.mutate({ name: projectName.trim(), description: projectDesc })
                    }
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                  Açıklama <span className="normal-case font-normal">(isteğe bağlı)</span>
                </label>
                <input
                  className="input"
                  placeholder="Proje hakkında kısa bir açıklama..."
                  value={projectDesc}
                  onChange={(e) => setProjectDesc(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowNewProject(false)}
                className="btn-secondary flex-1 justify-center"
              >
                İptal
              </button>
              <button
                className="btn-primary flex-1 justify-center"
                disabled={!projectName.trim() || createProject.isPending}
                onClick={() =>
                  createProject.mutate({ name: projectName.trim(), description: projectDesc })
                }
              >
                {createProject.isPending ? 'Oluşturuluyor…' : 'Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── ProjectCard ───────────────────────────────────────────────────────────────
function ProjectCard({
  project,
  colorClass,
  onClick,
}: {
  project: Project
  colorClass: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-2xl p-5 transition-all duration-200 group"
      style={{
        backgroundColor: 'var(--c-surface)',
        border: '1px solid var(--c-surface-3)',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'rgba(99,102,241,0.35)'
        el.style.transform = 'translateY(-2px)'
        el.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(99,102,241,0.2)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'var(--c-surface-3)'
        el.style.transform = 'translateY(0)'
        el.style.boxShadow = 'none'
      }}
    >
      <div className="flex items-start gap-3 mb-4">
        {/* Project icon with gradient */}
        <div
          className={`w-11 h-11 rounded-xl bg-gradient-to-br ${colorClass} flex items-center justify-center text-white font-bold text-lg shrink-0`}
        >
          {project.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p
            className="font-semibold text-white truncate transition-colors group-hover:text-brand-300"
            style={{ color: 'inherit' }}
          >
            {project.name}
          </p>
          {project.description && (
            <p className="text-xs text-slate-500 truncate mt-0.5">{project.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-lg"
          style={{ backgroundColor: 'var(--c-surface-2)', color: '#6b7a96' }}
        >
          {project.asset_count} varlık
        </span>
        <span className="text-xs text-slate-500">{formatRelative(project.created_at)}</span>
      </div>
    </button>
  )
}
