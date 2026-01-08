import { parseDateIso, toDateIso } from './date.js'

/**
 * Demo data generator
 *
 * The app's weekly TDEE calculation is based on **actual intake** + **observed weekly weight change**.
 * If demo weight is generated independently from calories, calculated TDEE will swing wildly.
 *
 * This generator instead simulates:
 * - a baseline TDEE that adapts gradually
 * - daily intake (from macros)
 * - fat/lean changes from energy balance
 * - water-weight noise (mean-reverting)
 * so that weekly TDEE and adaptation look realistic.
 */

export const DEMO_SCENARIOS = [
  { id: 'cutting_optimal', label: 'Cutting (optimal)' },
  { id: 'cutting_aggressive', label: 'Cutting (aggressive / strength down)' },
  { id: 'recomp_maintain', label: 'Recomping (maintaining weight)' },
  { id: 'bulking_lean', label: 'Lean bulking' },
  { id: 'bulking_dirty', label: 'Dirty bulking' },
  { id: 'spinning_wheels', label: 'Spinning wheels (stall)' },
  { id: 'skinny_fat', label: 'Skinny-fat trajectory (bad cut)' },
  { id: 'detraining', label: 'Detraining (no stimulus)' },
  { id: 'metabolic_crash', label: 'Metabolic crash (slowdown)' },
]

// -----------------------
// Deterministic RNG
// -----------------------

function hashStringToSeed(str) {
  // small, deterministic 32-bit hash
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed) {
  let a = seed >>> 0
  return function rng() {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randn(rng) {
  // Box–Muller
  let u = 0, v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x))
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function round1(x) {
  return Math.round(x * 10) / 10
}

function round2(x) {
  return Math.round(x * 100) / 100
}

// -----------------------
// Navy Method helpers (male inversion for waist)
// -----------------------

function navyBfMale({ heightCm, waistCm, neckCm }) {
  const h = Number(heightCm)
  const w = Number(waistCm)
  const n = Number(neckCm)
  if (![h, w, n].every(Number.isFinite)) return null
  const x = w - n
  if (!(x > 0)) return null
  const bf = 495 / (1.0324 - 0.19077 * Math.log10(x) + 0.15456 * Math.log10(h)) - 450
  return Number.isFinite(bf) ? bf : null
}

function waistForBfMale({ targetBfPct, heightCm, neckCm }) {
  // binary search waist in [60, 140]
  let lo = 60
  let hi = 140
  let best = 90
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    const bf = navyBfMale({ heightCm, waistCm: mid, neckCm })
    if (!Number.isFinite(bf)) {
      hi = mid
      continue
    }
    best = mid
    if (bf > targetBfPct) {
      // too fat -> waist too big -> reduce
      hi = mid
    } else {
      lo = mid
    }
  }
  return best
}

// -----------------------
// Scenario configuration
// -----------------------

function scenarioConfig(id) {
  // defaults for a 175cm male demo user
  const base = {
    id,
    sex: 'male',
    heightCm: 175,
    neckCm: 40,
    baselineDays: 14,
    // physiology-ish starting point
    startWeightKg: 90,
    startBfPct: 24,
    startTdee: 2550,
    // lift 1RMs (stored values)
    start1rm: { bench: 120, squat: 170, deadlift: 220 },
  }

  const cfg = {
    cutting_optimal: {
      ...base,
      cycleType: 'cutting',
      targetWeightKg: 85,
      plan: {
        calTarget: () => 2050,
        proteinPerKg: () => 2.0,
        fatPerKg: () => 0.75,
        // slight strength gain even while cutting
        strengthSlope: () => 0.012,
        bfDeltaPerDay: () => -0.04,
        // No scheduled refeeds in the "optimal" demo (keeps weekly TDEE smoother)
        refeedEvery: 0,
        refeedDeltaCal: 0,
        trainingConsistency: 1,
      },
    },
    cutting_aggressive: {
      ...base,
      cycleType: 'cutting',
      targetWeightKg: 83,
      plan: {
        calTarget: () => 1650,
        rampDays: 14,
        proteinPerKg: () => 1.6,
        fatPerKg: () => 0.6,
        strengthSlope: () => -0.04,
        bfDeltaPerDay: () => -0.06,
        refeedEvery: 0,
        refeedDeltaCal: 0,
        trainingConsistency: 0.95,
      },
    },
    recomp_maintain: {
      ...base,
      cycleType: 'maintaining',
      targetWeightKg: null,
      plan: {
        calTarget: () => 2480,
        proteinPerKg: () => 2.1,
        fatPerKg: () => 0.8,
        strengthSlope: () => 0.02,
        bfDeltaPerDay: () => -0.03,
        refeedEvery: 0,
        refeedDeltaCal: 0,
        trainingConsistency: 1,
      },
    },
    bulking_lean: {
      ...base,
      cycleType: 'bulking',
      targetWeightKg: 93,
      plan: {
        calTarget: () => 2900,
        proteinPerKg: () => 2.0,
        fatPerKg: () => 0.9,
        strengthSlope: () => 0.035,
        bfDeltaPerDay: () => 0.005,
        refeedEvery: 0,
        refeedDeltaCal: 0,
        trainingConsistency: 1,
      },
    },
    bulking_dirty: {
      ...base,
      cycleType: 'bulking',
      targetWeightKg: 96,
      plan: {
        calTarget: () => 3350,
        proteinPerKg: () => 1.7,
        fatPerKg: () => 1.05,
        strengthSlope: () => 0.03,
        bfDeltaPerDay: () => 0.03,
        refeedEvery: 0,
        refeedDeltaCal: 0,
        trainingConsistency: 0.95,
      },
    },
    spinning_wheels: {
      ...base,
      cycleType: 'cutting', // intentionally misaligned: claims cutting, acts maintenance-ish
      targetWeightKg: 85,
      plan: {
        calTarget: () => 2450,
        proteinPerKg: () => 1.9,
        fatPerKg: () => 0.85,
        strengthSlope: () => 0.0,
        bfDeltaPerDay: () => 0.0,
        refeedEvery: 0,
        refeedDeltaCal: 0,
        trainingConsistency: 0.9,
      },
    },
    skinny_fat: {
      ...base,
      cycleType: 'cutting',
      targetWeightKg: 85,
      plan: {
        calTarget: () => 2050,
        proteinPerKg: () => 1.3,
        fatPerKg: () => 0.9,
        strengthSlope: () => -0.07,
        bfDeltaPerDay: () => 0.03,
        refeedEvery: 0,
        refeedDeltaCal: 0,
        trainingConsistency: 0.55,
      },
    },
    detraining: {
      ...base,
      cycleType: 'maintaining',
      targetWeightKg: null,
      plan: {
        calTarget: () => 2600,
        proteinPerKg: () => 1.6,
        fatPerKg: () => 0.9,
        strengthSlope: () => -0.10,
        bfDeltaPerDay: () => 0.02,
        refeedEvery: 0,
        refeedDeltaCal: 0,
        trainingConsistency: 0.25,
      },
    },
    metabolic_crash: {
      ...base,
      cycleType: 'cutting',
      targetWeightKg: 84,
      // aggressive deficit for a long time + strong adaptation, but still gradual
      plan: {
        calTarget: (dayInPhase) => {
          // add a short 10-day diet break mid-way
          if (dayInPhase > 24 && dayInPhase < 35) return 2450
          return 1750
        },
        proteinPerKg: () => 1.9,
        fatPerKg: () => 0.7,
        strengthSlope: () => -0.05,
        bfDeltaPerDay: (dayInPhase) => (dayInPhase > 24 && dayInPhase < 35 ? 0.0 : -0.05),
        refeedEvery: 0,
        refeedDeltaCal: 0,
        trainingConsistency: 0.85,
        // stronger adaptation multiplier handled below
        adaptationMultiplier: 1.8,
      },
    },
  }

  return cfg[id] || cfg.cutting_optimal
}

// -----------------------
// Public API
// -----------------------

export function buildSampleProfile(scenarioId = 'cutting_optimal') {
  const s = scenarioConfig(scenarioId)
  return {
    email: 'demo@example.com',
    sex: s.sex,
    height: s.heightCm,
    tripleMeasurements: false,
    createdAt: new Date().toISOString(),
    // lift labels shown in UI
    liftNames: ['Bench', 'Squat', 'Deadlift'],
  }
}

export function buildSampleCycles(entries, scenarioId = 'cutting_optimal') {
  const s = scenarioConfig(scenarioId)
  if (!entries?.length) return []
  const baselineDays = Math.min(s.baselineDays, entries.length)
  const startIso = entries[0].dateIso
  const baselineEndIso = entries[Math.max(0, baselineDays - 1)].dateIso
  const phaseStartIso = entries[Math.min(entries.length - 1, baselineDays)].dateIso
  const startWeightAtPhase = entries[Math.min(entries.length - 1, baselineDays)].weight

  const cycles = []
  cycles.push({
    id: 'demo-cycle-0',
    type: 'maintaining',
    startDateIso: startIso,
    endDateIso: baselineEndIso,
    targetWeightKg: null,
  })

  let target = s.targetWeightKg
  if (s.cycleType === 'cutting' && !Number.isFinite(target)) target = round1(startWeightAtPhase - 4)
  if (s.cycleType === 'bulking' && !Number.isFinite(target)) target = round1(startWeightAtPhase + 3)
  if (s.cycleType === 'maintaining') target = null

  cycles.push({
    id: 'demo-cycle-1',
    type: s.cycleType,
    startDateIso: phaseStartIso,
    endDateIso: null,
    targetWeightKg: target,
  })

  return cycles
}

export function buildSampleEntries(days = 84, scenarioId = 'cutting_optimal') {
  const s = scenarioConfig(scenarioId)
  const seed = hashStringToSeed(`brt-demo:${scenarioId}:${days}`)
  const rng = mulberry32(seed)

  const baselineDays = Math.min(s.baselineDays, Math.max(14, Math.floor(days / 2)))
  const phaseDays = Math.max(0, days - baselineDays)

  // Date range ending today
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - (days - 1))
  const startIso = toDateIso(startDate)

  // Weight + body fat state
  // IMPORTANT: keep weight change primarily driven by energy balance so the weekly TDEE
  // calculation (avg cals - 7700 * weekly weight delta) stays realistic.
  let trueWeightKg = s.startWeightKg
  let waterKg = 0
  let bfPct = s.startBfPct

  // TDEE state
  const baselineTdee = s.startTdee
  let adapt = 0 // relative fraction

  // Baseline stability helper.
  // During the initial maintenance block we add small day-to-day randomness.
  // Without a stabilizer, a deterministic random streak can create a large
  // surplus/deficit for a whole week and the app will infer a wrong baseline
  // TDEE (and then show huge "metabolic adaptation" swings). This gently
  // nudges baseline calories toward true maintenance while still allowing
  // realistic daily variation.
  let baselineCarryKcal = 0

  // Strength state (1RM)
  const base1rm = { ...s.start1rm }
  const last1rm = { ...s.start1rm }

  // Training template: 2x per lift / week
  const trainingByDow = [
    ['bench'],
    ['squat'],
    [],
    ['bench', 'deadlift'],
    ['squat'],
    ['deadlift'],
    [],
  ]

  function chooseTraining(dayIndex, trainingConsistency = 1) {
    const dow = dayIndex % 7
    const planned = trainingByDow[dow]
    if (!planned.length) return []
    // simulate missed sessions
    if (rng() > trainingConsistency) return []
    return planned
  }

  const entries = []

  // Stable refeed day offsets (precomputed so refeeds don't always land on the
  // same weekday / week boundary, which can distort weekly TDEE inference).
  const refeedOffsetByPlan = new Map()
  if (s.plan?.refeedEvery && s.plan.refeedEvery > 0) {
    refeedOffsetByPlan.set('phase', Math.floor(rng() * s.plan.refeedEvery))
  }

  for (let i = 0; i < days; i++) {
    const dateIso = toDateIso(new Date(parseDateIso(startIso).getTime() + i * 86400000))

    const inBaseline = i < baselineDays
    const dayInPhase = inBaseline ? 0 : i - baselineDays
    const plan = s.plan

    // Current bodyweight estimate (without today's measurement noise)
    const weightEstimate = trueWeightKg + waterKg

    // Calories/macros
    let baseCalTarget = inBaseline ? baselineTdee : plan.calTarget(dayInPhase)

    // Phase ramp: avoid a hard cliff from maintenance to deep deficit/surplus,
    // which otherwise makes the app infer a huge "metabolic adaptation" in the
    // first week purely from smoothing/lag.
    if (!inBaseline) {
      const rampDays = Math.max(0, plan.rampDays || 7)
      if (rampDays > 0 && dayInPhase < rampDays) {
        const t = rampDays === 1 ? 1 : clamp(dayInPhase / (rampDays - 1), 0, 1)
        baseCalTarget = lerp(baselineTdee, baseCalTarget, t)
      }
    }
    const refeedOffset = refeedOffsetByPlan.get('phase') || 0
    const refeed = !inBaseline && plan.refeedEvery && plan.refeedEvery > 0 && ((dayInPhase + refeedOffset) % plan.refeedEvery === 0)

    const calNoise = Math.round(randn(rng) * (inBaseline ? 15 : 60))
    let calTarget = baseCalTarget + (refeed ? plan.refeedDeltaCal : 0) + calNoise
    if (inBaseline) {
      // Gentle negative feedback so the baseline block stays close to maintenance.
      // Stronger correction early on so week 1 doesn't drift away from maintenance.
      calTarget -= clamp(baselineCarryKcal / 2.0, -240, 240)
    }

    const proteinPerKg = inBaseline ? 1.9 : plan.proteinPerKg(dayInPhase)
    const fatPerKg = inBaseline ? 0.85 : plan.fatPerKg(dayInPhase)

    const protein = Math.max(90, Math.round(weightEstimate * proteinPerKg + randn(rng) * 8))
    const fats = Math.max(40, Math.round(weightEstimate * fatPerKg + randn(rng) * 5))
    const remaining = calTarget - (protein * 4 + fats * 9)
    const carbs = Math.max(0, Math.round(remaining / 4))
    const calories = protein * 4 + carbs * 4 + fats * 9

    // Training / 1RM entries (not required daily)
    const trainingConsistency = inBaseline ? 1 : plan.trainingConsistency
    const trainedLifts = chooseTraining(i, trainingConsistency)

    // Strength trend applied over the *phase* (not baseline)
    const phaseProgress = phaseDays ? clamp(dayInPhase / Math.max(1, phaseDays - 1), 0, 1) : 0
    const strengthSlope = inBaseline ? 0.006 : plan.strengthSlope(dayInPhase)
    const strengthFactor = 1 + strengthSlope * phaseProgress

    const liftValues = { bench: null, squat: null, deadlift: null }
    for (const lift of ['bench', 'squat', 'deadlift']) {
      if (i === 0) {
        // seed first day so EWMA doesn't start with null
        liftValues[lift] = round1(base1rm[lift] + randn(rng) * 1.5)
        last1rm[lift] = liftValues[lift]
        continue
      }
      if (!trainedLifts.includes(lift)) continue
      const base = base1rm[lift] * strengthFactor
      const val = round1(base + randn(rng) * 2.0)
      liftValues[lift] = val
      last1rm[lift] = val
    }

    // Simulate TDEE and weight changes
    // Baseline: keep things calm so the app's inferred baseline TDEE doesn't drift.
    const tdeeNoise = inBaseline ? 0.0012 : 0.0025
    const tdeeToday = baselineTdee * (1 + (inBaseline ? 0 : adapt)) * (1 + randn(rng) * tdeeNoise)
    const energyBalance = calories - tdeeToday // positive = surplus

    if (inBaseline) {
      baselineCarryKcal = baselineCarryKcal * 0.55 + energyBalance
      baselineCarryKcal = clamp(baselineCarryKcal, -700, 700)
    }

    // Scale weight responds to energy balance (simple 7700 kcal/kg model)
    trueWeightKg += energyBalance / 7700
    trueWeightKg = clamp(trueWeightKg, 55, 140)

    // Water-weight (demo): short-lived carb/glycogen swings.
    // Important: do NOT let water drift strongly negative/positive for days in a row,
    // otherwise weekly TDEE inference becomes chaotic.
    const decay = inBaseline ? 0.50 : 0.55
    const refeedEffect = refeed ? 0.35 : 0
    // Keep baseline weeks "clean": water effects in baseline distort the inferred baseline TDEE.
    const highCarbEffect = !inBaseline && carbs >= 350 ? 0.14 : 0
    const lowCarbEffect = !inBaseline && carbs < 120 ? -0.12 : 0
    const waterNoise = inBaseline ? 0.02 : 0.04
    const waterMin = inBaseline ? -0.35 : -0.9
    const waterMax = inBaseline ? 0.35 : 1.6
    waterKg = waterKg * decay + refeedEffect + highCarbEffect + lowCarbEffect + randn(rng) * waterNoise
    waterKg = clamp(waterKg, waterMin, waterMax)

    // Adaptation: gradual changes (avoid insane week-to-week swings)
    // Keep baseline adaptation at 0 so the first two weeks represent "true maintenance".
    if (inBaseline) {
      adapt = 0
    } else {
      const deficit = tdeeToday - calories // positive = deficit
      const surplus = calories - tdeeToday
      const mult = plan.adaptationMultiplier || 1
      const adaptDown = deficit > 0 ? (-0.0010 * mult) * clamp(deficit / 500, 0, 2.0) : 0
      const adaptUp = surplus > 0 ? (0.00020) * clamp(surplus / 400, 0, 1.5) : 0
      adapt += adaptDown + adaptUp
      adapt = clamp(adapt, -0.22, 0.08)
    }

    // Update body fat trend (independent of day-to-day scale noise; used only for Navy measurements)
    if (!inBaseline) {
      bfPct += plan.bfDeltaPerDay(dayInPhase) + randn(rng) * 0.03
      bfPct = clamp(bfPct, 7, 45)
    }

    // Measurement noise and rounding
    const measuredWeight = round1(trueWeightKg + waterKg + randn(rng) * 0.07)

    // Navy measurements: weekly only, set to reflect bfPct trend
    // For demo data, record weight daily to keep the inferred TDEE/adaptation stable.
    const isMeasurementDay = true
    let neck = null
    let waist = null
    let hip = null
    if (isMeasurementDay) {
      neck = round1(s.neckCm + randn(rng) * 0.25)
      const waistIdeal = waistForBfMale({ targetBfPct: bfPct, heightCm: s.heightCm, neckCm: neck })
      waist = round1(waistIdeal + randn(rng) * 0.6)
      hip = null
    }

    entries.push({
      id: `demo-${scenarioId}-${i}`,
      dateIso,
      weight: measuredWeight,
      protein,
      carbs,
      fats,
      bench: liftValues.bench,
      squat: liftValues.squat,
      deadlift: liftValues.deadlift,
      neck,
      waist,
      hip,
      // triple measurement fields omitted in demo (toggleable in real profile)
    })
  }

  return entries
}
