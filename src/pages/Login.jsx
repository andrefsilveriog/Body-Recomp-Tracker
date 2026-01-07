import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'

export default function Login() {
  const { user, login, authError, clearAuthError } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    clearAuthError?.()
  }, [])

  useEffect(() => {
    if (user) nav('/dashboard')
  }, [user])

  async function onSubmit(e) {
    e.preventDefault()
    setMsg(null)
    setBusy(true)
    try {
      await login(email.trim(), password)
      const next = loc.state?.from || '/dashboard'
      nav(next)
    } catch {
      // handled by authError
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Log in</h2>
        <div className="muted">Email/password only.</div>
      </div>

      {authError && <div className="notice error" style={{ marginTop: 12 }}>{authError}</div>}
      {msg && <div className="notice info" style={{ marginTop: 12 }}>{msg}</div>}

      <form onSubmit={onSubmit} style={{ marginTop: 12 }}>
        <div className="row">
          <div className="field">
            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </div>
          <div className="field">
            <label>Password</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
          </div>
        </div>

        <div className="footer-actions">
          <button className="btn primary" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
          <Link className="btn" to="/reset-password">Forgot password</Link>
          <Link className="btn" to="/signup">Create account</Link>
        </div>
      </form>
    </div>
  )
}
