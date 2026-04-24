import { useAuth } from '@/contexts/AuthContext';
import { Bell, Menu, GitCommit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useSidebar } from '@/components/ui/sidebar';
import { useNavigate, useLocation } from 'react-router-dom';
import { getUnreadCount } from '@/lib/notifications';
import { useState, useEffect } from 'react';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Дашборд',
  '/dashboard': 'Дашборд',
  '/projects': 'Проекты',
  '/hr': 'HR',
  '/timesheets': 'Тайм-шиты',
  '/attendance': 'Посещаемость',
  '/bonuses': 'Бонусы',
  '/analytics': 'Аналитика',
  '/calendar': 'Календарь',
  '/tasks': 'Задачи',
  '/notifications': 'Уведомления',
  '/service-memos': 'Служебные записки',
  '/audit': 'Аудит МСА',
  '/ifrs9': 'МСФО 9 / ECL',
  '/project-approval': 'Утверждение проектов',
  '/tenders': 'Тендеры',
  '/settings': 'Настройки',
  '/user-management': 'Управление пользователями',
  '/diagnostics': 'Диагностика',
  '/employees': 'Сотрудники',
};

// Глобальные переменные из vite.config.ts
declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;

export function AppHeader() {
  const { user } = useAuth();
  const { toggleSidebar } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  const pageTitle = PAGE_TITLES[location.pathname] ?? '';

  useEffect(() => {
    if (!user) return;
    
    const updateCount = () => {
      const count = getUnreadCount(user.id);
      setUnreadCount(count);
    };
    
    updateCount();
    const interval = setInterval(updateCount, 5000);
    
    return () => clearInterval(interval);
  }, [user]);

  if (!user) return null;

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 md:h-16 items-center justify-between px-3 md:px-6">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-10 w-10 touch-manipulation flex-shrink-0"
            onClick={toggleSidebar}
            aria-label="Открыть меню"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-base md:text-lg font-semibold truncate max-w-[130px] md:max-w-none text-muted-foreground hidden md:block">
              SUITE-A
            </h1>
            {pageTitle && (
              <>
                <span className="text-border hidden md:block select-none">/</span>
                <span className="text-sm md:text-base font-semibold text-foreground truncate max-w-[180px] md:max-w-none">
                  {pageTitle}
                </span>
              </>
            )}
            {!pageTitle && (
              <span className="text-sm md:text-lg font-semibold text-foreground md:hidden">
                SUITE-A
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2 md:space-x-4">
          {/* Бейдж версии для админа */}
          {user.role === 'admin' && (
            <Badge
              variant="outline"
              className="hidden md:flex items-center gap-1 text-xs font-mono bg-muted/50 cursor-default"
              title={`Сборка: ${__BUILD_TIME__}`}
            >
              <GitCommit className="h-3 w-3" />
              {__APP_VERSION__}
            </Badge>
          )}

          <ThemeToggle />

          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 md:h-9 md:w-9 touch-manipulation relative"
            onClick={() => navigate('/notifications')}
            aria-label="Уведомления"
          >
            <Bell className="h-5 w-5 md:h-4 md:w-4" />
            {unreadCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 md:h-4 md:w-4 flex items-center justify-center p-0 text-xs font-bold"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </Button>
          
          <div className="flex items-center space-x-2">
            <Avatar className="h-9 w-9 md:h-8 md:w-8">
              <AvatarFallback className="text-xs md:text-sm">
                {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="hidden md:block">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.role}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
