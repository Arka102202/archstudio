import type { EdgeProps } from '@xyflow/react'

export interface UsesTypeEdgeProps extends EdgeProps {
  data?: Record<string, unknown>
}

export interface UsesTypeEdgeHook {
  isHovered:    boolean
  setIsHovered: (v: boolean) => void
  handleDelete: () => void
}
