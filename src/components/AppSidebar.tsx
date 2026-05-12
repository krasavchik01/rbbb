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
  Mail,
  ClipboardList,
  BookOpen,
  Zap,
  Calculator,
  ClipboardCheck
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
  // Основные разделы - для всех
  { 
    title: "Дашборд", 
    url: "/", 
    icon: LayoutDashboard
  },
  { 
    title: "Проекты", 
    url: "/projects", 
    icon: FolderOpen
  },
  
  // Закупки - только для procurement
  { 
    title: "Создать проект", 
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
  
  // Управление проектами - для директоров
  { 
    title: "Утверждение проектов", 
    url: "/project-approval", 
    icon: CheckSquare,
    allowedRoles: ['deputy_director', 'ceo']
  },
  
  // HR - только для HR специалиста
  { 
    title: "HR", 
    url: "/hr", 
    icon: UserCheck,
    allowedRoles: ['hr']
  },
  
  // Работа и время - для всех кроме procurement и директоров, но HR ДОЛЖЕН видеть
  {
    title: "Тайм-щиты",
    url: "/timesheets",
    icon: Clock,
    excludeRoles: ['procurement', 'ceo', 'deputy_director']
  },
  // Посещаемость - для директоров и HR
  {
    title: "Посещаемость",
    url: "/attendance",
    icon: Activity,
    allowedRoles: ['ceo', 'deputy_director', 'hr', 'admin']
  },
  
  // Бонусы - для всех кроме procurement
  { 
    title: "Бонусы", 
    url: "/bonuses", 
    icon: Gift,
    permission: 'VIEW_BONUSES',
    excludeRoles: ['procurement']
  },
  
  // Аналитика - для партнеров, менеджеров и директоров
  { 
    title: "Аналитика", 
    url: "/analytics", 
    icon: TrendingUp,
    allowedRoles: ['partner', 'manager_1', 'manager_2', 'manager_3', 'deputy_director', 'ceo', 'admin']
  },
  
  // Планирование - для всех кроме procurement
  { 
    title: "Календарь", 
    url: "/calendar", 
    icon: Calendar,
    excludeRoles: ['procurement']
  },
  { 
    title: "Задачи", 
    url: "/tasks", 
    icon: CheckSquare,
    excludeRoles: ['procurement']
  },
  
  // Уведомления - для всех
  {
    title: "Уведомления",
    url: "/notifications",
    icon: Bell
  },

  // Опросы — сотрудники видят свой список, руководство управляет кампаниями
  {
    title: "Мои опросы",
    url: "/my-surveys",
    icon: ClipboardCheck,
  },
  {
    title: "Опросы (управление)",
    url: "/surveys",
    icon: ClipboardCheck,
    allowedRoles: ['deputy_director', 'ceo', 'admin', 'partner']
  },
  {
    title: "Предложения по проектам",
    url: "/survey-approval",
    icon: ClipboardCheck,
    allowedRoles: ['deputy_director', 'ceo', 'admin', 'partner']
  },

  // Служебные записки - НЕ для отдела закупок
  {
    title: "Служебные записки",
    url: "/service-memos",
    icon: ClipboardList,
    excludeRoles: ['procurement']
  },


  // Аудит по МСА - НЕ для отдела закупок (только для аудиторов)
  {
    title: "Аудит",
    url: "/audit",
    icon: BookOpen,
    excludeRoles: ['procurement']
  },

  // МСФО 9 - расчет ECL (только для рабочего персонала проектов)
  {
    title: "МСФО 9 / ECL",
    url: "/ifrs9",
    icon: Calculator,
    allowedRoles: ['partner', 'manager_1', 'manager_2', 'manager_3', 'supervisor_1', 'supervisor_2', 'supervisor_3', 'tax_specialist_1', 'tax_specialist_2', 'assistant_1', 'assistant_2', 'assistant_3', 'admin'],
  },

  // Администрирование - только для админов и партнеров
  {
    title: "Управление",
    url: "/user-management",
    icon: UserCog,
    allowedRoles: ['admin', 'partner']
  },
  
  // Технические - только для админов
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
    allowedRoles: ['admin']
  },
  {
    title: "SMTP Настройки",
    url: "/smtp-settings",
    icon: Mail,
    allowedRoles: ['admin']
  },
  {
    title: "Демо-пользователи",
    url: "/demo-users",
    icon: Zap,
    allowedRoles: ['admin']
  },
  {
    title: "🔍 Диагностика настроек",
    url: "/settings-diagnostics",
    icon: Settings,
    allowedRoles: ['admin']
  },

  // Настройки - для всех кроме директоров
  { 
    title: "Настройки", 
    url: "/settings", 
    icon: Settings,
    excludeRoles: ['ceo', 'deputy_director']
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

        {/* Основные разделы */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground uppercase text-xs font-semibold tracking-wider">
            Основное
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {menuItems.filter(item =>
                ['Дашборд', 'Проекты', 'Уведомления', 'Служебные записки', 'Аудит', 'МСФО 9 / ECL'].includes(item.title)
              ).map((item) => {
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
                          `flex items-center space-x-3 px-3 py-3 md:py-2 rounded-lg transition-all duration-200 touch-manipulation min-h-[44px] md:min-h-0 ${
                            isActive
                              ? "bg-primary/10 text-primary font-semibold border-l-2 border-primary pl-[10px]"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent/60 active:scale-[0.98]"
                          }`
                        }
                      >
                        <div className="relative flex-shrink-0">
                          <item.icon className="w-4 h-4" />
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
                          <span className="flex-1 text-sm">{item.title}</span>
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

        {/* Работа */}
        {menuItems.some(item => {
          const hasPermission = !item.permission || checkPermission(item.permission);
          const hasRoleAccess = item.allowedRoles ? hasAnyRole(item.allowedRoles) : true;
          const isExcluded = item.excludeRoles ? item.excludeRoles.includes(user.role) : false;
          return hasPermission && hasRoleAccess && !isExcluded &&
                 ['Создать проект', 'Тендеры', 'Утверждение проектов', 'HR', 'Тайм-щиты', 'Посещаемость', 'Бонусы', 'Аналитика', 'Календарь', 'Задачи', 'Мои опросы', 'Опросы (управление)', 'Предложения по проектам'].includes(item.title);
        }) && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground uppercase text-xs font-semibold tracking-wider">
              Работа
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {menuItems.filter(item =>
                  ['Создать проект', 'Тендеры', 'Утверждение проектов', 'HR', 'Тайм-щиты', 'Посещаемость', 'Бонусы', 'Аналитика', 'Календарь', 'Задачи', 'Мои опросы', 'Опросы (управление)', 'Предложения по проектам'].includes(item.title)
                ).map((item) => {
                  let hasPermission = true;
                  if (item.permission) {
                    if (typeof item.permission === 'string') {
                      hasPermission = checkPermission(item.permission);
                    } else if (Array.isArray(item.permission)) {
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
                            const isMobile = window.innerWidth < 768;
                            if (isMobile) {
                              setOpenMobile(false);
                            }
                          }}
                          className={({ isActive }) =>
                            `flex items-center space-x-3 px-3 py-3 md:py-2 rounded-lg transition-all duration-200 touch-manipulation min-h-[44px] md:min-h-0 ${
                              isActive
                                ? "bg-primary/10 text-primary font-semibold border-l-2 border-primary pl-[10px]"
                                : "text-muted-foreground hover:text-foreground hover:bg-accent/60 active:scale-[0.98]"
                            }`
                          }
                        >
                          <div className="relative flex-shrink-0">
                            <item.icon className="w-4 h-4" />
                          </div>
                          {!collapsed && (
                            <span className="flex-1 text-sm">{item.title}</span>
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
        )}

        {/* Администрирование */}
        {menuItems.some(item => {
          const hasPermission = !item.permission || checkPermission(item.permission);
          const hasRoleAccess = item.allowedRoles ? hasAnyRole(item.allowedRoles) : true;
          const isExcluded = item.excludeRoles ? item.excludeRoles.includes(user.role) : false;
          return hasPermission && hasRoleAccess && !isExcluded &&
                 ['Управление', 'Диагностика', 'Тест БД', 'SMTP Настройки', 'Демо-пользователи', 'Настройки'].includes(item.title);
        }) && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground uppercase text-xs font-semibold tracking-wider">
              Администрирование
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {menuItems.filter(item =>
                  ['Управление', 'Диагностика', 'Тест БД', 'SMTP Настройки', 'Демо-пользователи', 'Настройки'].includes(item.title)
                ).map((item) => {
                  let hasPermission = true;
                  if (item.permission) {
                    if (typeof item.permission === 'string') {
                      hasPermission = checkPermission(item.permission);
                    } else if (Array.isArray(item.permission)) {
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
                            const isMobile = window.innerWidth < 768;
                            if (isMobile) {
                              setOpenMobile(false);
                            }
                          }}
                          className={({ isActive }) =>
                            `flex items-center space-x-3 px-3 py-3 md:py-2 rounded-lg transition-all duration-200 touch-manipulation min-h-[44px] md:min-h-0 ${
                              isActive
                                ? "bg-primary/10 text-primary font-semibold border-l-2 border-primary pl-[10px]"
                                : "text-muted-foreground hover:text-foreground hover:bg-accent/60 active:scale-[0.98]"
                            }`
                          }
                        >
                          <div className="relative flex-shrink-0">
                            <item.icon className="w-4 h-4" />
                          </div>
                          {!collapsed && (
                            <span className="flex-1 text-sm">{item.title}</span>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

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
          
          {/* Copyright Footer */}
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