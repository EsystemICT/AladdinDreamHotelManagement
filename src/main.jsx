import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import GuestFeedback from './GuestFeedback.jsx'

const currentPath = window.location.pathname.replace(/\/+$/, '')
const isGuestFeedbackPage = currentPath === '/guest-feedback' || window.location.hash === '#guest-feedback'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isGuestFeedbackPage ? <GuestFeedback /> : <App />}
  </StrictMode>,
)
