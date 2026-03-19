import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Sparkles, Loader2, ArrowRight } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import api from '../utils/api'
import type { Asset } from '../types'
import AssetCard from '../components/assets/AssetCard'

const EXAMPLE_QUERIES = [
  'Cinematic aerial landscape shots',
  'Portrait photos with warm lighting',
  'Product shots on white background',
  'Team photos at events',
  'Videos with natural sound',
]

export default function SearchPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Asset[] | null>(null)
  const [searched, setSearched] = useState('')

  const searchMutation = useMutation({
    mutationFn: (q: string) => api.get('/assets/search', { params: { q } }).then((r) => r.data),
    onSuccess: (data: Asset[], q) => {
      setResults(data)
      setSearched(query)
    },
  })

  const handleSearch = (q?: string) => {
    const searchQuery = q || query
    if (!searchQuery.trim()) return
    if (q) setQuery(q)
    searchMutation.mutate(searchQuery.trim())
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 badge bg-brand-600/20 text-brand-300 mb-4 px-3 py-1">
          <Sparkles size={13} />
          AI-Powered Search
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">Find Any Asset</h1>
        <p className="text-slate-400 max-w-lg mx-auto">
          Describe what you're looking for in plain language. AI will find relevant assets across all your projects.
        </p>
      </div>

      {/* Search input */}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="input pl-11 pr-24 py-3.5 text-base w-full"
          placeholder="e.g. 'outdoor sports action shots', 'office interviews', 'product close-ups'..."
          autoFocus
        />
        <button
          onClick={() => handleSearch()}
          disabled={!query.trim() || searchMutation.isPending}
          className="absolute right-2 top-1/2 -translate-y-1/2 btn-primary py-1.5"
        >
          {searchMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
          {searchMutation.isPending ? 'Searching…' : 'Search'}
        </button>
      </div>

      {/* Example queries */}
      {results === null && !searchMutation.isPending && (
        <div className="text-center">
          <p className="text-sm text-slate-500 mb-3">Try an example:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {EXAMPLE_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => handleSearch(q)}
                className="px-3 py-1.5 rounded-full bg-surface-100 hover:bg-surface-200 text-sm text-slate-400 hover:text-slate-200 transition-colors border border-surface-300"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {searchMutation.isPending && (
        <div className="text-center py-16">
          <Sparkles size={32} className="text-brand-400 mx-auto mb-3 animate-pulse" />
          <p className="text-slate-400">AI is searching across your assets…</p>
        </div>
      )}

      {/* Results */}
      {results !== null && !searchMutation.isPending && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-400">
              <span className="text-white font-medium">{results.length}</span> results for{' '}
              <span className="text-brand-300">"{searched}"</span>
            </p>
          </div>

          {results.length === 0 ? (
            <div className="text-center py-16">
              <Search size={40} className="text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">No matching assets found</p>
              <p className="text-slate-500 text-sm mt-1">Try a different description or upload more assets</p>
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
