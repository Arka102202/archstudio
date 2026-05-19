import type { Project } from '@entity'

export interface ProjectCardProps {
  project:     Project
  accentColor: string
  onOpen:      () => void
  onDelete:    () => void
}

export interface ProjectCardHook {
  isMenuOpen:       boolean
  isHovered:        boolean
  menuRef:          React.RefObject<HTMLDivElement | null>
  timeAgo:          (ts: number) => string
  handleCardClick:  (e: React.MouseEvent) => void
  handleMenuToggle: (e: React.MouseEvent) => void
  handleMenuOpen:   () => void
  handleMenuDelete: () => void
  setIsHovered:     (v: boolean) => void
}
