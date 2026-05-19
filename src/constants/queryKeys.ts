export const QUERY_KEYS = {
  projects: ['projects']                                    as const,
  project:  (id: string) => ['projects', id]               as const,
  nodes:    (projectId: string) => ['nodes', projectId]    as const,
  node:     (id: string) => ['nodes', 'single', id]        as const,
  edges:    (projectId: string) => ['edges', projectId]    as const,
} as const
