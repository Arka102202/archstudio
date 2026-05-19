import React from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react'
import { useEmbedsEdge } from './useEmbedsEdge'
import type { EmbedsEdgeProps } from './types'

const EmbedsEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
}: EmbedsEdgeProps): React.JSX.Element => {
  const { isHovered, setIsHovered, handleDelete } = useEmbedsEdge(id)

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const markerEnd = 'url(#embeds-arrow)'

  return (
    <>
      <defs>
        <marker
          id="embeds-arrow"
          markerWidth="6"
          markerHeight="5"
          refX="5"
          refY="2.5"
          orient="auto"
        >
          <path d="M 0 0 L 6 2.5 L 0 5 z" fill="var(--node-entity-accent)" />
        </marker>
      </defs>

      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke:      'var(--node-entity-accent)',
          strokeWidth: selected ? 2.5 : 1.5,
          opacity:     selected ? 1.0 : 0.8,
        }}
      />

      <EdgeLabelRenderer>
        <div
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
          className="absolute pointer-events-auto nopan"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onDoubleClick={handleDelete}
        >
          <span
            className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm bg-surface border border-[var(--color-border)] flex items-center gap-1"
            style={{ color: 'var(--node-entity-accent)' }}
          >
            EMBEDS
            {isHovered && (
              <span
                className="cursor-pointer opacity-60 hover:opacity-100 leading-none"
                onClick={(e) => { e.stopPropagation(); handleDelete() }}
              >
                ×
              </span>
            )}
          </span>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

export default EmbedsEdge
