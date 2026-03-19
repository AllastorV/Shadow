import { memo } from 'react'
import {
  Image, Video, Music, FileText, File,
  CheckCircle, XCircle, Clock, Loader2, Tag, MessageSquare, Play,
} from 'lucide-react'
import type { Asset } from '../../types'
import { formatFileSize } from '../../utils/format'
import clsx from 'clsx'

const TYPE_ICONS: Record<string, React.ReactNode> = {
  image:    <Image size={22} />,
  video:    <Video size={22} />,
  audio:    <Music size={22} />,
  document: <FileText size={22} />,
  other:    <File size={22} />,
}

const TYPE_COLORS: Record<string, string> = {
  image:    '#6366f1',
  video:    '#06b6d4',
  audio:    '#8b5cf6',
  document: '#f59e0b',
  other:    '#64748b',
}

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  pending:    { label: 'Bekliyor',   className: 'status-pending',    icon: <Clock size={10} /> },
  processing: { label: 'İşleniyor', className: 'status-processing', icon: <Loader2 size={10} className="animate-spin" /> },
  ready:      { label: 'Hazır',     className: 'status-ready',      icon: null },
  approved:   { label: 'Onaylandı', className: 'status-approved',   icon: <CheckCircle size={10} /> },
  rejected:   { label: 'Reddedildi',className: 'status-rejected',   icon: <XCircle size={10} /> },
}

interface Props {
  asset: Asset
  onClick: () => void
  view?: 'grid' | 'list'
}

const AssetCard = memo(function AssetCard({ asset, onClick, view = 'grid' }: Props) {
  const statusConf = STATUS_CONFIG[asset.status] ?? STATUS_CONFIG.ready
  const assetUrl = `/files/${asset.project_id}/${asset.filename}`
  const accentColor = TYPE_COLORS[asset.asset_type] ?? TYPE_COLORS.other

  if (view === 'list') {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-4 px-4 py-3 w-full text-left transition-all duration-150 last:border-0"
        style={{ borderBottom: '1px solid var(--c-surface-3)' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--c-surface-1)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}
      >
        {/* Thumbnail */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
          style={{ backgroundColor: 'var(--c-surface-2)' }}
        >
          {asset.asset_type === 'image' ? (
            <img src={assetUrl} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
          ) : (
            <span style={{ color: accentColor }}>{TYPE_ICONS[asset.asset_type]}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium truncate" style={{ color: 'inherit' }}>
            {asset.original_name}
          </p>
          <p className="text-xs text-slate-500 truncate mt-0.5">
            {asset.ai_description || asset.mime_type}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {asset.comment_count > 0 && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <MessageSquare size={12} />
              {asset.comment_count}
            </span>
          )}
          <span className={statusConf.className}>
            {statusConf.icon}
            {statusConf.label}
          </span>
          <span className="text-xs text-slate-500 w-16 text-right data-mono">
            {formatFileSize(asset.file_size)}
          </span>
        </div>
      </button>
    )
  }

  // Grid view
  return (
    <button
      onClick={onClick}
      className="text-left rounded-2xl overflow-hidden transition-all duration-200 group relative"
      style={{
        backgroundColor: 'var(--c-surface)',
        border: '1px solid var(--c-surface-3)',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = `${accentColor}40`
        el.style.transform = 'translateY(-2px)'
        el.style.boxShadow = `0 8px 28px rgba(0,0,0,0.3), 0 0 0 1px ${accentColor}25`
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'var(--c-surface-3)'
        el.style.transform = 'translateY(0)'
        el.style.boxShadow = 'none'
      }}
    >
      {/* ── Thumbnail ── */}
      <div
        className="aspect-video relative overflow-hidden flex items-center justify-center"
        style={{ backgroundColor: 'var(--c-surface-1)' }}
      >
        {asset.asset_type === 'image' ? (
          <img
            src={assetUrl}
            alt=""
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex flex-col items-center gap-2">
            {/* Color-coded icon with subtle bg */}
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                backgroundColor: `${accentColor}18`,
                border: `1px solid ${accentColor}30`,
                color: accentColor,
              }}
            >
              {TYPE_ICONS[asset.asset_type]}
            </div>
            {asset.asset_type === 'video' && (
              <div
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(99,102,241,0.85)', backdropFilter: 'blur(4px)' }}
                >
                  <Play size={14} className="text-white ml-0.5" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Status badge — top right */}
        <div className="absolute top-2 right-2">
          <span className={statusConf.className}>
            {statusConf.icon}
            {statusConf.label}
          </span>
        </div>

        {/* AI tags badge — bottom left */}
        {asset.ai_tags && asset.ai_tags.length > 0 && (
          <div className="absolute bottom-2 left-2">
            <span
              className="badge"
              style={{ background: 'rgba(99,102,241,0.75)', color: '#c7d2fe', backdropFilter: 'blur(4px)' }}
            >
              <Tag size={9} />
              AI · {asset.ai_tags.length}
            </span>
          </div>
        )}

        {/* Comment count — bottom right */}
        {asset.comment_count > 0 && (
          <div className="absolute bottom-2 right-2">
            <span
              className="badge"
              style={{ background: 'rgba(0,0,0,0.55)', color: '#94a3b8', backdropFilter: 'blur(4px)' }}
            >
              <MessageSquare size={9} />
              {asset.comment_count}
            </span>
          </div>
        )}
      </div>

      {/* ── Info ── */}
      <div className="p-3">
        <p
          className="text-sm font-semibold text-white truncate transition-colors group-hover:text-brand-300"
          style={{ color: 'inherit' }}
        >
          {asset.original_name}
        </p>
        {asset.ai_description && (
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
            {asset.ai_description}
          </p>
        )}
        <div className="flex items-center justify-between mt-2.5">
          <span className="text-xs text-slate-600 data-mono">
            {formatFileSize(asset.file_size)}
          </span>
          <span
            className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md"
            style={{
              backgroundColor: `${accentColor}15`,
              color: accentColor,
            }}
          >
            {asset.asset_type}
          </span>
        </div>
      </div>
    </button>
  )
})

export default AssetCard
