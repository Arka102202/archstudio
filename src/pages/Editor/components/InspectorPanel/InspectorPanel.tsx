import React from 'react'
import { NodeType } from '@entity'
import { useInspectorPanel } from './useInspectorPanel'
import { MicroserviceInspector } from './components/MicroserviceInspector'
import { EntityInspector } from './components/EntityInspector'
import { DTOInspector } from './components/DTOInspector'
import { DBInspector } from './components/DBInspector'
import { TableInspector } from './components/TableInspector'
import { ServiceInspector } from './components/ServiceInspector'
import { ControllerInspector } from './components/ControllerInspector'
import { APIEndpointInspector } from './components/APIEndpointInspector'
import { CustomTypeInspector } from './components/CustomTypeInspector'

const InspectorPanel = (): React.JSX.Element | null => {
  const { selectedNodeId, nodeType, isOpen } = useInspectorPanel()

  if (!isOpen || !selectedNodeId) return null

  switch (nodeType) {
    case NodeType.MICROSERVICE:
      return <MicroserviceInspector key={selectedNodeId} nodeId={selectedNodeId} />
    case NodeType.ENTITY:
      return <EntityInspector key={selectedNodeId} nodeId={selectedNodeId} />
    case NodeType.DTO:
      return <DTOInspector key={selectedNodeId} nodeId={selectedNodeId} />
    case NodeType.DB:
      return <DBInspector key={selectedNodeId} nodeId={selectedNodeId} />
    case NodeType.TABLE:
      return <TableInspector key={selectedNodeId} nodeId={selectedNodeId} />
    case NodeType.SERVICE:
      return <ServiceInspector key={selectedNodeId} nodeId={selectedNodeId} />
    case NodeType.CONTROLLER:
      return <ControllerInspector key={selectedNodeId} nodeId={selectedNodeId} />
    case NodeType.API_ENDPOINT:
      return <APIEndpointInspector key={selectedNodeId} nodeId={selectedNodeId} />
    case NodeType.CUSTOM_TYPE:
      return <CustomTypeInspector key={selectedNodeId} nodeId={selectedNodeId} />
    default:
      return null
  }
}

export default InspectorPanel
