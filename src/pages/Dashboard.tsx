import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useProjects } from '@/hooks/useProjects';
import { useEmployees } from '@/hooks/useSupabaseData';
import { CheckInWidget } from '@/components/CheckInWidget';
import { supabase } from '@/integrations/supabase/client';
import {
  TrendingUp,
  Users,
  Briefcase,
  DollarSign,
  Calendar,
  Clock,
  Target,
  BarChart3,
  PieChart,
  Activity,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Zap,
  XCircle,
  FileText,
  Award,
  Timer,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Улучшенные компоненты графиков с футуристичным дизайном (мемоизированы для производительности)
const FuturisticBarChart = React.memo(({ data, title, colors = ['#3b82f6', '#8b5cf6', '#ec4899'] }: {
  data: Array<{ name: string, value: number }>,
  title: string,
  colors?: string[]
}) => {
  const safeValue = (val: number) => isNaN(val) || !isFinite(val) ? 0 : val;
  const maxValue = Math.max(...data.map(d => safeValue(d.value)), 1);

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-lg bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
        {title}
      </h4>
      <div className="space-y-3">
        {data.map((item, index) => {
          const value = safeValue(item.value);
          const width = maxValue > 0 ? (value / maxValue) * 100 : 0;
          const color = colors[index % colors.length];
          return (
            <div key={index} className="space-y-2 group">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{item.name}</span>
                <span className="text-sm font-bold text-primary">{value}</span>
              </div>
              <div className="relative w-full h-3 bg-secondary/30 rounded-full overflow-hidden backdrop-blur-sm">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden group-hover:scale-105"
                  style={{
                    width: `${Math.max(0, Math.min(100, width))}%`,
                    background: `linear-gradient(90deg, ${color}, ${color}dd)`,
                    boxShadow: `0 0 20px ${color}40`
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

const FuturisticPieChart = React.memo(({ data, title }: {
  data: Array<{ name: string, value: number, color: string }>,
  title: string
}) => {
  const safeValue = (val: number) => isNaN(val) || !isFinite(val) ? 0 : val;
  const total = data.reduce((sum, item) => sum + safeValue(item.value), 0);

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-lg bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
        {title}
      </h4>
      <div className="grid grid-cols-2 gap-3">
        {data.map((item, index) => {
          const value = safeValue(item.value);
          const percent = total > 0 ? Math.round((value / total) * 100) : 0;
          return (
            <div
              key={index}
              className="flex items-center space-x-3 p-3 rounded-lg bg-gradient-to-br from-secondary/50 to-secondary/20 backdrop-blur-sm border border-primary/20 hover:border-primary/40 transition-all group"
            >
              <div
                className="w-4 h-4 rounded-full flex-shrink-0 group-hover:scale-125 transition-transform"
                style={{
                  backgroundColor: item.color,
                  boxShadow: `0 0 10px ${item.color}60`
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">{value} ({percent}%)</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// Компонент метрики с футуристичным дизайном (мемоизирован)
const MetricCard = React.memo(({
  title,
  value,
  icon: Icon,
  trend,
  subtitle,
  gradient = "from-blue-500 to-purple-600"
}: {
  title: string;
  value: string | number;
  icon: any;
  trend?: { value: number; label: string };
  subtitle?: string;
  gradient?: string;
}) => {
  const navigate = useNavigate();

  return (
    <Card className="p-4 sm:p-6 relative overflow-hidden group cursor-pointer hover:scale-[1.02] transition-all duration-300 border-2 border-transparent hover:border-primary/30 bg-gradient-to-br from-background via-background to-secondary/10 backdrop-blur-sm">
      {/* Градиентный фон при наведении */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />

      {/* Декоративные элементы */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-secondary/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className={`p-2 sm:p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg shadow-primary/20`}>
            <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
          {trend && (
            <Badge
              variant={trend.value >= 0 ? "default" : "destructive"}
              className="flex items-center gap-1"
            >
              {trend.value >= 0 ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {trend.label}
            </Badge>
          )}
        </div>
        <div>
          <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1 sm:mt-2">{subtitle}</p>
          )}
        </div>
      </div>
    </Card>
  );
});

export default function Dashboard() {
  const { user } = useAuth();
  const { projects = [], loading: projectsLoading } = useProjects();
  const { employees = [], loading: employeesLoading } = useEmployees();
  const navigate = useNavigate();

  // Состояние для фильтра проектов по компании
  const [showOtherCompanies, setShowOtherCompanies] = useState(false);

  // Загружаем записи посещений из Supabase
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    supabase
      .from('attendance')
      .select('*')
      .eq('date', today)
      .then(({ data }) => {
        if (data) {
          // Маппим в формат, совместимый с остальным кодом Dashboard
          const mapped = data.map((row: any) => ({
            id: row.id,
            employeeId: row.employee_id,
            checkIn: row.check_in || '',
            checkOut: row.check_out || undefined,
            status: row.location_type === 'office' ? 'in_office' : 'remote',
            date: new Date(row.date).toDateString(),
          }));
          setAttendanceRecords(mapped);
        }
      });
  }, []);

  // Безопасные вычисления
  const safeNumber = (value: any): number => {
    if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
      return 0;
    }
    return Number(value);
  };

  // Фильтрация проектов по роли пользователя
  const userProjects = useMemo(() => {
    if (!user) return [];

    // CEO и deputy_director видят все проекты
    if (user.role === 'ceo' || user.role === 'deputy_director') {
      return projects;
    }

    // Партнер видит только свои проекты
    if (user.role === 'partner') {
      return projects.filter((p: any) => {
        const team = p.team || p.notes?.team || [];
        return team.some((member: any) => {
          const memberId = member.userId || member.id || member.employeeId;
          const memberRole = member.role || member.role_on_project;
          return memberId === user.id && memberRole === 'partner';
        });
      });
    }

    // Менеджеры видят проекты где они в команде
    if (user.role === 'manager_1' || user.role === 'manager_2' || user.role === 'manager_3') {
      return projects.filter((p: any) => {
        const team = p.team || p.notes?.team || [];
        return team.some((member: any) => {
          const memberId = member.userId || member.id || member.employeeId;
          return memberId === user.id;
        });
      });
    }

    // Остальные сотрудники видят проекты где они в команде
    const baseProjects = projects.filter((p: any) => {
      const team = p.team || p.notes?.team || [];
      return team.some((member: any) => {
        const memberId = member.userId || member.id || member.employeeId;
        return memberId === user.id;
      });
    });

    // Применяем фильтр по ТОО МАК (если галочка не стоит, показываем только ТОО МАК)
    if (!showOtherCompanies) {
      return baseProjects.filter((p: any) => {
        const companyName = p.client?.name || p.clientName || p.companyName || p.ourCompany || p.company || p.notes?.companyName || p.notes?.ourCompany || p.client || '';
        return typeof companyName === 'string' && companyName.toLowerCase().includes('мак');
      });
    }

    return baseProjects;
  }, [projects, user, showOtherCompanies]);

  // Хелпер: парсит notes (строка или объект)
  const parseNotes = (p: any): any => {
    if (!p.notes) return null;
    if (typeof p.notes === 'object') return p.notes;
    try { return JSON.parse(p.notes); } catch { return null; }
  };

  // Статистика проектов по реальным данным
  const projectStats = useMemo(() => {
    const total = userProjects.length;

    // Проекты ожидающие утверждения партнером (по доступным проектам)
    const pendingPartnerApproval = (user?.role === 'ceo' || user?.role === 'deputy_director')
      ? projects.filter((p: any) => {
        const ns = parseNotes(p)?.status;
        return ns === 'new' || ns === 'pending_approval';
      }).length
      : 0;

    // Проекты ожидающие распределения команды
    const awaitingTeam = (user?.role === 'ceo' || user?.role === 'deputy_director')
      ? projects.filter((p: any) => {
        const notes = parseNotes(p);
        const ns = notes?.status;
        const team = notes?.team || p.team || [];
        return ns === 'approved' && team.length === 0;
      }).length
      : 0;

    // Активные проекты (не pending, не completed)
    const active = userProjects.filter((p: any) => {
      const notes = parseNotes(p);
      const ns = notes?.status;
      if (ns === 'new' || ns === 'pending_approval') return false;
      const status = p.status || ns;
      return status === 'in_progress' || status === 'active' || status === 'В работе' || status === 'Активный';
    }).length;

    // Завершённые
    const completed = userProjects.filter((p: any) => {
      const ns = parseNotes(p)?.status;
      const status = p.status || ns;
      return status === 'completed' || status === 'closed' || status === 'Завершён';
    }).length;

    // Общая сумма проектов пользователя
    const totalRevenue = userProjects.reduce((sum: number, p: any) => {
      const amount = p.notes?.finances?.amountWithoutVAT ||
        p.notes?.contract?.amountWithoutVAT ||
        p.notes?.amountWithoutVAT ||
        p.notes?.amount ||
        p.contract?.amountWithoutVAT ||
        p.amountWithoutVAT ||
        p.amount ||
        0;
      return sum + safeNumber(amount);
    }, 0);

    // Проекты по компаниям (клиентам или внутренним)
    const projectsByCompany = userProjects.reduce((acc: any, p: any) => {
      const company = p.client?.name || p.clientName || p.companyName || p.ourCompany || p.company || p.notes?.companyName || p.notes?.ourCompany || p.client || 'Не указана';
      acc[company] = (acc[company] || 0) + 1;
      return acc;
    }, {});

    // Средний бюджет проекта
    const avgBudget = total > 0 ? totalRevenue / total : 0;

    // Прогресс проектов (средний)
    const avgProgress = userProjects.length > 0
      ? Math.round(userProjects.reduce((sum: number, p: any) => sum + (p.completionPercent || p.completion || 0), 0) / userProjects.length)
      : 0;

    return {
      total,
      pendingPartnerApproval,
      awaitingTeam,
      active,
      completed,
      totalRevenue,
      avgBudget,
      avgProgress,
      projectsByCompany
    };
  }, [userProjects, projects, user]);

  // Статистика сотрудников (только для CEO/deputy)
  const employeeStats = useMemo(() => {
    if (user?.role !== 'ceo' && user?.role !== 'deputy_director') {
      return {
        total: 0,
        byRole: {},
        attendanceToday: 0
      };
    }

    return {
      total: employees.length,
      byRole: employees.reduce((acc: any, emp: any) => {
        acc[emp.role] = (acc[emp.role] || 0) + 1;
        return acc;
      }, {}),
      attendanceToday: attendanceRecords.filter((r: any) =>
        r.date === new Date().toDateString()
      ).length
    };
  }, [employees, attendanceRecords, user]);

  // Данные для графиков
  const projectStatusData = useMemo(() => {
    const isDirector = user?.role === 'ceo' || user?.role === 'deputy_director';
    const data = [
      { name: 'В работе', value: (projectStats.active || 0), color: '#10b981' },
      { name: 'Завершенные', value: (projectStats.completed || 0), color: '#3b82f6' }
    ];

    if (isDirector) {
      data.unshift(
        { name: 'Ожидают утверждения', value: (projectStats.pendingPartnerApproval || 0), color: '#f59e0b' },
        { name: 'Ожидают команды', value: (projectStats.awaitingTeam || 0), color: '#fb923c' }
      );
    }

    return data;
  }, [projectStats, user]);

  const companyDistributionData = useMemo(() => {
    if (!projectStats.projectsByCompany || Object.keys(projectStats.projectsByCompany).length === 0) {
      return [];
    }
    return Object.entries(projectStats.projectsByCompany)
      .sort(([, a]: any, [, b]: any) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([name, count]: [string, any]) => ({
        name: name.length > 15 ? name.substring(0, 15) + '...' : name,
        value: (count as number) || 0
      }));
  }, [projectStats.projectsByCompany]);

  const roleDistributionPieData = useMemo(() => {
    if (!employeeStats.byRole || Object.keys(employeeStats.byRole).length === 0) {
      return [];
    }
    const colorPalette = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#14b8a6', '#f43f5e'];
    return Object.entries(employeeStats.byRole).map(([role, count], index) => ({
      name: role === 'partner' ? 'Партнеры' :
        role === 'manager_1' || role === 'manager_2' || role === 'manager_3' ? 'Менеджеры' :
          role === 'manager' ? 'Менеджеры' :
            role === 'tax_specialist' ? 'Налоговики' :
              role === 'senior_auditor' ? 'Ст. аудиторы' :
                role === 'assistant' ? 'Ассистенты' :
                  role === 'admin' ? 'Админы' : role,
      value: (count as number) || 0,
      color: colorPalette[index % colorPalette.length]
    })).sort((a, b) => b.value - a.value);
  }, [employeeStats.byRole]);

  // Топ 5 проектов по выручке
  const topProjectsData = useMemo(() => {
    if (user?.role !== 'ceo' && user?.role !== 'deputy_director') return [];

    return [...userProjects]
      .filter((p: any) => {
        const amount = safeNumber(p.finances?.amountWithoutVAT || p.notes?.finances?.amountWithoutVAT || p.contract?.amountWithoutVAT || p.amount || 0);
        return amount > 0;
      })
      .sort((a: any, b: any) => {
        const valA = safeNumber(a.finances?.amountWithoutVAT || a.notes?.finances?.amountWithoutVAT || a.contract?.amountWithoutVAT || a.amount || 0);
        const valB = safeNumber(b.finances?.amountWithoutVAT || b.notes?.finances?.amountWithoutVAT || b.contract?.amountWithoutVAT || b.amount || 0);
        return valB - valA;
      })
      .slice(0, 5)
      .map((p: any) => ({
        id: p.id,
        name: p.name || p.client?.name || p.companyName || 'Проект',
        value: safeNumber(p.finances?.amountWithoutVAT || p.notes?.finances?.amountWithoutVAT || p.contract?.amountWithoutVAT || p.amount || 0),
        progress: p.completionPercent || p.completion || 0
      }));
  }, [userProjects, user]);

  // Реальная месячная выручка (только для директоров)
  const monthlyRevenueData = useMemo(() => {
    if (user?.role !== 'ceo' && user?.role !== 'deputy_director') return [];

    const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
    const revenueByMonth: Record<string, number> = {};

    projects.forEach((p: any) => {
      const deadline = p.contract?.serviceEndDate || p.deadline;
      if (!deadline) return;

      try {
        const date = new Date(deadline);
        const monthKey = months[date.getMonth()];
        if (monthKey) {
          const amount = p.notes?.finances?.amountWithoutVAT ||
            p.notes?.contract?.amountWithoutVAT ||
            p.notes?.amountWithoutVAT ||
            p.notes?.amount ||
            p.contract?.amountWithoutVAT ||
            p.amountWithoutVAT ||
            p.amount ||
            0;
          revenueByMonth[monthKey] = (revenueByMonth[monthKey] || 0) + safeNumber(amount);
        }
      } catch { }
    });

    return months.slice(0, 6).map(month => ({
      name: month,
      value: revenueByMonth[month] || 0
    }));
  }, [projects, user]);

  // Последние добавленные проекты (активность)
  const recentProjects = useMemo(() => {
    return [...projects]
      .sort((a: any, b: any) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      })
      .slice(0, 5)
      .map((p: any) => {
        const notes = parseNotes(p);
        const ns = notes?.status;
        let statusLabel = 'Черновик';
        let statusColor = 'text-muted-foreground bg-muted/50';
        if (ns === 'new' || ns === 'pending_approval') {
          statusLabel = 'На утверждении';
          statusColor = 'text-yellow-700 bg-yellow-500/15';
        } else if (ns === 'approved' && (notes?.team || p.team || []).length === 0) {
          statusLabel = 'Ожидает команду';
          statusColor = 'text-orange-700 bg-orange-500/15';
        } else if (p.status === 'in_progress' || p.status === 'active') {
          statusLabel = 'В работе';
          statusColor = 'text-green-700 bg-green-500/15';
        } else if (p.status === 'completed') {
          statusLabel = 'Завершён';
          statusColor = 'text-blue-700 bg-blue-500/15';
        }
        const company = notes?.companyName || notes?.ourCompany || notes?.client?.name || p.companyName || p.ourCompany || '—';
        const createdAt = p.created_at ? new Date(p.created_at) : null;
        const daysAgo = createdAt ? Math.floor((Date.now() - createdAt.getTime()) / 86400000) : null;
        return {
          id: p.id,
          name: p.name || notes?.name || 'Без названия',
          company,
          statusLabel,
          statusColor,
          createdAt,
          daysAgo,
        };
      });
  }, [projects]);

  // Подсчёт срочных дедлайнов
  const urgentDeadlines = useMemo(() => {
    let overdue = 0;
    let critical = 0; // 0-3 дня
    let warning = 0;  // 4-7 дней
    const urgentList: Array<{ project: any; daysLeft: number; urgency: 'overdue' | 'critical' | 'warning' }> = [];

    userProjects.forEach((project: any) => {
      // Пропускаем завершённые проекты
      const status = project.notes?.status || project.status;
      if (status === 'completed' || status === 'closed') return;

      const deadlineStr = project.contract?.serviceEndDate || project.deadline || project.notes?.contract?.serviceEndDate || project.notes?.deadline;
      if (!deadlineStr) return;

      try {
        const deadline = new Date(deadlineStr);
        if (isNaN(deadline.getTime())) return;

        const now = new Date();
        now.setHours(0, 0, 0, 0);
        deadline.setHours(0, 0, 0, 0);

        const diffTime = deadline.getTime() - now.getTime();
        const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (daysLeft < 0) {
          overdue++;
          urgentList.push({ project, daysLeft, urgency: 'overdue' });
        } else if (daysLeft <= 3) {
          critical++;
          urgentList.push({ project, daysLeft, urgency: 'critical' });
        } else if (daysLeft <= 7) {
          warning++;
          urgentList.push({ project, daysLeft, urgency: 'warning' });
        }
      } catch { }
    });

    // Сортируем по срочности
    urgentList.sort((a, b) => a.daysLeft - b.daysLeft);

    return { overdue, critical, warning, total: overdue + critical + warning, urgentList };
  }, [userProjects]);

  if (projectsLoading || employeesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/20 border-t-primary"></div>
          <div className="absolute inset-0 animate-ping rounded-full h-12 w-12 border-4 border-primary/40"></div>
        </div>
      </div>
    );
  }

  const isDirector = user?.role === 'ceo' || user?.role === 'deputy_director';
  const isPartner = user?.role === 'partner';
  const isManager = user?.role === 'manager_1' || user?.role === 'manager_2' || user?.role === 'manager_3';
  const isProcurement = user?.role === 'procurement';

  return (
    <div className="space-y-4 sm:space-y-6 page-enter">
      {/* Заголовок */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary" />
            </span>
            Дашборд
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {isDirector
              ? 'Обзор деятельности компании'
              : isPartner
                ? 'Мои проекты и активность'
                : isManager
                  ? 'Управление проектами'
                  : isProcurement
                    ? 'Проекты на утверждении'
                    : 'Моя деятельность'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <div className="flex items-center space-x-2 bg-secondary/20 p-2 rounded-lg backdrop-blur-sm border border-primary/10">
            <Switch
              id="show-other-companies"
              checked={showOtherCompanies}
              onCheckedChange={setShowOtherCompanies}
            />
            <Label htmlFor="show-other-companies" className="text-xs sm:text-sm font-medium cursor-pointer">
              Другие компании
            </Label>
          </div>

          <Badge variant="outline" className="hidden sm:flex items-center space-x-2 px-4 py-2 backdrop-blur-sm border-primary/20">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <Activity className="h-4 w-4" />
            <span>Обновлено: {new Date().toLocaleTimeString('ru-RU')}</span>
          </Badge>
        </div>
      </div>

      {/* Уведомление о срочных дедлайнах */}
      {urgentDeadlines.total > 0 && (
        <Card className={`p-4 border-0 shadow-sm border-l-4 ${urgentDeadlines.overdue > 0
          ? 'border-l-red-500'
          : urgentDeadlines.critical > 0
            ? 'border-l-orange-500'
            : 'border-l-yellow-500'
          }`}>
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
              urgentDeadlines.overdue > 0 ? 'bg-red-500/15' :
              urgentDeadlines.critical > 0 ? 'bg-orange-500/15' : 'bg-yellow-500/15'
            }`}>
              <AlertCircle className={`w-5 h-5 ${
                urgentDeadlines.overdue > 0 ? 'text-red-500' :
                urgentDeadlines.critical > 0 ? 'text-orange-500' : 'text-yellow-500'
              }`} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm">Срочные дедлайны</h3>
              <div className="flex flex-wrap gap-3 mt-1.5">
                {urgentDeadlines.overdue > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-500/10 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    Просрочено: {urgentDeadlines.overdue}
                  </span>
                )}
                {urgentDeadlines.critical > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-600 bg-orange-500/10 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                    До 3 дней: {urgentDeadlines.critical}
                  </span>
                )}
                {urgentDeadlines.warning > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-yellow-600 bg-yellow-500/10 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                    До 7 дней: {urgentDeadlines.warning}
                  </span>
                )}
              </div>
              {urgentDeadlines.urgentList.length > 0 && (
                <div className="mt-2.5 space-y-1">
                  {urgentDeadlines.urgentList.slice(0, 3).map(({ project, daysLeft, urgency }) => (
                    <div key={project.id || project.notes?.id} className="flex items-center gap-2 text-xs">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        urgency === 'overdue' ? 'bg-red-500' : urgency === 'critical' ? 'bg-orange-500' : 'bg-yellow-500'
                      }`} />
                      <span className="font-medium truncate">{project.name || project.client?.name || 'Без названия'}</span>
                      <span className="text-muted-foreground flex-shrink-0">
                        {daysLeft < 0 ? `−${Math.abs(daysLeft)} дн.` : daysLeft === 0 ? 'сегодня' : `${daysLeft} дн.`}
                      </span>
                    </div>
                  ))}
                  {urgentDeadlines.urgentList.length > 3 && (
                    <p className="text-xs text-muted-foreground pl-3.5">+{urgentDeadlines.urgentList.length - 3} ещё</p>
                  )}
                </div>
              )}
              <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs px-2 -ml-2" onClick={() => navigate('/projects')}>
                Перейти к проектам →
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Основные метрики - адаптивные для каждой роли */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`}>
        {/* Общая выручка - только для директоров */}
        {isDirector && (
          <MetricCard
            title="Общая выручка"
            value={safeNumber(projectStats.totalRevenue) > 0 ? `${(safeNumber(projectStats.totalRevenue) / 1000000).toFixed(1)}M ₸` : '0 ₸'}
            icon={DollarSign}
            trend={{ value: 12, label: '+12%' }}
            subtitle="За все проекты"
            gradient="from-green-500 to-emerald-600"
          />
        )}

        {/* Активные проекты */}
        <MetricCard
          title="В работе"
          value={projectStats.active}
          icon={Activity}
          subtitle={`из ${projectStats.total} проектов`}
          gradient="from-blue-500 to-cyan-600"
        />

        {/* Статистика сотрудников - только для директоров */}
        {isDirector && (
          <MetricCard
            title="Сотрудники"
            value={employeeStats.total}
            icon={Users}
            subtitle={`${employeeStats.attendanceToday} сегодня в офисе`}
            gradient="from-purple-500 to-pink-600"
          />
        )}

        {/* Завершено */}
        <MetricCard
          title="Завершено"
          value={projectStats.completed}
          icon={CheckCircle}
          subtitle="Успешных проектов"
          gradient="from-indigo-500 to-blue-600"
        />

        {/* Средний прогресс - для всех кроме директоров (у них выручка/сотрудники) */}
        {!isDirector && (
          <MetricCard
            title="Средний прогресс"
            value={`${projectStats.avgProgress}%`}
            icon={Target}
            subtitle="По всем проектам"
            gradient="from-orange-500 to-red-600"
          />
        )}

        {/* Ожидают утверждения - для procurement и директоров */}
        {(isProcurement || isDirector) && (
          <MetricCard
            title="На утверждении"
            value={projectStats.pendingPartnerApproval}
            icon={AlertTriangle}
            subtitle="Требуют внимания"
            gradient={projectStats.pendingPartnerApproval > 0 ? "from-yellow-500 to-orange-600" : "from-slate-400 to-slate-500"}
          />
        )}
      </div>

      {/* Графики и аналитика - адаптивные */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">

        {/* Прогресс выполнения (новый виджет) */}
        {projectStats.active > 0 && (
          <Card className="p-4 sm:p-6 relative overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-background via-background to-secondary/10 backdrop-blur-sm lg:col-span-1 flex flex-col justify-center">
            <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl" />
            <div className="relative z-10 text-center">
              <h3 className="text-lg font-semibold mb-6 flex items-center justify-center gap-2">
                <Target className="h-5 w-5 text-blue-500" />Средний прогресс
              </h3>

              <div className="relative inline-flex items-center justify-center mb-4">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-secondary/30" />
                  <circle
                    cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="12" fill="transparent"
                    strokeDasharray={351.86} strokeDashoffset={351.86 - (351.86 * projectStats.avgProgress) / 100}
                    strokeLinecap="round" className="text-blue-500 transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className="text-3xl font-bold">{projectStats.avgProgress}%</span>
                </div>
              </div>

              <div className="flex justify-between text-sm text-muted-foreground px-4 mt-2">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span>В работе</span>
                <span className="font-medium">{projectStats.active} шт.</span>
              </div>
            </div>
          </Card>
        )}

        {/* Статус проектов */}
        {projectStatusData.length > 0 && (
          <Card className="p-4 sm:p-6 relative overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-background via-background to-secondary/10 backdrop-blur-sm lg:col-span-2">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
            <div className="relative z-10">
              <div className="flex items-center space-x-2 mb-6">
                <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-secondary">
                  <PieChart className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold">Аналитика по статусам проектов</h3>
              </div>
              <FuturisticPieChart data={projectStatusData} title="" />
            </div>
          </Card>
        )}

        {/* Последняя активность */}
        {recentProjects.length > 0 && (
          <Card className="p-4 sm:p-6 relative overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-background via-background to-secondary/10 backdrop-blur-sm lg:col-span-3">
            <div className="absolute top-0 right-0 w-40 h-40 bg-cyan-500/5 rounded-full blur-3xl" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600">
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold">Последняя активность</h3>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/projects')}>Все проекты →</Button>
              </div>
              <div className="space-y-2">
                {recentProjects.map((proj, idx) => (
                  <div
                    key={proj.id || idx}
                    className="flex items-center gap-3 p-3 rounded-lg bg-secondary/20 hover:bg-secondary/40 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/project/${proj.id}`)}
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors" title={proj.name}>{proj.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{proj.company}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${proj.statusColor}`}>
                        {proj.statusLabel}
                      </span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {proj.daysAgo === 0 ? 'сегодня' : proj.daysAgo === 1 ? 'вчера' : proj.daysAgo !== null ? `${proj.daysAgo}д. назад` : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* Распределение по компаниям */}
        {companyDistributionData.length > 0 && (
          <Card className="p-4 sm:p-6 relative overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-background via-background to-secondary/10 backdrop-blur-sm">
            <div className="absolute top-0 right-0 w-40 h-40 bg-secondary/10 rounded-full blur-3xl" />
            <div className="relative z-10">
              <div className="flex items-center space-x-2 mb-6">
                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold">
                  {isDirector ? 'Проекты по компаниям' : 'Мои проекты по компаниям'}
                </h3>
              </div>
              <FuturisticBarChart data={companyDistributionData} title="" />
            </div>
          </Card>
        )}

        {/* Распределение по ролям - только для директоров (теперь красивый PieChart) */}
        {isDirector && roleDistributionPieData.length > 0 && (
          <Card className="p-4 sm:p-6 relative overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-background via-background to-secondary/10 backdrop-blur-sm lg:col-span-1">
            <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/5 rounded-full blur-3xl" />
            <div className="relative z-10">
              <div className="flex items-center space-x-2 mb-6">
                <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold">Структура команды</h3>
              </div>
              <FuturisticPieChart data={roleDistributionPieData} title="" />
            </div>
          </Card>
        )}

        {/* Топ 5 проектов по бюджету (НОВЫЙ ВИДЖЕТ) */}
        {isDirector && topProjectsData.length > 0 && (
          <Card className="p-4 sm:p-6 relative overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-background via-background to-secondary/10 backdrop-blur-sm lg:col-span-2">
            <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600">
                    <Award className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold">Топ-5 проектов по выручке</h3>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/projects')}>Все проекты &rarr;</Button>
              </div>
              <div className="space-y-4">
                {topProjectsData.map((proj, idx) => (
                  <div key={proj.id || idx} className="bg-white dark:bg-slate-900 rounded-xl p-3 shadow-sm border border-slate-100 dark:border-slate-800 hover:border-amber-300 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-700 dark:text-amber-400 font-bold text-sm">
                          #{idx + 1}
                        </div>
                        <div>
                          <p className="font-semibold text-sm line-clamp-1" title={proj.name}>{proj.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{proj.progress}% завершено</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-200">
                          {(proj.value).toLocaleString('ru-RU')} ₸
                        </Badge>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
                      <div className="bg-amber-500 h-1.5 rounded-full transition-all duration-1000" style={{ width: `${Math.max(0, Math.min(100, proj.progress))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* Месячная выручка - только для директоров */}
        {isDirector && monthlyRevenueData.length > 0 && (
          <Card className="p-4 sm:p-6 relative overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-background via-background to-secondary/10 backdrop-blur-sm">
            <div className="absolute top-0 right-0 w-40 h-40 bg-green-500/5 rounded-full blur-3xl" />
            <div className="relative z-10">
              <div className="flex items-center space-x-2 mb-6">
                <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold">Выручка по месяцам</h3>
              </div>
              <FuturisticBarChart data={monthlyRevenueData} title="" colors={['#10b981', '#3b82f6', '#8b5cf6']} />
            </div>
          </Card>
        )}

        {/* Посещаемость - только для директоров */}
        {isDirector && (
          <Card className="p-4 sm:p-6 relative overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-background via-background to-secondary/10 backdrop-blur-sm">
            <div className="absolute top-0 right-0 w-40 h-40 bg-cyan-500/5 rounded-full blur-3xl" />
            <div className="relative z-10">
              <div className="flex items-center space-x-2 mb-6">
                <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600">
                  <Activity className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold">Посещаемость</h3>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/30 backdrop-blur-sm">
                  <span className="text-sm font-medium">Сегодня в офисе</span>
                  <span className="font-bold text-primary">
                    {attendanceRecords.filter((r: any) =>
                      r.date === new Date().toDateString() && r.status === 'in_office'
                    ).length}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/30 backdrop-blur-sm">
                  <span className="text-sm font-medium">Удаленно</span>
                  <span className="font-bold text-secondary-foreground">
                    {attendanceRecords.filter((r: any) =>
                      r.date === new Date().toDateString() && r.status === 'remote'
                    ).length}
                  </span>
                </div>
                <div className="relative w-full h-4 bg-secondary/30 rounded-full overflow-hidden backdrop-blur-sm">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-1000"
                    style={{
                      width: `${employeeStats.total > 0 ?
                        Math.min(100, (employeeStats.attendanceToday / employeeStats.total) * 100) : 0}%`
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  {employeeStats.total > 0 ?
                    Math.round((employeeStats.attendanceToday / employeeStats.total) * 100) : 0}%
                  сотрудников сегодня
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Виджет отметки посещений */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={isDirector ? "lg:col-span-1" : "lg:col-span-3"}>
          <CheckInWidget />
        </div>

        {/* Последние активности - только для директоров */}
        {isDirector && (
          <div className="lg:col-span-2">
            <Card className="p-4 sm:p-6 relative overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-background via-background to-secondary/10 backdrop-blur-sm">
              <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
              <div className="relative z-10">
                <div className="flex items-center space-x-2 mb-6">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-secondary">
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold">Последние активности</h3>
                </div>
                <div className="space-y-3">
                  {attendanceRecords
                    .filter((r: any) => r.date === new Date().toDateString())
                    .slice(-5)
                    .map((record: any, index: number) => (
                      <div key={index} className="flex items-center space-x-3 p-3 rounded-lg bg-secondary/30 backdrop-blur-sm border border-primary/10 hover:border-primary/30 transition-all group">
                        <div className="flex-shrink-0">
                          {record.checkOut ? (
                            <div className="p-2 rounded-lg bg-destructive/20 group-hover:bg-destructive/30 transition-colors">
                              <XCircle className="h-4 w-4 text-destructive" />
                            </div>
                          ) : (
                            <div className="p-2 rounded-lg bg-green-500/20 group-hover:bg-green-500/30 transition-colors">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {employees.find((emp: any) => emp.id === record.employeeId)?.name || 'Сотрудник'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {record.checkOut ? 'Завершил работу' : 'Начал работу'} в {record.checkIn?.slice(0, 5) || '—'}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs backdrop-blur-sm">
                          {record.status === 'in_office' ? 'В офисе' : 'Удаленно'}
                        </Badge>
                      </div>
                    ))}

                  {attendanceRecords.filter((r: any) => r.date === new Date().toDateString()).length === 0 && (
                    <div className="text-center py-8">
                      <div className="p-4 rounded-full bg-muted/20 inline-block mb-3">
                        <AlertTriangle className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">Нет активностей за сегодня</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
