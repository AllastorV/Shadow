import { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Maximize, Minimize, MapPin, ChevronLeft, ChevronRight,
} from 'lucide-react'
import type { Marker, MarkerColor } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

const MARKER_COLORS: Record<MarkerColor, string> = {
  red: '#ef4444', green: '#22c55e', blue: '#3b82f6',
  yellow: '#eab308', purple: '#a855f7', orange: '#f97316', cyan: '#06b6d4',
}

function formatTimecode(sec: number): string {
  if (!isFinite(sec) || isNaN(sec)) return '00:00.000'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const ms = Math.floor((sec % 1) * 1000)
  if (h > 0)
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VideoPlayerHandle {
  /** Seek to a specific second */
  seekTo: (t: number) => void
  /** Current playback time */
  currentTime: number
}

interface Props {
  src: string
  markers: Marker[]
  onTimeUpdate: (t: number) => void
  onDurationChange: (d: number) => void
  /** Called when user clicks "Marker" button or presses M — passes current time */
  onAddMarkerClick: (time: number) => void
  /** Called when a marker pin on the timeline is clicked */
  onMarkerClick: (marker: Marker) => void
}

// ── VideoPlayer ───────────────────────────────────────────────────────────────

const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(function VideoPlayer(
  { src, markers, onTimeUpdate, onDurationChange, onAddMarkerClick, onMarkerClick },
  ref,
) {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const timelineRef  = useRef<HTMLDivElement>(null)

  const [playing,     setPlaying]     = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration,    setDuration]    = useState(0)
  const [volume,      setVolume]      = useState(1)
  const [muted,       setMuted]       = useState(false)
  const [showVolume,  setShowVolume]  = useState(false)
  const [fullscreen,  setFullscreen]  = useState(false)
  const [hoverTime,   setHoverTime]   = useState<number | null>(null)
  const [playbackRate, setPlaybackRate] = useState(1)

  // Expose handle for parent (seekTo, currentTime)
  useImperativeHandle(ref, () => ({
    seekTo(t: number) {
      const v = videoRef.current
      if (v) v.currentTime = Math.max(0, Math.min(v.duration, t))
    },
    get currentTime() { return videoRef.current?.currentTime ?? 0 },
  }), [])

  // ── Playback controls ──────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play()
    else          v.pause()
  }, [])

  const seekBy = useCallback((delta: number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + delta))
  }, [])

  const stepFrame = useCallback((dir: 1 | -1) => {
    const v = videoRef.current
    if (!v) return
    v.pause()
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + dir / 24))
  }, [])

  const changeRate = useCallback((rate: number) => {
    const v = videoRef.current
    if (!v) return
    v.playbackRate = rate
    setPlaybackRate(rate)
  }, [])

  // ── Volume ─────────────────────────────────────────────────────────────────
  const handleVolumeChange = useCallback((val: number) => {
    setVolume(val)
    const v = videoRef.current
    if (v) { v.volume = val; v.muted = val === 0; setMuted(val === 0) }
  }, [])

  const toggleMute = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
  }, [])

  // ── Fullscreen ─────────────────────────────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen()
    else                             el.requestFullscreen()
  }, [])

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // ── Timeline interactions ──────────────────────────────────────────────────
  const timeFromEvent = useCallback((e: React.MouseEvent): number | null => {
    const el = timelineRef.current
    if (!el || !duration) return null
    const rect  = el.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    return ratio * duration
  }, [duration])

  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    const t = timeFromEvent(e)
    if (t !== null && videoRef.current) videoRef.current.currentTime = t
  }, [timeFromEvent])

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  // JKL + frame step — only when not inside an input/textarea
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName.toLowerCase()
      const inInput = tag === 'input' || tag === 'textarea' || tag === 'select'
        || (e.target as HTMLElement).isContentEditable
      if (inInput) return

      switch (e.key) {
        case 'j': case 'J':
          e.preventDefault()
          seekBy(-5)
          break
        case 'k': case 'K':
          e.preventDefault()
          togglePlay()
          break
        case 'l': case 'L':
          e.preventDefault()
          seekBy(5)
          break
        case 'ArrowLeft':
          if (!e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); stepFrame(-1) }
          break
        case 'ArrowRight':
          if (!e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); stepFrame(1) }
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [seekBy, togglePlay, stepFrame])

  // ── Derived ────────────────────────────────────────────────────────────────
  const videoMarkers = markers.filter(m => m.timestamp != null)
  const progressPct  = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full select-none"
      style={{ backgroundColor: '#000' }}
    >
      {/* ── Video area ── */}
      <div
        className="relative flex-1 flex items-center justify-center overflow-hidden cursor-pointer min-h-0"
        onClick={togglePlay}
      >
        <video
          ref={videoRef}
          src={src}
          className="max-w-full max-h-full"
          onTimeUpdate={e => {
            const t = e.currentTarget.currentTime
            setCurrentTime(t)
            onTimeUpdate(t)
          }}
          onLoadedMetadata={e => {
            const d = e.currentTarget.duration
            setDuration(d)
            onDurationChange(d)
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />

        {/* Big play overlay (visible when paused) */}
        {!playing && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
            >
              <Play size={28} className="text-white" style={{ marginLeft: 3 }} />
            </div>
          </div>
        )}

        {/* Timecode overlay — top right */}
        <div
          className="absolute top-3 right-3 px-2 py-1 rounded-md"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
        >
          <span className="font-mono text-xs text-white tracking-wider tabular-nums">
            {formatTimecode(currentTime)}
          </span>
        </div>

        {/* Playback rate badge — top left, only when not 1× */}
        {playbackRate !== 1 && (
          <div
            className="absolute top-3 left-3 px-2 py-1 rounded-md"
            style={{ background: 'rgba(99,102,241,0.75)', backdropFilter: 'blur(4px)' }}
          >
            <span className="font-mono text-xs text-white font-bold">{playbackRate}×</span>
          </div>
        )}
      </div>

      {/* ── Timeline + transport ── */}
      <div style={{ background: '#0a0d14', borderTop: '1px solid rgba(255,255,255,0.06)' }}>

        {/* ── Timeline strip ── */}
        <div className="px-3 pt-3 pb-1">
          <div
            ref={timelineRef}
            className="relative h-7 rounded-md cursor-crosshair overflow-visible"
            style={{ background: 'rgba(255,255,255,0.07)' }}
            onClick={handleTimelineClick}
            onMouseMove={e => setHoverTime(timeFromEvent(e))}
            onMouseLeave={() => setHoverTime(null)}
          >
            {/* Progress fill */}
            {duration > 0 && (
              <div
                className="absolute top-0 left-0 h-full rounded-md pointer-events-none"
                style={{ width: `${progressPct}%`, background: 'rgba(99,102,241,0.35)' }}
              />
            )}

            {/* Playhead */}
            {duration > 0 && (
              <div
                className="absolute top-0 h-full pointer-events-none z-10"
                style={{
                  left:       `${progressPct}%`,
                  width:      2,
                  background: '#fff',
                  transform:  'translateX(-1px)',
                }}
              >
                {/* Triangle head */}
                <div
                  className="absolute -top-px left-1/2 -translate-x-1/2 w-0 h-0"
                  style={{
                    borderLeft:   '5px solid transparent',
                    borderRight:  '5px solid transparent',
                    borderTop:    '7px solid #fff',
                  }}
                />
              </div>
            )}

            {/* Marker pins */}
            {duration > 0 && videoMarkers.map(m => {
              const pct = (m.timestamp! / duration) * 100
              return (
                <button
                  key={m.id}
                  className="absolute top-0 h-full group/pin z-20"
                  style={{ left: `calc(${pct}% - 2px)`, width: 5 }}
                  onClick={e => { e.stopPropagation(); onMarkerClick(m) }}
                  title={`${m.label} — ${formatTimecode(m.timestamp!)}`}
                >
                  <div className="w-full h-full" style={{ backgroundColor: MARKER_COLORS[m.color] }} />
                  {/* Triangle head */}
                  <div
                    className="absolute -top-px left-1/2 -translate-x-1/2 w-0 h-0"
                    style={{
                      borderLeft:   '5px solid transparent',
                      borderRight:  '5px solid transparent',
                      borderTop:    `7px solid ${MARKER_COLORS[m.color]}`,
                    }}
                  />
                  {/* Tooltip */}
                  <div
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 opacity-0 group-hover/pin:opacity-100 transition-opacity pointer-events-none z-30 whitespace-nowrap rounded-xl px-2.5 py-1.5 shadow-2xl"
                    style={{
                      background: 'var(--c-surface)',
                      border: '1px solid var(--c-surface-3)',
                    }}
                  >
                    <p className="text-[11px] font-semibold" style={{ color: 'inherit' }}>
                      {m.label}
                    </p>
                    {m.note && (
                      <p className="text-[10px] mt-0.5" style={{ color: '#6b7a96' }}>{m.note}</p>
                    )}
                    <p
                      className="text-[10px] font-mono mt-0.5"
                      style={{ color: MARKER_COLORS[m.color] }}
                    >
                      {formatTimecode(m.timestamp!)}
                    </p>
                  </div>
                </button>
              )
            })}

            {/* Hover ghost line */}
            {hoverTime !== null && duration > 0 && (
              <div
                className="absolute top-0 h-full w-px pointer-events-none z-5"
                style={{
                  left:       `${(hoverTime / duration) * 100}%`,
                  background: 'rgba(255,255,255,0.3)',
                }}
              >
                <div
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 rounded px-1.5 py-0.5 whitespace-nowrap"
                  style={{ background: '#1b2133', border: '1px solid #232a40' }}
                >
                  <span className="text-[10px] font-mono" style={{ color: '#94a3b8' }}>
                    {formatTimecode(hoverTime)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Transport bar ── */}
        <div className="flex items-center gap-1.5 px-3 pb-2.5">

          {/* J — seek -5s */}
          <button
            onClick={() => seekBy(-5)}
            className="video-btn"
            title="5s geri (J)"
          >
            <SkipBack size={13} />
          </button>

          {/* Prev frame */}
          <button
            onClick={() => stepFrame(-1)}
            className="video-btn"
            title="Önceki kare (←)"
          >
            <ChevronLeft size={14} />
          </button>

          {/* Play / Pause — center accent button */}
          <button
            onClick={togglePlay}
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-150 hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            title="Oynat / Duraklat (Space | K)"
          >
            {playing
              ? <Pause size={15} className="text-white" />
              : <Play  size={15} className="text-white" style={{ marginLeft: 2 }} />}
          </button>

          {/* Next frame */}
          <button
            onClick={() => stepFrame(1)}
            className="video-btn"
            title="Sonraki kare (→)"
          >
            <ChevronRight size={14} />
          </button>

          {/* L — seek +5s */}
          <button
            onClick={() => seekBy(5)}
            className="video-btn"
            title="5s ileri (L)"
          >
            <SkipForward size={13} />
          </button>

          {/* Playback speed chips */}
          <div className="flex items-center gap-0.5 ml-1">
            {[0.5, 1, 1.5, 2].map(r => (
              <button
                key={r}
                onClick={() => changeRate(r)}
                className="text-[10px] font-mono px-1.5 py-0.5 rounded transition-all"
                style={{
                  background: playbackRate === r ? 'rgba(99,102,241,0.3)' : 'transparent',
                  color:      playbackRate === r ? '#a5b4fc' : '#4a5a72',
                  border:     playbackRate === r ? '1px solid rgba(99,102,241,0.35)' : '1px solid transparent',
                }}
                title={`${r}× hız`}
              >
                {r}×
              </button>
            ))}
          </div>

          {/* Timecode */}
          <span
            className="font-mono text-xs tabular-nums ml-1"
            style={{ color: '#8b9ab8' }}
          >
            {formatTimecode(currentTime)}
            <span style={{ color: '#2d3a55' }}> / </span>
            <span style={{ color: '#4a5a72' }}>
              {duration > 0 ? formatTimecode(duration) : '--:--'}
            </span>
          </span>

          <div className="flex-1" />

          {/* Add marker */}
          <button
            onClick={() => onAddMarkerClick(currentTime)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105"
            style={{
              background: 'rgba(99,102,241,0.14)',
              color:      '#a5b4fc',
              border:     '1px solid rgba(99,102,241,0.28)',
            }}
            title="Marker ekle (M)"
          >
            <MapPin size={11} />
            Marker
          </button>

          {/* Volume */}
          <div
            className="relative flex items-center"
            onMouseEnter={() => setShowVolume(true)}
            onMouseLeave={() => setShowVolume(false)}
          >
            <button onClick={toggleMute} className="video-btn" title="Ses aç/kapat">
              {muted || volume === 0
                ? <VolumeX size={14} />
                : <Volume2 size={14} />}
            </button>
            {showVolume && (
              <div
                className="absolute bottom-full right-0 mb-2 px-3 py-2 rounded-xl shadow-xl flex items-center gap-2"
                style={{ background: 'var(--c-surface)', border: '1px solid var(--c-surface-3)' }}
              >
                <VolumeX size={11} style={{ color: '#4a5a72' }} />
                <input
                  type="range"
                  min="0" max="1" step="0.05"
                  value={muted ? 0 : volume}
                  onChange={e => handleVolumeChange(Number(e.target.value))}
                  className="w-20"
                  style={{ accentColor: '#6366f1' }}
                />
                <Volume2 size={11} style={{ color: '#4a5a72' }} />
              </div>
            )}
          </div>

          {/* Fullscreen */}
          <button onClick={toggleFullscreen} className="video-btn" title="Tam ekran">
            {fullscreen ? <Minimize size={13} /> : <Maximize size={13} />}
          </button>
        </div>
      </div>
    </div>
  )
})

export default VideoPlayer
