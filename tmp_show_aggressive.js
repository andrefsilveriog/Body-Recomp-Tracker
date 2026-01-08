import { buildSampleEntries, buildSampleProfile } from './src/utils/sampleData.js'
import { buildDerivedSeries, computeWeeklyAnalysis } from './src/utils/calculations.js'

const id='cutting_aggressive'
const entries=buildSampleEntries(84,id)
const profile=buildSampleProfile(id)
const derived=buildDerivedSeries(entries,profile)
const weekly=computeWeeklyAnalysis(derived)
console.log('baseline',weekly.baselineTdee.toFixed(0))
weekly.weeks.forEach((w,i)=>{
  const a = w.adaptationPct
  const avgC = w.avgCalories
  const wc = w.weightChange
  const tdee = w.tdee
  console.log(
    String(i+1).padStart(2,'0'),
    'cal',Math.round(avgC),
    'dW',wc==null?null:wc.toFixed(3),
    'tdee',tdee==null?null:Math.round(tdee),
    'ad',a==null?null:a.toFixed(1)
  )
})
