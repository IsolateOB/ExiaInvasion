// src/main.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import ManagementPage from './management.jsx'
import CssBaseline from '@mui/material/CssBaseline';

const path = window.location.pathname
const Page = path.endsWith('management.html') ? ManagementPage : App

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CssBaseline />
    <Page />
  </StrictMode>
)