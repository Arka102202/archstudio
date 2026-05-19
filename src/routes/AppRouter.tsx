import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ProjectList } from '@pages/ProjectList'
import { Editor }      from '@pages/Editor'
import { Settings }    from '@pages/Settings'
import { ROUTES }      from '@constants/routes'

const AppRouter = (): React.JSX.Element => (
  <BrowserRouter>
    <Routes>
      <Route path={ROUTES.HOME}     element={<ProjectList />} />
      <Route path={ROUTES.EDITOR}   element={<Editor />} />
      <Route path={ROUTES.SETTINGS} element={<Settings />} />
      <Route path="*"               element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>
)

export default AppRouter
