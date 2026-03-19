import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Tag, Sparkles, CheckCircle, XCircle, Clock, Download,
  Share2, MessageSquare, Image, Video, Music, FileText,
  Loader2, Link2, Lock, Calendar, Eye, Copy, CheckCheck,
  Trash2, DownloadCloud,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../utils/api'
import type { Asset, Comment, ShareLink } from '../types'
import { formatFileSize, formatDate, formatRelative } from '../utils/format'
import { useAuthStore } from '../store/auth'
import clsx from 'clsx'

type Tab = 'info' | 'comments' | 'share'

export default function AssetDetailPage() {
  const { projectId, assetId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const [tab, setTab] = useState<Tab>('info')
  const [newComment, setNewComment] = useState('')
  const [sharePermission, setSharePermission] = useState<'view' | 'comment' | 'download'>('view')
  const [shareLabel, setShareLabel] = useState('')
  const [sharePassword, setSharePassword] = useState('')
  const [shareExpiry, setShareExpiry] = useState('')

  const { data: asset, isLoading } = useQuery<Asset>({
    queryKey: ['asset', assetId],
    queryFn: () => api.get(`/assets/${assetId}`).then((r) => r.data),
  })

  const { data: comments } = useQuery<Comment[]>({
    queryKey: ['comments', assetId],
    queryFn: () => api.get(`/comments/asset/${assetId}`).then((r) => r.data),
    enabled: tab === 'comments',
  })

  const { data: shareLinks } = useQuery<ShareLink[]>({
    queryKey: ['shareLinks', assetId],
    queryFn: () => api.get(`/share/asset/${assetId}`).then((r) => r.data),
    enabled: tab === 'share',
  })

  const aiTagMutation = useMutation({
    mutationFn: () => api.post(`/assets/${assetId}/ai-tag`).then((r) => r.data),
    onSuccess: (updated: Asset) => {
      queryClient.setQueryData(['asset', assetId], updated)
      toast.success('AI etiketler güncellendi!')
    },
    onError: () => toast.error('AI etiketleme başarısız'),
  })

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/assets/${assetId}/status?status=${status}`).then((r) => r.data),
    onSuccess: (updated: Asset) => {
      queryClient.setQueryData(['asset', assetId], updated)
      queryClient.invalidateQueries({ queryKey: ['assets', projectId] })
      toast.success(`Status updated to ${updated.status}`)
    },
  })

  const addCommentMutation = useMutation({
    mutationFn: (content: string) => api.post(`/comments/asset/${assetId}`, { content }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', assetId] })
      queryClient.invalidateQueries({ queryKey: ['asset', assetId] })
      setNewComment('')
    },
  })

  const createShareMutation = useMutation({
    mutationFn: () =>
      api.post(`/share/asset/${assetId}`, {
        permission: sharePermission,
        expires_at: shareExpiry || null,
        password: sharePassword || null,
      }, { params: { label: shareLabel || undefined } }).then((r) => r.data),
    onSuccess: (newLink) => {
      queryClient.invalidateQueries({ queryKey: ['shareLinks', assetId] })
      const url = `${window.location.origin}/share/${newLink.token}`
      navigator.clipboard.writeText(url).catch(() => {})
      toast.success('Link oluşturuldu ve panoya kopyalandı!')
      setShareLabel('')
      setSharePassword('')
      setShareExpiry('')
    },
    onError: () => toast.error('Link oluşturulamadı'),
  })

  const revokeMutation = useMutation({
    mutationFn: (linkId: number) => api.patch(`/share/${linkId}/revoke`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shareLinks', assetId] })
      toast.success('Link iptal edildi')
    },
    onError: () => toast.error('İptal işlemi başarısız'),
  })

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 size={24} className="animate-spin text-brand-400" />
    </div>
  )

  if (!asset) return <div className="p-6 text-slate-400">Asset not found</div>

  // Kimlik doğrulamalı dosya URL'i (video/audio streaming için /files/ static mount)
  const assetUrl = `/files/${asset.project_id}/${asset.filename}`
  // İndirme: kimlik doğrulamalı endpoint
  const downloadUrl = `/api/v1/assets/${assetId}/download`

  return (
    <div className="flex h-full">
      {/* Preview Panel */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-surface-300">
        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-surface-300 flex items-center gap-3 shrink-0">
          <button onClick={() => navigate(-1)} className="btn-ghost p-1.5">
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{asset.original_name}</p>
          </div>
          {/* Status actions */}
          <div className="flex gap-2">
            <button
              onClick={() => statusMutation.mutate('approved')}
              disabled={asset.status === 'approved' || statusMutation.isPending}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                asset.status === 'approved'
                  ? 'bg-emerald-600/30 text-emerald-400'
                  : 'bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400'
              )}
            >
              <CheckCircle size={13} /> Approve
            </button>
            <button
              onClick={() => statusMutation.mutate('rejected')}
              disabled={asset.status === 'rejected' || statusMutation.isPending}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                asset.status === 'rejected'
                  ? 'bg-red-600/30 text-red-400'
                  : 'bg-red-600/20 hover:bg-red-600/40 text-red-400'
              )}
            >
              <XCircle size={13} /> Reject
            </button>
            <button
              onClick={() => statusMutation.mutate('pending')}
              disabled={asset.status === 'pending'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 transition-colors"
            >
              <Clock size={13} /> In Review
            </button>
          </div>
          <a href={downloadUrl} download={asset.original_name} className="btn-ghost p-2" title="İndir">
            <Download size={15} />
          </a>
        </div>

        {/* Preview */}
        <div className="flex-1 flex items-center justify-center bg-black/20 p-4 overflow-hidden">
          {asset.asset_type === 'image' && (
            <img src={assetUrl} alt={asset.original_name} className="max-w-full max-h-full object-contain rounded-lg" />
          )}
          {asset.asset_type === 'video' && (
            <video src={assetUrl} controls className="max-w-full max-h-full rounded-lg" />
          )}
          {asset.asset_type === 'audio' && (
            <div className="text-center">
              <Music size={64} className="text-slate-600 mx-auto mb-4" />
              <audio src={assetUrl} controls className="w-64" />
            </div>
          )}
          {(asset.asset_type === 'document' || asset.asset_type === 'other') && (
            <div className="text-center text-slate-500">
              <FileText size={64} className="mx-auto mb-3" />
              <p className="text-sm">{asset.mime_type}</p>
            </div>
          )}
        </div>
      </div>

      {/* Info Panel */}
      <div className="w-80 flex flex-col bg-surface-50 shrink-0">
        {/* Tabs */}
        <div className="flex border-b border-surface-300">
          {([
            { id: 'info', label: 'Bilgi' },
            { id: 'comments', label: `Yorum${asset.comment_count ? ` (${asset.comment_count})` : ''}` },
            { id: 'share', label: 'Paylaş' },
          ] as { id: Tab; label: string }[]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={clsx(
                'flex-1 py-3 text-xs font-medium transition-colors',
                tab === t.id ? 'text-brand-400 border-b-2 border-brand-500' : 'text-slate-500 hover:text-slate-300'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* INFO TAB */}
          {tab === 'info' && (
            <>
              {/* Status */}
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Status</p>
                <StatusBadge status={asset.status} />
              </div>

              {/* AI Description */}
              {asset.ai_description && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
                    <Sparkles size={11} className="text-brand-400" /> AI Description
                  </p>
                  <p className="text-sm text-slate-300 leading-relaxed">{asset.ai_description}</p>
                </div>
              )}

              {/* AI Tags */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-slate-500 flex items-center gap-1">
                    <Tag size={11} /> Tags
                  </p>
                  <button
                    onClick={() => aiTagMutation.mutate()}
                    disabled={aiTagMutation.isPending}
                    className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors"
                  >
                    {aiTagMutation.isPending ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <Sparkles size={11} />
                    )}
                    AI Tag
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(asset.ai_tags || []).map((tag) => (
                    <span key={tag} className="badge bg-brand-600/20 text-brand-300">{tag}</span>
                  ))}
                  {asset.tags?.filter((t) => !t.is_ai_generated).map((tag) => (
                    <span key={tag.id} className="badge bg-surface-200 text-slate-400">{tag.name}</span>
                  ))}
                  {(!asset.ai_tags || asset.ai_tags.length === 0) && (
                    <p className="text-xs text-slate-600">No tags yet. Click AI Tag to generate.</p>
                  )}
                </div>
              </div>

              {/* ── Sinematografi Bilgileri ── */}
              {(asset.shot_scale || asset.camera_angle || asset.camera_movement ||
                asset.lighting_type || asset.color_tone) && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <span>🎬</span> Sinematografi
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {asset.shot_scale && asset.shot_scale !== 'unknown' && (
                      <CineField label="Çekim Ölçeği" value={SHOT_SCALE_LABELS[asset.shot_scale] ?? asset.shot_scale} color="bg-violet-500/20 text-violet-300" />
                    )}
                    {asset.camera_angle && asset.camera_angle !== 'unknown' && (
                      <CineField label="Kamera Açısı" value={CAMERA_ANGLE_LABELS[asset.camera_angle] ?? asset.camera_angle} color="bg-blue-500/20 text-blue-300" />
                    )}
                    {asset.camera_movement && asset.camera_movement !== 'unknown' && (
                      <CineField label="Kamera Hareketi" value={CAMERA_MOVEMENT_LABELS[asset.camera_movement] ?? asset.camera_movement} color="bg-cyan-500/20 text-cyan-300" />
                    )}
                    {asset.lighting_type && (
                      <CineField label="Işık" value={LIGHTING_LABELS[asset.lighting_type] ?? asset.lighting_type} color="bg-amber-500/20 text-amber-300" />
                    )}
                    {asset.color_tone && (
                      <CineField label="Renk Tonu" value={COLOR_TONE_LABELS[asset.color_tone] ?? asset.color_tone} color="bg-pink-500/20 text-pink-300" />
                    )}
                    {asset.ai_scene_type && (
                      <CineField label="Mekan" value={SCENE_TYPE_LABELS[asset.ai_scene_type] ?? asset.ai_scene_type} color="bg-teal-500/20 text-teal-300" />
                    )}
                  </div>
                </div>
              )}

              {/* Kompozisyon */}
              {asset.composition_tags && asset.composition_tags.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Kompozisyon</p>
                  <div className="flex flex-wrap gap-1">
                    {asset.composition_tags.map((c) => (
                      <span key={c} className="badge bg-indigo-500/20 text-indigo-300">
                        {COMPOSITION_LABELS[c] ?? c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Konu/Özne */}
              {asset.subject_tags && asset.subject_tags.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Konu / Özne</p>
                  <div className="flex flex-wrap gap-1">
                    {asset.subject_tags.map((s) => (
                      <span key={s} className="badge bg-emerald-500/20 text-emerald-300">
                        {SUBJECT_LABELS[s] ?? s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Atmosfer */}
              {asset.mood_tags && asset.mood_tags.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Atmosfer / Duygu</p>
                  <div className="flex flex-wrap gap-1">
                    {asset.mood_tags.map((m) => (
                      <span key={m} className="badge bg-rose-500/20 text-rose-300">
                        {MOOD_LABELS[m] ?? m}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Nesneler */}
              {asset.ai_objects && asset.ai_objects.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Tespit Edilen</p>
                  <div className="flex flex-wrap gap-1">
                    {asset.ai_objects.map((obj) => (
                      <span key={obj} className="badge bg-surface-200 text-slate-400">{obj}</span>
                    ))}
                  </div>
                </div>
              )}
              {asset.ai_colors && asset.ai_colors.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Renkler</p>
                  <div className="flex flex-wrap gap-1">
                    {asset.ai_colors.map((c) => (
                      <span key={c} className="badge bg-surface-200 text-slate-400">{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* File Details */}
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">File Details</p>
                <div className="space-y-1.5">
                  {[
                    { label: 'Size', value: formatFileSize(asset.file_size) },
                    { label: 'Type', value: asset.mime_type },
                    { label: 'Format', value: asset.asset_type.toUpperCase() },
                    ...(asset.width ? [{ label: 'Dimensions', value: `${asset.width} × ${asset.height}px` }] : []),
                    { label: 'Uploaded', value: formatDate(asset.created_at) },
                  ].map((row) => (
                    <div key={row.label} className="flex justify-between text-xs">
                      <span className="text-slate-500">{row.label}</span>
                      <span className="text-slate-300">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* COMMENTS TAB */}
          {tab === 'comments' && (
            <>
              <div className="space-y-3">
                {comments?.map((c) => (
                  <div key={c.id} className={clsx('p-3 rounded-lg', c.is_resolved ? 'bg-surface-100 opacity-60' : 'bg-surface-100')}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-slate-300">{c.author?.full_name || 'User'}</span>
                      <span className="text-xs text-slate-600">{formatRelative(c.created_at)}</span>
                    </div>
                    <p className="text-sm text-slate-200">{c.content}</p>
                    {c.timestamp != null && (
                      <span className="text-xs text-brand-400 mt-1">@ {c.timestamp.toFixed(1)}s</span>
                    )}
                    {c.is_resolved && <span className="text-xs text-emerald-500 block mt-1">✓ Resolved</span>}
                  </div>
                ))}
                {!comments?.length && (
                  <p className="text-center text-slate-500 text-sm py-8">No comments yet</p>
                )}
              </div>
              <div className="sticky bottom-0 pt-3 bg-surface-50">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="input resize-none h-20"
                  placeholder="Add a comment..."
                />
                <button
                  onClick={() => newComment.trim() && addCommentMutation.mutate(newComment.trim())}
                  disabled={!newComment.trim() || addCommentMutation.isPending}
                  className="btn-primary w-full justify-center mt-2"
                >
                  <MessageSquare size={13} />
                  {addCommentMutation.isPending ? 'Posting…' : 'Post Comment'}
                </button>
              </div>
            </>
          )}

          {/* SHARE TAB */}
          {tab === 'share' && (
            <>
              {/* Mevcut linkler */}
              {shareLinks && shareLinks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Paylaşım Linkleri</p>
                  {shareLinks.map((link) => (
                    <ShareLinkCard
                      key={link.id}
                      link={link}
                      onRevoke={() => revokeMutation.mutate(link.id)}
                      revoking={revokeMutation.isPending}
                    />
                  ))}
                </div>
              )}

              {/* Yeni link oluştur */}
              <div className={clsx('space-y-3', shareLinks && shareLinks.length > 0 && 'border-t border-surface-300 pt-4')}>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Yeni Link Oluştur</p>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Etiket</label>
                  <input
                    className="input text-xs"
                    placeholder="ör. Müşteri İncelemesi"
                    value={shareLabel}
                    onChange={(e) => setShareLabel(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">İzin</label>
                  <select className="input text-xs" value={sharePermission} onChange={(e) => setSharePermission(e.target.value as any)}>
                    <option value="view">Yalnızca görüntüle</option>
                    <option value="comment">Yorum yap</option>
                    <option value="download">İndir</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                    <Lock size={10} /> Parola (isteğe bağlı)
                  </label>
                  <input
                    className="input text-xs"
                    type="password"
                    placeholder="En az 4 karakter"
                    value={sharePassword}
                    onChange={(e) => setSharePassword(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                    <Calendar size={10} /> Son kullanma tarihi (isteğe bağlı)
                  </label>
                  <input
                    className="input text-xs"
                    type="datetime-local"
                    value={shareExpiry}
                    onChange={(e) => setShareExpiry(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => createShareMutation.mutate()}
                  disabled={createShareMutation.isPending}
                  className="btn-primary w-full justify-center"
                >
                  <Share2 size={13} />
                  {createShareMutation.isPending ? 'Oluşturuluyor…' : 'Link Oluştur'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── ShareLinkCard ──────────────────────────────────────────────────────────────

function ShareLinkCard({
  link,
  onRevoke,
  revoking,
}: {
  link: ShareLink
  onRevoke: () => void
  revoking: boolean
}) {
  const [copied, setCopied] = useState(false)
  const shareUrl = `${window.location.origin}/share/${link.token}`

  const isExpired = link.expires_at
    ? new Date(link.expires_at) < new Date()
    : false

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    toast.success('Link kopyalandı!')
    setTimeout(() => setCopied(false), 2500)
  }

  const PERMISSION_CONFIG = {
    view: { label: 'Görüntüle', color: 'bg-blue-500/20 text-blue-300' },
    comment: { label: 'Yorum', color: 'bg-purple-500/20 text-purple-300' },
    download: { label: 'İndir', color: 'bg-emerald-500/20 text-emerald-300' },
  }
  const perm = PERMISSION_CONFIG[link.permission as keyof typeof PERMISSION_CONFIG] || PERMISSION_CONFIG.view

  return (
    <div className={clsx(
      'rounded-xl border p-3 transition-opacity',
      link.is_active && !isExpired
        ? 'bg-surface-100 border-surface-300'
        : 'bg-surface-100 border-surface-300 opacity-50'
    )}>
      {/* Üst satır */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-medium text-slate-200 truncate">
          {link.label || 'Adsız Link'}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {isExpired ? (
            <span className="badge bg-amber-500/20 text-amber-400 flex items-center gap-0.5">
              <Clock size={9} /> Süresi Doldu
            </span>
          ) : !link.is_active ? (
            <span className="badge bg-surface-300 text-slate-500">İptal Edildi</span>
          ) : (
            <span className="badge bg-emerald-500/20 text-emerald-400">Aktif</span>
          )}
          <span className={clsx('badge text-[10px]', perm.color)}>{perm.label}</span>
        </div>
      </div>

      {/* URL */}
      <div
        onClick={copyLink}
        className="flex items-center gap-2 bg-surface-200 rounded-lg px-2.5 py-1.5 cursor-pointer hover:bg-surface-100 transition-colors mb-2 group"
        title="Kopyalamak için tıkla"
      >
        <Link2 size={11} className="text-slate-500 shrink-0" />
        <span className="text-xs text-slate-400 truncate flex-1 font-mono">
          {shareUrl.replace(/^https?:\/\//, '')}
        </span>
        {copied
          ? <CheckCheck size={11} className="text-emerald-400 shrink-0" />
          : <Copy size={11} className="text-slate-600 group-hover:text-slate-400 shrink-0" />
        }
      </div>

      {/* Alt meta */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-[11px] text-slate-600">
          <span className="flex items-center gap-0.5"><Eye size={10} /> {link.view_count}</span>
          {link.download_count > 0 && (
            <span className="flex items-center gap-0.5"><DownloadCloud size={10} /> {link.download_count}</span>
          )}
          {link.expires_at && (
            <span className="flex items-center gap-0.5">
              <Calendar size={10} /> {new Date(link.expires_at).toLocaleDateString('tr-TR')}
            </span>
          )}
        </div>
        {link.is_active && !isExpired && (
          <button
            onClick={onRevoke}
            disabled={revoking}
            className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 transition-colors"
          >
            <Trash2 size={10} /> İptal
          </button>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    pending: { label: 'Pending Review', className: 'status-pending' },
    processing: { label: 'Processing', className: 'status-processing' },
    ready: { label: 'Ready', className: 'status-ready' },
    approved: { label: 'Approved', className: 'status-approved' },
    rejected: { label: 'Rejected', className: 'status-rejected' },
  }
  const c = config[status] || config.ready
  return <span className={c.className}>{c.label}</span>
}

function CineField({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-slate-600 uppercase tracking-wide">{label}</span>
      <span className={`badge ${color} text-xs`}>{value}</span>
    </div>
  )
}

// ── Türkçe etiket haritaları ──────────────────────────────────────────────────

const SHOT_SCALE_LABELS: Record<string, string> = {
  extreme_close_up: 'Aşırı Yakın Plan',
  close_up: 'Yakın Plan',
  medium_close_up: 'Orta Yakın Plan',
  medium_shot: 'Orta Plan',
  medium_wide: 'Orta Geniş Plan',
  full_shot: 'Tam Plan',
  wide_shot: 'Geniş Plan',
  extreme_wide: 'Aşırı Geniş Plan',
  aerial: 'Hava Çekimi',
  insert: 'Detay / Insert',
}

const CAMERA_ANGLE_LABELS: Record<string, string> = {
  eye_level: 'Göz Hizası',
  low_angle: 'Alçak Açı',
  high_angle: 'Yüksek Açı',
  dutch_angle: 'Dutch Açı',
  birds_eye: 'Kuş Bakışı',
  worms_eye: 'Böcek Bakışı',
  over_shoulder: 'Omuz Üstü',
  pov: 'POV',
}

const CAMERA_MOVEMENT_LABELS: Record<string, string> = {
  static: 'Sabit',
  pan: 'Pan',
  tilt: 'Tilt',
  dolly: 'Dolly',
  tracking: 'Takip',
  handheld: 'El Kamerası',
  aerial_move: 'Drone',
  zoom: 'Zoom',
  crane: 'Vinç',
  steadicam: 'Steadicam',
}

const LIGHTING_LABELS: Record<string, string> = {
  natural: 'Doğal Işık',
  golden_hour: 'Altın Saat',
  blue_hour: 'Mavi Saat',
  overcast: 'Bulutlu / Yumuşak',
  high_key: 'High Key',
  low_key: 'Low Key',
  backlit: 'Arka Işık',
  silhouette: 'Siluet',
  studio: 'Stüdyo',
  practical: 'Pratik Işık',
  mixed: 'Karma',
  neon: 'Neon',
  night: 'Gece',
}

const COLOR_TONE_LABELS: Record<string, string> = {
  warm: 'Sıcak',
  cool: 'Soğuk',
  neutral: 'Nötr',
  desaturated: 'Soluk / Desatüre',
  high_contrast: 'Yüksek Kontrast',
  low_contrast: 'Düşük Kontrast',
  teal_orange: 'Teal & Orange',
  black_white: 'Siyah Beyaz',
  vintage: 'Vintage',
  vibrant: 'Canlı',
  muted: 'Pastel / Muted',
}

const COMPOSITION_LABELS: Record<string, string> = {
  rule_of_thirds: 'Üçler Kuralı',
  symmetrical: 'Simetri',
  leading_lines: 'Yönlendirici Çizgi',
  framing: 'Çerçeveleme',
  bokeh: 'Bokeh',
  deep_focus: 'Derin Odak',
  negative_space: 'Negatif Alan',
  foreground_depth: 'Ön Plan Derinliği',
  center_composition: 'Merkez Kompozisyon',
  diagonal: 'Diagonal',
}

const SUBJECT_LABELS: Record<string, string> = {
  portrait: 'Portre',
  group: 'Grup',
  crowd: 'Kalabalık',
  nature: 'Doğa',
  urban: 'Kentsel',
  architecture: 'Mimari',
  vehicle: 'Araç',
  animal: 'Hayvan',
  product: 'Ürün',
  food: 'Yiyecek',
  abstract: 'Soyut',
  event: 'Etkinlik',
  sport: 'Spor',
  performance: 'Performans',
  interview: 'Röportaj',
  broll: 'B-Roll',
  aerial_view: 'Hava Görüntüsü',
  underwater: 'Su Altı',
}

const MOOD_LABELS: Record<string, string> = {
  dramatic: 'Dramatik',
  peaceful: 'Sakin / Huzurlu',
  tense: 'Gerilimli',
  romantic: 'Romantik',
  melancholic: 'Melankolik',
  epic: 'Epik',
  intimate: 'Samimi / İçten',
  mysterious: 'Gizemli',
  energetic: 'Enerjik',
  dark: 'Karanlık',
  joyful: 'Neşeli',
  nostalgic: 'Nostaljik',
  documentary: 'Belgesel',
  commercial: 'Ticari / Reklam',
}

const SCENE_TYPE_LABELS: Record<string, string> = {
  interior: 'İç Mekan',
  exterior: 'Dış Mekan',
  studio: 'Stüdyo',
  location: 'Lokasyon',
  green_screen: 'Yeşil Perde',
}
