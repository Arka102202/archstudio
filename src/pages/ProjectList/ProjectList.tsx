import React, { useState } from 'react'
import { ThemeToggle } from '@components/shared'
import { MESSAGES } from '@constants/messages'
import { ProjectCard } from './components/ProjectCard'
import { CreateProjectModal } from './components/CreateProjectModal'
import { useProjectList } from './useProjectList'
import type { Project } from '@entity'
import type { CreateProjectInput } from './types'

// ─── Card accent colour pool ──────────────────────────────────────
const CARD_ACCENT_COLORS: string[] = [
  '#3860f5',
  '#0a9e6e',
  '#c030e8',
  '#d4580a',
  '#0891b2',
]

// ─── EmptyState — inline, no own folder ──────────────────────────
const EmptyState = ({ onCta }: { onCta: () => void }): React.JSX.Element => (
  <div className="flex flex-col items-center justify-center flex-1 gap-4 pb-20">
    <div className="text-[48px] leading-none text-text-4">
      ⬡
    </div>
    <div className="text-center">
      <p className="text-base font-semibold text-text mb-1.5">
        {MESSAGES.project.emptyHeading}
      </p>
      <p className="text-[13px] text-text-3">
        {MESSAGES.project.emptySub}
      </p>
    </div>
    <button
      onClick={onCta}
      className="px-4.5 py-2 bg-accent text-accent-text border-none rounded-sm text-[13px] font-semibold cursor-pointer"
    >
      {MESSAGES.project.emptyCta}
    </button>
  </div>
)

// ─── CreateCard — inline, no own folder ──────────────────────────
const CreateCard = ({ onClick }: { onClick: () => void }): React.JSX.Element => {
  const [hovered, setHovered] = useState<boolean>(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={[
        'w-55 h-27.5 flex flex-col items-center justify-center gap-1.5',
        'bg-transparent border-2 border-dashed rounded-md cursor-pointer',
        'transition-[border-color,color] duration-150',
        hovered ? 'border-accent' : 'border-border-strong',
      ].join(' ')}
    >
      <span
        className={[
          'text-2xl leading-none transition-colors duration-150',
          hovered ? 'text-accent' : 'text-text-3',
        ].join(' ')}
      >
        +
      </span>
      <span
        className={[
          'text-xs font-medium transition-colors duration-150',
          hovered ? 'text-accent' : 'text-text-3',
        ].join(' ')}
      >
        {MESSAGES.project.newProjectButton}
      </span>
    </button>
  )
}

// ─── ProjectList ──────────────────────────────────────────────────
const ProjectList = (): React.JSX.Element => {
  const {
    projects,
    isLoading,
    isModalOpen,
    openModal,
    closeModal,
    openProject,
    createProject,
    deleteProject,
  } = useProjectList()

  const handleCreate = (input: CreateProjectInput): Promise<void> =>
    createProject(input)

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Topbar */}
      <header className="h-[52px] flex items-center justify-between px-6 border-b border-border bg-surface shrink-0">
        {/* Logo */}
        <div className="text-base font-bold tracking-[-0.3px] text-text">
          arch<span className="text-accent">flow</span>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={openModal}
            className="px-3.5 py-1.5 bg-accent text-accent-text border-none rounded-sm text-[13px] font-semibold cursor-pointer"
          >
            {MESSAGES.project.newProjectButton}
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-auto pt-10 px-10 flex flex-col">
        {isLoading && (
          <p className="text-text-3 text-[13px]">Loading…</p>
        )}

        {!isLoading && projects.length === 0 && (
          <EmptyState onCta={openModal} />
        )}

        {!isLoading && projects.length > 0 && (
          <>
            <h1 className="text-lg font-bold text-text mb-5">
              Your projects
            </h1>

            <div
              className="grid gap-4 content-start"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 220px))' }}
            >
              {projects.map((project: Project, i: number) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  accentColor={CARD_ACCENT_COLORS[i % CARD_ACCENT_COLORS.length] ?? '#3860f5'}
                  onOpen={() => openProject(project.id)}
                  onDelete={() => deleteProject(project.id, project.name)}
                />
              ))}
              <CreateCard onClick={openModal} />
            </div>
          </>
        )}
      </main>

      {/* Modal */}
      {isModalOpen && (
        <CreateProjectModal
          onSubmit={handleCreate}
          onClose={closeModal}
        />
      )}
    </div>
  )
}

export default ProjectList
