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
