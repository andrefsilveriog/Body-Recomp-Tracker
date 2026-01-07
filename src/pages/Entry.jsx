import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../state/AuthContext.jsx'
import { useProfile } from '../state/ProfileContext.jsx'
import { listenEntries, upsertEntry } from '../services/entries.js'
import EntryForm from '../components/EntryForm.jsx'
import EntryTable from '../components/EntryTable.jsx'

export default function Entry() {
  const { user } = useAuth()
  const { profile } = useProfile()

  const liftNames = (Array.isArray(profile?.liftNames) && profile.liftNames.length===3) ? profile.liftNames : ['Bench Press','Squat','Deadlift']

  const [entries, setEntries] = useState([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    if (!user) return
    const unsub = listenEntries(user.uid, (data) => setEntries(data), (err) => setMsg({ type: 'error', text: err?.message || 'Failed to load entries.' }))
    return () => unsub()
  }, [user])

  const tripleEnabled = useMemo(() => !!profile?.triplemeasurements, [profile?.triplemeasurements])
  const sex = (profile?.sex || 'male').toLowerCase()

  async function submitEntry(payload) {
    setMsg(null)
    setBusy(true)
    try {
      await upsertEntry(user.uid, payload)
      setMsg({ type: 'success', text: 'Entry saved.' })
    } catch (err) {
      setMsg({ type: 'error', text: err?.message || 'Failed to save entry.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {msg && (
        <div className={`notice ${msg.type === 'error' ? 'error' : 'success'}`} style={{ marginTop: 14 }}>
          {msg.text}
        </div>
      )}

      <EntryForm sex={sex} tripleEnabled={tripleEnabled} liftNames={liftNames} onSubmit={submitEntry} busy={busy} />

      <EntryTable sex={sex} userId={user.uid} entries={entries} tripleEnabled={tripleEnabled} liftNames={liftNames} />
    </>
  )
}
