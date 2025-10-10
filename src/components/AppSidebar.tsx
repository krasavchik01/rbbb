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
  LogOut
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

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  permission?: string;
  allowedRoles?: UserRole[];
}

const menuItems: MenuItem[] = [
  { 
    title: "Дашборд", 
    url: "/", 
    icon: LayoutDashboard,
    permission: PERMISSIONS.VIEW_DASHBOARD
  },
  { 
    title: "Проекты", 
    url: "/projects", 
    icon: FolderOpen,
    permission: PERMISSIONS.VIEW_PROJECTS
  },
  { 
    title: "Создать проект (Закупки)", 
    url: "/create-project-procurement", 
    icon: FileText,
    allowedRoles: ['procurement']
  },
  { 
    title: "Утверждение проектов", 
    url: "/project-approval", 
    icon: CheckSquare,
    allowedRoles: ['deputy_director', 'ceo']
  },
  { 
    title: "Сотрудники", 
    url: "/employees", 
    icon: Users,
    permission: PERMISSIONS.VIEW_EMPLOYEES
  },
  { 
    title: "HR", 
    url: "/hr", 
    icon: UserCheck,
    permission: PERMISSIONS.VIEW_HR
  },
  { 
    title: "Тайм-щиты", 
    url: "/timesheets", 
    icon: Clock,
    permission: PERMISSIONS.VIEW_TIMESHEETS
  },
  { 
    title: "Бонусы", 
    url: "/bonuses", 
    icon: Gift,
    permission: PERMISSIONS.VIEW_BONUSES
  },
  { 
    title: "Аналитика", 
    url: "/analytics", 
    icon: TrendingUp,
    permission: PERMISSIONS.VIEW_ANALYTICS
  },
  { 
    title: "Календарь", 
    url: "/calendar", 
    icon: Calendar,
    permission: PERMISSIONS.VIEW_CALENDAR
  },
  { 
    title: "Задачи", 
    url: "/tasks", 
    icon: CheckSquare,
    permission: PERMISSIONS.VIEW_PROJECTS
  },
  { 
    title: "Уведомления", 
    url: "/notifications", 
    icon: Bell,
    permission: PERMISSIONS.VIEW_NOTIFICATIONS
  },
  { 
    title: "Управление", 
    url: "/user-management", 
    icon: UserCog,
    permission: PERMISSIONS.VIEW_USER_MANAGEMENT,
    allowedRoles: ['admin', 'partner']
  },
  { 
    title: "Роли", 
    url: "/role-management", 
    icon: Key,
    permission: PERMISSIONS.MANAGE_ROLES,
    allowedRoles: ['admin']
  },
  { 
    title: "Шаблоны", 
    url: "/template-editor", 
    icon: FileText,
    permission: PERMISSIONS.MANAGE_ROLES,
    allowedRoles: ['admin', 'partner']
  },
  { 
    title: "Диагностика", 
    url: "/diagnostics", 
    icon: Activity,
    permission: PERMISSIONS.MANAGE_ROLES,
    allowedRoles: ['admin']
  },
  { 
    title: "Тест БД", 
    url: "/database-test", 
    icon: Activity,
    allowedRoles: ['admin', 'ceo']
  },
  { 
    title: "Настройки", 
    url: "/settings", 
    icon: Settings,
    permission: PERMISSIONS.VIEW_SETTINGS
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
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
      <SidebarContent className="glass-card border-r border-glass-border">
        {/* Logo */}
        <div className="p-6 border-b border-glass-border">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-primary to-secondary rounded-lg flex items-center justify-center">
              <span className="text-lg font-bold text-primary-foreground">RB</span>
            </div>
            {!collapsed && (
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  RB Partners Suite
                </h1>
                <p className="text-xs text-muted-foreground">Group Management Platform</p>
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
                const hasPermission = item.permission ? checkPermission(item.permission) : true;
                const hasRoleAccess = item.allowedRoles ? hasAnyRole(item.allowedRoles) : true;

                if (!hasPermission || !hasRoleAccess) {
                  return null;
                }

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end
                        className={({ isActive }) =>
                          `flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-300 ${
                            isActive
                              ? "bg-gradient-to-r from-primary/20 to-warning/20 text-primary border border-primary/30 glow-primary"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                          }`
                        }
                      >
                        <div className="relative">
                          <item.icon className="w-5 h-5" />
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
                          <span className="font-medium flex-1">{item.title}</span>
                        )}
                        {!collapsed && item.url === "/notifications" && unreadCount > 0 && (
                          <Badge variant="destructive" className="ml-auto">
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
          <div className="flex items-center justify-between">
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            )}
            <button
              onClick={logout}
              className="flex items-center justify-center p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all duration-300"
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