// SPDX-License-Identifier: GPL-3.0-or-later
// 应用程序入口文件
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import ManagementPage from './management.jsx'
import CssBaseline from '@mui/material/CssBaseline';

// 根据URL路径选择对应的页面组件
const path = window.location.pathname
const Page = path.endsWith('management.html') ? ManagementPage : App

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CssBaseline />
    <Page />
  </StrictMode>
)