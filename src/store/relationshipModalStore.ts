import { create } from 'zustand'

export type RelationshipModalTrigger = 'CANVAS_EDGE' | 'FIELD_TYPE'

export interface RelationshipModalState {
  isOpen:        boolean
  trigger:       RelationshipModalTrigger | null
  entityAId:     string | null  // source entity — the one the user acted on
  entityBId:     string | null  // target entity
  fieldId:       string | null  // only when trigger === 'FIELD_TYPE'
  sourceHandle:  string | null  // original drag handle on entityA (CANVAS_EDGE only)
  targetHandle:  string | null  // original drag handle on entityB (CANVAS_EDGE only)

  open:  (params: Omit<RelationshipModalState, 'isOpen' | 'open' | 'close'>) => void
  close: () => void
}

export const useRelationshipModalStore = create<RelationshipModalState>(set => ({
  isOpen:        false,
  trigger:       null,
  entityAId:     null,
  entityBId:     null,
  fieldId:       null,
  sourceHandle:  null,
  targetHandle:  null,
  open:  params => set({ isOpen: true, ...params }),
  close: ()     => set({ isOpen: false, trigger: null, entityAId: null, entityBId: null, fieldId: null, sourceHandle: null, targetHandle: null }),
}))
