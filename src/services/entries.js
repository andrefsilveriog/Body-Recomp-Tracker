import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from '../firebase.js'
import { parseDateIso, sortByDateIsoAsc } from '../utils/date.js'

export function listenEntries(userId, onData, onError) {
  const colRef = collection(db, 'users', userId, 'entries')
  return onSnapshot(colRef, (snap) => {
    const entries = []
    snap.forEach((d) => {
      const data = d.data()
      entries.push({ id: d.id, ...data })
    })
    // Ensure dateIso exists, else derive from id
    const normalized = entries.map((e) => ({
      ...e,
      dateIso: e.dateIso || e.id,
    })).sort(sortByDateIsoAsc)

    onData(normalized)
  }, onError)
}

export async function upsertEntry(userId, entry) {
  const dateIso = entry.dateIso
  if (!dateIso) throw new Error('dateIso is required')

  const ref = doc(db, 'users', userId, 'entries', dateIso)

  const d = parseDateIso(dateIso)
  const payload = {
    ...entry,
    dateIso,
    date: entry.date || d, // Firestore will convert Date to Timestamp
    updatedAt: serverTimestamp(),
  }

  await setDoc(ref, payload, { merge: true })
}

export async function patchEntry(userId, dateIso, patch) {
  const ref = doc(db, 'users', userId, 'entries', dateIso)
  await updateDoc(ref, { ...patch, updatedAt: serverTimestamp() })
}

/**
 * Batch update multiple entries at once.
 * patches: Array<{ dateIso: string, patch: Record<string, any> }>
 */
export async function batchPatchEntries(userId, patches) {
  const batch = writeBatch(db)
  for (const p of patches || []) {
    const dateIso = p?.dateIso
    const patch = p?.patch
    if (!dateIso || !patch) continue
    const ref = doc(db, 'users', userId, 'entries', dateIso)
    batch.update(ref, { ...patch, updatedAt: serverTimestamp() })
  }
  await batch.commit()
}

export async function removeEntry(userId, dateIso) {
  const ref = doc(db, 'users', userId, 'entries', dateIso)
  await deleteDoc(ref)
}
