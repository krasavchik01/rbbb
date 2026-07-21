import { Link, useLocation } from 'react-router-dom';
import { CalendarCheck, Clock, FolderKanban, Users, Settings, Menu, LogOut, Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationBell } from '@/components/NotificationBell';
import { useState, useMemo } from 'react';
import { ROLE_GROUPS } from '@/lib/roleAccess';
import type { UserRole } from '@/types/roles';

interface NavItem {
  to: string;
  icon: any;
  label: string;
  excludeRoles?: readonly UserRole[];
  allowedRoles?: readonly UserRole[];
}

const allNavItems: NavItem[] = [
  { to: '/projects', icon: FolderKanban, label: 'Свод' },
  { to: '/timesheets', icon: Clock, label: 'Таймшиты' },
  { to: '/attendance', icon: CalendarCheck, label: 'Посещаемость' },
  { to: '/notifications', icon: Bell, label: 'Уведомления' },
  { to: '/hr', icon: Users, label: 'HR', allowedRoles: ROLE_GROUPS.hrManagement },
  { to: '/settings', icon: Settings, label: 'Настройки', allowedRoles: ROLE_GROUPS.admin },
];

function canShowNavItem(item: NavItem, userRole?: UserRole): boolean {
  if (item.allowedRoles) return !!userRole && item.allowedRoles.includes(userRole);
  if (item.excludeRoles) return !userRole || !item.excludeRoles.includes(userRole);
  return true;
}

export const MobileNavigation = () => {
  const location = useLocation();
  const { user } = useAuth();

  // Фильтруем пункты меню по роли пользователя
  const navItems = useMemo(() => {
    return allNavItems.filter((item) => canShowNavItem(item, user?.role));
  }, [user?.role]);

  // Четыре пункта — осознанный mobile предел: длинные подписи не слипаются на 360–390px.
  // Остальные разделы доступны из меню в шапке.
  const bottomNavItems = navItems.slice(0, 4);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50 safe-area-bottom">
      <div className="mx-auto flex h-[4.5rem] max-w-lg items-center justify-around px-1">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to;
          
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-label={item.label}
              className={`flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 transition-colors ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'scale-110' : ''}`} />
              <span className="max-w-full truncate text-[10px] font-medium leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export const MobileHeader = () => {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 bg-slate-900 border-b border-slate-800 z-40">
      <div className="flex items-center justify-between h-16 px-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-lg">RB</span>
          </div>
          <div>
            <h1 className="text-white font-bold text-lg">RB Partners</h1>
            <p className="text-slate-400 text-xs">{user?.name}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <ThemeToggle />
          
          <NotificationBell />

          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-slate-900 border-slate-800 w-80">
              <SheetHeader>
                <SheetTitle className="text-white">Меню</SheetTitle>
              </SheetHeader>
              
              <div className="mt-6 space-y-6">
                <div className="flex items-center space-x-3 p-4 bg-slate-800/50 rounded-lg">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-700 text-white font-semibold">
                      {user && getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-white font-semibold">{user?.name}</p>
                    <p className="text-slate-400 text-sm">{user?.email}</p>
                    <p className="text-slate-500 text-xs">{user?.position}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {allNavItems
                    .filter((item) => canShowNavItem(item, user?.role))
                    .map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={() => setIsOpen(false)}
                          className="flex items-center space-x-3 p-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                        >
                          <Icon className="h-5 w-5" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                </div>

                <Button
                  onClick={() => {
                    logout();
                    setIsOpen(false);
                  }}
                  variant="destructive"
                  className="w-full"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Выйти
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};




