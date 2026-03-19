import { useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Upload, Grid3X3, List, RefreshCw, Folder, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import api from '../utils/api'
import type { Asset, Project } from '../types'
import AssetCard from '../components/assets/AssetCard'
import UploadZone from '../components/assets/UploadZone'
import clsx from 'clsx'
import { useDebounce } from '../utils/useDebounce'
import { useShortcutAction } from '../utils/shortcuts'

const STATUS_FILTERS = ['all', 'pending', 'approved', 'rejected'] as const
const TYPE_FILTERS   = ['all', 'image', 'video', 'audio', 'document', 'other'] as const

type SortBy    = 'name' | 'date' | 'size' | 'type' | 'status'
type SortOrder = 'asc' | 'desc'

const STATUS_LABELS: Record<string, string> = {
  all: 'Tümü', pending: 'Bekliyor', approved: 'Onaylı',
  rejected: 'Reddedildi', processing: 'İşleniyor', ready: 'Hazır',
}
const TYPE_LABELS: Record<string, string> = {
  all: 'Tüm türler', image: 'Görüntü', video: 'Video',
  audio: 'Ses', document: 'Belge', other: 'Diğer',
}
const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'date',   label: 'Tarih'  },
  { value: 'name',   label: 'Ad'     },
  { value: 'size',   label: 'Boyut'  },
  { value: 'type',   label: 'Tür'    },
  { value: 'status', label: 'Durum'  },
]

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate      = useNavigate()
  const queryClient   = useQueryClient()

  const [view,         setView]         = useState<'grid' | 'list'>('grid')
  const [showUpload,   setShowUpload]   = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter,   setTypeFilter]   = useState('all')
  const [searchInput,  setSearchInput]  = useState('')
  const [sortBy,       setSortBy]       = useState<SortBy>('date')
  const [sortOrder,    setSortOrder]    = useState<SortOrder>('desc')

  const search = useDebounce(searchInput, 400)

  const { data: project } = useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn:  () => api.get(`/projects/${projectId}`).then((r) => r.data),
  })

  const { data: assets, isLoading, refetch } = useQuery<Asset[]>({
    queryKey: ['assets', projectId, statusFilter, typeFilter, search, sortBy, sortOrder],
    queryFn: () => {
      const params: Record<string, string> = { sort_by: sortBy, sort_order: sortOrder }
      if (statusFilter !== 'all') params.status     = statusFilter
      if (typeFilter   !== 'all') params.asset_type = typeFilter
      if (search)                 params.search      = search
      return api.get(`/assets/project/${projectId}`, { params }).then((r) => r.data)
    },
    staleTime: 60_000,
  })

  const counts = useMemo(() => ({
    all:      assets?.length ?? 0,
    pending:  assets?.filter((a) => a.status === 'pending').length  ?? 0,
    approved: assets?.filter((a) => a.status === 'approved').length ?? 0,
    rejected: assets?.filter((a) => a.status === 'rejected').length ?? 0,
  }), [assets])

  const handleUploadSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['assets', projectId] })
    queryClient.invalidateQueries({ queryKey: ['projects'] })
  }, [queryClient, projectId])

  const handleSetView      = useCallback((v: 'grid' | 'list') => setView(v), [])
  const handleStatusFilter = useCallback((s: string) => setStatusFilter(s), [])
  const handleTypeFilter   = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => setTypeFilter(e.target.value), [])
  const handleSortBy       = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => setSortBy(e.target.value as SortBy), [])
  const toggleSortOrder    = useCallback(() => setSortOrder((o) => o === 'asc' ? 'desc' : 'asc'), [])

  useShortcutAction('view_grid', () => setView('grid'))
  useShortcutAction('view_list', () => setView('list'))
  useShortcutAction('upload',    () => setShowUpload(true))

  const handleAssetClick = useCallback(
    (assetId: number) => () => navigate(`/projects/${projectId}/assets/${assetId}`),
    [navigate, projectId],
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-surface-300 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Folder size={18} className="text-brand-400 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white truncate">{project?.name || 'Proje'}</h1>
            {project?.description && (
              <p className="text-xs text-slate-500 truncate">{project.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => refetch()} className="btn-ghost p-2" title="Yenile">
            <RefreshCw size={14} />
          </button>
          <button onClick={() => setShowUpload(true)} className="btn-primary">
            <Upload size={14} />
            Yükle
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3 border-b border-surface-300 flex items-center gap-3 flex-wrap shrink-0">
        {/* Arama */}
        <input
          className="input flex-1 min-w-40 max-w-xs"
          placeholder="Asset ara…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />

        {/* Durum filtresi */}
        <div className="flex items-center gap-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => handleStatusFilter(s)}
              className={clsx(
                'px-3 py-1 rounded-lg text-xs font-medium transition-colors',
                statusFilter === s
                  ? 'bg-brand-600 text-white'
                  : 'bg-surface-200 text-slate-400 hover:text-slate-200',
              )}
            >
              {s === 'all' ? `${STATUS_LABELS.all} (${counts.all})` : STATUS_LABELS[s]}
              {s !== 'all' && counts[s as keyof typeof counts] > 0 && (
                <span className="ml-1 opacity-60">({counts[s as keyof typeof counts]})</span>
              )}
            </button>
          ))}
        </div>

        {/* Tür filtresi */}
        <select
          value={typeFilter}
          onChange={handleTypeFilter}
          className="input w-auto py-1 text-xs"
        >
          {TYPE_FILTERS.map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>

        {/* Sıralama */}
        <div className="flex items-center gap-1">
          <select
            value={sortBy}
            onChange={handleSortBy}
            className="input w-auto py-1 text-xs"
            title="Sıralama ölçütü"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            onClick={toggleSortOrder}
            className="btn-ghost p-1.5"
            title={sortOrder === 'asc' ? 'Artan sıra — tıkla: azalan' : 'Azalan sıra — tıkla: artan'}
          >
            {sortBy === 'date' && sortOrder === 'desc' ? (
              <ArrowDown size={13} className="text-brand-400" />
            ) : sortBy === 'date' && sortOrder === 'asc' ? (
              <ArrowUp size={13} className="text-brand-400" />
            ) : sortOrder === 'asc' ? (
              <ArrowUp size={13} className="text-brand-400" />
            ) : (
              <ArrowDown size={13} className="text-brand-400" />
            )}
          </button>
        </div>

        {/* Görünüm geçişi */}
        <div className="flex bg-surface-200 rounded-lg p-0.5 ml-auto">
          <button
            onClick={() => handleSetView('grid')}
            className={clsx('p-1.5 rounded-md transition-colors', view === 'grid' ? 'bg-surface-300 text-white' : 'text-slate-500')}
            title="Izgara"
          >
            <Grid3X3 size={14} />
          </button>
          <button
            onClick={() => handleSetView('list')}
            className={clsx('p-1.5 rounded-md transition-colors', view === 'list' ? 'bg-surface-300 text-white' : 'text-slate-500')}
            title="Liste"
          >
            <List size={14} />
          </button>
        </div>
      </div>

      {/* Asset Listesi */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <SkeletonGrid view={view} />
        ) : assets?.length === 0 ? (
          <EmptyState
            onUpload={() => setShowUpload(true)}
            hasFilters={statusFilter !== 'all' || typeFilter !== 'all' || !!search}
          />
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
                onClick={handleAssetClick(asset.id)}
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

// ── Yardımcı bileşenler ────────────────────────────────────────────────────────

function SkeletonGrid({ view }: { view: 'grid' | 'list' }) {
  return (
    <div className={view === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' : 'space-y-2'}>
      {[...Array(8)].map((_, i) => (
        <div key={i} className="card animate-pulse bg-surface-100 h-40" />
      ))}
    </div>
  )
}

function EmptyState({ onUpload, hasFilters }: { onUpload: () => void; hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <Upload size={40} className="text-slate-600 mb-3" />
      <p className="text-slate-400 font-medium">
        {hasFilters ? 'Filtreyle eşleşen asset bulunamadı' : 'Henüz asset yok'}
      </p>
      {!hasFilters && (
        <>
          <p className="text-slate-500 text-sm mb-4">İlk medya dosyanı yükle</p>
          <button onClick={onUpload} className="btn-primary">
            <Upload size={14} />
            Asset Yükle
          </button>
        </>
      )}
    </div>
  )
}
