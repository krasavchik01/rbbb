import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Bell, Search, RefreshCw, History, ArrowRight, Users, UserRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/hooks/useSupabaseData";
import { supabaseDataStore, Project } from "@/lib/supabaseDataStore";
import {
  getNotifications,
  Notification,
  checkDeadlinesAndNotify,
  markAsRead,
} from "@/lib/notifications";
import { useToast } from "@/hooks/use-toast";

function normalizeProjectName(value: unknown) {
  return String(value || '')
    .toLocaleLowerCase('ru-RU')
    .replace(/[«»"'`]/g, '')
    .replace(/[–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function projectNameFromNotification(notification: Notification) {
  const message = String(notification.message || '');
  const createdProject = message.match(/создал проект\s+["«]([\s\S]+)["»]\s+для клиента/iu)?.[1]?.trim();
  if (createdProject) return createdProject;
  return message.match(/Проект\s*[«"]([^»"]+)[»"]/iu)?.[1]?.trim()
    || message.match(/["«]([^"»]+)["»]/u)?.[1]?.trim()
    || '';
}

function findProjectByName(projectName: string, projects: Project[]) {
  const notifiedName = normalizeProjectName(projectName);
  if (!notifiedName) return undefined;
  const exact = projects.filter((project) => normalizeProjectName(project.name) === notifiedName);
  if (exact.length === 1) return exact[0];
  const fuzzy = projects.filter((project) => {
    const projectName = normalizeProjectName(project.name);
    return projectName.length >= 12
      && notifiedName.length >= 12
      && (projectName.includes(notifiedName) || notifiedName.includes(projectName));
  });
  return fuzzy.length === 1 ? fuzzy[0] : undefined;
}

function findNotificationProject(notification: Notification, projects: Project[]) {
  const actionUrl = String(notification.action_url || '');
  const directId = actionUrl.match(/[?&]teamProject=([^&]+)/)?.[1]
    || actionUrl.match(/^\/projects?\/([^/?]+)/)?.[1];
  if (directId) {
    const decodedId = decodeURIComponent(directId);
    const directProject = projects.find((project) => String(project.id) === decodedId);
    if (directProject) return directProject;
  }

  return findProjectByName(projectNameFromNotification(notification), projects);
}

function projectTeam(project?: Project): any[] {
  if (!project) return [];
  if (Array.isArray(project.team)) return project.team;
  return Array.isArray((project.notes as any)?.team) ? (project.notes as any).team : [];
}

function teamMemberName(member: any) {
  return member?.userName || member?.name || member?.employeeName || 'Без имени';
}

function teamMemberRole(member: any) {
  return String(member?.role || member?.role_on_project || 'member').trim().toLowerCase();
}

function teamRoleLabel(role: string) {
  const labels: Record<string, string> = {
    partner: 'Партнёр',
    project_leader: 'Руководитель',
    manager_1: 'Менеджер 1',
    manager_2: 'Менеджер 2',
    manager_3: 'Менеджер 3',
    assistant: 'Ассистент',
    assistant_1: 'Ассистент 1',
    assistant_2: 'Ассистент 2',
    assistant_3: 'Ассистент 3',
  };
  return labels[role] || role.replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
}

function isDeputyProjectTask(notification: Notification) {
  return /новый проект|требует утверждения/i.test(`${notification.title || ''} ${notification.message || ''}`);
}

function projectAlreadyProcessed(project?: Project) {
  if (!project) return false;
  const notesStatus = String((project.notes as any)?.status || '').trim().toLowerCase();
  const directStatus = String(project.status || '').trim().toLowerCase();
  const pendingStatuses = new Set(['', 'new', 'pending', 'pending_approval', 'active', 'approval']);
  return projectTeam(project).length > 0
    || !pendingStatuses.has(notesStatus)
    || !pendingStatuses.has(directStatus)
    || (Array.isArray(project.tasks) && project.tasks.length > 0);
}

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
  const staleDeputyTaskIds = user?.role === 'deputy_director'
    ? filtered
        .filter((notification) => !notification.read && isDeputyProjectTask(notification))
        .filter((notification) => projectAlreadyProcessed(findNotificationProject(notification, projects as Project[])))
        .map((notification) => notification.id)
    : [];
  const staleDeputyTaskIdKey = staleDeputyTaskIds.join('|');

  useEffect(() => {
    if (!staleDeputyTaskIdKey) return;
    let cancelled = false;
    Promise.all(staleDeputyTaskIds.map((notificationId) => markAsRead(notificationId)))
      .then(() => {
        if (!cancelled) return loadNotifications();
        return undefined;
      })
      .catch((error) => console.error('Не удалось закрыть старые задачи по проектам:', error));
    return () => { cancelled = true; };
  }, [staleDeputyTaskIdKey, loadNotifications]);

  const staleDeputyTaskIdSet = new Set(staleDeputyTaskIds);
  const activeNotifications = filtered.filter((notification) => (
    !notification.read
    && !isTeamHistory(notification)
    && !staleDeputyTaskIdSet.has(notification.id)
  ));
  // В истории оставляем только журнал выполненных действий, а не каждое
  // когда-либо прочитанное системное напоминание.
  const historyNotifications = filtered.filter(isTeamHistory);
  const visibleNotifications = notificationView === 'active' ? activeNotifications : historyNotifications;

  const handleNotificationClick = async (notification: Notification) => {
    // Получаем URL (поддерживаем оба варианта)
    const actionUrl = notification.action_url;
    if (!actionUrl) return;

    // До появления прямой ссылки старые уведомления для замдиректора вели в
    // общий свод. В их тексте есть название нового проекта — используем его,
    // чтобы также открыть простой экран назначения команды.
    const isLegacyDeputyProjectNotification = user?.role === 'deputy_director'
      && isDeputyProjectTask(notification)
      && ['/projects?view=working', '/project-approval'].includes(actionUrl);
    const notifiedProject = isLegacyDeputyProjectNotification
      ? findNotificationProject(notification, projects as Project[])
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

  const historyDescription = (notification: Notification) => {
    const message = String(notification.message || '');
    const project = message.match(/^Проект\s+«([\s\S]+?)»\r?\nПартнёр:/iu)?.[1]?.trim()
      || message.match(/Проект\s*[«"]([^»"]+)[»"]/iu)?.[1]?.trim();
    const action = message.match(/^Действие:\s*(.+)$/imu)?.[1]?.trim()
      || message.match(/Действие:\s*([^.]*)/iu)?.[1]?.trim();
    const actor = message.match(/^Выполнил\(а\):\s*(.+)$/imu)?.[1]?.trim()
      || message.match(/Выполнил\(а\):\s*([^.]*)/iu)?.[1]?.trim();
    const recordedPartner = message.match(/^Партнёр:\s*(.+)$/imu)?.[1]?.trim();
    const recordedLeader = message.match(/^Руководитель:\s*(.+)$/imu)?.[1]?.trim();
    const recordedMembers = message.match(/^Команда:\s*(.+)$/imu)?.[1]?.trim();

    const resolvedProjectName = project || projectNameFromNotification(notification);
    const liveProject = resolvedProjectName
      ? findProjectByName(resolvedProjectName, projects as Project[])
      : undefined;
    const team = projectTeam(liveProject);
    const partner = team.find((member: any) => teamMemberRole(member) === 'partner');
    const leader = team.find((member: any) => teamMemberRole(member) === 'project_leader')
      || team.find((member: any) => ['manager_1', 'manager_2', 'manager_3'].includes(teamMemberRole(member)));
    const partnerDisplayName = recordedPartner || (partner ? teamMemberName(partner) : 'Не назначен');
    const leaderDisplayName = recordedLeader || (leader ? teamMemberName(leader) : 'Не назначен');
    const members = team
      .filter((member: any) => (
        member !== partner
        && member !== leader
        && teamMemberName(member) !== teamMemberName(partner)
        && teamMemberName(member) !== teamMemberName(leader)
      ))
      .map((member: any) => `${teamRoleLabel(teamMemberRole(member))}: ${teamMemberName(member)}`);
    const recordedMemberList = recordedMembers
      ? (/нет остальных участников/i.test(recordedMembers)
          ? []
          : recordedMembers.split('|').map((item) => item.trim()).filter(Boolean))
      : members;
    const visibleMembers = recordedMemberList.filter((item) => {
      const memberName = item.includes(':') ? item.slice(item.indexOf(':') + 1).trim() : item;
      return memberName !== partnerDisplayName && memberName !== leaderDisplayName;
    });

    if (resolvedProjectName && action) return {
      project: resolvedProjectName,
      action,
      actor,
      partner: partnerDisplayName,
      leader: leaderDisplayName,
      members: visibleMembers,
    };

    // Формат истории из первых релизов: «Имя: действие. Проект «...».»
    const legacyProject = message.match(/Проект\s*[«"]([^»"]+)[»"]/iu)?.[1]?.trim();
    const legacyAction = message.match(/^[^:]+:\s*([^.]*)/u)?.[1]?.trim();
    return {
      project: legacyProject || 'Проект',
      action: legacyAction || message,
      actor: '',
      partner: partner ? teamMemberName(partner) : 'Не назначен',
      leader: leader ? teamMemberName(leader) : 'Не назначен',
      members,
    };
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return 'Только что';
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

  const unreadCount = activeNotifications.length;

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
          <p className="text-muted-foreground mt-1 text-sm">Только задачи, требующие действия. Выполненные назначения — в истории.</p>
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
                  ? 'После назначения команды задача исчезнет сама.'
                  : 'Здесь: проект, выполненное действие и время.'}
              </p>
            </div>
          ) : (
            visibleNotifications.map((n) => (
              <div
                key={n.id}
                className={`p-3 sm:p-4 transition-all duration-150 ${
                  notificationView === 'history' ? 'bg-muted/20' : 'bg-primary/3'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    n.type === 'error' ? 'bg-red-500/15' :
                    n.type === 'warning' ? 'bg-yellow-500/15' :
                    n.type === 'success' ? 'bg-green-500/15' :
                    'bg-primary/15'
                  }`}>
                    {notificationView === 'history' ? <History className="w-4 h-4 text-green-600" /> : <Bell className={`w-4 h-4 ${
                      n.type === 'error' ? 'text-red-500' :
                      n.type === 'warning' ? 'text-yellow-500' :
                      n.type === 'success' ? 'text-green-500' :
                      'text-primary'
                    }`} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    {notificationView === 'history' ? (() => {
                      const history = historyDescription(n);
                      return <>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">Выполнено</Badge>
                          <span className="text-xs text-muted-foreground">{formatDate(n.created_at)}</span>
                        </div>
                        <p className="mt-2 text-base font-bold leading-snug sm:text-lg">{history.project}</p>
                        <p className="mt-1 text-sm font-medium text-foreground/80">{history.action}</p>

                        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          <div className="rounded-lg border border-sky-200 bg-sky-50/70 p-2.5">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-sky-700">
                              <UserRound className="h-3.5 w-3.5" /> Партнёр
                            </div>
                            <p className="mt-1 text-sm font-semibold leading-snug">{history.partner}</p>
                          </div>
                          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2.5">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                              <UserRound className="h-3.5 w-3.5" /> Руководитель
                            </div>
                            <p className="mt-1 text-sm font-semibold leading-snug">{history.leader}</p>
                          </div>
                          <div className="rounded-lg border border-violet-200 bg-violet-50/70 p-2.5 sm:col-span-2 lg:col-span-1">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-700">
                              <Users className="h-3.5 w-3.5" /> Команда · {history.members.length}
                            </div>
                            {history.members.length > 0 ? (
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {history.members.map((member: string, index: number) => (
                                  <span key={`${member}-${index}`} className="rounded-md bg-background px-2 py-1 text-xs font-medium shadow-sm">{member}</span>
                                ))}
                              </div>
                            ) : <p className="mt-1 text-sm text-muted-foreground">Нет остальных участников</p>}
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {history.actor ? `Сделал(а): ${history.actor}` : 'Действие зафиксировано в HUB'}
                        </p>
                      </>;
                    })() : (
                      (() => {
                        const notifiedProjectName = projectNameFromNotification(n);
                        return <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Нужно назначить команду</Badge>
                              <span className="text-xs text-muted-foreground">{formatDate(n.created_at)}</span>
                            </div>
                            <p className="mt-2 text-base font-bold leading-snug sm:text-lg">
                              {notifiedProjectName || n.title}
                            </p>
                            {!notifiedProjectName && (
                              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{n.message}</p>
                            )}
                          </div>
                          {n.action_url && (
                            <Button size="sm" className="h-9 shrink-0 gap-1.5" onClick={() => handleNotificationClick(n)}>
                              Назначить команду <ArrowRight className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>;
                      })()
                    )}
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





