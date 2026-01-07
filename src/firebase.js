import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getAnalytics, isSupported } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: "AIzaSyDtWe5NbdrjDIW1MOHApJ5i2k7_pBJEaeA",
  authDomain: "body-recomposition-tracker.firebaseapp.com",
  projectId: "body-recomposition-tracker",
  storageBucket: "body-recomposition-tracker.firebasestorage.app",
  messagingSenderId: "733446074102",
  appId: "1:733446074102:web:bdf0cc2e1b962ce7d506d7",
  measurementId: "G-EQ7E5CY3B0"
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

// Analytics is optional; guard it to avoid crashes in unsupported environments.
export async function initAnalytics() {
  try {
    const ok = await isSupported()
    if (ok) return getAnalytics(app)
  } catch {
    // ignore
  }
  return null
}
