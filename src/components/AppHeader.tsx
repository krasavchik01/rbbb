import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Bell, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useSidebar } from '@/components/ui/sidebar';
import { useNavigate } from 'react-router-dom';

export function AppHeader() {
  const { user } = useAuth();
  const { toggleSidebar } = useSidebar();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 md:h-16 items-center justify-between px-3 md:px-6">
        <div className="flex items-center space-x-2 md:space-x-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={toggleSidebar}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-base md:text-xl font-semibold truncate max-w-[150px] md:max-w-none">
            RB Partners Suite
          </h1>
        </div>

        <div className="flex items-center space-x-1 md:space-x-3">
          <ThemeToggle />

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 md:h-10 md:w-10"
            onClick={() => navigate('/notifications')}
          >
            <Bell className="h-4 w-4 md:h-5 md:w-5" />
          </Button>

          <div className="flex items-center space-x-2">
            <Avatar className="h-8 w-8 md:h-10 md:w-10">
              <AvatarFallback className="text-xs md:text-sm">
                {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="hidden md:block">
              <p className="text-sm font-medium truncate max-w-[150px]">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.role}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
