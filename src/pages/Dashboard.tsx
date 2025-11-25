import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { useProjects } from '@/hooks/useProjects';
import { useEmployees } from '@/hooks/useSupabaseData';
import { CheckInWidget } from '@/components/CheckInWidget';
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
  Zap,
  XCircle,
  FileText,
  Award,
  Timer,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Улучшенные компоненты графиков с футуристичным дизайном
const FuturisticBarChart = ({ data, title, colors = ['#3b82f6', '#8b5cf6', '#ec4899'] }: { 
  data: Array<{name: string, value: number}>, 
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
};

const FuturisticPieChart = ({ data, title }: { 
  data: Array<{name: string, value: number, color: string}>, 
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
};

// Компонент метрики с футуристичным дизайном
const MetricCard = ({ 
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
    <Card className="p-6 relative overflow-hidden group cursor-pointer hover:scale-[1.02] transition-all duration-300 border-2 border-transparent hover:border-primary/30 bg-gradient-to-br from-background via-background to-secondary/10 backdrop-blur-sm">
      {/* Градиентный фон при наведении */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
      
      {/* Декоративные элементы */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-secondary/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg shadow-primary/20`}>
            <Icon className="h-6 w-6 text-white" />
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
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <p className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-2">{subtitle}</p>
          )}
        </div>
      </div>
    </Card>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const { projects = [], loading: projectsLoading } = useProjects();
  const { employees = [], loading: employeesLoading } = useEmployees();
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const navigate = useNavigate();

  // Загружаем записи посещений
  useEffect(() => {
    const records = JSON.parse(localStorage.getItem('attendanceRecords') || '[]');
    setAttendanceRecords(records);
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
    return projects.filter((p: any) => {
      const team = p.team || p.notes?.team || [];
      return team.some((member: any) => {
        const memberId = member.userId || member.id || member.employeeId;
        return memberId === user.id;
      });
    });
  }, [projects, user]);

  // Статистика проектов по реальным данным
  const projectStats = useMemo(() => {
    const total = userProjects.length;
    
    // Проекты ожидающие утверждения партнером (только для CEO/deputy)
    const pendingPartnerApproval = (user?.role === 'ceo' || user?.role === 'deputy_director') 
      ? projects.filter((p: any) => {
          const notesStatus = p.notes?.status;
          return notesStatus === 'new' || notesStatus === 'pending_approval';
        }).length
      : 0;
    
    // Проекты ожидающие распределения команды (только для CEO/deputy)
    const awaitingTeam = (user?.role === 'ceo' || user?.role === 'deputy_director')
      ? projects.filter((p: any) => {
          const notesStatus = p.notes?.status;
          return (notesStatus === 'approved' || notesStatus === 'pending_approval') &&
                  (!p.team || p.team.length === 0);
        }).length
      : 0;
    
    // Активные проекты
    const active = userProjects.filter((p: any) => {
      const notesStatus = p.notes?.status;
      if (notesStatus === 'new' || notesStatus === 'pending_approval') return false;
      const status = p.status || p.notes?.status;
      return status === 'in_progress' || status === 'active';
    }).length;
    
    // Завершённые
    const completed = userProjects.filter((p: any) => {
      const status = p.status || p.notes?.status;
      return status === 'completed' || status === 'closed';
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
    
    // Проекты по компаниям
    const projectsByCompany = userProjects.reduce((acc: any, p: any) => {
      const company = p.companyName || p.ourCompany || p.company || p.notes?.companyName || p.notes?.ourCompany || 'Не указана';
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
      .sort(([,a]: any, [,b]: any) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([name, count]: [string, any]) => ({
        name: name.length > 15 ? name.substring(0, 15) + '...' : name,
        value: (count as number) || 0
      }));
  }, [projectStats.projectsByCompany]);

  const roleDistributionData = useMemo(() => {
    if (!employeeStats.byRole || Object.keys(employeeStats.byRole).length === 0) {
      return [];
    }
    return Object.entries(employeeStats.byRole).map(([role, count]) => ({
      name: role === 'partner' ? 'Партнеры' : 
            role === 'manager_1' || role === 'manager_2' || role === 'manager_3' ? 'Менеджеры' :
            role === 'manager' ? 'Менеджеры' :
            role === 'tax_specialist' ? 'Налоговики' :
            role === 'assistant' ? 'Ассистенты' :
            role === 'admin' ? 'Админы' : role,
      value: (count as number) || 0
    }));
  }, [employeeStats.byRole]);

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
      } catch {}
    });
    
    return months.slice(0, 6).map(month => ({
      name: month,
      value: revenueByMonth[month] || 0
    }));
  }, [projects, user]);

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
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header с футуристичным дизайном */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent animate-gradient">
            📊 Дашборд
          </h1>
          <p className="text-muted-foreground mt-1">
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
        <Badge variant="outline" className="flex items-center space-x-2 px-4 py-2 backdrop-blur-sm border-primary/20">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <Activity className="h-4 w-4" />
          <span>Обновлено: {new Date().toLocaleTimeString('ru-RU')}</span>
        </Badge>
      </div>

      {/* Основные метрики - адаптивные для каждой роли */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${isDirector ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
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
          title="Активные проекты"
          value={projectStats.active}
          icon={Briefcase}
          subtitle={`из ${projectStats.total} всего`}
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
          subtitle="Проектов"
          gradient="from-indigo-500 to-blue-600"
        />

        {/* Средний прогресс - для партнеров и менеджеров */}
        {(isPartner || isManager) && (
          <MetricCard
            title="Средний прогресс"
            value={`${projectStats.avgProgress}%`}
            icon={Target}
            subtitle="По всем проектам"
            gradient="from-orange-500 to-red-600"
          />
        )}

        {/* Ожидают утверждения - для procurement и директоров */}
        {(isProcurement || isDirector) && projectStats.pendingPartnerApproval > 0 && (
          <MetricCard
            title="Ожидают утверждения"
            value={projectStats.pendingPartnerApproval}
            icon={AlertTriangle}
            subtitle="Требуют внимания"
            gradient="from-yellow-500 to-orange-600"
          />
        )}
      </div>

      {/* Графики и аналитика - адаптивные */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Статус проектов */}
        {projectStatusData.length > 0 && (
          <Card className="p-6 relative overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-background via-background to-secondary/10 backdrop-blur-sm">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
            <div className="relative z-10">
              <div className="flex items-center space-x-2 mb-6">
                <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-secondary">
                  <PieChart className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold">Статус проектов</h3>
              </div>
              <FuturisticPieChart data={projectStatusData} title="" />
            </div>
          </Card>
        )}

        {/* Распределение по компаниям */}
        {companyDistributionData.length > 0 && (
          <Card className="p-6 relative overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-background via-background to-secondary/10 backdrop-blur-sm">
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

        {/* Распределение по ролям - только для директоров */}
        {isDirector && roleDistributionData.length > 0 && (
          <Card className="p-6 relative overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-background via-background to-secondary/10 backdrop-blur-sm">
            <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/5 rounded-full blur-3xl" />
            <div className="relative z-10">
              <div className="flex items-center space-x-2 mb-6">
                <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold">Команда по ролям</h3>
              </div>
              <FuturisticBarChart data={roleDistributionData} title="" colors={['#8b5cf6', '#ec4899', '#f59e0b']} />
            </div>
          </Card>
        )}

        {/* Месячная выручка - только для директоров */}
        {isDirector && monthlyRevenueData.length > 0 && (
          <Card className="p-6 relative overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-background via-background to-secondary/10 backdrop-blur-sm">
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
          <Card className="p-6 relative overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-background via-background to-secondary/10 backdrop-blur-sm">
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

      {/* Виджет отметки посещений и активности */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <CheckInWidget />
        </div>
        
        {/* Последние активности */}
        <div className="lg:col-span-2">
          <Card className="p-6 relative overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-background via-background to-secondary/10 backdrop-blur-sm">
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
                        {record.checkOut ? 'Завершил работу' : 'Начал работу'} в {new Date(record.checkIn).toLocaleTimeString('ru-RU')}
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
      </div>
    </div>
  );
}
