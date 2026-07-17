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

export function getWellnessGoals() {
  try {
    const stored = JSON.parse(localStorage.getItem('wellnessGoals') || 'null')
    return { water: 8, calories: 1900, steps: 10000, ...stored }
  } catch {
    return { water: 8, calories: 1900, steps: 10000 }
  }
}
export function setWellnessGoals(goals) {
  localStorage.setItem('wellnessGoals', JSON.stringify(goals))
}

export function getHiddenBraindumpTabs() {
  try {
    return JSON.parse(localStorage.getItem('hiddenBraindumpTabs') || '[]')
  } catch {
    return []
  }
}
export function setHiddenBraindumpTabs(arr) {
  localStorage.setItem('hiddenBraindumpTabs', JSON.stringify(arr))
}

export function getHiddenGlowupTabs() {
  try {
    return JSON.parse(localStorage.getItem('hiddenGlowupTabs') || '[]')
  } catch {
    return []
  }
}
export function setHiddenGlowupTabs(arr) {
  localStorage.setItem('hiddenGlowupTabs', JSON.stringify(arr))
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
