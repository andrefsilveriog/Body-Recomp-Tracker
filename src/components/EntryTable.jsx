import React, { useMemo, useState } from 'react'
import { patchEntry, removeEntry } from '../services/entries.js'
import { oneRepMaxKg } from '../utils/calculations.js'

function toStr(v) {
  if (v === null || v === undefined) return ''
  return String(v)
}

function parseMaybeNumber(v) {
  if (v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export default function EntryTable({ sex, userId, entries, tripleEnabled, liftNames }) {
  const [saving, setSaving] = useState(false)
  const isFemale = String(sex || '').toLowerCase() === 'female'
  const ln = Array.isArray(liftNames) && liftNames.length === 3 ? liftNames : ['Bench Press','Squat','Deadlift']
  const [msg, setMsg] = useState(null)

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
  }, [tripleEnabled, liftNames, sex])

  function getRow(dateIso) {
    return (entries || []).find((x) => x.dateIso === dateIso) || null
  }

  function maybeOrm(load, reps) {
    const orm = oneRepMaxKg(load, reps)
    return Number.isFinite(orm) ? Math.round(orm * 10) / 10 : null
  }

  async function saveCell(dateIso, key, value) {
    if (key === 'dateIso' || key === '_actions') return
    setMsg(null)
    setSaving(true)
    try {
      const v = parseMaybeNumber(value)
      const row = getRow(dateIso)

      // If a lift load/reps changes, also recompute and store its 1RM into the existing lift field
      // (bench/squat/deadlift) so charts/analysis remain unchanged.
      if (key === 'benchLoad' || key === 'benchReps') {
        const load = key === 'benchLoad' ? v : parseMaybeNumber(row?.benchLoad ?? '')
        const reps = key === 'benchReps' ? v : parseMaybeNumber(row?.benchReps ?? '')
        await patchEntry(userId, dateIso, { [key]: v, bench: maybeOrm(load, reps) })
      } else if (key === 'squatLoad' || key === 'squatReps') {
        const load = key === 'squatLoad' ? v : parseMaybeNumber(row?.squatLoad ?? '')
        const reps = key === 'squatReps' ? v : parseMaybeNumber(row?.squatReps ?? '')
        await patchEntry(userId, dateIso, { [key]: v, squat: maybeOrm(load, reps) })
      } else if (key === 'deadliftLoad' || key === 'deadliftReps') {
        const load = key === 'deadliftLoad' ? v : parseMaybeNumber(row?.deadliftLoad ?? '')
        const reps = key === 'deadliftReps' ? v : parseMaybeNumber(row?.deadliftReps ?? '')
        await patchEntry(userId, dateIso, { [key]: v, deadlift: maybeOrm(load, reps) })
      } else {
        await patchEntry(userId, dateIso, { [key]: v })
      }
      setMsg({ type: 'success', text: 'Saved.' })
    } catch (e) {
      setMsg({ type: 'error', text: e?.message || 'Failed to save.' })
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
      setMsg({ type: 'success', text: 'Deleted.' })
    } catch (e) {
      setMsg({ type: 'error', text: e?.message || 'Failed to delete.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>All Entries</h2>
        <div className="muted">Inline edit → blur to save. {saving ? 'Saving…' : ''}</div>
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
                        <button className="btn danger" onClick={() => deleteRow(e.dateIso)}>Delete</button>
                      </td>
                    )
                  }
                  if (c.readOnly) return <td key={c.key}>{e[c.key]}</td>

                  return (
                    <td key={c.key}>
                      <input
                        defaultValue={toStr(e[c.key])}
                        onBlur={(ev) => saveCell(e.dateIso, c.key, ev.target.value)}
                        inputMode="decimal"
                      />
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
