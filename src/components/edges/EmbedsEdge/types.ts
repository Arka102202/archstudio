import type { EdgeProps } from '@xyflow/react'

export interface EmbedsEdgeProps extends EdgeProps {
  data?: Record<string, unknown>
}

export interface EmbedsEdgeHook {
  isHovered:    boolean
  setIsHovered: (v: boolean) => void
  handleDelete: () => void
}
