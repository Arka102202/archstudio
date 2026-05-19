export const ROUTES = {
  HOME:     '/',
  EDITOR:   '/project/:projectId',
  SETTINGS: '/settings',
} as const

export const toEditor = (projectId: string): string =>
  `/project/${projectId}`
