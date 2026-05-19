import type { EdgeProps } from '@xyflow/react'

export interface RelatesToEdgeProps extends EdgeProps {
  data?: Record<string, unknown>
}

export interface RelatesToEdgeHook {
  isHovered:    boolean
  setIsHovered: (v: boolean) => void
  handleDelete: () => void
  relationLabel: string
}
