import { useState, useEffect, useRef } from 'react'
import type React from 'react'
import type { ProjectCardProps, ProjectCardHook } from './types'

const timeAgo = (ts: number): string => {
  const diff = Date.now() - ts
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 1)  return 'just now'
  if (hours < 1) return `${mins}m ago`
  if (days < 1)  return `${hours}h ago`
  return `${days}d ago`
}

export const useProjectCard = (
  { onOpen, onDelete }: Pick<ProjectCardProps, 'onOpen' | 'onDelete'>
): ProjectCardHook => {
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false)
  const [isHovered,  setIsHovered]  = useState<boolean>(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isMenuOpen) return

    const handleMouseDown = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [isMenuOpen])

  const handleCardClick = (e: React.MouseEvent): void => {
    const target = e.target as HTMLElement
    if (target.closest('[data-menu]')) return
    onOpen()
  }

  const handleMenuToggle = (e: React.MouseEvent): void => {
    e.stopPropagation()
    setIsMenuOpen(prev => !prev)
  }

  const handleMenuOpen = (): void => {
    setIsMenuOpen(false)
    onOpen()
  }

  const handleMenuDelete = (): void => {
    setIsMenuOpen(false)
    onDelete()
  }

  return {
    isMenuOpen,
    isHovered,
    menuRef,
    timeAgo,
    handleCardClick,
    handleMenuToggle,
    handleMenuOpen,
    handleMenuDelete,
    setIsHovered,
  }
}
