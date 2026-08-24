import { useAuth, type User } from '@/contexts/AuthContext';
import { Bell, Menu, GitCommit, ShieldCheck, UserRoundCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useSidebar } from '@/components/ui/sidebar';
import { useNavigate, useLocation } from 'react-router-dom';
import { getUnreadCount } from '@/lib/notifications';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useEmployees } from '@/hooks/useSupabaseData';
import { ROLE_LABELS, normalizeUserRole } from '@/types/roles';
import type { Employee } from '@/lib/supabaseDataStore';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Дашборд',
  '/dashboard': 'Свод',
  '/projects': 'Свод',
  '/hr': 'HR',
  '/timesheets': 'Тайм-шиты',
  '/attendance': 'Посещаемость',
  '/bonuses': 'Бонусы',
  '/analytics': 'Аналитика',
  '/calendar': 'Календарь',
  '/tasks': 'Задачи',
  '/notifications': 'Уведомления',
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
  const { user, originalUser, isImpersonating, stopImpersonation } = useAuth();
  const { toggleSidebar } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  const pageTitle = PAGE_TITLES[location.pathname] ?? '';

  useEffect(() => {
    if (!user) return;
    // getUnreadCount async — раньше присваивался Promise, badge показывал NaN/0/Promise.
    const updateCount = () => {
      getUnreadCount(user.id).then(setUnreadCount).catch(() => setUnreadCount(0));
    };
    updateCount();
    const interval = setInterval(updateCount, 15000);
    
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
              HUB
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
                HUB
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2 md:space-x-4">
          {(user.role === 'admin' || isImpersonating) && (
            <RoleCheckMenu />
          )}

          {isImpersonating && originalUser && (
            <div className="hidden lg:flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs text-amber-900">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span className="max-w-[220px] truncate">
                Проверка: {user.name}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-amber-900 hover:bg-amber-100"
                onClick={() => void stopImpersonation()}
                aria-label="Вернуться в admin"
                title={`Вернуться: ${originalUser.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
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

function employeeToAuthUser(employee: Employee): User {
  const role = normalizeUserRole(employee.role, employee.level);
  return {
    id: employee.id,
    email: employee.email || '',
    name: employee.name || 'Без имени',
    role,
    companyId: employee.companyId || undefined,
    department: employee.department || '',
    position: employee.position || '',
    avatar: employee.name
      ? employee.name.split(' ').map((part) => part[0]).join('').toUpperCase().slice(0, 2)
      : 'UN',
  };
}

function RoleCheckMenu() {
  const { user, originalUser, isImpersonating, startImpersonation, stopImpersonation } = useAuth();
  const { employees, loading } = useEmployees();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [roleSearch, setRoleSearch] = useState('');
  const roleSearchInputRef = useRef<HTMLInputElement>(null);

  const canSwitch = (originalUser || user)?.role === 'admin';
  const sortedEmployees = useMemo(() => {
    return [...employees]
      .filter((employee) => employee.id && employee.name)
      .sort((a, b) => {
        const roleA = ROLE_LABELS[normalizeUserRole(a.role, a.level)] || a.role;
        const roleB = ROLE_LABELS[normalizeUserRole(b.role, b.level)] || b.role;
        return `${roleA} ${a.name}`.localeCompare(`${roleB} ${b.name}`, 'ru');
      });
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const query = roleSearch.trim().toLocaleLowerCase('ru');
    if (!query) return sortedEmployees;

    return sortedEmployees.filter((employee) => {
      const role = normalizeUserRole(employee.role, employee.level);
      const roleLabel = ROLE_LABELS[role] || role;
      return `${roleLabel} ${employee.name} ${employee.email || ''}`.toLocaleLowerCase('ru').includes(query);
    });
  }, [roleSearch, sortedEmployees]);

  const handleSwitch = async (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    const employee = sortedEmployees.find((item) => item.id === employeeId);
    if (!employee) return;
    await startImpersonation(employeeToAuthUser(employee));
  };

  if (!canSwitch) return null;

  return (
    <div className="hidden md:flex items-center gap-2">
      <UserRoundCheck className="h-4 w-4 text-muted-foreground" />
      <Select
        value={isImpersonating ? user?.id || selectedEmployeeId : selectedEmployeeId}
        onValueChange={(value) => void handleSwitch(value)}
        open={roleMenuOpen}
        onOpenChange={(open) => {
          setRoleMenuOpen(open);
          if (!open) {
            setRoleSearch('');
            return;
          }
          setTimeout(() => roleSearchInputRef.current?.focus(), 0);
        }}
        disabled={loading}
      >
        <SelectTrigger className="h-8 w-[230px] text-xs">
          <SelectValue placeholder={loading ? 'Загрузка ролей...' : 'Проверить роль'} />
        </SelectTrigger>
        <SelectContent className="max-h-[420px]">
          <div
            className="sticky top-0 z-10 border-b bg-popover p-2"
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key !== 'Escape') event.stopPropagation();
            }}
          >
            <Input
              ref={roleSearchInputRef}
              value={roleSearch}
              onChange={(event) => setRoleSearch(event.target.value)}
              placeholder="Поиск по ФИО или роли"
              aria-label="Поиск роли или сотрудника"
              className="h-8 text-xs"
            />
          </div>
          {filteredEmployees.map((employee) => {
            const role = normalizeUserRole(employee.role, employee.level);
            const roleLabel = ROLE_LABELS[role] || role;
            return (
              <SelectItem key={employee.id} value={employee.id} className="text-xs">
                {roleLabel}: {employee.name}
              </SelectItem>
            );
          })}
          {filteredEmployees.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">Никого не найдено</div>
          )}
        </SelectContent>
      </Select>
      {isImpersonating && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => void stopImpersonation()}
        >
          Вернуться
        </Button>
      )}
    </div>
  );
}
