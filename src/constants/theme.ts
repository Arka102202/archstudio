// src/constants/theme.ts
// TypeScript mirror of src/index.css custom properties.
// Keep in sync manually whenever index.css is updated.
//
// Usage:
//   import { THEME } from '@constants/theme'
//   style={{ borderColor: THEME.light.accent }}
//   style={{ borderColor: THEME.dark.accent }}
//
// Or use the helper to get the current theme:
//   const t = useTheme()   ← returns the right set based on data-theme

// ─── Theme shape ─────────────────────────────────────────────────

export interface ThemeColors {
  // Backgrounds
  bg:            string
  surface:       string
  surfaceAlt:    string
  surfaceRaised: string

  // Borders
  border:        string
  borderStrong:  string
  borderFocus:   string

  // Text
  text:          string
  text2:         string
  text3:         string
  text4:         string

  // Accent
  accent:        string
  accentHover:   string
  accentLight:   string
  accentMid:     string
  accentText:    string

  // Semantic
  danger:        string
  dangerLight:   string
  success:       string
  warning:       string

  // Canvas
  canvasBg:      string
  canvasDot:     string
  canvasNodeBorder: string
  canvasDropHintBorder: string

  // Node types
  nodeEntity:    NodeTypeColors
  nodeDto:       NodeTypeColors
  nodeDb:        NodeTypeColors
  nodeAuth:      NodeTypeColors
  nodeCtrl:      NodeTypeColors
  nodeSvc:       NodeTypeColors
  nodeEp:        NodeTypeColors

  // Microservice palette (5 entries)
  msPalette:     MsPaletteEntry[]

  // Dep chips
  depWeb:        ChipColors
  depJpa:        ChipColors
  depSecurity:   ChipColors
  depPostgres:   ChipColors
  depLombok:     ChipColors
  depValidation: ChipColors
  depDefault:    ChipColors

  // AI box
  aiBoxBgFrom:   string
  aiBoxBgTo:     string
  aiBoxBorder:   string
  aiDotColor:    string

  // Info dots
  dotJava:       string
  dotBuild:      string
  dotDockerOn:   string
  dotDockerOff:  string

  // Shadows
  shadowSm:      string
  shadowMd:      string
  shadowLg:      string
  shadowNode:    string
  shadowDropdown:string
  shadowModal:   string
}

export interface NodeTypeColors {
  accent:  string
  iconBg:  string
  iconFg:  string
}

export interface MsPaletteEntry {
  border:      string
  iconBg:      string
  iconFg:      string
  badgeBg:     string
  badgeBorder: string
  badgeText:   string
}

export interface ChipColors {
  bg:     string
  text:   string
  border: string
}

// ─── Light theme ─────────────────────────────────────────────────

const light: ThemeColors = {
  bg:            '#f0f0ed',
  surface:       '#ffffff',
  surfaceAlt:    '#f7f7f5',
  surfaceRaised: '#ffffff',

  border:        'rgba(0,0,0,0.08)',
  borderStrong:  'rgba(0,0,0,0.14)',
  borderFocus:   '#3860f5',

  text:          '#141416',
  text2:         '#555560',
  text3:         '#8888a0',
  text4:         '#b8b8cc',

  accent:        '#3860f5',
  accentHover:   '#2b52e8',
  accentLight:   'rgba(56,96,245,0.06)',
  accentMid:     'rgba(56,96,245,0.12)',
  accentText:    '#ffffff',

  danger:        '#dc2626',
  dangerLight:   'rgba(220,38,38,0.08)',
  success:       '#0a9e6e',
  warning:       '#b07800',

  canvasBg:      '#f0f0ed',
  canvasDot:     'rgba(0,0,0,0.07)',
  canvasNodeBorder: 'rgba(0,0,0,0.10)',
  canvasDropHintBorder: 'rgba(0,0,0,0.12)',

  nodeEntity: { accent: '#3860f5', iconBg: '#dbeafe', iconFg: '#1e40af' },
  nodeDto:    { accent: '#0891b2', iconBg: '#cffafe', iconFg: '#164e63' },
  nodeDb:     { accent: '#6d28d9', iconBg: '#ede9fe', iconFg: '#5b21b6' },
  nodeAuth:   { accent: '#b45309', iconBg: '#fef3c7', iconFg: '#92400e' },
  nodeCtrl:   { accent: '#c2410c', iconBg: '#ffedd5', iconFg: '#9a3412' },
  nodeSvc:    { accent: '#166534', iconBg: '#dcfce7', iconFg: '#166534' },
  nodeEp:     { accent: '#7c3aed', iconBg: '#fae8ff', iconFg: '#6b21a8' },

  msPalette: [
    { border:'#3860f5', iconBg:'#dde6ff', iconFg:'#3730a3', badgeBg:'#eff3ff', badgeBorder:'#c7d2fe', badgeText:'#3730a3' },
    { border:'#0a9e6e', iconBg:'#d1fae5', iconFg:'#065f46', badgeBg:'#ecfdf5', badgeBorder:'#a7f3d0', badgeText:'#065f46' },
    { border:'#c030e8', iconBg:'#f3e8ff', iconFg:'#7e22ce', badgeBg:'#fdf4ff', badgeBorder:'#e9d5ff', badgeText:'#6b21a8' },
    { border:'#d4580a', iconBg:'#fed7aa', iconFg:'#9a3412', badgeBg:'#fff7ed', badgeBorder:'#fdba74', badgeText:'#9a3412' },
    { border:'#0891b2', iconBg:'#bae6fd', iconFg:'#075985', badgeBg:'#f0f9ff', badgeBorder:'#7dd3fc', badgeText:'#075985' },
  ],

  depWeb:        { bg:'#eff6ff',  text:'#1d4ed8', border:'#bfdbfe' },
  depJpa:        { bg:'#f0fdf4',  text:'#166534', border:'#bbf7d0' },
  depSecurity:   { bg:'#fffbeb',  text:'#92400e', border:'#fde68a' },
  depPostgres:   { bg:'#f0f9ff',  text:'#075985', border:'#bae6fd' },
  depLombok:     { bg:'#fdf4ff',  text:'#7e22ce', border:'#e9d5ff' },
  depValidation: { bg:'#fff7ed',  text:'#9a3412', border:'#fed7aa' },
  depDefault:    { bg:'#f7f7f5',  text:'#555560', border:'rgba(0,0,0,0.10)' },

  aiBoxBgFrom:   '#f8f8ff',
  aiBoxBgTo:     '#f0f4ff',
  aiBoxBorder:   '#d4dcff',
  aiDotColor:    '#3860f5',

  dotJava:       '#0a9e6e',
  dotBuild:      '#3860f5',
  dotDockerOn:   '#0891b2',
  dotDockerOff:  '#d1d5db',

  shadowSm:       '0 1px 3px rgba(0,0,0,0.08),0 1px 2px rgba(0,0,0,0.04)',
  shadowMd:       '0 4px 16px rgba(0,0,0,0.10),0 1px 4px rgba(0,0,0,0.06)',
  shadowLg:       '0 8px 32px rgba(0,0,0,0.12),0 2px 8px rgba(0,0,0,0.06)',
  shadowNode:     '0 4px 24px rgba(0,0,0,0.10),0 1px 4px rgba(0,0,0,0.06)',
  shadowDropdown: '0 4px 20px rgba(0,0,0,0.12),0 1px 6px rgba(0,0,0,0.06)',
  shadowModal:    '0 8px 48px rgba(0,0,0,0.18),0 2px 8px rgba(0,0,0,0.08)',
}

// ─── Dark theme ──────────────────────────────────────────────────

const dark: ThemeColors = {
  bg:            '#0c0c0e',
  surface:       '#111114',
  surfaceAlt:    '#18181d',
  surfaceRaised: '#1e1e24',

  border:        'rgba(255,255,255,0.08)',
  borderStrong:  'rgba(255,255,255,0.14)',
  borderFocus:   '#5b7fff',

  text:          '#f0f0f4',
  text2:         '#9090a8',
  text3:         '#55556a',
  text4:         '#33333f',

  accent:        '#5b7fff',
  accentHover:   '#4b6ff5',
  accentLight:   'rgba(91,127,255,0.10)',
  accentMid:     'rgba(91,127,255,0.18)',
  accentText:    '#ffffff',

  danger:        '#ff5252',
  dangerLight:   'rgba(255,82,82,0.12)',
  success:       '#3dd68c',
  warning:       '#ffc947',

  canvasBg:      '#0c0c0e',
  canvasDot:     'rgba(255,255,255,0.06)',
  canvasNodeBorder: 'rgba(255,255,255,0.10)',
  canvasDropHintBorder: 'rgba(255,255,255,0.10)',

  nodeEntity: { accent: '#4b9eff', iconBg: 'rgba(75,158,255,0.15)',   iconFg: '#4b9eff' },
  nodeDto:    { accent: '#2dd4bf', iconBg: 'rgba(45,212,191,0.15)',   iconFg: '#2dd4bf' },
  nodeDb:     { accent: '#a09cf7', iconBg: 'rgba(160,156,247,0.15)',  iconFg: '#a09cf7' },
  nodeAuth:   { accent: '#ffd166', iconBg: 'rgba(255,209,102,0.15)',  iconFg: '#ffd166' },
  nodeCtrl:   { accent: '#ff8547', iconBg: 'rgba(255,133,71,0.15)',   iconFg: '#ff8547' },
  nodeSvc:    { accent: '#3dd68c', iconBg: 'rgba(61,214,140,0.15)',   iconFg: '#3dd68c' },
  nodeEp:     { accent: '#e05cff', iconBg: 'rgba(224,92,255,0.15)',   iconFg: '#e05cff' },

  msPalette: [
    { border:'#5b7fff', iconBg:'rgba(91,127,255,0.18)',   iconFg:'#5b7fff', badgeBg:'rgba(91,127,255,0.12)',   badgeBorder:'rgba(91,127,255,0.30)',   badgeText:'#8aaaff' },
    { border:'#3dd68c', iconBg:'rgba(61,214,140,0.18)',   iconFg:'#3dd68c', badgeBg:'rgba(61,214,140,0.12)',   badgeBorder:'rgba(61,214,140,0.30)',   badgeText:'#6ee7b7' },
    { border:'#c084fc', iconBg:'rgba(192,132,252,0.18)',  iconFg:'#c084fc', badgeBg:'rgba(192,132,252,0.12)',  badgeBorder:'rgba(192,132,252,0.30)',  badgeText:'#d8b4fe' },
    { border:'#ff8547', iconBg:'rgba(255,133,71,0.18)',   iconFg:'#ff8547', badgeBg:'rgba(255,133,71,0.12)',   badgeBorder:'rgba(255,133,71,0.30)',   badgeText:'#fdba74' },
    { border:'#2dd4bf', iconBg:'rgba(45,212,191,0.18)',   iconFg:'#2dd4bf', badgeBg:'rgba(45,212,191,0.12)',   badgeBorder:'rgba(45,212,191,0.30)',   badgeText:'#5eead4' },
  ],

  depWeb:        { bg:'rgba(59,130,246,0.12)',  text:'#93c5fd', border:'rgba(59,130,246,0.25)'  },
  depJpa:        { bg:'rgba(34,197,94,0.12)',   text:'#86efac', border:'rgba(34,197,94,0.25)'   },
  depSecurity:   { bg:'rgba(245,158,11,0.12)',  text:'#fcd34d', border:'rgba(245,158,11,0.25)'  },
  depPostgres:   { bg:'rgba(14,165,233,0.12)',  text:'#7dd3fc', border:'rgba(14,165,233,0.25)'  },
  depLombok:     { bg:'rgba(168,85,247,0.12)',  text:'#d8b4fe', border:'rgba(168,85,247,0.25)'  },
  depValidation: { bg:'rgba(249,115,22,0.12)',  text:'#fdba74', border:'rgba(249,115,22,0.25)'  },
  depDefault:    { bg:'rgba(255,255,255,0.06)', text:'#9090a8', border:'rgba(255,255,255,0.10)' },

  aiBoxBgFrom:   '#13132a',
  aiBoxBgTo:     '#0f1428',
  aiBoxBorder:   'rgba(91,127,255,0.25)',
  aiDotColor:    '#5b7fff',

  dotJava:       '#3dd68c',
  dotBuild:      '#5b7fff',
  dotDockerOn:   '#2dd4bf',
  dotDockerOff:  '#33333f',

  shadowSm:       '0 1px 3px rgba(0,0,0,0.30),0 1px 2px rgba(0,0,0,0.20)',
  shadowMd:       '0 4px 16px rgba(0,0,0,0.40),0 1px 4px rgba(0,0,0,0.30)',
  shadowLg:       '0 8px 32px rgba(0,0,0,0.50),0 2px 8px rgba(0,0,0,0.30)',
  shadowNode:     '0 4px 32px rgba(0,0,0,0.50),0 1px 4px rgba(0,0,0,0.40)',
  shadowDropdown: '0 8px 32px rgba(0,0,0,0.60),0 2px 8px rgba(0,0,0,0.40)',
  shadowModal:    '0 16px 64px rgba(0,0,0,0.70),0 4px 16px rgba(0,0,0,0.50)',
}

// ─── Exported object ─────────────────────────────────────────────

export const THEME = { light, dark } as const

// ─── Radius + Spacing (theme-independent) ────────────────────────

export const RADIUS = {
  sm:   6,
  md:   10,
  lg:   14,
  xl:   20,
  full: 9999,
} as const

export const SPACE = {
  1:  4,
  2:  8,
  3:  12,
  4:  16,
  5:  20,
  6:  24,
  8:  32,
  10: 40,
  12: 48,
} as const

export const LAYOUT = {
  topbarHeight:        52,
  editorHeaderHeight:  48,
  leftPanelWidth:      192,
  rightPanelWidth:     272,
} as const
