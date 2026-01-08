import { buildSampleEntries, buildSampleProfile } from './src/utils/sampleData.js'
import { buildDerivedSeries, computeWeeklyAnalysis } from './src/utils/calculations.js'
import { DEMO_SCENARIOS } from './src/utils/sampleData.js'

function maxWeekDelta(id){
  const entries=buildSampleEntries(84,id)
  const profile=buildSampleProfile(id)
  const derived=buildDerivedSeries(entries,profile)
  const weekly=computeWeeklyAnalysis(derived)
  const ad=weekly.weeks.map(w=>w.adaptationPct).filter(v=>Number.isFinite(v))
  let max=0
  for(let i=1;i<ad.length;i++){
    max=Math.max(max, Math.abs(ad[i]-ad[i-1]))
  }
  return max
}

for(const s of DEMO_SCENARIOS){
  console.log(s.id, maxWeekDelta(s.id).toFixed(2))
}
