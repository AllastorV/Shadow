import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Layers, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../utils/api'
import { useAuthStore } from '../store/auth'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const form = new FormData()
      form.append('username', email)
      form.append('password', password)
      const { data } = await api.post('/auth/login', form)
      setAuth(data.user, data.access_token)
      navigate('/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Giriş başarısız')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex"
      style={{ backgroundColor: 'var(--c-bg)' }}
    >
      {/* ── Left brand panel ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 p-10 relative overflow-hidden"
        style={{ backgroundColor: 'var(--c-surface)' }}
      >
        {/* Decorative gradient blobs */}
        <div
          className="absolute -top-20 -left-20 w-72 h-72 rounded-full blur-3xl opacity-25 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #6366f1, #8b5cf6)' }}
        />
        <div
          className="absolute -bottom-20 -right-10 w-56 h-56 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #06b6d4, #3b82f6)' }}
        />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            <Layers size={20} className="text-white" />
          </div>
          <span className="text-xl font-bold text-white" style={{ color: 'inherit' }}>
            Shadow
          </span>
          <span
            className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-md"
            style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8' }}
          >
            DAM
          </span>
        </div>

        {/* Features */}
        <div className="relative z-10 space-y-5">
          {[
            { icon: '🧠', title: 'Otomatik Analiz', desc: 'Her varlık otomatik olarak etiketlenir, açıklanır ve aranabilir hale gelir.' },
            { icon: '🔗', title: 'Kolay Paylaşım', desc: 'Güvenli bağlantılarla ekip üyeleri veya dış paydaşlarla varlıkları paylaşın.' },
            { icon: '🎬', title: 'Marker Sistemi', desc: 'Video ve görsel işaretçileri doğrudan Premiere Pro veya DaVinci Resolve\'a aktarın.' },
          ].map((f) => (
            <div key={f.title} className="flex items-start gap-4">
              <span className="text-2xl shrink-0 mt-0.5">{f.icon}</span>
              <div>
                <p className="text-sm font-semibold text-white mb-0.5" style={{ color: 'inherit' }}>
                  {f.title}
                </p>
                <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="text-[11px] text-slate-600 relative z-10">
          Digital Asset Management
        </p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm animate-slide-up">
          {/* Mobile logo */}
          <div className="flex items-center justify-center gap-3 mb-8 lg:hidden">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              <Layers size={20} className="text-white" />
            </div>
            <span className="text-2xl font-bold text-white" style={{ color: 'inherit' }}>Shadow</span>
          </div>

          <div className="mb-7">
            <h1 className="text-2xl font-bold text-white mb-1" style={{ color: 'inherit' }}>
              Tekrar hoş geldiniz
            </h1>
            <p className="text-sm text-slate-400">Medya arşivinize giriş yapın</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                E-posta
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input py-2.5"
                placeholder="siz@örnek.com"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Şifre
                </label>
              </div>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input py-2.5 pr-10"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: '#4a5a72' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'inherit' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#4a5a72' }}
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5 mt-2"
            >
              {loading ? (
                <><Loader2 size={14} className="animate-spin" /> Giriş yapılıyor…</>
              ) : (
                <>Giriş Yap <ArrowRight size={14} /></>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-5">
            Hesabınız yok mu?{' '}
            <Link to="/register" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              Kayıt ol
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
