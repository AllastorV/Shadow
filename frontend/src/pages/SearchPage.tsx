import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Sparkles, Loader2, ArrowRight, Command } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import api from '../utils/api'
import type { Asset } from '../types'
import AssetCard from '../components/assets/AssetCard'
import { useShortcutAction } from '../utils/shortcuts'

const EXAMPLE_QUERIES = [
  { text: 'Sinematik hava görüntüleri', emoji: '🎬' },
  { text: 'Sıcak ışıklı portre fotoğraflar', emoji: '🌅' },
  { text: 'Beyaz arka planda ürün çekimleri', emoji: '📦' },
  { text: 'Etkinliklerdeki ekip fotoğrafları', emoji: '🎉' },
  { text: 'Doğal sesli açık hava videoları', emoji: '🌿' },
  { text: 'Dramatik ruh halindeki sahneler', emoji: '🎭' },
]

export default function SearchPage() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Asset[] | null>(null)
  const [searched, setSearched] = useState('')
  const [focused, setFocused] = useState(false)

  useShortcutAction('focus_search', () => inputRef.current?.focus())

  const searchMutation = useMutation({
    mutationFn: (q: string) =>
      api.get('/assets/search', { params: { q } }).then((r) => r.data),
    onSuccess: (data: Asset[]) => {
      setResults(data)
      setSearched(query)
    },
  })

  const handleSearch = (q?: string) => {
    const searchQuery = q ?? query
    if (!searchQuery.trim()) return
    if (q) setQuery(q)
    searchMutation.mutate(searchQuery.trim())
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 animate-fade-in">
      {/* ── Hero Header ── */}
      <div className="text-center mb-10">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-5"
          style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', color: '#818cf8' }}
        >
          <Sparkles size={11} />
          Akıllı Arama
        </div>
        <h1 className="text-3xl font-bold text-white mb-3" style={{ color: 'inherit' }}>
          Herhangi bir varlığı bulun
        </h1>
        <p className="text-slate-400 max-w-lg mx-auto text-sm leading-relaxed">
          Neyi aradığınızı doğal dilde yazın. AI, tüm projelerinizdeki ilgili varlıkları bulacak.
        </p>
      </div>

      {/* ── NLP Search Input ── */}
      <div className="relative mb-6">
        {/* Glow ring on focus */}
        <div
          className="absolute inset-0 rounded-2xl transition-opacity duration-300 pointer-events-none"
          style={{
            opacity: focused ? 1 : 0,
            background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))',
            filter: 'blur(8px)',
            transform: 'scale(1.02)',
          }}
        />

        <div
          className="relative flex items-center rounded-2xl overflow-hidden transition-all duration-200"
          style={{
            backgroundColor: 'var(--c-surface)',
            border: focused
              ? '1px solid rgba(99,102,241,0.6)'
              : '1px solid var(--c-surface-3)',
            boxShadow: focused ? '0 0 0 3px rgba(99,102,241,0.12)' : 'none',
          }}
        >
          <div className="pl-5 pr-3 text-brand-400 shrink-0">
            {searchMutation.isPending ? (
              <Loader2 size={18} className="animate-spin text-brand-400" />
            ) : (
              <Search size={18} />
            )}
          </div>

          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className="flex-1 py-4 text-sm bg-transparent outline-none text-white placeholder-slate-500"
            style={{ color: 'inherit' }}
            placeholder="örn. 'ormanda dondurma yiyen sahneler', 'ofis röportajları', 'ürün yakın çekimleri'..."
            autoFocus
          />

          {/* Keyboard hint */}
          {!query && !focused && (
            <div
              className="hidden md:flex items-center gap-1 mr-4 px-2 py-1 rounded-lg text-[11px] shrink-0"
              style={{ backgroundColor: 'var(--c-surface-2)', color: '#4a5a72' }}
            >
              <Command size={10} />
              <span>Enter</span>
            </div>
          )}

          {query && (
            <button
              onClick={() => handleSearch()}
              disabled={!query.trim() || searchMutation.isPending}
              className="btn-primary mr-2 shrink-0"
            >
              {searchMutation.isPending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <ArrowRight size={13} />
              )}
              {searchMutation.isPending ? 'Aranıyor…' : 'Ara'}
            </button>
          )}
        </div>
      </div>

      {/* ── Example Queries ── */}
      {results === null && !searchMutation.isPending && (
        <div className="animate-slide-up">
          <p className="text-center text-xs text-slate-500 mb-4 font-medium">
            Örnek aramalar
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {EXAMPLE_QUERIES.map(({ text, emoji }) => (
              <button
                key={text}
                onClick={() => handleSearch(text)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-150"
                style={{
                  backgroundColor: 'var(--c-surface)',
                  border: '1px solid var(--c-surface-3)',
                  color: '#8b9ab8',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor = 'rgba(99,102,241,0.4)'
                  el.style.color = 'inherit'
                  el.style.backgroundColor = 'var(--c-surface-1)'
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor = 'var(--c-surface-3)'
                  el.style.color = '#8b9ab8'
                  el.style.backgroundColor = 'var(--c-surface)'
                }}
              >
                <span>{emoji}</span>
                {text}
              </button>
            ))}
          </div>

          {/* Feature hints */}
          <div className="mt-10 grid grid-cols-3 gap-4 max-w-2xl mx-auto">
            {[
              { icon: '🔍', title: 'Doğal Dil', desc: 'Teknik filtreler yerine sıradan cümlelerle arayın' },
              { icon: '⚡', title: 'Anlık Sonuçlar', desc: 'Tüm projelerinizde eş zamanlı arama' },
              { icon: '🧠', title: 'AI Anlayışı', desc: 'Görsel içerik, sahne ve duygu düzeyinde eşleşme' },
            ].map((hint) => (
              <div
                key={hint.title}
                className="rounded-xl p-4 text-center"
                style={{
                  backgroundColor: 'var(--c-surface)',
                  border: '1px solid var(--c-surface-3)',
                }}
              >
                <div className="text-2xl mb-2">{hint.icon}</div>
                <p className="text-xs font-semibold text-white mb-1" style={{ color: 'inherit' }}>
                  {hint.title}
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed">{hint.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {searchMutation.isPending && (
        <div className="text-center py-16 animate-fade-in">
          <div className="relative inline-flex mb-5">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.12)' }}
            >
              <Sparkles size={26} className="text-brand-400 animate-pulse" />
            </div>
            <div
              className="absolute inset-0 rounded-2xl animate-ping-slow opacity-30"
              style={{ background: 'rgba(99,102,241,0.3)' }}
            />
          </div>
          <p className="font-semibold text-white mb-1" style={{ color: 'inherit' }}>
            AI arıyor…
          </p>
          <p className="text-sm text-slate-500">
            "{query}" için tüm varlıklar taranıyor
          </p>
        </div>
      )}

      {/* ── Results ── */}
      {results !== null && !searchMutation.isPending && (
        <div className="animate-slide-up">
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm text-slate-400">
              <span className="text-white font-semibold" style={{ color: 'inherit' }}>
                {results.length}
              </span>{' '}
              sonuç bulundu:{' '}
              <span className="text-brand-400">"{searched}"</span>
            </p>
            <button
              onClick={() => { setResults(null); setQuery(''); inputRef.current?.focus() }}
              className="text-xs text-slate-500 hover:text-brand-400 transition-colors"
            >
              Temizle
            </button>
          </div>

          {results.length === 0 ? (
            <div
              className="rounded-2xl p-12 text-center"
              style={{
                backgroundColor: 'var(--c-surface)',
                border: '1px dashed var(--c-surface-3)',
              }}
            >
              <Search size={36} className="text-slate-600 mx-auto mb-3" />
              <p className="font-semibold text-white mb-1" style={{ color: 'inherit' }}>
                Eşleşen varlık bulunamadı
              </p>
              <p className="text-sm text-slate-500">
                Farklı bir açıklama deneyin veya daha fazla varlık yükleyin
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {results.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  onClick={() => navigate(`/projects/${asset.project_id}/assets/${asset.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
