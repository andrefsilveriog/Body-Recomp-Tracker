import React from 'react'
import { useAuth } from '../state/AuthContext.jsx'
import { useProfile } from '../state/ProfileContext.jsx'

export default function Admin() {
  const { user } = useAuth()
  const { profile } = useProfile()

  const isAdmin = !!profile?.isAdmin

  return (
    <>
      <div className="panel">
        <h2 style={{ margin: 0 }}>Administrator Panel</h2>
        <div className="small" style={{ marginTop: 6 }}>
          Work in progress. This area will be used for admin-only tools.
        </div>
      </div>

      <div className="card">
        <div className="small">Signed in as</div>
        <div style={{ fontWeight: 800, marginTop: 2 }}>{user?.email || '—'}</div>

        <div style={{ marginTop: 12 }} className={isAdmin ? 'notice success' : 'notice info'}>
          <b>Status:</b> {isAdmin ? 'Administrator' : 'Standard user'}
          <div className="small" style={{ marginTop: 4, opacity: 0.9 }}>
            Admin status is stored in your Firestore user document as <code>isAdmin</code>.
          </div>
        </div>
      </div>
    </>
  )
}
