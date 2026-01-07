/* Core calculations (client-side only; nothing smoothed is stored) */

export const ALPHA_7DAY = 2 / (7 + 1) // 0.25

export function caloriesFromMacros({ protein, carbs, fats }) {
  const p = Number(protein ?? 0)
  const c = Number(carbs ?? 0)
  const f = Number(fats ?? 0)
  return (p * 4) + (c * 4) + (f * 9)
}

export function avgStrength({ bench, squat, deadlift }) {
  const b = Number(bench ?? 0)
  const s = Number(squat ?? 0)
  const d = Number(deadlift ?? 0)
  return (b + s + d) / 3
}

export function ewmaSeries(values, alpha = ALPHA_7DAY) {
  // values: array of numbers (or null). null breaks smoothing (returns null).
  const out = []
  let prev = null
  for (const v of values) {
    if (!Number.isFinite(v)) {
      out.push(null)
      continue
    }
    if (prev === null) {
      prev = v
      out.push(v)
      continue
    }
    const s = alpha * v + (1 - alpha) * prev
    prev = s
    out.push(s)
  }
  return out
}

function mean3(a, b, c) {
  const nums = [a, b, c].map((x) => Number(x)).filter((x) => Number.isFinite(x))
  if (!nums.length) return null
  return nums.reduce((s, x) => s + x, 0) / nums.length
}

export function siteAverage(entry, site, tripleEnabled) {
  if (!tripleEnabled) {
    const v = Number(entry?.[site])
    return Number.isFinite(v) ? v : null
  }
  const v1 = entry?.[`${site}1`]
  const v2 = entry?.[`${site}2`]
  const v3 = entry?.[`${site}3`]
  const m = mean3(v1, v2, v3)
  return Number.isFinite(m) ? m : null
}

export function bodyFatNavyPct({ sex, heightCm, entry, tripleEnabled }) {
  const h = Number(heightCm)
  if (!Number.isFinite(h) || h <= 0) return null
  const s = String(sex || '').toLowerCase()

  const neck = siteAverage(entry, 'neck', tripleEnabled)
  const waist = siteAverage(entry, 'waist', tripleEnabled)
  const hip = siteAverage(entry, 'hip', tripleEnabled)

  if (s === 'male') {
    if (!Number.isFinite(neck) || !Number.isFinite(waist)) return null
    const x = waist - neck
    if (!(x > 0)) return null
    const bf = 495 / (1.0324 - 0.19077 * Math.log10(x) + 0.15456 * Math.log10(h)) - 450
    return Number.isFinite(bf) ? bf : null
  }

  if (s === 'female') {
    if (!Number.isFinite(neck) || !Number.isFinite(waist) || !Number.isFinite(hip)) return null
    const x = waist + hip - neck
    if (!(x > 0)) return null
    const bf = 495 / (1.29579 - 0.35004 * Math.log10(x) + 0.22100 * Math.log10(h)) - 450
    return Number.isFinite(bf) ? bf : null
  }

  return null
}

export function leanBodyMassKg({ weightKg, bfPct }) {
  const w = Number(weightKg)
  const bf = Number(bfPct)
  if (!Number.isFinite(w) || !Number.isFinite(bf)) return null
  return w * (1 - (bf / 100))
}

export function buildDerivedSeries(entries, profile) {
  // entries: array sorted by dateIso ascending
  const triple = !!profile?.triplemeasurements
  const sex = profile?.sex || null
  const height = profile?.height || null

  const raw = entries.map((e) => ({
    dateIso: e.dateIso,
    weight: num(e.weight),
    protein: num(e.protein),
    carbs: num(e.carbs),
    fats: num(e.fats),
    bench: num(e.bench),
    squat: num(e.squat),
    deadlift: num(e.deadlift),
    calories: caloriesFromMacros(e),
    avgStrength: avgStrength(e),
    bfPct: bodyFatNavyPct({ sex, heightCm: height, entry: e, tripleEnabled: triple }),
  }))

  // LBM uses BF when available
  raw.forEach((r) => {
    r.lbm = leanBodyMassKg({ weightKg: r.weight, bfPct: r.bfPct })
  })

  const wma = {
    weight: ewmaSeries(raw.map((r) => r.weight)),
    bench: ewmaSeries(raw.map((r) => r.bench)),
    squat: ewmaSeries(raw.map((r) => r.squat)),
    deadlift: ewmaSeries(raw.map((r) => r.deadlift)),
    calories: ewmaSeries(raw.map((r) => r.calories)),
    avgStrength: ewmaSeries(raw.map((r) => r.avgStrength)),
  }

  return raw.map((r, i) => ({
    ...r,
    wma: {
      weight: wma.weight[i],
      bench: wma.bench[i],
      squat: wma.squat[i],
      deadlift: wma.deadlift[i],
      calories: wma.calories[i],
      avgStrength: wma.avgStrength[i],
    }
  }))
}

export function computeWeeklyAnalysis(derived) {
  // needs >= 14 days to show (2 full weeks)
  if (!derived || derived.length < 14) {
    return {
      weeks: [],
      baselineTdee: null,
      baselineStrength: null,
      baselineWeeklyLoss: null,
    }
  }

  const weeks = []
  const total = derived.length
  const fullWeeks = Math.floor(total / 7)
  const lastIndexForWeek = (w) => (w * 7) - 1

  // helper: get most recent BF/LBM up to an index
  function lastKnownLBM(idx) {
    for (let i = idx; i >= 0; i--) {
      const lbm = derived[i]?.lbm
      if (Number.isFinite(lbm)) return lbm
    }
    return null
  }

  for (let w = 1; w <= fullWeeks; w++) {
    const start = (w - 1) * 7
    const end = lastIndexForWeek(w)
    const slice = derived.slice(start, end + 1)

    const avgCalories = avg(slice.map((d) => d.calories))
    const avgStrengthWma = avg(slice.map((d) => d?.wma?.avgStrength))
    // Use smoothed weight to reduce noise in weekly deficit estimate
    const startW = slice[0]?.wma?.weight
    const endW = slice[slice.length - 1]?.wma?.weight
    const weightChange = (Number.isFinite(startW) && Number.isFinite(endW)) ? (endW - startW) : null

    let tdee = null
    if (Number.isFinite(avgCalories) && Number.isFinite(weightChange)) {
      const weeklyDeficit = (-weightChange) * 7700 // if weight down -> positive deficit
      const dailyDeficit = weeklyDeficit / 7
      tdee = avgCalories + dailyDeficit
    }

    const lbm = lastKnownLBM(end)
    let lossRatePct = null
    let lossRateStatus = '—'
    if (Number.isFinite(lbm) && Number.isFinite(weightChange)) {
      const weeklyLoss = Math.max(0, -weightChange)
      lossRatePct = (weeklyLoss / lbm) * 100
      if (lossRatePct < 0.5) lossRateStatus = 'Conservative'
      else if (lossRatePct <= 1.0) lossRateStatus = 'Optimal'
      else lossRateStatus = 'Aggressive'
    }

    weeks.push({
      week: w,
      avgCalories,
      weightChange,
      tdee,
      avgStrengthWma,
      lbm,
      lossRatePct,
      lossRateStatus,
      tdeeChangeFromBaseline: null,
      adaptationPct: null,
    })
  }

  // baseline = average of first 2 weeks' calculated TDEE
  const firstTwo = weeks.slice(0, 2).map((w) => w.tdee).filter(Number.isFinite)
  const baselineTdee = firstTwo.length ? avg(firstTwo) : null

  // strength baseline = average of first 2 weeks' avgStrengthWma
  const firstTwoStrength = weeks.slice(0, 2).map((w) => w.avgStrengthWma).filter(Number.isFinite)
  const baselineStrength = firstTwoStrength.length ? avg(firstTwoStrength) : null

  // weekly loss baseline (kg/week) based on first 2 weeks, using smoothed weight change
  const firstTwoLoss = weeks
    .slice(0, 2)
    .map((w) => (Number.isFinite(w.weightChange) ? Math.max(0, -w.weightChange) : null))
    .filter(Number.isFinite)
  const baselineWeeklyLoss = firstTwoLoss.length ? avg(firstTwoLoss) : null

  if (Number.isFinite(baselineTdee)) {
    for (const w of weeks) {
      if (!Number.isFinite(w.tdee)) continue
      w.tdeeChangeFromBaseline = w.tdee - baselineTdee
      w.adaptationPct = (w.tdeeChangeFromBaseline / baselineTdee) * 100
    }
  }

  return { weeks, baselineTdee, baselineStrength, baselineWeeklyLoss }
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function avg(arr) {
  const nums = arr.map(Number).filter(Number.isFinite)
  if (!nums.length) return null
  return nums.reduce((s, x) => s + x, 0) / nums.length
}
