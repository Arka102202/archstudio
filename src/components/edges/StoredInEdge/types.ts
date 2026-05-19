import type { EdgeProps } from '@xyflow/react'

export interface StoredInEdgeProps extends EdgeProps {
  data?: Record<string, unknown>
}

export interface StoredInEdgeHook {
  isHovered:    boolean
  setIsHovered: (v: boolean) => void
  handleDelete: () => void
}
