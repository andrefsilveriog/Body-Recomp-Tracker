import React from 'react'

function fmt(n, d = 0) {
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(d)
}

function adaptationClass(pct) {
  if (!Number.isFinite(pct)) return ''
  if (pct < -10) return 'text-red'
  if (pct < -5) return 'text-orange'
  return ''
}

function lossRateClass(status) {
  if (status === 'Conservative') return 'text-blue'
  if (status === 'Optimal') return 'text-green strong'
  if (status === 'Aggressive') return 'text-red strong'
  return ''
}

export default function WeeklyAnalysisTable({ weekly }) {
  if (!weekly?.weeks?.length) return null

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Weekly Analysis</h2>
        <div className="muted">Appears once you have ≥14 days of data (2 full weeks).</div>
      </div>

      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Week #</th>
              <th>Avg Calories</th>
              <th>Weight Change (kg)</th>
              <th>Calculated TDEE</th>
              <th>TDEE Δ</th>
              <th>Adaptation %</th>
              <th>LBM (kg)</th>
              <th>Loss Rate vs LBM %</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {weekly.weeks.map((w) => (
              <tr key={w.week}>
                <td>{w.week}</td>
                <td>{fmt(w.avgCalories, 0)}</td>
                <td>{fmt(w.weightChange, 2)}</td>
                <td>{fmt(w.tdee, 0)}</td>
                <td>{fmt(w.tdeeChangeFromBaseline, 0)}</td>
                <td className={adaptationClass(w.adaptationPct)}>{fmt(w.adaptationPct, 1)}</td>
                <td>{fmt(w.lbm, 1)}</td>
                <td>{fmt(w.lossRatePct, 2)}</td>
                <td className={lossRateClass(w.lossRateStatus)}>{w.lossRateStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="notice info" style={{ marginTop: 12 }}>
        <div><b>How to read this:</b></div>
        <div className="small" style={{ marginTop: 6, lineHeight: 1.4 }}>
          <div><b>Calculated TDEE</b> is derived from observed weekly trend weight change: (Δkg × 7700) → daily deficit → daily deficit + avg calories.</div>
          <div><b>Metabolic adaptation</b> compares each week’s TDEE to your baseline (avg of first 2 weeks). Negative % indicates slowdown.</div>
          <div><b>Loss rate vs LBM</b> = weekly loss / current LBM. Target <b>0.5–1.0%</b> weekly for best muscle retention odds.</div>
        </div>
      </div>
    </div>
  )
}
