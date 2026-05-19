import { create } from 'zustand'

interface CanvasState {
  selectedNodeId:   string | null
  selectedEdgeId:   string | null
  rightPanelTab:    'inspector' | 'chat'
  setSelectedNode:  (id: string | null) => void
  setSelectedEdge:  (id: string | null) => void
  clearSelection:   () => void
  setRightPanelTab: (tab: 'inspector' | 'chat') => void
}

export const useCanvasStore = create<CanvasState>()((set) => ({
  selectedNodeId: null,
  selectedEdgeId: null,
  rightPanelTab:  'inspector',

  setSelectedNode:  (id)  => set({ selectedNodeId: id }),
  setSelectedEdge:  (id)  => set({ selectedEdgeId: id }),
  clearSelection:   ()    => set({ selectedNodeId: null, selectedEdgeId: null }),
  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
}))
