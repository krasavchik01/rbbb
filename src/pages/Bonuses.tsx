import { useState, useMemo, useEffect } from 'react';
import { getAllResponses, type SurveyResponse } from '@/lib/projectSurvey';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEmployees } from '@/hooks/useSupabaseData';
import { useProjects } from '@/hooks/useSupabaseData';
import { useTasks, type Task } from '@/hooks/useTasks';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { calculateProjectFinances } from '@/types/project-v3';
import { notifyBonusesApproved, notifyProjectClosed } from '@/lib/projectNotifications';
import {
  Gift,
  TrendingUp,
  Search,
  CheckCircle,
  Clock,
  Users,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function Bonuses() {
  const { user, checkPermission } = useAuth();
  const { projects = [], updateProject: updateProjectRecord, refresh: refreshProjects } = useProjects();
  const { employees = [] } = useEmployees();
  const { tasks = [] } = useTasks();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'paid'>('all');
  const [filterType, setFilterType] = useState<'all' | 'project' | 'kpi' | 'annual'>('all');
  const [draftAdjustments, setDraftAdjustments] = useState<Record<string, Record<string, string>>>({});

  // Часы по таймщитам (из project_survey_responses) — нужны CEO чтобы видеть факт
  // перед одобрением. По требованию 2026-05-22: «таймщиты привязываются по
  // итогу к финальному результату для ГД».
  const [surveyResponses, setSurveyResponses] = useState<SurveyResponse[]>([]);
  useEffect(() => {
    let active = true;
    getAllResponses()
      .then((rows) => { if (active) setSurveyResponses(rows); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // Индекс: для пары (userId × projectId) — сумма часов из answers.
  const hoursIndex = useMemo(() => {
    const idx = new Map<string, number>();
    for (const r of surveyResponses) {
      if (r.status !== 'submitted') continue;
      const userId = r.userId;
      for (const a of r.answers || []) {
        if (!a.participated) continue;
        if (typeof a.totalHours !== 'number' || a.totalHours <= 0) continue;
        const key = `${userId}__${a.projectId}`;
        idx.set(key, (idx.get(key) || 0) + a.totalHours);
      }
    }
    return idx;
  }, [surveyResponses]);
  const getHoursFor = (userId: string, projectId: string): number => hoursIndex.get(`${userId}__${projectId}`) || 0;

  // Статистика задач по проекту — CEO видит «нормально ли всё прошло»:
  // сколько задач, сколько выполнено, сколько просрочено.
  const getTaskStats = (projectId: string) => {
    const projectTasks = tasks.filter((t: Task) => t.project_id === projectId);
    const now = Date.now();
    let done = 0, overdue = 0, inProgress = 0, blocked = 0;
    for (const t of projectTasks) {
      if (t.status === 'done') done++;
      else if (t.status === 'blocked') blocked++;
      else if (t.status === 'in_progress' || t.status === 'in_review') inProgress++;
      // Просрочка: дедлайн прошёл и задача не done
      if (t.due_at && t.status !== 'done' && new Date(t.due_at).getTime() < now) overdue++;
    }
    return { total: projectTasks.length, done, overdue, inProgress, blocked };
  };

  // Полный обзор всей фирмы — только CEO и deputy_director (через permission VIEW_ALL_BONUSES).
  // Утверждение выплат — только CEO/admin.
  // Сотрудник без полного доступа всё равно может зайти и увидеть СВОИ бонусы — это
  // «персональный» режим (personalView). Закрытая страница для не-CEO была неверным
  // решением: сотрудники имели право знать сколько им начислено за их проекты.
  const canViewBonuses = checkPermission('VIEW_ALL_BONUSES');
  const canApproveBonusPayout = user?.role === 'ceo' || user?.role === 'admin';
  const personalView = !canViewBonuses;

  const projectsAwaitingApproval = useMemo(() => {
    return projects.filter((project: any) => (project?.notes?.status || project?.status) === 'pending_payment_approval');
  }, [projects]);

  const updateDraftAmount = (projectId: string, employeeId: string, amount: string) => {
    setDraftAdjustments((prev) => ({
      ...prev,
      [projectId]: {
        ...(prev[projectId] || {}),
        [employeeId]: amount,
      },
    }));
  };

  const approveProjectBonuses = async (project: any) => {
    if (!user || !canApproveBonusPayout) return;

    try {
      const finances = calculateProjectFinances(project);
      const adjustments = draftAdjustments[project.id] || {};
      const adjustedTeamBonuses = { ...finances.teamBonuses };

      Object.entries(adjustments).forEach(([employeeId, rawAmount]) => {
        if (!adjustedTeamBonuses[employeeId]) return;
        const parsedAmount = Number(rawAmount);
        if (!Number.isFinite(parsedAmount) || parsedAmount < 0) return;

        adjustedTeamBonuses[employeeId] = {
          ...adjustedTeamBonuses[employeeId],
          amount: parsedAmount,
          percent: finances.totalBonusAmount > 0 ? Number(((parsedAmount / finances.totalBonusAmount) * 100).toFixed(2)) : adjustedTeamBonuses[employeeId].percent,
          manuallyAdjusted: true,
        };
      });

      const totalPaidBonuses = Object.values(adjustedTeamBonuses).reduce((sum, bonus) => sum + (bonus.amount || 0), 0);
      const totalCosts = totalPaidBonuses + finances.totalContractorsAmount + finances.preExpenseAmount;
      const grossProfit = finances.amountWithoutVAT - totalCosts;
      const profitMargin = finances.amountWithoutVAT > 0 ? (grossProfit / finances.amountWithoutVAT) * 100 : 0;

      const updatedFinances = {
        ...finances,
        teamBonuses: adjustedTeamBonuses,
        totalPaidBonuses,
        totalCosts,
        grossProfit,
        profitMargin,
      };

      await updateProjectRecord(project.id, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        approvedBy: user.id,
        approvedByName: user.name,
        finances: updatedFinances,
      });

      const team = project.team || project.notes?.team || [];
      const teamIds = team.map((member: any) => member.userId || member.id).filter(Boolean);
      const partner = team.find((member: any) => member.role === 'partner');
      const pm = team.find((member: any) => ['manager_1', 'manager_2', 'manager_3'].includes(member.role));

      await notifyBonusesApproved({
        projectName: project.name || project.title || 'Проект',
        teamIds,
        ceoName: user.name,
        projectId: project.id,
      });

      await notifyProjectClosed({
        projectName: project.name || project.title || 'Проект',
        partnerId: partner?.userId || user.id,
        pmId: pm?.userId || user.id,
        teamIds,
        totalAmount: updatedFinances.totalPaidBonuses.toLocaleString('ru-RU'),
        currency: '₸',
        projectId: project.id,
      });

      setDraftAdjustments((prev) => {
        const next = { ...prev };
        delete next[project.id];
        return next;
      });

      await refreshProjects();

      toast({
        title: 'Проект закрыт',
        description: `${project.name || project.title || 'Проект'} утверждён, бонусы сохранены.`,
      });
    } catch (error: any) {
      console.error('Ошибка утверждения бонусов:', error);
      toast({
        title: 'Ошибка',
        description: error?.message || 'Не удалось утвердить бонусы и закрыть проект',
        variant: 'destructive',
      });
    }
  };

  // Получаем все бонусы из проектов
  const allBonuses = useMemo(() => {
    const bonuses: Array<{
      id: string;
      projectId: string;
      projectName: string;
      employeeId: string;
      employeeName: string;
      amount: number;
      percent: number;
      type: 'project' | 'kpi' | 'annual';
      status: 'pending' | 'approved' | 'paid';
      date: string;
      description: string;
    }> = [];

    projects.forEach((project: any) => {
      if (project.finances && project.finances.teamBonuses) {
        const finances = calculateProjectFinances(project);
        const projectStatus = project?.notes?.status || project?.status;
        Object.entries(finances.teamBonuses).forEach(([userId, bonus]: [string, any]) => {
          const employee = employees.find((e: any) => e.id === userId);
          if (employee) {
            bonuses.push({
              id: `${project.id}-${userId}`,
              projectId: project.id,
              projectName: project.name || project.title || 'Без названия',
              employeeId: userId,
              employeeName: employee.name || employee.email || 'Сотрудник',
              amount: bonus.amount || 0,
              percent: bonus.percent || 0,
              type: 'project',
              status: projectStatus === 'completed' ? 'approved' : 'pending',
              date: project.updated_at || project.created_at || new Date().toISOString(),
              description: `Бонус за проект "${project.name || project.title}"`
            });
          }
        });
      }
    });

    // В персональном режиме (обычный сотрудник без VIEW_ALL_BONUSES) показываем
    // только его собственные начисления.
    const ownerFiltered = personalView && user ? bonuses.filter((b) => b.employeeId === user.id) : bonuses;
    return ownerFiltered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [projects, employees, personalView, user]);

  // Фильтрация бонусов
  const filteredBonuses = useMemo(() => {
    return allBonuses.filter(bonus => {
      const matchesSearch = 
        bonus.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bonus.projectName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = filterStatus === 'all' || bonus.status === filterStatus;
      const matchesType = filterType === 'all' || bonus.type === filterType;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [allBonuses, searchTerm, filterStatus, filterType]);

  // Статистика
  const stats = useMemo(() => {
    const safeNumber = (val: number) => isNaN(val) || !isFinite(val) ? 0 : val;
    const total = safeNumber(allBonuses.reduce((sum, b) => sum + (b.amount || 0), 0));
    const pending = safeNumber(allBonuses.filter(b => b.status === 'pending').reduce((sum, b) => sum + (b.amount || 0), 0));
    const approved = safeNumber(allBonuses.filter(b => b.status === 'approved').reduce((sum, b) => sum + (b.amount || 0), 0));
    const paid = safeNumber(allBonuses.filter(b => b.status === 'paid').reduce((sum, b) => sum + (b.amount || 0), 0));

    return { total, pending, approved, paid, count: allBonuses.length };
  }, [allBonuses]);

  // Бонусы по сотрудникам
  const bonusesByEmployee = useMemo(() => {
    const grouped: Record<string, { employee: any; total: number; bonuses: typeof allBonuses }> = {};
    
    filteredBonuses.forEach(bonus => {
      if (!grouped[bonus.employeeId]) {
        const employee = employees.find((e: any) => e.id === bonus.employeeId);
        grouped[bonus.employeeId] = {
          employee: employee || { name: bonus.employeeName },
          total: 0,
          bonuses: []
        };
      }
      grouped[bonus.employeeId].total += bonus.amount;
      grouped[bonus.employeeId].bonuses.push(bonus);
    });

    return Object.values(grouped).sort((a, b) => b.total - a.total);
  }, [filteredBonuses, employees]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Выплачен</Badge>;
      case 'approved':
        return <Badge className="bg-blue-500"><CheckCircle className="w-3 h-3 mr-1" />Одобрен</Badge>;
      case 'pending':
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Ожидает</Badge>;
      default:
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Отклонён</Badge>;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 page-enter">

      {/* Заголовок */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl bg-yellow-500/15 flex items-center justify-center">
            <Gift className="w-5 h-5 text-yellow-500" />
          </span>
          Бонусы
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Система бонусов и поощрений</p>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Всего бонусов', value: stats.count, sub: 'записей', icon: Gift, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Общая сумма', value: (stats.total || 0).toLocaleString('ru-RU') + ' ₸', sub: 'начислено', icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-500/10' },
          { label: 'Ожидает', value: (stats.pending || 0).toLocaleString('ru-RU') + ' ₸', sub: 'на рассмотрении', icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
          { label: 'Выплачено', value: (stats.paid || 0).toLocaleString('ru-RU') + ' ₸', sub: 'итого', icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        ].map(({ label, value, sub, icon: Icon, color, bg }) => (
          <Card key={label} className="p-4 border-0 shadow-sm">
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground truncate">{label}</p>
                <p className="font-bold text-base leading-tight mt-0.5 truncate">{value}</p>
                <p className="text-xs text-muted-foreground/60">{sub}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {!personalView && projectsAwaitingApproval.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Ожидают финального утверждения CEO</h2>
            <p className="text-sm text-muted-foreground">Проверьте суммы, при необходимости скорректируйте их и закройте проект.</p>
          </div>

          {projectsAwaitingApproval.map((project: any) => {
            const finances = calculateProjectFinances(project);
            const team = project.team || project.notes?.team || [];
            const notes = project.notes || {};
            const clientName = notes.clientName || notes.client?.name || project.clientName;
            const ourCompany = notes.ourCompany || notes.companyName;
            const contractNumber = notes.contractNumber || notes.contract?.number;
            const contractDate = notes.contractDate || notes.contract?.date;
            const periodFrom = notes.periodFrom || notes.startDate;
            const periodTo = notes.periodTo || notes.endDate;
            const stats = getTaskStats(project.id);
            const tasksHealthy = stats.total > 0 && stats.overdue === 0 && stats.blocked === 0;
            const currency = notes.currency || '₸';

            return (
              <Card key={project.id} className="p-5 border border-blue-200 shadow-sm space-y-4">
                {/* Шапка проекта */}
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base">{project.name || project.title || 'Проект'}</h3>
                      <Badge className="bg-blue-500">Ждёт CEO</Badge>
                      {ourCompany && <Badge variant="outline" className="text-xs">{ourCompany}</Badge>}
                    </div>
                    {clientName && (
                      <p className="text-sm text-muted-foreground">Клиент: <b className="text-foreground">{clientName}</b></p>
                    )}
                    <p className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                      {contractNumber && <span>Договор № {contractNumber}{contractDate ? ` от ${format(new Date(contractDate), 'dd.MM.yyyy')}` : ''}</span>}
                      {periodFrom && periodTo && <span>Период: {periodFrom} → {periodTo}</span>}
                      <span>Сумма без НДС: <b className="text-foreground">{(finances.amountWithoutVAT || 0).toLocaleString('ru-RU')} {currency}</b></span>
                    </p>
                  </div>
                  {canApproveBonusPayout && (
                    <Button onClick={() => approveProjectBonuses(project)} className="gap-2 self-start">
                      <CheckCircle2 className="w-4 h-4" />
                      Утвердить и закрыть
                    </Button>
                  )}
                </div>

                {/* Статус задач */}
                {stats.total > 0 ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Задачи:</span>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">✓ {stats.done} готовы</Badge>
                    {stats.inProgress > 0 && <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">▶ {stats.inProgress} в работе</Badge>}
                    {stats.blocked > 0 && <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">⛔ {stats.blocked} заблокированы</Badge>}
                    {stats.overdue > 0 && <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">⏰ {stats.overdue} просрочены</Badge>}
                    {tasksHealthy && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">всё нормально</Badge>}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Задачи в системе не создавались (или импорт постфактум).</p>
                )}

                {/* Прозрачная формула расчёта */}
                <div className="text-xs bg-muted/40 rounded-md px-3 py-2 space-y-1">
                  <div className="font-medium text-foreground">Как считается бонус:</div>
                  <div>
                    Сумма без НДС <b>{(finances.amountWithoutVAT || 0).toLocaleString('ru-RU')}</b>
                    {' '}− Предрасход {finances.preExpensePercent}% (<b>{(finances.preExpenseAmount || 0).toLocaleString('ru-RU')}</b>)
                    {finances.totalContractorsAmount > 0 && <> − ГПХ (<b>{(finances.totalContractorsAmount || 0).toLocaleString('ru-RU')}</b>)</>}
                    {' '}= База бонусов <b>{(finances.bonusBase || 0).toLocaleString('ru-RU')}</b>
                  </div>
                  <div>
                    База × {(project.finances?.bonusPercent ?? 10)}% = Общий пул бонусов <b className="text-primary">{(finances.totalBonusAmount || 0).toLocaleString('ru-RU')} {currency}</b>
                    <span className="text-muted-foreground"> — распределяется ниже по ролям</span>
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  {team.map((member: any) => {
                    const userId = member.userId || member.id;
                    const bonus = finances.teamBonuses[userId];
                    const employee = employees.find((item: any) => item.id === userId);
                    const inputValue = draftAdjustments[project.id]?.[userId] ?? (bonus?.amount != null ? String(bonus.amount) : '0');
                    const actualHours = getHoursFor(userId, project.id);
                    const planned = (member.bonusPercent || bonus?.percent || 0);
                    const plannedAmount = ((finances.totalBonusAmount || 0) * planned) / 100;
                    const ROLE_LABEL: Record<string, string> = {
                      partner: 'Партнёр', manager_1: 'Менеджер 1', manager_2: 'Менеджер 2', manager_3: 'Менеджер 3',
                      supervisor_1: 'Супервайзер 1', supervisor_2: 'Супервайзер 2', supervisor_3: 'Супервайзер 3',
                      senior_assistant: 'Старший ассистент',
                      assistant_1: 'Ассистент 1', assistant_2: 'Ассистент 2', assistant_3: 'Ассистент 3',
                      tax_specialist_1: 'Налоговый специалист 1', tax_specialist_2: 'Налоговый специалист 2',
                    };

                    return (
                      <div key={userId} className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_0.9fr_1fr] gap-3 items-center p-3 rounded-lg bg-muted/30">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{employee?.name || member.userName || member.name || 'Участник'}</p>
                          <p className="text-xs text-muted-foreground">{ROLE_LABEL[member.role] || member.role}</p>
                        </div>
                        <div className="text-xs">
                          <div className="text-muted-foreground">от пула <b className="text-foreground">{planned}%</b></div>
                          <div className="text-muted-foreground">план: <b className="text-foreground">{plannedAmount.toLocaleString('ru-RU')} {currency}</b></div>
                        </div>
                        <div className="text-xs">
                          {actualHours > 0 ? (
                            <>
                              <div className="text-muted-foreground">факт</div>
                              <div className="font-semibold">{actualHours} ч.</div>
                            </>
                          ) : (
                            <span className="text-muted-foreground italic">без часов</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Input
                            value={inputValue}
                            onChange={(e) => updateDraftAmount(project.id, userId, e.target.value)}
                            inputMode="decimal"
                            disabled={!canApproveBonusPayout}
                            className="text-right"
                            title="Окончательная сумма бонуса (можно скорректировать вручную)"
                          />
                          <span className="text-xs text-muted-foreground">{currency}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Tabs defaultValue="list" className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="list" className="gap-1.5"><Gift className="w-3.5 h-3.5" />Список</TabsTrigger>
            <TabsTrigger value="by-employee" className="gap-1.5"><Users className="w-3.5 h-3.5" />По сотрудникам</TabsTrigger>
          </TabsList>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Поиск..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-muted/40 border-0 focus-visible:ring-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                <SelectTrigger className="bg-muted/40 border-0 text-sm">
                  <SelectValue placeholder="Статус" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  <SelectItem value="pending">Ожидает</SelectItem>
                  <SelectItem value="approved">Одобрен</SelectItem>
                  <SelectItem value="paid">Выплачен</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
                <SelectTrigger className="bg-muted/40 border-0 text-sm">
                  <SelectValue placeholder="Тип" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все типы</SelectItem>
                  <SelectItem value="project">Проект</SelectItem>
                  <SelectItem value="kpi">KPI</SelectItem>
                  <SelectItem value="annual">Годовой</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <TabsContent value="list" className="space-y-2 mt-2">
          {filteredBonuses.length === 0 ? (
            <Card className="p-12 text-center border-0 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-4">
                <Gift className="w-7 h-7 text-muted-foreground/50" />
              </div>
              <p className="font-medium text-muted-foreground">Бонусы не найдены</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Попробуйте изменить фильтры</p>
            </Card>
          ) : (
            filteredBonuses.map((bonus) => (
              <Card key={bonus.id} className="p-4 border-0 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                    <Gift className="w-5 h-5 text-yellow-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-semibold text-sm truncate">{bonus.employeeName}</h3>
                      {getStatusBadge(bonus.status)}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{bonus.projectName} · {format(new Date(bonus.date), 'dd MMM yyyy', { locale: ru })}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-base text-primary">{(bonus.amount || 0).toLocaleString('ru-RU')} ₸</p>
                    <p className="text-xs text-muted-foreground">{bonus.percent}% от базы</p>
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="by-employee" className="space-y-3 mt-2">
          {bonusesByEmployee.length === 0 ? (
            <Card className="p-12 text-center border-0 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-4">
                <Users className="w-7 h-7 text-muted-foreground/50" />
              </div>
              <p className="font-medium text-muted-foreground">Данные не найдены</p>
            </Card>
          ) : (
            bonusesByEmployee.map(({ employee, total, bonuses }) => (
              <Card key={employee.id || employee.name} className="p-4 border-0 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {(employee.name || 'N')[0]}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{employee.name || 'Неизвестный сотрудник'}</h3>
                      <p className="text-xs text-muted-foreground">{bonuses.length} бонусов</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">{(total || 0).toLocaleString('ru-RU')} ₸</p>
                    <p className="text-xs text-muted-foreground">Итого</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {bonuses.map((bonus) => (
                    <div key={bonus.id} className="flex items-center justify-between p-2.5 bg-muted/40 rounded-lg">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{bonus.projectName}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(bonus.date), 'dd MMM yyyy', { locale: ru })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                        {getStatusBadge(bonus.status)}
                        <span className="font-semibold text-sm">{(bonus.amount || 0).toLocaleString('ru-RU')} ₸</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
