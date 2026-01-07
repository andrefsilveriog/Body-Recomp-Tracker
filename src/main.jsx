import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import ErrorBoundary from './ui/ErrorBoundary.jsx'
import './styles.css'
import { AuthProvider } from './state/AuthContext.jsx'
import { ProfileProvider } from './state/ProfileContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <ProfileProvider>
          <ErrorBoundary><App /></ErrorBoundary>
        </ProfileProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
