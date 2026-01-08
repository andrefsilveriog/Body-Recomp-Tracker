import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'

function storageKey(uid) {
  return `brt_notifications_v1_${uid}`
}

function loadNotifications(uid) {
  if (!uid) return []
  try {
    const raw = localStorage.getItem(storageKey(uid))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveNotifications(uid, items) {
  if (!uid) return
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(items))
  } catch {
    // ignore
  }
}

export default function Notifications() {
  const { user } = useAuth()
  const nav = useNavigate()

  const [items, setItems] = useState(() => loadNotifications(user?.uid))

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => (b?.createdAt || 0) - (a?.createdAt || 0))
  }, [items])

  function dismiss(id) {
    const next = items.filter(n => n.id !== id)
    setItems(next)
    saveNotifications(user?.uid, next)
  }

  function clearAll() {
    setItems([])
    saveNotifications(user?.uid, [])
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Notifications</h2>
          <div className="small">This is a placeholder for a future notification system.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn small" onClick={() => nav('/dashboard')}>Back</button>
          <button className="btn small" onClick={clearAll} disabled={sorted.length === 0}>Clear all</button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="panel">
          <div className="small">No notifications yet.</div>
        </div>
      ) : (
        <div className="panel" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 140 }}>Date</th>
                <th>Message</th>
                <th style={{ width: 120 }}></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((n) => (
                <tr key={n.id}>
                  <td className="small">{n?.createdAt ? new Date(n.createdAt).toLocaleDateString() : '-'}</td>
                  <td>{n?.message || '-'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn small" onClick={() => dismiss(n.id)}>Dismiss</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
