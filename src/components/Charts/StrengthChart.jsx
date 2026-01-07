import React from 'react'
import './chartSetup.js'
import { Line } from 'react-chartjs-2'

export default function StrengthChart({ derived, liftNames }) {
  const ln = Array.isArray(liftNames) && liftNames.length === 3 ? liftNames : ['Bench Press','Squat','Deadlift']

  const labels = derived.map((d) => d.dateIso)
  const bench = derived.map((d) => d.wma?.bench)
  const squat = derived.map((d) => d.wma?.squat)
  const deadlift = derived.map((d) => d.wma?.deadlift)

  const data = {
    labels,
    datasets: [
      {
        label: `${ln[0]} (7-day WMA)`,
        data: bench,
        borderColor: 'rgba(167,243,208,0.95)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.25,
      },
      {
        label: `${ln[1]} (7-day WMA)`,
        data: squat,
        borderColor: 'rgba(251,191,36,0.9)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.25,
      },
      {
        label: `${ln[2]} (7-day WMA)`,
        data: deadlift,
        borderColor: 'rgba(147,197,253,0.95)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.25,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: '#e6eefc' } },
      tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y?.toFixed?.(1)} kg` } },
    },
    scales: {
      x: { ticks: { color: '#9bb0c9', maxTicksLimit: 8 }, grid: { color: 'rgba(255,255,255,0.06)' } },
      y: { ticks: { color: '#9bb0c9' }, grid: { color: 'rgba(255,255,255,0.06)' }, title: { display: true, text: 'kg', color: '#9bb0c9' } },
    },
  }

  return (
    <div className="chart card">
      <div className="card-title">Strength Progress (Smoothed)</div>
      <div className="chart-inner">
        <Line data={data} options={options} />
      </div>
    </div>
  )
}
