import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'

import { db } from '../firebase.js'
import { addDaysIso } from '../utils/date.js'

export function listenCycles(userId, onData, onError) {
  const colRef = collection(db, 'users', userId, 'cycles')
  const q = query(colRef, orderBy('startDateIso', 'desc'))

  return onSnapshot(
    q,
    (snap) => {
      const cycles = []
      snap.forEach((d) => {
        cycles.push({ id: d.id, ...d.data() })
      })
      onData(cycles)
    },
    onError
  )
}

/**
 * Start a new cycle. Optionally closes the currently active cycle (endDateIso === null)
 * on the day before the new start date (or the active start date if that would go earlier).
 */
export async function startCycle(userId, { type, startDateIso, activeCycle = null }) {
  if (!userId) throw new Error('Not authenticated')
  if (!type || !['cut', 'bulk', 'maintain'].includes(type)) throw new Error('Invalid cycle type')
  if (!startDateIso) throw new Error('startDateIso is required')

  const batch = writeBatch(db)

  if (activeCycle?.id) {
    // End the previous cycle the day before the new cycle starts (most natural non-overlap)
    let endIso = addDaysIso(startDateIso, -1)
    if (activeCycle.startDateIso && endIso < activeCycle.startDateIso) {
      endIso = activeCycle.startDateIso
    }
    const activeRef = doc(db, 'users', userId, 'cycles', activeCycle.id)
    batch.update(activeRef, {
      endDateIso: endIso,
      updatedAt: serverTimestamp(),
    })
  }

  const colRef = collection(db, 'users', userId, 'cycles')
  const newRef = doc(colRef) // auto-id
  batch.set(newRef, {
    type,
    startDateIso,
    endDateIso: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  await batch.commit()
}

export async function endCycle(userId, cycleId, endDateIso) {
  if (!userId) throw new Error('Not authenticated')
  if (!cycleId) throw new Error('cycleId is required')
  if (!endDateIso) throw new Error('endDateIso is required')

  const ref = doc(db, 'users', userId, 'cycles', cycleId)
  await updateDoc(ref, {
    endDateIso,
    updatedAt: serverTimestamp(),
  })
}
