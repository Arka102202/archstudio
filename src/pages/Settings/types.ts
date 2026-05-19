export interface SettingsHook {
  proxyUrl:    string
  setProxyUrl: (url: string) => void
  saveStatus:  'idle' | 'saved'
  proxyStatus: 'unknown' | 'online' | 'offline'
  handleSave:  () => void
  handleBack:  () => void
}
