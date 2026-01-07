function esc(v) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function downloadCsv(filename, rows) {
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function buildCsvRows({ entries, derived }) {
  // Derived is aligned with entries by dateIso (same order)
  const header = [
    'dateIso',
    'weightKg','proteinG','carbsG','fatsG',
    'benchLoadKg','benchReps','bench1rmKg',
    'squatLoadKg','squatReps','squat1rmKg',
    'deadliftLoadKg','deadliftReps','deadlift1rmKg',
    'calories','avgStrength',
    'wmaWeight','wmaCalories','wmaAvgStrength','wmaBench','wmaSquat','wmaDeadlift',
    'neck','waist','hip',
    'neck1','neck2','neck3','waist1','waist2','waist3','hip1','hip2','hip3',
    'bodyFatPct','lbmKg'
  ]

  const dmap = new Map((derived || []).map((d) => [d.dateIso, d]))
  const rows = [header]

  for (const e of (entries || [])) {
    const d = dmap.get(e.dateIso)
    rows.push([
      e.dateIso,
      e.weight, e.protein, e.carbs, e.fats,
      e.benchLoad, e.benchReps, e.bench,
      e.squatLoad, e.squatReps, e.squat,
      e.deadliftLoad, e.deadliftReps, e.deadlift,
      d?.calories, d?.avgStrength,
      d?.wma?.weight, d?.wma?.calories, d?.wma?.avgStrength, d?.wma?.bench, d?.wma?.squat, d?.wma?.deadlift,
      e.neck, e.waist, e.hip,
      e.neck1, e.neck2, e.neck3, e.waist1, e.waist2, e.waist3, e.hip1, e.hip2, e.hip3,
      d?.bfPct, d?.lbm
    ])
  }

  return rows
}
