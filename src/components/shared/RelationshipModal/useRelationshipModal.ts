import { useState, useEffect } from 'react'
import { useNodes, useEdges, useReactFlow } from '@xyflow/react'
import { useRelationshipModalStore, useProjectStore } from '@store'
import { applyRelationship, complementaryRelationType } from '@utils'
import type { RelationType } from '@entity'
import { RelationType as RT } from '@entity'
import type { Node as RFNode } from '@xyflow/react'
import type { EntityNode } from '@entity'

function complementaryRelationLabel(kind: RelationType): string {
  switch (kind) {
    case RT.ONE_TO_MANY:  return '@ManyToOne'
    case RT.MANY_TO_ONE:  return '@OneToMany'
    case RT.ONE_TO_ONE:   return '@OneToOne'
    case RT.MANY_TO_MANY: return '@ManyToMany'
  }
}

function toCamelCase(label: string): string {
  return label.charAt(0).toLowerCase() + label.slice(1)
}

export function useRelationshipModal() {
  const store            = useRelationshipModalStore()
  const activeProjectId  = useProjectStore(s => s.activeProjectId)
  const allNodes         = useNodes()
  const rfEdges          = useEdges()
  const { setNodes, setEdges } = useReactFlow()

  const [relationType,        setRelationType]        = useState<RelationType>(RT.ONE_TO_MANY)
  const [twoWayBinding,       setTwoWayBinding]       = useState(false)
  const [sourceFieldName,     setSourceFieldName]     = useState('')
  const [targetFieldName,     setTargetFieldName]     = useState('')
  const [inverseRelationType, setInverseRelationType] = useState<RelationType>(RT.MANY_TO_ONE)

  const entityA = allNodes.find((n: RFNode) => n.id === store.entityAId)
  const entityB = allNodes.find((n: RFNode) => n.id === store.entityBId)

  const entityALabel = entityA ? (entityA.data as unknown as EntityNode).label : ''
  const entityBLabel = entityB ? (entityB.data as unknown as EntityNode).label : ''

  // Reset all state when the modal opens
  useEffect(() => {
    if (store.isOpen) {
      const defaultRelType = RT.ONE_TO_MANY
      setRelationType(defaultRelType)
      setTwoWayBinding(false)
      setSourceFieldName(toCamelCase(entityBLabel))
      setTargetFieldName(toCamelCase(entityALabel))
      setInverseRelationType(complementaryRelationType(defaultRelType))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.isOpen])

  // Keep inverseRelationType in sync when relationType changes
  const handleSetRelationType = (rt: RelationType): void => {
    setRelationType(rt)
    setInverseRelationType(complementaryRelationType(rt))
  }

  const handleConfirm = async (): Promise<void> => {
    if (!store.entityAId || !store.entityBId || !activeProjectId) return

    await applyRelationship({
      trigger:             store.trigger!,
      entityAId:           store.entityAId,
      entityBId:           store.entityBId,
      fieldId:             store.fieldId,
      relationType,
      twoWayBinding,
      sourceFieldName:     sourceFieldName.trim() || toCamelCase(entityBLabel),
      targetFieldName:     targetFieldName.trim() || toCamelCase(entityALabel),
      inverseRelationType,
      activeProjectId,
      sourceHandle:        store.sourceHandle,
      targetHandle:        store.targetHandle,
      allNodes,
      rfEdges,
      setNodes: updater => setNodes(updater as (nodes: RFNode[]) => RFNode[]),
      setEdges,
    })

    store.close()
  }

  return {
    isOpen:              store.isOpen,
    entityALabel,
    entityBLabel,
    relationType,
    setRelationType:     handleSetRelationType,
    twoWayBinding,
    setTwoWayBinding,
    sourceFieldName,
    setSourceFieldName,
    targetFieldName,
    setTargetFieldName,
    inverseRelationType,
    setInverseRelationType,
    complementaryLabel:  complementaryRelationLabel(relationType),
    handleConfirm,
    handleCancel:        store.close,
  }
}
