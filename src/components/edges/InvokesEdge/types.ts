import type { EdgeProps } from '@xyflow/react'

export interface InvokesEdgeProps extends EdgeProps {
  data?: Record<string, unknown>
}

export interface InvokesEdgeHook {
  isHovered:    boolean
  setIsHovered: (v: boolean) => void
  handleDelete: () => void
}
