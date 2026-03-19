import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Layers, Eye, MessageSquare, Download, Lock } from 'lucide-react'
import api from '../utils/api'

export default function ShareViewPage() {
  const { token } = useParams()
  const [password, setPassword] = useState('')
  const [submittedPassword, setSubmittedPassword] = useState('')
  const [needsPassword, setNeedsPassword] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['shareView', token, submittedPassword],
    queryFn: () =>
      api
        .get(`/share/view/${token}`, { params: submittedPassword ? { password: submittedPassword } : {} })
        .then((r) => r.data)
        .catch((err) => {
          if (err.response?.status === 401) {
            setNeedsPassword(true)
            throw err
          }
          throw err
        }),
    retry: false,
  })

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="text-slate-400">Loading…</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="border-b border-surface-300 px-6 py-3 flex items-center gap-3">
        <Layers size={20} className="text-brand-400" />
        <span className="font-bold text-white">Shadow</span>
        <span className="text-slate-500 text-sm ml-2">Shared Asset</span>
      </header>

      <div className="max-w-4xl mx-auto p-6">
        {needsPassword && !data ? (
          <div className="card max-w-sm mx-auto mt-16 p-6 text-center">
            <Lock size={40} className="text-slate-500 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-white mb-1">Password Protected</h2>
            <p className="text-sm text-slate-400 mb-4">This link requires a password to view</p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input mb-3"
              placeholder="Enter password"
            />
            <button
              onClick={() => setSubmittedPassword(password)}
              className="btn-primary w-full justify-center"
            >
              View Asset
            </button>
          </div>
        ) : error && !needsPassword ? (
          <div className="text-center mt-16 text-slate-400">
            <p className="text-lg font-medium text-white mb-1">Link not available</p>
            <p className="text-sm">This link may have expired or been revoked.</p>
          </div>
        ) : data ? (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-white">{data.asset.name}</h1>
                <p className="text-sm text-slate-400 capitalize">{data.permission} access · {data.label || 'Shared'}</p>
              </div>
              {data.permission === 'download' && (
                <a
                  href={`/files/${data.asset.id}/${data.asset.name}`}
                  download
                  className="btn-primary"
                >
                  <Download size={14} />
                  Download
                </a>
              )}
            </div>

            {/* Preview */}
            <div className="card p-4">
              {data.asset.type === 'image' && (
                <img
                  src={`/api/v1/share/view/${token}`}
                  alt={data.asset.name}
                  className="max-w-full mx-auto rounded-lg"
                />
              )}
              {data.asset.type !== 'image' && (
                <div className="py-16 text-center text-slate-400">
                  <p className="font-medium text-white">{data.asset.name}</p>
                  <p className="text-sm mt-1">{data.asset.mime_type}</p>
                </div>
              )}
            </div>

            {/* AI Description */}
            {data.asset.ai_description && (
              <div className="mt-4 p-4 bg-surface-100 rounded-xl">
                <p className="text-xs font-medium text-brand-400 mb-2">AI Description</p>
                <p className="text-sm text-slate-300">{data.asset.ai_description}</p>
                {data.asset.ai_tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {data.asset.ai_tags.map((tag: string) => (
                      <span key={tag} className="badge bg-brand-600/20 text-brand-300">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
