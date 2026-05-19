import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SettingsHook } from './types'

// ─── Constants ────────────────────────────────────────────────────

const PROXY_URL_KEY     = 'archflow_proxy_url'
const DEFAULT_PROXY_URL = 'http://127.0.0.1:3456'

// ─── useSettings ─────────────────────────────────────────────────

export const useSettings = (): SettingsHook => {
  const navigate = useNavigate()

  const [proxyUrl,    setProxyUrl]    = useState<string>(
    () => localStorage.getItem(PROXY_URL_KEY) ?? DEFAULT_PROXY_URL
  )
  const [saveStatus,  setSaveStatus]  = useState<'idle' | 'saved'>('idle')
  const [proxyStatus, setProxyStatus] = useState<'unknown' | 'online' | 'offline'>('unknown')

  const checkProxy = useCallback(async (url: string): Promise<void> => {
    try {
      const res = await fetch(`${url}/health`, {
        signal: AbortSignal.timeout(2000),
      })
      setProxyStatus(res.ok ? 'online' : 'offline')
    } catch {
      setProxyStatus('offline')
    }
  }, [])

  useEffect(() => {
    void checkProxy(proxyUrl)
  }, [proxyUrl, checkProxy])

  const handleSave = useCallback((): void => {
    const trimmed = proxyUrl.trim().replace(/\/$/, '')
    localStorage.setItem(PROXY_URL_KEY, trimmed)
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2000)
    void checkProxy(trimmed)
  }, [proxyUrl, checkProxy])

  const handleBack = useCallback((): void => {
    navigate(-1)
  }, [navigate])

  return {
    proxyUrl,
    setProxyUrl,
    saveStatus,
    proxyStatus,
    handleSave,
    handleBack,
  }
}
