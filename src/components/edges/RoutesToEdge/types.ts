import type { EdgeProps } from '@xyflow/react'

export interface RoutesToEdgeProps extends EdgeProps {
  data?: Record<string, unknown>
}

export interface RoutesToEdgeHook {
  isHovered:    boolean
  setIsHovered: (v: boolean) => void
  handleDelete: () => void
}
