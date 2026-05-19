import type { EdgeProps } from '@xyflow/react'

export interface DerivedFromEdgeProps extends EdgeProps {
  data?: Record<string, unknown>
}

export interface DerivedFromEdgeHook {
  isHovered:    boolean
  setIsHovered: (v: boolean) => void
  handleDelete: () => void
}
