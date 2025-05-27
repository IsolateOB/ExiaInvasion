// src/main.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import AccountsPage from './accounts.jsx'
import CssBaseline from '@mui/material/CssBaseline';

const path = window.location.pathname
const Page = path.endsWith('accounts.html') ? AccountsPage : App

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CssBaseline />
    <Page />
  </StrictMode>
)