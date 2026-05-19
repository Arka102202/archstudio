import type { EdgeProps } from '@xyflow/react'

export interface UsesCustomTypeEdgeProps extends EdgeProps {
  data?: Record<string, unknown>
}

export interface UsesCustomTypeEdgeHook {
  isHovered:    boolean
  setIsHovered: (v: boolean) => void
  handleDelete: () => void
}
