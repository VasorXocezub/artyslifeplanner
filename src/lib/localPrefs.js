export function getReadingGoal() {
  return parseInt(localStorage.getItem('readingGoal') || '25', 10)
}
export function setReadingGoal(n) {
  localStorage.setItem('readingGoal', String(n))
}

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

export function getHiddenTodoTabs() {
  try {
    return JSON.parse(localStorage.getItem('hiddenTodoTabs') || '[]')
  } catch {
    return []
  }
}
export function setHiddenTodoTabs(arr) {
  localStorage.setItem('hiddenTodoTabs', JSON.stringify(arr))
}

export function getHiddenShoppingTabs() {
  try {
    return JSON.parse(localStorage.getItem('hiddenShoppingTabs') || '[]')
  } catch {
    return []
  }
}
export function setHiddenShoppingTabs(arr) {
  localStorage.setItem('hiddenShoppingTabs', JSON.stringify(arr))
}

export function getHiddenFinanceTabs() {
  try {
    return JSON.parse(localStorage.getItem('hiddenFinanceTabs') || '[]')
  } catch {
    return []
  }
}
export function setHiddenFinanceTabs(arr) {
  localStorage.setItem('hiddenFinanceTabs', JSON.stringify(arr))
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
