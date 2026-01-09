import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, onSnapshot, orderBy, query, writeBatch, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase.js'
import { useAuth } from '../state/AuthContext.jsx'
import { useProfile } from '../state/ProfileContext.jsx'
import { DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG } from '../config/dynamicStatusBannerDefault.js'
import { deepMerge } from '../utils/statusRuleEngine.js'

function validateDynamicStatusConfig(cfg) {
  const errors = []
  if (!cfg || typeof cfg !== 'object') {
    return ['Config must be a JSON object.']
  }
  if (typeof cfg.version !== 'number') {
    errors.push('Missing or invalid: version (number).')
  }
  if (!cfg.thresholds || typeof cfg.thresholds !== 'object') {
    errors.push('Missing or invalid: thresholds (object).')
  }
  if (!Array.isArray(cfg.statusRules)) {
    errors.push('Missing or invalid: statusRules (array).')
  } else {
    const ids = new Set()
    cfg.statusRules.forEach((r, idx) => {
      if (!r || typeof r !== 'object') {
        errors.push(`statusRules[${idx}] must be an object.`)
        return
      }
      if (!r.id || typeof r.id !== 'string') errors.push(`statusRules[${idx}] missing id (string).`)
      if (r.id && ids.has(r.id)) errors.push(`Duplicate rule id: ${r.id}`)
      if (r.id) ids.add(r.id)
      if (!r.level || typeof r.level !== 'string') errors.push(`statusRules[${idx}] missing level (string).`)
      if (!r.title || typeof r.title !== 'string') errors.push(`statusRules[${idx}] missing title (string).`)
      if (!r.emoji || typeof r.emoji !== 'string') errors.push(`statusRules[${idx}] missing emoji (string).`)
      if (typeof r.priority !== 'number') errors.push(`statusRules[${idx}] missing priority (number).`)
      if (typeof r.when === 'undefined') errors.push(`statusRules[${idx}] missing when (expression).`)
      if (typeof r.message === 'undefined') errors.push(`statusRules[${idx}] missing message.`)
    })
  }
  return errors
}

const ACCOUNT_OPTIONS = [
  { value: 'user', label: 'Standard' },
  { value: 'admin', label: 'Administrator' },
]

function normalizeAccountType(u) {
  if (u?.accountType === 'admin') return 'admin'
  if (u?.isAdmin) return 'admin'
  return 'user'
}

function getPath(obj, path, fallback = undefined) {
  if (!obj) return fallback
  const parts = String(path).split('.')
  let cur = obj
  for (const p of parts) {
    if (cur == null) return fallback
    cur = cur[p]
  }
  return cur === undefined ? fallback : cur
}

function setPath(obj, path, value) {
  const parts = String(path).split('.')
  const out = Array.isArray(obj) ? obj.slice() : { ...(obj || {}) }
  let cur = out
  for (let i = 0; i < parts.length; i += 1) {
    const key = parts[i]
    if (i === parts.length - 1) {
      cur[key] = value
      break
    }
    const next = cur[key]
    cur[key] = Array.isArray(next) ? next.slice() : { ...(next || {}) }
    cur = cur[key]
  }
  return out
}

function fmtTimestamp(ts) {
  if (!ts) return '—'
  try {
    const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts)
    if (!d || Number.isNaN(d.getTime())) return '—'
    return d.toLocaleString()
  } catch {
    return '—'
  }
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

  // Global DynamicStatusBanner configuration (applies to all users)
  const [dsbDraft, setDsbDraft] = useState(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG)
  const [dsbText, setDsbText] = useState(() => JSON.stringify(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, null, 2))
  const [dsbDirty, setDsbDirty] = useState(false)
  const [dsbSaving, setDsbSaving] = useState(false)
  const [dsbSaveError, setDsbSaveError] = useState(null)
  const [dsbRemoteMeta, setDsbRemoteMeta] = useState(null)
  const [dsbRemoteValue, setDsbRemoteValue] = useState(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG)
  const [dsbParseError, setDsbParseError] = useState(null)
  const [dsbMode, setDsbMode] = useState('thresholds') // thresholds | json

  const dsbEffective = useMemo(() => deepMerge(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, dsbDraft || {}), [dsbDraft])
  const dsbValidationErrors = useMemo(() => validateDynamicStatusConfig(dsbEffective), [dsbEffective])

  function applyDraft(next, { markDirty } = { markDirty: true }) {
    setDsbDraft(next)
    setDsbText(JSON.stringify(next, null, 2))
    setDsbParseError(null)
    setDsbDirty(!!markDirty)
  }

  function updateNumber(path, raw) {
    // Empty = null (falls back to default via deepMerge)
    const val = raw === '' ? null : Number(raw)
    if (raw !== '' && !Number.isFinite(val)) return
    const next = setPath(dsbDraft, path, val)
    applyDraft(next, { markDirty: true })
  }

  function updateBool(path, checked) {
    const next = setPath(dsbDraft, path, !!checked)
    applyDraft(next, { markDirty: true })
  }

  function updateText(path, value) {
    const next = setPath(dsbDraft, path, value)
    applyDraft(next, { markDirty: true })
  }

  function updateRule(idx, patch) {
    const rules = Array.isArray(dsbDraft?.statusRules) ? dsbDraft.statusRules.slice() : []
    if (!rules[idx]) return
    rules[idx] = { ...rules[idx], ...patch }
    const next = { ...dsbDraft, statusRules: rules }
    applyDraft(next, { markDirty: true })
  }

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

  useEffect(() => {
    if (!user) return
    if (profileLoading) return
    if (!isAdmin) return

    const ref = doc(db, 'config', 'dynamicStatusBanner')
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.exists() ? (snap.data() || {}) : {}
        const nextValue = deepMerge(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, (data.value && typeof data.value === 'object') ? data.value : {})

        setDsbRemoteValue(nextValue)

        // Only auto-refresh editor content if the admin isn't actively editing.
        if (!dsbDirty) {
          setDsbDraft(nextValue)
          setDsbText(JSON.stringify(nextValue, null, 2))
          setDsbParseError(null)
          setDsbDirty(false)
        }

        setDsbRemoteMeta({
          updatedBy: data.updatedBy || null,
          updatedAt: data.updatedAt || null,
        })
      },
      (err) => {
        setDsbSaveError(err?.message || String(err))
      }
    )

    return () => unsub()
  }, [user, profileLoading, isAdmin, dsbDirty])

  const currentTypes = useMemo(() => {
    const map = {}
    users.forEach((u) => {
      map[u.id] = normalizeAccountType(u)
    })
    return map
  }, [users])

  const dirtyUsers = useMemo(() => {
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
        const nextIsAdmin = nextType === 'admin'
        batch.update(ref, { accountType: nextType, isAdmin: nextIsAdmin })
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
    if (!dirtyUsers) return cancelEdit()
    return save()
  }

  const topRightLabel = useMemo(() => {
    if (!editing) return 'Edit'
    if (!dirtyUsers) return 'Cancel'
    return saving ? 'Saving…' : 'Save'
  }, [editing, dirtyUsers, saving])

  const topRightDisabled = useMemo(() => {
    if (!editing) return false
    if (!dirtyUsers) return false
    return saving
  }, [editing, dirtyUsers, saving])

  async function publishDsb() {
    if (!user) return
    setDsbSaving(true)
    setDsbSaveError(null)

    try {
      const ref = doc(db, 'config', 'dynamicStatusBanner')
      await setDoc(ref, {
        value: dsbEffective,
        updatedAt: serverTimestamp(),
        updatedBy: user?.email || user?.uid || null,
      }, { merge: true })
      setDsbDirty(false)
    } catch (e) {
      setDsbSaveError(e?.message || String(e))
    } finally {
      setDsbSaving(false)
    }
  }

  function discardDsb() {
    applyDraft(dsbRemoteValue, { markDirty: false })
  }

  function resetDsb() {
    applyDraft(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, { markDirty: true })
  }

  function onJsonChange(val) {
    setDsbText(val)
    setDsbDirty(true)

    try {
      const parsed = JSON.parse(val)
      setDsbDraft(parsed)
      setDsbParseError(null)
    } catch (e) {
      setDsbParseError(e?.message || 'Invalid JSON')
    }
  }

  const canPublishDsb = isAdmin && !dsbSaving && !dsbParseError && dsbValidationErrors.length === 0 && dsbDirty

  const rulesSorted = useMemo(() => {
    const rules = Array.isArray(dsbDraft?.statusRules) ? dsbDraft.statusRules.slice() : []
    return rules
      .map((r, idx) => ({ ...r, _idx: idx }))
      .sort((a, b) => Number(a.priority ?? 9999) - Number(b.priority ?? 9999))
  }, [dsbDraft])

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
              Manage user account types and global configuration.
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
              <div className="notice error" style={{ marginTop: 12 }}>
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
              <div className="notice error" style={{ marginTop: 12 }}>
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

          {/* Dynamic Status Banner Config */}
          <div className="card" style={{ marginTop: 14 }}>
            <div className="panel-header" style={{ alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: 0 }}>Dynamic Status Banner</h2>
                <div className="small" style={{ marginTop: 6 }}>
                  Configure thresholds and rule logic for the banner (applies to all users, updates live).
                </div>
                <div className="small" style={{ marginTop: 6, opacity: 0.85 }}>
                  Last published: {fmtTimestamp(dsbRemoteMeta?.updatedAt)}{dsbRemoteMeta?.updatedBy ? ` by ${dsbRemoteMeta.updatedBy}` : ''}
                </div>
                {dsbDirty && (
                  <div className="small" style={{ marginTop: 6 }}>
                    <span className="pill">Unsaved changes</span>
                  </div>
                )}
              </div>

              <div className="row" style={{ marginTop: 2 }}>
                <button className={`btn small ${dsbMode === 'thresholds' ? 'primary' : ''}`} onClick={() => setDsbMode('thresholds')}>
                  Thresholds
                </button>
                <button className={`btn small ${dsbMode === 'json' ? 'primary' : ''}`} onClick={() => setDsbMode('json')}>
                  Advanced JSON
                </button>
              </div>
            </div>

            {dsbSaveError && (
              <div className="notice error" style={{ marginTop: 12 }}>
                <b>Banner config error.</b>
                <div className="small" style={{ marginTop: 6, opacity: 0.9 }}>{dsbSaveError}</div>
              </div>
            )}

            {dsbMode === 'thresholds' && (
              <>
                <hr className="sep" />

                <div className="row">
                  <div className="field">
                    <label>Min days for assessment</label>
                    <input
                      type="number"
                      step="1"
                      value={getPath(dsbDraft, 'thresholds.minDaysForAssessment', '') ?? ''}
                      placeholder={String(getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.minDaysForAssessment', 14))}
                      onChange={(e) => updateNumber('thresholds.minDaysForAssessment', e.target.value)}
                    />
                    <div className="small">Default: {getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.minDaysForAssessment', 14)}</div>
                  </div>

                  <div className="field">
                    <label>Min complete days this week</label>
                    <input
                      type="number"
                      step="1"
                      value={getPath(dsbDraft, 'thresholds.minCompleteDaysThisWeek', '') ?? ''}
                      placeholder={String(getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.minCompleteDaysThisWeek', 5))}
                      onChange={(e) => updateNumber('thresholds.minCompleteDaysThisWeek', e.target.value)}
                    />
                    <div className="small">Default: {getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.minCompleteDaysThisWeek', 5)}</div>
                  </div>

                  <div className="field">
                    <label>Show missing-signal notes</label>
                    <select
                      value={String(getPath(dsbDraft, 'global.missingSignalNotes', true))}
                      onChange={(e) => updateBool('global.missingSignalNotes', e.target.value === 'true')}
                    >
                      <option value="true">On</option>
                      <option value="false">Off</option>
                    </select>
                    <div className="small">Adds helper notes when BF/Strength data is missing.</div>
                  </div>

                  <div className="field">
                    <label>Goal notes effect</label>
                    <select
                      value={String(getPath(dsbDraft, 'global.goalNotes', true))}
                      onChange={(e) => updateBool('global.goalNotes', e.target.value === 'true')}
                    >
                      <option value="true">On</option>
                      <option value="false">Off</option>
                    </select>
                    <div className="small">Allows statuses to add the “distance to target” note.</div>
                  </div>

                  <div className="field">
                    <label>Cycle misalignment warnings</label>
                    <select
                      value={String(getPath(dsbDraft, 'global.cycleMisalignmentWarnings', true))}
                      onChange={(e) => updateBool('global.cycleMisalignmentWarnings', e.target.value === 'true')}
                    >
                      <option value="true">On</option>
                      <option value="false">Off</option>
                    </select>
                    <div className="small">Warns when cycle choice conflicts with trends.</div>
                  </div>
                </div>

                <hr className="sep" />

                <div className="small" style={{ marginBottom: 8, opacity: 0.9 }}><b>Trend thresholds</b></div>
                <div className="row">
                  <div className="field">
                    <label>Weight: stable kg/week</label>
                    <input
                      type="number"
                      step="0.01"
                      value={getPath(dsbDraft, 'thresholds.weight.stableKgPerWeek', '') ?? ''}
                      placeholder={String(getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.weight.stableKgPerWeek', 0.2))}
                      onChange={(e) => updateNumber('thresholds.weight.stableKgPerWeek', e.target.value)}
                    />
                    <div className="small">Default: {getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.weight.stableKgPerWeek', 0.2)}</div>
                  </div>

                  <div className="field">
                    <label>Weight: rapid kg/week</label>
                    <input
                      type="number"
                      step="0.01"
                      value={getPath(dsbDraft, 'thresholds.weight.rapidKgPerWeek', '') ?? ''}
                      placeholder={String(getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.weight.rapidKgPerWeek', 1.0))}
                      onChange={(e) => updateNumber('thresholds.weight.rapidKgPerWeek', e.target.value)}
                    />
                    <div className="small">Default: {getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.weight.rapidKgPerWeek', 1.0)}</div>
                  </div>

                  <div className="field">
                    <label>Body fat: stable pct points</label>
                    <input
                      type="number"
                      step="0.1"
                      value={getPath(dsbDraft, 'thresholds.bf.stablePctPoints', '') ?? ''}
                      placeholder={String(getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.bf.stablePctPoints', 0.5))}
                      onChange={(e) => updateNumber('thresholds.bf.stablePctPoints', e.target.value)}
                    />
                    <div className="small">Default: {getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.bf.stablePctPoints', 0.5)}</div>
                  </div>

                  <div className="field">
                    <label>Strength: stable %</label>
                    <input
                      type="number"
                      step="0.1"
                      value={getPath(dsbDraft, 'thresholds.strength.stablePct', '') ?? ''}
                      placeholder={String(getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.strength.stablePct', 2))}
                      onChange={(e) => updateNumber('thresholds.strength.stablePct', e.target.value)}
                    />
                    <div className="small">Default: {getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.strength.stablePct', 2)}</div>
                  </div>

                  <div className="field">
                    <label>Strength: increase %</label>
                    <input
                      type="number"
                      step="0.1"
                      value={getPath(dsbDraft, 'thresholds.strength.increasePct', '') ?? ''}
                      placeholder={String(getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.strength.increasePct', 2))}
                      onChange={(e) => updateNumber('thresholds.strength.increasePct', e.target.value)}
                    />
                    <div className="small">Default: {getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.strength.increasePct', 2)}</div>
                  </div>

                  <div className="field">
                    <label>Strength: decline %</label>
                    <input
                      type="number"
                      step="0.1"
                      value={getPath(dsbDraft, 'thresholds.strength.declinePct', '') ?? ''}
                      placeholder={String(getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.strength.declinePct', -2))}
                      onChange={(e) => updateNumber('thresholds.strength.declinePct', e.target.value)}
                    />
                    <div className="small">Default: {getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.strength.declinePct', -2)}</div>
                  </div>

                  <div className="field">
                    <label>Strength: rapid decline %</label>
                    <input
                      type="number"
                      step="0.1"
                      value={getPath(dsbDraft, 'thresholds.strength.rapidDeclinePct', '') ?? ''}
                      placeholder={String(getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.strength.rapidDeclinePct', -5))}
                      onChange={(e) => updateNumber('thresholds.strength.rapidDeclinePct', e.target.value)}
                    />
                    <div className="small">Default: {getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.strength.rapidDeclinePct', -5)}</div>
                  </div>
                </div>

                <hr className="sep" />

                <div className="small" style={{ marginBottom: 8, opacity: 0.9 }}><b>Nutrition / adaptation</b></div>
                <div className="row">
                  <div className="field">
                    <label>Protein: low (g/kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={getPath(dsbDraft, 'thresholds.proteinPerKg.low', '') ?? ''}
                      placeholder={String(getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.proteinPerKg.low', 1.2))}
                      onChange={(e) => updateNumber('thresholds.proteinPerKg.low', e.target.value)}
                    />
                    <div className="small">Default: {getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.proteinPerKg.low', 1.2)}</div>
                  </div>

                  <div className="field">
                    <label>Protein: low warn (g/kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={getPath(dsbDraft, 'thresholds.proteinPerKg.lowWarn', '') ?? ''}
                      placeholder={String(getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.proteinPerKg.lowWarn', 1.6))}
                      onChange={(e) => updateNumber('thresholds.proteinPerKg.lowWarn', e.target.value)}
                    />
                    <div className="small">Default: {getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.proteinPerKg.lowWarn', 1.6)}</div>
                  </div>

                  <div className="field">
                    <label>Adaptation: crash %</label>
                    <input
                      type="number"
                      step="0.1"
                      value={getPath(dsbDraft, 'thresholds.adaptation.crashPct', '') ?? ''}
                      placeholder={String(getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.adaptation.crashPct', -10))}
                      onChange={(e) => updateNumber('thresholds.adaptation.crashPct', e.target.value)}
                    />
                    <div className="small">Default: {getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.adaptation.crashPct', -10)}</div>
                  </div>

                  <div className="field">
                    <label>Adaptation: warn %</label>
                    <input
                      type="number"
                      step="0.1"
                      value={getPath(dsbDraft, 'thresholds.adaptation.warnPct', '') ?? ''}
                      placeholder={String(getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.adaptation.warnPct', -5))}
                      onChange={(e) => updateNumber('thresholds.adaptation.warnPct', e.target.value)}
                    />
                    <div className="small">Default: {getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.adaptation.warnPct', -5)}</div>
                  </div>

                  <div className="field">
                    <label>Water discrepancy kcal/week</label>
                    <input
                      type="number"
                      step="10"
                      value={getPath(dsbDraft, 'thresholds.waterDiscrepancyKcalPerWeek', '') ?? ''}
                      placeholder={String(getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.waterDiscrepancyKcalPerWeek', 2500))}
                      onChange={(e) => updateNumber('thresholds.waterDiscrepancyKcalPerWeek', e.target.value)}
                    />
                    <div className="small">Default: {getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.waterDiscrepancyKcalPerWeek', 2500)}</div>
                  </div>

                  <div className="field">
                    <label>Goal note min kg away</label>
                    <input
                      type="number"
                      step="0.1"
                      value={getPath(dsbDraft, 'thresholds.goalNoteMinKgAway', '') ?? ''}
                      placeholder={String(getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.goalNoteMinKgAway', 2))}
                      onChange={(e) => updateNumber('thresholds.goalNoteMinKgAway', e.target.value)}
                    />
                    <div className="small">Default: {getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.goalNoteMinKgAway', 2)}</div>
                  </div>
                </div>

                <hr className="sep" />


                <div className="small" style={{ marginBottom: 8, opacity: 0.9 }}><b>Recomposition heuristics</b></div>
                <div className="row">
                  <div className="field">
                    <label>LBM loss rate optimal min (%/week)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={getPath(dsbDraft, 'thresholds.lossRatePctLbmPerWeek.optimalMin', '') ?? ''}
                      placeholder={String(getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.lossRatePctLbmPerWeek.optimalMin', 0.5))}
                      onChange={(e) => updateNumber('thresholds.lossRatePctLbmPerWeek.optimalMin', e.target.value)}
                    />
                    <div className="small">Default: {String(getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.lossRatePctLbmPerWeek.optimalMin', 0.5))}</div>
                  </div>
                  <div className="field">
                    <label>LBM loss rate optimal max (%/week)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={getPath(dsbDraft, 'thresholds.lossRatePctLbmPerWeek.optimalMax', '') ?? ''}
                      placeholder={String(getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.lossRatePctLbmPerWeek.optimalMax', 1))}
                      onChange={(e) => updateNumber('thresholds.lossRatePctLbmPerWeek.optimalMax', e.target.value)}
                    />
                    <div className="small">Default: {String(getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.lossRatePctLbmPerWeek.optimalMax', 1))}</div>
                  </div>
                  <div className="field">
                    <label>LBM loss rate aggressive warn (%/week)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={getPath(dsbDraft, 'thresholds.lossRatePctLbmPerWeek.aggressiveWarn', '') ?? ''}
                      placeholder={String(getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.lossRatePctLbmPerWeek.aggressiveWarn', 1.2))}
                      onChange={(e) => updateNumber('thresholds.lossRatePctLbmPerWeek.aggressiveWarn', e.target.value)}
                    />
                    <div className="small">Default: {String(getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.lossRatePctLbmPerWeek.aggressiveWarn', 1.2))}</div>
                  </div>
                  <div className="field">
                    <label>Slow weekly weight loss (kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={getPath(dsbDraft, 'thresholds.slowWeeklyWeightLossKg', '') ?? ''}
                      placeholder={String(getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.slowWeeklyWeightLossKg', 0.15))}
                      onChange={(e) => updateNumber('thresholds.slowWeeklyWeightLossKg', e.target.value)}
                    />
                    <div className="small">Default: {String(getPath(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, 'thresholds.slowWeeklyWeightLossKg', 0.15))}</div>
                  </div>
                </div>

                <hr className="sep" />

                <div className="small" style={{ marginBottom: 8, opacity: 0.9 }}><b>Text templates</b></div>
                <div className="row">
                  <div className="field" style={{ flex: 1, minWidth: 280 }}>
                    <label>Cycle misalignment — Cutting</label>
                    <textarea
                      value={getPath(dsbDraft, 'strings.cycleMisalignment.cutting', '')}
                      onChange={(e) => updateText('strings.cycleMisalignment.cutting', e.target.value)}
                      rows={2}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div className="field" style={{ flex: 1, minWidth: 280 }}>
                    <label>Cycle misalignment — Bulking</label>
                    <textarea
                      value={getPath(dsbDraft, 'strings.cycleMisalignment.bulking', '')}
                      onChange={(e) => updateText('strings.cycleMisalignment.bulking', e.target.value)}
                      rows={2}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div className="field" style={{ flex: 1, minWidth: 280 }}>
                    <label>Cycle misalignment — Maintenance</label>
                    <textarea
                      value={getPath(dsbDraft, 'strings.cycleMisalignment.maintaining', '')}
                      onChange={(e) => updateText('strings.cycleMisalignment.maintaining', e.target.value)}
                      rows={2}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div className="row">
                  <div className="field" style={{ flex: 1, minWidth: 280 }}>
                    <label>Goal note — Lose</label>
                    <textarea
                      value={getPath(dsbDraft, 'strings.goalNotes.lose', '')}
                      onChange={(e) => updateText('strings.goalNotes.lose', e.target.value)}
                      rows={2}
                      style={{ width: '100%' }}
                    />
                    <div className="small">Placeholders: <code>{'{absToGoal:1}'}</code> <code>{'{targetWeight:1}'}</code></div>
                  </div>
                  <div className="field" style={{ flex: 1, minWidth: 280 }}>
                    <label>Goal note — Gain</label>
                    <textarea
                      value={getPath(dsbDraft, 'strings.goalNotes.gain', '')}
                      onChange={(e) => updateText('strings.goalNotes.gain', e.target.value)}
                      rows={2}
                      style={{ width: '100%' }}
                    />
                    <div className="small">Placeholders: <code>{'{absToGoal:1}'}</code> <code>{'{targetWeight:1}'}</code></div>
                  </div>
                </div>

<div className="small" style={{ marginBottom: 8, opacity: 0.9 }}><b>Status rules quick controls</b></div>
                <div className="small" style={{ opacity: 0.85, marginBottom: 10 }}>
                  For full rule logic (triggers, messages, templates), switch to <b>Advanced JSON</b>.
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ minWidth: 860 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 90 }}>Enabled</th>
                        <th style={{ width: 90 }}>Priority</th>
                        <th style={{ width: 90 }}>Emoji</th>
                        <th>Rule id</th>
                        <th style={{ width: 140 }}>Level</th>
                        <th>Title</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rulesSorted.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <select
                              value={String(r.enabled !== false)}
                              onChange={(e) => updateRule(r._idx, { enabled: e.target.value === 'true' })}
                            >
                              <option value="true">On</option>
                              <option value="false">Off</option>
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              step="1"
                              value={Number.isFinite(r.priority) ? r.priority : ''}
                              onChange={(e) => {
                                const v = e.target.value === '' ? null : Number(e.target.value)
                                if (e.target.value !== '' && !Number.isFinite(v)) return
                                updateRule(r._idx, { priority: v })
                              }}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={r.emoji || ''}
                              onChange={(e) => updateRule(r._idx, { emoji: e.target.value })}
                              style={{ width: 72 }}
                            />
                          </td>
                          <td><code>{r.id}</code></td>
                          <td>
                            <select
                              value={r.level || 'gray'}
                              onChange={(e) => updateRule(r._idx, { level: e.target.value })}
                            >
                              <option value="green">green</option>
                              <option value="blue">blue</option>
                              <option value="orange">orange</option>
                              <option value="red">red</option>
                              <option value="gray">gray</option>
                            </select>
                          </td>
                          <td>
                            <input
                              type="text"
                              value={r.title || ''}
                              onChange={(e) => updateRule(r._idx, { title: e.target.value })}
                              style={{ width: '100%' }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {dsbMode === 'json' && (
              <>
                <hr className="sep" />
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="small" style={{ opacity: 0.9 }}>
                    Paste/edit the full config JSON. Invalid JSON will disable publishing.
                  </div>
                  <div className="small" style={{ opacity: 0.9 }}>
                    Tip: publishing will normalize the config using built-in defaults (numeric <code>null</code> behaves like default).
                  </div>
                </div>

                <textarea
                  value={dsbText}
                  onChange={(e) => onJsonChange(e.target.value)}
                  spellCheck={false}
                  style={{
                    width: '100%',
                    minHeight: 420,
                    marginTop: 10,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    fontSize: 12,
                  }}
                />

                {dsbParseError && (
                  <div className="notice error" style={{ marginTop: 12 }}>
                    <b>Invalid JSON:</b> {dsbParseError}
                  </div>
                )}

                {!dsbParseError && dsbValidationErrors.length > 0 && (
                  <div className="notice error" style={{ marginTop: 12 }}>
                    <b>Validation errors:</b>
                    <ul style={{ marginTop: 8, marginBottom: 0 }}>
                      {dsbValidationErrors.slice(0, 10).map((e) => (
                        <li key={e} className="small">{e}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {!dsbParseError && dsbValidationErrors.length === 0 && (
                  <div className="notice success" style={{ marginTop: 12 }}>
                    JSON looks valid.
                  </div>
                )}
              </>
            )}

            <hr className="sep" />

            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="small" style={{ opacity: 0.9 }}>
                Effective version: <b>{getPath(dsbEffective, 'version', 1)}</b>
              </div>
              <div className="row">
                <button className="btn small" onClick={discardDsb} disabled={!dsbDirty || dsbSaving}>
                  Discard
                </button>
                <button className="btn small" onClick={resetDsb} disabled={dsbSaving}>
                  Reset to defaults
                </button>
                <button className="btn small primary" onClick={publishDsb} disabled={!canPublishDsb}>
                  {dsbSaving ? 'Publishing…' : 'Publish'}
                </button>
              </div>
            </div>

            {!dsbDirty && (
              <div className="small" style={{ marginTop: 10, opacity: 0.85 }}>
                No local changes.
              </div>
            )}

            {dsbDirty && !canPublishDsb && (
              <div className="small" style={{ marginTop: 10, opacity: 0.85 }}>
                Publishing is disabled until the config is valid and has unsaved changes.
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}
