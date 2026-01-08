import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, onSnapshot, orderBy, query, writeBatch, doc } from 'firebase/firestore'
import { db } from '../firebase.js'
import { useAuth } from '../state/AuthContext.jsx'
import { useProfile } from '../state/ProfileContext.jsx'

const ACCOUNT_OPTIONS = [
  { value: 'user', label: 'Standard' },
  { value: 'admin', label: 'Administrator' },
]

function normalizeAccountType(u) {
  if (u?.accountType === 'admin') return 'admin'
  if (u?.isAdmin) return 'admin'
  return 'user'
}

export default function Admin() {
  const { user } = useAuth()
  const { profile, loading: profileLoading } = useProfile()
  const nav = useNavigate()

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [editing, setEditing] = useState(false)
  const [draftTypes, setDraftTypes] = useState({})
  const [saveError, setSaveError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)

  const isAdmin = !!profile?.isAdmin || profile?.accountType === 'admin'

  useEffect(() => {
    if (!user) return
    if (profileLoading) return
    if (!isAdmin) {
      setUsers([])
      setLoading(false)
      setLoadError(null)
      return
    }
    setLoading(true)
    setLoadError(null)

    const q = query(collection(db, 'users'), orderBy('email', 'asc'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        setUsers(rows)
        setLoading(false)
      },
      (err) => {
        setLoadError(err?.message || String(err))
        setLoading(false)
      }
    )

    return () => unsub()
  }, [user, isAdmin, profileLoading])

  const currentTypes = useMemo(() => {
    const map = {}
    users.forEach((u) => {
      map[u.id] = normalizeAccountType(u)
    })
    return map
  }, [users])

  const dirty = useMemo(() => {
    if (!editing) return false
    for (const uid of Object.keys(draftTypes)) {
      if (draftTypes[uid] !== currentTypes[uid]) return true
    }
    return false
  }, [draftTypes, currentTypes, editing])

  function enterEdit() {
    setSavedAt(null)
    setSaveError(null)
    setEditing(true)
    setDraftTypes({ ...currentTypes })
  }

  function cancelEdit() {
    setEditing(false)
    setDraftTypes({})
    setSaveError(null)
    setSavedAt(null)
  }

  async function save() {
    if (!user) return
    setSaving(true)
    setSaveError(null)
    setSavedAt(null)

    try {
      const batch = writeBatch(db)
      let changedCount = 0

      for (const uid of Object.keys(draftTypes)) {
        const nextType = draftTypes[uid]
        const prevType = currentTypes[uid]
        if (nextType === prevType) continue

        const ref = doc(db, 'users', uid)
        const isAdmin = nextType === 'admin'
        batch.update(ref, { accountType: nextType, isAdmin })
        changedCount += 1
      }

      if (changedCount > 0) {
        await batch.commit()
      }

      setSavedAt(new Date())
      setEditing(false)
      setDraftTypes({})
    } catch (e) {
      setSaveError(e?.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  function onTopRightClick() {
    if (!editing) return enterEdit()
    if (!dirty) return cancelEdit()
    return save()
  }

  const topRightLabel = useMemo(() => {
    if (!editing) return 'Edit'
    if (!dirty) return 'Cancel'
    return saving ? 'Saving…' : 'Save'
  }, [editing, dirty, saving])

  const topRightDisabled = useMemo(() => {
    if (!editing) return false
    if (!dirty) return false
    return saving
  }, [editing, dirty, saving])

  return (
    <>
      {profileLoading && (
        <div className="card">
          <div className="small">Loading…</div>
        </div>
      )}

      {!profileLoading && user && !isAdmin && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Not an Administrator</h2>
          <div className="small" style={{ marginTop: 8 }}>
            Sorry, but you’re not an Administrator.
          </div>
          <div style={{ marginTop: 14 }}>
            <button className="btn" onClick={() => nav('/dashboard')}>Back to dashboard</button>
          </div>
        </div>
      )}

      {!profileLoading && user && isAdmin && (
        <>
      <div className="panel">
        <h2 style={{ margin: 0 }}>Administrator Panel</h2>
        <div className="small" style={{ marginTop: 6 }}>
          Manage user account types.
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="small">Signed in as</div>
            <div style={{ fontWeight: 800, marginTop: 2 }}>{user?.email || '—'}</div>
            <div style={{ marginTop: 8 }} className={isAdmin ? 'notice success' : 'notice info'}>
              <b>Status:</b> {isAdmin ? 'Administrator' : 'Standard user'}
            </div>
          </div>

          <button className="btn small" onClick={onTopRightClick} disabled={topRightDisabled}>
            {topRightLabel}
          </button>
        </div>

        {loadError && (
          <div className="notice danger" style={{ marginTop: 12 }}>
            <b>Could not load users.</b>
            <div className="small" style={{ marginTop: 6, opacity: 0.9 }}>
              {loadError}
            </div>
            <div className="small" style={{ marginTop: 8, opacity: 0.9 }}>
              If you are the admin, set <code>isAdmin</code> = <code>true</code> in your own Firestore user document and make sure your Firestore rules allow admins to read <code>/users</code>.
            </div>
          </div>
        )}

        {saveError && (
          <div className="notice danger" style={{ marginTop: 12 }}>
            <b>Save failed.</b>
            <div className="small" style={{ marginTop: 6, opacity: 0.9 }}>{saveError}</div>
          </div>
        )}

        {savedAt && (
          <div className="notice success" style={{ marginTop: 12 }}>
            Saved at {savedAt.toLocaleTimeString()}
          </div>
        )}

        <div style={{ marginTop: 14, overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Email</th>
                <th style={{ width: 220 }}>Account type</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={2} className="small">Loading…</td>
                </tr>
              )}

              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan={2} className="small">No users found.</td>
                </tr>
              )}

              {!loading && users.map((u) => {
                const currentType = currentTypes[u.id]
                const value = editing ? (draftTypes[u.id] ?? currentType) : currentType

                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{u.email || '—'}</div>
                      <div className="small" style={{ opacity: 0.8 }}>{u.id}</div>
                    </td>

                    <td>
                      {!editing && (
                        <span className="pill">{currentType === 'admin' ? 'Administrator' : 'Standard'}</span>
                      )}

                      {editing && (
                        <select
                          className="input"
                          value={value}
                          onChange={(e) => setDraftTypes((d) => ({ ...d, [u.id]: e.target.value }))}
                          disabled={saving}
                        >
                          {ACCOUNT_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}
    </>
  )
}
