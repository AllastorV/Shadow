import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, Grid3X3, List, Filter, RefreshCw, Folder } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../utils/api'
import type { Asset, Project } from '../types'
import AssetCard from '../components/assets/AssetCard'
import UploadZone from '../components/assets/UploadZone'
import clsx from 'clsx'

const STATUS_FILTERS = ['all', 'pending', 'processing', 'ready', 'approved', 'rejected']
const TYPE_FILTERS = ['all', 'image', 'video', 'audio', 'document', 'other']

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [showUpload, setShowUpload] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')

  const { data: project } = useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: () => api.get(`/projects/${projectId}`).then((r) => r.data),
  })

  const { data: assets, isLoading, refetch } = useQuery<Asset[]>({
    queryKey: ['assets', projectId, statusFilter, typeFilter, search],
    queryFn: () => {
      const params: Record<string, string> = {}
      if (statusFilter !== 'all') params.status = statusFilter
      if (typeFilter !== 'all') params.asset_type = typeFilter
      if (search) params.search = search
      return api.get(`/assets/project/${projectId}`, { params }).then((r) => r.data)
    },
  })

  const handleUploadSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['assets', projectId] })
    queryClient.invalidateQueries({ queryKey: ['projects'] })
  }

  const counts = {
    all: assets?.length || 0,
    pending: assets?.filter((a) => a.status === 'pending').length || 0,
    approved: assets?.filter((a) => a.status === 'approved').length || 0,
    rejected: assets?.filter((a) => a.status === 'rejected').length || 0,
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-surface-300 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Folder size={18} className="text-brand-400 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white truncate">{project?.name || 'Project'}</h1>
            {project?.description && (
              <p className="text-xs text-slate-500 truncate">{project.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => refetch()} className="btn-ghost p-2" title="Refresh">
            <RefreshCw size={14} />
          </button>
          <button onClick={() => setShowUpload(true)} className="btn-primary">
            <Upload size={14} />
            Upload
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3 border-b border-surface-300 flex items-center gap-3 flex-wrap shrink-0">
        {/* Search */}
        <input
          className="input flex-1 min-w-48 max-w-xs"
          placeholder="Search assets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Status filter */}
        <div className="flex items-center gap-1">
          {['all', 'pending', 'approved', 'rejected'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={clsx(
                'px-3 py-1 rounded-lg text-xs font-medium transition-colors',
                statusFilter === s
                  ? 'bg-brand-600 text-white'
                  : 'bg-surface-200 text-slate-400 hover:text-slate-200'
              )}
            >
              {s === 'all' ? `All (${counts.all})` : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="input w-auto py-1 text-xs"
        >
          {TYPE_FILTERS.map((t) => (
            <option key={t} value={t}>{t === 'all' ? 'All types' : t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>

        {/* View toggle */}
        <div className="flex bg-surface-200 rounded-lg p-0.5 ml-auto">
          <button
            onClick={() => setView('grid')}
            className={clsx('p-1.5 rounded-md transition-colors', view === 'grid' ? 'bg-surface-300 text-white' : 'text-slate-500')}
          >
            <Grid3X3 size={14} />
          </button>
          <button
            onClick={() => setView('list')}
            className={clsx('p-1.5 rounded-md transition-colors', view === 'list' ? 'bg-surface-300 text-white' : 'text-slate-500')}
          >
            <List size={14} />
          </button>
        </div>
      </div>

      {/* Assets */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className={view === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' : ''}>
            {[...Array(8)].map((_, i) => (
              <div key={i} className="card animate-pulse bg-surface-100 h-40" />
            ))}
          </div>
        ) : assets?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Upload size={40} className="text-slate-600 mb-3" />
            <p className="text-slate-400 font-medium">No assets found</p>
            <p className="text-slate-500 text-sm mb-4">Upload your first media file</p>
            <button onClick={() => setShowUpload(true)} className="btn-primary">
              <Upload size={14} />
              Upload Assets
            </button>
          </div>
        ) : (
          <div
            className={
              view === 'grid'
                ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4'
                : 'card divide-y divide-surface-300'
            }
          >
            {assets?.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                view={view}
                onClick={() => navigate(`/projects/${projectId}/assets/${asset.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <UploadZone
          projectId={Number(projectId)}
          onSuccess={handleUploadSuccess}
          onClose={() => setShowUpload(false)}
        />
      )}
    </div>
  )
}
