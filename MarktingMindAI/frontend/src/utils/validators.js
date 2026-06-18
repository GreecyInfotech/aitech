export function isNonEmpty(value, minLength = 1) {
  return typeof value === 'string' && value.trim().length >= minLength
}

export function isEmail(value) {
  if (typeof value !== 'string') {
    return false
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export function isHttpUrl(value) {
  if (typeof value !== 'string') {
    return false
  }
  try {
    const parsed = new URL(value.trim())
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function isDateRangeValid(start, end) {
  if (!start || !end) {
    return true
  }
  return start <= end
}

export function isMonthRangeValid(startMonth, endMonth) {
  if (!startMonth || !endMonth) {
    return true
  }
  return startMonth <= endMonth
}
