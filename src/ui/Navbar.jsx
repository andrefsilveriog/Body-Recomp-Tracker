import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'

export default function Navbar() {
  const { user, logout } = useAuth()
  const nav = useNavigate()

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
            <div className="small">Trend-first logging: weight ↓, strength ↔/↑</div>
          </div>
        </div>

        <div className="nav-links">
          <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>Dashboard</NavLink>
          {user && <NavLink to="/entry" className={({ isActive }) => isActive ? 'active' : ''}>Entry</NavLink>}
          {user && <NavLink to="/profile" className={({ isActive }) => isActive ? 'active' : ''}>Profile</NavLink>}
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
