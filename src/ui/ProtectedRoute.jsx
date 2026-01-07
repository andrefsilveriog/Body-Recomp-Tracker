import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'

export default function ProtectedRoute({ children }) {
  const { user, initializing } = useAuth()
  if (initializing) return <div className="panel"><div className="muted">Loading…</div></div>
  if (!user) return <Navigate to="/login" replace />
  return children
}
