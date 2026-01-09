// A tiny, dependency-free rule engine for runtime-configurable app logic.
// Used by DynamicStatusBanner so admins can configure thresholds + triggers.

export function deepMerge(base, override) {
  if (override == null) return base
  if (Array.isArray(base) || Array.isArray(override)) {
    // Arrays are replaced, not merged.
    return Array.isArray(override) ? override : base
  }
  if (typeof base !== 'object' || typeof override !== 'object') return override
  const out = { ...base }
  for (const k of Object.keys(override)) {
    out[k] = deepMerge(base?.[k], override[k])
  }
  return out
}

export function getPath(obj, path, fallback = undefined) {
  if (!path) return fallback
  const parts = String(path).split('.')
  let cur = obj
  for (const p of parts) {
    if (cur == null) return fallback
    cur = cur[p]
  }
  return cur === undefined ? fallback : cur
}

function truthy(v) {
  if (Number.isNaN(v)) return false
  return !!v
}

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v)
}

export function evalExpr(expr, ctx) {
  if (expr == null) return true
  if (typeof expr === 'boolean') return expr
  if (typeof expr === 'number') return expr
  if (typeof expr === 'string') return expr
  if (Array.isArray(expr)) return expr.map((e) => evalExpr(e, ctx))
  if (typeof expr !== 'object') return false

  const keys = Object.keys(expr)
  if (keys.length !== 1) return false
  const op = keys[0]
  const args = expr[op]

  const a = Array.isArray(args) ? args : [args]

  switch (op) {
    case 'var': {
      const path = a[0]
      const fallback = a.length > 1 ? a[1] : undefined
      return getPath(ctx, path, fallback)
    }
    case '!':
    case 'not':
      return !truthy(evalExpr(a[0], ctx))
    case 'and':
      return a.every((x) => truthy(evalExpr(x, ctx)))
    case 'or':
      return a.some((x) => truthy(evalExpr(x, ctx)))

    case '==':
    case 'eq': {
      const left = evalExpr(a[0], ctx)
      const right = evalExpr(a[1], ctx)
      return left === right
    }
    case '!=': {
      const left = evalExpr(a[0], ctx)
      const right = evalExpr(a[1], ctx)
      return left !== right
    }
    case '<':
    case '<=':
    case '>':
    case '>=': {
      const left = evalExpr(a[0], ctx)
      const right = evalExpr(a[1], ctx)
      if (!isFiniteNumber(left) || !isFiniteNumber(right)) return false
      if (op === '<') return left < right
      if (op === '<=') return left <= right
      if (op === '>') return left > right
      return left >= right
    }

    case 'in': {
      const needle = evalExpr(a[0], ctx)
      const hay = evalExpr(a[1], ctx)
      if (Array.isArray(hay)) return hay.includes(needle)
      if (typeof hay === 'string') return String(hay).includes(String(needle))
      return false
    }

    case 'finite': {
      const v = evalExpr(a[0], ctx)
      return isFiniteNumber(v)
    }
    case 'abs': {
      const v = evalExpr(a[0], ctx)
      return isFiniteNumber(v) ? Math.abs(v) : NaN
    }
    case 'min': {
      const vals = a.map((x) => evalExpr(x, ctx)).filter(isFiniteNumber)
      return vals.length ? Math.min(...vals) : NaN
    }
    case 'max': {
      const vals = a.map((x) => evalExpr(x, ctx)).filter(isFiniteNumber)
      return vals.length ? Math.max(...vals) : NaN
    }

    // Basic arithmetic (useful for rule conditions or template-derived fields)
    case '+': {
      const vals = a.map((x) => evalExpr(x, ctx))
      if (!vals.every(isFiniteNumber)) return NaN
      return vals.reduce((s, v) => s + v, 0)
    }
    case '-': {
      const left = evalExpr(a[0], ctx)
      const right = evalExpr(a[1], ctx)
      if (!isFiniteNumber(left) || !isFiniteNumber(right)) return NaN
      return left - right
    }
    case '*': {
      const vals = a.map((x) => evalExpr(x, ctx))
      if (!vals.every(isFiniteNumber)) return NaN
      return vals.reduce((p, v) => p * v, 1)
    }
    case '/': {
      const left = evalExpr(a[0], ctx)
      const right = evalExpr(a[1], ctx)
      if (!isFiniteNumber(left) || !isFiniteNumber(right) || right === 0) return NaN
      return left / right
    }

    default:
      return false
  }
}

function formatValue(v, spec) {
  if (v == null) return '—'
  if (typeof v === 'string') return v
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (Number.isNaN(v)) return '—'
  if (!isFiniteNumber(v)) return String(v)

  const dec = spec != null ? Number(spec) : null
  if (Number.isFinite(dec)) return v.toFixed(Math.max(0, Math.min(6, dec)))
  return String(v)
}

// Template format: "... {path.to.value:1} ..." (optional :decimals)
export function formatTemplate(text, ctx) {
  if (typeof text !== 'string') return ''
  return text.replace(/\{([a-zA-Z0-9_$.]+)(?::([0-9]+))?\}/g, (_, path, spec) => {
    const v = getPath(ctx, path, undefined)
    return formatValue(v, spec)
  })
}

export function pickText(messageSpec, ctx) {
  if (typeof messageSpec === 'string') return formatTemplate(messageSpec, ctx)
  if (!Array.isArray(messageSpec)) return ''
  for (const item of messageSpec) {
    if (typeof item === 'string') return formatTemplate(item, ctx)
    if (item && typeof item === 'object') {
      const ok = item.when == null ? true : truthy(evalExpr(item.when, ctx))
      if (ok) return formatTemplate(item.text || '', ctx)
    }
  }
  return ''
}

export function resolveTextList(listSpec, ctx) {
  if (!Array.isArray(listSpec)) return []
  const out = []
  for (const item of listSpec) {
    if (typeof item === 'string') {
      const t = formatTemplate(item, ctx)
      if (t) out.push(t)
      continue
    }
    if (item && typeof item === 'object') {
      const ok = item.when == null ? true : truthy(evalExpr(item.when, ctx))
      if (!ok) continue
      const t = formatTemplate(item.text || '', ctx)
      if (t) out.push(t)
    }
  }
  return out
}

export function evaluateRules(rulesOrConfig, ctx, fallbackStatusOverride = null) {
  // Backwards-compatible signature:
  // - evaluateRules({ statusRules, fallbackStatus }, ctx)
  // - evaluateRules(statusRulesArray, ctx, fallbackStatus)
  const cfgIsArray = Array.isArray(rulesOrConfig)
  const rules = cfgIsArray
    ? (Array.isArray(rulesOrConfig) ? rulesOrConfig : [])
    : (Array.isArray(rulesOrConfig?.statusRules) ? rulesOrConfig.statusRules : [])

  const fallbackStatus = cfgIsArray ? fallbackStatusOverride : (rulesOrConfig?.fallbackStatus ?? null)

  const enabledRules = (rules || [])
    .filter((r) => r && r.id)
    .filter((r) => r.enabled !== false)
    .slice()
    .sort((a, b) => Number(a.priority ?? 9999) - Number(b.priority ?? 9999))

  for (const rule of enabledRules) {
    const ok = rule.when == null ? true : truthy(evalExpr(rule.when, ctx))
    if (!ok) continue

    return {
      id: rule.id,
      level: rule.level || 'gray',
      title: formatTemplate(rule.title || 'Status', ctx),
      emoji: formatTemplate(rule.emoji || '•', ctx),
      message: pickText(rule.message, ctx),
      warnings: resolveTextList(rule.warnings, ctx),
      notes: resolveTextList(rule.notes, ctx),
      effects: Array.isArray(rule.effects) ? rule.effects.slice() : [],
    }
  }

  const fb = fallbackStatus
  if (fb) {
    return {
      id: 'fallback',
      level: fb.level || 'gray',
      title: formatTemplate(fb.title || 'Status', ctx),
      emoji: formatTemplate(fb.emoji || '•', ctx),
      message: pickText(fb.message, ctx),
      warnings: resolveTextList(fb.warnings, ctx),
      notes: resolveTextList(fb.notes, ctx),
      effects: Array.isArray(fb.effects) ? fb.effects.slice() : [],
    }
  }

  return {
    id: 'fallback',
    level: 'gray',
    title: 'Status',
    emoji: '•',
    message: '',
    warnings: [],
    notes: [],
    effects: [],
  }
}


export function validateDynamicStatusBannerConfig(cfg) {
  const errors = []
  if (!cfg || typeof cfg !== 'object') {
    errors.push('Config must be an object.')
    return errors
  }
  if (!('thresholds' in cfg) || typeof cfg.thresholds !== 'object') {
    errors.push('Missing "thresholds" object.')
  }
  if (!Array.isArray(cfg.statusRules)) {
    errors.push('Missing "statusRules" array.')
  } else {
    for (const r of cfg.statusRules) {
      if (!r || typeof r !== 'object') {
        errors.push('Each rule must be an object.')
        break
      }
      if (!r.id) errors.push('A rule is missing "id".')
      if (!r.level) errors.push(`Rule ${r.id || '(unknown)'} is missing "level".`)
      if (!r.title) errors.push(`Rule ${r.id || '(unknown)'} is missing "title".`)
      if (!r.emoji) errors.push(`Rule ${r.id || '(unknown)'} is missing "emoji".`)
      if (r.message == null) errors.push(`Rule ${r.id || '(unknown)'} is missing "message".`)
    }
  }
  return errors
}
