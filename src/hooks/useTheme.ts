import { useState, useEffect } from 'react'

export function useTheme(): 'dark' | 'light' {
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    document.documentElement.dataset['theme'] === 'dark' ? 'dark' : 'light'
  )

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(
        document.documentElement.dataset['theme'] === 'dark' ? 'dark' : 'light'
      )
    })
    observer.observe(document.documentElement, {
      attributes:      true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])

  return theme
}
