import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Bell, Check, Trash2, Search, ExternalLink } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/hooks/useSupabaseData";
import { supabaseDataStore } from "@/lib/supabaseDataStore";
import { 
  getNotifications, 
  markAsRead, 
  markAllAsRead, 
  deleteNotification,
  Notification 
} from "@/lib/notifications";

export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projects } = useProjects();
  const [query, setQuery] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Загружаем уведомления
  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user]);

  const loadNotifications = () => {
    if (!user) return;
    const userNotifications = getNotifications(user.id);
    setNotifications(userNotifications);
  };

  const filtered = notifications.filter(n =>
    [n.title, n.message].join(" ").toLowerCase().includes(query.toLowerCase())
  );

  const handleMarkAllRead = () => {
    if (!user) return;
    markAllAsRead(user.id);
    loadNotifications();
  };

  const handleClearRead = () => {
    const readNotifications = notifications.filter(n => n.read);
    readNotifications.forEach(n => deleteNotification(n.id));
    loadNotifications();
  };

  const handleToggleRead = (id: string) => {
    markAsRead(id);
    loadNotifications();
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Отмечаем как прочитанное
    if (!notification.read) {
      markAsRead(notification.id);
    }
    
    // Переходим по ссылке если есть
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
    }
  };

  const typeBadge = (type: Notification["type"]) => {
    switch (type) {
      case "error":
        return <Badge variant="destructive">Ошибка</Badge>;
      case "warning":
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-300">Важно</Badge>;
      case "success":
        return <Badge variant="secondary" className="bg-green-500/20 text-green-700 dark:text-green-300">Успех</Badge>;
      default:
        return <Badge variant="secondary">Инфо</Badge>;
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Только что";
    if (minutes < 60) return `${minutes} мин назад`;
    if (hours < 24) return `${hours} ч назад`;
    if (days < 7) return `${days} дн назад`;
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Уведомления
          </h1>
          <p className="text-muted-foreground mt-1">Все события и напоминания по проектам</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleMarkAllRead} className="btn-glass">
            <Check className="w-4 h-4 mr-2" /> Отметить все прочитанными
          </Button>
          <Button variant="outline" onClick={handleClearRead} className="btn-glass">
            <Trash2 className="w-4 h-4 mr-2" /> Очистить прочитанные
          </Button>
        </div>
      </div>

      <Card className="glass-card">
        <div className="p-4 border-b border-glass-border flex items-center gap-3">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Поиск уведомлений..."
              className="pl-10"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="divide-y divide-glass-border">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Нет уведомлений</p>
            </div>
          ) : (
            filtered.map((n) => (
              <div 
                key={n.id} 
                className={`p-4 transition-all duration-200 ${
                  n.actionUrl ? 'cursor-pointer hover:bg-secondary/20' : ''
                } ${!n.read ? 'bg-primary/5' : ''}`}
                onClick={() => n.actionUrl && handleNotificationClick(n)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 bg-gradient-to-r from-primary to-warning rounded-full flex items-center justify-center flex-shrink-0">
                      <Bell className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{n.title}</p>
                        {typeBadge(n.type)}
                        {!n.read && <Badge className="bg-primary/20 text-primary">Новое</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">{formatDate(n.timestamp)}</p>
                      {n.actionUrl && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-primary">
                          <ExternalLink className="w-3 h-3" />
                          <span>Нажмите для перехода</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="btn-glass" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleRead(n.id);
                      }}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="btn-glass text-destructive hover:text-destructive" 
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(n.id);
                        loadNotifications();
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}





