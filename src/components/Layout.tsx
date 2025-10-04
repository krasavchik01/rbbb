import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Bell, Search, User, LogOut, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useNavigate } from "react-router-dom";
import { RoleBasedAccess } from "./RoleBasedAccess";
import { RoleSwitcher } from "./RoleSwitcher";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS } from "@/types/roles";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user: authUser, checkPermission } = useAuth();

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast({
        title: "Успешно!",
        description: "Вы вышли из системы",
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось выйти из системы",
        variant: "destructive",
      });
    }
  };
  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="h-16 border-b border-glass-border glass-card flex items-center justify-between px-6">
            <div className="flex items-center space-x-4">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Поиск проектов, сотрудников..." 
                  className="w-80 pl-10 glass border-glass-border"
                />
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <RoleBasedAccess 
                permission={PERMISSIONS.VIEW_NOTIFICATIONS}
                userRole={authUser?.role || 'employee'}
              >
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => navigate('/notifications')}
                >
                  <Bell className="w-5 h-5" />
                </Button>
              </RoleBasedAccess>
              
              <RoleBasedAccess 
                permission={PERMISSIONS.VIEW_CALENDAR}
                userRole={authUser?.role || 'employee'}
              >
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => navigate('/calendar')}
                >
                  <Calendar className="w-5 h-5" />
                </Button>
              </RoleBasedAccess>
              
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-primary to-warning rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-primary-foreground" />
                </div>
                <div className="text-sm">
                  <p className="font-medium">{authUser?.name || 'Демо Пользователь'}</p>
                  <p className="text-xs text-muted-foreground">{authUser?.role || 'Пользователь'}</p>
                </div>
                <RoleSwitcher />
              </div>

              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleSignOut}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}