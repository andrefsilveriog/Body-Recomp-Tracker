import React, { useMemo } from 'react'
import { parseDateIso } from '../utils/date.js'

function fmt(n, d = 0) {
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(d)
}

function roundTo(x, step = 50) {
  if (!Number.isFinite(x)) return null
  return Math.round(x / step) * step
}

function daysBetween(aIso, bIso) {
  // a - b in whole days
  const a = parseDateIso(aIso).getTime()
  const b = parseDateIso(bIso).getTime()
  return Math.round((a - b) / (1000 * 60 * 60 * 24))
}

function avg(arr) {
  const nums = arr.map(Number).filter(Number.isFinite)
  if (!nums.length) return null
  return nums.reduce((s, x) => s + x, 0) / nums.length
}

function classForLevel(level) {
  if (level === 'good') return 'good'
  if (level === 'warn') return 'warn'
  if (level === 'bad') return 'bad'
  return 'info'
}

export default function InsightsBanner({ derived, weekly, profile, currentCycle }) {
  const insights = useMemo(() => {
    if (!derived?.length) return []
    const last = derived[derived.length - 1]
    const endIso = last.dateIso

    const week = weekly?.weeks?.length ? weekly.weeks[weekly.weeks.length - 1] : null
    const baselineTdee = weekly?.baselineTdee
    const baselineStrength = weekly?.baselineStrength
    const baselineWeeklyLoss = weekly?.baselineWeeklyLoss

    // rolling 7-day window (calendar days) for completeness + macros
    const window = derived.filter((d) => {
      const diff = daysBetween(endIso, d.dateIso)
      return diff >= 0 && diff <= 6
    })
    const daysLogged = window.length
    const avgProtein = avg(window.map((d) => d.protein))
    const avgCalories7 = avg(window.map((d) => d.calories))
    const currentWeight = Number.isFinite(last?.wma?.weight) ? last.wma.weight : last.weight

    const out = []

    // 1) Metabolic adaptation alert
    if (week && Number.isFinite(baselineTdee) && Number.isFinite(week.tdee) && Number.isFinite(week.adaptationPct)) {
      const dropPct = Math.max(0, -week.adaptationPct)
      let level = 'good'
      if (dropPct >= 10) level = 'bad'
      else if (dropPct >= 5) level = 'warn'

      const verb = week.adaptationPct < 0 ? 'dropped' : 'increased'
      const pctTxt = `${fmt(Math.abs(week.adaptationPct), 0)}%`
      out.push({
        key: 'adaptation',
        level,
        title: 'Metabolic adaptation',
        message: `Your TDEE has ${verb} ${pctTxt} from baseline (${fmt(baselineTdee, 0)} → ${fmt(week.tdee, 0)} kcal).`,
        action: (level !== 'good') ? 'Consider a refeed day or reducing training volume.' : null,
      })
    }

    // 2) Loss rate status (vs LBM)
    if (week && Number.isFinite(week.lossRatePct)) {
      const status = String(week.lossRateStatus || '').toUpperCase()
      let level = 'info'
      if (week.lossRateStatus === 'Optimal') level = 'good'
      if (week.lossRateStatus === 'Aggressive') level = 'bad'

      const extra = week.lossRateStatus === 'Aggressive'
        ? 'Risk of muscle loss.'
        : week.lossRateStatus === 'Conservative'
          ? 'Consider increasing deficit slightly.'
          : 'Optimal pace.'

      out.push({
        key: 'lossrate',
        level,
        title: 'Loss rate vs LBM',
        message: `This week: ${fmt(week.lossRatePct, 1)}% of LBM lost — ${status}. ${extra}`,
        action: null,
      })
    }

    // 3) Strength trend (week avg vs baseline)
    if (week && Number.isFinite(baselineStrength) && Number.isFinite(week.avgStrengthWma)) {
      const pct = ((week.avgStrengthWma - baselineStrength) / baselineStrength) * 100
      let level = 'good'
      let icon = '✓'
      let msg = 'Strength maintained/increasing.'
      let action = null
      if (pct < -7.5) {
        level = 'bad'
        icon = '⚠'
        msg = 'Strength declining significantly.'
        action = 'Consider eating more or reducing cardio.'
      } else if (pct < -5) {
        level = 'warn'
        icon = '⚠'
        msg = 'Strength declining.'
        action = 'Consider eating more or reducing cardio.'
      }
      out.push({
        key: 'strength',
        level,
        title: 'Strength trend',
        message: `${msg} ${icon} (${fmt(pct, 1)}% vs baseline)`,
        action,
      })
    }

    // 4) Weekly calorie recommendation (based on current TDEE + optimal loss rate range)
    if (week && Number.isFinite(week.tdee) && Number.isFinite(week.lbm)) {
      const lbm = week.lbm
      const lossKgMin = 0.005 * lbm
      const lossKgMax = 0.01 * lbm
      const dailyDefMin = (lossKgMin * 7700) / 7
      const dailyDefMax = (lossKgMax * 7700) / 7
      const calHigh = week.tdee - dailyDefMin
      const calLow = week.tdee - dailyDefMax
      const lo = roundTo(Math.min(calLow, calHigh), 50)
      const hi = roundTo(Math.max(calLow, calHigh), 50)
      out.push({
        key: 'calrec',
        level: 'info',
        title: 'Weekly calorie target',
        message: `To maintain an optimal loss rate, target about ${lo}-${hi} kcal/day this week.`,
        action: null,
      })
    }

    // 5) Data completeness (rolling 7 days)
    if (daysLogged < 6) {
      out.push({
        key: 'completeness',
        level: 'warn',
        title: 'Data completeness',
        message: `${daysLogged}/7 days logged this week — missing data may affect accuracy.`,
        action: null,
      })
    }

    // 6) Navy method reminder
    let lastMeasIso = null
    for (let i = derived.length - 1; i >= 0; i--) {
      if (Number.isFinite(derived[i]?.bfPct)) {
        lastMeasIso = derived[i].dateIso
        break
      }
    }
    if (!lastMeasIso) {
      out.push({
        key: 'navy',
        level: 'info',
        title: 'Navy method',
        message: 'No measurements logged yet — take your first set this week for BF% + LBM tracking.',
        action: null,
      })
    } else {
      const since = daysBetween(endIso, lastMeasIso)
      if (since >= 7) {
        out.push({
          key: 'navy',
          level: 'warn',
          title: 'Navy method',
          message: 'Take measurements this week (last set is 7+ days old).',
          action: null,
        })
      } else {
        out.push({
          key: 'navy',
          level: 'info',
          title: 'Navy method',
          message: `Next measurements due in ${7 - since} day(s).`,
          action: null,
        })
      }
    }

    // 7) Protein adequacy (rolling 7 days)
    if (Number.isFinite(avgProtein) && Number.isFinite(currentWeight)) {
      const minP = 1.6 * currentWeight
      const maxP = 2.2 * currentWeight
      if (avgProtein < minP) {
        const belowPct = ((minP - avgProtein) / minP) * 100
        out.push({
          key: 'protein',
          level: 'warn',
          title: 'Protein adequacy',
          message: `Your protein is ${fmt(belowPct, 0)}% below the muscle-retention range (${fmt(avgProtein, 0)}g/day vs ≥${fmt(minP, 0)}g/day).`,
          action: 'Aim for 1.6–2.2g/kg bodyweight/day to support muscle retention.',
        })
      } else if (avgProtein > maxP) {
        out.push({
          key: 'protein',
          level: 'good',
          title: 'Protein adequacy',
          message: `Protein is strong (${fmt(avgProtein, 0)}g/day).`,
          action: null,
        })
      } else {
        out.push({
          key: 'protein',
          level: 'good',
          title: 'Protein adequacy',
          message: `Protein is on target (${fmt(avgProtein, 0)}g/day).`,
          action: null,
        })
      }
    }

    // 8) Stall detection (this week vs baseline loss)
    if (week && Number.isFinite(baselineWeeklyLoss) && Number.isFinite(week.weightChange)) {
      const currentLoss = Math.max(0, -week.weightChange)
      const baselineLoss = baselineWeeklyLoss
      const stalled = (currentLoss < 0.2) || (baselineLoss > 0.2 && currentLoss < baselineLoss * 0.35)
      if (stalled) {
        out.push({
          key: 'stall',
          level: 'warn',
          title: 'Trend direction',
          message: `Weight loss may be stalling (${fmt(currentLoss, 1)}kg this week vs ${fmt(baselineLoss, 1)}kg baseline).`,
          action: 'Time to reduce calories by ~100–150/day (or add a small activity increase).',
        })
      }
    }

    // 9) Progress milestone (cycle target)
    const cycleTarget = Number(currentCycle?.targetWeightKg)
    if ((currentCycle?.type === 'cutting' || currentCycle?.type === 'bulking') && Number.isFinite(cycleTarget) && derived.length >= 2) {
      const startPoint = derived.find((d) => d.dateIso >= currentCycle.startDateIso) || derived[0]
      const startW = Number(startPoint?.weight)
      const currentWeight = Number(derived[derived.length - 1]?.weight)

      if (Number.isFinite(startW) && Number.isFinite(currentWeight)) {
        if (currentCycle.type === 'cutting' && startW > cycleTarget) {
          const lost = startW - currentWeight
          const totalToChange = startW - cycleTarget
          const pctToGoal = Math.max(0, Math.min(1, lost / totalToChange)) * 100
          if (lost >= 1) {
            out.push({
              level: 'good',
              title: 'Progress milestone',
              message: `${fmt(lost, 1)}kg down since cycle start — ${fmt(pctToGoal, 0)}% to target.`,
              action: null,
            })
          }
        }
        if (currentCycle.type === 'bulking' && startW < cycleTarget) {
          const gained = currentWeight - startW
          const totalToChange = cycleTarget - startW
          const pctToGoal = Math.max(0, Math.min(1, gained / totalToChange)) * 100
          if (gained >= 1) {
            out.push({
              level: 'good',
              title: 'Progress milestone',
              message: `${fmt(gained, 1)}kg up since cycle start — ${fmt(pctToGoal, 0)}% to target.`,
              action: null,
            })
          }
        }
      }
    }
      }
    }

    // If there is no weekly data yet, still show a small nudge
    if (!week) {
      out.unshift({
        key: 'needs14',
        level: 'info',
        title: 'Insights need trend data',
        message: 'Log at least 14 days to unlock weekly TDEE, adaptation, and loss-rate insights.',
        action: null,
      })
      if (Number.isFinite(avgCalories7)) {
        out.push({
          key: 'cal7',
          level: 'info',
          title: 'Last 7 days',
          message: `Average calories: ${fmt(avgCalories7, 0)} kcal/day.`,
          action: null,
        })
      }
    }

    return out
  }, [derived, weekly, profile])

  if (!insights.length) return null

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Insights</h2>
        <div className="muted">Short, actionable signals from your last 7 days + weekly trends.</div>
      </div>

      <div className="grid" style={{ marginTop: 12 }}>
        {insights.map((i) => (
          <div key={i.key} className={`card insight-card ${classForLevel(i.level)}`} style={{ gridColumn: 'span 6' }}>
            <div className="insight-title">{i.title}</div>
            <div style={{ marginTop: 6, lineHeight: 1.35 }}>{i.message}</div>
            {i.action && <div className="small" style={{ marginTop: 8 }}>{i.action}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}
