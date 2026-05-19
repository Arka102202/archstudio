import React, { useState } from 'react'
import { BuildTool } from '@entity/MicroserviceNode'
import { SectionLabel, Toggle, DepChip, AIPromptBox } from '@components/shared'
import { useMicroserviceInspector } from './useMicroserviceInspector'
import type { MicroserviceInspectorProps, PresetDep } from './types'

// ─── Field input — inline sub-component ──────────────────────────

const FieldInput = ({
  label,
  value,
  onChange,
  placeholder = '',
  mono        = false,
}: {
  label:        string
  value:        string
  onChange:     (v: string) => void
  placeholder?: string
  mono?:        boolean
}): React.JSX.Element => (
  <div className="px-4 py-1.5">
    <label
      className="block mb-1"
      style={{ fontSize: 9, color: 'var(--color-text-4)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}
    >
      {label}
    </label>
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      className="w-full outline-none"
      style={{
        background:   'var(--color-surface-alt)',
        border:       '1px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)',
        padding:      '5px 8px',
        fontSize:     11,
        color:        'var(--color-text)',
        fontFamily:   mono ? 'var(--font-mono)' : 'var(--font-ui)',
      }}
    />
  </div>
)

// ─── Select input — inline sub-component ─────────────────────────

const FieldSelect = <T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label:    string
  value:    T
  options:  { label: string; value: T }[]
  onChange: (v: T) => void
}): React.JSX.Element => (
  <div className="px-4 py-1.5 flex items-center justify-between">
    <span style={{ fontSize: 11, color: 'var(--color-text-2)', fontFamily: 'var(--font-ui)' }}>
      {label}
    </span>
    <select
      value={value}
      onChange={e => onChange(e.target.value as T)}
      className="outline-none"
      style={{
        background:   'var(--color-surface-alt)',
        border:       '1px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)',
        padding:      '3px 6px',
        fontSize:     11,
        color:        'var(--color-text)',
        fontFamily:   'var(--font-mono)',
        cursor:       'pointer',
      }}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
)

// ─── Toggle row — inline sub-component ───────────────────────────

const ToggleRow = ({
  label,
  value,
  onChange,
}: {
  label:    string
  value:    boolean
  onChange: () => void
}): React.JSX.Element => (
  <div className="px-4 py-2 flex items-center justify-between">
    <span style={{ fontSize: 11, color: 'var(--color-text-2)', fontFamily: 'var(--font-ui)' }}>
      {label}
    </span>
    <Toggle value={value} onChange={onChange} />
  </div>
)

// ─── Divider ─────────────────────────────────────────────────────

const Divider = (): React.JSX.Element => (
  <div style={{ height: 1, background: 'var(--color-border)', margin: '8px 0' }} />
)

// ─── Preset dependency definitions ───────────────────────────────

const PRESET_DEPS: PresetDep[] = [
  { label: 'Spring Web',       artifactId: 'spring-boot-starter-web',        groupId: 'org.springframework.boot', colorVar: '--dep-web' },
  { label: 'Spring Data JPA',  artifactId: 'spring-boot-starter-data-jpa',   groupId: 'org.springframework.boot', colorVar: '--dep-jpa' },
  { label: 'Spring Security',  artifactId: 'spring-boot-starter-security',   groupId: 'org.springframework.boot', colorVar: '--dep-security' },
  { label: 'PostgreSQL',       artifactId: 'postgresql',                     groupId: 'org.postgresql',           colorVar: '--dep-postgres' },
  { label: 'Lombok',           artifactId: 'lombok',                         groupId: 'org.projectlombok',        colorVar: '--dep-lombok' },
  { label: 'Validation',       artifactId: 'spring-boot-starter-validation', groupId: 'org.springframework.boot', colorVar: '--dep-validation' },
]

// ─── MicroserviceInspector ────────────────────────────────────────

const MicroserviceInspector = (props: MicroserviceInspectorProps): React.JSX.Element | null => {
  const {
    node,
    isLoading,
    handleLabelChange,
    handleServiceNameChange,
    handlePackageNameChange,
    handlePortChange,
    handleVersionChange,
    handleBuildToolChange,
    handleSpringVersionChange,
    handleJavaVersionChange,
    handleAddDependency,
    handleRemoveDependency,
    handleDockerToggle,
    handleBaseImageChange,
    handleAIPromptChange,
    handleAIGenerateToggle,
    handleClose,
    handleDelete,
  } = useMicroserviceInspector(props)

  const [newDepInput, setNewDepInput] = useState<string>('')

  if (isLoading || !node) {
    return (
      <div className="flex items-center justify-center h-20">
        <span style={{ fontSize: 11, color: 'var(--color-text-4)' }}>Loading…</span>
      </div>
    )
  }

  const submitNewDep = (): void => {
    if (!newDepInput.trim()) return
    handleAddDependency(newDepInput)
    setNewDepInput('')
  }

  // Check which preset deps are already added
  const addedArtifacts = new Set(node.build.extraDependencies.map(d => d.artifactId))

  // Custom deps (not in presets)
  const presetArtifacts = new Set(PRESET_DEPS.map(p => p.artifactId))
  const customDeps      = node.build.extraDependencies
    .map((dep, idx) => ({ dep, idx }))
    .filter(({ dep }) => !presetArtifacts.has(dep.artifactId))

  return (
    <div
      className="flex flex-col h-full overflow-y-auto"
      style={{ fontFamily: 'var(--font-ui)' }}
    >
      {/* ── PANEL HEADER ──────────────────────────────────────── */}
      <div
        className="sticky top-0 z-10 px-4 py-3 flex items-start justify-between"
        style={{
          background:   'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className="inline-flex items-center"
              style={{
                fontSize:     9,
                fontWeight:   700,
                color:        'var(--color-text-4)',
                background:   'var(--color-surface-alt)',
                border:       '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                padding:      '1px 5px',
                fontFamily:   'var(--font-mono)',
                textTransform: 'uppercase',
              }}
            >
              Microservice
            </span>
          </div>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', lineHeight: '18px' }}>
            {node.label}
          </p>
          <p style={{ fontSize: 9, color: 'var(--color-text-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            {node.serviceName} · v{node.version}
          </p>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="flex items-center justify-center shrink-0"
          style={{
            width:      24,
            height:     24,
            borderRadius: 'var(--radius-sm)',
            background: 'none',
            border:     '1px solid var(--color-border)',
            cursor:     'pointer',
            color:      'var(--color-text-3)',
            fontSize:   13,
          }}
          aria-label="Close inspector"
        >
          ×
        </button>
      </div>

      {/* ── SECTION 1: IDENTITY ───────────────────────────────── */}
      <SectionLabel label="Identity" />

      <FieldInput label="Label"        value={node.label}       onChange={handleLabelChange}       placeholder="Order Service" />
      <FieldInput label="Service name" value={node.serviceName} onChange={handleServiceNameChange} placeholder="order-service" mono />
      <FieldInput label="Package name" value={node.packageName} onChange={handlePackageNameChange} placeholder="com.example.orderservice" mono />

      <div className="flex gap-2 px-4 py-1.5">
        <div className="flex-1">
          <label
            className="block mb-1"
            style={{ fontSize: 9, color: 'var(--color-text-4)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}
          >
            Port
          </label>
          <input
            type="text"
            value={node.port}
            onChange={e => handlePortChange(e.target.value)}
            className="w-full outline-none"
            style={{
              background:   'var(--color-surface-alt)',
              border:       '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              padding:      '5px 8px',
              fontSize:     11,
              color:        'var(--color-text)',
              fontFamily:   'var(--font-mono)',
            }}
          />
        </div>
        <div className="flex-1">
          <label
            className="block mb-1"
            style={{ fontSize: 9, color: 'var(--color-text-4)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}
          >
            Version
          </label>
          <input
            type="text"
            value={node.version}
            onChange={e => handleVersionChange(e.target.value)}
            className="w-full outline-none"
            style={{
              background:   'var(--color-surface-alt)',
              border:       '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              padding:      '5px 8px',
              fontSize:     11,
              color:        'var(--color-text)',
              fontFamily:   'var(--font-mono)',
            }}
          />
        </div>
      </div>

      <Divider />

      {/* ── SECTION 2: BUILD ──────────────────────────────────── */}
      <SectionLabel label="Build" />

      <FieldSelect
        label="Build tool"
        value={node.build.tool}
        options={[
          { label: 'Maven',  value: BuildTool.MAVEN },
          { label: 'Gradle', value: BuildTool.GRADLE },
        ]}
        onChange={handleBuildToolChange}
      />

      <FieldSelect
        label="Spring Boot"
        value={node.build.springBootVersion}
        options={[
          { label: '3.2.0', value: '3.2.0' },
          { label: '3.1.0', value: '3.1.0' },
          { label: '2.7.0', value: '2.7.0' },
        ]}
        onChange={handleSpringVersionChange}
      />

      <FieldSelect
        label="Java version"
        value={node.build.javaVersion}
        options={[
          { label: 'Java 17', value: '17' },
          { label: 'Java 21', value: '21' },
        ]}
        onChange={handleJavaVersionChange}
      />

      <Divider />

      {/* ── SECTION 3: DEPENDENCIES ───────────────────────────── */}
      <SectionLabel label="Dependencies" />

      {/* Preset chips — one per preset, showing × if added, "+ add" if not */}
      <div className="px-4 pb-2 flex flex-wrap gap-1.5">
        {PRESET_DEPS.map(preset => {
          const isAdded = addedArtifacts.has(preset.artifactId)
          const depIdx  = node.build.extraDependencies.findIndex(
            d => d.artifactId === preset.artifactId,
          )
          return (
            <DepChip
              key={preset.artifactId}
              label={preset.label}
              colorVar={preset.colorVar}
              onRemove={isAdded ? () => handleRemoveDependency(depIdx) : undefined}
              onAdd={!isAdded ? () => handleAddDependency(preset.artifactId) : undefined}
            />
          )
        })}
      </div>

      {/* Custom deps */}
      {customDeps.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {customDeps.map(({ dep, idx }) => (
            <DepChip
              key={idx}
              label={dep.artifactId}
              colorVar="--dep-default"
              onRemove={() => handleRemoveDependency(idx)}
            />
          ))}
        </div>
      )}

      {/* Add custom dep row */}
      <div className="px-4 pb-3 flex gap-2">
        <input
          type="text"
          value={newDepInput}
          onChange={e => setNewDepInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submitNewDep() }}
          placeholder="add dependency…"
          className="flex-1 outline-none"
          style={{
            background:   'var(--color-surface-alt)',
            border:       '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding:      '5px 8px',
            fontSize:     11,
            color:        'var(--color-text)',
            fontFamily:   'var(--font-mono)',
          }}
        />
        <button
          type="button"
          onClick={submitNewDep}
          style={{
            background:   'var(--color-surface-alt)',
            border:       '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding:      '5px 10px',
            fontSize:     13,
            color:        'var(--color-text-2)',
            cursor:       'pointer',
          }}
        >
          +
        </button>
      </div>

      <Divider />

      {/* ── SECTION 4: DOCKER ─────────────────────────────────── */}
      <SectionLabel label="Docker" />

      <ToggleRow
        label="Generate Dockerfile"
        value={node.docker.generateDockerfile}
        onChange={() => handleDockerToggle('generateDockerfile')}
      />
      <ToggleRow
        label="docker-compose"
        value={node.docker.generateDockerCompose}
        onChange={() => handleDockerToggle('generateDockerCompose')}
      />
      <FieldInput
        label="Base image"
        value={node.docker.baseImage}
        onChange={handleBaseImageChange}
        placeholder="eclipse-temurin:17-jre-alpine"
        mono
      />

      <Divider />

      {/* ── SECTION 5: AI PROMPT ──────────────────────────────── */}
      <SectionLabel label="AI Prompt" />
      <div className="px-4 pb-3">
        <AIPromptBox
          value={node.aiPrompt}
          onChange={handleAIPromptChange}
          onGenerateToggle={handleAIGenerateToggle}
        />
      </div>

      <Divider />

      {/* ── SECTION 6: DELETE ─────────────────────────────────── */}
      <div className="px-4 py-3">
        <button
          type="button"
          onClick={handleDelete}
          className="w-full text-center"
          style={{
            background:   'var(--color-danger-light)',
            color:        'var(--color-danger)',
            border:       '1px solid var(--color-danger-border)',
            borderRadius: 'var(--radius-sm)',
            padding:      '8px 16px',
            fontSize:     12,
            fontWeight:   600,
            cursor:       'pointer',
            fontFamily:   'var(--font-ui)',
          }}
        >
          Delete microservice
        </button>
      </div>

      {/* Pulse animation for AI dot */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}

export default MicroserviceInspector
