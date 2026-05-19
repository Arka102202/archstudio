import React from 'react'
import { useProjectCard } from './useProjectCard'
import type { ProjectCardProps } from './types'

const ProjectCard = ({ project, accentColor, onOpen, onDelete }: ProjectCardProps): React.JSX.Element => {
  const {
    isMenuOpen,
    isHovered,
    menuRef,
    timeAgo,
    handleCardClick,
    handleMenuToggle,
    handleMenuOpen,
    handleMenuDelete,
    setIsHovered,
  } = useProjectCard({ onOpen, onDelete })

  return (
    <div
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={[
        'w-[220px] bg-surface rounded-md cursor-pointer overflow-hidden relative',
        'transition-[border-color,box-shadow] duration-150',
        isHovered
          ? 'border border-border-strong shadow-md'
          : 'border border-border shadow-sm',
      ].join(' ')}
    >
      {/* Accent bar — background is dynamic per-card color */}
      <div
        className="h-1 rounded-t-md"
        style={{ background: accentColor }}
      />

      {/* Body */}
      <div className="px-3 pt-2.5 pb-2.5">
        {/* Name */}
        <p className="text-sm font-bold text-text mb-1 overflow-hidden text-ellipsis whitespace-nowrap">
          {project.name}
        </p>

        {/* Description */}
        <p className="text-[11px] text-text-3 overflow-hidden text-ellipsis whitespace-nowrap min-h-4 mb-2.5">
          {project.description}
        </p>

        {/* Divider */}
        <div className="h-px bg-border mb-2" />

        {/* Footer row */}
        <div className="flex items-center justify-between">
          {/* Timestamp */}
          <span className="text-[10px] font-mono text-text-4">
            {timeAgo(project.updatedAt)}
          </span>

          {/* Menu */}
          <div
            data-menu
            ref={menuRef}
            className="relative"
          >
            <button
              onClick={handleMenuToggle}
              className="w-6 h-6 flex items-center justify-center bg-transparent border-none rounded-[4px] cursor-pointer text-base text-text-3 leading-none"
            >
              &#8942;
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 bottom-full mb-1 z-100 bg-surface-raised border border-border-strong rounded-sm shadow-dropdown overflow-hidden min-w-30">
                <button
                  onClick={handleMenuOpen}
                  className="block w-full px-3.5 py-2 bg-transparent border-none cursor-pointer text-left text-[13px] text-text"
                >
                  Open
                </button>
                <div className="h-px bg-border" />
                <button
                  onClick={handleMenuDelete}
                  className="block w-full px-3.5 py-2 bg-transparent border-none cursor-pointer text-left text-[13px] text-danger"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProjectCard
