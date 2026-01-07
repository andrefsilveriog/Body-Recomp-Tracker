import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase.js'
import { useAuth } from './AuthContext.jsx'

const ProfileContext = createContext(null)

const DEFAULT_PROFILE = {
  email: '',
  sex: '',
  height: '',
  targetWeight: '',
  triplemeasurements: false,
  liftNames: ['Bench Press','Squat','Deadlift'],
  cycles: [],
  createdAt: null,
}

export function ProfileProvider({ children }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState(DEFAULT_PROFILE)
  const [loading, setLoading] = useState(false)
  const [profileError, setProfileError] = useState(null)

  useEffect(() => {
    setProfile(DEFAULT_PROFILE)
    setProfileError(null)
    if (!user) return

    const ref = doc(db, 'users', user.uid)
    setLoading(true)

    const unsub = onSnapshot(ref, async (snap) => {
      if (!snap.exists()) {
        // create user doc on first login
        await setDoc(ref, {
          email: user.email || '',
          sex: '',
          height: '',
          targetWeight: null,
          triplemeasurements: false,
          liftNames: ['Bench Press','Squat','Deadlift'],
          cycles: [],
          createdAt: serverTimestamp(),
        })
        return
      }
      const data = snap.data()
      setProfile({
        email: data.email || user.email || '',
        sex: data.sex || '',
        height: data.height || '',
        targetWeight: (data.targetWeight ?? ''),
        triplemeasurements: !!data.triplemeasurements,
        liftNames: (Array.isArray(data.liftNames) && data.liftNames.length===3) ? data.liftNames : ['Bench Press','Squat','Deadlift'],
        cycles: Array.isArray(data.cycles) ? data.cycles : [],
        createdAt: data.createdAt || null,
      })
      setLoading(false)
    }, (err) => {
      setProfileError(err?.message || 'Failed to load profile.')
      setLoading(false)
    })

    return () => unsub()
  }, [user])

  const api = useMemo(() => ({
    profile,
    loading,
    profileError,
    async updateProfile(patch) {
      if (!user) throw new Error('Not authenticated')
      setProfileError(null)
      const ref = doc(db, 'users', user.uid)
      await updateDoc(ref, patch)
    },
  }), [profile, loading, profileError, user])

  return <ProfileContext.Provider value={api}>{children}</ProfileContext.Provider>
}

export function useProfile() {
  return useContext(ProfileContext)
}
