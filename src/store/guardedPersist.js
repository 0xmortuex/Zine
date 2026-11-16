import { toast } from './useToasts.js'
import { describeRepair, describeUnreadable } from './persistedState.js'

/**
 * Options for zustand's persist() that validate what comes out of storage
 * instead of trusting it (the rules live in persistedState.js).
 *
 * When something had to be repaired — or the saved blob could not be parsed
 * at all — the user is told once, in a toast that stays until dismissed,
 * and the repaired state is written straight back so the same notice does
 * not greet them on every later visit.
 *
 * @param {string} name storage key
 * @param {'settings' | 'library'} kind
 * @param {(persisted: unknown, current: object) => { state: object, repaired: string[] }} merge
 * @param {() => { setState: Function }} getStore lazy: the store does not exist yet while it hydrates
 */
export function guardedPersist(name, kind, merge, getStore) {
  function announce(message, error) {
    console.warn(`[zine] ${message}`, error ?? '')
    toast(message, { kind: 'error', duration: null })
    // An empty update changes nothing but makes persist() save the state
    // the app is actually running with.
    queueMicrotask(() => getStore().setState({}))
  }

  return {
    name,
    merge: (persisted, current) => {
      const { state, repaired } = merge(persisted, current)
      if (repaired.length > 0) announce(describeRepair(kind, repaired))
      return state
    },
    onRehydrateStorage: () => (_state, error) => {
      if (error) announce(describeUnreadable(kind), error)
    },
  }
}
