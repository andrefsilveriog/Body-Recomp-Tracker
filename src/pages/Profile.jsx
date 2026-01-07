import React, { useEffect, useMemo, useState } from 'react'
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth'
import { useAuth } from '../state/AuthContext.jsx'
import { useProfile } from '../state/ProfileContext.jsx'
import { downloadCsv, buildCsvRows } from '../utils/csv.js'
import { buildDerivedSeries } from '../utils/calculations.js'
import { listenEntries } from '../services/entries.js'

export default function Profile() {
  const { user } = useAuth()
  const { profile, updateProfile, loading, profileError } = useProfile()

  const [sex, setSex] = useState(profile.sex || '')
  const [height, setHeight] = useState(profile.height || '')
  const [targetWeight, setTargetWeight] = useState(profile.targetWeight ?? '')
  const [triple, setTriple] = useState(!!profile.triplemeasurements)
  const [lift1, setLift1] = useState((profile.liftNames?.[0]) || 'Bench Press')
  const [lift2, setLift2] = useState((profile.liftNames?.[1]) || 'Squat')
  const [lift3, setLift3] = useState((profile.liftNames?.[2]) || 'Deadlift')

  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  // password change
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [newPw2, setNewPw2] = useState('')

  // For CSV export (load entries on demand)
  const [entries, setEntries] = useState([])
  const [loadedEntries, setLoadedEntries] = useState(false)

  React.useEffect(() => {
    setSex(profile.sex || '')
    setHeight(profile.height || '')
    setTargetWeight(profile.targetWeight ?? '')
    setTriple(!!profile.triplemeasurements)
  }, [profile.sex, profile.height, profile.targetWeight, profile.triplemeasurements])

  async function saveProfile(e) {
    e.preventDefault()
    setMsg(null)
    setBusy(true)
    try {
      const h = Number(height)
      if (!sex) throw new Error('Sex is required.')
      if (!Number.isFinite(h) || h <= 0) throw new Error('Height must be a positive number (cm).')

      let tw = null
      if (String(targetWeight).trim() !== '') {
        tw = Number(targetWeight)
        if (!Number.isFinite(tw) || tw <= 0) throw new Error('Target weight must be a positive number (kg).')
      }

      await updateProfile({
        sex,
        height: h,
        targetWeight: tw,
        triplemeasurements: !!triple,
      })
      setMsg({ type: 'success', text: 'Profile saved.' })
    } catch (err) {
      setMsg({ type: 'error', text: err?.message || 'Failed to save profile.' })
    } finally {
      setBusy(false)
    }
  }

  async function changePassword(e) {
    e.preventDefault()
    setMsg(null)
    if (!user?.email) return
    if (newPw !== newPw2) {
      setMsg({ type: 'error', text: 'New passwords do not match.' })
      return
    }
    setBusy(true)
    try {
      const cred = EmailAuthProvider.credential(user.email, currentPw)
      await reauthenticateWithCredential(user, cred)
      await updatePassword(user, newPw)
      setCurrentPw(''); setNewPw(''); setNewPw2('')
      setMsg({ type: 'success', text: 'Password updated.' })
    } catch (err) {
      setMsg({ type: 'error', text: err?.message || 'Failed to update password.' })
    } finally {
      setBusy(false)
    }
  }

  async function loadForExport() {
    if (loadedEntries) return
    return new Promise((resolve, reject) => {
      const unsub = listenEntries(user.uid, (data) => {
        setEntries(data)
        setLoadedEntries(true)
        unsub()
        resolve()
      }, (err) => {
        reject(err)
      })
    })
  }

  async function exportCsv() {
    setMsg(null)
    setBusy(true)
    try {
      await loadForExport()
      const derived = buildDerivedSeries(entries, { ...profile, sex, height: Number(height), triplemeasurements: !!triple })
      const rows = buildCsvRows({ entries, derived })
      const filename = `body-recomp-${user.uid}-${new Date().toISOString().slice(0,10)}.csv`
      downloadCsv(filename, rows)
      setMsg({ type: 'success', text: 'CSV downloaded.' })
    } catch (err) {
      setMsg({ type: 'error', text: err?.message || 'Failed to export CSV.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="panel">
        <div className="panel-header">
          <h2>Profile & Settings</h2>
          <div className="muted">{user?.email || ''}</div>
        </div>

        {profileError && <div className="notice error" style={{ marginTop: 12 }}>{profileError}</div>}
        {msg && <div className={`notice ${msg.type === 'error' ? 'error' : 'success'}`} style={{ marginTop: 12 }}>{msg.text}</div>}

        <form onSubmit={saveProfile} style={{ marginTop: 12 }}>
          <div className="row">
            <div className="field">
              <label>Sex (required for Navy BF%)</label>
              <select value={sex} onChange={(e) => setSex(e.target.value)} required>
                <option value="">Select…</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            <div className="field">
              <label>Height (cm)</label>
              <input inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="e.g. 175" required />
            </div>

            <div className="field">
              <label>Target weight (kg) (optional)</label>
              <input inputMode="numeric" value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)} placeholder="e.g. 82" />
            </div>

            <div className="field">
              <label>Triple measurements mode</label>
              <select value={triple ? '1' : '0'} onChange={(e) => setTriple(e.target.value === '1')}>
                <option value="0">Off (single value per site)</option>
                <option value="1">On (up to 3 readings per site)</option>
              </select>
            </div>
          <div className="grid" style={{ marginTop: 12 }}>
            <div className="field">
              <label>Lift 1 name</label>
              <input value={lift1} onChange={(e) => setLift1(e.target.value)} placeholder="Bench Press" />
            </div>
            <div className="field">
              <label>Lift 2 name</label>
              <input value={lift2} onChange={(e) => setLift2(e.target.value)} placeholder="Squat" />
            </div>
            <div className="field">
              <label>Lift 3 name</label>
              <input value={lift3} onChange={(e) => setLift3(e.target.value)} placeholder="Deadlift" />
            </div>
          </div>

          </div>

          <div className="footer-actions">
            <button className="btn primary" disabled={busy || loading}>{busy ? 'Saving…' : 'Save profile'}</button>
            <button className="btn" type="button" onClick={exportCsv} disabled={busy}>Export CSV</button>
          </div>
        </form>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>Change Password</h2>
          <div className="muted">Re-auth required.</div>
        </div>

        <form onSubmit={changePassword} style={{ marginTop: 12 }}>
          <div className="row">
            <div className="field">
              <label>Current password</label>
              <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} required />
            </div>
            <div className="field">
              <label>New password</label>
              <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required />
            </div>
            <div className="field">
              <label>Confirm new password</label>
              <input type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} required />
            </div>
          <div className="grid" style={{ marginTop: 12 }}>
            <div className="field">
              <label>Lift 1 name</label>
              <input value={lift1} onChange={(e) => setLift1(e.target.value)} placeholder="Bench Press" />
            </div>
            <div className="field">
              <label>Lift 2 name</label>
              <input value={lift2} onChange={(e) => setLift2(e.target.value)} placeholder="Squat" />
            </div>
            <div className="field">
              <label>Lift 3 name</label>
              <input value={lift3} onChange={(e) => setLift3(e.target.value)} placeholder="Deadlift" />
            </div>
          </div>

          </div>

          <div className="footer-actions">
            <button className="btn primary" disabled={busy}>Update password</button>
          </div>
        </form>
      </div>
    </>
  )
}
