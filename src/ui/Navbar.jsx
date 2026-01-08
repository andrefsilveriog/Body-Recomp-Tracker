import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'
import { useProfile } from '../state/ProfileContext.jsx'

export default function Navbar() {
  const { user, logout } = useAuth()
  const { profile } = useProfile()
  const nav = useNavigate()

  const showAdmin = !!user && (!!profile?.isAdmin || profile?.accountType === 'admin')

  async function onLogout() {
    await logout()
    nav('/dashboard')
  }

  return (
    <div className="nav">
      <div className="nav-inner">
        <div className="brand">
          <div className="badge" />
          <div>
            <h1>Body Recomposition Tracker</h1>
            <div className="small">Created by Andre Gomes</div>
          </div>
        </div>

        <div className="nav-links">
          <div className="nav-tabs">
            <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>Dashboard</NavLink>
            <NavLink to="/insights" className={({ isActive }) => isActive ? 'active' : ''}>Insights</NavLink>
          </div>
          {user && <NavLink to="/entry" className={({ isActive }) => isActive ? 'active' : ''}>Entry</NavLink>}
          {user && <NavLink to="/profile" className={({ isActive }) => isActive ? 'active' : ''}>Profile</NavLink>}
          {showAdmin && <NavLink to="/admin" className={({ isActive }) => isActive ? 'active' : ''}>Admin</NavLink>}
        </div>

        <div className="nav-actions">
          {!user ? (
            <>
              <NavLink to="/login" className="btn">Log in</NavLink>
              <NavLink to="/signup" className="btn primary">Sign up</NavLink>
            </>
          ) : (
            <button className="btn danger" onClick={onLogout}>Log out</button>
          )}
        </div>
      </div>
    </div>
  )
}
