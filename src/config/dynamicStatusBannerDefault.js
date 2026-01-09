// Default (built-in) config for DynamicStatusBanner.
// Admins can override it from the Admin page; the app will deep-merge overrides.

export const DEFAULT_DYNAMIC_STATUS_BANNER_CONFIG = {
  version: 1,

  thresholds: {
    // Data requirements
    minDaysForAssessment: 14,
    minCompleteDaysThisWeek: 5,

    // Trend classifiers
    weight: {
      stableKgPerWeek: 0.2,
      rapidKgPerWeek: 1.0,
    },
    bf: {
      stablePctPoints: 0.5,
    },
    strength: {
      stablePct: 2,
      increasePct: 2,
      declinePct: -2,
      rapidDeclinePct: -5,
    },

    // Nutrition / physiology
    proteinPerKg: {
      low: 1.6,
      lowWarn: 1.8,
    },
    adaptation: {
      crashPct: -15,
      warnPct: -10,
    },

    // Body recomposition heuristics
    lossRatePctLbmPerWeek: {
      optimalMin: 0.5,
      optimalMax: 1.0,
      aggressiveWarn: 1.0,
    },
    slowWeeklyWeightLossKg: 0.3,

    // Water-weight check (kcal/week discrepancy)
    waterDiscrepancyKcalPerWeek: 3850,

    // Goal note threshold
    goalNoteMinKgAway: 2,
  },

  global: {
    missingSignalNotes: true,
    cycleMisalignmentWarnings: true,
    goalNotes: true,
  },

  strings: {
    cycleMisalignment: {
      cutting: '⚠️ Cycle misalignment: In a Cut cycle, weight should trend ↓ and body fat should trend ↓ over time.',
      bulking: '⚠️ Cycle misalignment: In a Bulk cycle, weight should trend ↑ and strength should trend ↑ over time.',
      maintaining: '⚠️ Cycle misalignment: In a Maintenance cycle, weight should stay stable and strength should stay stable or improve.',
    },
    goalNotes: {
      lose: 'Note: You are {absToGoal:1} kg away from your target of {targetWeight:1} kg. Consider switching to a Cut cycle if fat loss is the priority.',
      gain: 'Note: You are {absToGoal:1} kg away from your target of {targetWeight:1} kg. Consider switching to a Bulk cycle if gaining is the priority.',
    },
  },

  // First matching rule (lowest priority number) wins.
  // Expressions use a JSON-logic-like mini language (see src/utils/statusRuleEngine.js).
  statusRules: [
    {
      id: 'insufficient_data_this_week',
      priority: 0,
      enabled: true,
      level: 'gray',
      title: 'Insufficient Data',
      emoji: '⏳',
      when: { '<': [ { var: 'daysLogged' }, { var: 't.minCompleteDaysThisWeek' } ] },
      message: 'Only {daysLogged:0}/7 days logged this week. Add a few more entries to unlock accurate trend status.',
      notes: [
        { when: { 'and': [ { var: 'hasNavyAny' }, { '!': [ { var: 'hasNavyInWindow' } ] } ] }, text: 'Take body measurements in this period to improve body-fat accuracy.' },
        { when: { '!': [ { var: 'hasNavyAny' } ] }, text: 'Add your first Navy body measurements to start tracking body fat.' },
        { when: { '!': [ { var: 'cycle' } ] }, text: 'No active cycle set. Create a Cut / Bulk / Maintenance cycle for clearer expectations.' },
        'Aim for at least {t.minCompleteDaysThisWeek:0} logged days per week for reliable insights.'
      ],
    },

    {
      id: 'insufficient_data_window',
      priority: 1,
      enabled: true,
      level: 'gray',
      title: 'Insufficient Data',
      emoji: '⏳',
      when: {
        or: [
          { '<': [ { var: 'derivedLen' }, { var: 't.minDaysForAssessment' } ] },
          { '!': [ { finite: [ { var: 'baselineTdee' } ] } ] },
          { '!': [ { finite: [ { var: 'calculatedTdee' } ] } ] },
        ]
      },
      message: 'Need {daysRemaining:0} more days of consistent logging to assess status.',
      notes: [
        { when: { '!': [ { var: 'cycle' } ] }, text: 'No active cycle set. Create a Cut / Bulk / Maintenance cycle for clearer expectations.' },
        { when: { 'and': [ { var: 'hasNavyAny' }, { '!': [ { var: 'hasNavyInWindow' } ] } ] }, text: 'Take body measurements in this period to improve body-fat accuracy.' },
        { when: { '!': [ { var: 'hasNavyAny' } ] }, text: 'Add your first Navy body measurements to start tracking body fat.' },
      ],
    },

    {
      id: 'metabolic_crash',
      priority: 10,
      enabled: true,
      level: 'red',
      title: 'Metabolic Crash Risk',
      emoji: '🛑',
      when: {
        and: [
          { '<': [ { var: 'adaptationPct' }, { var: 't.adaptation.crashPct' } ] },
          { '==': [ { var: 'strengthTrend.key' }, 'rapid_decline' ] },
        ]
      },
      message: 'Your metabolism is adapting aggressively ({adaptationPct:1}%) and strength is dropping fast. Consider diet break / refeeds and reduce deficit.',
      warnings: [
        { when: { '<': [ { var: 'proteinPerKg' }, { var: 't.proteinPerKg.lowWarn' } ] }, text: 'Protein is low ({proteinPerKg:1} g/kg). Increase to protect lean mass.' },
      ],
      effects: ['cycleMisalignmentHint'],
    },

    {
      id: 'skinny_fat_trajectory',
      priority: 20,
      enabled: true,
      level: 'red',
      title: 'Skinny-Fat Trajectory',
      emoji: '⚠️',
      when: {
        and: [
          { var: 'isBfKnown' },
          { '!=': [ { var: 'weightTrend.key' }, 'gaining' ] },
          { '==': [ { var: 'bfTrend.key' }, 'increasing' ] },
          { in: [ { var: 'strengthTrend.key' }, ['declining', 'rapid_decline'] ] },
        ]
      },
      message: [
        { when: { '<': [ { var: 'proteinPerKg' }, { var: 't.proteinPerKg.lowWarn' } ] }, text: 'Body fat is rising while strength is falling — likely low protein and poor training stimulus. Increase protein and focus on progressive overload.' },
        { when: true, text: 'Body fat is rising while strength is falling — likely poor training stimulus. Tighten training, keep protein high, and avoid random dieting.' },
      ],
      warnings: [
        { when: { and: [ { var: 'hasCycleTarget' }, { finite: [ { var: 'targetWeight' } ] }, { finite: [ { var: 'currentWeight' } ] }, { '<': [ { var: 'currentWeight' }, { var: 'targetWeight' } ] } ] },
          text: 'Gaining weight won\'t move you toward your target. Consider switching to a Cut cycle.' },
      ],
      effects: ['cycleMisalignmentHint'],
    },

    {
      id: 'inadequate_protein_or_training',
      priority: 30,
      enabled: true,
      level: 'red',
      title: 'Muscle Loss Risk',
      emoji: '💥',
      when: {
        and: [
          { '==': [ { var: 'strengthTrend.key' }, 'rapid_decline' ] },
          { in: [ { var: 'weightTrend.key' }, ['losing', 'rapid_loss'] ] },
        ]
      },
      message: [
        { when: { '<': [ { var: 'proteinPerKg' }, { var: 't.proteinPerKg.lowWarn' } ] }, text: 'Strength is falling fast while losing weight — protein and training are likely insufficient. Increase protein and reduce deficit.' },
        { when: { '>': [ { var: 'strengthDeclinePct' }, 5 ] }, text: 'Strength is falling fast vs baseline. Reduce deficit and prioritize recovery (sleep + volume management).' },
        { when: true, text: 'Strength is falling fast while losing weight. Reduce deficit and review training stimulus and recovery.' },
      ],
      effects: ['cycleMisalignmentHint'],
    },

    {
      id: 'overfeeding_without_stimulus',
      priority: 40,
      enabled: true,
      level: 'red',
      title: 'Overfeeding Without Stimulus',
      emoji: '🍟',
      when: {
        and: [
          { var: 'isBfKnown' },
          { in: [ { var: 'weightTrend.key' }, ['gaining', 'rapid_gain'] ] },
          { '==': [ { var: 'bfTrend.key' }, 'increasing' ] },
          { '==': [ { var: 'strengthTrend.key' }, 'stable' ] },
        ]
      },
      message: 'Gaining weight but strength isn\'t improving, and body fat is rising. Reduce calories slightly and train harder (progressive overload).',
      effects: ['cycleMisalignmentHint'],
    },

    {
      id: 'detraining',
      priority: 50,
      enabled: true,
      level: 'red',
      title: 'Detraining / Under-Recovered',
      emoji: '😴',
      when: {
        and: [
          { var: 'isBfKnown' },
          { '==': [ { var: 'bfTrend.key' }, 'increasing' ] },
          { in: [ { var: 'strengthTrend.key' }, ['declining', 'rapid_decline'] ] },
        ]
      },
      message: 'Strength is declining and body fat is increasing — you may be under-recovered or inconsistent. Fix training consistency and recovery.',
      warnings: [
        { when: { and: [ { var: 'hasCycleTarget' }, { finite: [ { var: 'targetWeight' } ] }, { finite: [ { var: 'currentWeight' } ] }, { '<': [ { var: 'currentWeight' }, { var: 'targetWeight' } ] } ] },
          text: 'Gaining won\'t move you toward your target. Consider switching to a Cut cycle.' },
      ],
      effects: ['cycleMisalignmentHint', 'goalNote'],
    },

    {
      id: 'water_weight_discrepancy',
      priority: 60,
      enabled: true,
      level: 'yellow',
      title: 'Possible Water Weight',
      emoji: '💧',
      when: {
        and: [
          { finite: [ { var: 'waterDiscrepancyKcal' } ] },
          { '>': [ { var: 'waterDiscrepancyKcal' }, { var: 't.waterDiscrepancyKcalPerWeek' } ] },
        ]
      },
      message: 'Your scale change doesn\'t match the calorie deficit (likely water weight / sodium / stress). Stay consistent for 1–2 more weeks.',
      warnings: [
        'Expected weekly change (from last week TDEE): {expectedWeeklyChangeKg:2} kg',
        'Observed weekly change: {weeklyWeightChange:2} kg',
      ],
      effects: ['cycleMisalignmentHint', 'goalNote'],
    },

    {
      id: 'cutting_too_aggressive',
      priority: 70,
      enabled: true,
      level: 'yellow',
      title: 'Cutting Too Aggressively',
      emoji: '⚠️',
      when: {
        and: [
          { '==': [ { var: 'weightTrend.key' }, 'rapid_loss' ] },
          { in: [ { var: 'strengthTrend.key' }, ['declining', 'rapid_decline'] ] },
        ]
      },
      message: [
        { when: { '<': [ { var: 'proteinPerKg' }, { var: 't.proteinPerKg.lowWarn' } ] }, text: 'Weight loss is very fast and strength is dropping. Increase protein and reduce deficit.' },
        { when: { '>': [ { var: 'lossRate' }, { var: 't.lossRatePctLbmPerWeek.aggressiveWarn' } ] }, text: 'Your loss rate is aggressive ({lossRate:2}% LBM/week). Reduce deficit and prioritize strength maintenance.' },
        { when: true, text: 'Weight loss is very fast and strength is dropping. Reduce deficit and improve recovery.' },
      ],
      effects: ['cycleMisalignmentHint'],
    },

    {
      id: 'dirty_bulking',
      priority: 80,
      enabled: true,
      level: 'yellow',
      title: 'Dirty Bulking',
      emoji: '⚠️',
      when: {
        and: [
          { var: 'isBfKnown' },
          { '==': [ { var: 'weightTrend.key' }, 'rapid_gain' ] },
          { '==': [ { var: 'bfTrend.key' }, 'increasing' ] },
          { '==': [ { var: 'strengthTrend.key' }, 'increasing' ] },
        ]
      },
      message: 'Strength is improving, but weight and body fat are rising too fast. Reduce surplus slightly and keep training hard.',
      effects: ['cycleMisalignmentHint', 'goalNote'],
    },

    {
      id: 'spinning_wheels',
      priority: 90,
      enabled: true,
      level: 'yellow',
      title: 'Spinning Wheels',
      emoji: '🔄',
      when: {
        and: [
          { '==': [ { var: 'weightTrend.key' }, 'stable' ] },
          { or: [ { '!': [ { var: 'isBfKnown' } ] }, { '==': [ { var: 'bfTrend.key' }, 'stable' ] } ] },
          { or: [ { '!': [ { var: 'isStrKnown' } ] }, { '==': [ { var: 'strengthTrend.key' }, 'stable' ] } ] },
        ]
      },
      message: [
        { when: { '==': [ { var: 'cycle' }, 'cutting' ] }, text: 'No progress in a Cut. Reduce calories by ~200 and increase activity.' },
        { when: { '==': [ { var: 'cycle' }, 'bulking' ] }, text: 'No progress in a Bulk. Increase calories by ~200 and push progressive overload.' },
        { when: true, text: 'No clear progress. Adjust calories slightly and ensure training is progressing.' },
      ],
      warnings: [
        { when: { '<': [ { var: 'adaptationPct' }, { var: 't.adaptation.warnPct' } ] }, text: 'Metabolic adaptation is notable ({adaptationPct:1}%). Consider a short diet break.' },
      ],
      effects: ['goalNote'],
    },

    {
      id: 'recomping',
      priority: 100,
      enabled: true,
      level: 'green',
      title: 'Recomping',
      emoji: '✅',
      when: {
        and: [
          { '==': [ { var: 'weightTrend.key' }, 'stable' ] },
          { '==': [ { var: 'bfTrend.key' }, 'decreasing' ] },
          { '==': [ { var: 'strengthTrend.key' }, 'increasing' ] },
        ]
      },
      message: 'Body fat is dropping while strength is improving at stable weight. Keep calories steady and maintain training progression.',
      effects: ['goalNote'],
    },

    {
      id: 'lean_bulking',
      priority: 110,
      enabled: true,
      level: 'green',
      title: 'Lean Bulking',
      emoji: '🟢',
      when: {
        and: [
          { '==': [ { var: 'weightTrend.key' }, 'gaining' ] },
          { '==': [ { var: 'strengthTrend.key' }, 'increasing' ] },
          { or: [ { '!': [ { var: 'isBfKnown' } ] }, { in: [ { var: 'bfTrend.key' }, ['stable', 'increasing'] ] } ] },
        ]
      },
      message: [
        { when: { '==': [ { var: 'cycle' }, 'cutting' ] }, text: 'You are gaining weight in a Cut cycle. Consider switching to Bulk / Maintenance if this is intentional.' },
        { when: true, text: 'Weight and strength are increasing. Keep surplus modest and keep protein high.' },
      ],
    },

    {
      id: 'cutting_optimal',
      priority: 120,
      enabled: true,
      level: 'green',
      title: 'Cutting (On Track)',
      emoji: '🟢',
      when: {
        and: [
          { '==': [ { var: 'weightTrend.key' }, 'losing' ] },
          { or: [ { '!': [ { var: 'isBfKnown' } ] }, { '==': [ { var: 'bfTrend.key' }, 'decreasing' ] } ] },
          { in: [ { var: 'strengthTrend.key' }, ['stable', 'increasing'] ] },
          { '>=': [ { var: 'lossRate' }, { var: 't.lossRatePctLbmPerWeek.optimalMin' } ] },
          { '<=': [ { var: 'lossRate' }, { var: 't.lossRatePctLbmPerWeek.optimalMax' } ] },
        ]
      },
      message: 'You are losing weight at a healthy rate while maintaining strength. Keep doing what you\'re doing.',
    },

    {
      id: 'cutting_conservative',
      priority: 130,
      enabled: true,
      level: 'green',
      title: 'Cutting (Conservative)',
      emoji: '🟢',
      when: {
        and: [
          { '==': [ { var: 'weightTrend.key' }, 'losing' ] },
          { '==': [ { var: 'bfTrend.key' }, 'decreasing' ] },
          { '==': [ { var: 'strengthTrend.key' }, 'stable' ] },
        ]
      },
      message: [
        { when: { '<': [ { var: 'weeklyWeightLoss' }, { var: 't.slowWeeklyWeightLossKg' } ] }, text: 'Your cut is working but slowly. If you want faster progress, reduce calories by ~100–200.' },
        { when: true, text: 'Your cut is working. Keep going.' },
      ],
    },

    {
      id: 'maintaining',
      priority: 140,
      enabled: true,
      level: 'green',
      title: 'Maintaining Successfully',
      emoji: '🟢',
      when: {
        and: [
          { '==': [ { var: 'weightTrend.key' }, 'stable' ] },
          { or: [ { '!': [ { var: 'isBfKnown' } ] }, { in: [ { var: 'bfTrend.key' }, ['stable', 'decreasing'] ] } ] },
          { in: [ { var: 'strengthTrend.key' }, ['stable', 'increasing'] ] },
        ]
      },
      message: 'You\'re maintaining weight while holding strength. Great base to start a focused cut or bulk.',
      effects: ['goalNote'],
    },
  ],

  fallbackStatus: {
    level: 'yellow',
    title: 'Mixed Signals',
    emoji: '🟡',
    message: 'Trends are mixed. Focus on consistent logging and one clear goal (cut, bulk, or maintain) for the next 2 weeks.',
  },
}
