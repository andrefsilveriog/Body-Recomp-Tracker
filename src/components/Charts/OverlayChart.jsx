import React from 'react'
import './chartSetup.js'
import { Line } from 'react-chartjs-2'

export default function OverlayChart({ derived }) {
  const labels = derived.map((d) => d.dateIso)

  const weight = derived.map((d) => d.wma?.weight)
  const avgStrength = derived.map((d) => d.wma?.avgStrength)
  const calories = derived.map((d) => d.wma?.calories)

  const data = {
    labels,
    datasets: [
      {
        label: 'Weight (WMA)',
        data: weight,
        yAxisID: 'yLeft',
        borderColor: 'rgba(125,211,252,0.95)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.25,
      },
      {
        label: 'Avg Strength (WMA)',
        data: avgStrength,
        yAxisID: 'yLeft',
        borderColor: 'rgba(167,243,208,0.95)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.25,
      },
      {
        label: 'Calories (WMA)',
        data: calories,
        yAxisID: 'yRight',
        borderColor: 'rgba(251,191,36,0.95)',
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
    },
    scales: {
      x: { ticks: { color: '#9bb0c9', maxTicksLimit: 8 }, grid: { color: 'rgba(255,255,255,0.06)' } },
      yLeft: {
        position: 'left',
        ticks: { color: '#9bb0c9' },
        grid: { color: 'rgba(255,255,255,0.06)' },
        title: { display: true, text: 'kg (weight / strength)', color: '#9bb0c9' },
      },
      yRight: {
        position: 'right',
        ticks: { color: '#9bb0c9' },
        grid: { drawOnChartArea: false },
        title: { display: true, text: 'kcal', color: '#9bb0c9' },
      },
    },
  }

  return (
    <div className="chart card">
      <div className="card-title">Weight + Strength vs Calories (Smoothed)</div>
      <div className="chart-inner">
        <Line data={data} options={options} />
      </div>
    </div>
  )
}
