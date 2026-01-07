import React, { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth'
import { useAuth } from '../state/AuthContext.jsx'
import { useProfile } from '../state/ProfileContext.jsx'
import { downloadCsv, buildCsvRows } from '../utils/csv.js'
import { buildDerivedSeries } from '../utils/calculations.js'
import { listenEntries } from '../services/entries.js'
import { startCycle, endCycle } from '../services/cycles.js'
import { todayIso } from '../utils/date.js'

const DEFAULT_LIFTS = ['Bench Press', 'Squat', 'Deadlift']

function titleCycle(type) {
  if (type === 'cut' || type === 'cutting') return 'Cutting'
  if (type === 'bulk' || type === 'bulking') return 'Bulking'
  if (type === 'maintain' || type === 'maintaining') return 'Maintaining'
  return String(type || '')
}


export default function Profile() {
  const { user } = useAuth()
  const loc = useLocation()
  const { profile, updateProfile, loading, profileError } = useProfile()

  const [sex, setSex] = useState(profile.sex || '')
  const [height, setHeight] = useState(profile.height || '')
  const [triple, setTriple] = useState(!!profile.triplemeasurements)

  const initialLiftNames = (Array.isArray(profile.liftNames) && profile.liftNames.length === 3)
    ? profile.liftNames
    : DEFAULT_LIFTS
  const [lift1, setLift1] = useState(initialLiftNames[0])
  const [lift2, setLift2] = useState(initialLiftNames[1])
  const [lift3, setLift3] = useState(initialLiftNames[2])

  const liftNames = useMemo(() => {
    const a = [lift1, lift2, lift3].map((s, i) => (String(s || '').trim() || DEFAULT_LIFTS[i]))
    return a
  }, [lift1, lift2, lift3])

  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  // password change
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [newPw2, setNewPw2] = useState('')

  // cycles
  const cycles = useMemo(() => {
    return Array.isArray(profile.cycles) ? [...profile.cycles].sort((a, b) => String(b.startDateIso||'').localeCompare(String(a.startDateIso||''))) : []
  }, [profile.cycles])
  const [cycleType, setCycleType] = useState('cutting')
  const [cycleStart, setCycleStart] = useState(todayIso())
  const [cycleTarget, setCycleTarget] = useState('')

  useEffect(() => {
    if (cycleType === 'maintaining') setCycleTarget('')
  }, [cycleType])

  const activeCycle = useMemo(() => {
    return cycles.find((c) => !c.endDateIso) || null
  }, [cycles])

  // For CSV export (load entries on demand)
  const [entries, setEntries] = useState([])
  const [loadedEntries, setLoadedEntries] = useState(false)

  useEffect(() => {
    setSex(profile.sex || '')
    setHeight(profile.height || '')
    setTriple(!!profile.triplemeasurements)

    const ln = (Array.isArray(profile.liftNames) && profile.liftNames.length === 3)
      ? profile.liftNames
      : DEFAULT_LIFTS
    setLift1(ln[0])
    setLift2(ln[1])
    setLift3(ln[2])
  }, [profile.sex, profile.height, profile.triplemeasurements, profile.liftNames])


  useEffect(() => {
    if (loc?.hash === '#cycles') {
      // allow render/layout
      setTimeout(() => {
        document.getElementById('cycles')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 50)
    }
  }, [loc?.hash])

  // cycles are stored inside the profile doc and auto-update via ProfileContext

  async function saveProfile(e) {
    e.preventDefault()
    setMsg(null)
    setBusy(true)

    try {
      const h = Number(height)
      if (!sex) throw new Error('Sex is required.')
      if (!Number.isFinite(h) || h <= 0) throw new Error('Height must be a positive number (cm).')

      await updateProfile({
        sex,
        height: h,
        triplemeasurements: !!triple,
        liftNames,
      })

      setMsg({ type: 'success', text: 'Profile saved.' })
    } catch (err) {
      setMsg({ type: 'error', text: err?.message || 'Failed to save profile.' })
    } finally {
      setBusy(false)
    }
  }

  async function onStartCycle(e) {
    e.preventDefault()
    setMsg(null)
    setBusy(true)
    try {
      if (!cycleType) throw new Error('Pick a cycle type.')
      if (!cycleStart) throw new Error('Pick a start date.')
      const data = await loadForExport()

      // Cycle target validation
      const latestWeight = [...(data || [])]
        .reverse()
        .find((e) => Number.isFinite(Number(e?.weight)))?.weight

      if (cycleType === 'cutting' || cycleType === 'bulking') {
        const tw = Number(cycleTarget)
        if (!Number.isFinite(tw) || tw <= 0) throw new Error('Enter a valid target weight (kg).')

        if (Number.isFinite(Number(latestWeight))) {
          if (cycleType === 'cutting' && tw >= Number(latestWeight)) {
            throw new Error('For a cutting cycle, target weight must be lower than your current weight.')
          }
          if (cycleType === 'bulking' && tw <= Number(latestWeight)) {
            throw new Error('For a bulking cycle, target weight must be higher than your current weight.')
          }
        }
      }

      const targetWeightKg = (cycleType === 'cutting' || cycleType === 'bulking') ? Number(cycleTarget) : null
      await startCycle(user.uid, { type: cycleType, startDateIso: cycleStart, targetWeightKg })
      setCycleTarget('')

      setMsg({ type: 'success', text: `Cycle started: ${titleCycle(cycleType)}.` })
    } catch (err) {
      setMsg({ type: 'error', text: err?.message || 'Failed to start cycle.' })
    } finally {
      setBusy(false)
    }
  }

  async function onEndCycle(cycleId) {
    setMsg(null)
    setBusy(true)
    try {
      await endCycle(user.uid, cycleId, todayIso())
      setMsg({ type: 'success', text: 'Cycle ended.' })
    } catch (err) {
      setMsg({ type: 'error', text: err?.message || 'Failed to end cycle.' })
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
      setCurrentPw('')
      setNewPw('')
      setNewPw2('')
      setMsg({ type: 'success', text: 'Password updated.' })
    } catch (err) {
      setMsg({ type: 'error', text: err?.message || 'Failed to update password.' })
    } finally {
      setBusy(false)
    }
  }

  async function loadForExport() {
    if (loadedEntries) return entries
    return new Promise((resolve, reject) => {
      const unsub = listenEntries(
        user.uid,
        (data) => {
          setEntries(data)
          setLoadedEntries(true)
          unsub()
          resolve(data)
        },
        (err) => {
          reject(err)
        }
      )
    })
  }

  async function exportCsv() {
    setMsg(null)
    setBusy(true)
    try {
      await loadForExport()
      const derived = buildDerivedSeries(entries, {
        ...profile,
        sex,
        height: Number(height),
        triplemeasurements: !!triple,
      })
      const rows = buildCsvRows({ entries, derived })
      const filename = `body-recomp-${user.uid}-${new Date().toISOString().slice(0, 10)}.csv`
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
              <label>Triple measurements mode</label>
              <select value={triple ? '1' : '0'} onChange={(e) => setTriple(e.target.value === '1')}>
                <option value="0">Off (single value per site)</option>
                <option value="1">On (up to 3 readings per site)</option>
              </select>
            </div>
          </div>

          <div className="grid" style={{ marginTop: 12 }}>
            <div className="field">
              <label>Lift 1 name</label>
              <input value={lift1} onChange={(e) => setLift1(e.target.value)} placeholder={DEFAULT_LIFTS[0]} />
            </div>
            <div className="field">
              <label>Lift 2 name</label>
              <input value={lift2} onChange={(e) => setLift2(e.target.value)} placeholder={DEFAULT_LIFTS[1]} />
            </div>
            <div className="field">
              <label>Lift 3 name</label>
              <input value={lift3} onChange={(e) => setLift3(e.target.value)} placeholder={DEFAULT_LIFTS[2]} />
            </div>
          </div>

          <div className="footer-actions">
            <button className="btn primary" disabled={busy || loading}>{busy ? 'Saving…' : 'Save profile'}</button>
            <button className="btn" type="button" onClick={exportCsv} disabled={busy}>Export CSV</button>
          </div>
        </form>
      </div>

      <div className="panel" id="cycles">
        <div className="panel-header">
          <h2>Cycles</h2>
          <div className="muted">Cutting / Bulking / Maintaining — track your phases over time.</div>
        </div>

        {/* cycles are stored in the profile doc; no extra Firestore rules needed */}

        <form onSubmit={onStartCycle} style={{ marginTop: 12 }}>
          <div className="row">
            <div className="field">
              <label>Cycle type</label>
              <select value={cycleType} onChange={(e) => setCycleType(e.target.value)}>
                <option value="cutting">Cutting</option>
                <option value="bulking">Bulking</option>
                <option value="maintaining">Maintaining</option>
              </select>
            </div>

            <div className="field">
              <label>Start date</label>
              <input type="date" value={cycleStart} onChange={(e) => setCycleStart(e.target.value)} />
            </div>

            {(cycleType === 'cutting' || cycleType === 'bulking') && (
              <div className="field">
                <label>Target weight (kg)</label>
                <input
                  inputMode="decimal"
                  value={cycleTarget}
                  onChange={(e) => setCycleTarget(e.target.value)}
                  placeholder="e.g. 82.0"
                />
              </div>
            )}

            <div className="field" style={{ minWidth: 220 }}>
              <label>Current</label>
              <input value={activeCycle ? `${titleCycle(activeCycle.type)} (since ${activeCycle.startDateIso})${(activeCycle.type === 'cutting' || activeCycle.type === 'bulking') && Number.isFinite(Number(activeCycle.targetWeightKg)) ? ` · target ${Number(activeCycle.targetWeightKg).toFixed(1)}kg` : ''}` : 'No active cycle'} readOnly />
            </div>
          </div>

          <div className="footer-actions">
            <button className="btn primary" disabled={busy}>{activeCycle ? 'Start new cycle (ends current)' : 'Start cycle'}</button>
            {activeCycle && (
              <button className="btn" type="button" onClick={() => onEndCycle(activeCycle.id)} disabled={busy}>
                End current cycle (today)
              </button>
            )}
          </div>
        </form>

        <hr className="sep" />

        <div className="table-wrap">
          <table className="table" style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <th>Type</th>
                <th>Target (kg)</th>
                <th>Began</th>
                <th>Ended</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {cycles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">No cycles yet. Start one above.</td>
                </tr>
              ) : (
                cycles.map((c) => {
                  const isActive = !c.endDateIso
                  return (
                    <tr key={c.id}>
                      <td><b>{titleCycle(c.type)}</b></td>
                      <td>{(c.type === 'cutting' || c.type === 'bulking') && Number.isFinite(Number(c.targetWeightKg)) ? Number(c.targetWeightKg).toFixed(1) : '—'}</td>
                      <td>{c.startDateIso || '—'}</td>
                      <td>{c.endDateIso || '—'}</td>
                      <td>
                        {isActive ? <span className="text-green strong">Active</span> : <span className="muted">Ended</span>}
                      </td>
                      <td>
                        {isActive ? (
                          <button className="btn" type="button" onClick={() => onEndCycle(c.id)} disabled={busy}>End today</button>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        
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
          </div>

          <div className="footer-actions">
            <button className="btn primary" disabled={busy}>Update password</button>
          </div>
        </form>
      </div>
    </>
  )
}