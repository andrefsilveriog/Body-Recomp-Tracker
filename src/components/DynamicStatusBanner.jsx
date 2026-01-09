import React, { useMemo, useState } from 'react'
import { parseDateIso } from '../utils/date.js'
import { useDynamicStatusBannerConfig } from '../services/dynamicStatusBannerConfig.js'
import { evaluateRules, formatTemplate } from '../utils/statusRuleEngine.js'

function daysBetween(aIso, bIso) {
  // whole days between a - b (a newer than b => positive)
  const a = parseDateIso(aIso).getTime()
  const b = parseDateIso(bIso).getTime()
  return Math.floor((a - b) / (24 * 60 * 60 * 1000))
}

function avgFinite(arr) {
  const nums = (arr || []).map(Number).filter(Number.isFinite)
  if (!nums.length) return null
  return nums.reduce((s, x) => s + x, 0) / nums.length
}

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x))
}

function fmtNum(n, d = 0) {
  if (!Number.isFinite(n)) return '—'
  return Number(n).toFixed(d)
}

function cycleKey(type) {
  const t = String(type || '').toLowerCase()
  if (t === 'cut' || t === 'cutting') return 'cut'
  if (t === 'bulk' || t === 'bulking') return 'bulk'
  if (t === 'maintain' || t === 'maintaining') return 'maintain'
  return 'none'
}

function cycleTitle(key) {
  if (key === 'cut') return 'Cutting'
  if (key === 'bulk') return 'Bulking'
  if (key === 'maintain') return 'Maintaining'
  return 'No cycle'
}

function cycleBadgeLabel(key) {
  if (key === 'cut') return 'CUT'
  if (key === 'bulk') return 'BULK'
  if (key === 'maintain') return 'MAINTAIN'
  return 'NO CYCLE'
}

function classifyWeight(deltaKgPerWeek, t) {
  if (!Number.isFinite(deltaKgPerWeek)) return { key: 'unknown', sym: '—', label: 'Unknown', value: null }
  const stable = Number(t?.weight?.stableKgPerWeek ?? 0.2)
  const rapid = Number(t?.weight?.rapidKgPerWeek ?? 1.0)
  const d = deltaKgPerWeek
  if (Math.abs(d) <= stable) return { key: 'stable', sym: '→', label: 'Stable', value: d }
  if (d < -rapid) return { key: 'rapid_loss', sym: '↓↓', label: 'Rapid loss', value: d }
  if (d < -stable) return { key: 'losing', sym: '↓', label: 'Losing', value: d }
  if (d > rapid) return { key: 'rapid_gain', sym: '↑↑', label: 'Rapid gain', value: d }
  if (d > stable) return { key: 'gaining', sym: '↑', label: 'Gaining', value: d }
  return { key: 'stable', sym: '→', label: 'Stable', value: d }
}

function classifyBf(deltaPct, t) {
  if (!Number.isFinite(deltaPct)) return { key: 'unknown', sym: '—', label: 'Unknown', value: null }
  const stable = Number(t?.bf?.stablePctPoints ?? 0.5)
  const d = deltaPct
  if (Math.abs(d) <= stable) return { key: 'stable', sym: '→', label: 'Stable', value: d }
  if (d < -stable) return { key: 'decreasing', sym: '↓', label: 'Decreasing', value: d }
  if (d > stable) return { key: 'increasing', sym: '↑', label: 'Increasing', value: d }
  return { key: 'stable', sym: '→', label: 'Stable', value: d }
}

function classifyStrength(pctChange, t) {
  if (!Number.isFinite(pctChange)) return { key: 'unknown', sym: '—', label: 'Unknown', value: null }
  const stable = Number(t?.strength?.stablePct ?? 2)
  const up = Number(t?.strength?.increasePct ?? 2)
  const down = Number(t?.strength?.declinePct ?? -2)
  const rapidDown = Number(t?.strength?.rapidDeclinePct ?? -5)
  const p = pctChange
  if (Math.abs(p) <= stable) return { key: 'stable', sym: '→', label: 'Stable', value: p }
  if (p >= up) return { key: 'increasing', sym: '↑', label: 'Increasing', value: p }
  if (p <= rapidDown) return { key: 'rapid_decline', sym: '↓↓', label: 'Rapid decline', value: p }
  if (p <= down) return { key: 'declining', sym: '↓', label: 'Declining', value: p }
  return { key: 'stable', sym: '→', label: 'Stable', value: p }
}

function badgeClass(key) {
  if (key === 'cut') return 'cycle-badge cut'
  if (key === 'bulk') return 'cycle-badge bulk'
  if (key === 'maintain') return 'cycle-badge maintain'
  return 'cycle-badge none'
}

function computeStatusHardcoded(ctx) {
  const {
    cycle,
    hasCycleTarget,
    currentAvgCal,
    currentProtein,
    proteinPerKg,
    targetProtein2g,
    currentWeight,
    targetWeight,
    weightToGoal,
    directionToGoal,
    derivedLen,
    daysLogged,
    daysRemaining,
    hasNavyAny,
    hasNavyInWindow,
    weightTrend,
    bfTrend,
    strengthTrend,
    lossRate,
    calculatedTdee,
    baselineTdee,
    adaptationPct,
    strengthDeclinePct,
    weeklyWeightChange,
    weeklyWeightLoss,
    prevWeekTdee,
  } = ctx

  const warnings = []
  const notes = []

  // Insufficient info first
  if (derivedLen < 14 || !Number.isFinite(baselineTdee) || !Number.isFinite(calculatedTdee)) {
    let msg = ''
    if (daysRemaining > 0) msg = `Need ${daysRemaining} more days of consistent logging to assess status.`
    else msg = `Need at least 14 days of consistent logging to assess status.`
    if (daysLogged < 5) msg = `Only ${daysLogged}/7 days logged this week. Need ≥5 days per week for accurate assessment.`
    if (!hasNavyAny) {
      notes.push('Take your first body measurements (neck, waist, hip) to enable body composition tracking.')
    } else if (!hasNavyInWindow) {
      notes.push('No recent Navy measurements in the selected period. BF% trend will be less accurate.')
    }
    if (cycle === 'none') notes.push('No active cycle set. Create a cycle so status checks alignment with your goal.')
    if (hasCycleTarget && Number.isFinite(targetWeight) && Number.isFinite(currentWeight)) {
      notes.push(`Goal: ${fmtNum(targetWeight, 1)}kg (currently ${fmtNum(currentWeight, 1)}kg, ${fmtNum(Math.abs(weightToGoal), 1)}kg to go).`)
    }
    return {
      level: 'gray',
      title: 'Insufficient Data',
      emoji: '⏳',
      message: msg,
      warnings,
      notes,
    }
  }

  // If week coverage is too sparse, keep as insufficient even if 14+ entries exist
  if (daysLogged < 5) {
    const msg = `Only ${daysLogged}/7 days logged this week. Need ≥5 days per week for accurate assessment.`
    if (!hasNavyAny) notes.push('Take your first body measurements (neck, waist, hip) to enable body composition tracking.')
    return { level: 'gray', title: 'Insufficient Data', emoji: '⏳', message: msg, warnings, notes }
  }

  // Helper values for messages
  const cal = Math.round(currentAvgCal || 0)
  const prot = Math.round(currentProtein || 0)
  const tdee = Math.round(calculatedTdee || 0)
  const base = Math.round(baselineTdee || 0)

  const isBfKnown = bfTrend.key !== 'unknown'
  const isStrKnown = strengthTrend.key !== 'unknown'

  if (!hasNavyAny || !hasNavyInWindow || !isBfKnown) {
    notes.push('Body fat trend is unavailable in this period. Add Navy measurements (neck/waist/hip) for more accurate status.')
  }
  if (!isStrKnown) {
    notes.push('Strength trend is unavailable. Log your big-3 lifts (bench/squat/deadlift) to improve accuracy.')
  }

  // Goal helper
  const absToGoal = Number.isFinite(weightToGoal) ? Math.abs(weightToGoal) : null

  function addGoalNote() {
    if (!hasCycleTarget || !Number.isFinite(targetWeight) || !Number.isFinite(currentWeight) || !Number.isFinite(absToGoal)) return
    if (absToGoal <= 2) return
    if (directionToGoal === 'need to lose') {
      warnings.push(`Note: You're ${fmtNum(absToGoal, 1)}kg from your target of ${fmtNum(targetWeight, 1)}kg. Consider switching to a Cut cycle if fat loss is the priority.`)
    } else if (directionToGoal === 'need to gain') {
      warnings.push(`Note: You're ${fmtNum(absToGoal, 1)}kg from your target of ${fmtNum(targetWeight, 1)}kg. Consider switching to a Bulk cycle if gaining is the priority.`)
    }
  }

  // Cycle misalignment checks (added as warnings)
  function cycleMisalignmentHint() {
    if (cycle === 'none') return
    if (cycle === 'cut') {
      if (weightTrend.key === 'stable' || weightTrend.key === 'gaining' || weightTrend.key === 'rapid_gain' || (isBfKnown && (bfTrend.key === 'stable' || bfTrend.key === 'increasing'))) {
        warnings.push('⚠️ Cycle misalignment: In a Cut cycle, weight should trend ↓ and body fat should trend ↓ over time.')
      }
    } else if (cycle === 'bulk') {
      if (weightTrend.key === 'stable' || weightTrend.key === 'losing' || weightTrend.key === 'rapid_loss' || (isStrKnown && strengthTrend.key === 'stable')) {
        warnings.push('⚠️ Cycle misalignment: In a Bulk cycle, weight should trend ↑ and strength should trend ↑ over time.')
      }
    } else if (cycle === 'maintain') {
      if (weightTrend.key === 'rapid_gain' || weightTrend.key === 'rapid_loss') {
        warnings.push('⚠️ Cycle misalignment: In a Maintain cycle, weight should stay → (stable).')
      }
    }
  }

  // --- RED (urgent) statuses ---
  // Metabolic Crash
  if (Number.isFinite(adaptationPct) && adaptationPct < -15 && strengthTrend.key === 'rapid_decline') {
    const msg = `🚨 URGENT: TDEE dropped ${fmtNum(adaptationPct, 1)}% (from ${base} to ${tdee}). Take a 2-week diet break: increase from ${cal} to ~${tdee} cal/day.`
    cycleMisalignmentHint()
    return { level: 'red', title: 'Metabolic Crash', emoji: '🚨', message: msg, warnings, notes }
  }

  // Skinny-fat trajectory (requires BF)
  if (isBfKnown && weightTrend.key !== 'gaining' && bfTrend.key === 'increasing' && (strengthTrend.key === 'declining' || strengthTrend.key === 'rapid_decline')) {
    let msg = `🚨 CRITICAL: Body fat is rising while weight is dropping — likely muscle loss.`
    if (Number.isFinite(proteinPerKg) && proteinPerKg < 1.8) {
      msg = `🚨 CRITICAL: Insufficient protein (${prot}g, ${fmtNum(proteinPerKg, 1)}g/kg) causing muscle loss. Increase to ~${Math.round(targetProtein2g)}g and raise calories to maintenance (~${tdee}).`
    } else {
      msg = `🚨 CRITICAL: Despite adequate protein (${prot}g, ${fmtNum(proteinPerKg, 1)}g/kg), you're losing muscle faster than fat. Stop cutting: increase from ${cal} to maintenance (~${tdee}) and focus on progressive overload.`
    }
    cycleMisalignmentHint()
    if (hasCycleTarget && Number.isFinite(targetWeight) && Number.isFinite(currentWeight) && currentWeight < targetWeight) {
      warnings.push(`⚠️ You're already below your goal weight of ${fmtNum(targetWeight, 1)}kg. Stop cutting and switch to Maintain or Bulk.`)
    }
    return { level: 'red', title: 'Skinny-Fat Trajectory', emoji: '🚨', message: msg, warnings, notes }
  }

  // Inadequate protein / poor training
  if ((strengthTrend.key === 'rapid_decline') && (weightTrend.key === 'losing' || weightTrend.key === 'rapid_loss')) {
    let msg = ''
    if (Number.isFinite(proteinPerKg) && proteinPerKg < 1.6) {
      msg = `🚨 URGENT: Protein too low (${prot}g, ${fmtNum(proteinPerKg, 1)}g/kg). Increase to ~${Math.round(targetProtein2g)}g/day. Keep calories at ${cal} while training stays consistent.`
    } else if (Number.isFinite(strengthDeclinePct) && strengthDeclinePct > 5) {
      msg = `🚨 URGENT: Strength is declining ${fmtNum(strengthDeclinePct, 1)}% from baseline. Review training stimulus/recovery. Consider reducing cardio and keeping calories closer to maintenance (~${tdee}).`
    } else {
      msg = `🚨 URGENT: Strength dropping rapidly while cutting. Increase calories from ${cal} to ~${cal + 300} and reassess training recovery.`
    }
    cycleMisalignmentHint()
    return { level: 'red', title: 'Inadequate Protein / Poor Training', emoji: '🚨', message: msg, warnings, notes }
  }

  // Overfeeding without stimulus (requires BF)
  if (isBfKnown && (weightTrend.key === 'gaining' || weightTrend.key === 'rapid_gain') && bfTrend.key === 'increasing' && strengthTrend.key === 'stable') {
    let msg = ''
    if (Number.isFinite(proteinPerKg) && proteinPerKg < 1.6) {
      msg = `🚨 Eating ${cal} cal but only ${prot}g protein (${fmtNum(proteinPerKg, 1)}g/kg). Increase protein to ~${Math.round(targetProtein2g)}g and reduce total calories to ~${Math.max(0, cal - 300)}.`
    } else {
      msg = `🚨 Eating ${cal} cal with adequate protein (${prot}g, ${fmtNum(proteinPerKg, 1)}g/kg) but no strength gains. Either reduce ~${Math.max(0, cal - 400)} for a cut or increase training intensity/volume to actually build muscle.`
    }
    cycleMisalignmentHint()
    return { level: 'red', title: 'Overfeeding Without Stimulus', emoji: '🚨', message: msg, warnings, notes }
  }

  // Detraining (requires BF)
  if (isBfKnown && (bfTrend.key === 'increasing') && (strengthTrend.key === 'declining' || strengthTrend.key === 'rapid_decline')) {
    let msg = `🚨 Losing muscle and gaining fat. Resume consistent training immediately.`
    if (Number.isFinite(prevWeekTdee) && Number.isFinite(currentAvgCal)) {
      msg = `🚨 Losing muscle and gaining fat. Resume consistent training immediately. You're eating ~${cal} vs estimated TDEE ~${Math.round(prevWeekTdee)}. Reduce to maintenance until training is consistent.`
    }
    warnings.push('Cannot progress in any cycle without consistent training. Consider switching to Maintaining until training is back on track.')
    addGoalNote()
    return { level: 'red', title: 'Detraining', emoji: '🚨', message: msg, warnings, notes }
  }

  // --- GRAY special: Water weight / discrepancy (non-urgent) ---
  // Use previous week TDEE as an independent expectation, when available
  if (Number.isFinite(prevWeekTdee) && Number.isFinite(currentAvgCal) && Number.isFinite(weeklyWeightChange)) {
    const predictedEnergy = (prevWeekTdee - currentAvgCal) * 7 // deficit +, surplus -
    const actualEnergy = (-weeklyWeightChange) * 7700
    if (Math.abs(actualEnergy - predictedEnergy) > 3850) {
      const expectedChange = (currentAvgCal - prevWeekTdee) * 7 / 7700
      const msg = `Weight changed ${fmtNum(weeklyWeightChange, 1)}kg/week but calories suggest ${fmtNum(expectedChange, 1)}kg/week. Likely water retention (sodium/carbs/hormones/timing). Keep ${cal} cal and reassess in 1 week.`
      cycleMisalignmentHint()
      addGoalNote()
      return { level: 'gray', title: 'Water Weight Fluctuation', emoji: '💧', message: msg, warnings, notes }
    }
  }

  // --- YELLOW / ORANGE statuses ---
  // Cutting (Aggressive)
  if ((weightTrend.key === 'rapid_loss') && (strengthTrend.key === 'declining' || strengthTrend.key === 'rapid_decline')) {
    let msg = ''
    if (Number.isFinite(proteinPerKg) && proteinPerKg < 1.8) {
      msg = `⚠️ Losing muscle due to insufficient protein. Currently ${prot}g (${fmtNum(proteinPerKg, 1)}g/kg). Increase to ~${Math.round(targetProtein2g)}g/day and reduce deficit to ~${cal + 200} cal.`
    } else {
      msg = `⚠️ Deficit too aggressive despite adequate protein (${prot}g/day, ${fmtNum(proteinPerKg, 1)}g/kg). Increase calories from ${cal} to ~${cal + 250} to preserve muscle.`
    }
    if (Number.isFinite(lossRate) && lossRate > 1.0) {
      notes.push(`Loss rate: ${fmtNum(lossRate, 2)}% of LBM/week (aggressive).`)
    }
    cycleMisalignmentHint()
    return { level: 'yellow', title: 'Cutting (Aggressive)', emoji: '⚠️', message: msg, warnings, notes }
  }

  // Dirty Bulking (requires BF)
  if (isBfKnown && weightTrend.key === 'rapid_gain' && bfTrend.key === 'increasing' && strengthTrend.key === 'increasing') {
    const msg = `⚠️ Excessive fat gain. Reduce from ${cal} to ~${Math.max(0, cal - 250)} cal/day while keeping protein around ${prot}g.`
    cycleMisalignmentHint()
    addGoalNote()
    return { level: 'yellow', title: 'Dirty Bulking', emoji: '⚠️', message: msg, warnings, notes }
  }

  // Spinning wheels
  if (weightTrend.key === 'stable' && (!isBfKnown || bfTrend.key === 'stable') && (!isStrKnown || strengthTrend.key === 'stable')) {
    let msg = `You're stable with no clear trend.`
    if (cycle === 'maintain') {
      msg = `You're maintaining as intended. If you want a direction, choose Cut (~${Math.max(0, tdee - 500)} cal) or Bulk (~${tdee + 300} cal).`
    } else if (cycle === 'cut') {
      msg = `⚠️ Eating near maintenance (${cal} ≈ ${tdee}) but in a Cut cycle. Reduce to ~${Math.max(0, tdee - 500)} cal/day to start cutting.`
      if (Number.isFinite(adaptationPct) && adaptationPct < -10) {
        notes.push(`Metabolic adaptation: ${fmtNum(adaptationPct, 1)}%. Consider a short diet break near maintenance.`)
      }
    } else if (cycle === 'bulk') {
      msg = `⚠️ Weight is stable but in a Bulk cycle. Increase from ${cal} to ~${tdee + 400} cal/day to start gaining.`
    } else {
      msg = `Set a cycle to interpret trends in context.`
    }
    addGoalNote()
    return { level: 'yellow', title: 'Spinning Wheels', emoji: '🟡', message: msg, warnings, notes }
  }

  // --- GREEN statuses ---
  // Recomping / Gaintaining
  if (weightTrend.key === 'stable' && isBfKnown && bfTrend.key === 'decreasing' && strengthTrend.key === 'increasing') {
    let msg = `✓ Excellent recomp: losing fat and gaining muscle while maintaining weight. Current calories (${cal}) fit your plan.`
    if (cycle === 'cut') msg = `⚠️ Good progress but misaligned: you're recomping (weight stable) in a Cut cycle. To lose weight as planned, reduce to ~${Math.max(0, cal - 300)} cal/day.`
    if (cycle === 'bulk') msg = `⚠️ Good progress but misaligned: you're recomping (weight stable) in a Bulk cycle. To gain as planned, increase to ~${cal + 400} cal/day.`
    addGoalNote()
    return { level: 'green', title: (cycle === 'bulk' ? 'Gaintaining' : 'Recomping'), emoji: '✅', message: msg, warnings, notes }
  }

  // Lean Bulking
  if (weightTrend.key === 'gaining' && strengthTrend.key === 'increasing' && (!isBfKnown || bfTrend.key === 'stable' || bfTrend.key === 'increasing')) {
    let msg = `✓ Perfect lean bulk. Stay around ${cal} calories/day with ${prot}g protein.`
    if (cycle === 'maintain') msg = `⚠️ Misaligned: you're bulking in a Maintaining cycle. Either reduce to maintenance (~${tdee} cal) or switch cycle to Bulking.`
    if (cycle === 'cut') msg = `🚨 Misaligned: you're bulking in a Cutting cycle. Either reduce to ~${Math.max(0, tdee - 500)} cal or switch cycle to Bulking.`
    if (hasCycleTarget && Number.isFinite(targetWeight) && Number.isFinite(weightToGoal) && weightToGoal < -2) {
      notes.push(`On track toward ${fmtNum(targetWeight, 1)}kg — ${fmtNum(Math.abs(weightToGoal), 1)}kg to go.`)
    } else if (hasCycleTarget && Number.isFinite(targetWeight) && Number.isFinite(weightToGoal) && weightToGoal > 2) {
      warnings.push(`⚠️ Moving away from goal: currently ${fmtNum(currentWeight, 1)}kg vs target ${fmtNum(targetWeight, 1)}kg.`)
    }
    return { level: 'green', title: 'Lean Bulking', emoji: '✅', message: msg, warnings, notes }
  }

  // Cutting (Optimal)
  if ((weightTrend.key === 'losing') && (!isBfKnown || bfTrend.key === 'decreasing') && (strengthTrend.key === 'stable' || strengthTrend.key === 'increasing')) {
    const isOptimal = Number.isFinite(lossRate) ? (lossRate >= 0.5 && lossRate <= 1.0) : true
    if (isOptimal) {
      let msg = `✓ Perfect fat loss: losing fat while preserving muscle. Maintain ${cal} calories/day and ${prot}g protein.`
      if (cycle === 'maintain') msg = `⚠️ Misaligned: you're cutting effectively but in a Maintaining cycle. Either increase to maintenance (~${tdee} cal) or switch cycle to Cutting.`
      if (cycle === 'bulk') msg = `🚨 Misaligned: you're losing weight but in a Bulking cycle. Either increase to ~${tdee + 400} cal or switch cycle to Cutting.`
      if (hasCycleTarget && Number.isFinite(targetWeight) && Number.isFinite(weightToGoal) && weightToGoal > 2 && weeklyWeightLoss > 0) {
        const weeksToGoal = weightToGoal / weeklyWeightLoss
        notes.push(`At ~${fmtNum(weeklyWeightLoss, 1)}kg/week, you'll reach ${fmtNum(targetWeight, 1)}kg in ~${Math.ceil(weeksToGoal)} weeks.`)
      }
      if (hasCycleTarget && Number.isFinite(weightToGoal) && Math.abs(weightToGoal) <= 1) {
        notes.push(`✓ Almost at your goal weight of ${fmtNum(targetWeight, 1)}kg. Consider switching to Maintaining within 1–2 weeks.`)
      }
      return { level: 'green', title: 'Cutting (Optimal)', emoji: '✅', message: msg, warnings, notes }
    }
  }

  // Cutting (Conservative)
  if ((weightTrend.key === 'losing') && (!isBfKnown || bfTrend.key === 'decreasing') && strengthTrend.key === 'stable') {
    let msg = `Slow but safe cut at ~${cal} cal/day.`
    if (weeklyWeightLoss < 0.3) msg = `Safe but slow cut. Consider reducing to ~${Math.max(0, cal - 200)} cal/day to accelerate.`
    if (cycle === 'maintain') msg = `⚠️ Misaligned: you're cutting (slowly) but in a Maintaining cycle. Either increase to maintenance (~${tdee}) or switch to Cutting.`
    if (cycle === 'bulk') msg = `🚨 Misaligned: you're losing weight but in a Bulking cycle. Increase to ~${tdee + 400} immediately or switch to Cutting.`
    if (hasCycleTarget && Number.isFinite(weightToGoal) && weightToGoal > 5) {
      notes.push(`You're ${fmtNum(weightToGoal, 1)}kg from your goal of ${fmtNum(targetWeight, 1)}kg. Consider a slightly larger deficit to reach it sooner.`)
    }
    return { level: 'green', title: 'Cutting (Conservative)', emoji: '✅', message: msg, warnings, notes }
  }

  // Maintaining Successfully
  if (weightTrend.key === 'stable' && (!isBfKnown || bfTrend.key === 'stable' || bfTrend.key === 'decreasing') && (strengthTrend.key === 'stable' || strengthTrend.key === 'increasing')) {
    let msg = `✓ Solid maintenance at ~${cal} cal/day.`
    if (cycle === 'cut') msg = `⚠️ Misaligned: weight is stable but you're in a Cut cycle. Reduce to ~${Math.max(0, tdee - 500)} cal or switch cycle to Maintaining.`
    if (cycle === 'bulk') msg = `⚠️ Misaligned: weight is stable but you're in a Bulk cycle. Increase to ~${tdee + 400} cal or switch cycle to Maintaining.`
    addGoalNote()
    return { level: 'green', title: 'Maintaining Successfully', emoji: '✅', message: msg, warnings, notes }
  }

  // Fallback: show a conservative yellow status with best hints
  cycleMisalignmentHint()
  addGoalNote()
  return {
    level: 'yellow',
    title: 'Mixed Signals',
    emoji: '🟡',
    message: 'Trends are mixed across weight/body fat/strength. Keep logging consistently for another 1–2 weeks, then reassess.',
    warnings,
    notes,
  }
}

function computeStatusFromConfig(ctx, config) {
  const thresholds = config?.thresholds || {}
  const global = config?.global || {}

  const cal = Math.round(ctx.currentAvgCal || 0)
  const prot = Math.round(ctx.currentProtein || 0)
  const tdee = Math.round(ctx.calculatedTdee || 0)
  const base = Math.round(ctx.baselineTdee || 0)

  // Precompute some commonly used values for templates
  const tmplCtx = {
    ...ctx,
    t: thresholds,
    cal,
    prot,
    tdee,
    base,
    calMinus200: Math.max(0, cal - 200),
    calMinus250: Math.max(0, cal - 250),
    calMinus300: Math.max(0, cal - 300),
    calMinus400: Math.max(0, cal - 400),
    calPlus200: cal + 200,
    calPlus250: cal + 250,
    calPlus300: cal + 300,
    calPlus400: cal + 400,
    tdeeMinus500: Math.max(0, tdee - 500),
    tdeePlus300: tdee + 300,
    tdeePlus400: tdee + 400,
  }

  const status = evaluateRules(config || {}, tmplCtx)
  const warnings = Array.isArray(status.warnings) ? [...status.warnings] : []
  const notes = Array.isArray(status.notes) ? [...status.notes] : []

  const isBfKnown = ctx.bfTrend?.key && ctx.bfTrend.key !== 'unknown'
  const isStrKnown = ctx.strengthTrend?.key && ctx.strengthTrend.key !== 'unknown'

  // Global informational notes
  if (global?.missingSignalNotes) {
    if (!ctx.hasNavyAny || !ctx.hasNavyInWindow || !isBfKnown) {
      notes.push('Body fat trend is unavailable in this period. Add Navy measurements (neck/waist/hip) for more accurate status.')
    }
    if (!isStrKnown) {
      notes.push('Strength trend is unavailable. Log your big-3 lifts (bench/squat/deadlift) to improve accuracy.')
    }
  }

  // Built-in effects (optional, but configurable per status)
  const effects = Array.isArray(status.effects) ? status.effects : []

  const strings = config?.strings || {}
  const absToGoal = Number.isFinite(ctx.weightToGoal) ? Math.abs(ctx.weightToGoal) : null

  function applyGoalNote() {
    if (!global?.goalNotes) return
    const minKg = Number(thresholds?.goalNoteMinKgAway ?? 2)
    if (!ctx.hasCycleTarget || !Number.isFinite(ctx.targetWeight) || !Number.isFinite(ctx.currentWeight) || !Number.isFinite(absToGoal)) return
    if (absToGoal <= minKg) return
    if (ctx.directionToGoal === 'need to lose') {
      warnings.push(formatTemplate(strings?.goalNoteLose || `Note: You're {absToGoal:1}kg from your target of {targetWeight:1}kg. Consider switching to a Cut cycle if fat loss is the priority.`, { ...tmplCtx, absToGoal }))
    } else if (ctx.directionToGoal === 'need to gain') {
      warnings.push(formatTemplate(strings?.goalNoteGain || `Note: You're {absToGoal:1}kg from your target of {targetWeight:1}kg. Consider switching to a Bulk cycle if gaining is the priority.`, { ...tmplCtx, absToGoal }))
    }
  }

  function applyCycleMisalignmentHint() {
    if (!global?.cycleMisalignmentWarnings) return
    const cycle = ctx.cycle
    if (cycle === 'none') return
    const weightTrend = ctx.weightTrend?.key
    const bfTrend = ctx.bfTrend?.key
    const strengthTrend = ctx.strengthTrend?.key

    if (cycle === 'cut') {
      if (weightTrend === 'stable' || weightTrend === 'gaining' || weightTrend === 'rapid_gain' || (isBfKnown && (bfTrend === 'stable' || bfTrend === 'increasing'))) {
        warnings.push(strings?.cycleMisalignmentCut || '⚠️ Cycle misalignment: In a Cut cycle, weight should trend ↓ and body fat should trend ↓ over time.')
      }
    } else if (cycle === 'bulk') {
      if (weightTrend === 'stable' || weightTrend === 'losing' || weightTrend === 'rapid_loss' || (isStrKnown && strengthTrend === 'stable')) {
        warnings.push(strings?.cycleMisalignmentBulk || '⚠️ Cycle misalignment: In a Bulk cycle, weight should trend ↑ and strength should trend ↑ over time.')
      }
    } else if (cycle === 'maintain') {
      if (weightTrend === 'rapid_gain' || weightTrend === 'rapid_loss') {
        warnings.push(strings?.cycleMisalignmentMaintain || '⚠️ Cycle misalignment: In a Maintain cycle, weight should stay → (stable).')
      }
    }
  }

  for (const eff of effects) {
    if (eff === 'goalNote') applyGoalNote()
    if (eff === 'cycleMisalignmentHint') applyCycleMisalignmentHint()
  }

  return {
    ...status,
    warnings,
    notes,
  }
}

export default function DynamicStatusBanner({ derived, weekly, profile, currentCycle }) {
  const [rangeDays, setRangeDays] = useState(7)
  const [showInfo, setShowInfo] = useState(false)

  const { config: bannerConfig } = useDynamicStatusBannerConfig()

  const t = bannerConfig?.thresholds || {}
  const wStable = Number(t?.weight?.stableKgPerWeek ?? 0.2)
  const wRapid = Number(t?.weight?.rapidKgPerWeek ?? 1.0)
  const bfStable = Number(t?.bf?.stablePctPoints ?? 0.5)
  const sStable = Number(t?.strength?.stablePct ?? 2)
  const sInc = Number(t?.strength?.increasePct ?? 2)
  const sDec = Number(t?.strength?.declinePct ?? -2)
  const sRapid = Number(t?.strength?.rapidDeclinePct ?? -5)

  const computed = useMemo(() => {
    const thresholds = bannerConfig?.thresholds || {}
    const minDaysForAssessment = Number(thresholds?.minDaysForAssessment ?? 14)

    const data = Array.isArray(derived) ? derived : []
    const derivedLen = data.length
    if (!derivedLen) {
      return {
        rangeDays,
        status: {
          level: 'gray',
          title: 'Insufficient Data',
          emoji: '⏳',
          message: 'No data yet. Add your first entry to see your status.',
          warnings: [],
          notes: [],
        },
        cycle: 'none',
        cycleBadge: 'NO CYCLE',
        weightTrend: { sym: '—', label: 'Unknown', value: null, key: 'unknown' },
        bfTrend: { sym: '—', label: 'Unknown', value: null, key: 'unknown' },
        strengthTrend: { sym: '—', label: 'Unknown', value: null, key: 'unknown' },
        currentAvgCal: null,
        currentProtein: null,
        currentWeight: null,
        targetWeight: null,
        goalProgress: null,
      }
    }

    const endIso = data[data.length - 1].dateIso
    const cur = data.filter((d) => {
      const diff = daysBetween(endIso, d.dateIso)
      return diff >= 0 && diff <= (rangeDays - 1)
    })
    const prev = data.filter((d) => {
      const diff = daysBetween(endIso, d.dateIso)
      return diff >= rangeDays && diff <= (rangeDays * 2 - 1)
    })

    const wCur = avgFinite(cur.map((d) => (Number.isFinite(d?.wma?.weight) ? d.wma.weight : d.weight)))
    const wPrev = avgFinite(prev.map((d) => (Number.isFinite(d?.wma?.weight) ? d.wma.weight : d.weight)))
    const wDelta = (Number.isFinite(wCur) && Number.isFinite(wPrev)) ? (wCur - wPrev) * (7 / rangeDays) : null
    const weightTrend = classifyWeight(wDelta, thresholds)

    const bfCur = avgFinite(cur.map((d) => d.bfPct).filter(Number.isFinite))
    const bfPrev = avgFinite(prev.map((d) => d.bfPct).filter(Number.isFinite))
    const bfDelta = (Number.isFinite(bfCur) && Number.isFinite(bfPrev)) ? (bfCur - bfPrev) : null
    const bfTrend = classifyBf(bfDelta, thresholds)

    const sCur = avgFinite(cur.map((d) => d?.wma?.avgStrength).filter(Number.isFinite))
    const sPrev = avgFinite(prev.map((d) => d?.wma?.avgStrength).filter(Number.isFinite))
    const sPct = (Number.isFinite(sCur) && Number.isFinite(sPrev) && sPrev !== 0) ? ((sCur - sPrev) / sPrev) * 100 : null
    const strengthTrend = classifyStrength(sPct, thresholds)

    const currentAvgCal = avgFinite(cur.map((d) => d.calories).filter(Number.isFinite))
    const currentProtein = avgFinite(cur.map((d) => d.protein).filter(Number.isFinite))

    const last = data[data.length - 1]
    const currentWeight = Number.isFinite(last?.wma?.weight) ? last.wma.weight : last.weight

    // Current period weekly weight change (scaled to 7 days)
    let weeklyWeightChange = null
    if (cur.length >= 2) {
      const start = cur[0]
      const end = cur[cur.length - 1]
      const startW = Number.isFinite(start?.wma?.weight) ? start.wma.weight : start.weight
      const endW = Number.isFinite(end?.wma?.weight) ? end.wma.weight : end.weight
      if (Number.isFinite(startW) && Number.isFinite(endW)) {
        const days = Math.max(1, cur.length - 1)
        weeklyWeightChange = (endW - startW) * (7 / days)
      }
    }

    const weeklyWeightLoss = Number.isFinite(weeklyWeightChange) ? Math.max(0, -weeklyWeightChange) : null

    // Calculated TDEE (from real data) over selected period
    let calculatedTdee = null
    if (Number.isFinite(currentAvgCal) && Number.isFinite(weeklyWeightChange)) {
      const weeklyDeficit = (-weeklyWeightChange) * 7700 // if weight down -> positive deficit
      const dailyDeficit = weeklyDeficit / 7
      calculatedTdee = currentAvgCal + dailyDeficit
    }

    const baselineTdee = weekly?.baselineTdee ?? null
    const adaptationPct = (Number.isFinite(calculatedTdee) && Number.isFinite(baselineTdee) && baselineTdee !== 0)
      ? ((calculatedTdee - baselineTdee) / baselineTdee) * 100
      : null

    // Previous week TDEE and water-weight discrepancy (energy mismatch)
    const weeksArrForPrev = weekly?.weeks || []
    const prevWeekTdee = (weeksArrForPrev.length >= 2) ? weeksArrForPrev[weeksArrForPrev.length - 2]?.tdee : null
    let waterDiscrepancyKcal = null
    let expectedWeeklyChangeKg = null
    if (Number.isFinite(prevWeekTdee) && Number.isFinite(currentAvgCal) && Number.isFinite(weeklyWeightChange)) {
      const predictedEnergy = (prevWeekTdee - currentAvgCal) * 7
      const actualEnergy = (-weeklyWeightChange) * 7700
      waterDiscrepancyKcal = Math.abs(actualEnergy - predictedEnergy)
      expectedWeeklyChangeKg = (currentAvgCal - prevWeekTdee) * 7 / 7700
    }

    const baselineStrength = weekly?.baselineStrength ?? null
    const strengthDeclinePct = (Number.isFinite(baselineStrength) && Number.isFinite(sCur) && baselineStrength !== 0)
      ? ((baselineStrength - sCur) / baselineStrength) * 100
      : null

    // last known LBM
    let lbm = null
    for (let i = data.length - 1; i >= 0; i--) {
      if (Number.isFinite(data[i]?.lbm)) { lbm = data[i].lbm; break }
    }
    const lossRate = (Number.isFinite(lbm) && Number.isFinite(weeklyWeightLoss) && lbm > 0)
      ? (weeklyWeightLoss / lbm) * 100
      : null

    const proteinPerKg = (Number.isFinite(currentProtein) && Number.isFinite(currentWeight) && currentWeight > 0)
      ? (currentProtein / currentWeight)
      : null
    const targetProtein2g = Number.isFinite(currentWeight) ? (currentWeight * 2.0) : null

    // Days logged completeness (last 7 days, calendar-based from endIso)
    const last7 = data.filter((d) => {
      const diff = daysBetween(endIso, d.dateIso)
      return diff >= 0 && diff <= 6
    })
    const isComplete = (d) =>
      Number.isFinite(d.weight) && Number.isFinite(d.protein) && Number.isFinite(d.carbs) && Number.isFinite(d.fats)

    const daysLogged = last7.filter(isComplete).length
    const totalCompleteDays = data.filter(isComplete).length
    const daysRemaining = Math.max(0, minDaysForAssessment - totalCompleteDays)

    // Navy measurement availability
    const hasNavyAny = data.some((d) => Number.isFinite(d.neck) || Number.isFinite(d.waist) || Number.isFinite(d.hip) || Number.isFinite(d.bfPct))
    const hasNavyInWindow = cur.some((d) => Number.isFinite(d.bfPct))

    // Cycle + goal
    const cycle = cycleKey(currentCycle?.type)
    const hasCycleTarget = cycle !== 'maintain' && Number.isFinite(currentCycle?.targetWeightKg)
    const targetWeight = hasCycleTarget ? Number(currentCycle.targetWeightKg) : null
    const weightToGoal = (hasCycleTarget && Number.isFinite(targetWeight) && Number.isFinite(currentWeight)) ? (currentWeight - targetWeight) : null
    let directionToGoal = null
    if (Number.isFinite(weightToGoal)) {
      if (Math.abs(weightToGoal) <= 1) directionToGoal = 'at goal'
      else if (weightToGoal > 0) directionToGoal = 'need to lose'
      else directionToGoal = 'need to gain'
    }

    // Goal progress bar (cycle start -> target)
    let goalProgress = null
    if (hasCycleTarget && Number.isFinite(targetWeight) && currentCycle?.startDateIso) {
      const startEntry = data.find((d) => (d.dateIso || '') >= (currentCycle.startDateIso || ''))
      const startW = startEntry ? (Number.isFinite(startEntry?.wma?.weight) ? startEntry.wma.weight : startEntry.weight) : null
      if (Number.isFinite(startW) && Number.isFinite(currentWeight)) {
        const totalNeeded = Math.abs(startW - targetWeight)
        const prog = cycle === 'cut' ? (startW - currentWeight) : (currentWeight - startW)
        const progress = clamp(prog, 0, totalNeeded || 1)
        const pct = totalNeeded > 0 ? (progress / totalNeeded) * 100 : 0
        goalProgress = {
          startWeight: startW,
          totalNeeded,
          progress,
          pct: clamp(pct, 0, 100),
        }
      }
    }

    const status = computeStatusFromConfig({
      cycle,
      hasCycleTarget,
      currentAvgCal,
      currentProtein,
      proteinPerKg,
      targetProtein2g,
      currentWeight,
      targetWeight,
      weightToGoal,
      directionToGoal,
      derivedLen,
      daysLogged,
      daysRemaining,
      hasNavyAny,
      hasNavyInWindow,
      weightTrend,
      bfTrend,
      strengthTrend,
      lossRate,
      calculatedTdee,
      baselineTdee,
      adaptationPct,
      strengthDeclinePct,
      weeklyWeightChange,
      weeklyWeightLoss,
      prevWeekTdee,
      waterDiscrepancyKcal,
      expectedWeeklyChangeKg,
      weekly,
    }, bannerConfig)

    return {
      rangeDays,
      status,
      cycle,
      cycleBadge: cycleBadgeLabel(cycle),
      weightTrend,
      bfTrend,
      strengthTrend,
      currentAvgCal,
      currentProtein,
      currentWeight,
      targetWeight,
      weightToGoal,
      goalProgress,
      calculatedTdee,
      baselineTdee,
      adaptationPct,
      daysLogged,
      hasNavyAny,
      hasNavyInWindow,
      proteinPerKg,
      targetProtein2g,
      lossRate,
      weeklyWeightChange,
    }
  }, [derived, weekly, profile, currentCycle, rangeDays, bannerConfig])

  const { status } = computed

  const levelClass = status?.level || 'gray'
  const hasAccent = (status?.warnings || []).length > 0 && levelClass === 'green'

  return (
    <div className={`status-banner level-${levelClass}${hasAccent ? ' has-accent' : ''}`}>
      <div className="status-left">
        <div className="status-topline">
          <div className="status-title">
            <span style={{ marginRight: 8 }}>{status.emoji}</span>
            {status.title}
          </div>

          <div className={badgeClass(computed.cycle)}>
            {computed.cycleBadge}
          </div>
        </div>

        <div className="status-message">
          {status.message}
        </div>

        <div className="status-trends">
          <div className="trend-item">
            <span className="trend-k">Weight</span>
            <span className="trend-v">{computed.weightTrend.sym}</span>
            <span className="trend-n">{Number.isFinite(computed.weightTrend.value) ? `${fmtNum(computed.weightTrend.value, 1)} kg/wk` : '—'}</span>
          </div>

          <div className="trend-item">
            <span className="trend-k">Body fat</span>
            <span className="trend-v">{computed.bfTrend.sym}</span>
            <span className="trend-n">{Number.isFinite(computed.bfTrend.value) ? `${fmtNum(computed.bfTrend.value, 1)} %` : '—'}</span>
          </div>

          <div className="trend-item">
            <span className="trend-k">Strength</span>
            <span className="trend-v">{computed.strengthTrend.sym}</span>
            <span className="trend-n">{Number.isFinite(computed.strengthTrend.value) ? `${fmtNum(computed.strengthTrend.value, 1)} %` : '—'}</span>
          </div>

          {Number.isFinite(computed.currentAvgCal) && (
            <div className="trend-item">
              <span className="trend-k">Avg cal</span>
              <span className="trend-v">•</span>
              <span className="trend-n">{Math.round(computed.currentAvgCal)} /day</span>
            </div>
          )}

          {Number.isFinite(computed.proteinPerKg) && (
            <div className="trend-item">
              <span className="trend-k">Protein</span>
              <span className="trend-v">•</span>
              <span className="trend-n">{fmtNum(computed.proteinPerKg, 1)} g/kg</span>
            </div>
          )}
        </div>

        {computed.goalProgress && (
          <div className="status-goal">
            <div className="status-goal-text">
              Goal: {fmtNum(computed.targetWeight, 1)}kg • Progress: {fmtNum(computed.goalProgress.progress, 1)} / {fmtNum(computed.goalProgress.totalNeeded, 1)}kg
            </div>
            <div className="progress">
              <div className="progress-bar" style={{ width: `${computed.goalProgress.pct}%` }} />
            </div>
          </div>
        )}

        {!!status.warnings?.length && (
          <div className="status-warnings">
            {status.warnings.map((w, i) => (
              <div key={i} className="status-warning">{w}</div>
            ))}
          </div>
        )}

        {!!status.notes?.length && (
          <div className="status-notes">
            {status.notes.map((n, i) => (
              <div key={i} className="status-note">{n}</div>
            ))}
          </div>
        )}
      </div>

      <div className="status-right">
        <div className="status-controls">
          <select value={String(rangeDays)} onChange={(e) => setRangeDays(Number(e.target.value))}>
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
          </select>

          <button className="btn small icon" type="button" onClick={() => setShowInfo(true)} aria-label="How status is determined">
            ⓘ
          </button>
        </div>

        {Number.isFinite(computed.calculatedTdee) && Number.isFinite(computed.baselineTdee) && (
          <div className="status-mini">
            <div className="muted">TDEE</div>
            <div className="mini-row">
              <span>{Math.round(computed.baselineTdee)} → {Math.round(computed.calculatedTdee)} cal</span>
              {Number.isFinite(computed.adaptationPct) && (
                <span className="muted">({fmtNum(computed.adaptationPct, 1)}%)</span>
              )}
            </div>
          </div>
        )}

        {(computed.hasNavyAny && !computed.hasNavyInWindow) && (
          <div className="status-mini">
            <div className="muted">Body fat</div>
            <div className="mini-row">
              <span>Take measurements in this period</span>
            </div>
          </div>
        )}
      </div>

      {showInfo && (
        <div className="modal-backdrop" onClick={() => setShowInfo(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">How this status is determined</div>
              <button className="btn small" type="button" onClick={() => setShowInfo(false)}>Close</button>
            </div>

            <div className="modal-body">
              <p className="muted">
                Status compares the selected period to the previous period of the same length.
                Weight uses smoothed trend; calories & protein use raw averages.
              </p>

              <div className="modal-grid">
                <div>
                  <div className="modal-subtitle">Weight trend (kg/week)</div>
                  <ul className="modal-list">
                    <li>Stable: ±{fmtNum(wStable, 2)} or less</li>
                    <li>Losing/Gaining: &gt; {fmtNum(wStable, 2)}</li>
                    <li>Rapid loss/gain: &gt; {fmtNum(wRapid, 2)}</li>
                  </ul>
                </div>

                <div>
                  <div className="modal-subtitle">Body fat trend (% points)</div>
                  <ul className="modal-list">
                    <li>Stable: ±{fmtNum(bfStable, 2)} or less</li>
                    <li>Decreasing/Increasing: &gt; {fmtNum(bfStable, 2)}</li>
                  </ul>
                </div>

                <div>
                  <div className="modal-subtitle">Strength trend (% change)</div>
                  <ul className="modal-list">
                    <li>Stable: ±{fmtNum(sStable, 1)}% or less</li>
                    <li>Increasing: &gt; {fmtNum(sInc, 1)}%</li>
                    <li>Declining: &lt; {fmtNum(sDec, 1)}%</li>
                    <li>Rapid decline: &lt; {fmtNum(sRapid, 1)}%</li>
                  </ul>
                </div>

                <div>
                  <div className="modal-subtitle">Cycle expectations</div>
                  <ul className="modal-list">
                    <li><b>Cutting:</b> Weight ↓, Body fat ↓, Strength →</li>
                    <li><b>Bulking:</b> Weight ↑, Strength ↑, Body fat →/slight ↑</li>
                    <li><b>Maintaining:</b> Weight →, Strength →/↑, Body fat →/↓</li>
                  </ul>
                </div>
              </div>

              <p className="muted" style={{ marginTop: 12 }}>
                Recommendations use your logged averages and calculated TDEE. If you skip logs (or measurements),
                the banner will fall back to fewer signals and ask for more data.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
