import {
  FolderOpen,
  Settings,
  UserCheck,
  Bell,
  UserCog,
  Activity,
  FileText,
  LogOut,
  Award,
  Clock,
  CalendarCheck,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/roles';
import { getUnreadCount } from '@/lib/notifications';
import { ROLE_GROUPS } from '@/lib/roleAccess';

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  permission?: string;
  allowedRoles?: readonly UserRole[];
  excludeRoles?: readonly UserRole[];
}

// Sidebar intentionally stays short: the app should have one obvious place to start
// and a small set of action groups. Avoid duplicating the same route in multiple sections.
const SECTIONS: { label: string; items: MenuItem[] }[] = [
  {
    label: 'Работа',
    items: [
      { title: 'Свод', url: '/projects', icon: FolderOpen },
      { title: 'Таймшиты', url: '/timesheets', icon: Clock },
      { title: 'Посещаемость', url: '/attendance', icon: CalendarCheck },
      { title: 'Уведомления', url: '/notifications', icon: Bell },
      { title: 'Настройки', url: '/settings', icon: Settings },
    ],
  },
  {
    label: 'Управление',
    items: [
      { title: 'HR', url: '/hr', icon: UserCheck, allowedRoles: ROLE_GROUPS.hrManagement },
    ],
  },
  {
    label: 'Закупки',
    items: [
      { title: 'Создать проект', url: '/create-project-procurement', icon: FileText, allowedRoles: ROLE_GROUPS.procurement },
      { title: 'Тендеры', url: '/tenders', icon: Award, allowedRoles: ROLE_GROUPS.procurement },
    ],
  },
  {
    label: 'Админ',
    items: [
      { title: 'Пользователи', url: '/user-management', icon: UserCog, allowedRoles: ROLE_GROUPS.admin },
      { title: 'Диагностика', url: '/diagnostics', icon: Activity, allowedRoles: ROLE_GROUPS.admin },
    ],
  },
];

export function AppSidebar() {
  const { state, setOpenMobile } = useSidebar();
  const { user, checkPermission, hasAnyRole, logout } = useAuth();
  const collapsed = state === 'collapsed';
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    // getUnreadCount async — забыли await, в state летел Promise.
    // Badge никогда не показывал правильное число.
    const tick = () => {
      getUnreadCount(user.id).then(setUnreadCount).catch(() => setUnreadCount(0));
    };
    tick();
    const interval = setInterval(tick, 15000);
    return () => clearInterval(interval);
  }, [user]);

  if (!user) return null;

  const canShow = (item: MenuItem): boolean => {
    if (item.permission && !checkPermission(item.permission)) return false;
    if (item.allowedRoles && !hasAnyRole(item.allowedRoles)) return false;
    if (item.excludeRoles?.includes(user.role)) return false;
    return true;
  };

  const handleNavClick = () => {
    if (window.innerWidth < 768) setOpenMobile(false);
  };

  const renderItem = (item: MenuItem) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton asChild>
        <NavLink
          to={item.url}
          end
          onClick={handleNavClick}
          className={({ isActive }) =>
            `flex items-center space-x-3 px-3 py-3 md:py-2 rounded-lg transition-all duration-200 touch-manipulation min-h-[44px] md:min-h-0 ${
              isActive
                ? 'bg-primary/10 text-primary font-semibold border-l-2 border-primary pl-[10px]'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/60 active:scale-[0.98]'
            }`
          }
        >
          <div className="relative flex-shrink-0">
            <item.icon className="w-4 h-4" />
            {item.url === '/notifications' && unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs font-bold animate-pulse"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </div>
          {!collapsed && <span className="flex-1 text-sm">{item.title}</span>}
          {!collapsed && item.url === '/notifications' && unreadCount > 0 && (
            <Badge variant="destructive" className="ml-auto text-xs">
              {unreadCount}
            </Badge>
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar className={collapsed ? 'w-16' : 'w-64'} collapsible="icon">
      <SidebarContent className="bg-sidebar border-r border-sidebar-border">
        <div className="p-4 md:p-6 border-b border-glass-border">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 md:w-8 md:h-8 bg-gradient-to-r from-primary to-secondary rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-base md:text-lg font-bold text-primary-foreground">SA</span>
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <h1 className="text-base md:text-lg font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent truncate">
                  SUITE-A
                </h1>
                <p className="text-xs text-muted-foreground hidden md:block">Group Management Platform</p>
              </div>
            )}
          </div>
        </div>

        {SECTIONS.map((section) => {
          const visible = section.items.filter(canShow);
          if (visible.length === 0) return null;
          return (
            <SidebarGroup key={section.label}>
              <SidebarGroupLabel className="text-muted-foreground uppercase text-xs font-semibold tracking-wider">
                {section.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">{visible.map(renderItem)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}

        <div className="mt-auto p-4 border-t border-glass-border">
          <div className="flex items-center justify-between gap-2">
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate hidden md:block">{user.email}</p>
              </div>
            )}
            <button
              onClick={logout}
              className="flex items-center justify-center p-2 md:p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 active:bg-secondary/70 transition-all duration-300 touch-manipulation min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0"
              title="Выйти"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          {!collapsed && (
            <div className="mt-4 pt-4 border-t border-glass-border">
              <p className="text-[10px] text-muted-foreground text-center">
                © 2026 Aidos Tazhbenov<br />
                All Rights Reserved
              </p>
            </div>
          )}
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
