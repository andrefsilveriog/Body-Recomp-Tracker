import { buildSampleEntries, buildSampleProfile } from './src/utils/sampleData.js'
import { buildDerivedSeries, computeWeeklyAnalysis } from './src/utils/calculations.js'

const scenario='cutting_aggressive'
const entries=buildSampleEntries(84,scenario)
const profile=buildSampleProfile(scenario)
const derived=buildDerivedSeries(entries,profile)
const weekly=computeWeeklyAnalysis(derived)
console.log('baselineTdee',weekly.baselineTdee)
console.log('weeks', weekly.weeks.slice(0,8).map(w=>({week:w.week, avgCal:Math.round(w.avgCalories), weightChange: Number(w.weightChange?.toFixed(3)), tdee: Math.round(w.tdee), ad: Number((w.adaptationPct??0).toFixed(2))})))
