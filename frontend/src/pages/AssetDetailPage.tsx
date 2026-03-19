import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Tag, Sparkles, CheckCircle, XCircle, Clock, Download,
  Share2, MessageSquare, Image, Video, Music, FileText, File,
  Loader2, Link2, Lock, Calendar, Eye, DownloadCloud
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset', assetId] })
      toast.success('AI tags updated!')
    },
    onError: () => toast.error('AI tagging failed'),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shareLinks', assetId] })
      toast.success('Share link created!')
      setShareLabel('')
      setSharePassword('')
      setShareExpiry('')
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (linkId: number) => api.patch(`/share/${linkId}/revoke`).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shareLinks', assetId] }),
  })

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 size={24} className="animate-spin text-brand-400" />
    </div>
  )

  if (!asset) return <div className="p-6 text-slate-400">Asset not found</div>

  const assetUrl = `/files/${asset.project_id}/${asset.filename}`

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
          <a href={assetUrl} download={asset.original_name} className="btn-ghost p-2">
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
          {(['info', 'comments', 'share'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'flex-1 py-3 text-xs font-medium transition-colors capitalize',
                tab === t ? 'text-brand-400 border-b-2 border-brand-500' : 'text-slate-500 hover:text-slate-300'
              )}
            >
              {t === 'comments' ? `Comments (${asset.comment_count})` : t.charAt(0).toUpperCase() + t.slice(1)}
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

              {/* Scene & Objects */}
              {asset.ai_scene_type && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Scene Type</p>
                  <span className="badge bg-purple-500/20 text-purple-300">{asset.ai_scene_type}</span>
                </div>
              )}
              {asset.ai_objects && asset.ai_objects.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Detected Objects</p>
                  <div className="flex flex-wrap gap-1">
                    {asset.ai_objects.map((obj) => (
                      <span key={obj} className="badge bg-surface-200 text-slate-400">{obj}</span>
                    ))}
                  </div>
                </div>
              )}
              {asset.ai_colors && asset.ai_colors.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Colors</p>
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
              {/* Existing links */}
              {shareLinks && shareLinks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500">Active Links</p>
                  {shareLinks.map((link) => (
                    <div key={link.id} className={clsx('p-3 rounded-lg', link.is_active ? 'bg-surface-100' : 'bg-surface-100 opacity-50')}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-slate-300">{link.label || 'Untitled Link'}</span>
                        <span className={clsx('badge', link.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-surface-300 text-slate-500')}>
                          {link.is_active ? 'Active' : 'Revoked'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                        <span className="capitalize">{link.permission} permission</span>
                        <span className="flex items-center gap-1"><Eye size={10} /> {link.view_count}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/share/${link.token}`)
                            toast.success('Link copied!')
                          }}
                          className="flex-1 btn-ghost text-xs py-1 justify-center"
                        >
                          <Link2 size={11} /> Copy Link
                        </button>
                        {link.is_active && (
                          <button
                            onClick={() => revokeMutation.mutate(link.id)}
                            className="text-xs text-red-400 hover:text-red-300 px-2"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Create new link */}
              <div className="border-t border-surface-300 pt-4 space-y-3">
                <p className="text-xs font-medium text-slate-400">Create Share Link</p>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Label</label>
                  <input className="input text-xs" placeholder="e.g. Client Review" value={shareLabel} onChange={(e) => setShareLabel(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Permission</label>
                  <select className="input text-xs" value={sharePermission} onChange={(e) => setSharePermission(e.target.value as any)}>
                    <option value="view">View only</option>
                    <option value="comment">Comment</option>
                    <option value="download">Download</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Lock size={10} /> Password (optional)</label>
                  <input className="input text-xs" type="password" placeholder="••••••" value={sharePassword} onChange={(e) => setSharePassword(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Calendar size={10} /> Expires (optional)</label>
                  <input className="input text-xs" type="datetime-local" value={shareExpiry} onChange={(e) => setShareExpiry(e.target.value)} />
                </div>
                <button
                  onClick={() => createShareMutation.mutate()}
                  disabled={createShareMutation.isPending}
                  className="btn-primary w-full justify-center"
                >
                  <Share2 size={13} />
                  {createShareMutation.isPending ? 'Creating…' : 'Create Link'}
                </button>
              </div>
            </>
          )}
        </div>
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
