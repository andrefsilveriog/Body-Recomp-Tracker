import { parseDateIso, toDateIso } from './date.js'

function randn() {
  // Box-Muller
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)) }

function loadFromEpley(oneRm, reps) {
  return oneRm / (1 + (reps / 30))
}

export function buildSampleProfile() {
  return {
    email: 'sample@demo.local',
    sex: 'male',
    height: 175,
    targetWeight: 82,
    triplemeasurements: false,
    createdAt: null
  }
}

export function buildSampleEntries(days = 60) {
  // Spec: male 175cm, start 90kg -> end 84-85kg, calories 2400 reduced 125 every 2 weeks,
  // lifts start 100/140/180 slight +3-5kg over 60 days, weekly waist down 96->~89, neck ~40.
  const start = new Date()
  start.setDate(start.getDate() - (days - 1))

  const entries = []
  let weightTrend = 90
  let benchTrend = 100
  let squatTrend = 140
  let deadTrend = 180

  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const dateIso = toDateIso(d)

    // calories step down every 14 days
    const step = Math.floor(i / 14)
    const caloriesTarget = 2400 - step * 125

    // assume gradual loss ~5.5kg over 60d
    weightTrend -= 5.5 / (days - 1)

    // strength slight up overall
    benchTrend += 4 / (days - 1)
    squatTrend += 4 / (days - 1)
    deadTrend += 5 / (days - 1)

    const weight = weightTrend + randn() * 0.8 // ~±1-1.5 swings
    const bench = benchTrend + randn() * 2.0
    const squat = squatTrend + randn() * 2.5
    const deadlift = deadTrend + randn() * 2.8

    const benchReps = Math.round(clamp(5 + randn() * 0.8, 3, 8))
    const squatReps = Math.round(clamp(5 + randn() * 0.8, 3, 8))
    const deadliftReps = Math.round(clamp(5 + randn() * 0.8, 3, 8))

    // macros roughly consistent
    const protein = 180 + randn() * 10
    const fats = 70 + randn() * 6
    // derive carbs to match caloriesTarget approximately: c = (cal - 4p - 9f)/4
    const carbs = (caloriesTarget - 4 * protein - 9 * fats) / 4 + randn() * 10

    const entry = {
      id: dateIso,
      dateIso,
      date: null,
      weight: round1(weight),
      protein: round0(protein),
      carbs: round0(clamp(carbs, 100, 320)),
      fats: round0(clamp(fats, 45, 95)),
      benchLoad: round1(loadFromEpley(bench, benchReps) + randn() * 1.0),
      benchReps: benchReps,
      squatLoad: round1(loadFromEpley(squat, squatReps) + randn() * 1.5),
      squatReps: squatReps,
      deadliftLoad: round1(loadFromEpley(deadlift, deadliftReps) + randn() * 2.0),
      deadliftReps: deadliftReps,
      neck: null,
      waist: null,
      hip: null,
    }

    // weekly navy measurements
    if (i % 7 === 0) {
      const weekIdx = Math.floor(i / 7)
      const waistStart = 96
      const waistEnd = 89
      const waistTrend = waistStart + (waistEnd - waistStart) * (i / (days - 1))
      entry.neck = 40 + randn() * 0.3
      entry.waist = waistTrend + randn() * 0.6
    }

    entries.push(entry)
  }

  return entries
}

function round0(x){ return Number.isFinite(x) ? Math.round(x) : null }
function round1(x){ return Number.isFinite(x) ? Math.round(x*10)/10 : null }
