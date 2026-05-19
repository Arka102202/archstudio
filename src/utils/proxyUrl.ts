const PROXY_URL_KEY     = 'archflow_proxy_url'
const DEFAULT_PROXY_URL = 'http://127.0.0.1:3456'

export function getProxyUrl(): string {
  return localStorage.getItem(PROXY_URL_KEY) ?? DEFAULT_PROXY_URL
}

export function getMessagesUrl(): string {
  return `${getProxyUrl()}/v1/chat/completions`
}
