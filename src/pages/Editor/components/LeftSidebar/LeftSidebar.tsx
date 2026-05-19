import React from 'react'
import { MESSAGES } from '@constants/messages'
import { useLeftSidebar } from './useLeftSidebar'
import type { NodePaletteItem, MsLayerGroup, ChildLayerItem } from './types'

// ─── Chevron SVG ──────────────────────────────────────────────────
const Chevron = ({ collapsed }: { collapsed: boolean }): React.JSX.Element => (
  <svg
    width="9"
    height="9"
    viewBox="0 0 9 9"
    fill="none"
    style={{
      transform:  collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
      transition: 'transform 0.15s ease',
      flexShrink: 0,
    }}
  >
    <path
      d="M2 3.5L4.5 6L7 3.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

// ─── TypeBadge — small coloured square with abbreviation ─────────
const TypeBadge = ({
  abbr,
  iconBg,
  iconFg,
  size = 15,
}: {
  abbr:    string
  iconBg:  string
  iconFg:  string
  size?:   number
}): React.JSX.Element => (
  <div
    style={{
      width:          size,
      height:         size,
      minWidth:       size,
      borderRadius:   4,
      background:     iconBg,
      color:          iconFg,
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      fontSize:       size <= 15 ? 7 : 9,
      fontFamily:     'var(--font-mono)',
      fontWeight:     700,
      letterSpacing:  '-0.02em',
    }}
  >
    {abbr}
  </div>
)

// ─── PaletteItem ──────────────────────────────────────────────────
const PaletteItem = ({
  item,
  enabled,
  onAdd,
  onDragStart,
}: {
  item:        NodePaletteItem
  enabled:     boolean
  onAdd:       (item: NodePaletteItem) => void
  onDragStart: (e: React.DragEvent, type: string) => void
}): React.JSX.Element => {
  const disabledTitle =
    !enabled && (item.id === 'entity' || item.id === 'dto' || item.id === 'db' || item.id === 'table' || item.id === 'service' || item.id === 'controller' || item.id === 'endpoint' || item.id === 'customType') ? 'Add a microservice first' : undefined

  return (
    <div
      draggable={enabled}
      onClick={enabled ? () => onAdd(item) : undefined}
      onDragStart={enabled ? e => onDragStart(e, item.id) : undefined}
      title={disabledTitle}
      className="flex items-center gap-2 mx-1.5 px-2 py-[5px] rounded-md"
      style={{
        cursor:        enabled ? 'pointer' : 'not-allowed',
        opacity:       enabled ? 1 : 0.35,
        pointerEvents: enabled ? 'auto' : 'none',
        transition:    'background 0.1s',
      }}
      onMouseEnter={enabled ? e => {
        (e.currentTarget as HTMLDivElement).style.background = 'var(--color-surface-alt)'
      } : undefined}
      onMouseLeave={enabled ? e => {
        (e.currentTarget as HTMLDivElement).style.background = 'transparent'
      } : undefined}
    >
      <TypeBadge abbr={item.abbr} iconBg={item.iconBg} iconFg={item.iconFg} size={18} />
      <span
        style={{
          fontSize:   11,
          fontFamily: 'var(--font-ui)',
          fontWeight: 450,
          color:      'var(--color-text-2)',
        }}
      >
        {item.label}
      </span>
    </div>
  )
}

// ─── MsLayerRow — MS group header ─────────────────────────────────

const MsLayerRow = ({
  group,
  onToggle,
  onClick,
}: {
  group:    MsLayerGroup
  onToggle: (id: string) => void
  onClick:  (id: string) => void
}): React.JSX.Element => {
  const isActive = group.isSelected || group.isChildSelected
  const accentBg = group.isSelected      ? `${group.dotColor}16`
                 : group.isChildSelected ? `${group.dotColor}0c`
                 : 'transparent'

  return (
    <div
      className="flex items-center gap-1.5 mx-1.5 rounded-md"
      style={{
        padding:    '4px 6px 4px 4px',
        background: accentBg,
        transition: 'background 0.12s',
        cursor:     'pointer',
        position:   'relative',
      }}
      onMouseEnter={e => {
        if (!isActive)
          (e.currentTarget as HTMLDivElement).style.background = 'var(--color-surface-alt)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.background = accentBg
      }}
    >
      {/* Selected/child-active accent bar */}
      {isActive && (
        <div
          style={{
            position:     'absolute',
            left:         0,
            top:          4,
            bottom:       4,
            width:        2,
            borderRadius: 2,
            background:   group.dotColor,
            opacity:      group.isSelected ? 1 : 0.5,
          }}
        />
      )}

      {/* Chevron toggle */}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onToggle(group.id) }}
        style={{
          background: 'none',
          border:     'none',
          padding:    0,
          cursor:     'pointer',
          color:      'var(--color-text-4)',
          display:    'flex',
          alignItems: 'center',
          width:      12,
          height:     12,
          flexShrink: 0,
        }}
        aria-label={group.isCollapsed ? 'Expand' : 'Collapse'}
      >
        <Chevron collapsed={group.isCollapsed} />
      </button>

      {/* MS icon badge */}
      <div
        style={{
          width:          18,
          height:         18,
          minWidth:       18,
          borderRadius:   5,
          background:     group.dotColor,
          color:          '#ffffff',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          fontSize:       7,
          fontFamily:     'var(--font-mono)',
          fontWeight:     700,
          letterSpacing:  '-0.02em',
          flexShrink:     0,
        }}
        onClick={() => onClick(group.id)}
      >
        MS
      </div>

      {/* Label */}
      <span
        onClick={() => onClick(group.id)}
        style={{
          flex:       1,
          fontSize:   11,
          fontWeight: group.isSelected ? 600 : 500,
          fontFamily: 'var(--font-ui)',
          color:      group.isSelected ? group.dotColor : group.isChildSelected ? 'var(--color-text)' : 'var(--color-text)',
          overflow:   'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {group.label}
      </span>

      {/* Port pill */}
      {group.port && (
        <span
          onClick={() => onClick(group.id)}
          style={{
            fontSize:     9,
            fontFamily:   'var(--font-mono)',
            color:        'var(--color-text-4)',
            background:   'var(--color-surface-alt)',
            border:       '1px solid var(--color-border)',
            borderRadius: 4,
            padding:      '1px 4px',
            flexShrink:   0,
            letterSpacing: '0.02em',
          }}
        >
          {group.port}
        </span>
      )}
    </div>
  )
}

// ─── ChildLayerRow ────────────────────────────────────────────────
const ChildLayerRow = ({
  item,
  onClick,
  indent = 28,
}: {
  item:    ChildLayerItem
  onClick: (id: string) => void
  indent?: number
}): React.JSX.Element => {
  const accentBg = item.isSelected ? `${item.iconFg}12` : 'transparent'

  return (
    <div
      onClick={() => onClick(item.id)}
      className="flex items-center gap-1.5 mx-1.5 rounded-md"
      style={{
        padding:    `3px 6px 3px ${indent}px`,
        background: accentBg,
        transition: 'background 0.12s',
        cursor:     'pointer',
      }}
      onMouseEnter={e => {
        if (!item.isSelected)
          (e.currentTarget as HTMLDivElement).style.background = 'var(--color-surface-alt)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.background = accentBg
      }}
    >
      <TypeBadge abbr={item.abbr} iconBg={item.iconBg} iconFg={item.iconFg} size={15} />
      <span
        style={{
          flex:        1,
          fontSize:    11,
          fontWeight:  item.isSelected ? 500 : 400,
          fontFamily:  'var(--font-ui)',
          color:       item.isSelected ? item.iconFg : 'var(--color-text-2)',
          overflow:    'hidden',
          textOverflow:'ellipsis',
          whiteSpace:  'nowrap',
        }}
      >
        {item.label}
      </span>

      {/* Purpose label — only for DTO nodes */}
      {item.purpose !== null && (
        <span
          style={{
            fontSize:   8,
            fontFamily: 'var(--font-mono)',
            color:      'var(--color-text-4)',
            flexShrink: 0,
            marginLeft: 4,
          }}
        >
          {item.purpose}
        </span>
      )}
    </div>
  )
}

// ─── ResizeHandle ─────────────────────────────────────────────────
const ResizeHandle = ({
  onMouseDown,
}: {
  onMouseDown: (e: React.MouseEvent) => void
}): React.JSX.Element => (
  <div
    onMouseDown={onMouseDown}
    className="absolute top-0 -right-[3px] w-[6px] h-full cursor-col-resize z-10 flex items-center justify-center resize-handle"
  >
    <style>{`.resize-handle:hover .resize-bar { opacity: 1 !important; }`}</style>
    <div className="resize-bar w-[2px] h-8 bg-border-strong rounded-[2px] opacity-0 transition-opacity duration-150" />
  </div>
)

// ─── Section divider ──────────────────────────────────────────────
const SectionLabel = ({ label }: { label: string }): React.JSX.Element => (
  <p
    style={{
      fontSize:      9,
      fontWeight:    700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color:         'var(--color-text-4)',
      padding:       '10px 12px 6px',
      fontFamily:    'var(--font-ui)',
    }}
  >
    {label}
  </p>
)

// ─── LeftSidebar ─────────────────────────────────────────────────
const LeftSidebar = (): React.JSX.Element => {
  const {
    width,
    paletteItems,
    hasMicroservice,
    layerGroups,
    handleResizeStart,
    handleNodeAdd,
    handleDragStart,
    handleLayerClick,
    handleToggleCollapse,
  } = useLeftSidebar()

  return (
    <div className="relative shrink-0">
      <aside
        className="h-full bg-surface border-r border-border flex flex-col overflow-hidden"
        style={{ width }}
      >
        {/* ADD NODE section */}
        <div className="shrink-0">
          <SectionLabel label={MESSAGES.editor.sectionAddNode} />
          {paletteItems.map((item: NodePaletteItem) => {
            // entity, dto, db, table, and service require at least one MS — all others use item.ready
            const isEnabled =
              item.id === 'entity' || item.id === 'dto' || item.id === 'db' || item.id === 'table' || item.id === 'service' || item.id === 'controller' || item.id === 'endpoint' || item.id === 'customType'
                ? hasMicroservice
                : item.ready
            return (
              <PaletteItem
                key={item.id}
                item={item}
                enabled={isEnabled}
                onAdd={handleNodeAdd}
                onDragStart={handleDragStart}
              />
            )
          })}
        </div>

        {/* Divider */}
        <div
          style={{
            height:     1,
            background: 'var(--color-border)',
            margin:     '6px 0 0',
            flexShrink: 0,
          }}
        />

        {/* LAYERS section */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <SectionLabel label={MESSAGES.editor.sectionLayers} />
          <div className="flex-1 overflow-auto pb-2" style={{ gap: 1 }}>
            {layerGroups.length === 0 ? (
              <p
                style={{
                  fontSize:   11,
                  color:      'var(--color-text-4)',
                  padding:    '0 12px',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                {MESSAGES.editor.emptyLayersText}
              </p>
            ) : (
              layerGroups.map(group => (
                <div key={group.id} style={{ marginBottom: 2 }}>
                  <MsLayerRow
                    group={group}
                    onToggle={handleToggleCollapse}
                    onClick={handleLayerClick}
                  />
                  {!group.isCollapsed && group.children.map(child => (
                    <React.Fragment key={child.id}>
                      <ChildLayerRow
                        item={child}
                        onClick={handleLayerClick}
                        indent={28}
                      />
                      {child.subItems.map(sub => (
                        <ChildLayerRow
                          key={sub.id}
                          item={sub}
                          onClick={handleLayerClick}
                          indent={44}
                        />
                      ))}
                    </React.Fragment>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Hints */}
        <div
          style={{
            borderTop:  '1px solid var(--color-border)',
            padding:    '8px 12px',
            flexShrink: 0,
          }}
        >
          <p
            style={{
              fontSize:   9,
              fontFamily: 'var(--font-mono)',
              color:      'var(--color-text-4)',
              whiteSpace: 'pre-line',
              lineHeight: 1.6,
            }}
          >
            {MESSAGES.editor.canvasHint}
          </p>
        </div>
      </aside>

      <ResizeHandle onMouseDown={handleResizeStart} />
    </div>
  )
}

export default LeftSidebar
