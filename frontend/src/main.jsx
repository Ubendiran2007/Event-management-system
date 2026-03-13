import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// initialize firebase (configuration in src/firebase.js)
import './firebase'

// Ignore known browser-extension runtime messaging noise that can appear as
// uncaught promise rejections in the page context.
window.addEventListener('unhandledrejection', (event) => {
  const reasonText = String(event.reason?.message || event.reason || '');
  if (reasonText.includes('A listener indicated an asynchronous response by returning true')) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
