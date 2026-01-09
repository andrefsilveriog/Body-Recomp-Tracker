import { useMemo } from 'react'
import { useProfile } from '../state/ProfileContext.jsx'
import { t as translate } from './i18n.js'

export function useT() {
  const { profile } = useProfile()
  const lang = profile?.language || 'en'
  const api = useMemo(() => ({
    lang,
    t: (key, vars) => translate(lang, key, vars),
  }), [lang])
  return api
}
