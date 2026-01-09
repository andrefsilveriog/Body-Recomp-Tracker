import { useEffect, useMemo, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase.js'
import { useAuth } from '../state/AuthContext.jsx'
import { DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG } from '../config/dynamicStatusBannerDefault.js'
import { deepMerge } from '../utils/statusRuleEngine.js'

export function mergeDynamicStatusBannerConfig(remote) {
  // Remote config is deep-merged so missing fields fall back to defaults.
  if (!remote || typeof remote !== 'object') return DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG

  // Preferred Firestore shape: { value: {...config}, updatedAt, updatedBy }
  const value = (remote.value && typeof remote.value === 'object') ? remote.value : remote
  if (!value || typeof value !== 'object') return DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG

  // Ignore common metadata fields if they live alongside the config.
  const { updatedAt, updatedBy, value: _nested, ...rest } = value
  const configObj = (remote.value && typeof remote.value === 'object') ? value : rest

  return deepMerge(DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG, configObj)
}

export function useDynamicStatusBannerConfig() {
  const { user } = useAuth()
  const [remote, setRemote] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setRemote(null)
    setError(null)
    setLoading(false)
    if (!user) return

    const ref = doc(db, 'config', 'dynamicStatusBanner')
    setLoading(true)
    const unsub = onSnapshot(ref, (snap) => {
      setRemote(snap.exists() ? snap.data() : null)
      setLoading(false)
    }, (err) => {
      setError(err?.message || 'Failed to load banner config.')
      setLoading(false)
    })
    return () => unsub()
  }, [user])

  const config = useMemo(() => mergeDynamicStatusBannerConfig(remote), [remote])
  return { config, remote, loading, error }
}
