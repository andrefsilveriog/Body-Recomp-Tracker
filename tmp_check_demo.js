import { buildSampleEntries, buildSampleProfile } from './src/utils/sampleData.js'
import { buildDerivedSeries, computeWeeklyAnalysis } from './src/utils/calculations.js'
import { DEMO_SCENARIOS } from './src/utils/sampleData.js'

function summaryForScenario(id){
  const entries = buildSampleEntries(84, id)
  const profile = buildSampleProfile(id)
  const derived = buildDerivedSeries(entries, profile)
  const weekly = computeWeeklyAnalysis(derived)
  const ad = weekly.weeks.map(w=>w.adaptationPct).filter(Number.isFinite)
  const tdee = weekly.weeks.map(w=>w.tdee).filter(Number.isFinite)
  const minAd = ad.length? Math.min(...ad): null
  const maxAd = ad.length? Math.max(...ad): null
  const minT= tdee.length? Math.min(...tdee): null
  const maxT= tdee.length? Math.max(...tdee): null
  return {id, baselineTdee: weekly.baselineTdee, minAd, maxAd, minT, maxT}
}

const out = DEMO_SCENARIOS.map(s=>summaryForScenario(s.id))
console.log(JSON.stringify(out, null, 2))
