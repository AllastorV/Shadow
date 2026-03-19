import { useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Layers, Download, Lock, Eye, MessageSquare, AlertCircle,
  Clock, Film, Tag, Sparkles,
  Copy, CheckCheck, Image, Video, Music, FileText, MapPin, Send,
  Palette, Layout,
} from 'lucide-react'
import api from '../utils/api'
import { formatFileSize } from '../utils/format'
import clsx from 'clsx'
import toast from 'react-hot-toast'

// ── Label haritaları ──────────────────────────────────────────────────────────

const SHOT_SCALE_LABELS: Record<string, string> = {
  extreme_close_up: 'Aşırı Yakın Plan', close_up: 'Yakın Plan',
  medium_close_up: 'Orta Yakın Plan', medium_shot: 'Orta Plan',
  medium_wide: 'Orta Geniş Plan', full_shot: 'Tam Plan',
  wide_shot: 'Geniş Plan', extreme_wide: 'Aşırı Geniş Plan',
  aerial: 'Hava Çekimi', insert: 'Detay / Insert',
}
const CAMERA_ANGLE_LABELS: Record<string, string> = {
  eye_level: 'Göz Hizası', low_angle: 'Alçak Açı', high_angle: 'Yüksek Açı',
  dutch_angle: 'Dutch Açı', birds_eye: 'Kuş Bakışı', worms_eye: 'Böcek Bakışı',
  over_shoulder: 'Omuz Üstü', pov: 'POV',
}
const LIGHTING_LABELS: Record<string, string> = {
  natural: 'Doğal Işık', golden_hour: 'Altın Saat', blue_hour: 'Mavi Saat',
  overcast: 'Bulutlu / Yumuşak', high_key: 'High Key', low_key: 'Low Key',
  backlit: 'Arka Işık', silhouette: 'Siluet', studio: 'Stüdyo',
  practical: 'Pratik Işık', mixed: 'Karma', neon: 'Neon', night: 'Gece',
}
const COLOR_TONE_LABELS: Record<string, string> = {
  warm: 'Sıcak', cool: 'Soğuk', neutral: 'Nötr', desaturated: 'Soluk',
  high_contrast: 'Yüksek Kontrast', low_contrast: 'Düşük Kontrast',
  teal_orange: 'Teal & Orange', black_white: 'Siyah Beyaz',
  vintage: 'Vintage', vibrant: 'Canlı', muted: 'Pastel',
}
const MOOD_LABELS: Record<string, string> = {
  dramatic: 'Dramatik', peaceful: 'Sakin', tense: 'Gerilimli',
  romantic: 'Romantik', melancholic: 'Melankolik', epic: 'Epik',
  intimate: 'Samimi', mysterious: 'Gizemli', energetic: 'Enerjik',
  dark: 'Karanlık', joyful: 'Neşeli', nostalgic: 'Nostaljik',
  documentary: 'Belgesel', commercial: 'Ticari',
}
const SUBJECT_LABELS: Record<string, string> = {
  portrait: 'Portre', group: 'Grup', crowd: 'Kalabalık', nature: 'Doğa',
  urban: 'Kentsel', architecture: 'Mimari', vehicle: 'Araç', animal: 'Hayvan',
  product: 'Ürün', food: 'Yiyecek', abstract: 'Soyut', event: 'Etkinlik',
  sport: 'Spor', performance: 'Performans', interview: 'Röportaj',
  broll: 'B-Roll', aerial_view: 'Hava Görüntüsü', underwater: 'Su Altı',
}

const MARKER_COLORS = [
  { value: 'red',    label: 'Kırmızı', hex: '#ef4444' },
  { value: 'green',  label: 'Yeşil',   hex: '#22c55e' },
  { value: 'blue',   label: 'Mavi',    hex: '#3b82f6' },
  { value: 'yellow', label: 'Sarı',    hex: '#eab308' },
  { value: 'purple', label: 'Mor',     hex: '#a855f7' },
  { value: 'orange', label: 'Turuncu', hex: '#f97316' },
  { value: 'cyan',   label: 'Camgöbeği', hex: '#06b6d4' },
]
const MARKER_COLOR_MAP: Record<string, string> = Object.fromEntries(
  MARKER_COLORS.map(c => [c.value, c.hex])
)

// ── Yardımcı bileşenler ───────────────────────────────────────────────────────

function MetaBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</span>
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color} whitespace-nowrap`}>
        {value}
      </span>
    </div>
  )
}

function PermissionBadge({ permission }: { permission: string }) {
  const config: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    view:     { icon: <Eye size={11} />,           label: 'Görüntüleme',   color: 'bg-blue-500/20 text-blue-300' },
    comment:  { icon: <MessageSquare size={11} />, label: 'Yorum',         color: 'bg-purple-500/20 text-purple-300' },
    edit:     { icon: <MapPin size={11} />,        label: 'Düzenleme',     color: 'bg-indigo-500/20 text-indigo-300' },
    download: { icon: <Download size={11} />,      label: 'İndirme',       color: 'bg-emerald-500/20 text-emerald-300' },
  }
  const c = config[permission] || config.view
  return (
    <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${c.color}`}>
      {c.icon} {c.label} erişimi
    </span>
  )
}

function formatTimecode(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ── İsim girişi (localStorage'da saklanır) ────────────────────────────────────

function useGuestName() {
  const [name, setNameState] = useState(() =>
    localStorage.getItem('shadow_guest_name') || ''
  )
  const setName = (v: string) => {
    localStorage.setItem('shadow_guest_name', v)
    setNameState(v)
  }
  return [name, setName] as const
}

// ── Ana bileşen ────────────────────────────────────────────────────────────────

export default function ShareViewPage() {
  const { token }       = useParams<{ token: string }>()
  const queryClient     = useQueryClient()
  const videoRef        = useRef<HTMLVideoElement>(null)

  const [password,          setPassword]          = useState('')
  const [submittedPassword, setSubmittedPassword] = useState('')
  const [needsPassword,     setNeedsPassword]     = useState(false)
  const [copied,            setCopied]            = useState(false)

  // Guest contribution state
  const [guestName,     setGuestName]     = useGuestName()
  const [commentText,   setCommentText]   = useState('')
  const [markerLabel,   setMarkerLabel]   = useState('')
  const [markerColor,   setMarkerColor]   = useState('red')
  const [markerNote,    setMarkerNote]    = useState('')
  const [capturedTime,  setCapturedTime]  = useState<number | null>(null)

  const passwordParam = submittedPassword ? `?password=${encodeURIComponent(submittedPassword)}` : ''

  const { data, isLoading, error, isError } = useQuery({
    queryKey: ['shareView', token, submittedPassword],
    queryFn: () =>
      api.get(`/share/view/${token}`, {
        params: submittedPassword ? { password: submittedPassword } : {},
      }).then(r => r.data).catch(err => {
        if (err.response?.status === 401) setNeedsPassword(true)
        throw err
      }),
    retry: false,
    enabled: !!token,
  })

  const canComment = data?.permission === 'comment' || data?.permission === 'edit'
  const canEdit    = data?.permission === 'edit'
  const isVideo    = data?.asset?.type === 'video' || data?.asset?.type === 'audio'

  // ── Guest comments query ──────────────────────────────────────────────────
  const { data: guestComments = [] } = useQuery({
    queryKey: ['guestComments', token],
    queryFn: () => api.get(`/share/guest/${token}/comments`,
      { params: submittedPassword ? { password: submittedPassword } : {} }
    ).then(r => r.data),
    enabled: !!token && canComment,
    refetchInterval: 15_000,
  })

  const { data: guestMarkers = [] } = useQuery({
    queryKey: ['guestMarkers', token],
    queryFn: () => api.get(`/share/guest/${token}/markers`,
      { params: submittedPassword ? { password: submittedPassword } : {} }
    ).then(r => r.data),
    enabled: !!token && canEdit,
    refetchInterval: 15_000,
  })

  // ── Mutations ──────────────────────────────────────────────────────────────
  const addComment = useMutation({
    mutationFn: () => api.post(`/share/guest/${token}/comments`,
      { guest_name: guestName || 'Misafir', content: commentText, timestamp: capturedTime },
      { params: submittedPassword ? { password: submittedPassword } : {} }
    ).then(r => r.data),
    onSuccess: () => {
      setCommentText('')
      queryClient.invalidateQueries({ queryKey: ['guestComments', token] })
      toast.success('Yorum eklendi!')
    },
    onError: () => toast.error('Yorum eklenemedi'),
  })

  const addMarker = useMutation({
    mutationFn: () => api.post(`/share/guest/${token}/markers`,
      { guest_name: guestName || 'Misafir', label: markerLabel, color: markerColor, note: markerNote || null, timestamp: capturedTime },
      { params: submittedPassword ? { password: submittedPassword } : {} }
    ).then(r => r.data),
    onSuccess: () => {
      setMarkerLabel('')
      setMarkerNote('')
      queryClient.invalidateQueries({ queryKey: ['guestMarkers', token] })
      toast.success('Marker eklendi!')
    },
    onError: () => toast.error('Marker eklenemedi'),
  })

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const captureTime = () => {
    const t = videoRef.current?.currentTime
    if (t !== undefined) {
      setCapturedTime(Math.floor(t * 100) / 100)
      toast.success(`Zaman yakalandı: ${formatTimecode(t)}`)
    }
  }

  const fileUrl     = data?.file_url
    ? `/api/v1${data.file_url.replace('/api/v1', '')}${!data.file_url.includes('?') && submittedPassword ? `?password=${encodeURIComponent(submittedPassword)}` : submittedPassword ? `&password=${encodeURIComponent(submittedPassword)}` : ''}`
    : ''
  const downloadUrl = data?.download_url
    ? `/api/v1${data.download_url.replace('/api/v1', '')}`
    : ''

  // ── Yüklenme ────────────────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="min-h-screen bg-surface flex flex-col">
      <ShareHeader onCopy={copyLink} copied={copied} />
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Yükleniyor…</p>
        </div>
      </div>
    </div>
  )

  // ── Parola ekranı ────────────────────────────────────────────────────────────
  if (needsPassword && !data) return (
    <div className="min-h-screen bg-surface flex flex-col">
      <ShareHeader onCopy={copyLink} copied={copied} />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-surface-50 border border-surface-300 rounded-2xl p-8 text-center shadow-xl">
          <div className="w-14 h-14 rounded-full bg-brand-600/20 flex items-center justify-center mx-auto mb-5">
            <Lock size={24} className="text-brand-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-1">Parola Korumalı</h2>
          <p className="text-sm text-slate-400 mb-6">Bu linke erişmek için parola gerekiyor.</p>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && password && setSubmittedPassword(password)}
            className="input mb-3 text-center"
            placeholder="Parolayı girin"
            autoFocus
          />
          {isError && submittedPassword && (
            <p className="text-xs text-red-400 mb-3 flex items-center justify-center gap-1">
              <AlertCircle size={11} /> Hatalı parola
            </p>
          )}
          <button
            onClick={() => password && setSubmittedPassword(password)}
            disabled={!password}
            className="btn-primary w-full justify-center"
          >
            Görüntüle
          </button>
        </div>
      </div>
    </div>
  )

  // ── Hata ekranı ──────────────────────────────────────────────────────────────
  if (isError && !needsPassword) {
    const status    = (error as any)?.response?.status
    const isExpired = status === 410
    return (
      <div className="min-h-screen bg-surface flex flex-col">
        <ShareHeader onCopy={copyLink} copied={copied} />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-surface-100 flex items-center justify-center mx-auto mb-4">
              {isExpired
                ? <Clock size={28} className="text-amber-400" />
                : <AlertCircle size={28} className="text-red-400" />}
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              {isExpired ? 'Link Süresi Doldu' : 'Link Kullanılamıyor'}
            </h2>
            <p className="text-slate-400 text-sm max-w-xs mx-auto">
              {isExpired
                ? 'Bu paylaşım linkinin süresi dolmuş. Link sahibinden yeni bir link isteyin.'
                : 'Bu link kaldırılmış veya geçersiz. Link sahibiyle iletişime geçin.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!data) return null

  const { asset, permission, label } = data

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <ShareHeader onCopy={copyLink} copied={copied} label={label} />

      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full p-4 lg:p-6 gap-6">

        {/* ── Sol: Önizleme ── */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Dosya adı + izin */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-white leading-tight">{asset.name}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <PermissionBadge permission={permission} />
                {asset.file_size && <span className="text-xs text-slate-500">{formatFileSize(asset.file_size)}</span>}
                {asset.width && asset.height && <span className="text-xs text-slate-500">{asset.width} × {asset.height}px</span>}
                {asset.duration && <span className="text-xs text-slate-500">{formatDuration(asset.duration)}</span>}
              </div>
            </div>
            {permission === 'download' && (
              <a href={downloadUrl} download={asset.name} className="btn-primary shrink-0">
                <Download size={14} /> İndir
              </a>
            )}
          </div>

          {/* Medya önizleme */}
          <div className="bg-black/40 rounded-2xl border border-surface-300 overflow-hidden flex items-center justify-center min-h-64">
            {asset.type === 'image' && (
              <img src={fileUrl} alt={asset.name} className="max-w-full max-h-[70vh] object-contain" loading="lazy" />
            )}
            {asset.type === 'video' && (
              <video
                ref={videoRef}
                src={fileUrl}
                controls
                className="max-w-full max-h-[70vh] rounded-xl w-full"
                preload="metadata"
              />
            )}
            {asset.type === 'audio' && (
              <div className="flex flex-col items-center gap-4 p-12">
                <div className="w-20 h-20 rounded-full bg-brand-600/20 flex items-center justify-center">
                  <Music size={36} className="text-brand-400" />
                </div>
                <p className="text-white font-medium">{asset.name}</p>
                <audio ref={videoRef as any} src={fileUrl} controls className="w-72" />
              </div>
            )}
            {(asset.type === 'document' || asset.type === 'other') && (
              <div className="flex flex-col items-center gap-3 p-12 text-slate-400">
                <FileText size={56} />
                <p className="text-slate-300 font-medium">{asset.name}</p>
                <p className="text-xs">{asset.mime_type}</p>
                {permission === 'download' && (
                  <a href={downloadUrl} download={asset.name} className="btn-primary mt-2">
                    <Download size={14} /> İndir
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Marker listesi (video/audio, edit izni) */}
          {canEdit && guestMarkers.length > 0 && (
            <div className="bg-surface-50 border border-surface-300 rounded-xl p-4">
              <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide flex items-center gap-1.5 mb-3">
                <MapPin size={11} /> Markerlar ({guestMarkers.length})
              </p>
              <div className="space-y-2">
                {guestMarkers.map((m: any) => (
                  <div key={m.id} className="flex items-start gap-2 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full mt-0.5 shrink-0" style={{ backgroundColor: MARKER_COLOR_MAP[m.color] ?? '#6366f1' }} />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-white">{m.label}</span>
                      {m.timestamp != null && (
                        <span className="font-mono text-indigo-400 ml-1.5">{formatTimecode(m.timestamp)}</span>
                      )}
                      {m.note && <p className="text-slate-500 mt-0.5 truncate">{m.note}</p>}
                    </div>
                    <span className="text-slate-600 shrink-0">{m.guest_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Yorum listesi (comment/edit izni) */}
          {canComment && guestComments.length > 0 && (
            <div className="bg-surface-50 border border-surface-300 rounded-xl p-4">
              <p className="text-xs font-semibold text-purple-400 uppercase tracking-wide flex items-center gap-1.5 mb-3">
                <MessageSquare size={11} /> Yorumlar ({guestComments.length})
              </p>
              <div className="space-y-3">
                {guestComments.map((c: any) => (
                  <div key={c.id} className="flex gap-2 text-xs">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold"
                      style={{ background: `hsl(${(c.guest_name?.charCodeAt(0) ?? 65) * 23 % 360}, 55%, 40%)` }}
                    >
                      {(c.guest_name ?? 'M').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-300">{c.guest_name}</span>
                        {c.timestamp != null && (
                          <span className="font-mono text-purple-400">{formatTimecode(c.timestamp)}</span>
                        )}
                      </div>
                      <p className="text-slate-400 mt-0.5 leading-relaxed">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Sağ: Metadata + Katkı paneli ── */}
        <div className="w-full lg:w-80 flex flex-col gap-4 shrink-0">

          {/* ── İsim kutusu (comment veya edit) ── */}
          {canComment && (
            <div className="bg-surface-50 border border-surface-300 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Adın</p>
              <input
                className="input text-sm"
                placeholder="Adını gir (ör. Ali)"
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
                maxLength={50}
              />
            </div>
          )}

          {/* ── Marker ekleme (edit izni) ── */}
          {canEdit && (
            <div className="bg-surface-50 border border-surface-300 rounded-xl p-4">
              <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide flex items-center gap-1.5 mb-3">
                <MapPin size={11} /> Marker Ekle
              </p>

              {/* Zaman damgası (video/audio) */}
              {isVideo && (
                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={captureTime}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all"
                    style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}
                  >
                    <Clock size={11} /> Şimdiki Zamanı Yakala
                  </button>
                  {capturedTime !== null && (
                    <span className="font-mono text-xs text-indigo-400">{formatTimecode(capturedTime)}</span>
                  )}
                </div>
              )}

              {/* Renk seçici */}
              <div className="flex gap-1.5 mb-3">
                {MARKER_COLORS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setMarkerColor(c.value)}
                    title={c.label}
                    className="w-5 h-5 rounded-full transition-all"
                    style={{
                      backgroundColor: c.hex,
                      outline: markerColor === c.value ? `2px solid ${c.hex}` : 'none',
                      outlineOffset: 2,
                    }}
                  />
                ))}
              </div>

              <input
                className="input text-xs mb-2"
                placeholder="Etiket *"
                value={markerLabel}
                onChange={e => setMarkerLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && markerLabel.trim() && addMarker.mutate()}
              />
              <textarea
                className="input text-xs resize-none mb-3"
                rows={2}
                placeholder="Not (isteğe bağlı)"
                value={markerNote}
                onChange={e => setMarkerNote(e.target.value)}
              />
              <button
                onClick={() => addMarker.mutate()}
                disabled={!markerLabel.trim() || addMarker.isPending}
                className="btn-primary w-full justify-center text-xs"
              >
                <MapPin size={12} />
                {addMarker.isPending ? 'Ekleniyor…' : 'Marker Ekle'}
              </button>
            </div>
          )}

          {/* ── Yorum ekleme (comment veya edit izni) ── */}
          {canComment && (
            <div className="bg-surface-50 border border-surface-300 rounded-xl p-4">
              <p className="text-xs font-semibold text-purple-400 uppercase tracking-wide flex items-center gap-1.5 mb-3">
                <MessageSquare size={11} /> Yorum Ekle
              </p>

              {isVideo && (
                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={captureTime}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all"
                    style={{ background: 'rgba(168,85,247,0.15)', color: '#c4b5fd', border: '1px solid rgba(168,85,247,0.3)' }}
                  >
                    <Clock size={11} /> Zamanı Yakala
                  </button>
                  {capturedTime !== null && (
                    <span className="font-mono text-xs text-purple-400">{formatTimecode(capturedTime)}</span>
                  )}
                </div>
              )}

              <textarea
                className="input text-xs resize-none mb-2"
                rows={3}
                placeholder="Yorumunuzu yazın…"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
              />
              <button
                onClick={() => addComment.mutate()}
                disabled={!commentText.trim() || addComment.isPending}
                className="btn-primary w-full justify-center text-xs"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
              >
                <Send size={12} />
                {addComment.isPending ? 'Gönderiliyor…' : 'Gönder'}
              </button>
            </div>
          )}

          {/* AI Açıklaması */}
          {asset.ai_description && (
            <div className="bg-surface-50 border border-surface-300 rounded-xl p-4">
              <p className="text-xs font-semibold text-brand-400 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                <Sparkles size={11} /> AI Açıklaması
              </p>
              <p className="text-sm text-slate-300 leading-relaxed">{asset.ai_description}</p>
              {asset.ai_tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-surface-300">
                  {asset.ai_tags.map((t: string) => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-brand-600/20 text-brand-300">{t}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sinematografi */}
          {(asset.shot_scale || asset.camera_angle || asset.lighting_type || asset.color_tone) && (
            <div className="bg-surface-50 border border-surface-300 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5 mb-3">
                <Film size={11} /> Sinematografi
              </p>
              <div className="grid grid-cols-2 gap-2">
                {asset.shot_scale && asset.shot_scale !== 'unknown' && (
                  <MetaBadge label="Çekim Ölçeği" value={SHOT_SCALE_LABELS[asset.shot_scale] ?? asset.shot_scale} color="bg-violet-500/20 text-violet-300" />
                )}
                {asset.camera_angle && asset.camera_angle !== 'unknown' && (
                  <MetaBadge label="Kamera Açısı" value={CAMERA_ANGLE_LABELS[asset.camera_angle] ?? asset.camera_angle} color="bg-blue-500/20 text-blue-300" />
                )}
                {asset.lighting_type && (
                  <MetaBadge label="Işık" value={LIGHTING_LABELS[asset.lighting_type] ?? asset.lighting_type} color="bg-amber-500/20 text-amber-300" />
                )}
                {asset.color_tone && (
                  <MetaBadge label="Renk Tonu" value={COLOR_TONE_LABELS[asset.color_tone] ?? asset.color_tone} color="bg-pink-500/20 text-pink-300" />
                )}
              </div>
            </div>
          )}

          {/* Konu + Atmosfer */}
          {((asset.subject_tags?.length > 0) || (asset.mood_tags?.length > 0)) && (
            <div className="bg-surface-50 border border-surface-300 rounded-xl p-4 space-y-3">
              {asset.subject_tags?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1">
                    <Tag size={10} /> Konu
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {asset.subject_tags.map((s: string) => (
                      <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                        {SUBJECT_LABELS[s] ?? s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {asset.mood_tags?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1.5">Atmosfer</p>
                  <div className="flex flex-wrap gap-1">
                    {asset.mood_tags.map((m: string) => (
                      <span key={m} className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300">
                        {MOOD_LABELS[m] ?? m}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Renkler */}
          {asset.ai_colors?.length > 0 && (
            <div className="bg-surface-50 border border-surface-300 rounded-xl p-4">
              <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
                <Palette size={10} /> Baskın Renkler
              </p>
              <div className="flex flex-wrap gap-1">
                {asset.ai_colors.map((c: string) => (
                  <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-surface-200 text-slate-300">{c}</span>
                ))}
              </div>
            </div>
          )}

          {/* Süre uyarısı */}
          {data.expires_at && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center gap-2">
              <Clock size={13} className="text-amber-400 shrink-0" />
              <p className="text-xs text-amber-300">
                Süre dolumu: {new Date(data.expires_at).toLocaleString('tr-TR')}
              </p>
            </div>
          )}

          <div className="mt-auto pt-4 border-t border-surface-300 flex items-center gap-2 text-slate-600">
            <Layers size={14} className="text-brand-500/50" />
            <span className="text-xs">Shadow ile paylaşıldı</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Header ─────────────────────────────────────────────────────────────────────

function ShareHeader({ onCopy, copied, label }: { onCopy: () => void; copied: boolean; label?: string }) {
  return (
    <header className="border-b border-surface-300 px-4 lg:px-6 py-3 flex items-center gap-3 bg-surface-50/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
          <Layers size={14} className="text-white" />
        </div>
        <span className="font-bold text-white">Shadow</span>
      </div>
      {label && (
        <>
          <span className="text-surface-300">·</span>
          <span className="text-sm text-slate-400 truncate max-w-xs">{label}</span>
        </>
      )}
      <div className="ml-auto">
        <button
          onClick={onCopy}
          className={clsx(
            'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all',
            copied
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-surface-200 text-slate-400 hover:text-slate-200 hover:bg-surface-100'
          )}
        >
          {copied ? <CheckCheck size={12} /> : <Copy size={12} />}
          {copied ? 'Kopyalandı' : 'Linki Kopyala'}
        </button>
      </div>
    </header>
  )
}
