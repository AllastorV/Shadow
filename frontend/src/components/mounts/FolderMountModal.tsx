import { useState, useCallback } from 'react'
import {
  X, FolderOpen, FolderPlus, ChevronRight, ChevronUp, File,
  CheckSquare, Square, Download, Loader2, Trash2, HardDrive,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../utils/api'
import { formatFileSize, formatDate } from '../../utils/format'
import type { FolderMount, FolderBrowseResult, FolderEntry } from '../../types'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface Props {
  projectId: number
  onClose: () => void
  onImported: () => void
}

type Step = 'list' | 'add' | 'browse'

export default function FolderMountModal({ projectId, onClose, onImported }: Props) {
  const queryClient = useQueryClient()
  const [step, setStep]           = useState<Step>('list')
  const [newPath, setNewPath]     = useState('')
  const [newLabel, setNewLabel]   = useState('')
  const [activeMountId, setActiveMountId] = useState<number | null>(null)
  const [currentSub, setCurrentSub]       = useState('')
  const [selected, setSelected]           = useState<Set<string>>(new Set())

  // ── Mounts ──────────────────────────────────────────────────────────────────
  const { data: mounts = [], isLoading: mountsLoading } = useQuery<FolderMount[]>({
    queryKey: ['mounts', projectId],
    queryFn:  () => api.get(`/mounts/projects/${projectId}`).then(r => r.data),
  })

  const addMountMutation = useMutation({
    mutationFn: () => api.post(`/mounts/projects/${projectId}`, { path: newPath, label: newLabel || newPath }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['mounts', projectId] })
      toast.success('Klasör bağlandı!')
      setNewPath('')
      setNewLabel('')
      setActiveMountId(res.data.id)
      setCurrentSub('')
      setSelected(new Set())
      setStep('browse')
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Klasör bağlanamadı'),
  })

  const deleteMountMutation = useMutation({
    mutationFn: (mountId: number) => api.delete(`/mounts/projects/${projectId}/${mountId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mounts', projectId] })
      toast.success('Bağlantı kaldırıldı')
    },
    onError: () => toast.error('Kaldırma başarısız'),
  })

  // ── Browse ───────────────────────────────────────────────────────────────────
  const { data: browse, isLoading: browseLoading } = useQuery<FolderBrowseResult>({
    queryKey: ['mount-browse', activeMountId, currentSub],
    queryFn:  () =>
      api.get(`/mounts/${activeMountId}/browse`, { params: { sub: currentSub } }).then(r => r.data),
    enabled:  step === 'browse' && activeMountId !== null,
  })

  // ── Import ───────────────────────────────────────────────────────────────────
  const importMutation = useMutation({
    mutationFn: () =>
      api.post(`/mounts/${activeMountId}/import`, { files: Array.from(selected) }),
    onSuccess: (res) => {
      toast.success(`${res.data.imported} dosya içe aktarıldı!`)
      setSelected(new Set())
      onImported()
      onClose()
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'İçe aktarma başarısız'),
  })

  // ── Toggle selection ─────────────────────────────────────────────────────────
  const toggleFile = useCallback((path: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })
  }, [])

  const toggleAllFiles = useCallback(() => {
    const files = (browse?.entries ?? []).filter(e => e.type === 'file')
    const allPaths = files.map(e => e.path)
    const allSelected = allPaths.every(p => selected.has(p))
    setSelected(prev => {
      const next = new Set(prev)
      if (allSelected) {
        allPaths.forEach(p => next.delete(p))
      } else {
        allPaths.forEach(p => next.add(p))
      }
      return next
    })
  }, [browse, selected])

  const openMount = (mountId: number) => {
    setActiveMountId(mountId)
    setCurrentSub('')
    setSelected(new Set())
    setStep('browse')
  }

  const navigateInto = (entry: FolderEntry) => {
    setCurrentSub(entry.path)
  }

  const navigateUp = () => {
    const parts = currentSub.split('/').filter(Boolean)
    parts.pop()
    setCurrentSub(parts.join('/'))
  }

  const breadcrumbs = currentSub ? currentSub.split('/').filter(Boolean) : []
  const filesInView = (browse?.entries ?? []).filter(e => e.type === 'file')
  const allInViewSelected = filesInView.length > 0 && filesInView.every(e => selected.has(e.path))

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-2xl flex flex-col" style={{ maxHeight: '85vh' }}>

        {/* Header */}
        <div className="p-5 border-b border-surface-300 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <HardDrive size={16} className="text-brand-400" />
            <h3 className="font-semibold text-white">
              {step === 'list'   && 'Bağlı Klasörler'}
              {step === 'add'    && 'Klasör Bağla'}
              {step === 'browse' && (browse?.mount_label ?? 'Klasör Tara')}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {step !== 'list' && (
              <button onClick={() => setStep('list')} className="btn-ghost text-xs px-2 py-1">
                ← Geri
              </button>
            )}
            <button onClick={onClose} className="btn-ghost p-1">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Step: List mounts ─────────────────────────────────────────────── */}
        {step === 'list' && (
          <div className="flex-1 overflow-auto p-5 space-y-3">
            <button
              onClick={() => setStep('add')}
              className="btn-primary w-full justify-center"
            >
              <FolderPlus size={14} />
              Yeni Klasör Bağla
            </button>

            {mountsLoading && (
              <div className="text-center py-8 text-slate-500">
                <Loader2 size={20} className="animate-spin mx-auto" />
              </div>
            )}

            {!mountsLoading && mounts.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-sm">
                <FolderOpen size={36} className="mx-auto mb-2 opacity-40" />
                Henüz bağlı klasör yok
              </div>
            )}

            {mounts.map(m => (
              <div
                key={m.id}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ backgroundColor: 'var(--c-surface-1)', border: '1px solid var(--c-surface-3)' }}
              >
                <FolderOpen size={16} className="text-amber-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{m.label}</p>
                  <p className="text-xs text-slate-500 truncate font-mono">{m.path}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => openMount(m.id)}
                    className="btn-ghost text-xs px-2 py-1"
                    title="Gözat ve içe aktar"
                  >
                    <ChevronRight size={13} /> Gözat
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`"${m.label}" bağlantısını kaldırmak istediğinize emin misiniz?`))
                        deleteMountMutation.mutate(m.id)
                    }}
                    className="btn-ghost p-1.5 text-red-400 hover:text-red-300"
                    title="Bağlantıyı kaldır"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Step: Add mount ───────────────────────────────────────────────── */}
        {step === 'add' && (
          <div className="flex-1 p-5 space-y-4">
            <p className="text-sm text-slate-400">
              Sunucunun dosya sistemindeki bir klasör yolunu girin.
              Docker kullanıyorsanız, klasörün container içinde monte edilmiş olması gerekir.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                Klasör Yolu
              </label>
              <input
                className="input"
                placeholder="/home/user/Videos  veya  D:\Projeler\2024"
                value={newPath}
                onChange={e => setNewPath(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && newPath && addMountMutation.mutate()}
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                Etiket (opsiyonel)
              </label>
              <input
                className="input"
                placeholder="ör. 2024 Proje Videoları"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
              />
            </div>

            <button
              onClick={() => addMountMutation.mutate()}
              disabled={!newPath.trim() || addMountMutation.isPending}
              className="btn-primary w-full justify-center"
            >
              {addMountMutation.isPending ? (
                <><Loader2 size={14} className="animate-spin" /> Bağlanıyor…</>
              ) : (
                <><FolderPlus size={14} /> Bağla ve Gözat</>
              )}
            </button>
          </div>
        )}

        {/* ── Step: Browse ──────────────────────────────────────────────────── */}
        {step === 'browse' && (
          <>
            {/* Breadcrumb */}
            <div className="px-5 py-2 border-b border-surface-300 flex items-center gap-1 text-xs text-slate-500 shrink-0 overflow-x-auto">
              <button
                onClick={() => setCurrentSub('')}
                className="hover:text-brand-400 transition-colors shrink-0"
              >
                {browse?.mount_label ?? '…'}
              </button>
              {breadcrumbs.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1 shrink-0">
                  <ChevronRight size={12} />
                  <button
                    onClick={() => setCurrentSub(breadcrumbs.slice(0, i + 1).join('/'))}
                    className="hover:text-brand-400 transition-colors"
                  >
                    {crumb}
                  </button>
                </span>
              ))}
              {currentSub && (
                <button
                  onClick={navigateUp}
                  className="ml-auto shrink-0 flex items-center gap-1 hover:text-brand-400 transition-colors"
                >
                  <ChevronUp size={12} /> Üst Klasör
                </button>
              )}
            </div>

            {/* File list */}
            <div className="flex-1 overflow-auto">
              {browseLoading ? (
                <div className="flex items-center justify-center h-32 text-slate-500">
                  <Loader2 size={20} className="animate-spin" />
                </div>
              ) : !browse || browse.entries.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
                  Bu klasörde desteklenen dosya yok
                </div>
              ) : (
                <div className="divide-y divide-surface-300">
                  {/* Tümünü seç satırı */}
                  {filesInView.length > 0 && (
                    <button
                      onClick={toggleAllFiles}
                      className="flex items-center gap-3 px-5 py-2.5 w-full text-left text-xs text-slate-500 hover:bg-surface-100 transition-colors"
                    >
                      {allInViewSelected
                        ? <CheckSquare size={13} className="text-brand-400" />
                        : <Square size={13} />}
                      Bu klasördeki tüm dosyaları seç ({filesInView.length})
                    </button>
                  )}

                  {browse.entries.map(entry => (
                    <EntryRow
                      key={entry.path}
                      entry={entry}
                      selected={entry.type === 'file' && selected.has(entry.path)}
                      onToggle={() => entry.type === 'file' && toggleFile(entry.path)}
                      onNavigate={() => entry.type === 'dir' && navigateInto(entry)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-surface-300 flex items-center gap-3 shrink-0">
              <span className="text-sm text-slate-400 flex-1">
                {selected.size > 0
                  ? <><span className="text-white font-semibold">{selected.size}</span> dosya seçildi</>
                  : 'Dosya seçin'}
              </span>
              <button
                onClick={() => importMutation.mutate()}
                disabled={selected.size === 0 || importMutation.isPending}
                className="btn-primary"
              >
                {importMutation.isPending ? (
                  <><Loader2 size={14} className="animate-spin" /> Aktarılıyor…</>
                ) : (
                  <><Download size={14} /> {selected.size > 0 ? `${selected.size} Dosyayı Aktar` : 'Aktar'}</>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Satır bileşeni ────────────────────────────────────────────────────────────

function EntryRow({
  entry, selected, onToggle, onNavigate,
}: {
  entry: FolderEntry
  selected: boolean
  onToggle: () => void
  onNavigate: () => void
}) {
  const isDir = entry.type === 'dir'

  return (
    <button
      onClick={isDir ? onNavigate : onToggle}
      className={clsx(
        'flex items-center gap-3 px-5 py-3 w-full text-left transition-colors',
        selected ? 'bg-brand-600/10' : 'hover:bg-surface-100',
      )}
    >
      {isDir ? (
        <FolderOpen size={16} className="text-amber-400 shrink-0" />
      ) : selected ? (
        <CheckSquare size={16} className="text-brand-400 shrink-0" />
      ) : (
        <Square size={16} className="text-slate-500 shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <p className={clsx('text-sm truncate', selected ? 'text-brand-300' : 'text-slate-200')}>
          {entry.name}
        </p>
        {entry.extension && (
          <p className="text-xs text-slate-500 uppercase">{entry.extension.replace('.', '')}</p>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0 text-xs text-slate-500">
        {entry.size != null && <span>{formatFileSize(entry.size)}</span>}
        {isDir && <ChevronRight size={14} />}
      </div>
    </button>
  )
}
