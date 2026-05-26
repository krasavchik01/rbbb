import React from 'react';
import { useLocation } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { MobileNavigation } from './MobileNavigation';
import { ProjectSurveyBanner } from './ProjectSurveyBanner';
import { WidgetErrorBoundary } from './WidgetErrorBoundary';
import { useDeadlineNotifications } from '@/hooks/useDeadlineNotifications';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  // Автоматическая проверка дедлайнов при входе
  useDeadlineNotifications();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-[100vw] overflow-x-hidden">
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <AppHeader />
          <ProjectSurveyBanner />
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 pb-20 md:pb-6">
            <div className="w-full">
              {/* Глобальный boundary для всех страниц.
                  key={pathname} — при смене роута boundary сбрасывается,
                  иначе ошибка на одной странице залипнет на следующей. */}
              <WidgetErrorBoundary key={location.pathname} fullPage label="страница">
                {children}
              </WidgetErrorBoundary>
            </div>
          </main>
        </div>
      </div>
      <MobileNavigation />
    </div>
  );
}