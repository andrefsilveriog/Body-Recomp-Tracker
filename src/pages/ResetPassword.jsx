import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'

export default function ResetPassword() {
  const { resetPassword, authError, clearAuthError } = useAuth()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    clearAuthError?.()
  }, [])

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setSent(false)
    try {
      await resetPassword(email.trim())
      setSent(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Reset password</h2>
        <div className="muted">We’ll email you a reset link.</div>
      </div>

      {authError && <div className="notice error" style={{ marginTop: 12 }}>{authError}</div>}
      {sent && <div className="notice success" style={{ marginTop: 12 }}>Reset email sent. Check your inbox.</div>}

      <form onSubmit={onSubmit} style={{ marginTop: 12 }}>
        <div className="row">
          <div className="field">
            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </div>
        </div>

        <div className="footer-actions">
          <button className="btn primary" disabled={busy}>{busy ? 'Sending…' : 'Send reset email'}</button>
          <Link className="btn" to="/login">Back to login</Link>
        </div>
      </form>
    </div>
  )
}
