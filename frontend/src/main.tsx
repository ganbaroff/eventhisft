import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { useAuthStore } from './store/auth.store'
import { authApi } from './api/client'
import './index.css'

// Restore auth state from localStorage on app boot
const token = localStorage.getItem('access_token')
if (token) {
  authApi.me()
    .then((user) => useAuthStore.setState({ user }))
    .catch(() => {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
    })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
