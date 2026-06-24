const PROXY_URL_KEY = 'claude-url'

export function getProxyUrl(): string {
  return localStorage.getItem(PROXY_URL_KEY) ?? ''
}

export function getMessagesUrl(): string {
  return `${getProxyUrl()}/v1/chat/completions`
}

// Adds bypass-tunnel-reminder so localtunnel doesn't intercept requests
// with its interstitial warning page.
export function getProxyHeaders(): Record<string, string> {
  return {
    'Content-Type':              'application/json',
    'bypass-tunnel-reminder':    'true',
    'ngrok-skip-browser-warning': 'true',
  }
}
