import { useState, useEffect } from 'react'

/**
 * Bir değerin güncellenmesini belirtilen süre (ms) kadar geciktirir.
 * Kullanım: arama inputlarında her tuş vuruşunda API çağrısını önler.
 *
 * @example
 * const debouncedSearch = useDebounce(searchInput, 400)
 * // debouncedSearch yalnızca 400ms sessizlik sonrası güncellenir
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}
