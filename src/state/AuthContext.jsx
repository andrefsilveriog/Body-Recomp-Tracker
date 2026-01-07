import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { auth } from '../firebase.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [initializing, setInitializing] = useState(true)
  const [authError, setAuthError] = useState(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setInitializing(false)
    })
    return () => unsub()
  }, [])

  const api = useMemo(() => ({
    user,
    initializing,
    authError,
    clearAuthError: () => setAuthError(null),

    async signup(email, password) {
      setAuthError(null)
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password)
        return cred.user
      } catch (e) {
        setAuthError(e?.message || 'Failed to sign up.')
        throw e
      }
    },

    async login(email, password) {
      setAuthError(null)
      try {
        const cred = await signInWithEmailAndPassword(auth, email, password)
        return cred.user
      } catch (e) {
        setAuthError(e?.message || 'Failed to log in.')
        throw e
      }
    },

    async logout() {
      await signOut(auth)
    },

    async resetPassword(email) {
      setAuthError(null)
      try {
        await sendPasswordResetEmail(auth, email)
      } catch (e) {
        setAuthError(e?.message || 'Failed to send reset email.')
        throw e
      }
    },
  }), [user, initializing, authError])

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
