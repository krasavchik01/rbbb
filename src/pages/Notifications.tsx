import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Bell, Check, Trash2, Search, ExternalLink, RefreshCw, CheckCheck, History } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/hooks/useSupabaseData";
import { supabaseDataStore, Project } from "@/lib/supabaseDataStore";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  Notification,
  checkDeadlinesAndNotify
} from "@/lib/notifications";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projects } = useProjects();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [notificationView, setNotificationView] = useState<'active' | 'history'>('active');

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

  const isTeamHistory = (notification: Notification) => (
    notification.type === 'success'
    && /команда проекта (назначена|обновлена)/i.test(notification.title || '')
  );
  const activeNotifications = filtered.filter((notification) => !notification.read && !isTeamHistory(notification));
  const historyNotifications = filtered.filter((notification) => notification.read || isTeamHistory(notification));
  const visibleNotifications = notificationView === 'active' ? activeNotifications : historyNotifications;

  const handleMarkAllRead = async () => {
    if (!user) return;
    const ok = await markAllAsRead(user.id);
    await loadNotifications();
    if (ok) {
      toast({ title: '✅ Готово', description: 'Все уведомления отмечены как прочитанные' });
    }
  };

  const handleClearRead = async () => {
    const readNotifications = notifications.filter(n => n.read);
    if (readNotifications.length === 0) {
      toast({ title: 'Нет прочитанных', description: 'Нечего удалять' });
      return;
    }
    for (const n of readNotifications) {
      await deleteNotification(n.id);
    }
    await loadNotifications();
    toast({ title: '🗑️ Удалено', description: `Удалено ${readNotifications.length} прочитанных уведомлений` });
  };

  // Удалить ВСЕ уведомления пользователя (прочитанные и непрочитанные).
  // Разрушительное действие — вызывается из AlertDialog с подтверждением.
  const handleDeleteAll = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { deleted, error } = await deleteAllNotifications(user.id);
      if (error) {
        toast({ title: '❌ Ошибка', description: error, variant: 'destructive' });
      } else {
        toast({
          title: '🗑️ Все уведомления удалены',
          description: `Удалено ${deleted} ${deleted === 1 ? 'уведомление' : 'уведомлений'}`,
        });
      }
      await loadNotifications();
    } finally {
      setLoading(false);
    }
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

    // До появления прямой ссылки старые уведомления для замдиректора вели в
    // общий свод. В их тексте есть название нового проекта — используем его,
    // чтобы также открыть простой экран назначения команды.
    const isLegacyDeputyProjectNotification = user?.role === 'deputy_director'
      && actionUrl === '/projects?view=working'
      && /новый проект|требует утверждения/i.test(`${notification.title || ''} ${notification.message || ''}`);
    const notifiedProjectName = String(notification.message || '').match(/["«]([^"»]+)["»]/u)?.[1]?.trim();
    const notifiedProject = isLegacyDeputyProjectNotification && notifiedProjectName
      ? (projects as Project[]).find((project) => String(project.name || '').trim() === notifiedProjectName)
      : undefined;
    if (notifiedProject?.id) {
      navigate(`/projects?teamProject=${encodeURIComponent(String(notifiedProject.id))}&team=1`, {
        state: { project: notifiedProject },
      });
      return;
    }

    // Если это ссылка на проект, загружаем проект и передаем в state
    const projectMatch = actionUrl.match(/^\/projects?\/([^/]+)/);
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

  const unreadCount = Array.isArray(notifications)
    ? notifications.filter((notification) => !notification.read && !isTeamHistory(notification)).length
    : 0;

  return (
    <div className="space-y-4 sm:space-y-6 page-enter">

      {/* Заголовок */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </span>
            Уведомления
            {unreadCount > 0 && (
              <Badge className="bg-primary text-primary-foreground text-xs">{unreadCount}</Badge>
            )}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Активные задачи отдельно от истории выполненных действий</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCheckDeadlines}
            disabled={loading}
            className="gap-2 text-xs sm:text-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Проверить дедлайны</span>
            <span className="sm:hidden">Дедлайны</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={loading || unreadCount === 0}
            className="gap-2 text-xs sm:text-sm"
            title="Отметить все как прочитанные"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Прочитать все</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearRead}
            disabled={loading || notifications.filter(n => n.read).length === 0}
            className="gap-2 text-xs sm:text-sm"
            title="Удалить только прочитанные"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Удалить прочитанные</span>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={loading || notifications.length === 0}
                className="gap-2 text-xs sm:text-sm text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                title="Удалить все уведомления"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Удалить все</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Удалить все уведомления?</AlertDialogTitle>
                <AlertDialogDescription>
                  Будут удалены {notifications.length} {notifications.length === 1 ? 'уведомление' : 'уведомлений'}
                  {unreadCount > 0 && ` (включая ${unreadCount} непрочитанных)`}.
                  Действие необратимо.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAll}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Удалить все
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="p-2.5 sm:p-3 border-b border-border bg-muted/20">
          <div className="inline-flex w-full sm:w-auto gap-1 rounded-xl bg-muted/70 p-1" role="tablist" aria-label="Разделы уведомлений">
            <Button
              type="button"
              size="sm"
              variant={notificationView === 'active' ? 'default' : 'ghost'}
              onClick={() => setNotificationView('active')}
              className="flex-1 sm:flex-none gap-2 rounded-lg"
              role="tab"
              aria-selected={notificationView === 'active'}
            >
              <Bell className="h-3.5 w-3.5" />
              Активные
              <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1 text-[10px]">{activeNotifications.length}</Badge>
            </Button>
            <Button
              type="button"
              size="sm"
              variant={notificationView === 'history' ? 'default' : 'ghost'}
              onClick={() => setNotificationView('history')}
              className="flex-1 sm:flex-none gap-2 rounded-lg"
              role="tab"
              aria-selected={notificationView === 'history'}
            >
              <History className="h-3.5 w-3.5" />
              История
              <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1 text-[10px]">{historyNotifications.length}</Badge>
            </Button>
          </div>
        </div>
        <div className="p-3 sm:p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Поиск уведомлений..."
              className="pl-9 bg-muted/40 border-0 focus-visible:ring-1"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="divide-y divide-border">
          {loading && notifications.length === 0 ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50 animate-spin" />
              <p className="text-sm text-muted-foreground">Загрузка...</p>
            </div>
          ) : visibleNotifications.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-4">
                <Bell className="w-7 h-7 text-muted-foreground/50" />
              </div>
              <p className="font-medium text-muted-foreground">
                {notificationView === 'active' ? 'Нет активных уведомлений' : 'История пока пуста'}
              </p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                {notificationView === 'active'
                  ? 'Назначенная команда автоматически уходит в историю.'
                  : 'Здесь сохраняются назначение команды и другие выполненные действия.'}
              </p>
            </div>
          ) : (
            visibleNotifications.map((n) => (
              <div
                key={n.id}
                className={`p-3 sm:p-4 transition-all duration-150 ${
                  n.action_url ? 'cursor-pointer active:bg-muted/50' : ''
                } ${!n.read ? 'bg-primary/3' : 'hover:bg-muted/30'}`}
                onClick={() => n.action_url && handleNotificationClick(n)}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    n.type === 'error' ? 'bg-red-500/15' :
                    n.type === 'warning' ? 'bg-yellow-500/15' :
                    n.type === 'success' ? 'bg-green-500/15' :
                    'bg-primary/15'
                  }`}>
                    <Bell className={`w-4 h-4 ${
                      n.type === 'error' ? 'text-red-500' :
                      n.type === 'warning' ? 'text-yellow-500' :
                      n.type === 'success' ? 'text-green-500' :
                      'text-primary'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-medium text-sm">{n.title}</p>
                          {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <p className="text-xs text-muted-foreground/60">{formatDate(n.created_at)}</p>
                          {typeBadge(n.type)}
                          {n.action_url && (
                            <span className="text-xs text-primary flex items-center gap-0.5">
                              <ExternalLink className="w-3 h-3" />перейти
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-lg"
                          onClick={(e) => { e.stopPropagation(); handleToggleRead(n.id); }}
                          title={n.read ? "Прочитано" : "Отметить прочитанным"}
                        >
                          <Check className={`w-3.5 h-3.5 ${n.read ? 'text-green-500' : 'text-muted-foreground'}`} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); handleDelete(n.id); }}
                          title="Удалить"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
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





