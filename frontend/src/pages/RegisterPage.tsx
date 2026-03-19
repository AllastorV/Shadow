import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Layers } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../utils/api'
import { useAuthStore } from '../store/auth'

interface FormState {
  email: string
  username: string
  full_name: string
  password: string
}

export default function RegisterPage() {
  const [form, setForm] = useState<FormState>({ email: '', username: '', full_name: '', password: '' })
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Basic client-side validation (server validates too)
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    try {
      // SECURITY: Do NOT send role — backend always assigns 'editor' to new users
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
      toast.success('Account created!')
      navigate('/dashboard')
    } catch (err: any) {
      const detail = err.response?.data?.detail
      if (Array.isArray(detail)) {
        toast.error(detail[0]?.msg || 'Registration failed')
      } else {
        toast.error(typeof detail === 'string' ? detail : 'Registration failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center">
            <Layers size={20} className="text-white" />
          </div>
          <span className="text-2xl font-bold text-white">Shadow</span>
        </div>

        <div className="card p-6">
          <h1 className="text-xl font-bold text-white mb-1">Create your workspace</h1>
          <p className="text-sm text-slate-400 mb-6">Get started with AI media management</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { name: 'full_name', label: 'Full Name', placeholder: 'Jane Smith', type: 'text' },
              { name: 'username', label: 'Username', placeholder: 'janesmith', type: 'text' },
              { name: 'email', label: 'Email', placeholder: 'jane@example.com', type: 'email' },
              { name: 'password', label: 'Password', placeholder: '••••••••', type: 'password' },
            ].map((field) => (
              <div key={field.name}>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">{field.label}</label>
                <input
                  type={field.type}
                  name={field.name}
                  value={(form as any)[field.name]}
                  onChange={handleChange}
                  className="input"
                  placeholder={field.placeholder}
                  required
                  minLength={field.name === 'password' ? 8 : field.name === 'username' ? 3 : undefined}
                  maxLength={field.name === 'password' ? 128 : field.name === 'full_name' ? 100 : field.name === 'username' ? 32 : undefined}
                />
              </div>
            ))}

            <p className="text-xs text-slate-500">
              Password must be at least 8 characters with uppercase, lowercase, and a number.
            </p>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? 'Creating…' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-4">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-400 hover:text-brand-300">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
