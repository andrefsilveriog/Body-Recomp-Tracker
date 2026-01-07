import {
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'

import { db } from '../firebase.js'
import { addDaysIso } from '../utils/date.js'

function isValidType(type) {
  return ['cut', 'bulk', 'maintain'].includes(type)
}

function normalizeCycles(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((c) => c && typeof c === 'object')
    .map((c) => ({
      id: String(c.id || ''),
      type: String(c.type || ''),
      startDateIso: c.startDateIso || '',
      endDateIso: c.endDateIso ?? null,
    }))
    .filter((c) => c.id && isValidType(c.type) && c.startDateIso)
}

function newId() {
  // deterministic enough for small personal use; avoids needing a subcollection
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/**
 * Cycles are stored inside the user's profile document (users/{uid}.cycles).
 * This avoids extra Firestore rules and prevents "Missing or insufficient permissions"
 * when rules only allow access to the user's profile + entries.
 */
export function listenCycles(userId, onData, onError) {
  const ref = doc(db, 'users', userId)
  return onSnapshot(
    ref,
    (snap) => {
      const data = snap.data() || {}
      onData(normalizeCycles(data.cycles))
    },
    onError
  )
}

export async function startCycle(userId, { type, startDateIso }) {
  if (!userId) throw new Error('Not authenticated')
  if (!isValidType(type)) throw new Error('Invalid cycle type')
  if (!startDateIso) throw new Error('Start date is required')

  const ref = doc(db, 'users', userId)

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('Profile not found. Please refresh and try again.')

    const data = snap.data() || {}
    const cycles = normalizeCycles(data.cycles)

    // End any active cycle (endDateIso === null) on the day before the new cycle begins.
    const updated = cycles.map((c) => ({ ...c }))
    const activeIdx = updated.findIndex((c) => c.endDateIso === null)
    if (activeIdx >= 0) {
      const active = updated[activeIdx]
      let endIso = addDaysIso(startDateIso, -1)
      if (active.startDateIso && endIso < active.startDateIso) endIso = active.startDateIso
      updated[activeIdx] = { ...active, endDateIso: endIso }
    }

    updated.push({
      id: newId(),
      type,
      startDateIso,
      endDateIso: null,
    })

    tx.update(ref, {
      cycles: updated,
      updatedAt: serverTimestamp(),
    })
  })
}

export async function endCycle(userId, cycleId, endDateIso) {
  if (!userId) throw new Error('Not authenticated')
  if (!cycleId) throw new Error('cycleId is required')
  if (!endDateIso) throw new Error('End date is required')

  const ref = doc(db, 'users', userId)

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('Profile not found. Please refresh and try again.')

    const data = snap.data() || {}
    const cycles = normalizeCycles(data.cycles)
    const idx = cycles.findIndex((c) => c.id === cycleId)
    if (idx < 0) throw new Error('Cycle not found.')

    const updated = cycles.map((c) => ({ ...c }))
    updated[idx] = { ...updated[idx], endDateIso }

    tx.update(ref, {
      cycles: updated,
      updatedAt: serverTimestamp(),
    })
  })
}
