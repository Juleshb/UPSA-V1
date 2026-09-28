import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './App.css'
import './landing.css'
import './site.css'
import './motion.css'
import './developers/developers.css'
import './platform/platform.css'
import App from './App.tsx'
import { CookieNotice } from './components/CookieNotice'
import { AuthProvider } from './platform/AuthContext'
import { CookieProvider } from './platform/CookieContext'
import { ThemeProvider } from './platform/ThemeContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <CookieProvider>
        <ThemeProvider>
          <AuthProvider>
            <App />
            <CookieNotice />
          </AuthProvider>
        </ThemeProvider>
      </CookieProvider>
    </BrowserRouter>
  </StrictMode>,
)
