import { useState, useEffect, useRef } from 'react'
import { X, Keyboard, RotateCcw, Search } from 'lucide-react'
import { useShortcuts, DEFAULT_SHORTCUTS, type ShortcutId } from '../utils/shortcuts'

export default function ShortcutsPanel() {
  const { panelOpen, closePanel, activeKeys, setCustomKey, resetKey, resetAll } = useShortcuts()
  const [recording, setRecording] = useState<ShortcutId | null>(null)
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  // Focus search on open
  useEffect(() => {
    if (panelOpen) {
      setSearch('')
      setRecording(null)
      setTimeout(() => searchRef.current?.focus(), 50)
    }
  }, [panelOpen])

  // Key capture for recording
  useEffect(() => {
    if (!panelOpen) return
    const handler = (e: KeyboardEvent) => {
      if (recording) {
        e.preventDefault()
        e.stopPropagation()
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return

        const parts: string[] = []
        if (e.ctrlKey)  parts.push('Ctrl')
        if (e.shiftKey) parts.push('Shift')
        if (e.altKey)   parts.push('Alt')
        parts.push(e.key === ' ' ? 'Space' : e.key)

        setCustomKey(recording, parts.join('+'))
        setRecording(null)
        return
      }
      if (e.key === 'Escape') { e.preventDefault(); closePanel() }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [panelOpen, recording, setCustomKey, closePanel])

  if (!panelOpen) return null

  const categories = [...new Set(DEFAULT_SHORTCUTS.map(s => s.category))]
  const filtered = DEFAULT_SHORTCUTS.filter(s =>
    !search ||
    s.label.toLowerCase().includes(search.toLowerCase()) ||
    s.description.toLowerCase().includes(search.toLowerCase()) ||
    activeKeys[s.id].toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) closePanel() }}
    >
      <div
        className="w-full max-w-xl max-h-[82vh] flex flex-col rounded-2xl overflow-hidden"
        style={{
          backgroundColor: 'var(--c-surface)',
          border: '1px solid var(--c-surface-3)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.55)',
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--c-surface-2)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              <Keyboard size={15} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'inherit' }}>
                Klavye Kısayolları
              </h2>
              <p className="text-[11px]" style={{ color: '#6b7a96' }}>
                Değiştirmek için satıra tıkla · <kbd className="font-mono text-[10px]">Esc</kbd> kapat
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={resetAll}
              className="btn-ghost text-xs gap-1.5"
              title="Tüm kısayolları sıfırla"
            >
              <RotateCcw size={12} />
              Sıfırla
            </button>
            <button onClick={closePanel} className="btn-ghost p-1.5">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── Search ── */}
        <div className="px-5 py-3 shrink-0" style={{ borderBottom: '1px solid var(--c-surface-2)' }}>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#6b7a96' }} />
            <input
              ref={searchRef}
              type="text"
              placeholder="Kısayol ara…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input w-full pl-8 py-2 text-sm"
            />
          </div>
        </div>

        {/* ── List ── */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {categories.map(cat => {
            const items = filtered.filter(s => s.category === cat)
            if (!items.length) return null
            return (
              <div key={cat}>
                <p
                  className="text-[10px] font-bold uppercase tracking-widest mb-2"
                  style={{ color: '#4a5a72' }}
                >
                  {cat}
                </p>
                <div className="space-y-0.5">
                  {items.map(def => {
                    const isRecording = recording === def.id
                    const key = activeKeys[def.id]
                    const isCustom = key !== def.defaultKey

                    return (
                      <div
                        key={def.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`${def.label} kısayolunu değiştir: ${key}`}
                        className="flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-150 group cursor-pointer outline-none"
                        style={{
                          backgroundColor: isRecording ? 'rgba(99,102,241,0.1)' : '',
                          border: isRecording
                            ? '1px solid rgba(99,102,241,0.45)'
                            : '1px solid transparent',
                        }}
                        onMouseEnter={e => {
                          if (!isRecording)
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--c-surface-1)'
                        }}
                        onMouseLeave={e => {
                          if (!isRecording)
                            (e.currentTarget as HTMLElement).style.backgroundColor = ''
                        }}
                        onClick={() => setRecording(isRecording ? null : def.id)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setRecording(isRecording ? null : def.id) }}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'inherit' }}>
                            {def.label}
                          </p>
                          <p className="text-xs truncate" style={{ color: '#6b7a96' }}>
                            {def.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          {isRecording ? (
                            <span
                              className="text-xs font-medium animate-pulse px-3 py-1.5 rounded-lg"
                              style={{ backgroundColor: 'rgba(99,102,241,0.18)', color: '#a5b4fc' }}
                            >
                              Tuşa bas…
                            </span>
                          ) : (
                            <span className="inline-flex gap-0.5 items-center">
                              {key.split('+').map((part, i) => (
                                <kbd
                                  key={i}
                                  className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                                  style={{
                                    background: 'var(--c-surface-2)',
                                    border: '1px solid var(--c-surface-3)',
                                    color: isCustom ? '#a5b4fc' : '#8b9ab8',
                                  }}
                                >
                                  {part}
                                </kbd>
                              ))}
                            </span>
                          )}
                          {isCustom && !isRecording && (
                            <button
                              className="opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-opacity"
                              style={{ color: '#6b7a96' }}
                              title="Varsayılana sıfırla"
                              onClick={e => { e.stopPropagation(); resetKey(def.id) }}
                            >
                              <RotateCcw size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-center py-8" style={{ color: '#4a5a72' }}>
              Eşleşen kısayol bulunamadı
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
