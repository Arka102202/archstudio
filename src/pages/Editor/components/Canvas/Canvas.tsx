import React from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  ConnectionMode,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react'
import { CANVAS_MIN_ZOOM, CANVAS_MAX_ZOOM, CANVAS_GRID_SIZE } from '@constants/canvas'
import { MicroserviceNode } from '@components/nodes/MicroserviceNode'
import { EntityNode } from '@components/nodes/EntityNode'
import { DTONode } from '@components/nodes/DTONode'
import { DBNode } from '@components/nodes/DBNode'
import { TableNode } from '@components/nodes/TableNode'
import { ServiceNode } from '@components/nodes/ServiceNode'
import { ControllerNode } from '@components/nodes/ControllerNode'
import { APIEndpointNode } from '@components/nodes/APIEndpointNode'
import { CustomTypeNode } from '@components/nodes/CustomTypeNode'
import { DerivedFromEdge } from '@components/edges/DerivedFromEdge'
import { StoredInEdge } from '@components/edges/StoredInEdge'
import { ConnectsToEdge } from '@components/edges/ConnectsToEdge'
import { UsesEdge } from '@components/edges/UsesEdge'
import { InvokesEdge } from '@components/edges/InvokesEdge'
import { RoutesToEdge } from '@components/edges/RoutesToEdge'
import { AcceptsEdge } from '@components/edges/AcceptsEdge'
import { ReturnsEdge } from '@components/edges/ReturnsEdge'
import { EmbedsEdge } from '@components/edges/EmbedsEdge'
import { RelatesToEdge } from '@components/edges/RelatesToEdge'
import { UsesTypeEdge } from '@components/edges/UsesTypeEdge'
import { UsesCustomTypeEdge } from '@components/edges/UsesCustomTypeEdge'
import { useCanvas } from './useCanvas'
import type { CanvasProps } from './types'

// ─── Node type registry ───────────────────────────────────────────
// The key must match the `type` field on the RF node object.

const NODE_TYPES: NodeTypes = {
  microservice: MicroserviceNode,
  entity:       EntityNode,
  dto:          DTONode,
  db:           DBNode,
  table:        TableNode,
  service:      ServiceNode,
  controller:   ControllerNode,
  endpoint:    APIEndpointNode,
  customType:  CustomTypeNode,
} as const

// ─── Edge type registry ───────────────────────────────────────────

const EDGE_TYPES: EdgeTypes = {
  derivedFrom: DerivedFromEdge,
  storedIn:    StoredInEdge,
  connectsTo:  ConnectsToEdge,
  uses:        UsesEdge,
  invokes:     InvokesEdge,
  routesTo:    RoutesToEdge,
  accepts:     AcceptsEdge,
  returns:     ReturnsEdge,
  embeds:      EmbedsEdge,
  relatesTo:   RelatesToEdge,
  usesType:       UsesTypeEdge,
  usesCustomType: UsesCustomTypeEdge,
} as const

const Canvas = ({ projectId }: CanvasProps): React.JSX.Element => {
  const {
    rfNodes,
    rfEdges,
    isPanMode,
    onNodesChange,
    onEdgesChange,
    onNodeClick,
    onEdgeClick,
    onPaneClick,
    onConnect,
    onNodeDragStop,
    onDragOver,
    onDrop,
    onEdgeDoubleClick,
  } = useCanvas({ projectId })

  return (
    <div
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', overscrollBehavior: 'none' }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onEdgeDoubleClick={onEdgeDoubleClick}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        fitView
        minZoom={CANVAS_MIN_ZOOM}
        maxZoom={CANVAS_MAX_ZOOM}
        nodesDraggable={!isPanMode}
        connectionMode={ConnectionMode.Loose}
        panActivationKeyCode="Meta"
        panOnScroll
        panOnScrollSpeed={1.0}
        zoomOnScroll={false}
        deleteKeyCode={null}
        selectionKeyCode={null}
        isValidConnection={() => true}
        elevateNodesOnSelect={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={CANVAS_GRID_SIZE}
          color="var(--color-canvas-dot)"
        />
        <Controls />
      </ReactFlow>
    </div>
  )
}

export default Canvas
