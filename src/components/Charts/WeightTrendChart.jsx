import React from 'react'
import './chartSetup.js'
import { Line } from 'react-chartjs-2'

export default function WeightTrendChart({ derived }) {
  const labels = derived.map((d) => d.dateIso)
  const raw = derived.map((d) => d.weight)
  const wma = derived.map((d) => d.wma?.weight)

  const data = {
    labels,
    datasets: [
      {
        label: 'Daily Weight (raw)',
        data: raw,
        borderColor: 'rgba(255,255,255,0.35)',
        borderWidth: 1,
        pointRadius: 0,
        tension: 0.25,
      },
      {
        label: 'Weight Trend (7-day WMA)',
        data: wma,
        borderColor: 'rgba(125,211,252,0.95)',
        borderWidth: 3,
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
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y?.toFixed?.(1)} kg`,
        },
      },
    },
    scales: {
      x: { ticks: { color: '#9bb0c9', maxTicksLimit: 8 }, grid: { color: 'rgba(255,255,255,0.06)' } },
      y: { ticks: { color: '#9bb0c9' }, grid: { color: 'rgba(255,255,255,0.06)' }, title: { display: true, text: 'kg', color: '#9bb0c9' } },
    },
  }

  return (
    <div className="chart card">
      <div className="card-title">Weight Trend (Raw vs Smoothed)</div>
      <div className="chart-inner">
        <Line data={data} options={options} />
      </div>
    </div>
  )
}
