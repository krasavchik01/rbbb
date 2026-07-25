import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { WidgetErrorBoundary } from '@/components/WidgetErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <WidgetErrorBoundary fullPage label="запуск приложения">
    <AuthProvider>
      <App />
    </AuthProvider>
  </WidgetErrorBoundary>
);
