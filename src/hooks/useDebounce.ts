import { useRef, useCallback } from 'react'

// ─── useDebounce ──────────────────────────────────────────────────
// Returns a debounced version of `fn` that delays execution by `delay` ms.
// The returned function is stable across renders (useCallback with empty deps).

export const useDebounce = <T extends unknown[]>(
  fn: (...args: T) => void,
  delay: number,
): ((...args: T) => void) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fnRef    = useRef(fn)
  fnRef.current  = fn

  return useCallback((...args: T): void => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      fnRef.current(...args)
    }, delay)
  }, [delay])
}
