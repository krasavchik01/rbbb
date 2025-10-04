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
  CheckSquare
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
import { RoleBasedAccess, RoleAccess } from "./RoleBasedAccess";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS, UserRole } from "@/types/roles";

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
    title: "Настройки", 
    url: "/settings", 
    icon: Settings,
    permission: PERMISSIONS.VIEW_SETTINGS
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { user, checkPermission, hasAnyRole } = useAuth();
  const collapsed = state === "collapsed";

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
                        <item.icon className="w-5 h-5" />
                        {!collapsed && <span className="font-medium">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}