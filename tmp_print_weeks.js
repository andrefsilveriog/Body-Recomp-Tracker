import { buildSampleEntries, buildSampleProfile } from './src/utils/sampleData.js'
import { buildDerivedSeries, computeWeeklyAnalysis } from './src/utils/calculations.js'

const id = process.argv[2] || 'cutting_optimal'
const entries = buildSampleEntries(84, id)
const profile = buildSampleProfile(id)
const derived = buildDerivedSeries(entries, profile)
const weekly = computeWeeklyAnalysis(derived)

console.log('scenario', id)
console.log('baselineTdee', weekly.baselineTdee.toFixed(0))
weekly.weeks.forEach((w, idx) => {
  if (!w || w.tdee == null) return
  console.log(
    `${String(idx + 1).padStart(2, '0')}  avgCal=${w.avgCalories.toFixed(0)}  dW=${w.weightChangeKg?.toFixed(3)}  tdee=${w.tdee.toFixed(0)}  adapt=${w.adaptationPct?.toFixed(1)}`
  )
})
