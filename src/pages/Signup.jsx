import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'

export default function Signup() {
  const { signup, authError, clearAuthError } = useAuth()
  const nav = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    clearAuthError?.()
  }, [])

  async function onSubmit(e) {
    e.preventDefault()
    setMsg(null)
    if (password !== confirm) {
      setMsg({ type: 'error', text: 'Passwords do not match.' })
      return
    }
    setBusy(true)
    try {
      await signup(email.trim(), password)
      nav('/profile?setup=1')
    } catch {
      // handled by authError
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Create account</h2>
        <div className="muted">You’ll set sex + height next.</div>
      </div>

      {authError && <div className="notice error" style={{ marginTop: 12 }}>{authError}</div>}
      {msg && <div className={`notice ${msg.type === 'error' ? 'error' : 'info'}`} style={{ marginTop: 12 }}>{msg.text}</div>}

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
          <div className="field">
            <label>Confirm password</label>
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" required />
          </div>
        </div>

        <div className="footer-actions">
          <button className="btn primary" disabled={busy}>{busy ? 'Creating…' : 'Sign up'}</button>
          <Link className="btn" to="/login">Back to login</Link>
        </div>
      </form>
    </div>
  )
}
