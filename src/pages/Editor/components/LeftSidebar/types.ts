import type React from 'react'

export interface NodePaletteItem {
  id:      string
  label:   string
  iconBg:  string
  iconFg:  string
  abbr:    string
  ready:   boolean
}

export interface ChildLayerItem {
  id:         string
  label:      string
  rfType:     string    // 'entity', 'dto', etc.
  dotColor:   string
  abbr:       string
  iconBg:     string
  iconFg:     string
  isSelected: boolean
  purpose:    string | null  // only set for dto nodes; null for all others
  subItems:   ChildLayerItem[]  // APIEndpoints nested under ControllerNodes
}

export interface MsLayerGroup {
  id:              string
  label:           string
  port:            string
  dotColor:        string
  isSelected:      boolean
  isChildSelected: boolean
  isCollapsed:     boolean
  children:        ChildLayerItem[]
}

export interface LeftSidebarHook {
  width:                number
  paletteItems:         NodePaletteItem[]
  hasMicroservice:      boolean
  layerGroups:          MsLayerGroup[]
  handleResizeStart:    (e: React.MouseEvent) => void
  handleNodeAdd:        (item: NodePaletteItem) => void
  handleDragStart:      (e: React.DragEvent, type: string) => void
  handleLayerClick:     (id: string) => void
  handleToggleCollapse: (msId: string) => void
}
