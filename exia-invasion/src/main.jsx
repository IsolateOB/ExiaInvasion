// SPDX-License-Identifier: GPL-3.0-or-later
// 应用程序入口文件
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import CssBaseline from '@mui/material/CssBaseline'

import App from './App.jsx'
import ManagementPage from './management.jsx'

const path = window.location.pathname

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CssBaseline />
    {path.endsWith('management.html') ? <ManagementPage /> : <App />}
  </StrictMode>,
)
