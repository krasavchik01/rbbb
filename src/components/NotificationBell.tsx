/**
 * Колокольчик уведомлений с счетчиком
 */

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useProjects } from '@/hooks/useSupabaseData';
import { supabaseDataStore } from '@/lib/supabaseDataStore';
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead, type Notification } from '@/lib/notifications';
import { useNavigate } from 'react-router-dom';

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { projects } = useProjects();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const loadNotifications = () => {
    if (!user) return;
    const userNotifications = getNotifications(user.id);
    console.log('📬 Загрузка уведомлений для пользователя:', user.id, 'Найдено:', userNotifications.length);
    setNotifications(userNotifications.slice(0, 10)); // Показываем последние 10
    setUnreadCount(getUnreadCount(user.id));
    console.log('🔔 Непрочитанных:', getUnreadCount(user.id));
  };

  useEffect(() => {
    loadNotifications();
    
    // Обновляем каждые 5 секунд
    const interval = setInterval(loadNotifications, 5000);
    
    return () => clearInterval(interval);
  }, [user]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
      loadNotifications();
    }
    
    if (notification.actionUrl) {
      // Если это ссылка на проект, загружаем проект и передаем в state
      const projectMatch = notification.actionUrl.match(/^\/project\/([^\/]+)/);
      if (projectMatch) {
        const projectId = projectMatch[1];
        
        // Ищем проект в списке проектов
        let project = projects.find(p => {
          const pId = p.id || p.notes?.id || '';
          return pId === projectId || (typeof pId === 'string' && pId.includes(projectId));
        });
        
        // Если не нашли, загружаем напрямую из Supabase
        if (!project) {
          try {
            const allProjects = await supabaseDataStore.getProjects();
            project = allProjects.find(p => {
              const pId = p.id || p.notes?.id || '';
              return pId === projectId || (typeof pId === 'string' && pId.includes(projectId));
            });
          } catch (error) {
            console.error('Ошибка загрузки проекта:', error);
          }
        }
        
        // Переходим с проектом в state
        navigate(notification.actionUrl, { state: project ? { project } : undefined });
      } else {
        // Для других ссылок просто переходим
        navigate(notification.actionUrl);
      }
      setIsOpen(false);
    }
  };

  const handleMarkAllRead = () => {
    if (user) {
      markAllAsRead(user.id);
      loadNotifications();
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return '📋';
    }
  };

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'success': return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'warning': return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      case 'error': return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      default: return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} ч назад`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} дн назад`;
    
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs animate-pulse"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">Уведомления</h3>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleMarkAllRead}
              className="text-xs"
            >
              Прочитать все
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Bell className="h-12 w-12 mb-2 opacity-50" />
              <p>Нет уведомлений</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-4 cursor-pointer transition-colors hover:bg-muted/50 ${
                    !notification.read ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl flex-shrink-0">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`font-medium text-sm ${!notification.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatTime(notification.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        {notifications.length > 0 && (
          <div className="p-3 border-t text-center">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                navigate('/notifications');
                setIsOpen(false);
              }}
              className="w-full"
            >
              Посмотреть все
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

