import React from 'react'
import { useThemeToggle } from './useThemeToggle'

const ThemeToggle = (): React.JSX.Element => {
  const { isDark, toggle } = useThemeToggle()

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex items-center justify-center w-8 h-8 bg-surface-alt border border-border rounded-sm cursor-pointer text-base shrink-0"
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  )
}

export default ThemeToggle
