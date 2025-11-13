import { useAuth } from '@/contexts/AuthContext';
import { Bell, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useSidebar } from '@/components/ui/sidebar';
import { useNavigate } from 'react-router-dom';
import { getUnreadCount } from '@/lib/notifications';
import { useState, useEffect } from 'react';

export function AppHeader() {
  const { user } = useAuth();
  const { toggleSidebar } = useSidebar();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

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
        <div className="flex items-center space-x-2 md:space-x-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-10 w-10 touch-manipulation"
            onClick={toggleSidebar}
            aria-label="Открыть меню"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-base md:text-xl font-semibold truncate max-w-[150px] md:max-w-none">
            RB Partners Suite
          </h1>
        </div>
        
        <div className="flex items-center space-x-2 md:space-x-4">
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
