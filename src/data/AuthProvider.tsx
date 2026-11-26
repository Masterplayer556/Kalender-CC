// Login-Zustand für die ganze App. Supabase speichert die Sitzung im Browser,
// deshalb bleibt man auch nach dem Schließen der App angemeldet (und offline).

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { clearSnapshot } from '../lib/cache'

interface AuthValue {
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const value: AuthValue = {
    session,
    loading,
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    async signUp(email, password) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        // Nach dem Klick auf den Bestätigungslink landet man wieder in der App
        options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
      })
      if (error) throw error
      return { needsConfirmation: !data.session }
    },
    async signOut() {
      if (session) clearSnapshot(session.user.id)
      // Offline (oder mit abgelaufener Anmeldung, die sich ohne Server nicht erneuern lässt) bricht
      // supabase.auth.signOut() ab, ohne etwas zu tun – dann auf diesem Gerät trotzdem abmelden.
      const { error } = navigator.onLine ? await supabase.auth.signOut() : { error: new Error('offline') }
      if (error) {
        await signOutLocally()
        setSession(null)
      }
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Gespeicherte Sitzung auf diesem Gerät löschen, ohne den Server zu fragen. */
async function signOutLocally(): Promise<void> {
  // _removeSession ist nicht öffentlich, löscht aber genau die Sitzung und meldet SIGNED_OUT an alle Tabs
  const auth = supabase.auth as unknown as { _removeSession?: () => Promise<void>; storageKey?: string }
  try {
    if (typeof auth._removeSession === 'function') return await auth._removeSession()
  } catch {
    /* unten von Hand */
  }
  try {
    if (auth.storageKey) {
      localStorage.removeItem(auth.storageKey)
      localStorage.removeItem(`${auth.storageKey}-user`)
    }
  } catch {
    /* ignorieren */
  }
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth() muss innerhalb von <AuthProvider> verwendet werden')
  return ctx
}
