import type { EdgeProps } from '@xyflow/react'

export interface UsesEdgeProps extends EdgeProps {
  data?: Record<string, unknown>
}

export interface UsesEdgeHook {
  isHovered:    boolean
  setIsHovered: (v: boolean) => void
  handleDelete: () => void
}
