import { useState, type FormEvent } from 'react'
import { useAuth } from '../data/AuthProvider'
import { Icon } from '../components/Icon'
import { friendlyError } from '../lib/supabase'

export function LoginView() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password)
      } else {
        const { needsConfirmation } = await signUp(email.trim(), password)
        if (needsConfirmation) {
          setMessage({ kind: 'info', text: 'Fast geschafft! Bitte öffne den Bestätigungslink in deiner E-Mail und melde dich dann an.' })
          setMode('login')
        }
      }
    } catch (err) {
      setMessage({ kind: 'error', text: friendlyError(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-root items-center justify-center overflow-y-auto p-4">
      <form onSubmit={handleSubmit} className="tile w-full max-w-sm space-y-4 p-6">
        <div className="text-center">
          <div className="nav-plus mx-auto grid h-16 w-16 place-items-center"><Icon name="calendar" className="h-8 w-8" /></div>
          <h1 className="display dot mt-3 text-4xl">Kalender</h1>
          <p className="text-sm text-slate-500">{mode === 'login' ? 'Bitte anmelden' : 'Neues Konto erstellen'}</p>
        </div>
        <div>
          <label className="label" htmlFor="email">E-Mail</label>
          <input id="email" type="email" autoComplete="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="password">Passwort</label>
          <input
            id="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={6}
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {message && (
          <p
            role={message.kind === 'error' ? 'alert' : 'status'}
            className={`rounded-xl p-3 text-sm ${
              message.kind === 'error'
                ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                : 'bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
            }`}
          >
            {message.text}
          </p>
        )}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? 'Bitte warten …' : mode === 'login' ? 'Anmelden' : 'Konto erstellen'}
        </button>
        <button
          type="button"
          className="btn w-full text-sm text-blue-700 dark:text-blue-300"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login')
            setMessage(null)
          }}
        >
          {mode === 'login' ? 'Noch kein Konto? Konto erstellen' : 'Schon ein Konto? Anmelden'}
        </button>
      </form>
    </div>
  )
}
