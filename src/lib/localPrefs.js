export function getDisplayName() {
  return localStorage.getItem('displayName') || ''
}
export function setDisplayName(name) {
  localStorage.setItem('displayName', name)
}
export function getCurrency() {
  return localStorage.getItem('currency') || 'ZAR'
}
export function setCurrency(code) {
  localStorage.setItem('currency', code)
}
export function getLocation() {
  try {
    return JSON.parse(localStorage.getItem('location') || 'null')
  } catch {
    return null
  }
}
export function setLocation(loc) {
  localStorage.setItem('location', JSON.stringify(loc))
}

export function getEra() {
  return localStorage.getItem('era') || 'soft_life'
}
export function setEra(era) {
  localStorage.setItem('era', era)
}

export function getHiddenModules() {
  try {
    return JSON.parse(localStorage.getItem('hiddenModules') || '[]')
  } catch {
    return []
  }
}
export function setHiddenModules(arr) {
  localStorage.setItem('hiddenModules', JSON.stringify(arr))
}
