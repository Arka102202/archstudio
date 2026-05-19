import type { EdgeProps } from '@xyflow/react'

export interface AcceptsEdgeProps extends EdgeProps {
  data?: Record<string, unknown>
}

export interface AcceptsEdgeHook {
  isHovered:    boolean
  setIsHovered: (v: boolean) => void
  handleDelete: () => void
}
