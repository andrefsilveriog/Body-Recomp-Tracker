import { buildSampleEntries, buildSampleProfile } from './src/utils/sampleData.js'
import { buildDerivedSeries, computeWeeklyAnalysis } from './src/utils/calculations.js'

const scenario='cutting_optimal'
const entries=buildSampleEntries(84,scenario)
const profile=buildSampleProfile(scenario)
const derived=buildDerivedSeries(entries,profile)
const weekly=computeWeeklyAnalysis(derived)
console.log(Object.keys(weekly.weeks[0]))
console.log('baselineTdee',weekly.baselineTdee)
weekly.weeks.slice(0,3).forEach(w => {
  console.log(w.weekLabel, 'avgCal', w.avgCalories, 'wChange', w.weightChange.toFixed(3), 'tdee', w.tdee.toFixed(0))
})
