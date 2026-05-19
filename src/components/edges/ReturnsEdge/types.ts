import type { EdgeProps } from '@xyflow/react'

export interface ReturnsEdgeProps extends EdgeProps {
  data?: Record<string, unknown>
}

export interface ReturnsEdgeHook {
  isHovered:    boolean
  setIsHovered: (v: boolean) => void
  handleDelete: () => void
}
