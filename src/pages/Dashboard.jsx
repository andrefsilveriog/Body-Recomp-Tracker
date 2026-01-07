import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'
import { useProfile } from '../state/ProfileContext.jsx'
import { listenEntries } from '../services/entries.js'
import { buildDerivedSeries, computeWeeklyAnalysis } from '../utils/calculations.js'
import { buildSampleEntries, buildSampleProfile } from '../utils/sampleData.js'
import { listenCycles } from '../services/cycles.js'
import { todayIso } from '../utils/date.js'

import WeightTrendChart from '../components/Charts/WeightTrendChart.jsx'
import StrengthChart from '../components/Charts/StrengthChart.jsx'
import OverlayChart from '../components/Charts/OverlayChart.jsx'
import WeeklyAnalysisTable from '../components/WeeklyAnalysisTable.jsx'
import InsightsBanner from '../components/InsightsBanner.jsx'

function titleCycle(type) {
  if (type === 'cut') return 'Cut'
  if (type === 'bulk') return 'Bulk'
  if (type === 'maintain') return 'Maintain'
  return String(type || '')
}

function fmt(n, d=1) {
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(d)
}

export default function Dashboard({ view = 'dashboard' }) {
  const nav = useNavigate()
  const { user } = useAuth()
  const { profile } = useProfile()
  const liftNames = (Array.isArray(profile?.liftNames) && profile.liftNames.length===3) ? profile.liftNames : ['Bench Press','Squat','Deadlift']
  const [entries, setEntries] = useState([])
  const [cycles, setCycles] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    setError(null)
    if (!user) return
    const unsub = listenEntries(user.uid, (data) => setEntries(data), (err) => setError(err?.message || 'Failed to load entries.'))
    return () => unsub()
  }, [user])

  // cycles
  useEffect(() => {
    if (!user) {
      setCycles([])
      return
    }
    const unsub = listenCycles(
      user.uid,
      (data) => setCycles(data),
      () => {}
    )
    return () => unsub()
  }, [user])

  const demoProfile = useMemo(() => buildSampleProfile(), [])
  const demoEntries = useMemo(() => buildSampleEntries(60), [])

  const demoCycles = useMemo(() => {
    if (!demoEntries?.length) return []
    return [{ id: 'demo', type: 'cut', startDateIso: demoEntries[0].dateIso, endDateIso: null }]
  }, [demoEntries])

  const activeProfile = user ? profile : demoProfile
  const activeEntries = user ? entries : demoEntries

  const activeCycles = user ? cycles : demoCycles

  const currentCycle = useMemo(() => {
    if (!activeCycles?.length) return null
    const t = todayIso()
    const explicitActive = activeCycles.find((c) => !c.endDateIso)
    if (explicitActive) return explicitActive
    const ranged = activeCycles.find((c) => (c.startDateIso || '') <= t && (c.endDateIso || '') >= t)
    return ranged || null
  }, [activeCycles])

  function onCycleClick() {
    if (!user) {
      nav('/signup')
      return
    }
    nav('/profile#cycles')
  }

  const derived = useMemo(() => {
    return buildDerivedSeries(activeEntries, activeProfile || {})
  }, [activeEntries, activeProfile])

  const weekly = useMemo(() => computeWeeklyAnalysis(derived), [derived])

  const summary = useMemo(() => {
    if (!derived.length) return null
    const first = derived[0]
    const last = derived[derived.length - 1]

    const weightTrend = last?.wma?.weight
    const totalLost = (Number.isFinite(first.weight) && Number.isFinite(last.weight)) ? (last.weight - first.weight) : null
    const calNow = last.calories
    const calStart = first.calories
    const calDelta = (Number.isFinite(calNow) && Number.isFinite(calStart)) ? (calNow - calStart) : null

    const strengthNow = last.avgStrength
    const strengthStart = first.avgStrength
    const strengthDelta = (Number.isFinite(strengthNow) && Number.isFinite(strengthStart)) ? (strengthNow - strengthStart) : null

    // most recent BF% in series (scan backwards)
    let bf = null
    for (let i = derived.length - 1; i >= 0; i--) {
      if (Number.isFinite(derived[i].bfPct)) { bf = derived[i].bfPct; break }
    }

    return {
      weightTrend,
      totalLost,
      calNow,
      calDelta,
      strengthNow,
      strengthDelta,
      bf
    }
  }, [derived])

  return (
    <>
      {!user && (
        <div className="notice info" style={{ marginTop: 14 }}>
          <b>Demo mode:</b> This dashboard is showing 60 days of realistic sample data. Log in to start tracking your own.
        </div>
      )}

      {user && (!activeProfile?.sex || !activeProfile?.height) && (
        <div className="notice error" style={{ marginTop: 14 }}>
          Your profile is incomplete. Go to <b>Profile</b> and set sex + height for accurate Navy BF% calculations.
        </div>
      )}

      {error && <div className="notice error" style={{ marginTop: 14 }}>{error}</div>}

      {view === 'insights' && (
        <InsightsBanner derived={derived} weekly={weekly} profile={activeProfile || {}} />
      )}

      <div className="panel">
        <div className="panel-header">
          <h2>Summary</h2>
          <button className="btn" type="button" onClick={onCycleClick}>
            {currentCycle ? titleCycle(currentCycle.type).toUpperCase() : 'CREATE NEW CYCLE'}
          </button>
        </div>

        {(!summary || !derived.length) ? (
          <div className="muted" style={{ marginTop: 10 }}>
            No data yet. Add your first entry in <b>Entry</b>.
          </div>
        ) : (
          <div className="grid" style={{ marginTop: 12 }}>
            <div className="card" style={{ gridColumn: 'span 4' }}>
              <div className="card-title">Current weight trend (WMA)</div>
              <div className="big">{fmt(summary.weightTrend, 1)} kg</div>
              <div className="small">Smoothed 7-day exponential</div>
            </div>

            <div className="card" style={{ gridColumn: 'span 4' }}>
              <div className="card-title">Total weight change</div>
              <div className="big">{fmt(summary.totalLost, 1)} kg</div>
              <div className="small">Negative = loss</div>
            </div>

            <div className="card" style={{ gridColumn: 'span 4' }}>
              <div className="card-title">Calories now / change from start</div>
              <div className="big">{fmt(summary.calNow, 0)} kcal</div>
              <div className="small">Δ {fmt(summary.calDelta, 0)} kcal</div>
            </div>

            <div className="card" style={{ gridColumn: 'span 4' }}>
              <div className="card-title">Average strength now</div>
              <div className="big">{fmt(summary.strengthNow, 1)} kg</div>
              <div className="small">Δ {fmt(summary.strengthDelta, 1)} kg</div>
            </div>

            <div className="card" style={{ gridColumn: 'span 4' }}>
              <div className="card-title">Estimated body fat (Navy)</div>
              <div className="big">{summary.bf === null ? '—' : `${fmt(summary.bf, 1)}%`}</div>
              <div className="small">Most recent measurement day</div>
            </div>

            <div className="card" style={{ gridColumn: 'span 4' }}>
              <div className="card-title">Baseline TDEE (first 2 weeks)</div>
              <div className="big">{Number.isFinite(weekly.baselineTdee) ? `${fmt(weekly.baselineTdee,0)} kcal` : '—'}</div>
              <div className="small">Computed from observed trends</div>
            </div>
          </div>
        )}
      </div>

      {derived.length > 0 && (
        <div className="grid" style={{ marginTop: 14 }}>
          <div style={{ gridColumn: 'span 12' }}>
            <WeightTrendChart derived={derived} />
          </div>
          <div style={{ gridColumn: 'span 12' }}>
            <StrengthChart derived={derived} liftNames={liftNames} />
          </div>
          <div style={{ gridColumn: 'span 12' }}>
            <OverlayChart derived={derived} />
          </div>
        </div>
      )}

      {derived.length >= 14 && (
        <WeeklyAnalysisTable weekly={weekly} />
      )}
    </>
  )
}
