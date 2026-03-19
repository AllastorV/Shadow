import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FolderOpen, Image, Video, Music, FileText, Clock, CheckCircle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../utils/api'
import type { Project } from '../types'
import { formatRelative } from '../utils/format'
import { useAuthStore } from '../store/auth'

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
    mutationFn: (data: { name: string; description: string }) => api.post('/projects/', data).then((r) => r.data),
    onSuccess: (project: Project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project created!')
      setShowNewProject(false)
      setProjectName('')
      setProjectDesc('')
      navigate(`/projects/${project.id}`)
    },
    onError: () => toast.error('Failed to create project'),
  })

  const totalAssets = projects?.reduce((s, p) => s + p.asset_count, 0) || 0

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-0.5">Welcome back, {user?.full_name}</p>
        </div>
        <button onClick={() => setShowNewProject(true)} className="btn-primary">
          <Plus size={16} />
          New Project
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Projects', value: projects?.length || 0, icon: <FolderOpen size={18} />, color: 'text-brand-400' },
          { label: 'Total Assets', value: totalAssets, icon: <Image size={18} />, color: 'text-emerald-400' },
          { label: 'Pending Review', value: '—', icon: <Clock size={18} />, color: 'text-amber-400' },
          { label: 'Approved', value: '—', icon: <CheckCircle size={18} />, color: 'text-teal-400' },
        ].map((stat) => (
          <div key={stat.label} className="card p-4">
            <div className={`${stat.color} mb-3`}>{stat.icon}</div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Projects Grid */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Projects</h2>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card h-36 animate-pulse bg-surface-100" />
            ))}
          </div>
        ) : projects?.length === 0 ? (
          <div className="card p-12 text-center">
            <FolderOpen size={40} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No projects yet</p>
            <p className="text-slate-500 text-sm mb-4">Create your first project to start managing media</p>
            <button onClick={() => setShowNewProject(true)} className="btn-primary mx-auto">
              <Plus size={16} />
              New Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects?.map((project) => (
              <ProjectCard key={project.id} project={project} onClick={() => navigate(`/projects/${project.id}`)} />
            ))}
          </div>
        )}
      </div>

      {/* New Project Modal */}
      {showNewProject && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-white mb-4">New Project</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Project Name</label>
                <input
                  className="input"
                  placeholder="Campaign Q1 2025"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Description (optional)</label>
                <input
                  className="input"
                  placeholder="Add a description..."
                  value={projectDesc}
                  onChange={(e) => setProjectDesc(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowNewProject(false)} className="btn-secondary flex-1 justify-center">
                Cancel
              </button>
              <button
                className="btn-primary flex-1 justify-center"
                disabled={!projectName.trim() || createProject.isPending}
                onClick={() => createProject.mutate({ name: projectName.trim(), description: projectDesc })}
              >
                {createProject.isPending ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="card p-5 text-left hover:border-brand-500/50 hover:bg-surface-100 transition-colors group"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-brand-600/20 border border-brand-500/30 flex items-center justify-center shrink-0">
          <FolderOpen size={18} className="text-brand-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white truncate group-hover:text-brand-300 transition-colors">
            {project.name}
          </p>
          {project.description && (
            <p className="text-xs text-slate-500 truncate mt-0.5">{project.description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{project.asset_count} assets</span>
        <span>{formatRelative(project.created_at)}</span>
      </div>
    </button>
  )
}
