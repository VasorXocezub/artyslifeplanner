import { useSyncExternalStore } from 'react'
import { subscribe, getState, getSettings } from './focusEngine'

export function useFocus() {
  return useSyncExternalStore(subscribe, getState)
}
export function usePomodoro() {
  return useSyncExternalStore(subscribe, () => (getSettings().pomodoro ? 1 : 0)) === 1
}
