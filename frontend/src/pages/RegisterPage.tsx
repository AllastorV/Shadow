import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Layers, Eye, EyeOff, ArrowRight, Loader2, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../utils/api'
import { useAuthStore } from '../store/auth'

interface FormState {
  email: string
  username: string
  full_name: string
  password: string
}

// Password strength checker
function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (pw.length === 0) return { score: 0, label: '', color: '' }
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[a-z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++

  if (score <= 2) return { score, label: 'Zayıf', color: '#f87171' }
  if (score <= 3) return { score, label: 'Orta', color: '#fbbf24' }
  return { score, label: 'Güçlü', color: '#34d399' }
}

export default function RegisterPage() {
  const [form, setForm] = useState<FormState>({ email: '', username: '', full_name: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const pwStrength = getPasswordStrength(form.password)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password.length < 8) {
      toast.error('Şifre en az 8 karakter olmalıdır')
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/register', {
        email: form.email,
        username: form.username,
        full_name: form.full_name,
        password: form.password,
      })
      const fd = new FormData()
      fd.append('username', form.email)
      fd.append('password', form.password)
      const { data } = await api.post('/auth/login', fd)
      setAuth(data.user, data.access_token)
      toast.success('Hesap oluşturuldu!')
      navigate('/dashboard')
    } catch (err: any) {
      const detail = err.response?.data?.detail
      if (Array.isArray(detail)) {
        toast.error(detail[0]?.msg || 'Kayıt başarısız')
      } else {
        toast.error(typeof detail === 'string' ? detail : 'Kayıt başarısız')
      }
    } finally {
      setLoading(false)
    }
  }

  const FIELDS = [
    { name: 'full_name', label: 'Ad Soyad',    placeholder: 'Ali Yılmaz',          type: 'text',     icon: '👤' },
    { name: 'username',  label: 'Kullanıcı Adı', placeholder: 'aliyilmaz',          type: 'text',     icon: '@'  },
    { name: 'email',     label: 'E-posta',      placeholder: 'ali@örnek.com',       type: 'email',    icon: '✉️' },
  ]

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
        {/* Decorative blobs */}
        <div
          className="absolute -top-20 -right-10 w-72 h-72 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #8b5cf6, #6366f1)' }}
        />
        <div
          className="absolute -bottom-10 -left-10 w-56 h-56 rounded-full blur-3xl opacity-15 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #10b981, #06b6d4)' }}
        />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            <Layers size={20} className="text-white" />
          </div>
          <span className="text-xl font-bold text-white" style={{ color: 'inherit' }}>Shadow</span>
        </div>

        {/* Benefits */}
        <div className="relative z-10 space-y-4">
          <h2 className="text-xl font-bold text-white mb-2" style={{ color: 'inherit' }}>
            Medya arşivinizi zekice yönetin
          </h2>
          {[
            'AI tabanlı otomatik etiketleme ve açıklama',
            'Ekip üyeleriyle anlık işbirliği',
            'Premiere Pro ve DaVinci Resolve entegrasyonu',
            'Güvenli paylaşım bağlantıları',
          ].map((item) => (
            <div key={item} className="flex items-start gap-3">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.3)' }}
              >
                <Check size={10} className="text-emerald-400" />
              </div>
              <span className="text-sm text-slate-400">{item}</span>
            </div>
          ))}
        </div>

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
              Hesap oluşturun
            </h1>
            <p className="text-sm text-slate-400">AI medya arşivine hoş geldiniz</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {FIELDS.map((field) => (
              <div key={field.name}>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                  {field.label}
                </label>
                <input
                  type={field.type}
                  name={field.name}
                  value={(form as any)[field.name]}
                  onChange={handleChange}
                  className="input py-2.5"
                  placeholder={field.placeholder}
                  required
                  minLength={field.name === 'username' ? 3 : undefined}
                  maxLength={
                    field.name === 'full_name' ? 100
                      : field.name === 'username' ? 32
                      : undefined
                  }
                />
              </div>
            ))}

            {/* Password with strength indicator */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                Şifre
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  className="input py-2.5 pr-10"
                  placeholder="••••••••"
                  required
                  minLength={8}
                  maxLength={128}
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

              {/* Strength bar */}
              {form.password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <div
                        key={s}
                        className="h-1 flex-1 rounded-full transition-all duration-300"
                        style={{
                          backgroundColor:
                            s <= pwStrength.score ? pwStrength.color : 'var(--c-surface-3)',
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] font-medium" style={{ color: pwStrength.color }}>
                    {pwStrength.label}
                  </p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5 mt-1"
            >
              {loading ? (
                <><Loader2 size={14} className="animate-spin" /> Oluşturuluyor…</>
              ) : (
                <>Hesap Oluştur <ArrowRight size={14} /></>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-5">
            Zaten hesabınız var mı?{' '}
            <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              Giriş yap
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
