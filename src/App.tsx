import React from 'react'
import { AppRouter } from '@routes'
import { useLoadAppSettings } from '@hooks'

export default function App(): React.JSX.Element {
  useLoadAppSettings()
  return <AppRouter />
}
