import React, { useMemo, useState } from 'react'
import { todayIso } from '../utils/date.js'
import { caloriesFromMacros, oneRepMaxKg } from '../utils/calculations.js'

function n(v) {
  if (v === '' || v === null || v === undefined) return ''
  const x = Number(v)
  return Number.isFinite(x) ? x : ''
}

export default function EntryForm({ sex, tripleEnabled, liftNames, onSubmit, busy }) {
  const isFemale = String(sex || '').toLowerCase() === 'female'
  const [dateIso, setDateIso] = useState(todayIso())
  const [weight, setWeight] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fats, setFats] = useState('')
  // Best last set inputs per lift (optional): load + reps → estimated 1RM stored in DB
  const [benchLoad, setBenchLoad] = useState('')
  const [benchReps, setBenchReps] = useState('')
  const [squatLoad, setSquatLoad] = useState('')
  const [squatReps, setSquatReps] = useState('')
  const [deadliftLoad, setDeadliftLoad] = useState('')
  const [deadliftReps, setDeadliftReps] = useState('')

  const [neck, setNeck] = useState('')
  const [waist, setWaist] = useState('')
  const [hip, setHip] = useState('')

  const [neck1, setNeck1] = useState('')
  const [neck2, setNeck2] = useState('')
  const [neck3, setNeck3] = useState('')
  const [waist1, setWaist1] = useState('')
  const [waist2, setWaist2] = useState('')
  const [waist3, setWaist3] = useState('')
  const [hip1, setHip1] = useState('')
  const [hip2, setHip2] = useState('')
  const [hip3, setHip3] = useState('')

  const ln = Array.isArray(liftNames) && liftNames.length === 3 ? liftNames : ['Bench Press','Squat','Deadlift']
  const caloriesPreview = useMemo(() => {
    const c = caloriesFromMacros({ protein: n(protein) || 0, carbs: n(carbs) || 0, fats: n(fats) || 0 })
    return Number.isFinite(c) ? Math.round(c) : 0
  }, [protein, carbs, fats])

  const bench1rm = useMemo(() => oneRepMaxKg(n(benchLoad), n(benchReps)), [benchLoad, benchReps])
  const squat1rm = useMemo(() => oneRepMaxKg(n(squatLoad), n(squatReps)), [squatLoad, squatReps])
  const dead1rm = useMemo(() => oneRepMaxKg(n(deadliftLoad), n(deadliftReps)), [deadliftLoad, deadliftReps])

    const validDaily = () => (
    dateIso &&
    Number.isFinite(Number(weight)) &&
    Number.isFinite(Number(protein)) &&
    Number.isFinite(Number(carbs)) &&
    Number.isFinite(Number(fats))
  )


  async function handleSubmit(e) {
    e.preventDefault()
    if (!validDaily()) return

    const benchOrm = oneRepMaxKg(n(benchLoad), n(benchReps))
    const squatOrm = oneRepMaxKg(n(squatLoad), n(squatReps))
    const deadOrm = oneRepMaxKg(n(deadliftLoad), n(deadliftReps))

    const payload = {
      dateIso,
      weight: Number(weight),
      protein: Number(protein),
      carbs: Number(carbs),
      fats: Number(fats),
      benchLoad: benchLoad === '' ? null : Number(benchLoad),
      benchReps: benchReps === '' ? null : Number(benchReps),
      squatLoad: squatLoad === '' ? null : Number(squatLoad),
      squatReps: squatReps === '' ? null : Number(squatReps),
      deadliftLoad: deadliftLoad === '' ? null : Number(deadliftLoad),
      deadliftReps: deadliftReps === '' ? null : Number(deadliftReps),
      // Keep existing lift fields for charts/analysis — now represent estimated 1RM.
      bench: Number.isFinite(benchOrm) ? Math.round(benchOrm * 10) / 10 : null,
      squat: Number.isFinite(squatOrm) ? Math.round(squatOrm * 10) / 10 : null,
      deadlift: Number.isFinite(deadOrm) ? Math.round(deadOrm * 10) / 10 : null,
    }

    if (!tripleEnabled) {
      payload.neck = neck === '' ? null : Number(neck)
      payload.waist = waist === '' ? null : Number(waist)
      payload.hip = isFemale ? (hip === '' ? null : Number(hip)) : null
    } else {
      payload.neck1 = neck1 === '' ? null : Number(neck1)
      payload.neck2 = neck2 === '' ? null : Number(neck2)
      payload.neck3 = neck3 === '' ? null : Number(neck3)
      payload.waist1 = waist1 === '' ? null : Number(waist1)
      payload.waist2 = waist2 === '' ? null : Number(waist2)
      payload.waist3 = waist3 === '' ? null : Number(waist3)
      payload.hip1 = isFemale ? (hip1 === '' ? null : Number(hip1)) : null
      payload.hip2 = isFemale ? (hip2 === '' ? null : Number(hip2)) : null
      payload.hip3 = isFemale ? (hip3 === '' ? null : Number(hip3)) : null
    }

    await onSubmit(payload)
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Daily Entry</h2>
        <div className="muted">Calories preview: <b>{caloriesPreview}</b> kcal</div>
      </div>

      <form onSubmit={handleSubmit} style={{ marginTop: 12 }}>
        <div className="row">
          <div className="field">
            <label>Date</label>
            <input type="date" value={dateIso} onChange={(e) => setDateIso(e.target.value)} />
          </div>

          <div className="field">
            <label>Weight (kg)</label>
            <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 85.2" required />
          </div>

          <div className="field">
            <label>Protein (g)</label>
            <input inputMode="numeric" value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="e.g. 180" />
          </div>

          <div className="field">
            <label>Carbs (g)</label>
            <input inputMode="numeric" value={carbs} onChange={(e) => setCarbs(e.target.value)} placeholder="e.g. 220" required />
          </div>

          <div className="field">
            <label>Fats (g)</label>
            <input inputMode="numeric" value={fats} onChange={(e) => setFats(e.target.value)} placeholder="e.g. 70" required />
          </div>
        </div>

        <hr className="sep" />

        <div className="row">
          <div className="field">
            <label>{ln[0]} <span className="muted">(optional)</span></label>
            <div className="inline2">
              <input inputMode="decimal" value={benchLoad} onChange={(e) => setBenchLoad(e.target.value)} placeholder="Load (kg)" />
              <input inputMode="numeric" value={benchReps} onChange={(e) => setBenchReps(e.target.value)} placeholder="Reps" />
            </div>
            <div className="muted small">Est. 1RM: <b>{Number.isFinite(bench1rm) ? (Math.round(bench1rm * 10) / 10) : '—'}</b> kg</div>
          </div>
          <div className="field">
            <label>{ln[1]} <span className="muted">(optional)</span></label>
            <div className="inline2">
              <input inputMode="decimal" value={squatLoad} onChange={(e) => setSquatLoad(e.target.value)} placeholder="Load (kg)" />
              <input inputMode="numeric" value={squatReps} onChange={(e) => setSquatReps(e.target.value)} placeholder="Reps" />
            </div>
            <div className="muted small">Est. 1RM: <b>{Number.isFinite(squat1rm) ? (Math.round(squat1rm * 10) / 10) : '—'}</b> kg</div>
          </div>
          <div className="field">
            <label>{ln[2]} <span className="muted">(optional)</span></label>
            <div className="inline2">
              <input inputMode="decimal" value={deadliftLoad} onChange={(e) => setDeadliftLoad(e.target.value)} placeholder="Load (kg)" />
              <input inputMode="numeric" value={deadliftReps} onChange={(e) => setDeadliftReps(e.target.value)} placeholder="Reps" />
            </div>
            <div className="muted small">Est. 1RM: <b>{Number.isFinite(dead1rm) ? (Math.round(dead1rm * 10) / 10) : '—'}</b> kg</div>
          </div>
        </div>

        <div className="muted small" style={{ marginTop: 6 }}>
          Enter both load + reps to calculate 1RM. If left blank, strength trends will carry forward the last known value.
        </div>

        <hr className="sep" />

        <div className="notice info">
          <b>Navy measurements (weekly)</b>
          <div className="small" style={{ marginTop: 6 }}>
            Optional. Leave blank on non-measurement days.
            {!isFemale ? ' Male profile: Neck + Waist only.' : ''}
            {tripleEnabled ? ' Triple mode is ON: enter up to 3 readings per site; averages are used.' : ''}
          </div>
        </div>

        <div style={{ height: 10 }} />

        {!tripleEnabled ? (
          <div className="row">
            <div className="field">
              <label>Neck (cm)</label>
              <input inputMode="decimal" value={neck} onChange={(e) => setNeck(e.target.value)} placeholder="optional" />
            </div>
            <div className="field">
              <label>Waist (cm)</label>
              <input inputMode="decimal" value={waist} onChange={(e) => setWaist(e.target.value)} placeholder="optional" />
            </div>
            {isFemale ? (
              <div className="field">
                <label>Hip (cm)</label>
                <input inputMode="decimal" value={hip} onChange={(e) => setHip(e.target.value)} placeholder="optional" />
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <div className="row">
              <div className="field"><label>Neck 1 (cm)</label><input inputMode="decimal" value={neck1} onChange={(e) => setNeck1(e.target.value)} /></div>
              <div className="field"><label>Neck 2 (cm)</label><input inputMode="decimal" value={neck2} onChange={(e) => setNeck2(e.target.value)} /></div>
              <div className="field"><label>Neck 3 (cm)</label><input inputMode="decimal" value={neck3} onChange={(e) => setNeck3(e.target.value)} /></div>
            </div>
            <div className="row">
              <div className="field"><label>Waist 1 (cm)</label><input inputMode="decimal" value={waist1} onChange={(e) => setWaist1(e.target.value)} /></div>
              <div className="field"><label>Waist 2 (cm)</label><input inputMode="decimal" value={waist2} onChange={(e) => setWaist2(e.target.value)} /></div>
              <div className="field"><label>Waist 3 (cm)</label><input inputMode="decimal" value={waist3} onChange={(e) => setWaist3(e.target.value)} /></div>
            </div>
            {isFemale ? (
              <div className="row">
                <div className="field"><label>Hip 1 (cm)</label><input inputMode="decimal" value={hip1} onChange={(e) => setHip1(e.target.value)} /></div>
                <div className="field"><label>Hip 2 (cm)</label><input inputMode="decimal" value={hip2} onChange={(e) => setHip2(e.target.value)} /></div>
                <div className="field"><label>Hip 3 (cm)</label><input inputMode="decimal" value={hip3} onChange={(e) => setHip3(e.target.value)} /></div>
              </div>
            ) : null}
          </>
        )}

        <div className="footer-actions">
          <button className="btn primary" type="submit" disabled={!validDaily() || busy}>
            {busy ? 'Saving…' : 'Add / Update Entry'}
          </button>
        </div>
      </form>
    </div>
  )
}
