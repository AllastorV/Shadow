import { memo } from 'react'
import { Image, Video, Music, FileText, File, CheckCircle, XCircle, Clock, Loader2, Tag, MessageSquare } from 'lucide-react'
import type { Asset } from '../../types'
import { formatFileSize } from '../../utils/format'
import clsx from 'clsx'

// Sabitler bileşen dışında — her render'da yeniden oluşturulmazlar.
const TYPE_ICONS: Record<string, React.ReactNode> = {
  image: <Image size={20} />,
  video: <Video size={20} />,
  audio: <Music size={20} />,
  document: <FileText size={20} />,
  other: <File size={20} />,
}

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  pending: { label: 'Bekliyor', className: 'status-pending', icon: <Clock size={10} /> },
  processing: { label: 'İşleniyor', className: 'status-processing', icon: <Loader2 size={10} className="animate-spin" /> },
  ready: { label: 'Hazır', className: 'status-ready', icon: null },
  approved: { label: 'Onaylandı', className: 'status-approved', icon: <CheckCircle size={10} /> },
  rejected: { label: 'Reddedildi', className: 'status-rejected', icon: <XCircle size={10} /> },
}

interface Props {
  asset: Asset
  onClick: () => void
  view?: 'grid' | 'list'
}

// React.memo: props değişmediği sürece re-render yapmaz.
// Üst bileşen yeniden render edilse bile (örn. filtre değişimi) AssetCard'lar
// yalnızca kendi asset'leri değiştiğinde güncellenir.
const AssetCard = memo(function AssetCard({ asset, onClick, view = 'grid' }: Props) {
  const statusConf = STATUS_CONFIG[asset.status] ?? STATUS_CONFIG.ready
  const assetUrl = `/files/${asset.project_id}/${asset.filename}`

  if (view === 'list') {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-4 px-4 py-3 w-full text-left hover:bg-surface-200 transition-colors border-b border-surface-300/50 last:border-0"
      >
        {/* Thumbnail küçük */}
        <div className="w-10 h-10 rounded-lg bg-surface-200 flex items-center justify-center text-slate-500 shrink-0 overflow-hidden">
          {asset.asset_type === 'image' ? (
            <img
              src={assetUrl}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            TYPE_ICONS[asset.asset_type]
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium truncate">{asset.original_name}</p>
          <p className="text-xs text-slate-500 truncate">{asset.ai_description || asset.mime_type}</p>
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
          <span className="text-xs text-slate-500 w-16 text-right">{formatFileSize(asset.file_size)}</span>
        </div>
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className="card text-left hover:border-brand-500/30 hover:scale-[1.01] transition-all group overflow-hidden"
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-surface-100 flex items-center justify-center relative overflow-hidden">
        {asset.asset_type === 'image' ? (
          <img
            src={assetUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="text-slate-600">{TYPE_ICONS[asset.asset_type]}</div>
        )}

        {/* Status badge */}
        <div className="absolute top-2 right-2">
          <span className={statusConf.className}>
            {statusConf.icon}
            {statusConf.label}
          </span>
        </div>

        {/* AI badge */}
        {asset.ai_tags && asset.ai_tags.length > 0 && (
          <div className="absolute bottom-2 left-2">
            <span className="badge bg-brand-600/80 text-brand-200">
              <Tag size={9} className="mr-0.5" />
              AI
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-sm font-medium text-slate-200 truncate group-hover:text-white transition-colors">
          {asset.original_name}
        </p>
        {asset.ai_description && (
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{asset.ai_description}</p>
        )}
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-slate-600">{formatFileSize(asset.file_size)}</span>
          {asset.comment_count > 0 && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <MessageSquare size={11} />
              {asset.comment_count}
            </span>
          )}
        </div>
      </div>
    </button>
  )
})

export default AssetCard
