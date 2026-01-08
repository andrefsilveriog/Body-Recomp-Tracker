import { buildSampleEntries, buildSampleProfile } from './src/utils/sampleData.js'
import { buildDerivedSeries, computeWeeklyAnalysis } from './src/utils/calculations.js'

const id = 'cutting_optimal'
const entries = buildSampleEntries(84, id)
const profile = buildSampleProfile(id)
const derived = buildDerivedSeries(entries, profile)
const weekly = computeWeeklyAnalysis(derived)
console.log('baseline', weekly.baselineTdee.toFixed(0))
weekly.weeks.forEach((w, idx) => {
  if (w.weightChangeKg === undefined || w.weightChangeKg === null) return
  console.log(
    idx + 1,
    w.avgCalories.toFixed(0),
    w.weightChangeKg.toFixed(3),
    w.calculatedTdee.toFixed(0),
    w.adaptationPct.toFixed(1)
  )
})
let maxDelta = 0
for (let i = 1; i < weekly.weeks.length; i++) {
  const a = weekly.weeks[i-1].adaptationPct
  const b = weekly.weeks[i].adaptationPct
  if (a==null || b==null) continue
  maxDelta = Math.max(maxDelta, Math.abs(b - a))
}
console.log('maxΔ', maxDelta.toFixed(1))
