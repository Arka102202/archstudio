import type { EdgeProps } from '@xyflow/react'

export interface ConnectsToEdgeProps extends EdgeProps {
  data?: Record<string, unknown>
}

export interface ConnectsToEdgeHook {
  isHovered:    boolean
  setIsHovered: (v: boolean) => void
  handleDelete: () => void
}
