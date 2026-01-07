export function toDateIso(d) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function parseDateIso(dateIso) {
  const [y, m, d] = dateIso.split('-').map(Number)
  return new Date(y, (m - 1), d, 12, 0, 0) // midday to avoid TZ edges
}

export function todayIso() {
  return toDateIso(new Date())
}

export function sortByDateIsoAsc(a, b) {
  return a.dateIso.localeCompare(b.dateIso)
}
