import React, { useEffect, useMemo, useState } from 'react'
import './chartSetup.js'
import { Line } from 'react-chartjs-2'

function fmtDateShort(iso) {
  // iso: YYYY-MM-DD
  if (!iso || typeof iso !== 'string') return ''
  const p = iso.split('-')
  if (p.length !== 3) return iso
  return `${p[2]}/${p[1]}`
}

const STORAGE_KEY = 'brt_trendExplorer_v1'

const COLOR_POOL = [
  'rgba(125,211,252,0.95)', // sky
  'rgba(167,243,208,0.95)', // mint
  'rgba(251,191,36,0.95)',  // amber
  'rgba(196,181,253,0.95)', // violet
  'rgba(252,165,165,0.95)', // red
  'rgba(253,186,116,0.95)', // orange
  'rgba(147,197,253,0.95)', // blue
]

function defaultConfig() {
  return {
    preset: 'overlay_default',
    range: 'all',
    series: [
      { metricId: 'weight_wma', axis: 'left' },
      { metricId: 'avgStrength_wma', axis: 'left' },
      { metricId: 'calories_raw', axis: 'right' },
    ],
  }
}

function clampSeries(series) {
  const cleaned = (Array.isArray(series) ? series : []).filter(Boolean)
  return cleaned.slice(0, 6)
}

export default function TrendExplorerChart({ derived, weekly, liftNames }) {
  const safeLiftNames = (Array.isArray(liftNames) && liftNames.length === 3)
    ? liftNames
    : ['Bench Press', 'Squat', 'Deadlift']

  const [cfg, setCfg] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return defaultConfig()
      const parsed = JSON.parse(raw)
      return {
        ...defaultConfig(),
        ...parsed,
        series: clampSeries(parsed?.series || defaultConfig().series),
      }
    } catch {
      return defaultConfig()
    }
  })

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)) } catch {}
  }, [cfg])

  const rangeOptions = [
    { id: 'all', label: 'All data' },
    { id: '30', label: 'Last 30 days' },
    { id: '60', label: 'Last 60 days' },
    { id: '90', label: 'Last 90 days' },
  ]

  const derivedView = useMemo(() => {
    if (!Array.isArray(derived) || !derived.length) return []
    const r = String(cfg.range || 'all')
    const n = Number(r)
    if (Number.isFinite(n) && n > 0) return derived.slice(Math.max(0, derived.length - n))
    return derived
  }, [derived, cfg.range])

  const offset = useMemo(() => {
    if (!Array.isArray(derived) || !derived.length) return 0
    return Math.max(0, derived.length - derivedView.length)
  }, [derived, derivedView])

  const metricDefs = useMemo(() => {
    const lift1 = safeLiftNames[0]
    const lift2 = safeLiftNames[1]
    const lift3 = safeLiftNames[2]

    const daily = [
      // Weight
      {
        id: 'weight_raw',
        label: 'Weight (raw)',
        unit: 'kg',
        defaultAxis: 'left',
        get: (d) => d?.weight,
        style: { borderWidth: 1, pointRadius: 0, tension: 0.15, borderDash: [4, 4], opacity: 0.55 },
      },
      {
        id: 'weight_wma',
        label: 'Weight (smoothed)',
        unit: 'kg',
        defaultAxis: 'left',
        get: (d) => d?.wma?.weight,
        style: { borderWidth: 2, pointRadius: 0, tension: 0.25, opacity: 1 },
      },

      // Calories & macros
      {
        id: 'calories_raw',
        label: 'Calories (raw)',
        unit: 'kcal',
        defaultAxis: 'right',
        get: (d) => d?.calories,
        style: { borderWidth: 2, pointRadius: 0, tension: 0.15, opacity: 1 },
      },
      {
        id: 'protein',
        label: 'Protein',
        unit: 'g',
        defaultAxis: 'right',
        get: (d) => d?.protein,
        style: { borderWidth: 2, pointRadius: 0, tension: 0.15, opacity: 0.95 },
      },
      {
        id: 'carbs',
        label: 'Carbs',
        unit: 'g',
        defaultAxis: 'right',
        get: (d) => d?.carbs,
        style: { borderWidth: 2, pointRadius: 0, tension: 0.15, opacity: 0.95 },
      },
      {
        id: 'fats',
        label: 'Fats',
        unit: 'g',
        defaultAxis: 'right',
        get: (d) => d?.fats,
        style: { borderWidth: 2, pointRadius: 0, tension: 0.15, opacity: 0.95 },
      },

      // Strength (1RM values)
      {
        id: 'avgStrength_raw',
        label: 'Average strength (raw, ffilled)',
        unit: 'kg',
        defaultAxis: 'left',
        get: (d) => d?.avgStrength,
        style: { borderWidth: 1, pointRadius: 0, tension: 0.2, borderDash: [4, 4], opacity: 0.65 },
      },
      {
        id: 'avgStrength_wma',
        label: 'Average strength (smoothed)',
        unit: 'kg',
        defaultAxis: 'left',
        get: (d) => d?.wma?.avgStrength,
        style: { borderWidth: 2, pointRadius: 0, tension: 0.25, opacity: 1 },
      },
      {
        id: 'lift1_raw',
        label: `${lift1} (raw 1RM)`,
        unit: 'kg',
        defaultAxis: 'left',
        get: (d) => d?.bench,
        style: { borderWidth: 1, pointRadius: 0, tension: 0.2, borderDash: [4, 4], opacity: 0.65 },
      },
      {
        id: 'lift1_wma',
        label: `${lift1} (smoothed 1RM)`,
        unit: 'kg',
        defaultAxis: 'left',
        get: (d) => d?.wma?.bench,
        style: { borderWidth: 2, pointRadius: 0, tension: 0.25, opacity: 1 },
      },
      {
        id: 'lift2_raw',
        label: `${lift2} (raw 1RM)`,
        unit: 'kg',
        defaultAxis: 'left',
        get: (d) => d?.squat,
        style: { borderWidth: 1, pointRadius: 0, tension: 0.2, borderDash: [4, 4], opacity: 0.65 },
      },
      {
        id: 'lift2_wma',
        label: `${lift2} (smoothed 1RM)`,
        unit: 'kg',
        defaultAxis: 'left',
        get: (d) => d?.wma?.squat,
        style: { borderWidth: 2, pointRadius: 0, tension: 0.25, opacity: 1 },
      },
      {
        id: 'lift3_raw',
        label: `${lift3} (raw 1RM)`,
        unit: 'kg',
        defaultAxis: 'left',
        get: (d) => d?.deadlift,
        style: { borderWidth: 1, pointRadius: 0, tension: 0.2, borderDash: [4, 4], opacity: 0.65 },
      },
      {
        id: 'lift3_wma',
        label: `${lift3} (smoothed 1RM)`,
        unit: 'kg',
        defaultAxis: 'left',
        get: (d) => d?.wma?.deadlift,
        style: { borderWidth: 2, pointRadius: 0, tension: 0.25, opacity: 1 },
      },

      // Body composition
      {
        id: 'bfPct',
        label: 'Body fat % (Navy)',
        unit: '%',
        defaultAxis: 'left',
        get: (d) => d?.bfPct,
        style: { borderWidth: 2, pointRadius: 2, tension: 0.15, opacity: 0.95, spanGaps: true },
      },
      {
        id: 'lbm',
        label: 'Lean body mass (kg)',
        unit: 'kg',
        defaultAxis: 'left',
        get: (d) => d?.lbm,
        style: { borderWidth: 2, pointRadius: 0, tension: 0.2, opacity: 0.95, spanGaps: true },
      },
      {
        id: 'lbmPct',
        label: 'Lean mass %',
        unit: '%',
        defaultAxis: 'left',
        get: (d) => (Number.isFinite(d?.bfPct) ? (100 - d.bfPct) : null),
        style: { borderWidth: 2, pointRadius: 2, tension: 0.15, opacity: 0.9, spanGaps: true },
      },

      // Measurements (averaged if triple enabled)
      {
        id: 'waistCm',
        label: 'Waist (cm)',
        unit: 'cm',
        defaultAxis: 'right',
        get: (d) => d?.waistCm,
        style: { borderWidth: 2, pointRadius: 2, tension: 0.15, opacity: 0.9, spanGaps: true },
      },
      {
        id: 'neckCm',
        label: 'Neck (cm)',
        unit: 'cm',
        defaultAxis: 'right',
        get: (d) => d?.neckCm,
        style: { borderWidth: 2, pointRadius: 2, tension: 0.15, opacity: 0.9, spanGaps: true },
      },
      {
        id: 'hipCm',
        label: 'Hip (cm)',
        unit: 'cm',
        defaultAxis: 'right',
        get: (d) => d?.hipCm,
        style: { borderWidth: 2, pointRadius: 2, tension: 0.15, opacity: 0.9, spanGaps: true },
      },
    ]

    const weeklyDefs = [
      {
        id: 'tdee_weekly',
        label: 'TDEE (weekly)',
        unit: 'kcal',
        defaultAxis: 'right',
        weeklyKey: 'tdee',
        style: { borderWidth: 2, pointRadius: 0, tension: 0, opacity: 0.95, stepped: true },
      },
      {
        id: 'avgCalories_weekly',
        label: 'Avg calories (weekly)',
        unit: 'kcal',
        defaultAxis: 'right',
        weeklyKey: 'avgCalories',
        style: { borderWidth: 2, pointRadius: 0, tension: 0, opacity: 0.95, stepped: true },
      },
      {
        id: 'adaptationPct_weekly',
        label: 'Adaptation % (weekly)',
        unit: '%',
        defaultAxis: 'left',
        weeklyKey: 'adaptationPct',
        style: { borderWidth: 2, pointRadius: 0, tension: 0, opacity: 0.95, stepped: true },
      },
      {
        id: 'lossRatePct_weekly',
        label: 'Loss rate vs LBM % (weekly)',
        unit: '%',
        defaultAxis: 'left',
        weeklyKey: 'lossRatePct',
        style: { borderWidth: 2, pointRadius: 0, tension: 0, opacity: 0.95, stepped: true },
      },
    ]

    return {
      daily,
      weekly: weeklyDefs,
      byId: [...daily, ...weeklyDefs].reduce((acc, m) => {
        acc[m.id] = m
        return acc
      }, {}),
    }
  }, [safeLiftNames])

  const presets = useMemo(() => {
    const [l1, l2, l3] = safeLiftNames
    return [
      {
        id: 'overlay_default',
        label: 'Default: Weight/Strength vs Calories',
        series: [
          { metricId: 'weight_wma', axis: 'left' },
          { metricId: 'avgStrength_wma', axis: 'left' },
          { metricId: 'calories_raw', axis: 'right' },
        ],
      },
      {
        id: 'weight_trend',
        label: 'Weight trend (raw + smoothed)',
        series: [
          { metricId: 'weight_raw', axis: 'left' },
          { metricId: 'weight_wma', axis: 'left' },
        ],
      },
      {
        id: 'strength_trend',
        label: `Strength trend (${l1}, ${l2}, ${l3})`,
        series: [
          { metricId: 'lift1_wma', axis: 'left' },
          { metricId: 'lift2_wma', axis: 'left' },
          { metricId: 'lift3_wma', axis: 'left' },
        ],
      },
      {
        id: 'body_comp',
        label: 'Body composition (BF%, LBM, waist)',
        series: [
          { metricId: 'bfPct', axis: 'left' },
          { metricId: 'lbm', axis: 'left' },
          { metricId: 'waistCm', axis: 'right' },
        ],
      },
      {
        id: 'nutrition',
        label: 'Nutrition (calories + macros)',
        series: [
          { metricId: 'calories_raw', axis: 'right' },
          { metricId: 'protein', axis: 'right' },
          { metricId: 'carbs', axis: 'right' },
          { metricId: 'fats', axis: 'right' },
        ],
      },
      {
        id: 'weekly_efficiency',
        label: 'Weekly reality checks (TDEE + adaptation)',
        series: [
          { metricId: 'tdee_weekly', axis: 'right' },
          { metricId: 'adaptationPct_weekly', axis: 'left' },
          { metricId: 'avgCalories_weekly', axis: 'right' },
        ],
      },
      { id: 'custom', label: 'Custom', series: null },
    ]
  }, [safeLiftNames])

  function applyPreset(presetId) {
    const p = presets.find((x) => x.id === presetId)
    if (!p) return
    setCfg((prev) => ({
      ...prev,
      preset: presetId,
      series: clampSeries(p.series || prev.series),
    }))
  }

  function setSeriesAt(idx, patch) {
    setCfg((prev) => {
      const next = [...(prev.series || [])]
      next[idx] = { ...next[idx], ...patch }
      return { ...prev, preset: 'custom', series: clampSeries(next) }
    })
  }

  function removeSeries(idx) {
    setCfg((prev) => {
      const next = [...(prev.series || [])]
      next.splice(idx, 1)
      return { ...prev, preset: 'custom', series: clampSeries(next) }
    })
  }

  function addSeries() {
    setCfg((prev) => {
      const next = [...(prev.series || [])]
      if (next.length >= 6) return prev
      next.push({ metricId: 'weight_wma', axis: 'left' })
      return { ...prev, preset: 'custom', series: clampSeries(next) }
    })
  }

  function reset() {
    setCfg(defaultConfig())
  }

  const labels = useMemo(() => derivedView.map((d) => d.dateIso), [derivedView])

  const weeklyStepSeries = useMemo(() => {
    // Build step-series aligned to the FULL derived array so week boundaries match the weekly table.
    const out = {}
    const fullLen = Array.isArray(derived) ? derived.length : 0
    const weeks = weekly?.weeks || []
    if (!fullLen || !weeks.length) return out

    const fullWeeks = weeks.length
    for (const def of metricDefs.weekly) {
      const arr = new Array(fullLen).fill(null)
      for (let w = 1; w <= fullWeeks; w++) {
        const wk = weeks[w - 1]
        const val = wk?.[def.weeklyKey]
        const start = (w - 1) * 7
        const end = Math.min((w * 7) - 1, fullLen - 1)
        for (let i = start; i <= end; i++) {
          arr[i] = Number.isFinite(val) ? val : null
        }
      }
      out[def.id] = arr.slice(offset, offset + derivedView.length)
    }
    return out
  }, [weekly, derived, derivedView.length, offset, metricDefs.weekly])

  const datasets = useMemo(() => {
    const series = clampSeries(cfg.series)
    return series
      .map((s, idx) => {
        const def = metricDefs.byId[s.metricId]
        if (!def) return null

        const baseColor = COLOR_POOL[idx % COLOR_POOL.length]
        const style = def.style || {}
        const opacity = style.opacity ?? 1
        const borderColor = baseColor.replace(/\d?\.\d+\)/, `${opacity})`)

        const data = def.weeklyKey
          ? (weeklyStepSeries[def.id] || new Array(derivedView.length).fill(null))
          : derivedView.map((d) => {
            const v = def.get ? def.get(d) : null
            return Number.isFinite(v) ? v : null
          })

        const yAxisID = (s.axis || def.defaultAxis || 'left') === 'right' ? 'yRight' : 'yLeft'

        return {
          label: def.label,
          data,
          yAxisID,
          borderColor,
          borderWidth: style.borderWidth ?? 2,
          pointRadius: style.pointRadius ?? 0,
          tension: style.tension ?? 0.2,
          borderDash: style.borderDash,
          spanGaps: style.spanGaps ?? true,
          stepped: style.stepped,
        }
      })
      .filter(Boolean)
  }, [cfg.series, metricDefs.byId, derivedView, weeklyStepSeries, metricDefs.weekly])

  const data = useMemo(() => ({ labels, datasets }), [labels, datasets])

  const options = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#e6eefc' } },
        tooltip: {
          callbacks: {
            title: (items) => {
              const iso = items?.[0]?.label
              return iso ? fmtDateShort(iso) : ''
            },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: '#9bb0c9',
            maxTicksLimit: 10,
            callback: function (val, idx) {
              const iso = labels?.[idx]
              return fmtDateShort(iso)
            },
          },
          grid: { color: 'rgba(255,255,255,0.06)' },
        },
        yLeft: {
          position: 'left',
          ticks: { color: '#9bb0c9' },
          grid: { color: 'rgba(255,255,255,0.06)' },
          title: { display: true, text: 'Left axis', color: '#9bb0c9' },
        },
        yRight: {
          position: 'right',
          ticks: { color: '#9bb0c9' },
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'Right axis', color: '#9bb0c9' },
        },
      },
    }
  }, [labels])

  if (!derivedView.length) {
    return (
      <div className="chart card">
        <div className="card-title">Trend Explorer</div>
        <div className="muted" style={{ marginTop: 8 }}>No data yet.</div>
      </div>
    )
  }

  return (
    <div className="chart card" style={{ height: 420 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div className="card-title">Trend Explorer</div>
          <div className="small">One chart, many views. Mix raw and smoothed series to spot trend vs noise.</div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="input"
            value={cfg.preset}
            onChange={(e) => applyPreset(e.target.value)}
            style={{ height: 32, padding: '0 10px', maxWidth: 360 }}
            aria-label="Chart preset"
          >
            {presets.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>

          <select
            className="input"
            value={cfg.range}
            onChange={(e) => setCfg((prev) => ({ ...prev, range: e.target.value }))}
            style={{ height: 32, padding: '0 10px' }}
            aria-label="Range"
          >
            {rangeOptions.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>

          <button className="btn" type="button" onClick={addSeries} style={{ height: 32, padding: '0 10px', textTransform: 'none' }}>
            + Series
          </button>
          <button className="btn" type="button" onClick={reset} style={{ height: 32, padding: '0 10px', textTransform: 'none' }}>
            Reset
          </button>
        </div>
      </div>

      <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
        {(cfg.series || []).map((s, idx) => {
          const def = metricDefs.byId[s.metricId]
          const axis = s.axis || def?.defaultAxis || 'left'
          return (
            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ width: 10, height: 10, borderRadius: 999, background: COLOR_POOL[idx % COLOR_POOL.length] }} />

              <select
                className="input"
                value={s.metricId}
                onChange={(e) => {
                  const nextId = e.target.value
                  const nextDef = metricDefs.byId[nextId]
                  setSeriesAt(idx, { metricId: nextId, axis: nextDef?.defaultAxis || axis })
                }}
                style={{ height: 32, padding: '0 10px', minWidth: 260 }}
                aria-label={`Series ${idx + 1} metric`}
              >
                <optgroup label="Weight">
                  <option value="weight_raw">Weight (raw)</option>
                  <option value="weight_wma">Weight (smoothed)</option>
                </optgroup>

                <optgroup label="Calories & Macros">
                  <option value="calories_raw">Calories (raw)</option>
                  <option value="protein">Protein</option>
                  <option value="carbs">Carbs</option>
                  <option value="fats">Fats</option>
                </optgroup>

                <optgroup label="Strength (1RM)">
                  <option value="avgStrength_raw">Average strength (raw, ffilled)</option>
                  <option value="avgStrength_wma">Average strength (smoothed)</option>
                  <option value="lift1_raw">{safeLiftNames[0]} (raw 1RM)</option>
                  <option value="lift1_wma">{safeLiftNames[0]} (smoothed 1RM)</option>
                  <option value="lift2_raw">{safeLiftNames[1]} (raw 1RM)</option>
                  <option value="lift2_wma">{safeLiftNames[1]} (smoothed 1RM)</option>
                  <option value="lift3_raw">{safeLiftNames[2]} (raw 1RM)</option>
                  <option value="lift3_wma">{safeLiftNames[2]} (smoothed 1RM)</option>
                </optgroup>

                <optgroup label="Body composition">
                  <option value="bfPct">Body fat % (Navy)</option>
                  <option value="lbm">Lean body mass (kg)</option>
                  <option value="lbmPct">Lean mass %</option>
                </optgroup>

                <optgroup label="Measurements">
                  <option value="waistCm">Waist (cm)</option>
                  <option value="neckCm">Neck (cm)</option>
                  <option value="hipCm">Hip (cm)</option>
                </optgroup>

                <optgroup label="Weekly (7-day blocks)">
                  <option value="tdee_weekly">TDEE (weekly)</option>
                  <option value="avgCalories_weekly">Avg calories (weekly)</option>
                  <option value="adaptationPct_weekly">Adaptation % (weekly)</option>
                  <option value="lossRatePct_weekly">Loss rate vs LBM % (weekly)</option>
                </optgroup>
              </select>

              <select
                className="input"
                value={axis}
                onChange={(e) => setSeriesAt(idx, { axis: e.target.value })}
                style={{ height: 32, padding: '0 10px', width: 120 }}
                aria-label={`Series ${idx + 1} axis`}
              >
                <option value="left">Left axis</option>
                <option value="right">Right axis</option>
              </select>

              <div className="muted" style={{ fontSize: 12 }}>
                {def?.unit ? `Unit: ${def.unit}` : ''}
              </div>

              <button
                className="btn"
                type="button"
                onClick={() => removeSeries(idx)}
                style={{ height: 32, padding: '0 10px', textTransform: 'none' }}
                aria-label={`Remove series ${idx + 1}`}
              >
                Remove
              </button>
            </div>
          )
        })}
      </div>

      <div className="chart-inner" style={{ height: 240, marginTop: 10 }}>
        <Line data={data} options={options} />
      </div>
    </div>
  )
}
