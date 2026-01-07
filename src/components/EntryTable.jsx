import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { UNSAFE_NavigationContext as NavigationContext } from 'react-router-dom'
import { batchPatchEntries, removeEntry } from '../services/entries.js'
import { oneRepMaxKg } from '../utils/calculations.js'

function usePrompt(when, message) {
  const nav = useContext(NavigationContext)
  const navigator = nav?.navigator

  // Block in-app navigation (links/routes)
  useEffect(() => {
    if (!when) return
    if (!navigator || typeof navigator.block !== 'function') return
    const unblock = navigator.block((tx) => {
      const ok = window.confirm(message)
      if (ok) {
        unblock()
        tx.retry()
      }
    })
    return unblock
  }, [navigator, when, message])

  // Warn on refresh/close
  useEffect(() => {
    if (!when) return
    const handler = (e) => {
      e.preventDefault()
      e.returnValue = message
      return message
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [when, message])
}

function toStr(v) {
  if (v === null || v === undefined) return ''
  return String(v)
}

function parseMaybeNumber(v) {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function cellKey(dateIso, key) {
  return `${dateIso}::${key}`
}

export default function EntryTable({ sex, userId, entries, tripleEnabled, liftNames }) {
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const [editMode, setEditMode] = useState(false)

  // Draft values are stored as strings so editing feels natural.
  const [draft, setDraft] = useState({}) // { [cellKey]: string }
  const [dirty, setDirty] = useState({}) // { [cellKey]: true }
  const [undoStack, setUndoStack] = useState([]) // [{ ck, prev, next }]
  const [redoStack, setRedoStack] = useState([])

  const focusStartRef = useRef({}) // { [cellKey]: string }

  const isFemale = String(sex || '').toLowerCase() === 'female'
  const ln = Array.isArray(liftNames) && liftNames.length === 3 ? liftNames : ['Bench Press', 'Squat', 'Deadlift']

  const baseByDate = useMemo(() => {
    const m = new Map()
    for (const e of entries || []) m.set(e.dateIso, e)
    return m
  }, [entries])

  // Clean up draft/dirty when entries change (e.g., deletion)
  useEffect(() => {
    const existing = new Set((entries || []).map((e) => e.dateIso))
    setDraft((prev) => {
      const next = { ...prev }
      let changed = false
      for (const ck of Object.keys(next)) {
        const [dateIso] = ck.split('::')
        if (!existing.has(dateIso)) {
          delete next[ck]
          changed = true
        }
      }
      return changed ? next : prev
    })
    setDirty((prev) => {
      const next = { ...prev }
      let changed = false
      for (const ck of Object.keys(next)) {
        const [dateIso] = ck.split('::')
        if (!existing.has(dateIso)) {
          delete next[ck]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [entries])

  const cols = useMemo(() => {
    const base = [
      { key: 'dateIso', label: 'Date', readOnly: true },
      { key: 'weight', label: 'Weight' },
      { key: 'protein', label: 'Protein' },
      { key: 'carbs', label: 'Carbs' },
      { key: 'fats', label: 'Fats' },
      { key: 'benchLoad', label: `${ln[0]} Load` },
      { key: 'benchReps', label: `${ln[0]} Reps` },
      { key: 'squatLoad', label: `${ln[1]} Load` },
      { key: 'squatReps', label: `${ln[1]} Reps` },
      { key: 'deadliftLoad', label: `${ln[2]} Load` },
      { key: 'deadliftReps', label: `${ln[2]} Reps` },
    ]

    if (!tripleEnabled) {
      base.push({ key: 'neck', label: 'Neck' }, { key: 'waist', label: 'Waist' })
      if (isFemale) base.push({ key: 'hip', label: 'Hip' })
    } else {
      base.push(
        { key: 'neck1', label: 'Neck1' }, { key: 'neck2', label: 'Neck2' }, { key: 'neck3', label: 'Neck3' },
        { key: 'waist1', label: 'Waist1' }, { key: 'waist2', label: 'Waist2' }, { key: 'waist3', label: 'Waist3' },
      )
      if (isFemale) {
        base.push(
          { key: 'hip1', label: 'Hip1' }, { key: 'hip2', label: 'Hip2' }, { key: 'hip3', label: 'Hip3' },
        )
      }
    }

    base.push({ key: '_actions', label: 'Actions', readOnly: true })
    return base
  }, [tripleEnabled, isFemale, ln])

  function baseValue(dateIso, key) {
    const row = baseByDate.get(dateIso)
    return toStr(row?.[key])
  }

  function displayValue(dateIso, key) {
    const ck = cellKey(dateIso, key)
    if (Object.prototype.hasOwnProperty.call(draft, ck)) return draft[ck]
    return baseValue(dateIso, key)
  }

  function setCellValue(dateIso, key, valueStr) {
    if (!editMode) return
    const ck = cellKey(dateIso, key)
    const base = baseValue(dateIso, key)

    setDraft((prev) => {
      const next = { ...prev }
      // If it matches base, we don't need to store a draft override.
      if (valueStr === base) {
        if (Object.prototype.hasOwnProperty.call(next, ck)) delete next[ck]
      } else {
        next[ck] = valueStr
      }
      return next
    })

    setDirty((prev) => {
      const next = { ...prev }
      if (valueStr === base) {
        if (Object.prototype.hasOwnProperty.call(next, ck)) delete next[ck]
      } else {
        next[ck] = true
      }
      return next
    })
  }

  function handleFocus(dateIso, key) {
    const ck = cellKey(dateIso, key)
    focusStartRef.current[ck] = displayValue(dateIso, key)
  }

  function handleBlur(dateIso, key) {
    const ck = cellKey(dateIso, key)
    const start = focusStartRef.current[ck]
    delete focusStartRef.current[ck]
    const end = displayValue(dateIso, key)

    // Only commit a history action if there was a real change for this focus session.
    if (start !== undefined && start !== end) {
      setUndoStack((prev) => [...prev, { ck, dateIso, key, prev: start, next: end }])
      setRedoStack([])
    }
  }

  function applyActionValue(action, valueStr) {
    // Apply without recording a new history action.
    setCellValue(action.dateIso, action.key, valueStr)
  }

  function undo() {
    if (!editMode) return
    setMsg(null)
    setUndoStack((prev) => {
      if (prev.length === 0) return prev
      const next = [...prev]
      const action = next.pop()
      applyActionValue(action, action.prev)
      setRedoStack((r) => [...r, action])
      return next
    })
  }

  function redo() {
    if (!editMode) return
    setMsg(null)
    setRedoStack((prev) => {
      if (prev.length === 0) return prev
      const next = [...prev]
      const action = next.pop()
      applyActionValue(action, action.next)
      setUndoStack((u) => [...u, action])
      return next
    })
  }

  function maybeOrm(load, reps) {
    const orm = oneRepMaxKg(load, reps)
    return Number.isFinite(orm) ? Math.round(orm * 10) / 10 : null
  }

  async function saveAll() {
    const dirtyKeys = Object.keys(dirty || {})
    if (dirtyKeys.length === 0) return
    setMsg(null)
    setSaving(true)
    try {
      const patchesByDate = {}

      for (const ck of dirtyKeys) {
        const [dateIso, key] = ck.split('::')
        const valueStr = displayValue(dateIso, key)
        const v = parseMaybeNumber(valueStr)
        if (!patchesByDate[dateIso]) patchesByDate[dateIso] = {}
        patchesByDate[dateIso][key] = v
      }

      // If load/reps changed, recompute and store 1RM into bench/squat/deadlift
      for (const dateIso of Object.keys(patchesByDate)) {
        const base = baseByDate.get(dateIso) || {}
        const patch = patchesByDate[dateIso]

        const hasBench = Object.prototype.hasOwnProperty.call(patch, 'benchLoad') || Object.prototype.hasOwnProperty.call(patch, 'benchReps')
        const hasSquat = Object.prototype.hasOwnProperty.call(patch, 'squatLoad') || Object.prototype.hasOwnProperty.call(patch, 'squatReps')
        const hasDead = Object.prototype.hasOwnProperty.call(patch, 'deadliftLoad') || Object.prototype.hasOwnProperty.call(patch, 'deadliftReps')

        if (hasBench) {
          const load = Object.prototype.hasOwnProperty.call(patch, 'benchLoad') ? patch.benchLoad : (base.benchLoad ?? null)
          const reps = Object.prototype.hasOwnProperty.call(patch, 'benchReps') ? patch.benchReps : (base.benchReps ?? null)
          patch.bench = maybeOrm(load, reps)
        }
        if (hasSquat) {
          const load = Object.prototype.hasOwnProperty.call(patch, 'squatLoad') ? patch.squatLoad : (base.squatLoad ?? null)
          const reps = Object.prototype.hasOwnProperty.call(patch, 'squatReps') ? patch.squatReps : (base.squatReps ?? null)
          patch.squat = maybeOrm(load, reps)
        }
        if (hasDead) {
          const load = Object.prototype.hasOwnProperty.call(patch, 'deadliftLoad') ? patch.deadliftLoad : (base.deadliftLoad ?? null)
          const reps = Object.prototype.hasOwnProperty.call(patch, 'deadliftReps') ? patch.deadliftReps : (base.deadliftReps ?? null)
          patch.deadlift = maybeOrm(load, reps)
        }
      }

      const patches = Object.keys(patchesByDate).map((dateIso) => ({ dateIso, patch: patchesByDate[dateIso] }))
      await batchPatchEntries(userId, patches)

      setDraft({})
      setDirty({})
      setUndoStack([])
      setRedoStack([])
      setMsg({ type: 'success', text: 'Saved changes.' })
      setEditMode(false)
    } catch (e) {
      setMsg({ type: 'error', text: e?.message || 'Failed to save changes.' })
    } finally {
      setSaving(false)
    }
  }

  async function deleteRow(dateIso) {
    if (!confirm(`Delete entry for ${dateIso}?`)) return
    setMsg(null)
    setSaving(true)
    try {
      await removeEntry(userId, dateIso)
      // Clear draft/dirty for this row
      setDraft((prev) => {
        const next = { ...prev }
        for (const k of Object.keys(next)) {
          if (k.startsWith(`${dateIso}::`)) delete next[k]
        }
        return next
      })
      setDirty((prev) => {
        const next = { ...prev }
        for (const k of Object.keys(next)) {
          if (k.startsWith(`${dateIso}::`)) delete next[k]
        }
        return next
      })
      setMsg({ type: 'success', text: 'Deleted.' })
    } catch (e) {
      setMsg({ type: 'error', text: e?.message || 'Failed to delete.' })
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = Object.keys(dirty || {}).length > 0

  usePrompt(editMode && hasChanges, 'You have unsaved changes. Leave without saving?')

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>All Entries</h2>
        <div className="table-actions">
          <button
            className="btn icon small"
            onClick={undo}
            disabled={!editMode || undoStack.length === 0 || saving}
            title="Undo"
            aria-label="Undo"
          >
            ↶
          </button>
          <button
            className="btn icon small"
            onClick={redo}
            disabled={!editMode || redoStack.length === 0 || saving}
            title="Redo"
            aria-label="Redo"
          >
            ↷
          </button>

          {!editMode ? (
            <button className="btn primary small" onClick={() => setEditMode(true)} disabled={saving}>
              Edit
            </button>
          ) : (
            <button className="btn primary small" onClick={saveAll} disabled={!hasChanges || saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div className={`notice ${msg.type === 'error' ? 'error' : 'success'}`} style={{ marginTop: 12 }}>
          {msg.text}
        </div>
      )}

      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table className="table">
          <thead>
            <tr>
              {cols.map((c) => <th key={c.key}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.dateIso}>
                {cols.map((c) => {
                  if (c.key === '_actions') {
                    return (
                      <td key={c.key}>
                        <button className="btn danger" onClick={() => deleteRow(e.dateIso)} disabled={saving}>Delete</button>
                      </td>
                    )
                  }
                  if (c.readOnly) return <td key={c.key}>{e[c.key]}</td>

                  return (
                    <td key={c.key}>
                      {!editMode ? (
                        <span>{displayValue(e.dateIso, c.key)}</span>
                      ) : (
                        <input
                          value={displayValue(e.dateIso, c.key)}
                          onChange={(ev) => setCellValue(e.dateIso, c.key, ev.target.value)}
                          onFocus={() => handleFocus(e.dateIso, c.key)}
                          onBlur={() => handleBlur(e.dateIso, c.key)}
                          inputMode="decimal"
                          disabled={saving}
                        />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
