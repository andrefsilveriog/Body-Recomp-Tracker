import React, { useMemo, useState } from 'react'
import { patchEntry, removeEntry } from '../services/entries.js'

function toStr(v) {
  if (v === null || v === undefined) return ''
  return String(v)
}

function parseMaybeNumber(v) {
  if (v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export default function EntryTable({ userId, entries, tripleEnabled }) {
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const cols = useMemo(() => {
    const base = [
      { key: 'dateIso', label: 'Date', readOnly: true },
      { key: 'weight', label: 'Weight' },
      { key: 'protein', label: 'Protein' },
      { key: 'carbs', label: 'Carbs' },
      { key: 'fats', label: 'Fats' },
      { key: 'benchLoad', label: 'Bench kg' },
      { key: 'benchReps', label: 'Bench reps' },
      { key: 'squatLoad', label: 'Squat kg' },
      { key: 'squatReps', label: 'Squat reps' },
      { key: 'deadliftLoad', label: 'Deadlift kg' },
      { key: 'deadliftReps', label: 'Deadlift reps' },
    ]

    if (!tripleEnabled) {
      base.push({ key: 'neck', label: 'Neck' }, { key: 'waist', label: 'Waist' }, { key: 'hip', label: 'Hip' })
    } else {
      base.push(
        { key: 'neck1', label: 'Neck1' }, { key: 'neck2', label: 'Neck2' }, { key: 'neck3', label: 'Neck3' },
        { key: 'waist1', label: 'Waist1' }, { key: 'waist2', label: 'Waist2' }, { key: 'waist3', label: 'Waist3' },
        { key: 'hip1', label: 'Hip1' }, { key: 'hip2', label: 'Hip2' }, { key: 'hip3', label: 'Hip3' },
      )
    }

    base.push({ key: '_actions', label: 'Actions', readOnly: true })
    return base
  }, [tripleEnabled])

  async function saveCell(dateIso, key, value) {
    if (key === 'dateIso' || key === '_actions') return
    setMsg(null)
    setSaving(true)
    try {
      await patchEntry(userId, dateIso, { [key]: parseMaybeNumber(value) })
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
