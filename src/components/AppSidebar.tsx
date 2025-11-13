import { 
  LayoutDashboard, 
  FolderOpen, 
  Users, 
  Clock, 
  Gift, 
  Settings,
  UserCheck,
  TrendingUp,
  Shield,
  Bell,
  Calendar,
  UserCog,
  Key,
  CheckSquare,
  Activity,
  FileText,
  LogOut,
  Award,
  Mail
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
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
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { RoleBasedAccess, RoleAccess } from "./RoleBasedAccess";
import { useAuth } from "@/contexts/AuthContext";
import { PERMISSIONS, UserRole } from "@/types/roles";
import { getUnreadCount } from "@/lib/notifications";
import { ThemeToggle } from "@/components/ThemeToggle";

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  permission?: string;
  allowedRoles?: UserRole[];
  excludeRoles?: UserRole[]; // Роли, для которых пункт НЕ показывается
}

const menuItems: MenuItem[] = [
  { 
    title: "Дашборд", 
    url: "/", 
    icon: LayoutDashboard
    // Нет ограничений - доступно всем
  },
  { 
    title: "Проекты", 
    url: "/projects", 
    icon: FolderOpen
    // Нет ограничений - доступно всем
  },
  { 
    title: "Создать проект (Закупки)", 
    url: "/create-project-procurement", 
    icon: FileText,
    allowedRoles: ['procurement']
  },
  { 
    title: "Тендеры", 
    url: "/tenders", 
    icon: Award,
    allowedRoles: ['procurement']
  },
  { 
    title: "Утверждение проектов", 
    url: "/project-approval", 
    icon: CheckSquare,
    allowedRoles: ['deputy_director', 'ceo']
  },
  { 
    title: "МСУК-1 Compliance", 
    url: "/msuk-compliance", 
    icon: Shield,
    allowedRoles: ['partner', 'deputy_director', 'ceo', 'admin']
  },
  { 
    title: "HR", 
    url: "/hr", 
    icon: UserCheck,
    excludeRoles: ['procurement']
    // Нет ограничений по разрешениям
  },
  { 
    title: "Тайм-щиты", 
    url: "/timesheets", 
    icon: Clock,
    excludeRoles: ['procurement']
    // Нет ограничений по разрешениям
  },
  { 
    title: "Посещаемость", 
    url: "/attendance", 
    icon: Activity,
    excludeRoles: ['procurement']
    // Нет ограничений по разрешениям
  },
  { 
    title: "Бонусы", 
    url: "/bonuses", 
    icon: Gift,
    permission: 'VIEW_BONUSES', // Ключ разрешения, а не массив
    excludeRoles: ['procurement']
  },
  { 
    title: "Аналитика", 
    url: "/analytics", 
    icon: TrendingUp,
    excludeRoles: ['procurement']
    // Нет ограничений по разрешениям
  },
  { 
    title: "Календарь", 
    url: "/calendar", 
    icon: Calendar,
    excludeRoles: ['procurement']
    // Нет ограничений по разрешениям
  },
  { 
    title: "Задачи", 
    url: "/tasks", 
    icon: CheckSquare,
    excludeRoles: ['procurement']
    // Нет ограничений по разрешениям
  },
  { 
    title: "Уведомления", 
    url: "/notifications", 
    icon: Bell,
    excludeRoles: ['procurement']
    // Нет ограничений по разрешениям
  },
  { 
    title: "Управление", 
    url: "/user-management", 
    icon: UserCog,
    allowedRoles: ['admin', 'partner']
  },
  { 
    title: "Роли", 
    url: "/role-management", 
    icon: Key,
    allowedRoles: ['admin']
  },
  { 
    title: "Шаблоны", 
    url: "/template-editor", 
    icon: FileText,
    allowedRoles: ['admin', 'partner']
  },
  { 
    title: "Диагностика", 
    url: "/diagnostics", 
    icon: Activity,
    allowedRoles: ['admin']
  },
  { 
    title: "Тест БД", 
    url: "/database-test", 
    icon: Activity,
    allowedRoles: ['admin', 'ceo']
  },
  { 
    title: "SMTP Настройки", 
    url: "/smtp-settings", 
    icon: Mail,
    allowedRoles: ['admin', 'ceo']
  },
  { 
    title: "Настройки", 
    url: "/settings", 
    icon: Settings
    // Нет ограничений - доступно всем
  },
];

export function AppSidebar() {
  const { state, setOpenMobile } = useSidebar();
  const { user, checkPermission, hasAnyRole, logout } = useAuth();
  const collapsed = state === "collapsed";
  const [unreadCount, setUnreadCount] = useState(0);

  // Обновляем счетчик уведомлений
  useEffect(() => {
    if (!user) return;
    
    const updateCount = () => {
      const count = getUnreadCount(user.id);
      setUnreadCount(count);
    };
    
    updateCount();
    
    // Обновляем каждые 5 секунд
    const interval = setInterval(updateCount, 5000);
    
    return () => clearInterval(interval);
  }, [user]);

  if (!user) return null;

  return (
    <Sidebar className={collapsed ? "w-16" : "w-64"} collapsible="icon">
      <SidebarContent className="bg-sidebar border-r border-sidebar-border">
        {/* Logo */}
        <div className="p-4 md:p-6 border-b border-glass-border">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 md:w-8 md:h-8 bg-gradient-to-r from-primary to-secondary rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-base md:text-lg font-bold text-primary-foreground">RB</span>
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <h1 className="text-base md:text-lg font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent truncate">
                  RB Partners Suite
                </h1>
                <p className="text-xs text-muted-foreground hidden md:block">Group Management Platform</p>
              </div>
            )}
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground uppercase text-xs font-semibold tracking-wider">
            Навигация
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-2">
              {menuItems.map((item) => {
                // Проверяем разрешения
                // item.permission может быть строкой (ключ разрешения) или массивом (старый формат)
                let hasPermission = true;
                if (item.permission) {
                  if (typeof item.permission === 'string') {
                    hasPermission = checkPermission(item.permission);
                  } else if (Array.isArray(item.permission)) {
                    // Старый формат - массив ролей, проверяем вручную
                    const permissionArray = item.permission as string[];
                    hasPermission = permissionArray.includes(user.role);
                  }
                }
                const hasRoleAccess = item.allowedRoles ? hasAnyRole(item.allowedRoles) : true;
                const isExcluded = item.excludeRoles ? item.excludeRoles.includes(user.role) : false;

                if (!hasPermission || !hasRoleAccess || isExcluded) {
                  return null;
                }

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end
                        onClick={() => {
                          // Закрываем сайдбар на мобильных после клика
                          const isMobile = window.innerWidth < 768;
                          if (isMobile) {
                            setOpenMobile(false);
                          }
                        }}
                        className={({ isActive }) =>
                          `flex items-center space-x-3 px-3 py-3 md:py-2 rounded-lg transition-all duration-300 touch-manipulation min-h-[44px] md:min-h-0 ${
                            isActive
                              ? "bg-gradient-to-r from-primary/20 to-warning/20 text-primary border border-primary/30 glow-primary"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 active:bg-secondary/70"
                          }`
                        }
                      >
                        <div className="relative flex-shrink-0">
                          <item.icon className="w-5 h-5 md:w-5 md:h-5" />
                          {item.url === "/notifications" && unreadCount > 0 && (
                            <Badge 
                              variant="destructive" 
                              className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs font-bold animate-pulse"
                            >
                              {unreadCount > 9 ? '9+' : unreadCount}
                            </Badge>
                          )}
                        </div>
                        {!collapsed && (
                          <span className="font-medium flex-1 text-sm md:text-base">{item.title}</span>
                        )}
                        {!collapsed && item.url === "/notifications" && unreadCount > 0 && (
                          <Badge variant="destructive" className="ml-auto text-xs">
                            {unreadCount}
                          </Badge>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* User Info & Logout */}
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
        </div>
      </SidebarContent>
    </Sidebar>
  );
}