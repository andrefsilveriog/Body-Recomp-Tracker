import React from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Navbar from './ui/Navbar.jsx'
import ProtectedRoute from './ui/ProtectedRoute.jsx'

import Dashboard from './pages/Dashboard.jsx'
import Insights from './pages/Insights.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import Profile from './pages/Profile.jsx'
import Entry from './pages/Entry.jsx'
import Admin from './pages/Admin.jsx'

export default function App() {
  return (
    <>
      <Navbar />
      <div className="app-shell">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/insights" element={<Insights />} />

          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            }
          />


          <Route
            path="/entry"
            element={
              <ProtectedRoute>
                <Entry />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </>
  )
}
