import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from '@/contexts/AuthContext'

// Минимальное подавление ошибок History/Location - только предотвращаем всплытие
window.addEventListener('error', (event) => {
  const msg = (event.error?.message || event.message || '').toLowerCase();
  if (msg.includes('insecure') || msg.includes('history') || msg.includes('location')) {
    event.preventDefault();
    return false;
  }
}, true);

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
