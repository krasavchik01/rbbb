import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Bell, Check, Trash2, Search, ExternalLink, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/hooks/useSupabaseData";
import { supabaseDataStore, Project } from "@/lib/supabaseDataStore";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  Notification,
  checkDeadlinesAndNotify
} from "@/lib/notifications";
import { useToast } from "@/hooks/use-toast";

export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projects } = useProjects();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  // Функция загрузки уведомлений
  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userNotifications = await getNotifications(user.id);
      // Гарантируем что это массив
      setNotifications(Array.isArray(userNotifications) ? userNotifications : []);
    } catch (error) {
      console.error('Ошибка загрузки уведомлений:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Загружаем уведомления при монтировании
  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user, loadNotifications]);

  // Принудительная проверка дедлайнов
  const handleCheckDeadlines = async () => {
    if (!user || projects.length === 0) return;

    // Сбрасываем флаг последней проверки
    const lastCheckKey = `deadline_check_${user.id}`;
    localStorage.removeItem(lastCheckKey);

    setLoading(true);
    try {
      const result = await checkDeadlinesAndNotify(projects, user.id, user.role);
      if (result.notified > 0) {
        toast({
          title: '⏰ Уведомления о дедлайнах',
          description: `Отправлено ${result.notified} уведомлений`,
        });
      } else {
        toast({
          title: '✅ Всё в порядке',
          description: 'Нет срочных дедлайнов',
        });
      }
      await loadNotifications();
    } catch (error) {
      toast({
        title: '❌ Ошибка',
        description: 'Не удалось проверить дедлайны',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filtered = Array.isArray(notifications)
    ? notifications.filter(n =>
        [n.title || '', n.message || ''].join(" ").toLowerCase().includes(query.toLowerCase())
      )
    : [];

  const handleMarkAllRead = async () => {
    if (!user) return;
    await markAllAsRead(user.id);
    await loadNotifications();
  };

  const handleClearRead = async () => {
    const readNotifications = notifications.filter(n => n.read);
    for (const n of readNotifications) {
      await deleteNotification(n.id);
    }
    await loadNotifications();
  };

  const handleToggleRead = async (id: string) => {
    await markAsRead(id);
    await loadNotifications();
  };

  const handleDelete = async (id: string) => {
    await deleteNotification(id);
    await loadNotifications();
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Отмечаем как прочитанное
    if (!notification.read) {
      await markAsRead(notification.id);
      await loadNotifications();
    }

    // Получаем URL (поддерживаем оба варианта)
    const actionUrl = notification.action_url;
    if (!actionUrl) return;

    // Если это ссылка на проект, загружаем проект и передаем в state
    const projectMatch = actionUrl.match(/^\/projects?\/([^\/]+)/);
    if (projectMatch) {
      const projectId = projectMatch[1];

      // Ищем проект в списке проектов
      let project: Project | undefined = (projects as Project[]).find((p) => {
        const pId = p.id || (p as any).notes?.id || '';
        return pId === projectId || (typeof pId === 'string' && pId.includes(projectId));
      });

      // Если не нашли, загружаем напрямую из Supabase
      if (!project) {
        try {
          const allProjects = await supabaseDataStore.getProjects();
          project = allProjects.find((p) => {
            const pId = p.id || (p as any).notes?.id || '';
            return pId === projectId || (typeof pId === 'string' && pId.includes(projectId));
          });
        } catch (error) {
          console.error('Ошибка загрузки проекта:', error);
        }
      }

      // Переходим с проектом в state
      navigate(actionUrl, { state: project ? { project } : undefined });
    } else {
      // Для других ссылок просто переходим
      navigate(actionUrl);
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
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

  const unreadCount = Array.isArray(notifications) ? notifications.filter(n => !n.read).length : 0;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Уведомления
            {unreadCount > 0 && (
              <Badge className="ml-2 bg-primary">{unreadCount}</Badge>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">Все события и напоминания по проектам</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={handleCheckDeadlines}
            disabled={loading}
            className="btn-glass"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Проверить дедлайны
          </Button>
          <Button variant="outline" onClick={handleMarkAllRead} disabled={loading} className="btn-glass">
            <Check className="w-4 h-4 mr-2" /> Прочитать все
          </Button>
          <Button variant="outline" onClick={handleClearRead} disabled={loading} className="btn-glass">
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
          {loading && notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <RefreshCw className="w-12 h-12 mx-auto mb-4 opacity-50 animate-spin" />
              <p>Загрузка...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Нет уведомлений</p>
              <p className="text-sm mt-2">Нажмите "Проверить дедлайны" чтобы получить уведомления о приближающихся сроках</p>
            </div>
          ) : (
            filtered.map((n) => (
              <div
                key={n.id}
                className={`p-4 transition-all duration-200 ${
                  n.action_url ? 'cursor-pointer hover:bg-secondary/20' : ''
                } ${!n.read ? 'bg-primary/5' : ''}`}
                onClick={() => n.action_url && handleNotificationClick(n)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      n.type === 'error' ? 'bg-red-500' :
                      n.type === 'warning' ? 'bg-yellow-500' :
                      n.type === 'success' ? 'bg-green-500' :
                      'bg-gradient-to-r from-primary to-secondary'
                    }`}>
                      <Bell className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{n.title}</p>
                        {typeBadge(n.type)}
                        {!n.read && <Badge className="bg-primary/20 text-primary">Новое</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">{formatDate(n.created_at)}</p>
                      {n.action_url && (
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
                      title={n.read ? "Прочитано" : "Отметить прочитанным"}
                    >
                      <Check className={`w-4 h-4 ${n.read ? 'text-green-500' : ''}`} />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="btn-glass text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(n.id);
                      }}
                      title="Удалить"
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





